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

function FormStream() {
  if (!(this instanceof FormStream)) {
    return new FormStream();
  }

  FormStream.super_.call(this);
  this._boundary = this._generateBoundary();
  this._streams = [];
  this._fields = [];

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

FormStream.prototype.headers = function (options) {
  var headers = {
    'Content-Type': 'multipart/form-data; boundary=' + this._boundary
  };
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
  if (!mimeType) {
    // guesss from filename
    mimeType = mime.lookup(filename);
  }
  var ps = parseStream().pause();
  stream.pipe(ps);
  this._streams.push([ name, filename, mimeType, ps ]);
  process.nextTick(this.resume.bind(this));
};

FormStream.prototype._emitEnd = function () {
  // ending format:
  // 
  // --{boundary}--\r\n
  var endData = PADDING + this._boundary + PADDING + NEW_LINE;
  this.emit('data', endData);
  this.emit('end');
};

FormStream.prototype._emitFields = function () {
  if (this._fields.length === 0) {
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
  this._fields = [];
  this.emit('data', lines);
};

FormStream.prototype._emitStream = function (item) {
  var self = this;
  var data = PADDING + this._boundary + NEW_LINE;
  data += 'Content-Disposition: form-data; name="' + item[0] +'"; filename="' + item[1] + '"' + NEW_LINE;
  data += 'Content-Type: ' + item[2] + NEW_LINE;
  data += NEW_LINE;
  self.emit('data', data);

  var stream = item[3];
  stream.on('data', function (data) {
    self.emit('data', data);
  });
  stream.on('end', function () {
    self.emit('data', NEW_LINE);
    return process.nextTick(self.drain.bind(self));
  });
  stream.resume();
};

FormStream.prototype.drain = function () {
  this._emitFields();
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
