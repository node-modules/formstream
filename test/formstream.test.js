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

describe('formstream.test.js', function () {
  it('should emit fields first then file data', function (done) {
    var form = formstream();
    form.field('foo', 'bar');
    form.file('file', __filename);
    form.pipe(process.stdout);
    form.on('end', function () {
      process.nextTick(done);
    });
  });

  it.only('should emit fields first then stream data', function (done) {
    var form = formstream();
    form.field('foo', '中文');
    var s = new Stream();
    var count = 0;
    var timer = setInterval(function () {
      s.emit('data', 'counter stream' + count + '\r\n');
      count++;
      if (count >= 5) {
        clearInterval(timer);
        process.nextTick(function () {
          s.emit('end');
        });
      }
    }, 500);
    form.stream('stream', 'stream.txt', 'text/html', s);
    form.pipe(process.stdout);
    form.on('end', function () {
      process.nextTick(done);
    });
  });
});

// end