'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var Stream = require('stream');
var formstream = require('../');

var filepath = path.join(__dirname, 'fixtures', 'foo.txt');
var payload = fs.readFileSync(filepath);

function collect(form, callback) {
  var headers = form.headers();
  var chunks = [];
  form.on('error', callback);
  form.on('data', function (chunk) {
    chunks.push(chunk);
  });
  form.on('end', function () {
    var body = Buffer.concat(chunks);
    assert.strictEqual(headers['Content-Length'], String(body.length));
    callback(null, body.toString());
  });
}

function append(form, method, name, filename, mimeType) {
  if (method === 'field') {
    return form.field(name, payload, mimeType);
  }
  if (method === 'buffer') {
    return form.buffer(name, payload, filename, mimeType);
  }
  if (method === 'stream') {
    return form.stream(name, fs.createReadStream(filepath), filename, mimeType, payload.length);
  }
  return form.file(name, filepath, filename, payload.length);
}

describe('multipart header injection', function () {
  var unsafe = 'a\rb\nc\r\n"; name="injected"; 中文.txt';
  var escaped = 'a%0Db%0Ac%0D%0A%22; name=%22injected%22; 中文.txt';

  ['field', 'buffer', 'stream', 'file'].forEach(function (method) {
    it('should escape field names in ' + method + ' headers', function (done) {
      var form = formstream();
      append(form, method, unsafe, 'normal.txt');
      collect(form, function (err, body) {
        assert.ifError(err);
        var disposition = 'Content-Disposition: form-data; name="' + escaped + '"';
        if (method !== 'field') {
          disposition += '; filename="normal.txt"';
        }
        assert.strictEqual(body, '--' + form._boundary + '\r\n' + disposition + '\r\n' +
          (method === 'field' ? '' : 'Content-Type: text/plain\r\n') +
          '\r\n' + payload + '\r\n--' + form._boundary + '--\r\n');
        done();
      });
    });

    if (method !== 'field') {
      it('should escape filenames in ' + method + ' headers', function (done) {
        var form = formstream();
        append(form, method, 'public', unsafe);
        collect(form, function (err, body) {
          assert.ifError(err);
          assert.strictEqual(body, '--' + form._boundary + '\r\n' +
            'Content-Disposition: form-data; name="public"; filename="' + escaped + '"\r\n' +
            '\r\n' + payload +
            '\r\n--' + form._boundary + '--\r\n');
          done();
        });
      });
    }
  });

  ['field', 'buffer', 'stream'].forEach(function (method) {
    [
      'text/plain\rX-Injected: true',
      'text/plain\nX-Injected: true',
      'text/plain\r\nContent-Disposition: form-data; name="is_admin"\r\nContent-Type:'
    ].forEach(function (mimeType, index) {
      it('should reject unsafe MIME type ' + index + ' in ' + method, function (done) {
        var form = formstream();
        var source = new Stream.PassThrough();
        assert.throws(function () {
          if (method === 'stream') {
            form.stream('public', source, 'normal.txt', mimeType);
          } else {
            append(form, method, 'public', 'normal.txt', mimeType);
          }
        }, { name: 'TypeError', message: 'MIME type must not contain CR or LF' });
        assert.strictEqual(source.listenerCount('error'), 0);
        assert.strictEqual(source.listenerCount('data'), 0);
        assert.strictEqual(form.listenerCount('destroy'), 0);
        assert.strictEqual(form._streams.length, 0);
        assert.strictEqual(form._buffers.length, 0);
        form.field('public', 'true');
        collect(form, function (err, body) {
          assert.ifError(err);
          assert.strictEqual(body, '--' + form._boundary + '\r\n' +
            'Content-Disposition: form-data; name="public"\r\n\r\ntrue\r\n' +
            '--' + form._boundary + '--\r\n');
          done();
        });
      });
    });
  });

  it('should preserve ordinary metadata and field contents', function (done) {
    var form = formstream();
    var name = '中文 %22; a\\b';
    var value = 'value\r\n"unchanged"';
    form.field(name, value, 'text/plain; charset="utf-8"');
    collect(form, function (err, body) {
      assert.ifError(err);
      assert.strictEqual(body, '--' + form._boundary + '\r\n' +
        'Content-Disposition: form-data; name="' + name + '"\r\n' +
        'Content-Type: text/plain; charset="utf-8"\r\n\r\n' + value + '\r\n' +
        '--' + form._boundary + '--\r\n');
      done();
    });
  });
});
