# formstream

[![NPM version][npm-image]][npm-url]
[![CI](https://github.com/node-modules/formstream/actions/workflows/ci.yml/badge.svg)](https://github.com/node-modules/formstream/actions/workflows/ci.yml)
[![Test coverage][codecov-image]][codecov-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/formstream.svg?style=flat-square
[npm-url]: https://npmjs.org/package/formstream
[codecov-image]: https://codecov.io/github/node-modules/formstream/coverage.svg?branch=master
[codecov-url]: https://codecov.io/github/node-modules/formstream?branch=master
[download-image]: https://img.shields.io/npm/dm/formstream.svg?style=flat-square
[download-url]: https://npmjs.org/package/formstream

A [multipart/form-data](http://tools.ietf.org/html/rfc2388) encoded stream, helper for file upload.

## Install

```bash
npm install formstream
```

## Quick Start

```js
var formstream = require('formstream');
var http = require('http');

var form = formstream();

// form.file('file', filepath, filename);
form.file('file', './logo.png', 'upload-logo.png');

// other form fields
form.field('foo', 'fengmk2').field('love', 'aerdeng');

// even send file content buffer directly
// form.buffer(name, buffer, filename, mimeType)
form.buffer('file2', new Buffer('This is file2 content.'), 'foo.txt');

var options = {
  method: 'POST',
  host: 'upload.cnodejs.net',
  path: '/store',
  headers: form.headers()
};
var req = http.request(options, function (res) {
  console.log('Status: %s', res.statusCode);
  res.on('data', function (data) {
    console.log(data.toString());
  });
});

form.pipe(req);
```

### Chaining

```js
var fs = require('fs');
var formstream = require('formstream');

var filepath = './logo.png';
fs.stat(filepath, function (err, stat) {
  formstream()
    .field('status', 'share picture')
    .field('access_token', 'your access token')
    .file('pic', filepath, 'logo.png', stat.size)
    .pipe(process.stdout); // your request stream
});
```

### Set min chunk buffer size

Some web servers have a limit on the number of chunks, and you can set `minChunkSize` to ensure the size of chunk sent to the server.

```js
var fs = require('fs');
var FormStream = require('formstream');

var filepath = './big-file.zip';
fs.stat(filepath, function (err, stat) {
  new FormStream({
    // send >= 2MB chunk buffer size to the server
    minChunkSize: 1024 * 1024 * 2,
  }).field('status', 'share file')
    .field('access_token', 'your access token')
    .file('file', filepath, 'big-file.zip', stat.size)
    .pipe(process.stdout); // your request stream
});
```

## API Doc

### formstream([options])

Create a form instance.

#### Arguments

- **options.minChunkSize** Number - min chunk size to emit data event

#### Returns

Form - form instance

### FormStream#field(name, value)

Add a normal field to the form.

#### Arguments

- **name** String - Name of field
- **value** String - Value of field

#### Returns

Form - form instance

### FormStream#file(name, filepath[, filename][, filesize])

Add a local file to be uploaded to the form.

#### Arguments

- **name** String - Name of file field
- **filepath** String - Local path of the file to be uploaded
- ***filename*** String - Optional. Name of the file (will be the base name of `filepath` if empty)
- ***filesize*** Number - Optional. Size of the file (will not generate `Content-Length` header if not specified)

#### Returns

Form - form instance

### FormStream#buffer(name, buffer, filename[, contentType])

Add a buffer as a file to upload.

#### Arguments

- **name** String - Name of field
- **buffer** Buffer - The buffer to be uploaded
- **filename** String - The file name that tells the remote server
- ***contentType*** String - Optional. Content-Type (aka. MIME Type) of content (will be infered with `filename` if empty)

#### Returns

Form - form instance

### FormStream#stream(name, stream, filename[, contentType][, size])

Add a readable stream as a file to upload. Event 'error' will be emitted if an error occured.

#### Arguments

- **name** String - Name of field
- **stream** [stream.Readable](http://nodejs.org/api/stream.html#stream_class_stream_readable) - A readable stream to be piped
- **filename** String - The file name that tells the remote server
- ***contentType*** String - Optional. Content-Type (aka. MIME Type) of content (will be infered with `filename` if empty)
- ***size*** Number - Optional. Size of the stream (will not generate `Content-Length` header if not specified)

#### Returns

Form - form instance

### FormStream#headers([headers])

Get headers for the request.

#### Arguments

- **headers** Object - Additional headers

#### Example

```js
var headers = form.headers({
  'Authorization': 'Bearer kei2akc92jmznvnkeh09sknzdk',
  'Accept': 'application/vnd.github.v3.full+json'
});
```

#### Returns

Object - Headers to be sent.

### Event 'error'

Emitted if there was an error receiving data.

### Event 'data'

The 'data' event emits when a Buffer was used.

See [Node.js Documentation](http://nodejs.org/api/stream.html#stream_event_data) for more.

### Event 'end'

Emitted when the stream has received no more 'data' events will happen.

See [Node.js Documentation](http://nodejs.org/api/stream.html#stream_event_end) for more.

## License

[MIT](LICENSE)

<!-- GITCONTRIBUTOR_START -->

## Contributors

|[<img src="https://avatars.githubusercontent.com/u/156269?v=4" width="100px;"/><br/><sub><b>fengmk2</b></sub>](https://github.com/fengmk2)<br/>|[<img src="https://avatars.githubusercontent.com/u/288288?v=4" width="100px;"/><br/><sub><b>xingrz</b></sub>](https://github.com/xingrz)<br/>|[<img src="https://avatars.githubusercontent.com/u/32174276?v=4" width="100px;"/><br/><sub><b>semantic-release-bot</b></sub>](https://github.com/semantic-release-bot)<br/>|[<img src="https://avatars.githubusercontent.com/u/13151189?v=4" width="100px;"/><br/><sub><b>fjc0k</b></sub>](https://github.com/fjc0k)<br/>|[<img src="https://avatars.githubusercontent.com/u/18096247?v=4" width="100px;"/><br/><sub><b>mrspeiser</b></sub>](https://github.com/mrspeiser)<br/>|[<img src="https://avatars.githubusercontent.com/u/985607?v=4" width="100px;"/><br/><sub><b>dead-horse</b></sub>](https://github.com/dead-horse)<br/>|
| :---: | :---: | :---: | :---: | :---: | :---: |
[<img src="https://avatars.githubusercontent.com/u/7326406?v=4" width="100px;"/><br/><sub><b>shaozj</b></sub>](https://github.com/shaozj)<br/>

This project follows the git-contributor [spec](https://github.com/xudafeng/git-contributor), auto updated at `Wed May 15 2024 00:34:12 GMT+0800`.

<!-- GITCONTRIBUTOR_END -->
