import SequentialWriter from './SequentialWriter';
import * as uw from './UnrealTypeWriter';
import * as bsw from './BinaryStructsWriter';
import {
  Header,
  DestroyedActor,
  FActorSaveHeader,
  FGObject,
  FObjectSaveHeader,
  FPropertyReadError,
  FullSaveData,
  PerLevelStreamingLevelSaveData,
  PersistentAndRuntimeSaveData,
  ReadFGObjectError,
  ValidationGrids,
  ObjectProperties,
  FPropertyTagExtended,
} from 'types/FactoryGameType';
import { FPropertyTag } from 'types/UnrealTypes';

export function writeHeader(writer: SequentialWriter, header: Header) {
  writer.writeInt(header.saveHeaderVersion);
  writer.writeInt(header.saveVersion);
  writer.writeInt(header.buildVersion);
  uw.writeFString(writer, header.mapName);
  uw.writeFString(writer, header.mapOptions);
  uw.writeFString(writer, header.sessionName);
  writer.writeFloat(header.playDurationSeconds);
  uw.writeFDateTime(writer, header.saveDateTime);
  writer.writeByte(header.sessionVisibility);
  writer.writeInt(header.editorObjectVersion);
  uw.writeFString(writer, header.modMetadata);
  writer.writeInt(header.isModdedSave ? 1 : 0);
  uw.writeFString(writer, header.saveIdentifier);
  writer.writeInt(header.isPartitionedWorld ? 1 : 0);
  uw.writeFMD5Hash(writer, header.saveDataHash);
  writer.writeInt(header.isCreativeModeEnabled ? 1 : 0);
}

export function writeValidationGrids(writer: SequentialWriter, validationGrids: ValidationGrids) {
  uw.writeTMap(writer, validationGrids, uw.writeFString, (writer, grid) => {
    writer.writeInt(grid.cellSize);
    writer.writeInt(grid.gridHash);
    uw.writeTMap(writer, grid.cellHash, uw.writeFString, (w, v) => w.writeInt(v));
  });
}

export function writeFGObjectSaveHeader(writer: SequentialWriter, header: FObjectSaveHeader | FActorSaveHeader) {
  writer.writeByte(header.type);
  uw.writeFString(writer, header.className);
  uw.writeObjectReference(writer, header.reference);
  if (header.type === 0) {
    uw.writeFString(writer, header.outerPathName);
  } else {
    writer.writeByte(header.needTransform ? 1 : 0);
    if (header.needTransform) {
      uw.writeFTransform3f(writer, header.transform);
    }
    writer.writeByte(header.wasPlacedInLevel ? 1 : 0);
  }
}

const writerMap = {
  Int8: (w, v) => w.writeInt8(v),
  Int: (w, v) => w.writeInt(v),
  Int64: (w, v) => w.writeInt64(v),
  UInt32: (w, v) => w.writeUint(v),
  Float: (w, v) => w.writeFloat(v),
  Double: (w, v) => w.writeDouble(v),
  Enum: uw.writeFString,
  Str: uw.writeFString,
  Name: uw.writeFString,
  Text: uw.writeFText,
  Object: uw.writeObjectReference,
  Interface: uw.writeObjectReference,
  // biome-ignore lint/suspicious/noExplicitAny: doesn't matter
} satisfies Record<string, (r: SequentialWriter, value: any) => void>;

/*
TODO: Fix this
export function getTypeWriter(writer: SequentialWriter, tag: FPropertyTag | FPropertyTagExtended) {
  const valueType = tag.valueType ?? tag.innerType ?? tag.type;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let valueWriter: ((r: SequentialWriter, value: any) => void) | undefined = undefined;
  if (valueType in writerMap) {
    valueWriter = writerMap[valueType as keyof typeof writerMap];
  } else if (valueType === 'Byte') {
    // Not sure why the type is Byte but the value is stored as String
    valueWriter = !tag.enumName || tag.enumName === 'None' ? writerMap.Int8 : uw.writeFString;
  } else if (valueType === 'Struct') {
    let structName: string | undefined = tag.structName;
    if (tag.type === 'Array' || tag.type === 'Set') {
      if (!('innerTag' in tag) || !tag.innerTag) throw new Error('Expected innerTag');
      if (tag.innerTag.type !== 'Struct') {
        throw new Error(`Expected Struct but got ${tag.innerTag.type}`);
      }
      structName = tag.innerTag.structName;
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
    valueWriter = (structName && bsw[`read${structName}`]) || writeFProperties;
  }

  if (!valueWriter) {
    console.log('Unknown property type', tag);
    throw new Error('Unknown property type');
  }

  if (tag.type === 'Map' && tag.valueType) {
    const keyReader = getTypeWriter(writer, {
      ...tag,
      valueType: undefined,
      
    }) as (r: SequentialWriter) => unknown;
    return (r: SequentialWriter) => {
      const key = keyReader(r);
      const value = valueWriter?.(r);
      return { key, value };
    };
  }

  return {
    valueWriter,

  };

*/
