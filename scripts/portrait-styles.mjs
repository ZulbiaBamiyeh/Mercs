// Style studies: the same character (Brannoc Emberhelm) drawn three ways, to
// pick a direction for the roster's portraits. Writes to docs/portrait-styles/.
//
//   node scripts/portrait-styles.mjs
//
// A  chibi pixel     40x50, big head and eyes, blush, a grin
// B  hi-bit pixel    64x80, forge rim-light, hammer on the shoulder, embers
// C  storybook       hand-written SVG (docs/portrait-styles/brannoc-storybook.svg)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dark, light, mix, Pix, png, upscale } from './pixel-lib.mjs';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Shade each part, outline the silhouette, optional coloured rim light from one side. */
function finish(p, { bg, outline = '#1c0c08', rim = null, rimSide = 1, ao = 0.035, fromY = 0 }) {
  const { w: W, h: H, col, reg, shade } = p;
  const out = bg.slice();
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : reg[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, r = reg[i];
    if (r < 0) continue;
    let c = col[i];
    if (shade[r]) {
      const lit = at(x, y - 1) !== r || at(x - rimSide, y) !== r;
      const shadow = at(x, y + 1) !== r || at(x + rimSide, y) !== r;
      if (lit && !shadow) c = light(c, 0.22);
      else if (shadow && !lit) c = dark(c, 0.25);
      if (rim && at(x + rimSide, y) < 0 && y > fromY) c = mix(c, rim, 0.65);
      else if (rim && at(x + rimSide * 2, y) < 0 && y > fromY) c = mix(c, rim, 0.3);
    }
    if (y > H * 0.86) c = dark(c, (y - H * 0.86) * ao);
    out[i] = c;
  }
  const final = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (reg[y * W + x] >= 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && reg[ny * W + nx] >= 0) { final[y * W + x] = outline; break; }
    }
  }
  return final;
}

function ditherBg(W, H, tones, { cx, cy, rx, ry, sparks = [] }) {
  const bg = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    const v = Math.max(0, 1 - d) * (tones.length - 0.6);
    const t = v + (BAYER[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 0.95;
    bg.push(tones[Math.max(0, Math.min(tones.length - 1, Math.floor(t)))]);
  }
  for (const [x, y, c] of sparks) if (x >= 0 && y >= 0 && x < W && y < H) bg[y * W + x] = c;
  return bg;
}

// ------------------------------------------------------------ A: chibi --
function chibi() {
  const W = 40, H = 50;
  const p = new Pix(W, H);
  const skin = '#f2aa7c', beard = '#e8612a', steel = '#7c8494', bronze = '#d99a3e';
  // hammer behind the shoulder
  p.line(31, 49, 36, 27, '#7a4a26', 2.2);
  p.rect(31, 22, 9, 6, '#8c93a2');
  p.rect(30, 23, 1, 4, '#5d6370');
  // little body
  p.poly([[6, 50], [9, 41], [14, 38], [26, 38], [31, 41], [34, 50]], steel);
  p.ellipse(9, 42, 4, 3, light(steel, 0.15));
  p.ellipse(31, 42, 4, 3, light(steel, 0.15));
  p.rect(16, 44, 8, 2, bronze);
  p.ellipse(20, 45, 1.6, 1.6, '#ff9a3a', { shade: false });
  // big head
  p.ellipse(20, 23, 12.5, 11.5, skin);
  // beard: a fluffy cloud with two braids
  p.ellipse(20, 32, 11, 8, beard);
  p.ellipse(12, 29, 4, 5, beard);
  p.ellipse(28, 29, 4, 5, beard);
  const b = p.region(true);
  for (let y = 36; y < 46; y++) { p.put(14 + (y % 2), y, beard, b); p.put(25 + (y % 2), y, beard, b); }
  p.rect(14, 46, 2, 1, bronze, { shade: false }); p.rect(25, 46, 2, 1, bronze, { shade: false });
  // grin
  p.px([[17, 30], [18, 31], [19, 31], [20, 31], [21, 31], [22, 30]], '#5a1a10');
  p.px([[18, 30], [19, 30], [20, 30], [21, 30]], '#fff4ea');
  // curly mustache
  p.poly([[13, 28], [20, 26.5], [27, 28], [25, 29.5], [20, 28.5], [15, 29.5]], light(beard, 0.1));
  // round nose
  p.ellipse(20, 26, 2.2, 1.8, dark(skin, 0.08));
  p.px([[19, 25]], '#ffd8c0');
  // eyes: big, dark, two highlights each
  for (const x of [14, 23]) {
    p.rect(x, 19, 3, 4, '#2a1410', { shade: false });
    p.px([[x, 19], [x + 2, 21]], '#ffffff');
  }
  p.px([[13, 17], [14, 17], [15, 17], [16, 16], [23, 16], [24, 17], [25, 17], [26, 17]], '#b8441a'); // brows
  p.px([[12, 24], [13, 24], [26, 24], [27, 24]], '#ff8f88'); // blush
  // helmet
  p.poly([[7, 16], [8, 10], [13, 6], [20, 4.5], [27, 6], [32, 10], [33, 16]], steel);
  p.rect(7, 14, 26, 3, bronze);
  p.px([[20, 8], [19, 9], [21, 9], [20, 10], [20, 11]], '#ffcf5a');
  p.poly([[8, 12], [3, 6], [2, 2], [5, 5], [10, 11]], '#f2e6c8');
  p.poly([[32, 12], [37, 6], [38, 2], [35, 5], [30, 11]], '#f2e6c8');
  const sparks = [[3, 30, '#ffd36b'], [36, 34, '#ffb347'], [5, 38, '#ff9a3a'], [35, 14, '#ffe8a0'], [2, 20, '#ffb347']];
  const bg = ditherBg(W, H, ['#2a120c', '#4a1c10', '#7a2e14', '#b0481a', '#d8702a'], { cx: 20, cy: 22, rx: 22, ry: 26, sparks });
  return { px: finish(p, { bg, outline: '#241008' }), W, H, s: 10 };
}

// ----------------------------------------------------------- B: hi-bit --
function hibit() {
  const W = 64, H = 80;
  const p = new Pix(W, H);
  const skin = '#d9906a', beard = '#c4501c', steel = '#5a5e6a', bronze = '#c8873a';
  // hammer resting on the right shoulder
  p.line(38, 79, 52, 30, '#6a3e1e', 3.2);
  p.line(38, 79, 52, 30, '#8a5a30', 1.2);
  p.poly([[44, 22], [60, 18], [63, 30], [47, 34]], '#7e8492');
  p.poly([[44, 22], [60, 18], [61, 21], [45, 25]], '#a9afbb');
  p.rect(50, 24, 5, 5, '#ff8a2a', { shade: false }); // glowing rune on the head
  p.px([[52, 26]], '#fff2b0');
  // body in plate
  p.poly([[2, 80], [7, 62], [20, 54], [44, 54], [57, 62], [62, 80]], steel);
  p.ellipse(11, 62, 10, 7, light(steel, 0.12));
  p.ellipse(53, 62, 10, 7, light(steel, 0.12));
  for (const [x, y] of [[6, 60], [10, 58], [14, 60], [50, 60], [54, 58], [58, 60]]) p.px([[x, y]], '#c8ccd4'); // rivets
  p.rect(3, 66, 16, 2, bronze, { shade: false }); p.rect(45, 66, 16, 2, bronze, { shade: false });
  p.ellipse(32, 60, 4, 4, bronze);
  p.ellipse(32, 60, 2.2, 2.2, '#ff8a2a', { shade: false });
  // neck and head
  p.rect(26, 42, 12, 12, dark(skin, 0.2));
  p.ellipse(32, 33, 12, 13, skin);
  // beard with strands and two long braids
  p.poly([[19, 36], [45, 36], [47, 46], [41, 58], [32, 62], [23, 58], [17, 46]], beard);
  const strand = p.region(false);
  for (let x = 21; x < 44; x += 3) for (let y = 40 + (x % 2); y < 58; y += 2) if (Math.hypot(x - 32, y - 48) < 14) p.put(x, y, dark(beard, 0.3), strand);
  const br = p.region(true);
  for (const bx of [24, 39]) {
    for (let y = 56; y < 74; y++) { p.put(bx + ((y >> 1) % 2), y, y % 3 ? beard : dark(beard, 0.3), br); p.put(bx + 1 + ((y >> 1) % 2), y, beard, br); }
    p.rect(bx, 74, 3, 2, bronze, { shade: false });
  }
  p.poly([[20, 38], [32, 35], [44, 38], [41, 41], [32, 39], [23, 41]], light(beard, 0.12)); // mustache
  p.px([[29, 43], [30, 44], [31, 44], [32, 44], [33, 44], [34, 43]], '#4a140a'); // mouth
  // face
  p.ellipse(32, 35, 3, 2.4, dark(skin, 0.1));
  p.px([[31, 34]], '#f8c8a8');
  for (const x of [25, 37]) {
    p.rect(x, 30, 3, 2, '#1c0e0a', { shade: false });
    p.px([[x + 1, 30]], '#ffe0a0');
  }
  p.rect(23, 27, 6, 2, '#8a3212', { shade: false }); p.rect(35, 27, 6, 2, '#8a3212', { shade: false }); // heavy brows
  p.px([[22, 33], [42, 33]], dark(skin, 0.25));
  // helmet with engraving, nose guard and horns
  p.poly([[19, 28], [20, 18], [26, 12], [38, 12], [44, 18], [45, 28]], '#6e7380');
  p.rect(18, 25, 28, 4, bronze);
  for (let x = 20; x < 45; x += 4) p.px([[x, 26]], '#f0c070');
  p.rect(31, 25, 3, 12, '#8a8f9b');
  p.poly([[26, 14], [32, 11], [38, 14], [36, 16], [32, 14], [28, 16]], '#9aa0ac');
  p.poly([[18, 23], [8, 12], [6, 4], [11, 9], [21, 21]], '#efe2c4');
  p.poly([[46, 23], [56, 12], [58, 4], [53, 9], [43, 21]], '#efe2c4');
  // background: forge glow bottom right, embers, a dark anvil silhouette
  const sparks = [];
  for (let i = 0; i < 26; i++) {
    const x = (i * 37 + 11) % W, y = (i * 23 + 7) % 60;
    if (Math.hypot(x - 32, y - 34) > 20) sparks.push([x, y, ['#ffd36b', '#ff9a3a', '#ffecb0'][i % 3]]);
  }
  const bg = ditherBg(W, H, ['#140a0e', '#2a1016', '#4a1a14', '#7a2c14', '#b8481a'], { cx: 50, cy: 70, rx: 44, ry: 52, sparks });
  for (let y = 70; y < 80; y++) for (let x = 0; x < 14; x++) if (y > 72 || x > 2) bg[y * W + x] = '#120a0c';
  return { px: finish(p, { bg, outline: '#12080a', rim: '#ff9a3a', rimSide: 1, fromY: 20 }), W, H, s: 6 };
}

const outDir = new URL('../docs/portrait-styles/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const [name, fn] of [['brannoc-chibi', chibi], ['brannoc-hibit', hibit]]) {
  const { px, W, H, s } = fn();
  writeFileSync(new URL(`${name}.png`, outDir), png(upscale(px, W, H, s), W * s, H * s));
}
console.log('wrote docs/portrait-styles/brannoc-chibi.png and brannoc-hibit.png');
