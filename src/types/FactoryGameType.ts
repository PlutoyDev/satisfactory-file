import type { FGuid, FMD5Hash, FPropertyTag, FTransform3f, ObjectReference } from './UnrealTypes';

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
  saveDataHash: FMD5Hash;
  isCreativeModeEnabled: boolean;
}

export interface ValidationGrid {
  cellSize: number;
  gridHash: number;
  cellHash: Map<string, number>;
}

export type ValidationGrids = Map<string, ValidationGrid>;

export type FPropertyTagExtended = FPropertyTag & {
  innerTag?: FPropertyTag | null;
  valueTag?: FPropertyTag | null;
};

export type DestroyedActor = ObjectReference;
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
  transform: FTransform3f;
  wasPlacedInLevel: boolean;
}

export class FPropertyReadError extends Error {
  constructor(
    public tag: FPropertyTag,
    public data: ArrayBuffer,
    public error: unknown,
  ) {
    super(
      `Reading property ${tag.name} resulted in error: ${
        error && typeof error === 'object' && 'message' in error ? error.message : error
      }`,
    );
  }

  toJSON() {
    return {
      message: this.message,
      tag: this.tag,
      dataBase64: btoa(String.fromCharCode(...new Uint8Array(this.data))),
      error: this.error,
    };
  }
}

export type ObjectProperties = Record<string, unknown> & {
  $errors?: Record<string, FPropertyReadError>;
  $tags: FPropertyTag[];
};

export type FGObject = (
  | FObjectSaveHeader
  | (FActorSaveHeader & {
      parent: ObjectReference;
      children: ObjectReference[];
    })
) & {
  version: number;
  properties: ObjectProperties;
  hasPropertyGuid: boolean; // (default is false)
  propertyGuid?: FGuid; // (only if hasPropertyGuid is true)
  extraData?: ArrayBuffer; // Extra data after the object, if any
};

export class ReadFGObjectError extends Error {
  constructor(
    public object: FGObject,
    public data: ArrayBuffer,
    public objectIndex: number,
    public error: unknown,
  ) {
    super(
      `Reading object ${object.className} resulted in error: ${
        error && typeof error === 'object' && 'message' in error ? error.message : error
      }`,
    );
  }

  toJSON() {
    return {
      message: this.message,
      object: this.object,
      objectIndex: this.objectIndex,
      dataBase64: btoa(String.fromCharCode(...new Uint8Array(this.data))),
      error: this.error,
    };
  }
}

export interface PerLevelStreamingLevelSaveData {
  objects: (FGObject | ReadFGObjectError)[];
  tocDestroyedActors?: DestroyedActor[];
  destroyedActors?: DestroyedActor[];
}

export interface PersistentAndRuntimeSaveData {
  objects: (FGObject | ReadFGObjectError)[];
  tocDestroyedActors?: DestroyedActor[];
  levelToDestroyedActorsMap?: Map<string, DestroyedActor[]>;
}

export interface FullSaveData {
  header: Header;
  validationGrids: ValidationGrids;
  perLevelStreamingLevelDataMap: Map<string, PerLevelStreamingLevelSaveData>;
  persistentLevel: PersistentAndRuntimeSaveData;
  unresolvedDestroyedActors: DestroyedActor[];
}
