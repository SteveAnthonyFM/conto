// Generates the Windows icon set: rounded app icon (icon.ico + PNGs + Store/tile logos) and the
// colored tray icon (tray-icon-win.png). Usage: node scripts/make-windows-icons.mjs
// Same artwork as scripts/make-macos-icon.py, but the rounded body fills more of the canvas
// (Windows does not mask or pad icons the way macOS does). No dependencies.
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src-tauri', 'icons');
const BODY_FRAC = 0.94; // rounded body as a fraction of the canvas (macOS uses 0.805)

const BG = [15, 19, 27], BLUE = [61, 127, 255], DOT = [238, 241, 246];
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const OUTLINE = mix(BG, BLUE, 0.3);

const sdRound = (px, py, hx, hy, r) => {
  const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

// The "C" ring and dot, in the original 1024x1024 art space.
const CX = 539.5, CY = 512, R = 260, A = Math.atan2(212, 150.5);
const inC = (x, y, half) => {
  const dx = x - CX, dy = y - CY, th = Math.atan2(dy, dx);
  if (Math.abs(th) >= A) return Math.abs(Math.hypot(dx, dy) - R) <= half;
  return [[690, 300], [690, 724]].some(([ex, ey]) => Math.hypot(x - ex, y - ey) <= half);
};

function render(size, shade, ss) {
  const buf = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sj = 0; sj < ss; sj++) for (let si = 0; si < ss; si++) {
      const c = shade(((i + (si + 0.5) / ss) / size) * 1024, ((j + (sj + 0.5) / ss) / size) * 1024);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const o = (j * size + i) * 4, n = ss * ss;
    if (a) { buf[o] = Math.round(r / a); buf[o + 1] = Math.round(g / a); buf[o + 2] = Math.round(b / a); buf[o + 3] = Math.round((255 * a) / n); }
  }
  return buf;
}

// App icon: rounded body with transparent margin.
const bodyPx = 1024 * BODY_FRAC, K = BODY_FRAC;
const appShade = (x, y) => {
  x -= 512; y -= 512;
  if (sdRound(x, y, bodyPx / 2, bodyPx / 2, 0.2245 * bodyPx) > 0) return null;
  const ox = 512 + x / K, oy = 512 + y / K;
  let col = BG;
  if (Math.abs(sdRound(ox - 512, oy - 512, 440, 440, 196)) <= 5) col = OUTLINE;
  if (inC(ox, oy, 42)) col = BLUE;
  if (Math.hypot(ox - 690, oy - 512) <= 46) col = DOT;
  return col;
};

// Tray icon: just the glyph (no tile), one bright blue readable on dark and light taskbars.
// Zoomed on the glyph's bounds and drawn heavier than the app icon so it survives 16x16.
const TRAY_BLUE = [74, 139, 255], GLYPH_CX = 488, GLYPH_SPAN = 640;
const trayShade = (x, y) => {
  const ox = GLYPH_CX + ((x - 512) / 1024) * GLYPH_SPAN, oy = 512 + ((y - 512) / 1024) * GLYPH_SPAN;
  return inC(ox, oy, 56) || Math.hypot(ox - 690, oy - 512) <= 62 ? TRAY_BLUE : null;
};

const png = (size, rgba) => {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const chunk = (t, d) => {
    const head = Buffer.alloc(4); head.writeUInt32BE(d.length);
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([Buffer.from(t), d])));
    return Buffer.concat([head, Buffer.from(t), d, tail]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

const ssFor = (n) => (n <= 64 ? 6 : n <= 160 ? 4 : 3);
const cache = new Map();
const app = (n) => { if (!cache.has(n)) cache.set(n, png(n, render(n, appShade, ssFor(n)))); return cache.get(n); };
const write = (name, data) => { writeFileSync(join(OUT, name), data); console.log('wrote', name); };

// Multi-size .ico with embedded PNGs.
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map(app);
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(images[i].length, 8); e.writeUInt32LE(offset, 12); offset += images[i].length;
  return e;
});
write('icon.ico', Buffer.concat([head, ...dir, ...images]));

for (const [name, n] of [['32x32.png', 32], ['64x64.png', 64], ['128x128.png', 128], ['128x128@2x.png', 256], ['icon.png', 512],
  ['StoreLogo.png', 50], ...[30, 44, 71, 89, 107, 142, 150, 284, 310].map((n) => [`Square${n}x${n}Logo.png`, n])]) write(name, app(n));

write('tray-icon-win.png', png(32, render(32, trayShade, 8)));
