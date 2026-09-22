# Mercs

A deterministic, simultaneous-resolution tactics engine. Two parties of six
gods commit their orders blind each round, then everything resolves in speed
order.

Zero dependencies at runtime, no build step: Node 22 strips the TypeScript and
runs the tests itself.

```bash
npm install     # typescript + @types/node, for typechecking only
npm test        # 49 tests
npm run bench   # branching factor and throughput
npm run typecheck
```

## The core mechanic

Both sides pick one ability and target per board god without seeing the other's
choice. Orders then resolve from **lowest speed to highest** (1–9), with ties
broken by the match's seeded RNG.

That single rule generates most of the depth:

- A fast lethal hit **denies** a slower ability outright — the actor dies before
  it acts, and single-target abilities whose mark is already dead *fizzle*.
- A speed-1 stun denies an action the same way.
- A slow, high-value ability is a read on the opponent, not a certainty.
- Protectors' speed-1 taunts are the counterplay to one enormous slow hit: the
  wall commits first and eats it.

The role triangle gives legible counterplay on top: **Protector > Fighter >
Caster > Protector**, at double damage.

## Play it

A browser front end lives in `web/`. It is a view over the engine and never
re-implements a rule: legal orders come from `optionsForMerc`, resolution from
`resolveRound`, the opponent from `greedyPolicy`, damage previews from
`rawDamage`.

```bash
npm run build:web   # bundles src/ to web/engine.js with esbuild
# then serve web/ over http (ES modules need a real origin, not file://)
python3 -m http.server -d web 8000
```

Published demo: <https://claude.ai/artifact/9zNA9ffjyNHQ856GTWeZYU>

Mercenaries' whole combat screen is three rows and two thin edge strips, and
that restraint is the point - so this is too:

```
 history │   enemy rank (3 circular medallions)   │  Ready
  strip  │   ability tray (the selected god's 3)  │  bench
         │   your rank (3 circular medallions)    │  strip
```

Everything else is on demand. Role lives in the **ring colour** (green
Fighter, blue Caster, amber Protector, matching the source game's own legend),
never a text chip. The only numbers on the board are attack, health, and an
ability's speed. Rules text, forecasts and statuses come from a hover tooltip;
the full log lives behind the history strip.

- **Speech-bubble ordinals** above each god for who acts when, with a `?` when
  the placing is genuinely uncertain (see below).
- **The ability tray** holds the selected god's three abilities as orbs, speed
  beneath each and a cooldown badge on the ones not ready. Clicking an orb arms
  it and the tray states what it does, what to click next, and the damage it
  would land - so nothing depends on hovering, which touch cannot do. An orb on
  cooldown is still clickable and says when it comes back. During resolution the
  same tray narrates the acting god.
- A small badge on each medallion shows the committed ability; on a Bounty the
  opposition's shows too.

Committing an order takes as few clicks as the ability needs. One that takes no
target commits on the click; one that does arms first, then takes a click on a
glowing god. Any pick can be replaced until Ready, so nothing needs confirming.

### Reading a round

Health carries a **depleting arc** outside each portrait's rim, green through
amber to red. A bare number cannot show that 22 damage off 28 health is nearly
lethal while 22 off 68 is a scratch, and asking someone to compare two-digit
numbers between frames is not a readable game.

As each ability fires, the tray shows **that ability's own card** - ordinal,
whose turn it is, name, speed, caster, target and its rules text - edged gold
for yours and teal for theirs. A name and a number do not tell you what the
enemy just did to you; the effect text does.

Resolution plays out rather than jumping to the result: fighters and protectors
lunge at their target, casters throw a bolt, hits land with a shake, a red
flash across the portrait, an expanding ripple, a damage number held long
enough to read (gold when a role bonus doubled it) and a health number that
counts down to its new value rather than snapping. Deaths desaturate and
collapse; heals pulse green; denials, fizzles and taunt intercepts pop a word.

Every beat is unhurried by default, because a round is the part of this game
worth watching. **Calm / Steady / Brisk** scales all of them by 1.65 / 1 / 0.5
and remembers the choice per viewer; `prefers-reduced-motion` skips the
animation entirely.

This forced one architectural rule: **resolution never re-renders the board.**
It renders once with every order revealed, then mutates that DOM and animates
against it, because a re-render mid-round tears out anything in flight.

Two modes, following the source game's own split:

| Mode | Behaviour |
|---|---|
| **Bounty** (default) | The opponent's picks are revealed before you commit, so every unit carries an ordinal. This is what Mercenaries' PvE did. |
| **Fighting Pit** | Neither side sees the other's orders. Enemy picks stay sealed until both commit. |

### Speed ties

A tie is not a coin flip in every direction, and the split matters:

- **Within one side, ties follow submission order.** Committing a buff before
  the attack that should benefit from it is a real decision, so it must not be
  undone by chance.
- **Across sides, ties are random.** Neither player can know whether their
  speed-5 ability lands before the enemy's.

Both hold at once because each speed group draws one sorted key per side and
hands them out in submission order: same-side keys ascend by construction
while the two sides' interleave at random, and a single numeric sort key keeps
the comparator transitive where a pairwise rule would not be.

The UI marks an ordinal with `?` only when the tie crosses sides, which is
what Mercenaries' `1st?` / `2nd?` bubbles were telling you.

### Art

`web/art/` holds the images and `web/art/README.md` documents the contract.
Portraits are square (512x512), ability icons are square and small (96x96).
Anything with no entry in the `PORTRAITS` / `ABILITY_ICONS` manifests at the
top of the page script renders a monogram placeholder in its role colour, so
the board stays readable while art is in progress.

## Architecture

| File | Responsibility |
|---|---|
| `src/types.ts` | Data model. Static content (`MercDef`, `Ability`, `Effect`) vs. runtime state (`MercState`, `BattleState`). |
| `src/rng.ts` | Seeded RNG. Each round derives its own stream from `(matchSeed, round)`. |
| `src/resolve.ts` | Round resolution, order validation, legal-move enumeration. |
| `src/effects.ts` | The only interpreter of `Effect` data. Damage, mitigation, statuses, death. |
| `src/board.ts` | Board and party queries. Pure reads. |
| `src/battle.ts` | Battle setup, equipment folding, the match loop. |
| `src/clone.ts` | Fast state clone (see below). |
| `src/ai.ts` | Baseline policies and joint-action enumeration. |
| `src/data/` | The roster: 36 gods across 10 pantheons, plus a content validator. |

Three decisions carry most of the weight:

**Content is data.** A new god is a `MercDef` literal and no code. A new *kind*
of effect is one branch in `applyEffect`. `validateRoster` catches the silent
content bugs — an ability that asks for a target no effect uses, an equipment
bonus that changes nothing, a speed delta that clamps to a no-op.

**`resolveRound` is pure.** It clones its input, so an AI search can resolve
thousands of hypothetical rounds against a live battle without disturbing it.
A test asserts the input state is untouched.

**Determinism is total.** Nothing calls `Math.random`. A match persists as
`(initialState, seed, ordersPerRound[])` — a few hundred bytes — and replays
byte-identically. That one property buys replays, spectating, cheat resistance,
and async multiplayer for free. A test replays a full fuzzed battle from its
seed and orders alone and asserts an identical final state.

## Measured, not assumed

`npm run bench` exists because two of my estimates were wrong, and both
mattered:

**The action space is small.** I guessed ~700 joint orders per side. It peaks
around **108 (max 441)** at round 5, because abilities with a cooldown start
spent and only come online gradually. Round 1 has ~2.3 options per god.

**The clone was the bottleneck.** `resolveRound` was 247µs, of which
`structuredClone` was 209µs — it was deep-copying immutable ability
definitions every round. `src/clone.ts` copies only what resolution mutates
and shares content by reference: **27µs**, a 9x speedup, verified against
`structuredClone` by `test/clone.test.ts`.

Together those flip the AI conclusion. At 36,700 resolutions/sec and a peak
matrix of ~11,600, a **full exact Nash solve per round costs ~320ms at the
worst observed branching**, and sampled regret matching at 1,000 rollouts
costs ~28ms. Exact solving is affordable; no pruning needed yet.

`test/action-space.test.ts` fails if content ever widens the branching factor
past what exact solving can carry.

## The roster

36 gods, 12 per role, across Greek, Egyptian, Norse, Celtic, Aztec, Japanese,
Chinese, Hindu, Mesopotamian and Yoruba pantheons. Three abilities each
unlocking at levels 1 / 5 / 15, two equipment options apiece, stats authored at
level 30 with level-1 values derived.

`pantheon` is a real synergy axis, not flavour — six pantheons have enough
members to build a themed party around.

**The numbers are structural, not authoritative.** They were written to
exercise every code path — area damage, drain, execute, multi-hit, shields,
divine shields, immunity, taunt, stun, damage over time, regeneration, buffs,
dispel, cleanse, cooldown manipulation, revival — and to sit in sane bands
per role. They have had no balance passes. Treat them as a test fixture that
happens to be playable.

## The React board

A second front end lives in `web/react/`, built to a spec that differs from the
vanilla one on purpose - **square** hero frames, a **permanent three-skill dock
welded under every unit**, and Mercenaries' own role colours (Protector red,
Fighter green, Caster blue). It is a feel prototype on mock state, not engine
backed; six heroes, three a side.

```bash
npm run build:icons      # lucide-static -> web/react/icons.jsx
npm run build:portraits  # painted busts -> web/react/portraits.jsx
npm run build:board      # esbuild (JSX) + tailwind v4 -> web/react/dist/
```

| File | Contents |
|---|---|
| `web/react/Board.jsx` | The component. Lift this into a real project as-is. |
| `web/react/heroes.jsx` | Mock state. Shapes match `src/` so wiring the engine in is mechanical. |
| `web/react/icons.jsx` | Generated Lucide components (skill icons only - never avatars). |
| `web/react/portraits.jsx` | Generated painted busts, one per hero, as data URIs. |
| `web/react/input.css` | Tailwind v4 source, `@theme` tokens and `@source` globs. |

### Built for a phone in portrait

The layout decision everything else follows from: **abilities are not on the
board.** Tap a hero and a sheet rises with its three abilities in full - name,
speed, cooldown, range and rules text, none of it truncated. Tapping an enemy
opens the same sheet read-only with the ability it has chosen marked `Chosen`.
That is how Mercenaries does it, and it buys back the vertical space three
permanent skill docks were eating.

What is left on the board is only what you read at a glance: the portrait, two
stat gems, the committed ability, and the turn order. Measured at 390x844 and
360x640 with no scrolling in either direction.

### Card anatomy

1. A **strict 1:1 portrait plate** - thick dark border, heavy drop shadow. Role
   is a coloured gradient wash up from the bottom plus a solid 3px rule, never
   a glowing outer border.
2. **Stat gems riveted half-in, half-out** of the plate's bottom corners, which
   is why they live outside the plate's `overflow-hidden` box. The name sits
   above them rather than being squeezed between them.

### Portraits

One place sets art: the `ART` map at the top of `heroes.jsx`. Drop files into
`web/react/art/` and point entries at them (`atlas: 'art/atlas.webp'`); see
`web/react/art/README.md` for sizes.

Each plate stacks two real `<img class="object-cover">`: a generated painted
bust underneath, and `hero.portrait` over it. The reason is that **the
published page's CSP blocks *remote* images silently** - a remote URL on its
own renders an empty frame, so the placeholder `picsum` URLs only work on a dev
server. Files published from `web/react/art/` are same-origin and load
normally. The overlay also carries no `alt` and removes itself on error,
because a blocked image otherwise paints its alt text straight over the card.

Everything that can be compiled ahead of time is, because the published page
has a CDN allowlist and anything from the wrong host fails *silently*: JSX
through esbuild, Tailwind v4 through its own CLI, Lucide icons inlined from
`lucide-static`. Only React, ReactDOM and Framer Motion load at runtime, as UMD
bundles referenced through the `React` / `ReactDOM` / `Motion` globals, and the
page states plainly if any of them fails to arrive.

Two consequences worth knowing before editing it:

- **Tailwind class names must be literal strings.** v4 scans source text, so a
  template-assembled `` `border-${role}` `` generates nothing. Role styling
  goes through explicit maps in `heroes.jsx`.
- `web/react/dist/` is generated and stays out of git.

## What's next

1. **The AI policy engine** — regret matching over the joint action space. One
   component serves five jobs: opponent, async-PvP timeout fallback, PvE
   encounters, ghost-ladder population, and the balance sweep harness.
2. **Balance sweeps** — run millions of matches headless to find degenerate
   comps. The engine is fast enough for this now.
3. **Run structure** — pick 6, fight 8 encounters, draft treasures between
   fights. This is the whole single-player game, with no live-service
   scaffolding.
4. **UI** — a browser view over the engine. Deliberately last; the combat has
   to feel good in a test harness first.

Deliberately *not* on the list: the grind. The source game's progression was
monetisation scaffolding, and it's what killed the mode.
