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
  this._boundary = 'FormStreamBoundary' + Date.now();
  this._streams = [];
  this._fields = [];

}
util.inherits(FormStream, Stream);
module.exports = FormStream;

FormStream.create = function () {
  return new FormStream();
};

FormStream.prototype.file = function (name, filepath, filename) {
  var mimeType = mime.lookup(filepath);
  if (!filename) {
    filename = path.basename(filepath);
  }
  this.stream(name, filename, mimeType, fs.createReadStream(filepath));
};

FormStream.prototype.field = function (name, value) {
  this._fields.push([name, value]);
  process.nextTick(this.resume.bind(this));
};

FormStream.prototype.stream = function (name, filename, mimeType, stream) {
  var ps = parseStream().pause();
  stream.pipe(ps);
  this._streams.push([ name, filename, mimeType, ps ]);
};

FormStream.prototype.drain = function () {
  if (this._fields.length > 0) {
    var lines = '';
    for (var i = 0; i < this._fields.length; i++) {
      var field = this._fields[i];
      lines += PADDING + this._boundary + NEW_LINE;
      lines += 'Content-Disposition: form-data; name="' + field[0] + '"' + NEW_LINE;
      lines += NEW_LINE;
      lines += field[1] + NEW_LINE;
    }
    this._fields = [];
    this.emit('data', lines);
  }
  var self = this;
  var item = this._streams[0];
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
    var endData = NEW_LINE;
    endData += PADDING + self._boundary + PADDING + NEW_LINE;
    self.emit('data', endData);
    self.emit('end');
  });
  stream.resume();
};

FormStream.prototype.resume = function () {
  this.paused = false;
  this.drain();
  return this;
};
