import type SequentialWriter from './SequentialWriter';
import { writeFString, writeObjectReference } from 'writer/UnrealTypeWriter';
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

export function writeVector(writer: SequentialWriter, value: Vector): void {
  writer.writeDouble(value.x);
  writer.writeDouble(value.y);
  writer.writeDouble(value.z);
}

export function writeQuat(writer: SequentialWriter, value: Quat): void {
  writer.writeDouble(value.x);
  writer.writeDouble(value.y);
  writer.writeDouble(value.z);
  writer.writeDouble(value.w);
}

export function writeBox(writer: SequentialWriter, value: Box): void {
  writeVector(writer, value.min);
  writeVector(writer, value.max);
  writer.writeByte(value.isValid ? 1 : 0);
}

export function writeLinearColor(writer: SequentialWriter, value: LinearColor): void {
  writer.writeFloat(value.r);
  writer.writeFloat(value.g);
  writer.writeFloat(value.b);
  writer.writeFloat(value.a);
}

export function writeFluidBox(writer: SequentialWriter, value: FluidBox): void {
  writer.writeFloat(value.content);
}

export function writeInventoryItem(writer: SequentialWriter, value: InventoryItem): void {
  writer.writeInt(0);
  writeFString(writer, value.itemClass);
  writeObjectReference(writer, value.reference);
}

export function writeConveyorBeltItem(writer: SequentialWriter, value: ConveyorBeltItem): void {
  writeInventoryItem(writer, value.inventoryItem);
  writer.writeFloat(value.offset);
}

export function writeIntVector(writer: SequentialWriter, value: IntVector): void {
  writer.writeInt(value.x);
  writer.writeInt(value.y);
  writer.writeInt(value.z);
}
