// Tiny binary writer/reader for snapshots and input frames (DataView based, no deps).
export class BinWriter {
  constructor(cap = 2048) { this.b = new ArrayBuffer(cap); this.v = new DataView(this.b); this.u = new Uint8Array(this.b); this.p = 0; }
  need(n) { if (this.p + n <= this.b.byteLength) return; let c = this.b.byteLength * 2; while (c < this.p + n) c *= 2; const nb = new ArrayBuffer(c); new Uint8Array(nb).set(this.u); this.b = nb; this.v = new DataView(nb); this.u = new Uint8Array(nb); }
  u8(x) { this.need(1); this.v.setUint8(this.p++, x & 255); return this; }
  i8(x) { this.need(1); this.v.setInt8(this.p++, x); return this; }
  u16(x) { this.need(2); this.v.setUint16(this.p, x & 65535, true); this.p += 2; return this; }
  i16(x) { this.need(2); this.v.setInt16(this.p, x, true); this.p += 2; return this; }
  u32(x) { this.need(4); this.v.setUint32(this.p, x >>> 0, true); this.p += 4; return this; }
  f32(x) { this.need(4); this.v.setFloat32(this.p, x, true); this.p += 4; return this; }
  // fixed point helpers (clamped)
  q16(x, s) { return this.i16(Math.max(-32768, Math.min(32767, Math.round(x * s)))); }
  q8(x, s) { return this.u8(Math.max(0, Math.min(255, Math.round(x * s)))); }
  qi8(x, s) { return this.i8(Math.max(-127, Math.min(127, Math.round(x * s)))); }
  bytes(arr) { this.need(arr.length); this.u.set(arr, this.p); this.p += arr.length; return this; }
  out() { return this.b.slice(0, this.p); }
}
export class BinReader {
  constructor(buf) { this.b = buf; this.v = new DataView(buf); this.p = 0; this.n = buf.byteLength; }
  get left() { return this.n - this.p; }
  chk(k) { if (this.p + k > this.n) throw new Error('short'); }
  u8() { this.chk(1); return this.v.getUint8(this.p++); }
  i8() { this.chk(1); return this.v.getInt8(this.p++); }
  u16() { this.chk(2); const x = this.v.getUint16(this.p, true); this.p += 2; return x; }
  i16() { this.chk(2); const x = this.v.getInt16(this.p, true); this.p += 2; return x; }
  u32() { this.chk(4); const x = this.v.getUint32(this.p, true); this.p += 4; return x; }
  f32() { this.chk(4); const x = this.v.getFloat32(this.p, true); this.p += 4; return x; }
  bytes(n) { this.chk(n); const a = new Uint8Array(this.b, this.p, n); this.p += n; return a; }
}
export const enc = new TextEncoder(), dec = new TextDecoder();
