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

export function writeObjectReference(writer: SequentialWriter, value: { level: string; path: string }) {
  writeFString(writer, value.level);
  writeFString(writer, value.path);
}
