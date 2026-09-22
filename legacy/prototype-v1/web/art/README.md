# Art drop-in

The UI renders a monogram placeholder for anything with no image, so the board
stays readable while art is in progress. To wire a real image up:

1. Export it into this folder, named for the id it belongs to.
2. Add the entry to the manifest at the top of the `<script>` in
   `web/index.html` — `PORTRAITS` for gods, `ABILITY_ICONS` for abilities.

```js
const PORTRAITS = {
  zeus: 'art/zeus.webp',
  gaia: 'art/gaia.webp',
};

const ABILITY_ICONS = {
  thunderbolt: 'art/ability/thunderbolt.webp',
};
```

The manifest is explicit rather than convention-based on purpose: a missing
file then costs a placeholder, not a failed request on every card.

## Sizes

| Slot | Frame | Export | Notes |
|---|---|---|---|
| God portrait | 1:1, `object-fit: cover` | 512×512 | Centre the face in the upper two-thirds; the lower strip carries the name plate. |
| Ability icon | 1:1, `object-fit: cover` | 96×96 | Sits beside the speed badge at ~28px, so it must read at thumbnail size. |
| Draft thumbnail | 1:1 | reuses the portrait | Rendered at ~34px. |

`.webp` keeps the page inside the 16MB artifact budget; 36 portraits at
512×512 webp land around 1.5MB total. `.png` and `.jpg` work too.

## God ids

Run `node -e "import('./src/data/roster.ts').then(m => console.log(m.ROSTER.map(d => d.id + '  ' + d.name).join('\n')))"`
from the repo root for the current list, or read `src/data/*.ts`.
