formstream [![Build Status](https://secure.travis-ci.org/fengmk2/formstream.png)](http://travis-ci.org/fengmk2/formstream) [![Coverage Status](https://coveralls.io/repos/fengmk2/formstream/badge.png)](https://coveralls.io/r/fengmk2/formstream)
==========

![logo](https://raw.github.com/fengmk2/formstream/master/logo.png)

A [multipart/form-data](http://tools.ietf.org/html/rfc2388) encoded stream, helper for file upload.

## Install

```bash
$ npm install formstream
```

## Quick-start

```js
var formstream = require('formstream');
var http = require('http');

var form = formstream();

// form.file('file', filepath, filename);
form.file('file', './logo.png', 'upload-logo.png');

// other form fields
form.field('foo', 'fengmk2');
form.field('love', 'aerdeng');

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

### Uploading with known `Content-Length`

If you know the `ReadStream` total size and you must to set `Content-Length`.
You may want to use `form.setTotalStreamSize(size)`.

```js
var formstream = require('formstream');
var http = require('http');
var fs = require('fs');

fs.stat('./logo.png', function (err, stat) {
  var form = formstream();
  form.file('file', './logo.png', 'upload-logo.png');
  form.setTotalStreamSize(stat.size);
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
});
```

## API Doc

### formstream()

Create a form instance.

#### Returns

`form`

### .field(name, value)

Add a normal field to the form.

#### Arguments

- **name** String - Name of field
- **value** String - Value of field

### .file(name, filepath[, filename])

Add a local file to be uploaded to the form.

#### Arguments

- **name** String - Name of file field
- **filepath** String - Local path of the file to be uploaded
- ***filename*** String - Optional. Name of the file (will be the base name of `filepath` if empty)

### .buffer(name, buffer, filename[, contentType])

Add a buffer as a file to upload.

#### Arguments

- **name** String - Name of field
- **buffer** Buffer - The buffer to be uploaded
- **filename** String - The file name that tells the remote server
- ***contentType*** String - Optional. Content-Type (aka. MIME Type) of content (will be infered with `filename` if empty)

### .stream(name, stream, filename[, contentType])

Add a readable stream as a file to upload. Event 'error' will be emitted if an error occured.

#### Arguments

- **name** String - Name of field
- **stream** [stream.Readable](http://nodejs.org/api/stream.html#stream_class_stream_readable) - A readable stream to be piped
- **filename** String - The file name that tells the remote server
- ***contentType*** String - Optional. Content-Type (aka. MIME Type) of content (will be infered with `filename` if empty)

### .setTotalStreamSize(size)

In some case you may want a `Content-Length` sent with the POST request. If the total size of streams are known, you can tell it with this method.

#### Arguments

- **size** Number - Size of total stream in bytes.

### .headers(headers)

Add headers to the form payload.

#### Arguments

- **headers** Object - An object contains headers you want to add

#### Example

```js
form.headers({
  'Authorization': 'Bearer kei2akc92jmznvnkeh09sknzdk',
  'Accept': 'application/vnd.github.v3.full+json'
})
```

### Event 'error'

Emitted if there was an error receiving data.

### Event 'data'

The 'data' event emits when a Buffer was used.

See [Node.js Documentation](http://nodejs.org/api/stream.html#stream_event_data) for more.

### Event 'end'

Emitted when the stream has received no more 'data' events will happen.

See [Node.js Documentation](http://nodejs.org/api/stream.html#stream_event_end) for more.

## License

(The MIT License)

Copyright (c) 2012 - 2013 fengmk2 &lt;fengmk2@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
