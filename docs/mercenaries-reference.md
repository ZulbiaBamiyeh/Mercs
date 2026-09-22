# Hearthstone Mercenaries: reference

What this project copies, and how confident we are about each part.

**Read the confidence column before using a number.** Every mercenary database,
wiki and official page is blocked by this environment's egress policy —
`hearthstone.wiki.gg`, `hearthstone.fandom.com`, `hearthstonetopdecks.com`,
`icy-veins.com`, `outof.games`, `hearthstone.blizzard.com`, Blizzard's own
Mercenaries guide PDF, and `api.hearthstonejson.com` all return 403 at the
proxy. Web *search* works, so the systems below come from search result
summaries.

**The card data in "Observed cards" below is different: it was read off
screenshots of the wiki supplied directly, so those values are quoted, not
derived.** They are the only exact numbers in this document.

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

## Observed cards

Quoted from supplied screenshots of the wiki. Abilities are at tier 5. These
are exact.

| Merc | Role | Ability | Speed | CD | Text | School |
|---|---|---|---|---|---|---|
| Samuro | Fighter | Double Strike | 4 | 0 | Attack an enemy. If it was damaged this turn, gain +5 Attack and Attack it again. | — |
| | | Mirror Image | 3 | 1 | Choose an enemy. Summon a copy of this Merc that Attacks it and dies at the end of the turn. | — |
| | | Whirling Blade | 5 | 1 | Deal 11 damage to all enemies. Gain Immune this turn. | — |
| Rokara | Fighter | Tribal Warfare | 6 | 0 | Attack an enemy. If you control another Orc, gain +5 Attack first. | — |
| | | Offensive Rally | 2 | 1 | Whenever a friendly character Attacks this turn, give it +5/+10. | — |
| | | Orc Onslaught | 5 | 1 | Deal 12 damage. Repeat for each other Orc you control. | — |
| Cariel Roame | Protector | Crusader's Blow | 6 | 0 | Attack an enemy. Deathblow: Restore 60 Health to this Merc. | Holy |
| | | Taunt | 1 | 0 | Restore 12 Health to this Merc and gain Taunt for 3 turns. | — |
| | | Seal of Light | 4 | 1 | Restore 15 Health to a friendly character and give it +6 Attack. | Holy |
| Cornelius Roame | Protector | Martial Mastery | 8 | 0 | Gain +5 Health and Attack an enemy. If it's a Fighter, gain +10 Health instead. | Holy |
| | | Hold the Front | 2 | 0 | Gain Taunt for 2 turns. Restore 14 Health to adjacent characters. | Holy |
| | | Blessing of Sacrifice | 2 | 1 | Restore 10 Health to another friendly Merc. Whenever it takes damage this turn, this Merc takes it instead. | Holy |
| Millhouse Manastorm | Caster | Arcane Explosion | 4 | 0 | Deal 8 damage to all enemies. | Arcane |
| | | Arcane Bolt | 6 | 0 | Deal 12 damage. Gain +3 Arcane Damage. | Arcane |
| | | Greater Arcane Missiles | 9 | 2 | Shoot three missiles at random enemies that deal 20 damage each. | Arcane |
| Xyrella | Caster | Blinding Luminance | 3 | 0 | Deal 10 damage to an enemy and give it -8 Attack this turn. | Holy |
| | | Flash Heal | 4 | 0 | Restore 15 Health. | Holy |
| | | Atonement | 9 | 1 | Deal 20 damage. +3 damage each time you restore 20 Health. | Holy |

Unnamed in-game picker, same source: Divine Assault (speed 7, cd 0, "Attack an
enemy. Overkill: Give your party Divine Shield.", Holy) · Blessing of Kings
(speed 4, cd 1, "Give a character +9/+9.", Holy) · Holy Shields (speed 2, cd 2,
"Give this Merc and adjacent characters Divine Shield.", Holy).

Level-stat rows, read from the same pages (level → attack / health):

| Merc | ~L7 | ~L15 | ~L22-24 |
|---|---|---|---|
| Cariel (Protector) | 4 / 23 | 6 / 40 | 8 / 55 |
| Cornelius (Protector) | 4 / — | 6 / — | 8 / — |
| Rokara (Fighter) | 4 / 24 | 5 / 39 | 7 / 58 |
| Millhouse (Caster) | 1 / 20 | 2 / 37 | 4 / 56 |
| Xyrella (Caster) | 1 / 19 | 2 / 36 | 3 / 49 |

### What this corrected

Three things the demo had structurally wrong, all visible at a glance above:

1. **Ability damage is 2–4× the Attack stat, not equal to it.** Millhouse
   Attacks for 4 and casts for 12–20. The demo had Attack ≈ ability power.
2. **Attack is role-shaped, and it is the *Caster* that is low** — 3–4, against
   7–8 for Fighters and Protectors. Health barely separates the roles at all
   (49–58 across every merc above). Since the Attack keyword hands the
   defender's Attack back, a Caster is cheap to Attack and a Protector is
   expensive — which is the whole reason the role triangle bites. The demo's
   Caster had Attack 10, so nobody ever Attacked it and the triangle went flat.
3. **Cooldowns cap at 2.** The demo used 3s.

Healing and buffs are also far larger than the demo assumed: Restore 60, 15,
14, 12; +9/+9, +6 Attack, +5/+10.

### What is still not obtained

- Any merc's level-30 row (the tables above stop in the low 20s).
- Equipment numbers beyond the six quoted in "Observed equipment" below.
- The full roster — six mercs of 50-odd.
- Blitz (if it exists as a Mercenaries keyword at all — nothing confirmed it).

### Observed equipment

Samuro: Sash of Illusion (Mirror Image summons an extra copy) · Honed Blade
(Whirling Blade deals 4 more damage) · Burning Blade (Passive: whenever this
Merc Attacks, gain +2/+2). Rokara: Frostwolf Talisman (+4 Attack on Tribal
Warfare) · Helm of Inspiration (Offensive Rally gives an additional +2/+4) ·
Ancestral Armor (Passive: +20 Health). Cornelius: Shield of Dawn (Passive:
take 3 less damage). Millhouse: Mana Rod (Arcane Bolt gains +4 Arcane Damage
more, but has +1 Cooldown).

### Card layout

The ability picker is a framed tray titled **Abilities** holding three
portrait cards. Each card: circular art in a thick gold ring; the speed
number on a winged plate biting into the ring's bottom-left; the cooldown, if
any, as a small badge in the card's top-right; a gold name banner; the rules
text on parchment; and the school on a strip along the bottom. Plain weapon
work has **no** school strip — every Samuro and Rokara ability above omits it.

Stat gems on a unit card are **role-coloured, not stat-coloured**: Caster
blue, Fighter green, Protector red, for both attack and health. Attack sits
bottom-left and changes shape per role (orb / bladed orb / shield); health
sits bottom-right and is a teardrop.

## Our stat bands

Now calibrated to the rows above rather than derived. A match runs 4–6 rounds.

| Role | Attack | Health | Shape |
|---|---|---|---|
| Protector | 8 | 58 | Soaks, taunts, walls. Lowest output; expensive to Attack. |
| Fighter | 11 | 42–44 | Highest output, mostly Attack-keyword abilities. |
| Caster | 4 | 40 | Spells that take nothing back. Cheap to Attack — that is the point. |

| Ability kind | Damage | Speed | Cooldown |
|---|---|---|---|
| Bread-and-butter strike | 1.0× attack | 2–5 | 0 |
| Area damage | 8–9 per target | 4–8 | 2 |
| Heavy single hit | attack + 7–8 | 4–7 | 2 |
| Nuke (Caster) | 12 | 3 | 0 |
| Heal | 12–16 single, 10–12 team | 1–3 | 2 |
| Defensive buff | shield 10–14, **1–2 round duration** | 1–2 | 1–2 |
| Attack buff | +3–4, lasts the battle | 1–2 | 2 |

The duration on shields is load-bearing: the earlier demo let them accumulate
forever at cooldown 0, and the harness found that made both Protectors
literally unkillable and every well-played match a draw.

## Sources

The "Observed cards" section comes from supplied screenshots of
`hearthstone.wiki.gg`. Everything else is search-result summaries from these
pages; none could be fetched directly.

- [Mercenary — Hearthstone Wiki](https://hearthstone.wiki.gg/wiki/Mercenaries/Mercenary)
- [Mercenaries/Ability — Hearthstone Wiki](https://hearthstone.fandom.com/wiki/Mercenaries/Ability)
- [Attack (ability) — Hearthstone Wiki](https://hearthstone.wiki.gg/wiki/Mercenaries/Attack_(ability))
- [Mercenaries/Taunt](https://hearthstone.fandom.com/wiki/Mercenaries/Taunt) · [Divine Shield](https://hearthstone.fandom.com/wiki/Mercenaries/Divine_Shield) · [Stealth](https://hearthstone.fandom.com/wiki/Mercenaries/Stealth) · [Immune](https://hearthstone.fandom.com/wiki/Mercenaries/Immune)
- [Retaliation 3](https://hearthstone.wiki.gg/wiki/Mercenaries/Retaliation_3)
- [Icy Veins gameplay guide](https://www.icy-veins.com/hearthstone/hearthstone-mercenaries-gameplay-guide)
- [Hearthstone Top Decks — full merc list](https://www.hearthstonetopdecks.com/hearthstone-mercenaries-guide-full-list-of-merc-heroes/) · [PvP guide](https://www.hearthstonetopdecks.com/hearthstone-mercenaries-pvp-guide/)
- [Combat Roles — Pro Game Guides](https://progameguides.com/hearthstone/what-are-combat-roles-in-hearthstone-mercenaries/)
- [New Mercenaries keywords — Out of Games](https://outof.games/news/3625-hearthstone-gets-many-new-mercenaries-card-keywords-what-are-deathblow-bleed-root-spell-combo-and-critical-damage/)
