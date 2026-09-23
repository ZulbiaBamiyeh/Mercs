// Turns a game-icons glyph into a small piece of pixel art, so ability icons
// match the pixel portraits: the glyph is rasterised onto a 22px grid, then
// shaded in three tones (light from the upper left) and outlined.

import { GAME_ICONS } from './icons/gameIcons';

const GRID = 22;
const cache = new Map<string, string>();

const TONES = { hi: [255, 250, 232], mid: [236, 222, 196], lo: [178, 160, 132], line: [34, 18, 8] } as const;

export function pixelIcon(name: string): string | undefined {
  if (cache.has(name)) return cache.get(name);
  const d = (GAME_ICONS as Record<string, string>)[name];
  if (!d || typeof document === 'undefined') return undefined;

  const src = document.createElement('canvas');
  src.width = src.height = GRID;
  const g = src.getContext('2d');
  if (!g) return undefined;
  // Inset by 2px so the outline has room.
  g.translate(2, 2);
  g.scale((GRID - 4) / 512, (GRID - 4) / 512);
  g.fill(new Path2D(d));
  const alpha = g.getImageData(0, 0, GRID, GRID).data;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && alpha[(y * GRID + x) * 4 + 3]! > 110;

  const out = document.createElement('canvas');
  out.width = out.height = GRID;
  const o = out.getContext('2d')!;
  const img = o.createImageData(GRID, GRID);
  const put = (x: number, y: number, c: readonly number[]) => {
    const i = (y * GRID + x) * 4;
    img.data[i] = c[0]!; img.data[i + 1] = c[1]!; img.data[i + 2] = c[2]!; img.data[i + 3] = 255;
  };
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (on(x, y)) {
        const lit = !on(x - 1, y) || !on(x, y - 1);
        const shade = !on(x + 1, y) || !on(x, y + 1);
        put(x, y, lit && !shade ? TONES.hi : shade && !lit ? TONES.lo : TONES.mid);
      } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
        put(x, y, TONES.line);
      }
    }
  }
  o.putImageData(img, 0, 0);
  const url = out.toDataURL('image/png');
  cache.set(name, url);
  return url;
}
