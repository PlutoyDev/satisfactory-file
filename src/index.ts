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
}
