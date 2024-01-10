import { unzlibSync } from 'fflate';
import SequentialReader from './lib/SequentialReader';
import * as ur from './lib/UnrealTypeReaders';

export namespace SatisfactorySave {
  export interface Header {
    saveHeaderVersion: number;
    saveVersion: number;
    buildVersion: number;
    mapName: string;
    mapOptions: string;
    sessionName: string;
    playDurationSeconds: number;
    saveDateTime: Date;
    sessionVisibility: number;
    editorObjectVersion: number;
    modMetadata: string;
    isModdedSave: boolean;
    saveIdentifier: string;
    isPartitionedWorld: boolean;
    saveDataHash: ur.FMD5Hash;
    isCreativeModeEnabled: boolean;
  }
}

export class SatisfactorySaveReader {
  primaryReader?: SequentialReader;
  secondaryReader?: SequentialReader;

  /**
   * Reads the header of the save file from a SequentialReader
   * @param {SequentialReader} reader
   * @returns {SatisfactorySave.Header} The header of the save file
   */
  static readHeader(reader: SequentialReader): SatisfactorySave.Header {
    const saveHeaderVersion = reader.readInt();
    const saveVersion = reader.readInt();
    const buildVersion = reader.readInt();
    const mapName = ur.readFString(reader);
    const mapOptions = ur.readFString(reader);
    const sessionName = ur.readFString(reader);
    const playDurationSeconds = reader.readFloat();
    const saveDateTime = ur.readFDateTime(reader);
    const sessionVisibility = reader.readByte();
    const editorObjectVersion = reader.readInt();
    const modMetadata = ur.readFString(reader);
    const isModdedSave = reader.readInt() !== 0;
    const saveIdentifier = ur.readFString(reader);
    const isPartitionedWorld = reader.readInt() !== 0;
    const saveDataHash = ur.readFMD5Hash(reader);
    const isCreativeModeEnabled = reader.readInt() !== 0;

    return {
      saveHeaderVersion,
      saveVersion,
      buildVersion,
      mapName,
      mapOptions,
      sessionName,
      playDurationSeconds,
      saveDateTime,
      sessionVisibility,
      editorObjectVersion,
      modMetadata,
      isModdedSave,
      saveIdentifier,
      isPartitionedWorld,
      saveDataHash,
      isCreativeModeEnabled,
    };
  }

  /**
   * Inflate the all the chunks of the save file sequentially
   * @param {SequentialReader} reader The reader to read the chunks from
   * @returns {Uint8Array} The inflated data
   */
  static inflateChunks(reader: SequentialReader) {
    let totalSize = 0;
    let count = 0;
    const inflatedChunks: Uint8Array[] = [];
    const inflatedChunkSizes: number[] = [];
    while (reader.offset < reader.dataView.byteLength) {
      const magicNumber = reader.readUint();
      if (magicNumber !== 0x9e2a83c1) {
        throw new Error(`Invalid magic number: ${magicNumber.toString(16)}`);
      }
      const version = reader.readUint();
      if (version !== 0x22222222) {
        throw new Error(`Invalid version: ${version.toString(16)}`);
      }

      // max chunk size (8) + compressor num (1) + compress size summary (8) + uncompress size summary (8) = 25
      reader.skip(25);
      const compressedSize = Number(reader.readInt64());
      const inflatedSize = Number(reader.readInt64());
      const inflatedData = new Uint8Array(inflatedSize);
      unzlibSync(new Uint8Array(reader.slice(compressedSize)), { out: inflatedData });
      inflatedChunkSizes.push(inflatedSize);
      inflatedChunks.push(inflatedData);
      totalSize += inflatedSize;
      count++;
    }

    const inflatedData = new Uint8Array(totalSize);
    let offset = 0;
    for (let i = 0; i < count; i++) {
      inflatedData.set(inflatedChunks[i], offset);
      offset += inflatedChunkSizes[i];
    }
    return inflatedData;
  }

  /**
   * Generator function to read a save file from a file object.
   * Yields:
   *  - Header
   * @param {File} file The file to read from
   */
  static async *readFromFile(file: File) {
    const stream = file.stream();
    const fileReader = stream.getReader();
    let fullChunk: Uint8Array | undefined = undefined;
    let chunkSize = 0;
    let headerRead = false;
    let headerSize = 0;
    while (true) {
      const { done, value } = await fileReader.read();
      if (done) {
        if (headerRead) {
          break;
        }
        throw new Error('Unexpected end of file');
      }

      chunkSize += value.byteLength;
      if (fullChunk === undefined) {
        fullChunk = value;
      } else {
        const newChunk = new Uint8Array(chunkSize);
        newChunk.set(fullChunk);
        newChunk.set(value, fullChunk.byteLength);
        fullChunk = newChunk;
      }

      try {
        if (!headerRead) {
          const seqReader = new SequentialReader(value);
          const header = SatisfactorySaveReader.readHeader(seqReader);
          headerSize = seqReader.offset;
          headerRead = true;
          yield header;
        }
        // Else do nothing, we already read the header, the while loop will be use to read the rest of the file
      } catch (e) {
        // Check if its RangeError, if so, we need to read more data
        if (!(e instanceof RangeError)) {
          throw e;
        }
      }
    }

    const remainingData = fullChunk.slice(headerSize);
    const inflatedData = SatisfactorySaveReader.inflateChunks(new SequentialReader(remainingData));
  }
}
