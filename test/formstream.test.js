/*!
 * formstream - test/formstream.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var formstream = require('../');
var Stream = require('stream');
var http = require('http');
var fs = require('fs');
var should = require('should');

var app = require('./fixtures/server');

function cunterStream(name, count) {
  var s = new Stream();
  s.size = 0;
  var timer = setInterval(function () {
    var data = name + ' counter stream' + count + '\r\n';
    s.size += data.length;
    s.emit('data', data);
    count--;
    if (count <= 0) {
      clearInterval(timer);
      process.nextTick(function () {
        s.emit('end');
      });
    }
  }, 100);
  return s;
}

function post(port, url, form, callback) {
  var options = {
    port: port,
    host: '127.0.0.1',
    path: url,
    method: 'POST',
    headers: form.headers()
  };
  var req = http.request(options);
  req.on('response', function (res) {
    var chunks = [];
    res.on('data', function (chunk) {
      chunks.push(chunk);
    });
    res.on('end', function () {
      var data = Buffer.concat(chunks);
      data = JSON.parse(data);
      callback(null, data);
    });
  });
  form.pipe(req);
}

describe('formstream.test.js', function () {

  var port;
  before(function (done) {
    app = app.listen(0, function () {
      port = app.address().port;
      done();
    });
  });

  it('should post fields only', function (done) {
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    post(port, '/post', form, function (err, data) {
      data.body.should.eql({
        foo: 'bar',
        name: '中文名字',
        pwd: '哈哈pwd'
      });
      data.headers.should.have.property('content-type')
        .with.match(/multipart\/form-data; boundary=--------------------------\d{24}/);
      data.files.should.eql({});
      done(err);
    });
  });

  it('should post fields and file', function (done) {
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.file('file', __filename);
    post(port, '/post', form, function (err, data) {
      data.body.should.eql({
        foo: 'bar',
        name: '中文名字',
        pwd: '哈哈pwd'
      });
      data.headers.should.have.property('content-type')
        .with.match(/multipart\/form-data; boundary=--------------------------\d{24}/);
      var files = data.files;
      files.should.have.property('file');
      files.file.filename.should.equal('formstream.test.js');
      files.file.size.should.equal(fs.statSync(__filename).size);
      files.file.mime.should.equal('application/javascript');
      done(err);
    });
  });

  it('should post fields and stream', function (done) {
    var form = formstream();
    var s1 = cunterStream('no1', 5);
    form.stream('stream1', s1, 'stream1中文名.txt', 'text/html');
    var s2 = cunterStream('no2', 3);
    form.stream('stream2', s2, 'stream2.png');
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.file('file', __filename);

    post(port, '/post', form, function (err, data) {
      data.body.should.eql({
        foo: 'bar',
        name: '中文名字',
        pwd: '哈哈pwd'
      });
      data.headers.should.have.property('content-type')
        .with.match(/multipart\/form-data; boundary=--------------------------\d{24}/);
      var files = data.files;
      files.should.have.keys('stream1', 'stream2', 'file');
      var stream1 = files.stream1;
      var stream2 = files.stream2;
      stream1.filename.should.equal('stream1中文名.txt');
      stream1.size.should.equal(stream1.size);
      stream1.mime.should.equal('text/html');

      stream2.filename.should.equal('stream2.png');
      stream2.size.should.equal(stream2.size);
      stream2.mime.should.equal('image/png');

      files.should.have.property('file');
      files.file.filename.should.equal('formstream.test.js');
      files.file.size.should.equal(fs.statSync(__filename).size);
      files.file.mime.should.equal('application/javascript');
      done(err);
    });
  });

  it('should post fields, 2 file', function (done) {
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.file('file', __filename);
    form.file('logo', __dirname + '/../logo.png');
    post(port, '/post', form, function (err, data) {
      data.body.should.eql({
        foo: 'bar',
        name: '中文名字',
        pwd: '哈哈pwd'
      });
      data.headers.should.have.property('content-type')
        .with.match(/^multipart\/form-data; boundary=--------------------------\d{24}$/);
      var files = data.files;
      files.should.have.keys('file', 'logo');
      files.file.filename.should.equal('formstream.test.js');
      files.file.size.should.equal(fs.statSync(__filename).size);
      files.file.mime.should.equal('application/javascript');
      done(err);
    });
  });

  describe('headers()', function () {
    it('should get headers with content-type', function () {
      var form = formstream();
      var headers = form.headers({ 'X-Test': 'hello' });
      headers.should.have.keys('Content-Type', 'X-Test');
      headers['Content-Type'].should.match(/^multipart\/form-data; boundary=--------------------------\d{24}$/)
      headers['X-Test'].should.equal('hello');
    });
  });

});

// end