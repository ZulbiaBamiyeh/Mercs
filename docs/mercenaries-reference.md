# Hearthstone Mercenaries: reference

What this project copies, and how confident we are about each part.

**Read the confidence column before using a number.** Every mercenary database,
wiki and official page is blocked by this environment's egress policy —
`hearthstone.wiki.gg`, `hearthstone.fandom.com`, `hearthstonetopdecks.com`,
`icy-veins.com`, `outof.games`, `hearthstone.blizzard.com`, Blizzard's own
Mercenaries guide PDF, and `api.hearthstonejson.com` all return 403 at the
proxy. Web *search* works, so the systems below come from search result
summaries; **no per-mercenary stat table was obtainable.**

## Systems

| Rule | Confidence |
|---|---|
| Three roles: **Fighter**, **Caster**, **Protector**. | Confirmed |
| **Protector** doubles vs **Fighter**, Fighter vs **Caster**, Caster vs Protector. | Confirmed |
| Fighters use aggressive abilities for major damage; Casters cast for powerful effects but have **less Attack**; Protectors are tanks and supports with **a lot of Health**. | Confirmed |
| Each mercenary has **exactly three abilities**. | Confirmed |
| Abilities unlock at levels **1, 5 and 15**. | Confirmed |
| Every ability has **Speed** and **Cooldown**. | Confirmed |
| **Lowest speed resolves first.** | Confirmed |
| Cooldown is turns before reuse; an ability with cooldown ≥ 1 is **unavailable at the start of a battle**. | Confirmed |
| Tied speeds resolve **randomly**, and the UI marks the uncertainty (`1st?`). | Confirmed |
| Ties **between your own mercenaries** follow the order you picked their abilities, not chance. | Confirmed |
| Max level **30**. Levelling always raises health, and **only sometimes** raises attack. | Confirmed |
| Each mercenary has **one of three equipment** options, itself upgradeable. | Confirmed |
| **Bounty (PvE)** shows the enemy's chosen abilities and the resolve order before you commit. | Confirmed |
| **Fighting Pit (PvP)** hides the enemy party until both commit, and never shows their picks. | Confirmed |
| Combat resolution is fully automatic once both sides commit. | Confirmed |
| Rarity tiers exist (Rare / Epic / Legendary) and track power. | Confirmed |

### The Attack keyword — the one that changes combat maths

Damaging abilities split in two:

- **With the Attack keyword**: behaves like minion combat in Hearthstone. The
  striker deals damage equal to its Attack **and takes damage equal to the
  defender's Attack in the process.** Confirmed.
- **Without it**: behaves like a spell. Deals its stated damage, the caster
  takes nothing back. Confirmed.

This is why a defender's Attack stat is *defensive*, and the reason Attack on a
high-health unit is worth anything at all.

### Keywords

| Keyword | Effect | Confidence |
|---|---|---|
| **Taunt** | Enemies cannot attack friendly characters without Taunt. | Confirmed |
| **Divine Shield** | The first time this character takes damage, ignore it. | Confirmed |
| **Stealth** | Cannot be targeted by enemy attacks, spells or abilities — and in Mercenaries it **breaks when the character uses an ability**, not only when it attacks. | Confirmed |
| **Immune** | Cannot be damaged. | Confirmed |
| **Retaliation N** | Ranked keyword (`Retaliation 2`, `Retaliation 3`) that strikes back when allies take damage, with a bonus that scales by rank. Counters Fighters. A later variant, Backlash, fires a laser instead of attacking back. | Partly confirmed — ranks and purpose yes, exact numbers no |
| **Deathblow**, **Bleed**, **Root**, **Spell Combo**, **Critical Damage** | Added in later patches. | Exists; mechanics not obtained |

Note the **numbered-rank pattern** (`Retaliation 2`): keyword strength is part
of the keyword's name rather than hidden in the rules text.

## What could not be obtained

- Any exact attack / health value for any named mercenary.
- Any exact ability damage, speed or cooldown for any named ability.
- The per-level stat curve, beyond "health always, attack sometimes".
- Equipment numbers.
- Blitz (if it exists as a Mercenaries keyword at all — nothing confirmed it).

**So every number in our roster is derived, not copied.** The structure is
faithful; the values are ours, tuned with `npm run balance` rather than
guessed. If you can paste a stat table, swapping the values in is a data-only
change.

## Derived stat bands

Chosen so that a neutral single-target ability takes 5–6 uses to kill and a
role-doubled one takes 3, which puts a match at roughly 6–9 rounds.

| Role | Attack @30 | Health @30 | Shape |
|---|---|---|---|
| Protector | 6–9 | 44–56 | Soaks, taunts, shields. Lowest output. |
| Fighter | 10–13 | 32–40 | Highest output, mostly Attack-keyword abilities, so it pays to swing. |
| Caster | 8–11 | 26–34 | Spells that take nothing back; area damage and healing. |

| Ability kind | Damage | Speed | Cooldown |
|---|---|---|---|
| Bread-and-butter strike | 1.0× attack | 2–5 | 0 |
| Area damage | 40–55% of a single hit, per target | 4–8 | 2–3 |
| Heavy single hit | 1.5–2× attack | 5–8 | 2–3 |
| Heal | 10–16 single, 6–10 team | 1–3 | 0–2 |
| Defensive buff | shield 8–12, **1–2 round duration** | 1–2 | 1–2 |

The duration on shields is load-bearing: the earlier demo let them accumulate
forever at cooldown 0, and the harness found that made both Protectors
literally unkillable and every well-played match a draw.

## Sources

Search-result summaries from these pages; none could be fetched directly.

- [Mercenary — Hearthstone Wiki](https://hearthstone.wiki.gg/wiki/Mercenaries/Mercenary)
- [Mercenaries/Ability — Hearthstone Wiki](https://hearthstone.fandom.com/wiki/Mercenaries/Ability)
- [Attack (ability) — Hearthstone Wiki](https://hearthstone.wiki.gg/wiki/Mercenaries/Attack_(ability))
- [Mercenaries/Taunt](https://hearthstone.fandom.com/wiki/Mercenaries/Taunt) · [Divine Shield](https://hearthstone.fandom.com/wiki/Mercenaries/Divine_Shield) · [Stealth](https://hearthstone.fandom.com/wiki/Mercenaries/Stealth) · [Immune](https://hearthstone.fandom.com/wiki/Mercenaries/Immune)
- [Retaliation 3](https://hearthstone.wiki.gg/wiki/Mercenaries/Retaliation_3)
- [Icy Veins gameplay guide](https://www.icy-veins.com/hearthstone/hearthstone-mercenaries-gameplay-guide)
- [Hearthstone Top Decks — full merc list](https://www.hearthstonetopdecks.com/hearthstone-mercenaries-guide-full-list-of-merc-heroes/) · [PvP guide](https://www.hearthstonetopdecks.com/hearthstone-mercenaries-pvp-guide/)
- [Combat Roles — Pro Game Guides](https://progameguides.com/hearthstone/what-are-combat-roles-in-hearthstone-mercenaries/)
- [New Mercenaries keywords — Out of Games](https://outof.games/news/3625-hearthstone-gets-many-new-mercenaries-card-keywords-what-are-deathblow-bleed-root-spell-combo-and-critical-damage/)
