# Character art

Drop portrait files here, then point each hero at one in `heroes.jsx`:

```js
portrait: 'art/atlas.webp',
```

The path is relative to the published page, so `art/atlas.webp` here becomes
`art/atlas.webp` in the artifact. Files in this folder are published alongside
the page.

## What to export

| Slot | Frame | Export | Notes |
|---|---|---|---|
| Portrait | strict 1:1, `object-cover` | 512×512 | Face in the upper two-thirds; the lower third carries the name plate and the role wash. |

`.webp` keeps the page inside the artifact's 16MB budget - six portraits at
512×512 webp land around 250KB total. `.png` and `.jpg` work too.

## Why two image layers

Each plate stacks two `<img class="object-cover">`: a generated bust from
`portraits.jsx` underneath, and `hero.portrait` over it. The published page's
CSP blocks *remote* images silently, so a remote URL alone renders an empty
frame. Files published from this folder are same-origin and load normally - so
once real art is here, it is the only thing you will see.
