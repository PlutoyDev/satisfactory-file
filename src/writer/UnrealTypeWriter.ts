import { ObjectReference, FGuid, FMD5Hash, FPropertyTag, FTransform3f } from 'types/UnrealTypes';
import { SequentialWriter } from './SequentialWriter';
import { zlibSync } from 'fflate';

export function writeFDateTime(writer: SequentialWriter, value: Date) {
  // tick => 100 nanoseconds since 1/1/0001
  const epoch = BigInt(value.getTime() + 62135596800000);
  const ticks = epoch * 10000n;
  writer.writeInt64(ticks);
}

export function writeFString(writer: SequentialWriter, value: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: checking for ascii only, requires control characters
  const isasciiOnly = /^[\x00-\x7F]*$/.test(value);
  if (isasciiOnly) {
    writer.writeInt(value.length);
    writer.writeAscii(value);
  } else {
    writer.writeInt(-value.length);
    writer.writeUtf16(value);
  }
}

export function writeTArray<T>(
  writer: SequentialWriter,
  array: T[],
  writeElement: (writer: SequentialWriter, value: T) => void,
) {
  writer.writeInt(array.length);
  for (const element of array) {
    writeElement(writer, element);
  }
}

export function writeTMap<K, V>(
  writer: SequentialWriter,
  map: Map<K, V>,
  writeKey: (writer: SequentialWriter, key: K) => void,
  writeValue: (writer: SequentialWriter, value: V) => void,
) {
  writer.writeInt(map.size);
  for (const [key, value] of map) {
    writeKey(writer, key);
    writeValue(writer, value);
  }
}

export function writeObjectReference(writer: SequentialWriter, { level, path }: ObjectReference) {
  writeFString(writer, level);
  writeFString(writer, path);
}

export function writeFGuid(writer: SequentialWriter, { a, b, c, d }: FGuid) {
  writer.writeUint(a);
  writer.writeUint(b);
  writer.writeUint(c);
  writer.writeUint(d);
}

export function writeFMD5Hash(writer: SequentialWriter, { IsValid, hash }: FMD5Hash) {
  writer.writeInt(IsValid ? 1 : 0);
  writer.writeBytes(new Uint8Array(hash));
}

export function writeFText(writer: SequentialWriter, value: string) {
  // TODO: incomplete
  writer.writeUint(0); //flags
  writer.writeInt8(-1); // historyType
  writer.writeInt8(1); // hasCultureInvariantString
  writeFString(writer, value);
}

export function deflateChunk(writer: SequentialWriter, data: Uint8Array) {
  const compressedData = zlibSync(data);
  // writer.writeUint(0x9e2a83c1); // magicNumber
  // writer.writeUint(0x22222222); // version
  // writer.writeUint64(0x20000n); // max chunk size
  // writer.writeByte(3); // compressorNum
  // writer.writeUint64(compressedData.length);
  // writer.writeUint64(data.length);
  // writer.writeUint64(compressedData.length);
  // writer.writeUint64(data.length);
  // biome-ignore format: the array are grouped together to make it easier to read
  const chunkHeader = [
    0xc1, 0x83, 0x2a, 0x9e, // magicNumber
    0x22, 0x22, 0x22, 0x22, // version
    0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, // max chunk size
    0x03, // compressorNum
  ];
  writer.writeBytes(new Uint8Array(chunkHeader));
  writer.writeUint64(compressedData.length);
  writer.writeUint64(data.length);
  writer.writeUint64(compressedData.length);
  writer.writeUint64(data.length);
  writer.writeBytes(compressedData);
}

export function deflateChunks(writer: SequentialWriter, data: Uint8Array) {
  // Each chunk is a 0x20000 byte block, split the data into chunks, and deflate each chunk
  const numChunks = Math.ceil(data.length / 0x20000);
  for (let i = 0; i < numChunks; i++) {
    const chunkStart = i * 0x20000;
    const chunkEnd = Math.min((i + 1) * 0x20000, data.length);
    const chunk = data.slice(chunkStart, chunkEnd);
    deflateChunk(writer, chunk);
  }
}

export function writePropertyTag(writer: SequentialWriter, tag: FPropertyTag | null) {
  if (tag === null) {
    writeFString(writer, 'None');
    return;
  }

  const { name, type, size, arrayIndex } = tag;

  writeFString(writer, name);
  writeFString(writer, `${type}Property`);
  writer.writeInt(size);
  writer.writeInt(arrayIndex);

  if (type === 'Bool') {
    writer.writeInt(tag.boolValue ? 1 : 0);
  } else if (type === 'Struct') {
    if (!tag.structName) throw new Error('StructProperty must have a structName');
    writeFString(writer, tag.structName);
  } else if (type === 'Byte' || type === 'Enum') {
    if (!tag.enumName) throw new Error('ByteProperty or EnumProperty must have an enumName');
    writeFString(writer, tag.enumName);
  } else if (type === 'Array' || type === 'Set' || type === 'Map') {
    if (!tag.innerType) throw new Error('ArrayProperty, SetProperty, or MapProperty must have an innerType');
    writeFString(writer, `${tag.innerType}Property`);
    if (type === 'Map') {
      if (!tag.valueType) throw new Error('MapProperty must have valueType');
      writeFString(writer, `${tag.valueType}Property`);
    }
  }

  writer.writeInt(tag.hasPropertyGuid ? 1 : 0);
  if (tag.hasPropertyGuid) {
    if (!tag.propertyGuid) throw new Error('PropertyGuid must be defined');
    writeFGuid(writer, tag.propertyGuid);
  }
}

export function writeFTransform3f(writer: SequentialWriter, { rotation, position, scale }: FTransform3f) {
  writer.writeFloat(rotation.x);
  writer.writeFloat(rotation.y);
  writer.writeFloat(rotation.z);
  writer.writeFloat(rotation.w);
  writer.writeFloat(position.x);
  writer.writeFloat(position.y);
  writer.writeFloat(position.z);
  writer.writeFloat(scale.x);
  writer.writeFloat(scale.y);
  writer.writeFloat(scale.z);
}
