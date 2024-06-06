'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var formstream = require('..');

var imagepath = path.join(path.dirname(__dirname), 'test/fixtures/logo.png');

var form = formstream({
  // minChunkSize: 1024 * 1024,
});
// form.file('file', filepath, filename);
form.stream('file', fs.createReadStream(imagepath), 'logo.png');
form.field('foo', 'hello world');

var req = http.request({
  method: 'POST',
  host: 'upload.cnodejs.net',
  // host: '127.0.0.1',
  // port: 8081,
  path: '/store',
  headers: form.headers()
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
