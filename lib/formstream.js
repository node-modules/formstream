/**
 * Form Data format:
 *

```txt
--FormStreamBoundary1349886663601\r\n
Content-Disposition: form-data; name="foo"\r\n
\r\n
<FIELD-CONTENT>\r\n
--FormStreamBoundary1349886663601\r\n
Content-Disposition: form-data; name="data"\r\n
Content-Type: application/json\r\n
\r\n
<JSON-FORMAT-CONTENT>\r\n
--FormStreamBoundary1349886663601\r\n
Content-Disposition: form-data; name="file"; filename="formstream.test.js"\r\n
Content-Type: application/javascript\r\n
\r\n
<FILE-CONTENT-CHUNK-1>
...
<FILE-CONTENT-CHUNK-N>
\r\n
--FormStreamBoundary1349886663601\r\n
Content-Disposition: form-data; name="pic"; filename="fawave.png"\r\n
Content-Type: image/png\r\n
\r\n
<IMAGE-CONTENT>\r\n
--FormStreamBoundary1349886663601--
```

 *
 */

'use strict';

var debug = require('util').debuglog('formstream');
var Stream = require('stream');
var parseStream = require('pause-stream');
var util = require('util');
var mime = require('mime');
var path = require('path');
var fs = require('fs');
var destroy = require('destroy');
var hex = require('node-hex');

var PADDING = '--';
var NEW_LINE = '\r\n';
var NEW_LINE_BUFFER =  Buffer.from(NEW_LINE);

function FormStream(options) {
  if (!(this instanceof FormStream)) {
    return new FormStream(options);
  }

  FormStream.super_.call(this);

  this._boundary = this._generateBoundary();
  this._streams = [];
  this._buffers = [];
  this._endData = Buffer.from(PADDING + this._boundary + PADDING + NEW_LINE);
  this._contentLength = 0;
  this._isAllStreamSizeKnown = true;
  this._knownStreamSize = 0;
  this._minChunkSize = options && options.minChunkSize || 0;

  this.isFormStream = true;
  debug('start boundary\n%s', this._boundary);
}

util.inherits(FormStream, Stream);
module.exports = FormStream;

FormStream.prototype._generateBoundary = function() {
  // https://github.com/felixge/node-form-data/blob/master/lib/form_data.js#L162
  // This generates a 50 character boundary similar to those used by Firefox.
  // They are optimized for boyer-moore parsing.
  var boundary = '--------------------------';
  for (var i = 0; i < 24; i++) {
    boundary += Math.floor(Math.random() * 10).toString(16);
  }

  return boundary;
};

FormStream.prototype.setTotalStreamSize = function (size) {
  // this method should not make any sense if the length of each stream is known.
  if (this._isAllStreamSizeKnown) {
    return this;
  }

  size = size || 0;

  for (var i = 0; i < this._streams.length; i++) {
    size += this._streams[i][0].length;
    size += NEW_LINE_BUFFER.length; // stream field end padding size
  }

  this._knownStreamSize = size;
  this._isAllStreamSizeKnown = true;
  debug('set total size: %s', size);
  return this;
};

FormStream.prototype.headers = function (options) {
  var headers = {
    'Content-Type': 'multipart/form-data; boundary=' + this._boundary
  };

  // calculate total stream size
  this._contentLength += this._knownStreamSize;
  // calculate length of end padding
  this._contentLength += this._endData.length;

  if (this._isAllStreamSizeKnown) {
    headers['Content-Length'] = String(this._contentLength);
  }

  if (options) {
    for (var k in options) {
      headers[k] = options[k];
    }
  }

  debug('headers: %j', headers);
  return headers;
};

FormStream.prototype.file = function (name, filepath, filename, filesize) {
  if (typeof filename === 'number' && !filesize) {
    filesize = filename;
    filename = path.basename(filepath);
  }
  if (!filename) {
    filename = path.basename(filepath);
  }

  var mimeType = mime.getType(filename);
  var stream = fs.createReadStream(filepath);

  return this.stream(name, stream, filename, mimeType, filesize);
};

/**
 * Add a form field
 * @param  {String} name field name
 * @param  {String|Buffer} value field value
 * @param  {String} [mimeType] field mimeType
 * @return {this}
 */
FormStream.prototype.field = function (name, value, mimeType) {
  if (!Buffer.isBuffer(value)) {
    // field(String, Number)
    // https://github.com/qiniu/nodejs-sdk/issues/123
    if (typeof value === 'number') {
      value = String(value);
    }
    value = Buffer.from(value);
  }
  return this.buffer(name, value, null, mimeType);
};

FormStream.prototype.stream = function (name, stream, filename, mimeType, size) {
  if (typeof mimeType === 'number' && !size) {
    size = mimeType;
    mimeType = mime.getType(filename);
  } else if (!mimeType) {
    mimeType = mime.getType(filename);
  }

  stream.once('error', this.emit.bind(this, 'error'));
  // if form stream destroy, also destroy the source stream
  this.once('destroy', function () {
    destroy(stream);
  });

  var leading = this._leading({ name: name, filename: filename }, mimeType);

  var ps = parseStream().pause();
  stream.pipe(ps);

  this._streams.push([leading, ps]);

  // if the size of this stream is known, plus the total content-length;
  // otherwise, content-length is unknown.
  if (typeof size === 'number') {
    this._knownStreamSize += leading.length;
    this._knownStreamSize += size;
    this._knownStreamSize += NEW_LINE_BUFFER.length;
  } else {
    this._isAllStreamSizeKnown = false;
  }

  process.nextTick(this.resume.bind(this));

  return this;
};

FormStream.prototype.buffer = function (name, buffer, filename, mimeType) {
  if (filename && !mimeType) {
    mimeType = mime.getType(filename);
  }

  var disposition = { name: name };
  if (filename) {
    disposition.filename = filename;
  }

  var leading = this._leading(disposition, mimeType);

  // plus buffer length to total content-length
  var bufferSize = leading.length + buffer.length + NEW_LINE_BUFFER.length;
  this._buffers.push(Buffer.concat([leading, buffer, NEW_LINE_BUFFER], bufferSize));  
  this._contentLength += bufferSize;

  process.nextTick(this.resume.bind(this));
  if (debug.enabled) {
    if (buffer.length > 512) {
      debug('new buffer field, content size: %d\n%s%s',
        buffer.length, leading.toString(), hex(buffer.slice(0, 512)));
    } else {
      debug('new buffer field, content size: %d\n%s%s',
        buffer.length, leading.toString(), hex(buffer));
    }
  }
  return this;
};

FormStream.prototype._leading = function (disposition, type) {
  var leading = [PADDING + this._boundary];

  var dispositions = [];

  if (disposition) {
    for (var k in disposition) {
      dispositions.push(k + '="' + disposition[k] + '"');
    }
  }

  leading.push('Content-Disposition: form-data; ' + dispositions.join('; '));
  if (type) {
    leading.push('Content-Type: ' + type);
  }

  leading.push('');
  leading.push('');
  return Buffer.from(leading.join(NEW_LINE));
};

FormStream.prototype._emitBuffers = function () {
  if (!this._buffers.length) {
    return;
  }

  for (var i = 0; i < this._buffers.length; i++) {
    this.emit('data', this._buffers[i]);
  }
  this._buffers = [];
};

FormStream.prototype._emitStream = function (item) {
  var self = this;
  // item: [ leading, stream ]
  var streamSize = 0;
  var chunkCount = 0;
  const leading = item[0];
  self.emit('data', leading);
  chunkCount++;
  if (debug.enabled) {
    debug('new stream, chunk index %d\n%s', chunkCount, leading.toString());
  }

  var stream = item[1];
  stream.on('data', function (data) {
    self.emit('data', data);
    streamSize += leading.length;
    chunkCount++;
    if (debug.enabled) {
      if (data.length > 512) {
        debug('stream chunk, size %d, chunk index %d, stream size %d\n%s......   only show 512 bytes   ......',
          data.length, chunkCount, streamSize, hex(data.slice(0, 512)));
      } else {
        debug('stream chunk, size %d, chunk index %d, stream size %d\n%s',
          data.length, chunkCount, streamSize, hex(data));
      }
    }
  });
  stream.on('end', function () {
    self.emit('data', NEW_LINE_BUFFER);
    chunkCount++;
    debug('stream end, chunk index %d, stream size %d', chunkCount, streamSize);
    return process.nextTick(self.drain.bind(self));
  });
  stream.resume();
};

FormStream.prototype._emitStreamWithChunkSize = function (item, minChunkSize) {
  var self = this;
  // item: [ leading, stream ]
  var streamSize = 0;
  var chunkCount = 0;
  var bufferSize = 0;
  var buffers = [];
  const leading = item[0];
  buffers.push(leading);
  bufferSize += leading.length;
  if (debug.enabled) {
    debug('new stream, with min chunk size: %d\n%s', minChunkSize, leading.toString());
  }

  var stream = item[1];
  stream.on('data', function (data) {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'utf-8');
    }
    buffers.push(data);
    bufferSize += data.length;
    streamSize += data.length;
    debug('got stream data size %d, buffer size %d, stream size %d',
      data.length, bufferSize, streamSize);
    if (bufferSize >= minChunkSize) {
      const chunk = Buffer.concat(buffers, bufferSize);
      buffers = [];
      bufferSize = 0;
      self.emit('data', chunk);
      chunkCount++;
      if (debug.enabled) {
        if (chunk.length > 512) {
          debug('stream chunk, size %d, chunk index %d, stream size %d\n%s......   only show 512 bytes   ......',
            chunk.length, chunkCount, streamSize, hex(chunk.slice(0, 512)));
        } else {
          debug('stream chunk, size %d, chunk index %d, stream size %d\n%s',
            chunk.length, chunkCount, streamSize, hex(chunk));
        }
      }
    }
  });
  stream.on('end', function () {
    buffers.push(NEW_LINE_BUFFER);
    bufferSize += NEW_LINE_BUFFER.length;
    const chunk = Buffer.concat(buffers, bufferSize);
    self.emit('data', chunk);
    chunkCount++;
    if (chunk.length > 512) {
      debug('stream end, size %d, chunk index %d, stream size %d\n%s......   only show 512 bytes   ......',
        chunk.length, chunkCount, streamSize, hex(chunk.slice(0, 512)));
    } else {
      debug('stream end, size %d, chunk index %d, stream size %d\n%s',
        chunk.length, chunkCount, streamSize, hex(chunk));
    }
    return process.nextTick(self.drain.bind(self));
  });
  stream.resume();
};

FormStream.prototype._emitEnd = function () {
  // ending format:
  //
  // --{boundary}--\r\n
  this.emit('data', this._endData);
  this.emit('end');
  if (debug.enabled) {
    debug('end boundary\n%s', this._endData.toString());
  }
};

FormStream.prototype.drain = function () {
  // debug('drain');
  this._emitBuffers();

  var item = this._streams.shift();
  if (item) {
    if (this._minChunkSize && this._minChunkSize > 0) {
      this._emitStreamWithChunkSize(item, this._minChunkSize);
    } else {
      this._emitStream(item);
    }
  } else {
    this._emitEnd();
  }

  return this;
};

FormStream.prototype.resume = function () {
  // debug('resume');
  this.paused = false;

  if (!this._draining) {
    this._draining = true;
    this.drain();
  }

  return this;
};

FormStream.prototype.close = FormStream.prototype.destroy = function () {
  this.emit('destroy');
  // debug('destroy or close');
};
