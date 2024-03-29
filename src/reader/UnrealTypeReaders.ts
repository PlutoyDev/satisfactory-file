// Exports functions to read Unreal types from a SequentialReader.

import type { FPropertyTag, ObjectReference, FTransform3f, FMD5Hash, FGuid } from 'types/UnrealTypes';
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
    return reader.readAscii(length).slice(0, -1);
  }

  // UTF-16
  return reader.readUtf16(-length).slice(0, -1);
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
  readValue: (reader: SequentialReader, key: K) => V,
): Map<K, V> {
  const length = reader.readInt();
  const result = new Map();
  for (let i = 0; i < length; i++) {
    const key = readKey(reader);
    const value = readValue(reader, key);
    result.set(key, value);
  }
  return result;
}

export function readObjectReference(reader: SequentialReader): ObjectReference {
  const level = readFString(reader);
  const path = readFString(reader);
  return { level, path };
}

export function readFGuid(reader: SequentialReader): FGuid {
  const a = reader.readUint();
  const b = reader.readUint();
  const c = reader.readUint();
  const d = reader.readUint();
  return { a, b, c, d };
}

export function readFMD5Hash(reader: SequentialReader): FMD5Hash {
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
  unzlibSync(new Uint8Array(reader.slice(compressedSize)), {
    out: inflatedData,
  });
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
    const buffer = inflatedChunks[i];
    if (buffer) {
      data.set(buffer, offset);
      // biome-ignore lint/style/noNonNullAssertion: the size is defined in the previous loop
      offset += inflatedChunkSizes[i]!;
    }
  }
  return data;
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

export function readFTransform3f(reader: SequentialReader): FTransform3f {
  const rotation = {
    x: reader.readFloat(),
    y: reader.readFloat(),
    z: reader.readFloat(),
    w: reader.readFloat(),
  };
  const position = {
    x: reader.readFloat(),
    y: reader.readFloat(),
    z: reader.readFloat(),
  };
  const scale = {
    x: reader.readFloat(),
    y: reader.readFloat(),
    z: reader.readFloat(),
  };
  return { rotation, position, scale };
}
