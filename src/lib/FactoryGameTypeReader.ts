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

export type DestroyedActor = ObjectReference;

export function readObjectReference(reader: SequentialReader): ObjectReference {
  const levelName = ur.readFString(reader);
  const pathName = ur.readFString(reader);
  return { levelName, pathName };
}

export interface FObjectBase {
  /** 0: Object, 1: Actor */
  type: 0 | 1;
  className: string;
  reference: ObjectReference;
}

export interface FObjectSaveHeader extends FObjectBase {
  type: 0;
  outerPathName: string;
}

export interface FActorSaveHeader extends FObjectBase {
  type: 1;
  needTransform: boolean;
  transform: ur.FTransform3f;
  wasPlacedInLevel: boolean;
}

export function readFGObjectSaveHeader(reader: SequentialReader): FObjectSaveHeader | FActorSaveHeader {
  const type = reader.readInt() as 0 | 1;
  const className = ur.readFString(reader);
  const reference = readObjectReference(reader);
  if (type === 0) {
    const outerPathName = ur.readFString(reader);
    return { type, className, reference, outerPathName };
  }

  if (type === 1) {
    const needTransform = reader.readInt() !== 0;
    const transform = ur.readFTransform3f(reader);
    const wasPlacedInLevel = reader.readInt() !== 0;
    return { type, className, reference, needTransform, transform, wasPlacedInLevel };
  }

  throw new Error(`Invalid type ${type}`);
}
