// Portrait art hook. Drop an image named after a merc id into
// src/assets/portraits/ (e.g. cariel.png, tyrande.webp) and it replaces the
// placeholder everywhere. Portraits are shown in an oval, so keep the face
// centred with some headroom; 512x640 or larger works well.

const files = import.meta.glob('../assets/portraits/*.{png,jpg,jpeg,webp,avif}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

const PORTRAITS: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const id = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  PORTRAITS[id] = url;
}

export const portraitUrl = (defId: string): string | undefined => PORTRAITS[defId];
