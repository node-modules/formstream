'use strict';

const Os = require('os');
Os.tmpDir = Os.tmpDir || Os.tmpdir;

var pedding = require('pedding');
var Stream = require('stream');
var http = require('http');
var fs = require('fs');
var path = require('path');
var should = require('should');
var urllib = require('urllib');
var formstream = require('../');

var root = path.join(__dirname, 'fixtures');
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
  var done = function (err, data) {
    form.destroy();
    callback(err, data);
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
      done(err, data);
    });
  });
  form.pipe(req);
  req.on('error', done);
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

  it('should post fields only with content-length', function (done) {
    done = pedding(2, done);
    var form = formstream();
    form.field('foo', 'bar');
    form.field('data', JSON.stringify({ foo: 'bar' }), 'application/json');
    form.field('name', '中文名字😄👿收到回复都好舒服的emoji也支持🥥');
    form.field('pwd', '哈哈pwd');
    form.on('destroy', done);
    post(port, '/post', form, function (err, data) {
      should.not.exist(err);
      data.body.should.eql({
        data: '{"foo":"bar"}',
        foo: 'bar',
        name: '中文名字😄👿收到回复都好舒服的emoji也支持🥥',
        pwd: '哈哈pwd'
      });
      data.headers.should.have.property('content-length', String(form._contentLength));
      data.headers.should.have.property('content-type')
        .with.equal('multipart/form-data; boundary=' + form._boundary);
      data.files.should.eql({});
      done(err);
    });
  });

  it.skip('should upload a stream without size, use "Transfer-Encoding: chunked"', function (done) {
    var ChunkedStream = require('../../chunked');
    var form = formstream();
    form.stream('file', fs.createReadStream(path.join(__dirname, 'fixtures', 'foo.txt')), 'foo.txt');
    form.field('name', '哈哈');
    var headers = form.headers();
    headers['Transfer-Encoding'] = 'chunked';
    var chunked = new ChunkedStream();
    form.pipe(chunked);

    var options = {
      method: 'post',
      headers: headers,
      // dataType: 'json',
      stream: chunked,
    };
    var url = 'http://127.0.0.1:' + port;
    // url = 'http://cgi-lib.berkeley.edu/ex/fup.cgi';

    urllib.request(url, options, function (err, data, res) {
      should.not.exist(err);
      // console.log(data.toString());
      res.should.status(200);
      done();
    });
    // chunked.pipe(process.stdout);
  });

  it('should post fields and file', function (done) {
    done = pedding(2, done);
    var now = Date.now();
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.field('now', now);
    form.file('file', __filename);
    form.on('destroy', done);
    post(port, '/post', form, function (err, data) {
      data.body.should.eql({
        foo: 'bar',
        name: '中文名字',
        pwd: '哈哈pwd',
        now: String(now)
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
    form.once('destroy', done);
    post(port, '/post', form, function (err) {
      should.exist(err);
    });
  });

  it('should post fields and file with wrong size will return error', function (done) {
    done = pedding(2, done);
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.file('file', __filename, 100);
    form.on('destroy', done);
    post(port, '/post', form, function (err) {
      should.exist(err);
      done();
    });
  });

  // node 0.8, createSteram not exists file will throw error
  it('should post not exist file return error ENOENT', function (done) {
    var form = formstream();
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    form.file('file', __filename + 'notexists');
    form.setTotalStreamSize(100);
    post(port, '/post', form, function (err) {
      should.exist(err);
      err.message.should.containEql('formstream/test/formstream.test.jsnotexists');
      err.message.should.containEql('ENOENT');
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

  it('should work on minChunkSize = 70000', function (done) {
    var form = formstream({
      minChunkSize: 70000,
    });
    var s1 = cunterStream('no1', 5);
    form.stream('stream1', s1, 'stream1中文名.txt', 'text/html');
    var s2 = cunterStream('no2', 3);
    form.stream('stream2', s2, 'stream2.png');
    form.field('foo', 'bar');
    form.field('name', '中文名字');
    form.field('pwd', '哈哈pwd');
    const tgzFile = path.join(__dirname, 'fixtures/formstream.tgz');
    form.file('file', tgzFile, 'foo.tar.gz');

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
      files.file.filename.should.equal('foo.tar.gz');
      files.file.size.should.equal(fs.statSync(tgzFile).size);
      files.file.mime.should.equal('application/gzip');
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
      var buffer = Buffer.from('foo content');
      form.buffer('file', buffer, 'foo.txt');
      var bar = Buffer.from('bar content中文');
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
        files.logo.size.should.equal(fs.statSync(logopath).size);
        files.logo.mime.should.equal('image/png');
        done(err);
      });
    });

    it('should post file content buffer with content-length', function (done) {
      var form = formstream();
      form.field('foo', 'bar');
      form.field('name', '中文名字');
      form.field('pwd', '哈哈pwd');
      var buffer = Buffer.from('file content');
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
        files.logo.size.should.equal(fs.statSync(logopath).size);
        files.logo.mime.should.equal('image/png');
        done(err);
      });
    });
  });

  describe('headers()', function () {
    it('should get headers contains correct content-length', function () {
      var form = formstream();
      form.field('foo', 'bar');
      var headers = form.headers({ 'X-Test': 'hello' });
      headers.should.have.keys('Content-Type', 'Content-Length', 'X-Test');
      headers['Content-Type'].should.match(/^multipart\/form-data; boundary=--------------------------\d{24}$/);
      headers['X-Test'].should.equal('hello');
      headers['Content-Length'].should.equal('161');
    });

    it('should trust .setTotalStreamSize() only if has any stream/file without size specified', function () {
      var headers1 = formstream()
        .field('field', 'plain')
        .file('file', path.join(root, 'logo.png'), 'file')
        .buffer('buffer', Buffer.alloc(20), 'buffer')
        .stream('stream', cunterStream('stream', 5), 'stream')
        .setTotalStreamSize(10)
        .headers();

      var headers2 = formstream()
        .field('field', 'plain')
        .file('file', path.join(root, 'logo.png'), 'file', 10)
        .buffer('buffer', Buffer.alloc(20), 'buffer')
        .stream('stream', cunterStream('stream', 5), 'stream', 30)
        .headers();

      headers1.should.have.property('Content-Length');
      headers2.should.have.property('Content-Length');

      var length1 = parseInt(headers1['Content-Length']);
      var length2 = parseInt(headers2['Content-Length']);

      length1.should.equal(length2 - 30);
    });
  });

  describe('chaining', function () {
    it('should do chaining calls with .field()', function () {
      var form = formstream();
      form.field('foo', 'bar').should.equal(form);
    });

    it('should do chaining calls with .file()', function () {
      var form = formstream();
      form.file('foo', path.join(root, 'logo.png'), 'bar').should.equal(form);
    });

    it('should do chaining calls with .buffer()', function () {
      var form = formstream();
      form.buffer('foo', Buffer.from('foo content'), 'bar').should.equal(form);
    });

    it('should do chaining calls with .stream()', function () {
      var form = formstream();
      form.stream('foo', cunterStream('stream', 5), 'bar').should.equal(form);
    });

    it('should do chaining calls with .setTotalStreamSize()', function () {
      var form = formstream();
      form.setTotalStreamSize(10).should.equal(form);
    });
  });

  it('should get right mime with emf file', function (done) {
    done = pedding(2, done);
    var form = formstream();
    form.field('foo', 'bar');
    form.file('file', path.join(root, 'test.emf'));
    form.on('destroy', done);
    post(port, '/post', form, function (err, data) {
      data.headers.should.not.have.property('content-length');
      data.headers.should.have.property('content-type')
        .with.equal('multipart/form-data; boundary=' + form._boundary);
      var files = data.files;
      files.should.have.property('file');
      files.file.filename.should.equal('test.emf');
      files.file.mime.should.equal('image/emf');
      done(err);
    });
  });

});
