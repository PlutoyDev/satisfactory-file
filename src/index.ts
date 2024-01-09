import { unzlibSync } from 'fflate';
import SequentialReader from './lib/SequentialReader';
import * as ur from './lib/UnrealTypeReaders';

interface SatisfactorySaveHeader {
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

export class SatisfactorySaveReader {
  primaryReader?: SequentialReader;
  secondaryReader?: SequentialReader;

  static readHeader(reader: SequentialReader) {
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
}
