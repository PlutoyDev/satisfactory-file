import { type Header, readHeader } from 'reader/FactoryGameTypeReader';
import SequentialReader from 'reader/SequentialReader';

/**
 * Peak at file header without reading the entire file using File readable stream.
 *
 * Can run on main thread.
 * @param {File} file - File to peak at for header
 */
export async function peakHeaderAtFile(file: File | Blob): Promise<Header> {
  const stream = file.stream();
  const reader = stream.getReader();
  let ableToReadHeader = false;
  while (!ableToReadHeader) {
    const { done, value } = await reader.read();
    if (done) {
      throw new Error('Unexpected end of file');
    }
    const sequentialReader = new SequentialReader(value);
    try {
      const header = readHeader(sequentialReader);
      ableToReadHeader = true;
      reader.releaseLock();
      return header;
    } catch (e) {
      if (!(e instanceof RangeError)) {
        //Not a range error, throw it
        throw e;
      }
    }
  }
  throw new Error('Unable to read header');
}

/**
 * Build on top of peakHeaderAtFile to peak at multiple files provided by InputElement, DataTransfer
 * @param files
 */
export async function* peakHeadersAtFiles(files: FileList | File[]) {
  for (const file of files) {
    try {
      yield await peakHeaderAtFile(file);
    } catch (e) {
      console.error(e);
    }
  }
}
