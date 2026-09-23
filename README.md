# Mercs

A turn-based team battler prototype in the style of Hearthstone Mercenaries.
You hire six mercenaries, put three on the table, and give each an order.
Then every order from both sides resolves in speed order, lowest first.

The rules follow [`docs/mercs-mechanics-spec.md`](docs/mercs-mechanics-spec.md).

There are two rosters, picked with the tabs on the party screen:

- **The Free Companies** (default): 12 original mercenaries in
  [`src/engine/originals.ts`](src/engine/originals.ts), with flat SVG portraits.
- **Classic** (for testing): the eight Hearthstone starters at max power, from
  [`docs/mercs-starter-roster.md`](docs/mercs-starter-roster.md) and
  [`src/data/roster.json`](src/data/roster.json).

The first prototype is kept intact in [`legacy/prototype-v1/`](legacy/prototype-v1).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine rules tests (vitest)
npm run typecheck
npm run build      # one self-contained file: dist/index.html
npm run balance    # AI-vs-AI tournament; ROSTER=classic GAMES=500 to change it
```

## The Free Companies

Three factions of four, each with one of every role plus one more. Four
Protectors, four Fighters and four Casters in all.

| Merc | Role | Faction | ATK / HP | Plays like |
|---|---|---|---|---|
| Brannoc Emberhelm | Protector | Ironvow Dwarf | 12 / 84 | Taunt tank that burns attackers and slows what it hits |
| Captain Rurik Saltmane | Protector | Ironvow Human | 13 / 80 | Speeds up the whole team; Combo double-hit |
| Mother Gorsebark | Protector | Thornwild Treant | 9 / 92 | Roots attackers, even the whole enemy side |
| Vessa Nightcoil | Protector | Hollow Court Revenant | 12 / 70 | Lifesteal tank that heals from being hit |
| Nyxa the Pale | Fighter | Hollow Court Shade | 10 / 66 | Stealth, Bleed, then an Eviscerate with no counter-damage |
| Torvik Stormbrand | Fighter | Ironvow Dwarf | 9 / 74 | Windfury; Berserk trades health for burst |
| Lyra Thornquill | Fighter | Thornwild Elf | 7 / 76 | Ranged Bleed and a speed-2 Root to stop an attack cold |
| Grisk Tallowtooth | Fighter | Thornwild Goblin | 9 / 70 | Summons a Wolf that stays and takes orders |
| Sister Aurelle | Caster | Ironvow Human | 5 / 68 | Divine Shields and a Dawnfire that heals your weakest |
| Oona of the Fen | Caster | Thornwild Tortle | 5 / 72 | Chain damage, team heals, slows an enemy's turn |
| Mordekai Hollowspire | Caster | Hollow Court Revenant | 6 / 66 | Curses (Weakness, -Attack) and a Taunting Skeleton |
| Ilsa Frostveil | Caster | Hollow Court Wraith | 5 / 68 | Freeze, then an Ice Lance that doubles on Frozen targets |

Keywords the new roster adds to the engine: **Bleed**, **Root**, **Freeze**,
**Divine Shield**, **Stealth**, **Windfury**, **Combo**, **Lifesteal**,
**Shadow Weakness**, thorns-style retaliation, this-turn speed changes, and
minions that stay on the board and take orders.

### Balance

`npm run balance` plays random six-merc parties against each other with the
enemy AI on both sides, then reports each merc's win rate when it's in a party.
Over 1,000 games every original merc lands between 45% and 57%, and the classic
eight between 47% and 52%. That measures balance under this AI, not
under expert play, so treat it as a first pass.

## What's in it

- **Party screen.** All 8 starter mercs. Pick six and choose one of each merc's three items.
  Hover an ability to read its card. Item changes show up in the card text in green.
- **Deploy.** Choose which three start and where they stand. Neighbours matter for
  Hold the Front and Battlefury.
- **Orders.** The enemy commits first and its intents are visible, as in PvE.
  Order bubbles (`1st`, `2nd`, `3rd?`) update as you commit. A `?` means a speed
  tie with the other side, which is a coin flip. Attacks must target Taunt.
  Targeting uses an arrow. Right-click or Esc cancels.
- **Combat.** Each ability's card is shown as it fires. Attackers lunge, spells fly,
  and damage lands as a starburst (bigger on a role-advantage crit). Health and
  Attack numbers turn green or red against their base values.
- **Reinforcements** from the bench after deaths, then **Victory / Defeat / Stalemate**.
- Combat speed toggle, synthesized sound effects with a mute toggle, and a combat log.

## Layout

| Path | What |
|---|---|
| `src/engine/` | The rules. Pure TypeScript, no DOM. |
| `src/engine/battle.ts` | Setup, placement, legal targets, speed queue, damage pipeline, end of turn |
| `src/engine/abilities.ts` | The classic roster's 24 abilities and 24 items |
| `src/engine/originals.ts` | The original roster: stats, card text, items (data only) |
| `src/engine/originals-impl.ts` | What the original roster's abilities do |
| `src/engine/ai.ts` | Enemy orders, chosen by simulating each option |
| `src/engine/text.ts` | Card text built from the same numbers the rules use |
| `src/ui/` | React front end. `screens/` for Title, Party, Battle |
| `src/ui/battle/director.ts` | Turns resolution events into animation |
| `src/ui/theme.css` | The visual language: brass, parchment, stone |
| `test/engine.test.ts` | Rules tests, mapped to the spec's §11 cases |

Resolution returns a list of events, each paired with the state right after it.
The UI plays them in order: it animates the beat, then shows that state. So the
rules never depend on the animation, and the engine can be tested without a browser.

## Art

Portraits live in `src/assets/portraits/`, named by merc id. The original roster
uses flat, Reigns-like SVG portraits: flat colour planes, muted faction palettes
(Ironvow rust, Thornwild moss, Hollow Court slate) and still faces. The folder's
README lists the rules for adding more. Replace any file with your own art
(`.svg`, `.png`, `.webp`, `.jpg`) and the game uses that instead. Classic mercs
without a file get a coloured placeholder.

`docs/portrait-styles/` keeps the style studies that led here, and the earlier
pixel-art set (`scripts/pixel-portraits.mjs` regenerates it).

Ability and item icons are glyphs from [game-icons.net](https://game-icons.net)
(CC BY 3.0), by Lorc, Delapouite and contributors. `npm run icons` regenerates
the subset in `src/ui/icons/gameIcons.ts`.

## Layout

| Path | What |
|---|---|
| `src/engine/` | The rules. Pure TypeScript, no DOM. |
| `src/engine/battle.ts` | Setup, placement, legal targets, speed queue, damage pipeline, end of turn |
| `src/engine/abilities.ts` | The classic roster's 24 abilities and 24 items |
| `src/engine/originals.ts` | The original roster: stats, card text, items (data only) |
| `src/engine/originals-impl.ts` | What the original roster's abilities do |
| `src/engine/ai.ts` | Enemy orders, chosen by simulating each option |
| `src/engine/text.ts` | Card text built from the same numbers the rules use |
| `src/ui/` | React front end. `screens/` for Title, Party, Battle |
| `src/ui/battle/director.ts` | Turns resolution events into animation |
| `src/ui/theme.css` | The visual language: brass, parchment, stone |
| `test/engine.test.ts` | Rules tests, mapped to the spec's §11 cases |

Resolution returns a list of events, each paired with the state right after it.
The UI plays them in order: it animates the beat, then shows that state. So the
rules never depend on the animation, and the engine can be tested without a browser.

## Art

Portraits live in `src/assets/portraits/`, named by merc id. The originals'
pixel portraits are generated by `scripts/pixel-portraits.mjs`, which builds each
character from shapes on a 48x60 grid, then shades, outlines and dithers it.
Replace any file with your own art (`.png`, `.webp`, `.jpg`) and the game uses
that instead. Classic mercs without a file get a coloured placeholder.

The originals' ability and item icons are drawn as pixel art at runtime from
the same glyphs, to match the portraits.


## Rules choices worth knowing

Where the spec leaves a choice open, this is what the prototype does:

- Cooldowns work as in spec §3: cooldown abilities start unavailable, and benched mercs tick down too.
- Same-side speed ties keep the order you gave commands. Cross-side ties are a coin flip.
- Speed changes mid-turn (Staggering Slam) re-sort the rest of the queue.
- Damage reduction comes before the role crit, and the crit is applied last.
- Counter-damage never crits. Deathblow only counts kills by the ability itself.
- Atonement counts all healing your team does during the fight.
- Mirror Image copies have no role, so they neither crit nor get crit.
- Taunt for N turns includes the current turn.

The classic roster's names are Blizzard's. It is there for testing against the
spec; the originals are the ones to share.
