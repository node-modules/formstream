/*!
 * formstream - lib/formstream.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 *
 * Data format:
 *

--FormStreamBoundary1349886663601\r\n
Content-Disposition: form-data; name="foo"\r\n
\r\n
<FIELD-CONTENT>\r\n
--FormStreamBoundary1349886663601\r\n
Content-Disposition: form-data; name="file"; filename="formstream.test.js"\r\n
Content-Type: application/javascript\r\n
\r\n
<FILE-CONTENT>\r\n
--FormStreamBoundary1349886663601\r\n
Content-Disposition: form-data; name="pic"; filename="fawave.png"\r\n
Content-Type: image/png\r\n
\r\n
<IMAGE-CONTENT>\r\n
--FormStreamBoundary1349886663601--

 * 
 */

"use strict";

/**
 * Module dependencies.
 */
require('buffer-concat');
var Stream = require('stream');
var parseStream = require('pause-stream');
var util = require('util');
var mime = require('mime');
var path = require('path');
var fs = require('fs');

var PADDING = '--';
var NEW_LINE = '\r\n';
var NEW_LINE_BUFFER = new Buffer(NEW_LINE);

function FormStream() {
  if (!(this instanceof FormStream)) {
    return new FormStream();
  }

  FormStream.super_.call(this);
  this._boundary = this._generateBoundary();
  this._streams = [];
  this._fields = [];
  this._buffers = [];
  this._endData = new Buffer(PADDING + this._boundary + PADDING + NEW_LINE);
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

/**
 * Set total stream size.
 * 
 * You know total stream data size and you want to set `Content-Length` in headers.
 */
FormStream.prototype.setTotalStreamSize = function (size) {
  size = size || 0;
  // plus fileds data size
  this._formatFields();
  if (this._fieldsData) {
    size += this._fieldsData.length;
  }

  // plus stream field data size
  for (var i = 0; i < this._streams.length; i++) {
    var item = this._streams[i];
    size += item[0].length;
    size += NEW_LINE_BUFFER.length; // stream field end pedding size
  }

  // plus buffers size
  for (var i = 0; i < this._buffers.length; i++) {
    var item = this._buffers[i];
    size += item[0].length;
    size += item[1].length;
    size += NEW_LINE_BUFFER.length;
  }
  
  // end padding data size
  size += this._endData.length;
  this._contentLength = size;
};

FormStream.prototype.headers = function (options) {
  var headers = {
    'Content-Type': 'multipart/form-data; boundary=' + this._boundary
  };
  if (typeof this._contentLength === 'number') {
    headers['Content-Length'] = String(this._contentLength);
  }
  if (options) {
    for (var k in options) {
      headers[k] = options[k];
    }
  }
  return headers;
};

FormStream.prototype.file = function (name, filepath, filename) {
  var mimeType = mime.lookup(filepath);
  if (!filename) {
    filename = path.basename(filepath);
  }
  this.stream(name, fs.createReadStream(filepath), filename, mimeType);
};

FormStream.prototype.field = function (name, value) {
  this._fields.push([name, value]);
  process.nextTick(this.resume.bind(this));
};

FormStream.prototype.stream = function (name, stream, filename, mimeType) {
  mimeType = mimeType || mime.lookup(filename);
  var ps = parseStream().pause();
  stream.pipe(ps);
  this._streams.push([
    this._formatStreamField(name, filename, mimeType),
    ps
  ]);
  process.nextTick(this.resume.bind(this));
};

FormStream.prototype.buffer = function (name, buffer, filename, mimeType) {
  mimeType = mimeType || mime.lookup(filename);
  this._buffers.push([
    this._formatStreamField(name, filename, mimeType),
    buffer
  ]);
  process.nextTick(this.resume.bind(this));
};

FormStream.prototype._emitEnd = function () {
  // ending format:
  // 
  // --{boundary}--\r\n
  this.emit('data', this._endData);
  this.emit('end');
};

FormStream.prototype._formatFields = function () {
  if (!this._fields.length) {
    return;
  }

  var lines = '';
  for (var i = 0; i < this._fields.length; i++) {
    var field = this._fields[i];
    lines += PADDING + this._boundary + NEW_LINE;
    lines += 'Content-Disposition: form-data; name="' + field[0] + '"' + NEW_LINE;
    lines += NEW_LINE;
    lines += field[1];
    lines += NEW_LINE;
  }
  this._fieldsData = new Buffer(lines);
  this._fields = [];
};

FormStream.prototype._emitFields = function () {
  this._formatFields();
  if (this._fieldsData) {
    var data = this._fieldsData;
    this._fieldsData = null;
    this.emit('data', data);
  }
};

FormStream.prototype._emitBuffers = function () {
  if (!this._buffers.length) {
    return;
  }
  for (var i = 0; i < this._buffers.length; i++) {
    var item = this._buffers[i];
    this.emit('data', item[0]);
    this.emit('data', item[1]);
    this.emit('data', NEW_LINE_BUFFER);
  }
  this._buffers = [];
};

FormStream.prototype._formatStreamField = function (name, filename, mimeType) {
  var data = PADDING + this._boundary + NEW_LINE;
  data += 'Content-Disposition: form-data; name="' + name +'"; filename="' + filename + '"' + NEW_LINE;
  data += 'Content-Type: ' + mimeType + NEW_LINE;
  data += NEW_LINE;
  return new Buffer(data);
};

FormStream.prototype._emitStream = function (item) {
  var self = this;
  // item: [ fieldData, stream ]
  self.emit('data', item[0]);

  var stream = item[1];
  stream.on('data', function (data) {
    self.emit('data', data);
  });
  stream.on('end', function () {
    self.emit('data', NEW_LINE_BUFFER);
    return process.nextTick(self.drain.bind(self));
  });
  stream.resume();
};

FormStream.prototype.drain = function () {
  this._emitFields();
  this._emitBuffers();
  var item = this._streams.shift();
  if (item) {
    this._emitStream(item);
  } else {
    // end
    this._emitEnd();
  }
  return this;  
};

FormStream.prototype.resume = function () {
  this.paused = false;
  if (!this._draining) {
    this._draining = true;
    this.drain();
  }
  return this;
};
