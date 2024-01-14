import type { SequentialReader } from './SequentialReader';
import { readFString, readObjectReference, type ObjectReference, readFPropertyTag } from './UnrealTypeReaders';

// Binary Structs
export interface Vector {
  x: number;
  y: number;
  z: number;
}

export function readVector(reader: SequentialReader): Vector {
  return {
    x: reader.readDouble(),
    y: reader.readDouble(),
    z: reader.readDouble(),
  };
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export function readQuat(reader: SequentialReader): Quat {
  return {
    x: reader.readDouble(),
    y: reader.readDouble(),
    z: reader.readDouble(),
    w: reader.readDouble(),
  };
}

export interface Box {
  min: Vector;
  max: Vector;
  isValid: boolean;
}

export function readBox(reader: SequentialReader): Box {
  return {
    min: readVector(reader),
    max: readVector(reader),
    isValid: reader.readByte() !== 0,
  };
}

export interface LinearColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function readLinearColor(reader: SequentialReader): LinearColor {
  return {
    r: reader.readFloat(),
    g: reader.readFloat(),
    b: reader.readFloat(),
    a: reader.readFloat(),
  };
}

export interface FluidBox {
  content: number; //The current content of reader fluid box in m^3
}

export function readFluidBox(reader: SequentialReader): FluidBox {
  return {
    content: reader.readFloat(),
  };
}

export interface InventoryItem {
  itemClass: string;
  reference: ObjectReference;
  numItems: number;
}

export function readInventoryItem(reader: SequentialReader): InventoryItem {
  reader.skip(4); // Unknown
  const itemClass = readFString(reader);
  const reference = readObjectReference(reader);
  reader.skip(38); // Property Tag
  const numItems = reader.readInt();
  return {
    itemClass,
    reference,
    numItems,
  };
}

export interface IntVector {
  x: number;
  y: number;
  z: number;
}

export function readIntVector(reader: SequentialReader): IntVector {
  return {
    x: reader.readInt(),
    y: reader.readInt(),
    z: reader.readInt(),
  };
}
