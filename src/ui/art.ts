// Portrait art hook. An image in src/assets/portraits/ named after a merc id
// (brannoc.svg, cariel.png, tyrande.webp) is used for that merc everywhere;
// mercs without one get a coloured placeholder. Portraits are shown in an
// oval, so keep the face centred with some headroom. SVGs are drawn at
// 400x500; bitmaps work at 512x640 or larger. PNGs are shown as pixel art.

const files = import.meta.glob('../assets/portraits/*.{svg,png,jpg,jpeg,webp,avif}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

const PORTRAITS: Record<string, { url: string; pixel: boolean }> = {};
for (const [path, url] of Object.entries(files)) {
  const file = path.split('/').pop()!;
  const id = file.replace(/\.[^.]+$/, '');
  // SVGs win over bitmaps with the same name. Small bitmaps are treated as pixel art.
  if (PORTRAITS[id] && !file.endsWith('.svg')) continue;
  PORTRAITS[id] = { url, pixel: file.endsWith('.png') };
}

export const portrait = (defId: string) => PORTRAITS[defId];
