import SequentialReader from './SequentialReader';
import * as ur from './UnrealTypeReaders';
import * as bsr from './BinaryStructs';

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
    const cellSize = reader.readInt();
    const gridHash = reader.readUint();
    const cellHash = ur.readTMap(reader, ur.readFString, (r) => r.readUint());
    return { cellSize, gridHash, cellHash };
  });
}

export type DestroyedActor = ur.ObjectReference;
export interface FObjectBase {
  /** 0: Object, 1: Actor */
  type: 0 | 1;
  className: string;
  reference: ur.ObjectReference;
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

export function getTypeReader(reader: SequentialReader, tag: ur.FPropertyTag) {
  const valueType = tag.valueType ?? tag.innerType ?? tag.type; // valueType for Map, innerType is only for Array, Set
  let typeReader: ((r: SequentialReader) => unknown) | undefined = undefined;
  if (Object.keys(readerMap).includes(valueType)) {
    typeReader = readerMap[valueType as keyof typeof readerMap];
  } else if (valueType === 'Byte') {
    // Not sure why the type is Byte but the value is stored as String
    typeReader = !tag.enumName || tag.enumName === 'None' ? readerMap.Int8 : ur.readFString;
  } else if (valueType === 'Struct') {
    let innerTag: ur.FPropertyTag | undefined = undefined;
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
    const keyReader = getTypeReader(reader, tag) as (r: SequentialReader) => unknown;
    return (r: SequentialReader) => {
      const key = keyReader(r);
      const value = typeReader?.(r);
      return { key, value };
    };
  }

  return typeReader;
}

export function readFProperty(reader: SequentialReader, tag: ur.FPropertyTag | undefined = undefined) {
  const localTag = tag ?? ur.readFPropertyTag(reader);
  if (localTag === null) {
    return null;
  }

  if (localTag.type === 'Bool') {
    return localTag.boolValue as boolean;
  }

  let count: number | undefined = undefined;
  if (localTag.type === 'Array' || localTag.type === 'Set' || localTag.type === 'Map') {
    if (localTag.type === 'Set' || localTag.type === 'Map') reader.skip(4); // Skip unknown (Set has 1 extra int in front of count, that is 0)
    count = reader.readInt();
  }

  const valueReader = getTypeReader(reader, localTag);

  if (localTag.type === 'Array' || localTag.type === 'Set' || localTag.type === 'Map') {
    const values: unknown[] = [];
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    for (let i = 0; i < count!; i++) {
      values.push(valueReader(reader));
    }
    return values;
  }
  return valueReader(reader);
}

export function readFProperties(reader: SequentialReader) {
  const properties: Record<string, unknown> = {};
  while (true) {
    try {
      const tag = ur.readFPropertyTag(reader);
      if (tag === null) {
        break;
      }

      const value = readFProperty(reader, tag);
      properties[tag.name] = value;
    } catch (e) {
      console.error('Error parsing property', {
        offset: reader.offset.toString(16),
        error: e,
      });
      throw e;
    }
  }
  return properties;
}

type FGObject = (
  | FObjectSaveHeader
  | (FActorSaveHeader & {
      parent: ur.ObjectReference;
      children: ur.ObjectReference[];
    })
) & {
  properties: Record<string, unknown>;
  hasPropertyGuid: boolean; // (default is false)
  propertyGuid?: ur.FGuid;
};

export function* readLevelObjectData(reader: SequentialReader) {
  const tocBlobLength = reader.readInt64AsNumber();
  const tocBlob = reader.slice(tocBlobLength); // Will remove the TOC blob from the reader
  const tocReader = new SequentialReader(tocBlob);

  const dataBlobLength = reader.readInt64AsNumber();
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
    if (object.type === 1) {
      object.parent = ur.readObjectReference(dataReader);
      object.children = ur.readTArray(dataReader, ur.readObjectReference);
    }
    object.properties = readFProperties(dataReader);
    object.hasPropertyGuid = dataReader.readInt() !== 0;
    if (object.hasPropertyGuid) {
      object.propertyGuid = ur.readFGuid(dataReader);
    }
    objects.push(object as FGObject);
    yield object;
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
  objects: FGObject[];
  tocDestroyedActors?: DestroyedActor[];
  destroyedActors?: DestroyedActor[];
}

export function readPerLevelStreamingLevelDataMap(
  reader: SequentialReader,
): Map<string, PerLevelStreamingLevelSaveData> {
  return ur.readTMap(reader, ur.readFString, (reader) => {
    const levelDataGen = readLevelObjectData(reader);
    const [objCount, ...objects] = Array.from(levelDataGen);
    const tocDestroyedActors = objects.length > (objCount as number) ? (objects.pop() as DestroyedActor[]) : undefined;
    return {
      objects: objects as FGObject[],
      tocDestroyedActors: tocDestroyedActors,
      destroyedActors: ur.readTArray(reader, ur.readObjectReference),
    };
  });
}

export interface PersistentAndRuntimeSaveData {
  objects: FGObject[];
  tocDestroyedActors?: DestroyedActor[];
  levelToDestroyedActorsMap?: Map<string, DestroyedActor[]>;
}

export function readPersistentAndRuntimeData(reader: SequentialReader): PersistentAndRuntimeSaveData {
  const levelDataGen = readLevelObjectData(reader);
  const [objCount, ...objects] = Array.from(levelDataGen);
  const tocDestroyedActors = objects.length > (objCount as number) ? (objects.pop() as DestroyedActor[]) : undefined;
  return {
    objects: objects as FGObject[],
    tocDestroyedActors: tocDestroyedActors,
    levelToDestroyedActorsMap: ur.readTMap(reader, ur.readFString, (r) => ur.readTArray(r, ur.readObjectReference)),
  };
}

export function readUnresolvedDestroyedActor(reader: SequentialReader): DestroyedActor[] {
  return ur.readTArray(reader, ur.readObjectReference);
}

// A much fine grain callback
interface FinnerPersistentLevelCallback {
  objectPerPage?: number;
  onObjectsPage: (objects: FGObject[], index: number, total: number) => void;
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

export async function readSave(source: ArrayBuffer | ReadableStream, callbacks: ReadSaveCallback = {}) {
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
    const validationGrids = readValidationGrids(reader);
    callbacks.onValidationGrids?.(validationGrids);
    const perLevelStreamingLevelDataMap = readPerLevelStreamingLevelDataMap(reader);
    callbacks.onPerLevelStreamingLevelDataMap?.(perLevelStreamingLevelDataMap);
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

      for (let i = 0; i < pageCount; i++) {
        const objects: FGObject[] = [];
        const len = Math.min(objectPerPage, objCount - i * objectPerPage);
        for (let j = 0; j < len; j++) {
          objects.push(levelDataGen.next().value as FGObject);
        }
        onObjectsPage(objects, i, pageCount);
      }

      const { done: hasTocDestroyedActors, value: tocDestroyedActors } = levelDataGen.next() as {
        done: boolean;
        value: DestroyedActor[] | undefined;
      };

      if (hasTocDestroyedActors) {
        // biome-ignore lint/style/noNonNullAssertion: not done, so value is not undefined
        onTocDestroyedActors?.(tocDestroyedActors!);
      }
      const levelToDestroyedActorsMap = ur.readTMap(reader, ur.readFString, (r) =>
        ur.readTArray(r, ur.readObjectReference),
      );
      onLevelToDestroyedActorsMap?.(levelToDestroyedActorsMap);
    } else {
      const persistentLevel = readPersistentAndRuntimeData(reader);
      callbacks.onPersistentLevel?.(persistentLevel);
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
      unresolvedDestroyedActors,
    };
  } catch (e) {
    console.error('Error reading save', e);
    throw e;
  }
}
