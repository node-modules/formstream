/**!
 * formstream - test/fixtures/server.js
 *
 * Copyright(c) fengmk2 and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

'use strict';

/**
 * Module dependencies.
 */

var multipart = require('connect-multiparty');
var express = require('express');
var app = express();

app.use(multipart());
app.use(function (req, res) {
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
  res.send({
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
    files: files
  });
});

module.exports = app;
