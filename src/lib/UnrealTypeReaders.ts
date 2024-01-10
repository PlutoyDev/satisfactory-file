// Exports functions to read Unreal types from a SequentialReader.

import SequentialReader from './SequentialReader';
import { unzlibSync } from 'fflate';

export function readFDateTime(reader: SequentialReader): Date {
  // tick => 100 nanoseconds since 1/1/0001
  const ticks = reader.readInt64();
  const milliseconds = ticks / 10000n;
  const epoch = Number(milliseconds - 62135596800000n);
  return new Date(epoch);
}

export function readFString(reader: SequentialReader): string {
  const length = reader.readInt();
  if (length === 0) {
    return '';
  }

  if (length > 0) {
    // ASCII
    const data = reader.slice(length);
    const decoder = new TextDecoder('ascii');
    return decoder.decode(data).slice(0, -1);
  }

  // UTF-16
  const data = reader.slice(-length * 2);
  const decoder = new TextDecoder('utf-16');
  return decoder.decode(data).slice(0, -1);
}

export function readTArray<T>(reader: SequentialReader, readElement: (reader: SequentialReader) => T): T[] {
  const length = reader.readInt();
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(readElement(reader));
  }
  return result;
}

export function readTMap<K, V>(
  reader: SequentialReader,
  readKey: (reader: SequentialReader) => K,
  readValue: (reader: SequentialReader) => V,
): Map<K, V> {
  const length = reader.readInt();
  const result = new Map();
  for (let i = 0; i < length; i++) {
    const key = readKey(reader);
    const value = readValue(reader);
    result.set(key, value);
  }
  return result;
}

export interface ObjectReference {
  level: string;
  path: string;
}

export function readObjectReference(reader: SequentialReader): ObjectReference {
  const level = readFString(reader);
  const path = readFString(reader);
  return { level, path };
}

export interface FGuid {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function readFGuid(reader: SequentialReader) {
  const a = reader.readUint();
  const b = reader.readUint();
  const c = reader.readUint();
  const d = reader.readUint();
  return { a, b, c, d };
}

export interface FMD5Hash {
  IsValid: boolean;
  hash: ArrayBuffer;
}

export function readFMD5Hash(reader: SequentialReader) {
  const IsValid = reader.readInt() !== 0;
  const hash = reader.slice(16);
  return { IsValid, hash };
}

export function readFText(reader: SequentialReader) {
  // TODO: incomplete
  const flags = reader.readUint(); // Unknown
  const historyType = reader.readInt8(); // ETextHistoryType
  if (historyType === -1) {
    // ETextHistoryType::None
    const hasCultureInvariantString = reader.readInt() !== 0;
    if (hasCultureInvariantString) {
      return readFString(reader);
    }
  }

  throw new Error(`Not implemented: Unable to read FText with Flags=${flags.toString(2)}, HistoryType=${historyType}`);
}

export function inflateChunk(reader: SequentialReader) {
  const magicNumber = reader.readUint();
  if (magicNumber !== 0x9e2a83c1) {
    throw new Error(`Invalid magic number: ${magicNumber.toString(16)}`);
  }
  const version = reader.readUint();
  if (version !== 0x22222222) {
    throw new Error(`Not implemented: Unable to inflate chunk with version ${version.toString(16)}`);
  }
  reader.skip(8); //max chunk size 131072 or 0x20000
  const compressorNum = reader.readByte();
  if (compressorNum !== 3) {
    throw new Error(`Not implemented: Unable to inflate chunk with compressorNum ${compressorNum}, not zlib`);
  }
  reader.skip(16); // (compressed and uncompressed) size summary
  const compressedSize = Number(reader.readInt64());
  const inflatedSize = Number(reader.readInt64());
  const inflatedData = new Uint8Array(inflatedSize);
  unzlibSync(new Uint8Array(reader.slice(compressedSize)), { out: inflatedData });
  return { inflatedData, inflatedSize };
}

export function inflateChunks(reader: SequentialReader) {
  const inflatedChunks: Uint8Array[] = [];
  const inflatedChunkSizes: number[] = [];
  let totalSize = 0;
  while (!reader.isEOF) {
    const { inflatedData, inflatedSize } = inflateChunk(reader);
    inflatedChunkSizes.push(inflatedSize);
    inflatedChunks.push(inflatedData);
    totalSize += inflatedSize;
  }

  const data = new Uint8Array(totalSize);
  let offset = 0;
  for (let i = 0; i < inflatedChunks.length; i++) {
    data.set(inflatedChunks[i], offset);
    offset += inflatedChunkSizes[i];
  }
}

interface FPropertyTag {
  name: string; // Name/Key of property
  type: string; // Type of property (Removed "Property" suffix)
  size: number; // Property size (default is 0)
  arrayIndex: number; // Index if an array (default is 0)
  boolValue?: boolean; // a boolean property's value (default is false)
  structName?: string; // Struct name if StructProperty.
  enumName?: string; // Enum name if ByteProperty or EnumProperty
  innerType?: string; // Inner type if ArrayProperty, SetProperty, or MapProperty (Remove "Property" suffix)
  valueType?: string; // Value type if MapPropery
  sizeOffset?: number; // location in stream of tag size member ?? (default is 0)
  structGuid?: FGuid;
  hasPropertyGuid: boolean; // (default is false)
  propertyGuid?: FGuid;
}

export function readFPropertyTag(reader: SequentialReader) {
  const name = readFString(reader);

  if (name === 'None') {
    return null;
  }

  const tag: Partial<FPropertyTag> = {
    name,
    type: readFString(reader).slice(0, -8), //Remove Property
    size: reader.readInt(),
    arrayIndex: reader.readInt(),
  };

  if (tag.type === 'Bool') {
    tag.boolValue = reader.readByte() !== 0;
  } else if (tag.type === 'Struct') {
    tag.structName = readFString(reader);
    tag.structGuid = readFGuid(reader);
  } else if (tag.type === 'Enum' || tag.type === 'Byte') {
    tag.enumName = readFString(reader);
  } else if (tag.type === 'Array' || tag.type === 'Set' || tag.type === 'Map') {
    tag.innerType = readFString(reader).slice(0, -8); //Remove Property
    if (tag.type === 'Map') {
      tag.valueType = readFString(reader).slice(0, -8); //Remove Property
    }
  }

  tag.hasPropertyGuid = reader.readByte() !== 0;
  if (tag.hasPropertyGuid) {
    tag.propertyGuid = readFGuid(reader);
  }

  return tag as FPropertyTag;
}
