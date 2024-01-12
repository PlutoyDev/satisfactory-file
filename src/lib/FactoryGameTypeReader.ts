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
  Object: readObjectReference,
  Interface: readObjectReference,
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
      parent: ObjectReference;
      children: ObjectReference[];
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
      object.parent = readObjectReference(dataReader);
      object.children = ur.readTArray(dataReader, readObjectReference);
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
        tocDestroyedActors.push(readObjectReference(tocReader));
      }
      yield tocDestroyedActors;
    }
  }
}

interface PerLevelStreamingLevelSaveData {
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
      destroyedActors: ur.readTArray(reader, readObjectReference),
    };
  });
}

interface PersistentAndRuntimeSaveData {
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
    levelToDestroyedActorsMap: ur.readTMap(reader, ur.readFString, (r) => ur.readTArray(r, readObjectReference)),
  };
}
