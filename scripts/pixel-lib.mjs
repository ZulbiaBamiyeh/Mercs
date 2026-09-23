// Shared helpers for the pixel-art scripts: colour maths, a shape canvas and
// a tiny PNG encoder (no dependencies beyond node:zlib).
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- colour --
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
// Highlights lean warm, shadows lean cool, as pixel artists usually do.
export const light = (c, t = 0.22) => mix(c, '#fff4d6', t);
export const dark = (c, t = 0.28) => mix(c, '#1a1030', t);

// ---------------------------------------------------------------- canvas --
export class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.col = new Array(w * h).fill(null);
    this.reg = new Int32Array(w * h).fill(-1);
    this.shade = [];
    this.next = 0;
  }
  region(shade = true) { this.shade[this.next] = shade; return this.next++; }
  put(x, y, c, r) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.col[y * this.w + x] = c;
    this.reg[y * this.w + x] = r;
  }
  fill(test, c, opts = {}) {
    const r = opts.region ?? this.region(opts.shade ?? true);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (test(x + 0.5, y + 0.5)) this.put(x, y, c, r);
    return r;
  }
  ellipse(cx, cy, rx, ry, c, o) { return this.fill((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c, o); }
  rect(x0, y0, w, h, c, o) { return this.fill((x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h, c, o); }
  poly(pts, c, o) {
    return this.fill((x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }, c, o);
  }
  line(x0, y0, x1, y1, c, width = 1, o) {
    return this.fill((x, y) => {
      const dx = x1 - x0, dy = y1 - y0;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)) <= width / 2;
    }, c, o);
  }
  px(pts, c) { const r = this.region(false); for (const [x, y] of pts) this.put(x, y, c, r); return r; }
  mirror(pts) { return [...pts, ...pts.map(([x, y]) => [this.w - 1 - x, y])]; }
}

// ------------------------------------------------------------------- png --
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function png(pixels, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = hex(pixels[y * w + x]);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
export const upscale = (px, W, H, s) => {
  const out = new Array(W * s * H * s);
  for (let y = 0; y < H * s; y++) for (let x = 0; x < W * s; x++) out[y * W * s + x] = px[Math.floor(y / s) * W + Math.floor(x / s)];
  return out;
};

