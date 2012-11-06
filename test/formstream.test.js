/*!
 * formstream - test/formstream.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var pedding = require('pedding');
var formstream = require('../');
var Stream = require('stream');
var http = require('http');
var fs = require('fs');
var path = require('path');
var should = require('should');


var root = path.dirname(__dirname);
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
      var err = null;
      try {
        data = JSON.parse(data);
      } catch (e) {
        err = e;
        err.data = data.toString();
      }
      callback(err, data);
    });
  });
  form.pipe(req);
  req.on('error', callback);
  form.on('error', req.emit.bind(req, 'error'));
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
      data.headers.should.not.have.property('content-length');
      data.headers.should.have.property('content-type')
        .with.equal('multipart/form-data; boundary=' + form._boundary);
      data.files.should.eql({});
      done(err);
    });
  });

  it('should post fields only with content-length', function (done) {
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.setTotalStreamSize(0);
    post(port, '/post', form, function (err, data) {
      data.body.should.eql({
        foo: 'bar',
        name: '中文名字',
        pwd: '哈哈pwd'
      });
      data.headers.should.have.property('content-length', String(form._contentLength));
      data.headers.should.have.property('content-type')
        .with.equal('multipart/form-data; boundary=' + form._boundary);
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
      data.headers.should.not.have.property('content-length');
      data.headers.should.have.property('content-type')
        .with.equal('multipart/form-data; boundary=' + form._boundary);
      var files = data.files;
      files.should.have.property('file');
      files.file.filename.should.equal('formstream.test.js');
      files.file.size.should.equal(fs.statSync(__filename).size);
      files.file.mime.should.equal('application/javascript');
      done(err);
    });
  });

  it('should post fields and file with content-length', function (done) {
    fs.stat(__filename, function (err, stat) {
      var form = formstream();
      form.field('foo', 'bar');
      form.field('name', '中文名字');
      form.field('pwd', '哈哈pwd');
      form.file('file', __filename);
      form.setTotalStreamSize(stat.size);
      post(port, '/post', form, function (err, data) {
        data.body.should.eql({
          foo: 'bar',
          name: '中文名字',
          pwd: '哈哈pwd'
        });
        data.headers.should.have.property('content-length').with.equal(String(form._contentLength));
        data.headers.should.have.property('content-type')
          .with.equal('multipart/form-data; boundary=' + form._boundary);
        var files = data.files;
        files.should.have.property('file');
        files.file.filename.should.equal('formstream.test.js');
        files.file.size.should.equal(fs.statSync(__filename).size);
        files.file.mime.should.equal('application/javascript');
        done(err);
      });
    });
  });

  it('should post fields and file with wrong stream size will return error', function (done) {
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.file('file', __filename);
    form.setTotalStreamSize(100);
    post(port, '/post', form, function (err, data) {
      should.exist(err);
      done();
    });
  });

  it('should post not exist file return error', function (done) {
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.file('file', __filename + 'notexists');
    form.setTotalStreamSize(100);
    post(port, '/post', form, function (err, data) {
      should.exist(err);
      err.message.should.include('formstream/test/formstream.test.jsnotexists');
      err.message.should.include('ENOENT, open ');
      done();
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
    form.file('logo', path.join(root, 'logo.png'));
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

  it('should post fields, 2 file with content-length', function (done) {
    var size = 0;
    var ready = function () {
      var form = formstream();
      form.field('foo', 'bar');
      form.field('name', '中文名字');
      form.field('pwd', '哈哈pwd');
      form.file('file', __filename);
      form.file('logo', path.join(root, 'logo.png'));
      form.setTotalStreamSize(size);
      post(port, '/post', form, function (err, data) {
        data.body.should.eql({
          foo: 'bar',
          name: '中文名字',
          pwd: '哈哈pwd'
        });
        data.headers.should.have.property('content-length').with.equal(form._contentLength + '');
        data.headers.should.have.property('content-type')
          .with.match(/^multipart\/form-data; boundary=--------------------------\d{24}$/);
        var files = data.files;
        files.should.have.keys('file', 'logo');
        files.file.filename.should.equal('formstream.test.js');
        files.file.size.should.equal(fs.statSync(__filename).size);
        files.file.mime.should.equal('application/javascript');
        done(err);
      });
    };

    ready = pedding(2, ready);
    fs.stat(__filename, function (err, stat) {
      size += stat.size;
      ready();
    });
    fs.stat(path.join(root, 'logo.png'), function (err, stat) {
      size += stat.size;
      ready();
    });
  });

  describe('buffer()', function () {
    it('should post file content buffer', function (done) {
      var form = formstream();
      form.field('foo', 'bar');
      form.field('name', '中文名字');
      form.field('pwd', '哈哈pwd');
      var buffer = new Buffer('foo content');
      form.buffer('file', buffer, 'foo.txt');
      var bar = new Buffer('bar content中文');
      form.buffer('bar', bar, 'bar.js');
      var logopath = path.join(root, 'logo.png');
      form.file('logo', logopath);
      post(port, '/post', form, function (err, data) {
        data.body.should.eql({
          foo: 'bar',
          name: '中文名字',
          pwd: '哈哈pwd'
        });
        data.headers.should.have.property('content-type')
          .with.equal('multipart/form-data; boundary=' + form._boundary);
        var files = data.files;
        files.should.have.keys('file', 'logo', 'bar');
        files.file.filename.should.equal('foo.txt');
        files.file.size.should.equal(buffer.length);
        files.file.mime.should.equal('text/plain');

        files.bar.filename.should.equal('bar.js');
        files.bar.size.should.equal(bar.length);
        files.bar.mime.should.equal('application/javascript');
        fs.readFileSync(files.bar.path, 'utf8').should.equal('bar content中文');
        
        files.logo.filename.should.equal('logo.png');
        files.logo.size.should.equal(fs.statSync(logopath).size)
        files.logo.mime.should.equal('image/png');
        done(err);
      });
    });

    it('should post file content buffer with content-length', function (done) {
      var form = formstream();
      form.field('foo', 'bar');
      form.field('name', '中文名字');
      form.field('pwd', '哈哈pwd');
      var buffer = new Buffer('file content');
      form.buffer('file', buffer, 'foo.txt');
      var logopath = path.join(root, 'logo.png');
      form.file('logo', logopath);
      form.setTotalStreamSize(fs.statSync(logopath).size);
      post(port, '/post', form, function (err, data) {
        data.body.should.eql({
          foo: 'bar',
          name: '中文名字',
          pwd: '哈哈pwd'
        });
        data.headers.should.have.property('content-type')
          .with.equal('multipart/form-data; boundary=' + form._boundary);
        var files = data.files;
        files.should.have.keys('file', 'logo');
        files.file.filename.should.equal('foo.txt');
        files.file.size.should.equal(buffer.length);
        files.file.mime.should.equal('text/plain');
        
        files.logo.filename.should.equal('logo.png');
        files.logo.size.should.equal(fs.statSync(logopath).size)
        files.logo.mime.should.equal('image/png');
        done(err);
      });
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

    it('should get headers contains content-length after setTotalStreamSize()', function () {
      var form = formstream();
      form.field('foo', 'bar');
      form.setTotalStreamSize(10);
      var headers = form.headers({ 'X-Test': 'hello' });
      headers.should.have.keys('Content-Type', 'X-Test', 'Content-Length');
      headers['Content-Type'].should.match(/^multipart\/form-data; boundary=--------------------------\d{24}$/)
      headers['X-Test'].should.equal('hello');
      headers['Content-Length'].should.equal('171');
    });

  });

});

// end