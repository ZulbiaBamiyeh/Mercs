# Mercs

A turn-based team battler prototype in the style of Hearthstone Mercenaries.
You hire six mercenaries, put three on the table, and give each an order.
Then every order from both sides resolves in speed order, lowest first.

The rules follow [`docs/mercs-mechanics-spec.md`](docs/mercs-mechanics-spec.md).
The eight starter mercs, at max power, come from
[`docs/mercs-starter-roster.md`](docs/mercs-starter-roster.md) and
[`src/data/roster.json`](src/data/roster.json).

The first prototype is kept intact in [`legacy/prototype-v1/`](legacy/prototype-v1).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine rules tests (vitest)
npm run typecheck
npm run build      # one self-contained file: dist/index.html
```

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
| `src/engine/abilities.ts` | All 24 abilities and 24 items at tier 5 / tier 4 |
| `src/engine/ai.ts` | Enemy orders, chosen by simulating each option |
| `src/engine/text.ts` | Card text built from the same numbers the rules use |
| `src/ui/` | React front end. `screens/` for Title, Party, Battle |
| `src/ui/battle/director.ts` | Turns resolution events into animation |
| `src/ui/theme.css` | The visual language: brass, parchment, stone |
| `test/engine.test.ts` | Rules tests, mapped to the spec's §11 cases |

Resolution returns a list of events, each paired with the state right after it.
The UI plays them in order: it animates the beat, then shows that state. So the
rules never depend on the animation, and the engine can be tested without a browser.

## Adding art

Drop portraits into `src/assets/portraits/`, named by merc id (`cariel.png`,
`tyrande.webp`, …). They replace the coloured placeholders everywhere. See the
README in that folder.

Ability and item icons are from [game-icons.net](https://game-icons.net) (CC BY 3.0),
by Lorc, Delapouite and contributors. `node scripts/extract-icons.mjs` regenerates
the subset in `src/ui/icons/gameIcons.ts`.

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

The mercenary names and ability names are Blizzard's. Swap in original ones
before sharing this publicly.
