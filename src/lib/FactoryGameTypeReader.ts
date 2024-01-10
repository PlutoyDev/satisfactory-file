import { unzlibSync } from 'fflate';
import SequentialReader from './SequentialReader';
import * as ur from './UnrealTypeReaders';

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

export function readHeader(reader: SequentialReader): Header {
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

export interface ValidationGrid {
  cellSize: number;
  gridHash: number;
  cellHash: Map<string, number>;
}

export type ValidationGrids = Map<string, ValidationGrid>;

export function readValidationGrids(reader: SequentialReader): ValidationGrids {
  return ur.readTMap(reader, ur.readFString, (reader) => {
    const cellSize = reader.readFloat();
    const gridHash = reader.readInt();
    const cellHash = ur.readTMap(reader, ur.readFString, (r) => r.readInt());
    return { cellSize, gridHash, cellHash };
  });
}

export interface ObjectReference {
  levelName: string;
  pathName: string;
}

export function readObjectReference(reader: SequentialReader): ObjectReference {
  const levelName = ur.readFString(reader);
  const pathName = ur.readFString(reader);
  return { levelName, pathName };
}
