export interface ObjectReference {
  level: string;
  path: string;
}

export interface FGuid {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface FMD5Hash {
  IsValid: boolean;
  hash: ArrayBuffer;
}

export interface FPropertyTag {
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

export interface FTransform3f {
  rotation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
  position: {
    x: number;
    y: number;
    z: number;
  };
  scale: {
    x: number;
    y: number;
    z: number;
  };
}
