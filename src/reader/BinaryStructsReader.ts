import type { SequentialReader } from './SequentialReader';
import { readFString, readObjectReference } from './UnrealTypeReaders';
import type {
  Vector,
  Quat,
  Box,
  LinearColor,
  FluidBox,
  InventoryItem,
  ConveyorBeltItem,
  IntVector,
} from 'types/BinaryStructs';

// Binary Structs

export function readVector(reader: SequentialReader): Vector {
  return {
    x: reader.readDouble(),
    y: reader.readDouble(),
    z: reader.readDouble(),
  };
}

export function readQuat(reader: SequentialReader): Quat {
  return {
    x: reader.readDouble(),
    y: reader.readDouble(),
    z: reader.readDouble(),
    w: reader.readDouble(),
  };
}

export function readBox(reader: SequentialReader): Box {
  return {
    min: readVector(reader),
    max: readVector(reader),
    isValid: reader.readByte() !== 0,
  };
}

export function readLinearColor(reader: SequentialReader): LinearColor {
  return {
    r: reader.readFloat(),
    g: reader.readFloat(),
    b: reader.readFloat(),
    a: reader.readFloat(),
  };
}

export function readFluidBox(reader: SequentialReader): FluidBox {
  return {
    content: reader.readFloat(),
  };
}

export function readInventoryItem(reader: SequentialReader): InventoryItem {
  const unknownInt = reader.readInt();
  if (unknownInt !== 0) {
    console.warn(`Unknown int ${unknownInt} in InventoryItem`);
  }
  const itemClass = readFString(reader);
  const reference = readObjectReference(reader);
  return {
    itemClass,
    reference,
  };
}

export function readConveyorBeltItem(reader: SequentialReader): ConveyorBeltItem {
  const inventoryItem = readInventoryItem(reader);
  const offset = reader.readFloat();
  return {
    inventoryItem,
    offset,
  };
}

export function readIntVector(reader: SequentialReader): IntVector {
  return {
    x: reader.readInt(),
    y: reader.readInt(),
    z: reader.readInt(),
  };
}
