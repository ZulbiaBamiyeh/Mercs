#!/usr/bin/env python3
"""
Generate `web/react/portraits.jsx`: one painted bust per hero as a data-URI
image.

Why this exists: the published page's CSP blocks external images *silently*, so
a remote portrait URL renders an empty frame. Each card therefore stacks two
real <img> tags with object-cover - the remote URL on top, this generated
portrait beneath - so the frame is never empty wherever the page runs.

These are lit, textured busts rather than flat vector shapes: a graded sky, a
rim-lit figure, film grain through feTurbulence and a vignette.
"""

import pathlib
import urllib.parse

OUT = pathlib.Path('web/react/portraits.jsx')

# Bust silhouettes on a 400x400 canvas, framed head-and-shoulders.
FIGURES = {
    'protector': '''
      <ellipse cx="78" cy="330" rx="64" ry="56" fill="url(#body)"/>
      <ellipse cx="322" cy="330" rx="64" ry="56" fill="url(#body)"/>
      <path d="M36 400 C56 302 108 266 200 266 C292 266 344 302 364 400 Z" fill="url(#body)"/>
      <path d="M158 148 Q200 112 242 148 L249 214 Q200 242 151 214 Z" fill="url(#body)"/>
      <path d="M196 116 L204 116 L208 224 L192 224 Z" fill="url(#rim)" opacity="0.5"/>
      <path d="M158 186 L242 186 L242 198 L158 198 Z" fill="#05070a" opacity="0.72"/>
      <path d="M36 400 C56 302 108 266 200 266" fill="none" stroke="url(#rim)" stroke-width="5" opacity="0.62"/>
      <path d="M158 148 Q200 112 242 148" fill="none" stroke="url(#rim)" stroke-width="4" opacity="0.7"/>
    ''',
    'fighter': '''
      <path d="M52 400 C70 310 118 280 200 280 C282 280 330 310 348 400 Z" fill="url(#body)"/>
      <ellipse cx="200" cy="196" rx="45" ry="53" fill="url(#body)"/>
      <path d="M155 192 C150 132 196 116 224 124 C258 134 252 176 248 196 C240 170 214 156 186 164 C168 170 160 180 155 192 Z" fill="#06080c" opacity="0.8"/>
      <path d="M143 288 L200 264 L257 288 L236 340 L164 340 Z" fill="url(#rim)" opacity="0.26"/>
      <path d="M52 400 C70 310 118 280 200 280" fill="none" stroke="url(#rim)" stroke-width="5" opacity="0.58"/>
      <path d="M176 152 C186 140 214 140 226 154" fill="none" stroke="url(#rim)" stroke-width="3" opacity="0.5"/>
    ''',
    'caster': '''
      <path d="M58 400 C68 322 120 292 200 292 C280 292 332 322 342 400 Z" fill="url(#body)"/>
      <path d="M200 112 C270 112 302 186 297 244 L292 306 C250 288 150 288 108 306 L103 244 C98 186 130 112 200 112 Z" fill="url(#body)"/>
      <path d="M200 150 C244 150 264 198 261 240 C240 224 160 224 139 240 C136 198 156 150 200 150 Z" fill="#04060a" opacity="0.86"/>
      <ellipse cx="200" cy="228" rx="30" ry="22" fill="#04060a" opacity="0.6"/>
      <path d="M200 112 C130 112 98 186 103 244" fill="none" stroke="url(#rim)" stroke-width="5" opacity="0.66"/>
      <circle cx="200" cy="322" r="11" fill="url(#rim)" opacity="0.7"/>
    ''',
}

# skyTop, skyBottom, keyLight, bodyLight, bodyMid, bodyDark, rimLight
PALETTES = {
    'atlas':  ('#3b2e22', '#140f0b', '#d9a86a', '#8a7358', '#463829', '#140f0a', '#f0cf9a'),
    'ares':   ('#43221d', '#170a09', '#e0765a', '#8e4a38', '#4a2118', '#170807', '#f7b493'),
    'zeus':   ('#2b3550', '#0d1120', '#8fb4e8', '#5a7099', '#2b3752', '#0b0f1c', '#cfe0fa'),
    'geb':    ('#33301d', '#12110a', '#cbbd6a', '#7d7546', '#3b3822', '#111009', '#ece0a2'),
    'bastet': ('#3d2b3f', '#140d16', '#c98ad6', '#7c5684', '#3f2b44', '#120b15', '#ecc4f2'),
    'isis':   ('#1f3b3c', '#0a1616', '#6fc9c0', '#43807c', '#20403d', '#081312', '#b6efe6'),
}


def portrait(hero_id: str, role: str) -> str:
    sky_a, sky_b, key, body_a, body_b, body_c, rim = PALETTES[hero_id]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="{sky_a}"/><stop offset="1" stop-color="{sky_b}"/></linearGradient>
<radialGradient id="key" cx="50%" cy="30%" r="56%">
<stop offset="0" stop-color="{key}" stop-opacity="0.72"/><stop offset="1" stop-color="{key}" stop-opacity="0"/></radialGradient>
<linearGradient id="body" x1="0.15" y1="0" x2="0.85" y2="1">
<stop offset="0" stop-color="{body_a}"/><stop offset="0.52" stop-color="{body_b}"/><stop offset="1" stop-color="{body_c}"/></linearGradient>
<linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{rim}"/><stop offset="1" stop-color="{rim}" stop-opacity="0.25"/></linearGradient>
<radialGradient id="vig" cx="50%" cy="42%" r="74%">
<stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.82"/></radialGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/>
<feColorMatrix type="saturate" values="0"/></filter>
</defs>
<rect width="400" height="400" fill="url(#sky)"/>
<ellipse cx="200" cy="120" rx="230" ry="190" fill="url(#key)"/>
<path d="M200 36 C286 36 330 130 326 210 L74 210 C70 130 114 36 200 36 Z" fill="#000" opacity="0.16"/>
<path d="M200 52 C278 52 318 138 314 210" fill="none" stroke="{rim}" stroke-width="2" opacity="0.14"/>
<path d="M200 52 C122 52 82 138 86 210" fill="none" stroke="{rim}" stroke-width="2" opacity="0.14"/>
{FIGURES[role]}
<rect width="400" height="400" filter="url(#grain)" opacity="0.15"/>
<rect width="400" height="400" fill="url(#vig)"/>
</svg>'''
    packed = ' '.join(svg.split())
    return 'data:image/svg+xml,' + urllib.parse.quote(packed, safe="/:=<>?'()., ")


HEROES = [
    ('atlas', 'protector'), ('ares', 'fighter'), ('zeus', 'caster'),
    ('geb', 'protector'), ('bastet', 'fighter'), ('isis', 'caster'),
]

entries = ',\n'.join(f"  {hid}: '{portrait(hid, role)}'" for hid, role in HEROES)

OUT.write_text(f'''/**
 * Painted bust per hero, as a data-URI image.
 *
 * Generated by `npm run build:portraits`. Do not edit by hand - see
 * scripts/build-portraits.py.
 *
 * These are the base layer under each card's remote portrait: the published
 * page's CSP blocks external images silently, so a remote URL alone would
 * leave an empty frame. Both layers are real <img> with object-cover.
 */

export const PORTRAITS = {{
{entries},
}};
''')

size = OUT.stat().st_size
print(f'{len(HEROES)} portraits written to {OUT} ({size / 1024:.1f}kb)')
