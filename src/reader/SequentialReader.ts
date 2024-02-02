export class SequentialReader {
  dataView: DataView;
  offset: number;
  autoIncrement: boolean;
  littleEndian: boolean;

  constructor(
    buffer: ArrayBuffer,
    options: {
      offset?: number;
      autoIncrement?: boolean;
      littleEndian?: boolean;
    } = {},
  ) {
    this.dataView = new DataView(buffer);
    this.offset = options?.offset ?? 0;
    this.autoIncrement = options?.autoIncrement ?? false;
    this.littleEndian = options?.littleEndian ?? true;
  }

  get length(): number {
    return this.dataView.byteLength;
  }

  get remaining(): number {
    return this.length - this.offset;
  }

  get isEOF(): boolean {
    return this.remaining <= 0;
  }

  readInt8(): number {
    const value = this.dataView.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readByte(): number {
    const value = this.dataView.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt(): number {
    const value = this.dataView.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readUint(): number {
    const value = this.dataView.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readInt64(): bigint {
    const value = this.dataView.getBigInt64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readUint64(): bigint {
    const value = this.dataView.getBigUint64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readFloat(): number {
    const value = this.dataView.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readDouble(): number {
    const value = this.dataView.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readUint64AsNumber(): number {
    return Number(this.readUint64());
  }

  readInt64AsNumber(): number {
    return Number(this.readInt64());
  }

  // helper functions
  slice(length: number): ArrayBuffer {
    const value = this.dataView.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  skip(length: number): void {
    this.offset += length;
  }

  readAscii(length: number): string {
    const value = new TextDecoder().decode(this.slice(length));
    return value;
  }

  readUtf16(length: number): string {
    const size = length * 2;
    const uint8Arr = new Uint8Array(this.slice(size));
    let value = '';
    for (let i = 0; i < length; i++) {
      const a = uint8Arr[i * 2];
      const b = uint8Arr[i * 2 + 1];
      if (a === undefined || b === undefined) {
        throw new Error('Invalid UTF-16 string');
      }
      const code = this.littleEndian ? a + (b << 8) : (a << 8) + b;
      value += String.fromCodePoint(code);
    }
    return value;
  }
}

export default SequentialReader;
