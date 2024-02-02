export class SequentialWriter {
  dataView: DataView;
  offset: number;
  autoIncrement: boolean;
  littleEndian: boolean;
  increaseAmt = 1024;

  constructor(
    buffer?: ArrayBuffer,
    options: {
      offset?: number;
      autoIncrement?: boolean;
      littleEndian?: boolean;
    } = {},
  ) {
    this.dataView = new DataView(buffer ?? new ArrayBuffer(this.increaseAmt * 30));
    this.offset = options?.offset ?? 0;
    this.autoIncrement = options?.autoIncrement ?? false;
    this.littleEndian = options?.littleEndian ?? true;
  }

  get buffer(): ArrayBuffer {
    return this.dataView.buffer;
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

  ensureSpace(size: number) {
    if (this.remaining < size) {
      const newBuffer = new ArrayBuffer(this.length + this.increaseAmt);
      const newView = new Uint8Array(newBuffer);
      newView.set(new Uint8Array(this.buffer));
      this.dataView = new DataView(newBuffer);
    }
  }

  writeInt8(value: number) {
    this.ensureSpace(1);
    this.dataView.setInt8(this.offset, value);
    this.offset += 1;
  }

  writeByte(value: number) {
    this.ensureSpace(1);
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeInt(value: number) {
    this.ensureSpace(4);
    this.dataView.setInt32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  writeUint(value: number) {
    this.ensureSpace(4);
    this.dataView.setUint32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  writeInt64(value: bigint | number) {
    this.ensureSpace(8);
    this.dataView.setBigInt64(this.offset, typeof value === 'number' ? BigInt(value) : value, this.littleEndian);
    this.offset += 8;
  }

  writeUint64(value: bigint | number) {
    this.ensureSpace(8);
    this.dataView.setBigUint64(this.offset, typeof value === 'number' ? BigInt(value) : value, this.littleEndian);
    this.offset += 8;
  }

  writeFloat(value: number) {
    this.ensureSpace(4);
    this.dataView.setFloat32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  writeDouble(value: number) {
    this.ensureSpace(8);
    this.dataView.setFloat64(this.offset, value, this.littleEndian);
    this.offset += 8;
  }

  writeBytes(bytes: Uint8Array) {
    const newSize = this.offset + bytes.length + this.increaseAmt;
    const existing = new Uint8Array(this.buffer);
    const newBuffer = new Uint8Array(new ArrayBuffer(newSize));
    newBuffer.set(existing);
    newBuffer.set(bytes, this.offset);
    this.dataView = new DataView(newBuffer.buffer);
  }

  skip(length: number) {
    // remains 0s to the buffer
    this.ensureSpace(length);
    this.offset += length;
  }

  writeAscii(value: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    this.writeBytes(data);
  }

  writeUtf16(value: string) {
    const size = value.length * 2;
    const uint8Arr = new Uint8Array(size);
    for (let i = 0; i < value.length; i++) {
      const a = value.charCodeAt(i) & 0xff;
      const b = (value.charCodeAt(i) >> 8) & 0xff;
      if (this.littleEndian) {
        uint8Arr[i * 2] = a;
        uint8Arr[i * 2 + 1] = b;
      } else {
        uint8Arr[i * 2] = b;
        uint8Arr[i * 2 + 1] = a;
      }
    }
  }
}
