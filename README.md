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

The board is laid out the way Mercenaries laid its out, because that layout
answers the two questions a simultaneous-resolution game has to answer at a
glance:

- **Ordinal badges** (`1st`, `2nd`, ...) sit on each god, so *who acts when*
  is read straight off the board. They come from `buildQueue` against the same
  seeded round stream the resolver will use, so the order shown is exact,
  tie-breaks included.
- **A queued-ability slot** beside each god, facing the centre line, so *what
  each unit is doing* and at what speed is visible for all six at once.
- Dashed arrows for who is aimed at whom, a card-detail panel for the ability
  under the cursor, and floating damage numbers during resolution - the job
  Hearthstone's animations do.

Two modes, following the source game's own split:

| Mode | Behaviour |
|---|---|
| **Bounty** (default) | The opponent's picks are revealed before you commit, so every unit carries an exact ordinal. This is what Mercenaries' PvE did. |
| **Fighting Pit** | Neither side sees the other's orders. Your units show their committed speed; true order resolves only after both commit. |

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
