/*!
 * formstream - example/upload.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var formstream = require('../');
var http = require('http');
var fs = require('fs');
var path = require('path');

var filepath = __filename;
var imagepath = path.join(path.dirname(__dirname), 'logo.png');

var form = formstream.create();
form.file('file', filepath);
form.stream('image', fs.createReadStream(imagepath));
form.field('foo', 'hello world');

var req = http.request({
  method: 'POST',
  host: 'upload.cnodejs.net',
  path: '/store',
  headers: form.getHeaders()
});
req.on('response', function (res) {
  console.log(res.statusCode, res.headers);
  var chunks = [];
  res.on('data', function (chunk) {
    chunks.push(chunk);
  }).on('end', function () {
    console.log('%s', Buffer.concat(chunks).toString());
    console.log('upload success.');
    process.exit(0);
  });
});

var size = 0;
form.on('data', function (data) {
  size += data.length;
  console.log('uploading... %d bytes', size);
  req.write(data);
}).on('end', function () {
  console.log('uploaded %d bytes', size);
  req.end();
});
