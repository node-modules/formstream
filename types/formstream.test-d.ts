import { Readable } from 'stream'
import formStream from '..'

const fs = formStream()
const fs2: formStream = formStream()
const fsNew = new formStream()
const fsNew2: formStream = new formStream()
new formStream({
  minChunkSize: 100,
});
formStream({
  minChunkSize: 100,
});

// instanceof ok
if (process instanceof formStream) {
  process.stream('file', Readable.from('1'), '1.txt')
}

// @ts-expect-error
fs.field('id')
// @ts-expect-error
fs.field('id', 1)
fs.field('id', '1')
fs.field('data', '{"foo":"bar"}', 'application/json')

// @ts-expect-error
fs.file('avatar')
// @ts-expect-error
fs.file('avatar', 1)
fs.file('avatar', './avatar.png')
fs.file('avatar', './avatar.png', 'avatar.png')
fs.file('avatar', './avatar.png', 'avatar.png', 1000)

// @ts-expect-error
fs.buffer('content')
// @ts-expect-error
fs.buffer('content', Buffer.from('123'))
// @ts-expect-error
fs.buffer('content', '123', '123.txt')
fs.buffer('content', Buffer.from('123'), '123.txt')
fs.buffer('content', Buffer.from('123'), '123.txt', 'text/plain')

// @ts-expect-error
fs.stream('file')
// @ts-expect-error
fs.stream('file', Readable.from('123'))
// @ts-expect-error
fs.stream('file', '123', '123.txt')
fs.stream('file', Readable.from('123'), '123.txt')
fs.stream('file', Readable.from('123'), '123.txt', 'text/plain')
fs.stream('file', Readable.from('123'), '123.txt', 'text/plain', 1000)

fs.headers()
// @ts-expect-error
fs.headers(1)
fs.headers({})
fs.headers({
  'x-token': 'xxxx',
})
