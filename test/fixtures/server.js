/*!
 * formstream - test/fixtures/server.js
 *
 * Copyright(c) 2012 - 2014 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var connect = require('connect');
var multipart = require('connect-multiparty');

var app = connect(
  // function (req, res, next) {
  //   console.log(req.url, req.headers)
  //   req.on('data', function (data) {
  //     console.log(JSON.stringify(data.toString()));
  //   });
  //   req.on('end', function () {
  //     console.log(req.url, req.headers, 'end')
  //   });
  //   next();
  // },
  multipart(),
  function (req, res, next) {
    var files = {};
    for (var k in req.files) {
      var f = req.files[k];
      files[k] = {
        size: f.size || f.length,
        mime: f.type || f.mime,
        filename: f.name || f.filename,
        path: f.path
      };
    }
    res.end(JSON.stringify({
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body,
      files: files
    }));
  }
);

module.exports = app;
