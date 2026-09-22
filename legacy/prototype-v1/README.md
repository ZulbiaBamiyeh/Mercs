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

## What this copies from Mercenaries

`docs/mercenaries-reference.md` records every rule this project borrows, with a
confidence column, and is explicit about what could not be obtained: **every
mercenary database, wiki and official page is blocked by this environment's
egress policy**, so no per-mercenary stat table exists here. The systems are
faithful; every number is derived and tuned, never copied.

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
board.** Tap a hero and its three abilities lay out as a tray of medallions in
the centre band - art, speed, cooldown, nothing else - and focusing one pops
the ability's **full card** in the slot beside the board. Tapping an enemy
opens the same tray read-only.

That replaced a bottom sheet holding three complete cards at once, which was
trying to say everything simultaneously. The tray says the minimum on the
board and the whole card only for the ability you are actually considering,
which is the shape the reference footage uses.

**With a mouse, hovering a medallion pops its card** - no click - so sweeping
along the tray flips through all three the way Hearthstone does. Clicking
still selects. Hover wins while the cursor is over a disc; with nothing under
it the card falls back to the armed ability, so what you picked stays up while
you choose its target.

The pointer handlers are filtered to `pointerType === 'mouse'` deliberately: a
touch tap also fires `pointerenter`, and on a phone that hover would stick to
whatever you last touched with no way to leave it. Keyboard focus pops the
card too.

On a phone a tap *is* the hover: the first tap focuses a medallion and lights
its legal targets green, the second tap on a lit target commits. Abilities
that need no target commit on that first tap, since there is nothing left to
choose. A locked medallion still shows its card - reading what you cannot use
yet is how you plan the next round.

Cards carry no gloss on the **Attack** keyword. It means mutual damage by
definition, and the real cards say only "Attack an enemy"; restating it on
every card was noise.

The full card is one object appearing in two places, deliberately: the card
that pops while you choose is the card that slides in when the ability fires.

Green means "you may aim here"; red is reserved for the unit actually being
struck during resolution, so the two never mean the same thing.

What is left on the board is only what you read at a glance: the portrait, two
stat gems, the committed ability, and the turn order. Measured at 390x844 and
360x640 with no scrolling in either direction.

**Choosing a target** is a state you cannot miss. An ability that needs one
arms instead of firing: legal targets pulse and wear a crosshair, everything
else greys out, the caster wears a `Casting` tag, and the footer becomes a
coloured bar naming the ability, what it will do and a Cancel. A tap that
misses every tile cancels, so you are never stuck holding an ability. An
ability aimed at its own caster or the whole field commits on the tap - there
is nothing to confirm.

### The Attack keyword

Mercenaries splits damaging abilities in two, and so does this. An ability
marked `isAttack` deals the striker's own Attack stat (plus any `bonus`) and
**takes the defender's Attack back in the process**, exactly like minion combat
in Hearthstone - which is what makes a defender's Attack stat defensive, and
why Attack on a tanky unit is worth anything at all. Everything else behaves
like a spell: it deals its stated `power` and the caster takes nothing back.

Two calls worth knowing: the role bonus applies to the strike only, not to the
damage coming back, because a symmetric bonus makes trades unreadable. And the
trade is simultaneous - a lethal blow still takes the reply.

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

**The built page fetches nothing at runtime.** Everything is compiled in: JSX
through esbuild, Tailwind v4 through its own CLI, Lucide icons inlined from
`lucide-static`, and React, ReactDOM and Framer Motion read out of
`node_modules`, minified, and emitted as inline `<script>` blocks ahead of the
board script. That last part used to be three CDN `<script src>` tags; they did
not arrive in a real client, and because the CSP fails silently the page showed
only its own "could not load" notice. Inlining costs ~277kb and removes the
failure mode. The boot call is wrapped in a `try`/`catch` that prints the error
rather than a blank screen.

Two things the page still *tries* to fetch, both degrading cleanly: the Google
Fonts stylesheet (Cinzel / EB Garamond, falling back to Palatino and Georgia)
and the placeholder `picsum` portraits (the generated busts show through). They
cannot be inlined from this sandbox because `fonts.googleapis.com` is blocked
here.

Two consequences worth knowing before editing it:

- **Tailwind class names must be literal strings.** v4 scans source text, so a
  template-assembled `` `border-${role}` `` generates nothing. Role styling
  goes through explicit maps in `heroes.jsx`.
- `web/react/dist/` is generated and stays out of git.

### The arena, and why the board was the problem

The board was a flat near-black panel with a wood-grain texture and a
near-opaque vignette over it. That, not the frames, was what made the whole
thing look unfinished: **dark cards on a dark void have nothing to sit
against**, so the art, the frames and the background all mushed into one
brown field and the metal read as decoration floating in space.

Every frame of the reference has the opposite arrangement - a *light*, warm
stone floor with saturated units standing on it. So `.arena` is a lit
flagstone floor: warm stone base, a broad pool of light where the ranks stand,
cool shadow pushed into the corners, warm bounce off the side walls. Regular
flagstone seams were tried and read as striped fabric; irregular pools of tone
read as stone and a grid does not.

Inverting the board meant re-grounding everything built for the dark one: the
header became a dark lintel so its pale lettering still reads, the tray and
cards went darker so they sit *on* the stone, and dimming switched from
`opacity` to `brightness` - a unit at 40% opacity over light stone looks
bleached, not shadowed.

`.grain` puts one inline `feTurbulence` layer over the arena and every metal
frame. A pure gradient is the tell that a surface was generated; real painted
surfaces are irregular.

### The sigils, and the limit of doing this in CSS

The placeholder portraits used to be painted busts drawn as vector
silhouettes, and they read as formless mush - which no amount of frame polish
fixes. Vectors are bad at figurative painting and good at heraldry, so they
are heraldry now: a bold gold device on a deep saturated field, one per god,
with a struck roundel, grain and a vignette. A crest that is plainly a stand-in
looks deliberate; a failed portrait looks broken. They also give each card its
own colour, which is most of why the ranks now read apart at a glance.

**Be honest about the ceiling.** This is CSS and inline SVG drawing a fantasy
game's UI. It can get the composition, the lighting, the pacing and the
readability right, and it cannot produce hand-painted character art or painted
ability icons. Those are the remaining gap, and they are a content problem
rather than a code one: drop files in `web/react/art/` and point the `ART` map
at them.

### The metal

Everything framed on the board is cast from the same four CSS pieces, in
`input.css` rather than scattered through the JSX, because each is five or six
layered shadows:

- `.frame-metal` - a gold/bronze body whose gradient runs light-dark-light so
  it reads as a curved surface, with a struck lip along the top edge, a dark
  seat underneath, and a heavy two-stage drop shadow so a card sits *on* the
  board rather than floating above it. Unit cards, ability cards, the cast
  card and the Fight button all use it, at 3-5px.
- `.frame-well` - the recess the art sits in, `inset 0 0 10px rgba(0,0,0,.8)`
  plus a directional inner shadow from the top.
- `.seal-brass` - a domed brass disc lit from the upper left, for the turn
  order stamps. Enemy seals take the rose variant.
- `.ink-outline` - a hard four-way black outline. Names sit over art that can
  be any colour, so a soft shadow is not enough; the outline is what makes
  them pop.
- `<Bevels>` - four cast corner plates, each a triangle clipped from a
  brighter gold gradient. Sized per frame thickness.

One consequence worth knowing: **the frame is gold on every card, so
selection can no longer be a border colour.** Acting, casting and open states
are glow rings instead, and role identity reads from the bottom wash, the
bottom rule and the two role-coloured gems - three signals, none of them the
frame.

### Resolution, beat by beat

A round is not six numbers appearing; it is six little scenes. Per step:

| Beat | ms | What happens |
|---|---|---|
| Card in | 560 | The firing ability's own card slides in from the left and holds long enough to read. Gold for you, rose for them. |
| Lunge | 230 | The caster drives at the opposing rank - up for your gods, down for theirs - and lights up. |
| Impact | 360 | Damage lands. Numbers punch in oversized inside a jagged starburst and settle; the target takes a white slam and a hard recoil shake; a role-doubled hit tints the whole screen. |
| Settle | 400 | Everything returns. |
| Card out | 200 | The card leaves. |

Roughly 1.75s a step, so a full round is 8-10s - close to what Mercenaries
spends. The `2×` button in the header halves every beat for anyone who has
already seen it. Bleed at the end of the round gets its own 700ms so it is not
mistaken for part of the last ability.

The cast card is the piece that makes an enemy turn legible: without it you can
see that you took 24 damage but not what did it. It sits in the empty band
below the ranks on a phone and centre-left on a wide screen, because at phone
width a centred card covers the turn order.

Turn order appears twice on purpose: as a bubble on each unit, which is where
Mercenaries puts it and where you read it while choosing, and in the centre
strip, which adds each ability's speed. Both carry `?` when a cross-side speed
tie means the position is still a coin flip.

## Balance, measured

`npm run balance` plays thousands of matches through the **same `rules.jsx` the
board resolves with**, so the numbers describe the demo rather than a
re-implementation of it. That is why the maths lives in its own pure module.

`npm run balance -- --trace` plays a single match and prints every pick, the
resolved queue, and the board after each round. Reach for it first when a
summary looks wrong: percentages tell you *that* a side loses, and this tells
you why, which is the only way to tell a roster problem from a policy problem.
It has now caught three policy problems masquerading as roster problems:

- The greedy policy never priced **Retaliation**, so it kept swinging into a
  taunting Protector carrying Retaliation 8. A third of the damage the player
  team took was self-inflicted.
- It never valued **Taunt** either. Atlas has a cooldown-0 Attack, so a
  damage-only policy took it every round and never once put his wall up; Geb's
  damage abilities both *start* on cooldown, so the same policy was forced to
  cast his. One Protector walled, the other did not, and the harness reported a
  100% enemy win rate that was measuring its own blind spot.
- Both policies were **deterministic**, and a deterministic policy against
  itself in a fixed 3v3 has exactly one outcome — so 4000 matches were 4000
  copies of one match, and the sweep could only ever return 0% or 100%. They
  now break near-ties at random, which is both more realistic and the thing
  that makes a win rate mean anything.

`npm run balance -- --tune` sweeps parameter combinations and ranks them by how
close the matchup is under every policy at once. Use it instead of arguing: the
units are tuned to what it found, not to taste.

Where the roster stands:

| Both sides | Player | Enemy | Hit the round cap |
|---|---|---|---|
| greedy | 49.2% | 50.8% | 0% |
| maximally aggressive | 50.6% | 49.4% | 0% |
| random | 56.9% | 39.6% | 0% |

Skill still decides matches - a greedy player beats a random one 85.8% of the
time - and every hero contributes rather than riding along.

### Three bugs the harness found

Recorded because each was invisible by inspection and each changed the game:

1. **Shields accumulated forever.** At cooldown 0 and with no expiry, a
   Protector ended a match sitting on 61 unspent shield having taken 28 damage
   against 50 health. Both Protectors were literally unkillable and *every*
   well-played match was a draw. Shields now carry a duration, as `src/`
   always did.
2. **Isis could not deal damage at all** - an offensive ceiling of zero across
   all three abilities, so a third of the enemy team could never threaten
   anything.
3. **Cross-side speed ties always favoured the player.** The sort read
   `a.side === 'player' ? -1 : 1`, which made greedy-vs-greedy fully
   deterministic - so the sweep could only ever return 0% or 100% and no
   balance signal existed at all. The reference says cross-side ties are
   random; they now are, decided by one seed per round so the order the UI
   previews is the order that resolves.

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
