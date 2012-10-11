/*!
 * formstream - test/fixtures/server.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var connect = require('connect');

var app = connect(
  connect.bodyParser(),
  function (req, res, next) {
    var files = {};
    for (var k in req.files) {
      var f = req.files[k];
      files[k] = {
        size: f.length,
        mime: f.mime,
        filename: f.filename,
        path: f.path
      };
    }
    // console.log(files)
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