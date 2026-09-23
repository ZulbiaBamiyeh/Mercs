// Generates pixel-art portraits for the original roster.
//
//   node scripts/pixel-portraits.mjs            # writes src/assets/portraits/<id>.png
//   node scripts/pixel-portraits.mjs --sheet    # also writes portraits-sheet.png for review
//
// Each character is built from simple shapes on a 48x60 grid. A shared pass
// then shades every part (light from the upper left), outlines the silhouette
// and dithers the background, and the result is scaled up 8x with hard edges.
// Replace any output file with hand-made art and the game will use that instead.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 48, H = 60, SCALE = 8;

// ---------------------------------------------------------------- colour --
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
// Highlights lean warm, shadows lean cool, as pixel artists usually do.
const light = (c, t = 0.22) => mix(c, '#fff4d6', t);
const dark = (c, t = 0.28) => mix(c, '#1a1030', t);

// ---------------------------------------------------------------- canvas --
class Pix {
  constructor() {
    this.col = new Array(W * H).fill(null);
    this.reg = new Int32Array(W * H).fill(-1);
    this.shade = [];
    this.next = 0;
  }
  region(shade = true) { this.shade[this.next] = shade; return this.next++; }
  put(x, y, c, r) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.col[y * W + x] = c;
    this.reg[y * W + x] = r;
  }
  fill(test, c, opts = {}) {
    const r = opts.region ?? this.region(opts.shade ?? true);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(x + 0.5, y + 0.5)) this.put(x, y, c, r);
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
  mirror(pts) { return [...pts, ...pts.map(([x, y]) => [W - 1 - x, y])]; }
}

// ------------------------------------------------------------ body parts --
const CX = 24;

function torso(p, c, trim, style = 'plate') {
  p.poly([[2, 60], [6, 47], [15, 41], [33, 41], [42, 47], [46, 60]], c);
  if (style === 'plate') {
    p.ellipse(9, 47, 7, 5.5, light(c, 0.12));
    p.ellipse(39, 47, 7, 5.5, light(c, 0.12));
    if (trim) { p.rect(3, 50, 12, 1, trim, { shade: false }); p.rect(33, 50, 12, 1, trim, { shade: false }); }
  }
  if (style === 'robe' && trim) {
    p.poly([[18, 41], [30, 41], [24, 54]], dark(c, 0.35));
    p.line(18, 41, 24, 54, trim, 1.2, { shade: false });
    p.line(30, 41, 24, 54, trim, 1.2, { shade: false });
  }
  if (style === 'coat' && trim) {
    p.line(24, 43, 24, 60, trim, 1, { shade: false });
    p.px([[22, 47], [22, 51], [22, 55], [26, 47], [26, 51], [26, 55]], trim);
  }
}

function neck(p, skin) { p.rect(20, 32, 8, 10, dark(skin, 0.18)); }

function head(p, skin, { cx = CX, cy = 25, rx = 8, ry = 10, jaw = true } = {}) {
  const r = p.ellipse(cx, cy, rx, ry, skin);
  if (jaw) p.poly([[cx - rx + 1, cy + 2], [cx + rx - 1, cy + 2], [cx + 4, cy + ry], [cx - 4, cy + ry]], skin, { region: r });
  return r;
}

function eyes(p, { y = 25, gap = 4, c = '#1c1018', glow = null, size = 1, brow = null } = {}) {
  const l = CX - gap, r = CX + gap - 1;
  if (glow) {
    // A hot centre with a dim halo either side.
    p.px([[l - 1, y], [r + 1, y]], mix(glow, '#000000', 0.55));
    p.px([[l, y], [r, y]], glow);
    p.px([[l, y - 1], [r, y - 1]], mix(glow, '#000000', 0.3));
  } else {
    p.px([[l, y], [r, y]], c);
    if (size > 1) {
      p.px([[l - 1, y], [r + 1, y], [l - 1, y - 1], [r + 1, y - 1]], c);
      p.px([[l, y - 1], [r, y - 1]], '#f4efe6');
    }
  }
  if (brow) p.px([[l - 1, y - 2], [l, y - 2], [l + 1, y - 2], [r - 1, y - 2], [r, y - 2], [r + 1, y - 2]], brow);
}

function mouth(p, y, c, w = 3) { const pts = []; for (let i = 0; i < w; i++) pts.push([CX - Math.floor(w / 2) + i, y]); p.px(pts, c); }
function nose(p, skin, y = 28) { p.px([[CX, y], [CX, y + 1]], dark(skin, 0.22)); p.px([[CX - 1, y + 1]], dark(skin, 0.12)); }

function beard(p, c, style = 'full') {
  if (style === 'full') {
    p.poly([[15, 27], [33, 27], [34, 34], [30, 44], [24, 48], [18, 44], [14, 34]], c);
    p.rect(21, 31, 6, 1, dark(c, 0.4), { shade: false });
  }
  if (style === 'braided') {
    p.poly([[15, 27], [33, 27], [34, 34], [30, 42], [18, 42], [14, 34]], c);
    const b = p.region(true);
    for (const x of [19, 28]) {
      for (let y = 40; y < 55; y++) p.put(x + ((y >> 1) % 2), y, y % 3 === 0 ? dark(c, 0.3) : c, b);
      p.put(x, 55, '#c9a24a', b); p.put(x + 1, 55, '#c9a24a', b);
    }
    p.rect(21, 31, 6, 1, dark(c, 0.4), { shade: false });
  }
  if (style === 'short') {
    p.poly([[16, 29], [32, 29], [31, 35], [27, 38], [21, 38], [17, 35]], c);
    p.rect(21, 32, 6, 1, dark(c, 0.45), { shade: false });
  }
  if (style === 'mustache') {
    p.poly([[19, 30], [29, 30], [31, 33], [27, 31], [21, 31], [17, 33]], c);
  }
}

function hairBack(p, c, style) {
  if (style === 'long') p.poly([[13, 20], [35, 20], [37, 44], [31, 50], [17, 50], [11, 44]], dark(c, 0.15));
  if (style === 'flowing') p.poly([[12, 18], [36, 18], [40, 50], [34, 58], [14, 58], [8, 50]], dark(c, 0.1));
  if (style === 'wisps') { p.line(14, 24, 11, 46, dark(c, 0.1), 2); p.line(34, 24, 37, 46, dark(c, 0.1), 2); }
}

function hairFront(p, c, style) {
  if (style === 'long' || style === 'flowing') {
    p.poly([[15, 22], [16, 15], [24, 12], [32, 15], [33, 22], [30, 17], [24, 16], [18, 17]], c);
    p.poly([[15, 18], [18, 17], [16, 34], [14, 30]], c);
    p.poly([[33, 18], [30, 17], [32, 34], [34, 30]], c);
  }
  if (style === 'braid') {
    p.poly([[15, 21], [16, 15], [24, 12], [32, 15], [33, 21], [29, 17], [20, 17]], c);
    const r = p.region(true);
    for (let y = 22; y < 50; y++) p.put(34 + ((y >> 1) % 2), y, y % 3 === 0 ? dark(c, 0.3) : c, r);
  }
  if (style === 'wisps') p.poly([[17, 16], [24, 13], [31, 16], [28, 18], [20, 18]], c);
}

function ears(p, skin, style) {
  if (style === 'elf') {
    p.poly([[16, 24], [9, 17], [16, 28]], skin);
    p.poly([[32, 24], [39, 17], [32, 28]], skin);
  }
  if (style === 'goblin') {
    p.poly([[16, 23], [4, 18], [7, 22], [16, 28]], skin);
    p.poly([[32, 23], [44, 18], [41, 22], [32, 28]], skin);
    p.px([[8, 21], [9, 21], [39, 21], [40, 21]], dark(skin, 0.4));
  }
  if (style === 'round') { p.ellipse(15.5, 26, 1.8, 2.5, skin); p.ellipse(32.5, 26, 1.8, 2.5, skin); }
}

function hood(p, c, { deep = true, point = false } = {}) {
  const top = point ? [[24, 3]] : [[20, 9], [28, 9]];
  p.poly([[8, 50], [11, 26], [14, 16], ...top, [34, 16], [37, 26], [40, 50], [33, 44], [15, 44]], c);
  if (deep) p.ellipse(CX, 27, 7.5, 9.5, dark(c, 0.65), { shade: false });
}

function background(p, [c1, c2], seed) {
  // Radial light behind the head, quantised to 4 tones with 4x4 Bayer dithering.
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const tones = [dark(c2, 0.45), c2, mix(c2, c1, 0.35), mix(c2, c1, 0.6)];
  const bg = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - 24) / 26, (y - 22) / 30);
    const v = Math.max(0, 1 - d) * 3.2 + (((seed * 13 + x * 7 + y * 3) % 5) - 2) * 0.02;
    const t = Math.min(3, v + (bayer[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 0.9);
    bg.push(tones[Math.max(0, Math.min(3, Math.floor(t)))]);
  }
  return bg;
}

// ------------------------------------------------------------- finishing --
function finish(p, palette, seed) {
  const out = background(p, palette, seed);
  const { col, reg, shade } = p;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : reg[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, r = reg[i];
    if (r < 0) continue;
    let c = col[i];
    if (shade[r]) {
      const edgeLit = at(x, y - 1) !== r || at(x - 1, y) !== r;
      const edgeShadow = at(x, y + 1) !== r || at(x + 1, y) !== r;
      if (edgeLit && !edgeShadow) c = light(c, 0.2);
      else if (edgeShadow && !edgeLit) c = dark(c, 0.22);
      // Broad light from the upper left.
      if (x > 30 + (y > 40 ? -4 : 0)) c = dark(c, 0.1);
    }
    if (y > 52) c = dark(c, (y - 52) * 0.035);
    out[i] = c;
  }
  // Silhouette outline, tinted from the figure beside it.
  const final = [...out];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (reg[y * W + x] >= 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (reg[ny * W + nx] >= 0) { final[y * W + x] = mix(out[ny * W + nx], '#0c0610', 0.78); break; }
    }
  }
  return final;
}

// ------------------------------------------------------------ characters --
const C = {
  brannoc(p) {
    const skin = '#d88e66';
    torso(p, '#4d4f5c', '#d08a3a', 'plate');
    p.ellipse(24, 45, 3, 2.5, '#ff8a2a', { shade: false }); // ember brooch
    p.px([[24, 45]], '#fff0a0');
    neck(p, skin);
    head(p, skin, { rx: 9, ry: 9.5, cy: 26 });
    beard(p, '#c4501c', 'braided');
    mouth(p, 32, '#5a1c10', 2);
    // dwarven helm with nose guard and ember rune
    p.poly([[14, 22], [15, 14], [20, 10], [28, 10], [33, 14], [34, 22]], '#70747f');
    p.rect(13, 21, 22, 3, '#b8773a');
    p.rect(23, 21, 2, 8, '#8a8e98');
    p.px([[23, 14], [24, 13], [25, 14], [24, 15], [24, 16]], '#ffb347');
    p.poly([[13, 19], [7, 11], [9, 20]], '#e8dcc0'); p.poly([[35, 19], [41, 11], [39, 20]], '#e8dcc0'); // horns
    eyes(p, { y: 25, gap: 5, brow: '#8a3212' });
    nose(p, skin, 27);
  },
  rurik(p) {
    const skin = '#dfa27a';
    torso(p, '#253b60', '#e2b74e', 'coat');
    p.ellipse(9, 45, 6, 3, '#e2b74e'); p.ellipse(39, 45, 6, 3, '#e2b74e'); // epaulettes
    neck(p, skin);
    head(p, skin, { cy: 26 });
    beard(p, '#9aa1a8', 'short');
    mouth(p, 33, '#6a2f22', 3);
    eyes(p, { y: 25, gap: 4, brow: '#6d6f73' });
    p.rect(26, 24, 4, 3, '#16121a', { shade: false }); // eyepatch
    p.line(16, 21, 33, 27, '#16121a', 1);
    nose(p, skin, 27);
    // tricorn
    p.poly([[8, 19], [14, 12], [24, 7], [34, 12], [40, 19], [32, 17], [24, 19], [16, 17]], '#1d2c48');
    p.line(9, 19, 24, 16, '#e2b74e', 1, { shade: false }); p.line(24, 16, 39, 19, '#e2b74e', 1, { shade: false });
    p.ellipse(33, 12, 2, 2, '#f2efe6');
  },
  gorsebark(p) {
    const bark = '#7a5634';
    // antler-branches and leaves
    p.line(17, 16, 9, 4, '#5e4128', 2.4); p.line(12, 9, 6, 8, '#5e4128', 1.6);
    p.line(31, 16, 39, 4, '#5e4128', 2.4); p.line(36, 9, 42, 8, '#5e4128', 1.6);
    for (const [x, y] of [[8, 3], [5, 7], [11, 6], [40, 3], [43, 7], [37, 6], [24, 8], [19, 10], [29, 10]]) p.ellipse(x, y, 2.6, 2, '#79b84a');
    torso(p, '#5b4027', null, 'plain');
    p.ellipse(10, 46, 7, 4, '#6f9e3c'); p.ellipse(38, 46, 7, 4, '#6f9e3c'); // moss
    p.ellipse(24, 26, 10, 13, bark);
    // bark grooves
    const g = dark(bark, 0.4);
    p.px([[18, 16], [18, 17], [19, 18], [30, 15], [30, 16], [29, 17], [21, 34], [22, 35], [27, 35], [28, 36], [16, 30], [32, 31]], g);
    eyes(p, { y: 24, gap: 4, glow: '#b8ff5a' });
    p.px([[20, 30], [21, 31], [22, 31], [23, 31], [24, 31], [25, 31], [26, 31], [27, 30]], '#2a1a0e'); // mouth crack
    p.ellipse(24, 14, 6, 2, '#79b84a');
  },
  vessa(p) {
    const skin = '#aab4c6';
    hairBack(p, '#1c1a26', 'long');
    torso(p, '#2b2737', '#9a6ae0', 'plate');
    p.poly([[4, 46], [2, 40], [8, 44]], '#cfc8dc'); p.poly([[44, 46], [46, 40], [40, 44]], '#cfc8dc'); // spikes
    p.rect(17, 38, 14, 5, '#3a3448'); // gorget
    neck(p, skin);
    head(p, skin, { cy: 25, ry: 9.5 });
    hairFront(p, '#221f2e', 'long');
    p.px([[19, 26], [20, 26], [21, 26], [27, 26], [28, 26], [29, 26]], dark(skin, 0.35)); // sunken
    eyes(p, { y: 25, gap: 4, glow: '#c28bff' });
    nose(p, skin, 28);
    mouth(p, 32, '#4a3a5a', 3);
    p.px([[22, 20], [23, 19], [25, 19], [26, 20]], '#9a6ae0'); // circlet gem
    p.rect(16, 20, 16, 1, '#6b5a8a', { shade: false });
  },
  nyxa(p) {
    const skin = '#8e9aaa';
    torso(p, '#232834', '#6c7a90', 'plain');
    p.line(8, 60, 36, 40, '#4a3a2a', 2); // strap
    p.line(38, 42, 44, 34, '#aeb6c2', 1.4); p.rect(36, 42, 3, 3, '#6a4a2a'); // dagger hilt
    hood(p, '#262c3a', { deep: true });
    head(p, skin, { cy: 27, rx: 6.5, ry: 8 });
    p.poly([[17, 29], [31, 29], [30, 35], [24, 38], [18, 35]], '#343b4c'); // face wrap
    p.line(16, 20, 21, 34, '#e8eef4', 1); // white hair strand
    eyes(p, { y: 26, gap: 3, glow: '#d8f4ff' });
    p.rect(17, 23, 14, 1, dark(skin, 0.5), { shade: false });
  },
  torvik(p) {
    const skin = '#e0a27a';
    torso(p, skin, null, 'plain');
    p.ellipse(9, 45, 9, 6, '#8a6a44'); p.ellipse(39, 45, 9, 6, '#8a6a44'); // fur mantle
    p.px([[6, 44], [9, 46], [12, 44], [36, 44], [39, 46], [42, 44]], '#b8946a');
    p.line(14, 52, 18, 47, '#3a78c8', 1); p.line(34, 52, 30, 47, '#3a78c8', 1); // woad
    neck(p, skin);
    head(p, skin, { cy: 25, rx: 9, ry: 10 });
    beard(p, '#e8b44a', 'braided');
    mouth(p, 32, '#6a2412', 3);
    eyes(p, { y: 24, gap: 4, brow: '#b8761e' });
    nose(p, skin, 26);
    p.line(18, 17, 21, 20, '#3a78c8', 1); p.line(30, 17, 27, 20, '#3a78c8', 1); p.px([[24, 16], [24, 17], [23, 18], [25, 18]], '#3a78c8'); // woad
    p.px([[18, 13], [30, 13]], '#fff0a0'); // shine on bald head
  },
  lyra(p) {
    const skin = '#f0c9a2';
    torso(p, '#3f6a2e', '#c8a060', 'plain');
    p.poly([[4, 60], [5, 47], [14, 42], [34, 42], [43, 47], [44, 60], [38, 50], [10, 50]], '#2f5424'); // hood down
    p.line(10, 60, 34, 42, '#6a4424', 1.6); // quiver strap
    for (const x of [36, 38, 40]) p.line(x, 44, x + 2, 36, '#dcd2b0', 1); // arrows
    neck(p, skin);
    head(p, skin, { cy: 25 });
    ears(p, skin, 'elf');
    hairFront(p, '#b24a28', 'braid');
    eyes(p, { y: 25, gap: 4, c: '#1f5a2a', brow: '#8a3418' });
    nose(p, skin, 28);
    mouth(p, 32, '#a4524a', 3);
    for (const [x, y] of [[16, 16], [20, 14], [24, 13], [28, 14], [32, 16]]) p.ellipse(x, y, 1.6, 1.1, '#6fb84a'); // leaf circlet
  },
  grisk(p) {
    const skin = '#86b04c';
    torso(p, '#5e4a30', null, 'plain');
    // wolf pelt hood with ears
    p.poly([[6, 52], [9, 30], [13, 16], [24, 11], [35, 16], [39, 30], [42, 52], [33, 44], [15, 44]], '#77716a');
    p.poly([[12, 17], [13, 5], [19, 13]], '#77716a'); p.poly([[36, 17], [35, 5], [29, 13]], '#77716a');
    p.px([[14, 9], [14, 10], [34, 9], [34, 10]], '#c8a0a0');
    p.px([[13, 30], [35, 30], [12, 36], [36, 36]], '#e8e4dc'); // fangs of the pelt
    head(p, skin, { cy: 28, rx: 7.5, ry: 8.5 });
    ears(p, skin, 'goblin');
    eyes(p, { y: 27, gap: 4, glow: '#ffd23a' });
    nose(p, skin, 29);
    p.rect(20, 33, 8, 1, '#3a2010', { shade: false });
    p.px([[21, 32], [27, 32]], '#f4efe0'); // underbite tusks
  },
  aurelle(p) {
    const skin = '#e8b48c';
    torso(p, '#ece2cf', '#d9a53e', 'robe');
    p.ellipse(24, 49, 3, 3, '#f2c24a'); p.px([[24, 45], [24, 53], [20, 49], [28, 49]], '#f2c24a'); // sun pendant
    // veil
    p.poly([[10, 50], [12, 26], [16, 14], [24, 10], [32, 14], [36, 26], [38, 50], [31, 44], [17, 44]], '#f4ecdc');
    p.ellipse(24, 26, 8, 10, dark('#f4ecdc', 0.4), { shade: false });
    head(p, skin, { cy: 27, rx: 7, ry: 8.5 });
    p.rect(15, 17, 18, 2, '#d9a53e'); // gold band
    p.px([[24, 16], [23, 17], [25, 17]], '#fff2a0');
    eyes(p, { y: 27, gap: 3, c: '#4a2e1a', brow: '#8a5a38' });
    nose(p, skin, 29);
    mouth(p, 32, '#b25a4a', 2);
  },
  oona(p) {
    const skin = '#6aa88a';
    // shell rising behind the shoulders
    p.ellipse(24, 52, 22, 14, '#7a6440');
    for (const [x, y] of [[12, 46], [24, 43], [36, 46], [18, 52], [30, 52]]) p.ellipse(x, y, 4, 3, '#94804f');
    torso(p, '#3f7a74', '#e8dcb8', 'robe');
    for (const x of [16, 20, 24, 28, 32]) p.ellipse(x, 44 + Math.abs(x - 24) / 4, 1.3, 1.3, '#f4ecd8'); // shell beads
    neck(p, skin);
    head(p, skin, { cy: 26, rx: 9, ry: 9, jaw: false });
    p.poly([[18, 30], [30, 30], [27, 35], [21, 35]], light(skin, 0.1)); // beak
    p.rect(20, 32, 8, 1, dark(skin, 0.5), { shade: false });
    eyes(p, { y: 25, gap: 4, c: '#10140f', size: 2 });
    p.rect(15, 19, 18, 2, '#c24a3a'); // headband
    p.line(33, 19, 38, 11, '#f0e0c0', 1.4); p.line(34, 20, 40, 15, '#5aa0d0', 1.2); // feathers
    p.px([[20, 22], [22, 21], [26, 21], [28, 22]], dark(skin, 0.3));
  },
  mordekai(p) {
    const skin = '#a2b28c';
    hairBack(p, '#dcdcd0', 'wisps');
    torso(p, '#1e2a1e', '#7ad04a', 'robe');
    p.poly([[10, 46], [13, 30], [17, 38]], '#263626'); p.poly([[38, 46], [35, 30], [31, 38]], '#263626'); // high collar
    p.line(13, 30, 17, 38, '#7ad04a', 1, { shade: false }); p.line(35, 30, 31, 38, '#7ad04a', 1, { shade: false });
    neck(p, skin);
    head(p, skin, { cy: 25, rx: 7, ry: 10 });
    hairFront(p, '#dcdcd0', 'wisps');
    p.px([[19, 27], [20, 28], [28, 27], [27, 28], [19, 31], [29, 31]], dark(skin, 0.35)); // gaunt
    eyes(p, { y: 25, gap: 4, glow: '#a8ff6a' });
    nose(p, skin, 28);
    mouth(p, 33, '#3a2a2a', 4);
    // skull circlet
    p.rect(16, 17, 16, 1, '#6b705a', { shade: false });
    p.ellipse(24, 16, 2.5, 2, '#e8e4d0'); p.px([[23, 16], [25, 16]], '#1a1a14');
  },
  ilsa(p) {
    const skin = '#d4e8fa';
    hairBack(p, '#eaf6ff', 'flowing');
    torso(p, '#2a3a5c', '#bfe8ff', 'robe');
    p.poly([[6, 60], [8, 48], [14, 44], [16, 60]], '#3a4e78'); p.poly([[42, 60], [40, 48], [34, 44], [32, 60]], '#3a4e78');
    neck(p, skin);
    head(p, skin, { cy: 26, rx: 7.5, ry: 9.5 });
    hairFront(p, '#f2faff', 'flowing');
    eyes(p, { y: 26, gap: 4, glow: '#ffffff' });
    p.px([[20, 27], [28, 27]], '#8ab8e8');
    nose(p, skin, 29);
    mouth(p, 33, '#6a8ab8', 2);
    // ice crown
    for (const [x, h] of [[16, 5], [19, 8], [22, 10], [24, 13], [26, 10], [29, 8], [32, 5]]) p.poly([[x - 1.5, 17], [x, 17 - h], [x + 1.5, 17]], '#e8fbff');
    p.rect(15, 16, 18, 2, '#9fd8ff');
  },
  wolf(p) {
    const fur = '#8a8580';
    torso(p, '#6e6a66', null, 'plain');
    p.poly([[11, 20], [14, 5], [20, 15]], fur); p.poly([[37, 20], [34, 5], [28, 15]], fur); // ears
    p.px([[14, 9], [15, 11], [34, 9], [33, 11]], '#c89898');
    p.ellipse(24, 26, 12, 11, fur);
    p.poly([[17, 28], [31, 28], [29, 40], [19, 40]], '#bdb6ac'); // muzzle
    p.ellipse(24, 30, 2.5, 1.8, '#1a1414'); // nose
    p.rect(20, 37, 8, 1, '#2a1818', { shade: false });
    p.px([[20, 38], [27, 38]], '#f4f0e6');
    eyes(p, { y: 23, gap: 5, glow: '#ffcc33' });
    for (const [x, y] of [[13, 30], [35, 30], [12, 26], [36, 26]]) p.px([[x, y]], light(fur, 0.3));
  },
  skeleton(p) {
    const bone = '#e6e0cc';
    // ribcage
    p.poly([[8, 60], [12, 46], [20, 42], [28, 42], [36, 46], [40, 60]], '#2a2632');
    for (let y = 46; y < 60; y += 3) { p.line(14, y, 22, y - 1, bone, 1.4); p.line(34, y, 26, y - 1, bone, 1.4); }
    p.rect(23, 42, 2, 18, bone);
    p.rect(22, 34, 4, 8, dark(bone, 0.2));
    p.ellipse(24, 23, 10, 11, bone);
    p.rect(18, 30, 12, 6, bone);
    p.ellipse(20, 23, 3, 3.2, '#16121c', { shade: false }); p.ellipse(28, 23, 3, 3.2, '#16121c', { shade: false });
    p.px([[20, 23], [28, 23]], '#9dff6a');
    p.poly([[23, 27], [25, 27], [24, 30]], '#16121c', { shade: false });
    for (let x = 19; x <= 29; x += 2) p.rect(x, 32, 1, 3, '#3a3444', { shade: false });
    p.px([[17, 14], [18, 16], [30, 15]], dark(bone, 0.4)); // cracks
  },
};

const PALETTES = {
  brannoc: ['#ff9a4a', '#4a2014'], rurik: ['#6fb7d8', '#1d2f4a'], gorsebark: ['#9ccf62', '#2c3a1a'],
  vessa: ['#b48cff', '#1c1330'], nyxa: ['#9fb4c8', '#141820'], torvik: ['#ffd05a', '#4a2a10'],
  lyra: ['#c6e38a', '#23361f'], grisk: ['#e3b25a', '#3d2a14'], aurelle: ['#ffe9a8', '#7a4a1e'],
  oona: ['#6fd6c4', '#15343a'], mordekai: ['#9be07a', '#1a2418'], ilsa: ['#bfe8ff', '#1a2a44'],
  wolf: ['#b9a58a', '#2a2018'], skeleton: ['#e8e2cc', '#2a2632'],
};

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
function png(pixels, w, h) {
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
const upscale = (px, s) => {
  const out = new Array(W * s * H * s);
  for (let y = 0; y < H * s; y++) for (let x = 0; x < W * s; x++) out[y * W * s + x] = px[Math.floor(y / s) * W + Math.floor(x / s)];
  return out;
};

// ------------------------------------------------------------------ main --
const outDir = new URL('../src/assets/portraits/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const rendered = {};
Object.entries(C).forEach(([id, draw], i) => {
  const p = new Pix();
  draw(p);
  rendered[id] = finish(p, PALETTES[id], i + 1);
  writeFileSync(new URL(`${id}.png`, outDir), png(upscale(rendered[id], SCALE), W * SCALE, H * SCALE));
});
console.log(`wrote ${Object.keys(C).length} portraits`);

if (process.argv.includes('--sheet')) {
  const ids = Object.keys(rendered), cols = 7, s = 4, gap = 2;
  const rows = Math.ceil(ids.length / cols);
  const SW = cols * (W + gap), SH = rows * (H + gap);
  const sheet = new Array(SW * SH).fill('#101010');
  ids.forEach((id, k) => {
    const ox = (k % cols) * (W + gap), oy = Math.floor(k / cols) * (H + gap);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) sheet[(oy + y) * SW + ox + x] = rendered[id][y * W + x];
  });
  const big = new Array(SW * s * SH * s);
  for (let y = 0; y < SH * s; y++) for (let x = 0; x < SW * s; x++) big[y * SW * s + x] = sheet[Math.floor(y / s) * SW + Math.floor(x / s)];
  writeFileSync(process.argv[process.argv.indexOf('--sheet') + 1] ?? 'portraits-sheet.png', png(big, SW * s, SH * s));
}
