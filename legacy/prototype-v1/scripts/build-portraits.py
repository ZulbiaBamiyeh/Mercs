#!/usr/bin/env python3
"""
Generate `web/react/portraits.jsx`: one heraldic sigil per god, as a data-URI
image.

Why data URIs: the published page's CSP blocks external images *silently*, so
a remote portrait URL renders an empty frame. Each card stacks two real <img>
tags with object-cover - the real art on top, this beneath - so a frame is
never empty wherever the page runs.

Why sigils rather than figures: the previous version drew painted busts as
vector silhouettes, and they read as formless mush. Vectors are bad at
figurative painting and good at heraldry, so these are heraldry: a bold gold
device on a deep saturated field, with grain, a rim and a vignette. A crest
that is obviously a stand-in looks deliberate; a failed portrait looks broken.

Real character art replaces these entirely - see web/react/art/README.md.
"""

import pathlib
import urllib.parse

OUT = pathlib.Path('web/react/portraits.jsx')

# Deep saturated fields, so a card stands out against the arena's light stone.
FIELDS = {
    'atlas':  ('#1b3b4d', '#0b1a24', 'Sky'),
    'ares':   ('#5d1519', '#26070a', 'War'),
    'zeus':   ('#2a1f5e', '#100a28', 'Storm'),
    'geb':    ('#463a15', '#1c1708', 'Earth'),
    'bastet': ('#10412f', '#061b13', 'Beast'),
    'isis':   ('#42184e', '#1a0821', 'Light'),
}

# Each device is drawn centred on a 400x400 canvas in `gold`, bold enough to
# survive being scaled down into a 110px card.
DEVICES = {
    # a globe borne on an arc - Atlas holding up the sky
    'atlas': '''
      <circle cx="200" cy="158" r="62" fill="none" stroke="url(#gold)" stroke-width="13"/>
      <ellipse cx="200" cy="158" rx="62" ry="24" fill="none" stroke="url(#gold)" stroke-width="8" opacity="0.85"/>
      <line x1="200" y1="96" x2="200" y2="220" stroke="url(#gold)" stroke-width="8" opacity="0.85"/>
      <path d="M92 300 C92 214 138 246 200 246 C262 246 308 214 308 300" fill="none" stroke="url(#gold)" stroke-width="17" stroke-linecap="round"/>
      <path d="M126 316 L274 316" stroke="url(#gold)" stroke-width="13" stroke-linecap="round"/>
    ''',
    # crossed spears
    'ares': '''
      <g stroke="url(#gold)" stroke-width="15" stroke-linecap="round">
        <line x1="112" y1="312" x2="288" y2="104"/>
        <line x1="288" y1="312" x2="112" y2="104"/>
      </g>
      <path d="M288 104 L302 90 L306 128 L272 124 Z" fill="url(#gold)"/>
      <path d="M112 104 L98 90 L94 128 L128 124 Z" fill="url(#gold)"/>
      <circle cx="200" cy="208" r="26" fill="none" stroke="url(#gold)" stroke-width="11"/>
    ''',
    # a bolt
    'zeus': '''
      <path d="M232 68 L134 214 L188 214 L152 336 L272 176 L212 176 L254 68 Z"
            fill="url(#gold)" stroke="#2b1c04" stroke-width="5" stroke-linejoin="round"/>
      <path d="M232 68 L134 214 L188 214" fill="none" stroke="#fff6d8" stroke-width="6" opacity="0.5"/>
    ''',
    # mountains over strata
    'geb': '''
      <path d="M52 306 L146 150 L214 246 L262 178 L348 306 Z"
            fill="url(#gold)" stroke="#2b1c04" stroke-width="5" stroke-linejoin="round"/>
      <path d="M146 150 L184 214 L120 214 Z" fill="#fff6d8" opacity="0.42"/>
      <g stroke="url(#gold)" stroke-width="10" stroke-linecap="round" opacity="0.8">
        <line x1="74" y1="336" x2="326" y2="336"/>
        <line x1="112" y1="362" x2="288" y2="362"/>
      </g>
    ''',
    # a cat's head
    'bastet': '''
      <path d="M124 176 L112 96 L176 138 Z" fill="url(#gold)"/>
      <path d="M276 176 L288 96 L224 138 Z" fill="url(#gold)"/>
      <path d="M200 124 C262 124 292 174 292 216 C292 274 252 316 200 316
               C148 316 108 274 108 216 C108 174 138 124 200 124 Z"
            fill="none" stroke="url(#gold)" stroke-width="15"/>
      <path d="M156 212 L186 212" stroke="url(#gold)" stroke-width="14" stroke-linecap="round"/>
      <path d="M214 212 L244 212" stroke="url(#gold)" stroke-width="14" stroke-linecap="round"/>
      <path d="M200 246 L200 264" stroke="url(#gold)" stroke-width="10" stroke-linecap="round"/>
      <path d="M170 282 Q200 300 230 282" fill="none" stroke="url(#gold)" stroke-width="10" stroke-linecap="round"/>
    ''',
    # spread wings under a sun disc
    'isis': '''
      <circle cx="200" cy="120" r="40" fill="url(#gold)"/>
      <circle cx="200" cy="120" r="40" fill="none" stroke="#2b1c04" stroke-width="4"/>
      <path d="M192 184 L208 184 L208 322 L192 322 Z" fill="url(#gold)"/>
      <g fill="url(#gold)" stroke="#2b1c04" stroke-width="4">
        <path d="M190 188 C140 190 96 212 64 252 C104 246 128 250 150 262 C120 268 100 284 84 306 C130 292 168 292 190 300 Z"/>
        <path d="M210 188 C260 190 304 212 336 252 C296 246 272 250 250 262 C280 268 300 284 316 306 C270 292 232 292 210 300 Z"/>
      </g>
    ''',
}


def svg(hero: str) -> str:
    base, deep, _ = FIELDS[hero]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs>
<radialGradient id="field" cx="38%" cy="28%" r="82%">
<stop offset="0%" stop-color="{base}"/>
<stop offset="62%" stop-color="{base}" stop-opacity="0.82"/>
<stop offset="100%" stop-color="{deep}"/>
</radialGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0.35" y2="1">
<stop offset="0%" stop-color="#ffeeb8"/>
<stop offset="42%" stop-color="#dcae45"/>
<stop offset="78%" stop-color="#9a6d1e"/>
<stop offset="100%" stop-color="#e2c483"/>
</linearGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4"/></filter>
<radialGradient id="vig" cx="50%" cy="42%" r="72%">
<stop offset="55%" stop-color="#000" stop-opacity="0"/>
<stop offset="100%" stop-color="#000" stop-opacity="0.62"/>
</radialGradient>
</defs>
<rect width="400" height="400" fill="url(#field)"/>
<!-- a struck roundel behind the device, so the field is not empty -->
<circle cx="200" cy="204" r="150" fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="26"/>
<circle cx="200" cy="204" r="168" fill="none" stroke="#000000" stroke-opacity="0.22" stroke-width="10"/>
{DEVICES[hero]}
<rect width="400" height="400" filter="url(#grain)" opacity="0.2" style="mix-blend-mode:overlay"/>
<rect width="400" height="400" fill="url(#vig)"/>
</svg>'''


def data_uri(markup: str) -> str:
    # `#` MUST be percent-encoded: in a URI it starts a fragment, so leaving it
    # safe truncates the SVG at the first colour literal and the image fails to
    # load - silently, as a broken frame showing its alt text. Same for `?`,
    # `&` and `%`. Everything left safe below is inert inside a data URI and
    # keeping it readable makes the generated file diffable.
    return 'data:image/svg+xml;utf8,' + urllib.parse.quote(
        markup, safe="()*!'-._~:/[]@+,;= <>\"")


entries = '\n'.join(
    f"  {hero}: '{data_uri(svg(hero))}',"
    for hero in FIELDS
)

OUT.write_text(f'''/**
 * GENERATED by scripts/build-portraits.py - do not edit by hand.
 *
 * One heraldic sigil per god: a bold gold device on a deep saturated field,
 * with a struck roundel, grain and a vignette. These are the layer beneath
 * real art, and they exist because the published page's CSP blocks external
 * images silently - a card must never render as an empty frame.
 *
 * They are heraldry rather than figures on purpose. An earlier version drew
 * painted busts as vector silhouettes and they read as formless mush; a crest
 * that is plainly a stand-in looks deliberate instead.
 */

export const PORTRAITS = {{
{entries}
}};
''')
print(f'wrote {OUT} ({OUT.stat().st_size} bytes)')
