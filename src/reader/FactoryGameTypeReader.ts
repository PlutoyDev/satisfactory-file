import SequentialReader from './SequentialReader';
import * as ur from './UnrealTypeReaders';
import * as bsr from './BinaryStructsReader';
import type { FPropertyTag, ObjectReference, FTransform3f, FMD5Hash, FGuid } from 'types/UnrealTypes';

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

export function readHeader(reader: SequentialReader): Header {
  const saveHeaderVersion = reader.readInt();
  if (saveHeaderVersion !== 13) {
    throw new Error(`Unknown save header version ${saveHeaderVersion}`);
  }

  const saveVersion = reader.readInt();
  if (saveVersion < 42) {
    throw new Error(`Unknown save version ${saveVersion}`);
  }

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
    const cellSize = reader.readInt();
    const gridHash = reader.readUint();
    const cellHash = ur.readTMap(reader, ur.readFString, (r) => r.readUint());
    return { cellSize, gridHash, cellHash };
  });
}

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

export function readFGObjectSaveHeader(reader: SequentialReader): FObjectSaveHeader | FActorSaveHeader {
  const type = reader.readInt() as 0 | 1;
  const className = ur.readFString(reader);
  const reference = ur.readObjectReference(reader);
  if (type === 0) {
    const outerPathName = ur.readFString(reader);
    return { type, className, reference, outerPathName };
  }

  if (type === 1) {
    const needTransform = reader.readInt() !== 0;
    const transform = ur.readFTransform3f(reader);
    const wasPlacedInLevel = reader.readInt() !== 0;
    return {
      type,
      className,
      reference,
      needTransform,
      transform,
      wasPlacedInLevel,
    };
  }

  throw new Error(`Invalid type ${type}`);
}

const readerMap = {
  Int8: (r) => r.readInt8(),
  Int: (r) => r.readInt(),
  Int64: (r) => r.readInt64(),
  UInt32: (r) => r.readUint(),
  Float: (r) => r.readFloat(),
  Double: (r) => r.readDouble(),
  Enum: ur.readFString,
  Str: ur.readFString,
  Name: ur.readFString,
  Text: ur.readFText,
  Object: ur.readObjectReference,
  Interface: ur.readObjectReference,
  // biome-ignore lint/suspicious/noExplicitAny: doesn't matter
} satisfies Record<string, (r: SequentialReader) => any>;

export function getTypeReader(reader: SequentialReader, tag: FPropertyTag) {
  const valueType = tag.valueType ?? tag.innerType ?? tag.type; // valueType for Map, innerType is only for Array, Set
  let typeReader: ((r: SequentialReader) => unknown) | undefined = undefined;
  if (Object.keys(readerMap).includes(valueType)) {
    typeReader = readerMap[valueType as keyof typeof readerMap];
  } else if (valueType === 'Byte') {
    // Not sure why the type is Byte but the value is stored as String
    typeReader = !tag.enumName || tag.enumName === 'None' ? readerMap.Int8 : ur.readFString;
  } else if (valueType === 'Struct') {
    let innerTag: FPropertyTag | undefined = undefined;
    let structName: string | undefined = tag.structName;
    if (tag.type === 'Array' || tag.type === 'Set') {
      // biome-ignore lint/style/noNonNullAssertion: Will have inner tag for Array and Set, for StructName
      innerTag = ur.readFPropertyTag(reader)!;
      if (innerTag.type !== 'Struct') {
        throw new Error(`Expected Struct but got ${innerTag.type}`);
      }
      structName = innerTag.structName;
    } else if (tag.type === 'Map') {
      // Special case for MapProperty, struct in map doesn't have structName
      // Instead, it store it as TLVs that can be read using readProperties
      // Except 2 case: where tag.name are mSaveData, mUnresolvedSaveData
      // Both use FIntVector as key but doesn't have field names
      if ((tag.name === 'mSaveData' || tag.name === 'mUnresolvedSaveData') && !tag.valueType) {
        // If tag.valueType is undefined, the valueType the Key
        structName = 'IntVector';
      }
    }
    // @ts-ignore
    typeReader = (structName && bsr[`read${structName}`]) || readFProperties;
  }

  if (!typeReader) {
    console.log('Unknown property type', tag);
    throw new Error('Unknown property type');
  }

  if (tag.type === 'Map' && tag.valueType) {
    const keyReader = getTypeReader(reader, {
      ...tag,
      valueType: undefined,
    }) as (r: SequentialReader) => unknown;
    return (r: SequentialReader) => {
      const key = keyReader(r);
      const value = typeReader?.(r);
      return { key, value };
    };
  }

  return typeReader;
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

export function readFProperty(reader: SequentialReader, tag: FPropertyTag) {
  if (tag === null) {
    return null;
  }

  if (tag.type === 'Bool') {
    return tag.boolValue as boolean;
  }

  const startOffset = reader.offset;
  try {
    let count: number | undefined = undefined;
    if (tag.type === 'Array' || tag.type === 'Set' || tag.type === 'Map') {
      if (tag.type === 'Set' || tag.type === 'Map') {
        const unknown = reader.readInt(); //(Set/Map has 1 extra int in front of count, that is 0)
        if (unknown !== 0) {
          console.warn(`Set/Map unknown int is ${unknown} instead of 0`);
        }
      }
      count = reader.readInt();
    }

    const valueReader = getTypeReader(reader, tag);

    if (tag.type === 'Array' || tag.type === 'Set' || tag.type === 'Map') {
      const values: unknown[] = [];
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      for (let i = 0; i < count!; i++) {
        values.push(valueReader(reader));
      }
      return values;
    }
    return valueReader(reader);
  } catch (e) {
    // Property Tag contains the size, which can be used to skip the property when error occurs
    reader.offset = startOffset;
    const unreadableData = reader.slice(tag.size);
    const error = new FPropertyReadError(tag, unreadableData, e);
    console.error(error);
    throw error;
    // The property is unreadable, but we can still continue reading the rest of the save
  }
}

export function readFProperties(reader: SequentialReader) {
  const properties: Record<string, unknown> & {
    $errors?: Record<string, FPropertyReadError>;
    $tags: FPropertyTag[];
  } = { $tags: [] };
  while (true) {
    try {
      const tag = ur.readFPropertyTag(reader);
      if (tag === null) {
        break;
      }
      properties.$tags.push(tag);

      const value = readFProperty(reader, tag);
      properties[tag.name] = value;
    } catch (e) {
      if (e instanceof FPropertyReadError) {
        // Store the error in the properties separately in $errors
        const existingErrors = (properties.$errors ?? {}) as Record<string, FPropertyReadError>;
        existingErrors[e.tag.name] = e;
        properties.$errors = existingErrors;
      } else {
        throw e;
      }
    }
  }
  return properties;
}

export type FGObject = (
  | FObjectSaveHeader
  | (FActorSaveHeader & {
      parent: ObjectReference;
      children: ObjectReference[];
    })
) & {
  version: number;
  properties: ReturnType<typeof readFProperties>;
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

export function* readLevelObjectData(reader: SequentialReader) {
  const tocBlobLength = reader.readUint64AsNumber();
  const tocBlob = reader.slice(tocBlobLength); // Will remove the TOC blob from the reader
  const tocReader = new SequentialReader(tocBlob);

  const dataBlobLength = reader.readUint64AsNumber();
  const dataBlob = reader.slice(dataBlobLength); // Will remove the data blob from the reader
  const dataReader = new SequentialReader(dataBlob);

  const objectCount = tocReader.readInt();
  const dataCount = dataReader.readInt();

  if (objectCount !== dataCount) {
    throw new Error(`Unable to read Objects: objectCount (${objectCount}) !== dataCount (${dataCount})`);
  }

  yield objectCount;

  const objects: FGObject[] = [];
  for (let i = 0; i < objectCount; i++) {
    const object: Partial<FGObject> = readFGObjectSaveHeader(tocReader);

    object.version = dataReader.readInt();
    const unknownInt = dataReader.readInt();
    if (unknownInt !== 0) {
      console.warn(`Unknown int ${unknownInt} in FGObject`);
    }
    const size = dataReader.readInt();
    const startOffset = dataReader.offset;
    const expectedEnd = dataReader.offset + size;
    try {
      if (object.type === 1) {
        object.parent = ur.readObjectReference(dataReader);
        object.children = ur.readTArray(dataReader, ur.readObjectReference);
      }
      object.properties = readFProperties(dataReader);

      object.hasPropertyGuid = dataReader.readInt() !== 0;
      if (object.hasPropertyGuid) {
        object.propertyGuid = ur.readFGuid(dataReader);
      }

      if (dataReader.offset < expectedEnd) {
        const diff = expectedEnd - dataReader.offset;
        object.extraData = dataReader.slice(diff);
      } else if (dataReader.offset > expectedEnd) {
        throw new Error(`Expected to read ${size} bytes, but only read ${dataReader.offset - startOffset} bytes`);
      }
      yield object;
      objects.push(object as FGObject);
    } catch (e) {
      dataReader.offset = startOffset;
      const unreadableData = dataReader.slice(size);
      const error = new ReadFGObjectError(object as FGObject, unreadableData, i, e);
      console.error(error);
      yield error; // Yield the error, so the caller can handle it, and continue read the rest of the objects
    }
  }

  if (!tocReader.isEOF) {
    // Have destroyed actors in TOC
    const count = tocReader.readInt();
    if (count !== 0) {
      const tocDestroyedActors: DestroyedActor[] = [];
      for (let i = 0; i < count; i++) {
        tocDestroyedActors.push(ur.readObjectReference(tocReader));
      }
      yield tocDestroyedActors;
    }
  }
}

export interface PerLevelStreamingLevelSaveData {
  objects: (FGObject | ReadFGObjectError)[];
  tocDestroyedActors?: DestroyedActor[];
  destroyedActors?: DestroyedActor[];
}

export function readPerLevelStreamingLevelDataMap(
  reader: SequentialReader,
): Map<string, PerLevelStreamingLevelSaveData> {
  return ur.readTMap(reader, ur.readFString, (reader, levelName) => {
    try {
      const levelDataGen = readLevelObjectData(reader);
      const [objCount, ...objects] = Array.from(levelDataGen);
      const tocDestroyedActors =
        objects.length > (objCount as number) ? (objects.pop() as DestroyedActor[]) : undefined;
      return {
        objects: objects as (FGObject | ReadFGObjectError)[],
        tocDestroyedActors: tocDestroyedActors,
        destroyedActors: ur.readTArray(reader, ur.readObjectReference),
      };
    } catch (e) {
      console.error('Error reading per level streaming level data', {
        levelName,
      });
      throw e;
    }
  });
}

export interface PersistentAndRuntimeSaveData {
  objects: (FGObject | ReadFGObjectError)[];
  tocDestroyedActors?: DestroyedActor[];
  levelToDestroyedActorsMap?: Map<string, DestroyedActor[]>;
}

export function readPersistentAndRuntimeData(reader: SequentialReader): PersistentAndRuntimeSaveData {
  try {
    const levelDataGen = readLevelObjectData(reader);
    const [objCount, ...objects] = Array.from(levelDataGen);
    const tocDestroyedActors = objects.length > (objCount as number) ? (objects.pop() as DestroyedActor[]) : undefined;
    return {
      objects: objects as (FGObject | ReadFGObjectError)[],
      tocDestroyedActors: tocDestroyedActors,
      levelToDestroyedActorsMap: ur.readTMap(reader, ur.readFString, (r) => ur.readTArray(r, ur.readObjectReference)),
    };
  } catch (e) {
    console.error('Error reading persistent and runtime data');
    throw e;
  }
}

export function readUnresolvedDestroyedActor(reader: SequentialReader): DestroyedActor[] {
  return ur.readTArray(reader, ur.readObjectReference);
}

// A much fine grain callback
interface FinnerPersistentLevelCallback {
  objectPerPage?: number;
  onObjectsPage: (objects: (FGObject | ReadFGObjectError)[], index: number, total: number) => void;
  onTocDestroyedActors?: (actors: DestroyedActor[]) => void;
  onLevelToDestroyedActorsMap?: (levelToDestroyedActorsMap: Map<string, DestroyedActor[]>) => void;
}

export interface ReadSaveCallback {
  onHeader?: (header: Header) => void;
  onValidationGrids?: (validationGrids: ValidationGrids) => void;
  onPerLevelStreamingLevelDataMap?: (
    perLevelStreamingLevelDataMap: Map<string, PerLevelStreamingLevelSaveData>,
  ) => void;
  onPersistentLevel?: ((persistentLevel: PersistentAndRuntimeSaveData) => void) | FinnerPersistentLevelCallback;
  onUnresolvedDestroyedActors?: (unresolvedDestroyedActors: DestroyedActor[]) => void;
}

export interface FullSaveData {
  header: Header;
  validationGrids: ValidationGrids;
  perLevelStreamingLevelDataMap: Map<string, PerLevelStreamingLevelSaveData>;
  persistentLevel: PersistentAndRuntimeSaveData;
  unresolvedDestroyedActors: DestroyedActor[];
}

/**
 * Main entry point to read a save file.
 *
 * Allow source to be either ArrayBuffer or ReadableStream which can be transfer into web worker. See [Transferable Objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).
 * @param {ArrayBuffer | ReadableStream} source The save file to read
 * @param  {ReadSaveCallback} callbacks Callbacks to be called when reading the save
 * @returns {Promise<FullSaveData>} The save data in Javascript Object
 */
export async function readSave(
  source: ArrayBuffer | ReadableStream,
  callbacks: ReadSaveCallback = {},
): Promise<FullSaveData> {
  let data: ArrayBuffer;
  if (source instanceof ReadableStream) {
    const reader = source.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    // TODO: Replace with for await (const chunk of reader) when it's supported
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      totalLength += value.length;
    }
    const dataTypedArray = new Uint8Array(totalLength);
    for (let i = 0, offset = 0; i < chunks.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: known to be not null
      const chunk = chunks[i]!;
      dataTypedArray.set(chunk, offset);
      offset += chunk.length;
    }
    data = dataTypedArray.buffer;
  } else {
    data = source;
  }

  // Raw reader for non-compressed data, like header
  const rawReader = new SequentialReader(data);
  try {
    const header = readHeader(rawReader);
    callbacks.onHeader?.(header);
    const inflatedData = ur.inflateChunks(rawReader);
    const reader = new SequentialReader(inflatedData.buffer);
    reader.skip(8); //Body size uint64
    const validationGrids = readValidationGrids(reader);
    callbacks.onValidationGrids?.(validationGrids);
    const perLevelStreamingLevelDataMap = readPerLevelStreamingLevelDataMap(reader);
    callbacks.onPerLevelStreamingLevelDataMap?.(perLevelStreamingLevelDataMap);

    let persistentAndRuntimeData: PersistentAndRuntimeSaveData;
    if (typeof callbacks.onPersistentLevel === 'object') {
      const {
        objectPerPage = 100,
        onObjectsPage,
        onTocDestroyedActors,
        onLevelToDestroyedActorsMap,
      } = callbacks.onPersistentLevel;

      const levelDataGen = readLevelObjectData(reader);
      const objCount = levelDataGen.next().value as number;
      const pageCount = Math.ceil(objCount / objectPerPage);
      const objects: (FGObject | ReadFGObjectError)[] = [];
      for (let i = 0; i < pageCount; i++) {
        const objectPage: (FGObject | ReadFGObjectError)[] = [];
        const len = Math.min(objectPerPage, objCount - i * objectPerPage);
        for (let j = 0; j < len; j++) {
          const obj = levelDataGen.next().value as FGObject | ReadFGObjectError;
          objectPage.push(obj);
          objects.push(obj);
        }
        onObjectsPage(objectPage, i * objectPerPage, objCount);
      }

      persistentAndRuntimeData = {
        objects,
      };

      const { done: hasTocDestroyedActors, value: tocDestroyedActors } = levelDataGen.next() as {
        done: boolean;
        value: DestroyedActor[] | undefined;
      };

      if (hasTocDestroyedActors && tocDestroyedActors) {
        onTocDestroyedActors?.(tocDestroyedActors);
        persistentAndRuntimeData.tocDestroyedActors = tocDestroyedActors;
      }
      const levelToDestroyedActorsMap = ur.readTMap(reader, ur.readFString, (r) =>
        ur.readTArray(r, ur.readObjectReference),
      );
      onLevelToDestroyedActorsMap?.(levelToDestroyedActorsMap);
      persistentAndRuntimeData.levelToDestroyedActorsMap = levelToDestroyedActorsMap;
    } else {
      const persistentLevel = readPersistentAndRuntimeData(reader);
      callbacks.onPersistentLevel?.(persistentLevel);
      persistentAndRuntimeData = persistentLevel;
    }

    const unresolvedDestroyedActors = readUnresolvedDestroyedActor(reader);
    callbacks.onUnresolvedDestroyedActors?.(unresolvedDestroyedActors);

    if (!reader.isEOF) {
      throw new Error('Not EOF');
    }

    return {
      header,
      validationGrids,
      perLevelStreamingLevelDataMap,
      persistentLevel: persistentAndRuntimeData,
      unresolvedDestroyedActors,
    };
  } catch (e) {
    console.error('Error reading save', e);
    throw e;
  }
}

export default readSave;
