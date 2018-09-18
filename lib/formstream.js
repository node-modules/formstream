'use strict';

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const debug = require('debug')('formstream');
const destroy = require('destroy');
const mime = require('mime');

const PADDING = '--';
const NEW_LINE = '\r\n';
const NEW_LINE_BUFFER = Buffer.from(NEW_LINE);

class FormStream extends Readable {
  constructor() {
    super();

    this._boundary = this._generateBoundary();
    this._streams = [];
    this._buffers = [];
    this._contentLength = 0;
    this._isAllStreamSizeKnown = true;
    this._knownStreamSize = 0;

    this._eachEnd = null;

    this._endData = Buffer.from(`${PADDING}${this._boundary}${PADDING}${NEW_LINE}`);

    this._currentStream = null;
    this._readingOneStream = false;
  }

  _read() {
    if (this._readingOneStream) {
      debug('> still reading...');
      return;
    }

    if (this._buffers && this._buffers.length) {
      debug('pushing buffers...');
      for (const buf of this._buffers) {
        this.push(buf[0]);
        this.push(buf[1]);
        this.push(NEW_LINE_BUFFER);
      }
      this._buffers = [];
    }

    this._tryNextStream();
  }

  _tryNextStream() {
    if (this._readingOneStream) return;
    this._readingOneStream = true;

    debug('start read...');
    const item = this._streams.shift();
    if (!item) {
      debug('no more stream');
      this.push(this._endData);
      this.push(null);
      this._readingOneStream = false;
      return;
    }

    debug('push leading...');
    this.push(item[0]);
    
    const stream = item[1];
    this._currentStream = stream;

    stream.on('end', () => {
      debug('end chunk');
      this._currentStream = null;
      this.push(NEW_LINE_BUFFER);
      debug('set reading = false');
      this._readingOneStream = false;
      if (stream.destroy) stream.destroy();
      this._tryNextStream();
    });

    stream.on('data', data => {
      this.push(data);
      debug('data chunk >', data.length);
      stream.resume();
    });

    if (stream.resume) {
      stream.resume();
      debug('stream resume');
    }
  }

  _generateBoundary() {
    // https://github.com/felixge/node-form-data/blob/master/lib/form_data.js#L162
    // This generates a 50 character boundary similar to those used by Firefox.
    // They are optimized for boyer-moore parsing.
    let boundary = '--------------------------';
    for (let i = 0; i < 24; i++) {
      boundary += Math.floor(Math.random() * 10).toString(16);
    }
    return boundary;
  }

  setTotalStreamSize(size) {
    // this method should not make any sense if the length of each stream is known.
    if (this._isAllStreamSizeKnown) {
      return this;
    }

    size = size || 0;

    for (let i = 0; i < this._streams.length; i++) {
      size += this._streams[i][0].length;
      size += NEW_LINE_BUFFER.length; // stream field end pedding size
    }

    this._knownStreamSize = size;
    this._isAllStreamSizeKnown = true;

    return this;
  }

  headers(options) {
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${this._boundary}`,
    };

    // calculate total stream size
    this._contentLength += this._knownStreamSize;

    // calculate length of end padding
    this._contentLength += this._endData.length;

    if (this._isAllStreamSizeKnown) {
      headers['Content-Length'] = this._contentLength.toString();
    }

    if (options) {
      for (const k in options) {
        if (!options.hasOwnProperty(k)) continue;
        headers[k] = options[k];
      }
    }

    return headers;
  }

  file(name, filepath, filename, filesize) {
    const mimeType = mime.lookup(filepath);

    if (typeof filename === 'number' && !filesize) {
      filesize = filename;
      filename = path.basename(filepath);
    } else if (!filename) {
      filename = path.basename(filepath);
    }

    const stream = fs.createReadStream(filepath);

    return this.stream(name, stream, filename, mimeType, filesize);
  }

  stream(name, stream, filename, mimeType, size) {
    if (typeof mimeType === 'number' && !size) {
      size = mimeType;
      mimeType = mime.lookup(filename);
    } else if (!mimeType) {
      mimeType = mime.lookup(filename);
    }

    if (stream.pause) stream.pause();

    // if form stream destroy, also destroy the source stream
    stream.once('error', this.emit.bind(this, 'error'));

    const leading = this._leading({ name, filename }, mimeType);
    this._streams.push([ leading, stream ]);

    // if the size of this stream is known, plus the total content-length;
    // otherwise, content-length is unknown.
    if (typeof size === 'number') {
      this._knownStreamSize += leading.length;
      this._knownStreamSize += size;
      this._knownStreamSize += NEW_LINE_BUFFER.length;
    } else {
      this._isAllStreamSizeKnown = false;
    }

    return this;
  }

  pause() {
    if (this._currentStream && this._currentStream.pause) {
      this._currentStream.pause();
    }
    super.pause();
  }

  resume() {
    if (this._currentStream && this._currentStream.resume) {
      this._currentStream.resume();
    }
    super.resume();
  }

  buffer(name, buffer, filename, mimeType) {
    if (filename && !mimeType) {
      mimeType = mime.lookup(filename);
    }

    const disposition = { name: name };
    if (filename) {
      disposition.filename = filename;
    }

    const leading = this._leading(disposition, mimeType);

    this._buffers.push([ leading, buffer ]);

    // plus buffer length to total content-length
    this._contentLength += leading.length;
    this._contentLength += buffer.length;
    this._contentLength += NEW_LINE_BUFFER.length;

    return this;
  }

  _leading(disposition, type) {
    const leading = [ `${PADDING}${this._boundary}` ];

    const disps = [];

    if (disposition) {
      for (const k in disposition) {
        if (!disposition.hasOwnProperty(k)) continue;
        disps.push(`${k}="${disposition[k]}"`);
      }
    }

    leading.push(`Content-Disposition: form-data; ${disps.join('; ')}`);

    if (type) {
      leading.push(`Content-Type: ${type}`);
    }

    leading.push('');
    leading.push('');

    return Buffer.from(leading.join(NEW_LINE));
  }

  field(name, value) {
    if (!Buffer.isBuffer(value)) {
      // field(String, Number)
      // https://github.com/qiniu/nodejs-sdk/issues/123
      if (typeof value === 'number') {
        value = value.toString();
      }
      value = Buffer.from(value);
    }

    return this.buffer(name, value);
  }

  _destroy() {
    for (const stream of this._streams) {
      stream[1].destroy();
    }
    this._streams = [];
    if (this._currentStream) {
      this._currentStream.destroy();
      this._currentStream = null;
    }
  }
}

module.exports = FormStream;
