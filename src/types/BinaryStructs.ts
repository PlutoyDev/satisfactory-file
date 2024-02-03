import { ObjectReference } from './UnrealTypes';

export interface Vector {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Box {
  min: Vector;
  max: Vector;
  isValid: boolean;
}

export interface LinearColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FluidBox {
  content: number; //The current content of reader fluid box in m^3
}

export interface InventoryItem {
  itemClass: string;
  reference: ObjectReference;
}

export interface ConveyorBeltItem {
  inventoryItem: InventoryItem;
  /** The offset of this item along the conveyor belt in range [0,LENGTH] */
  offset: number;
}

export interface IntVector {
  x: number;
  y: number;
  z: number;
}
