import { Readable, Stream } from 'stream'

declare class FormStream extends Stream {
  /**
   * Add a normal field to the form.
   *
   * @param name Name of field
   * @param value Value of field
   */
  field(name: string, value: string, contentType?: string): this

  /**
   * Add a local file to be uploaded to the form.
   *
   * @param name Name of file field
   * @param filepath Local path of the file to be uploaded
   * @param filename Name of the file (will be the base name of filepath if empty)
   * @param filesize Size of the file (will not generate Content-Length header if not specified)
   */
  file(
    name: string,
    filepath: string,
    filename?: string,
    filesize?: number,
  ): this

  /**
   * Add a buffer as a file to upload.
   *
   * @param name Name of field
   * @param buffer The buffer to be uploaded
   * @param filename The file name that tells the remote server
   * @param contentType Content-Type (aka. MIME Type) of content (will be infered with filename if empty)
   */
  buffer(
    name: string,
    buffer: Buffer,
    filename: string,
    contentType?: string,
  ): this

  /**
   * Add a readable stream as a file to upload. Event 'error' will be emitted if an error occured.
   *
   * @param name Name of field
   * @param stream A readable stream to be piped
   * @param filename The file name that tells the remote server
   * @param contentType Content-Type (aka. MIME Type) of content (will be infered with filename if empty)
   * @param size Size of the stream (will not generate Content-Length header if not specified)
   */
  stream(
    name: string,
    stream: Readable,
    filename: string,
    contentType?: string,
    size?: number,
  ): this

  /**
   * Get headers for the request.
   *
   * @param additionalHeaders Additional headers
   */
  headers(additionalHeaders?: Record<string, any>): Record<string, any>
}

interface FormStreamOptions {
  /** min chunk size to emit data event */
  minChunkSize?: number;
}

declare const formStream: {
  new (options?: FormStreamOptions): FormStream
  (options?: FormStreamOptions): FormStream
}

interface formStream extends FormStream {}

export = formStream
