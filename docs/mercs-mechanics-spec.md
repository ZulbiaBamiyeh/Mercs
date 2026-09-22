# Mercenaries-Style Combat Game: Mechanics Spec

A rules reference for building a turn-based team battler modelled on Hearthstone Mercenaries. It's written so you can paste it into a coding assistant as the source of truth.

**How to read the tags**
- **[C] Confirmed**: stated by Blizzard, the Hearthstone wiki, or several independent guides.
- **[I] Inferred**: the sources don't say this outright. It's the most consistent reading of how the game behaves, or a sensible default. You can change these freely.
- **[D] Design choice**: the sources say nothing, or disagree. Pick a rule and keep it consistent.

> IP note: the mechanics are fair game, but the mercenary names, ability names and art belong to Blizzard. Use original characters and art in anything you publish.

---

## 1. Core entities

### 1.1 Mercenary (character)
| Field | Notes |
|---|---|
| `name`, `rarity` | Rare / Epic / Legendary [C] |
| `role` | `PROTECTOR` (red), `FIGHTER` (green), `CASTER` (blue), `NEUTRAL` (black, enemy-only) [C] |
| `attack` | Base attack by level. It's the damage dealt when the merc **Attacks** [C] |
| `maxHealth`, `health` | The merc dies when health reaches 0 or less [C] |
| `minionType` | e.g. Human, Draenei, Dragon. Some mercs have two types [C]. Used by synergy text |
| `faction` | Alliance, Horde, Empire, Explorer, Legion, Pirate, Scourge or none [C]. Used by synergy text (e.g. "+4 Attack for each Alliance character") |
| `level` | 1–30 [C]. Stats come from a per-merc table (see §1.4) |
| `abilities[3]` | Unlocked at levels 1, 5 and 15 [C]. Each has a tier from 1 to 5 |
| `equipment` | 0 or 1 equipped, with tier 1–4 [C] |
| `treasures[]` | Run-only buffs in PvE (see §7) [C] |
| `statuses[]` | Taunt, Stealth, Divine Shield, Frozen, Rooted, Bleed, Immune, and so on |
| `spellSchoolMods` | e.g. `+X Fire Damage`, `Fire Weakness X`, `Fire Resistance X` [C] |

### 1.2 Ability
| Field | Notes |
|---|---|
| `speed` | Integer. **Lower speeds act first** [C]. Shown on a silver wing icon |
| `cooldown` | Number of turns to wait between uses. Abilities with a cooldown **start the game on cooldown** [C] |
| `school` | Arcane, Fel, Fire, Frost, Holy, Nature, Shadow, "Attack", or none [C] |
| `targeting` | `ENEMY`, `FRIENDLY`, `SELF`, `NONE/AOE`, `RANDOM`, `LOWEST/HIGHEST_<stat>`, `OPPOSITE`, `ADJACENT` |
| `isAttack` | True if the text says "**Attack** an enemy". This matters for Taunt, Root, counter-damage and Windfury [C] |
| `effects[]` | A list of effect primitives (see §5) |
| `tier` | 1–5. Higher tiers usually mean bigger numbers and sometimes lower speed [C] |

Real examples from your screenshots (tier 5):
- **Crusader's Blow**: speed 6. "Attack an enemy. *Deathblow:* restore 60 Health to this Merc." (Tier 1 restores 10.)
- **Taunt**: speed 1. "Restore 12 Health to this Merc and gain Taunt for 3 turns."
- **Seal of Light**: speed 4, cooldown 1. "Restore 15 Health to a friendly character and give it +6 Attack."
- **Blinding Luminance**: speed 3, Holy. "Deal 10 damage to an enemy and give it −8 Attack this turn."
- **Flash Heal**: speed 4, Holy. "Restore 15 Health."
- **Atonement**: speed 9, cooldown 1, Holy. "Deal 20 damage. +3 damage each time you restore 20 Health. *(20 remaining)*". This is a **growing counter** that tracks cumulative healing across the fight.
- **Frostbite**: speed 5, Frost. "Attack an enemy. The ability they used this turn is permanently (1) Speed slower."

### 1.3 Equipment
- A merc can equip one item [C]. Each item modifies a single ability or grants a passive, e.g. "Seal of Light gives +4 Attack for each Alliance character", "Flash Heal restores 20 more but has (1) Cooldown", or "Passive: while this Merc has Taunt, +12 Attack" [C].
- Items have tiers 1–4 [C]. In the real game they unlock at level 30 and through tasks 2 and 7 [C], which is progression you can simplify.

### 1.4 Levels and progression [C]
- Stats come from a per-level table rather than a formula. Cariel Roame (Protector), for example:
  - ATK: 3,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,7,7,7,7,8,8,8,8,9,9,10,10,11
  - HP: 11,13,14,16,18,21,23,25,28,30,32,34,36,38,40,43,45,47,49,51,53,55,58,60,62,64,66,68,70,73
- Casters have a low ATK curve. Xyrella goes from 1/7 at level 1 to 5/68 at level 30.
- Ability upgrade cost in coins: T2 = 50, T3 = 125, T4 = 150, T5 = 150.
- XP goes to **every party member after each win, including benched and dead mercs**.

---

## 2. Match structure

### 2.1 Team setup [C]
- Each player brings **6 mercs**, with no restriction on roles.
- At the start of the match all 6 are in your "hand", and you drag **3** onto the battlefield in the order you choose. **Position matters** because of adjacency and "opposite" effects. The other 3 wait on the **bench**.
- Once a merc is on the battlefield it can't be withdrawn or repositioned. The only exception is abilities that explicitly swap.
- In PvP, neither side sees the other's placement until both are ready.

### 2.2 The turn loop
```
START_OF_GAME triggers (treasures, boons, equipment passives)
loop:
  COMMAND PHASE    each living merc/minion on your board picks 1 ability + target
  COMBAT PHASE     all chosen abilities from BOTH sides resolve in speed order
  END OF TURN      bleed, durations, cooldowns, clear "this turn" effects
  WIN CHECK
  RECRUIT PHASE    only for a side that lost units and still has bench mercs
```

### 2.3 Command phase [C]
- For each of your board units, choose one available ability (not on cooldown) and a target if it needs one.
- You can change your choices freely until you press **Ready!**
- A unit that has no ability queued does nothing that turn.
- The UI shows an order bubble over every unit, e.g. **1st, 2nd, 3rd**, computed by sorting all queued abilities by speed. A **"?"** marks a position that might change because of a tie or hidden information.
- **PvE:** the enemy's chosen abilities are **visible**, and the enemy order is recalculated each time you lock in one of your choices [C]. This is the central puzzle of PvE: you see the enemy's intent and race it on speed.
- **PvP:** you can only see your own choices [C].

### 2.4 Combat phase: resolution order
**Sort all queued abilities from both sides by current speed, ascending.** [C]

Tie-breaks [C]:
1. **Same side, same speed:** the one you commanded first goes first.
2. **Opposite sides, same speed:** random, with a coin flip for each tied pair.

For each action in the queue:
1. **Actor is dead** → skip. A dead merc's queued ability never happens [C].
2. **Actor is Frozen and hasn't acted yet** → skip (see Freeze) [C].
3. **Actor is Rooted and the ability is an Attack** → the Attack and **everything after it in that ability's text** are negated. Earlier parts of the text still happen [C].
4. **Target validation:** if the chosen target is dead, or is now untargetable (Stealth, or Immune for a damaging ability), **retarget to a random legal target**. A Taunt target is preferred when the ability is an Attack [C for random retarget; I for the Taunt preference, which mirrors Windfury's documented behaviour].
5. **Taunt check for Attacks:** if the enemy has any Taunt unit and the target isn't one, redirect to a Taunt unit [C that Attacks must hit Taunt. D whether this is enforced at command time, resolution time or both. **Recommendation:** enforce it at command time in the UI, then re-check at resolution time in case Taunt appeared mid-turn].
6. Execute the effects in text order.
7. After each damage event, run the **death check**. Deathrattles fire and Deathblow triggers for the source [C].
8. Stealth on the actor is removed as soon as it **uses any ability**, not only when it attacks [C].

### 2.5 End of turn [C unless marked]
- **Bleed:** a bleeding character takes its bleed damage at the end of each turn until it is healed. **Any Health restore removes Bleed** [C].
- "This turn" effects expire, e.g. "−8 Attack this turn" [C].
- **Freeze wears off** at the end of the turn it was applied, even if it never stopped anything, unless the text says "until next turn" [C].
- Durations tick down, e.g. "Taunt for 3 turns" [C].
- **Cooldowns tick down by 1** at the end of each turn. This also applies to **benched mercs** [C].
- Suggested order within end of turn [D]: bleed damage → death check → expire "this turn" effects → tick durations → tick cooldowns.

### 2.6 Win, loss and tie [C]
- A side loses when it has no living mercs on the board and none on the bench.
- If both sides run out at the same time, the result is a **tie**.
- **PvP has a hard limit of 30 turns**, after which the game is a tie.

### 2.7 Recruit phase [C]
- This happens only when one of **your** mercs died during the turn and you still have bench mercs. It's your side only: if just the enemy lost units, you don't get to recruit.
- The bench returns to "hand", and you place as many mercs as died, up to 3 on the board. You choose where they go.

---

## 3. Cooldown semantics (implement exactly)
In the real game [C]:
- At game start, an ability with cooldown N ≥ 1 is **unusable on turn 1**.
- A cooldown-1 ability is usable every other turn. Cooldown N means you **wait N turns between uses**.

Implementation that reproduces both behaviours [I]:
```
on game start:      ability.cdRemaining = ability.cooldown
on use:             ability.cdRemaining = ability.cooldown + 1
at end of each turn: ability.cdRemaining = max(0, cdRemaining - 1)   // board AND bench
usable iff cdRemaining == 0
```
Check: CD 1 → turn 1 blocked, turn 2 used, turn 3 blocked, turn 4 used. ✔

"Refresh" effects set `cdRemaining = 0`.

---

## 4. Damage and healing

### 4.1 Attack (the keyword) [C]
"Attack an enemy" works like Hearthstone minion combat:
- The attacker deals **its current Attack value** to the target.
- **The target deals its Attack back** to the attacker as counter-damage.
- Non-Attack damage (spells, "Deal X damage") is **one-way**, with no counter-damage.
- **Windfury:** attacks twice. If the first attack kills the target, the second picks a random enemy, preferring Taunt [C].

### 4.2 Role advantage [C]
- **Protector → Fighter, Fighter → Caster, Caster → Protector.** Advantage doubles the damage, which the game calls **Critical Damage (2×)**.
- The doubling applies to damage the merc's abilities deal, **when it is the attacker/source**.
- **Counter-damage does not get the role bonus.** If a Protector attacks a Caster, the Caster's retaliation isn't doubled.
- Neutral characters and summoned minions have no role, so they neither deal nor suffer role crits [I, because minions have no Role per the wiki].
- Critical Damage is applied **after all other calculations** [C].
- Some ability or equipment text excludes crits. Support a `noCrit` flag.
- Bleed and other end-of-turn damage: the sources don't say whether role crits apply. **Recommendation:** no crit on damage-over-time [D].

### 4.3 Damage pipeline
Sources partly disagree here, so this is a consolidated order [mix of C and D]:
```
1. base = ability's number (or attacker.attack for an Attack)
2. + school bonus: "+X Fire Damage" etc. for abilities of that school   [C exists]
3. set/override effects ("damage becomes X")                          [forum]
4. multipliers written on the ability ("deal double damage")          [forum]
5. − damage reduction / resistance on the target                      [forum test: reduction before weakness]
6. + school weakness / Spell Weakness on the target                   [C exists]
7. clamp to >= 0
8. × 2 if role advantage (Critical Damage)                            [C: crit is last]
9. Immune → 0.  Divine Shield → absorb this whole instance, remove the shield   [C]
10. apply to health; record the source for Deathblow/death triggers
```
A community test showed a 10-damage Frost spell plus Frost Weakness 6 against 10 damage reduction dealt **0**, which is why reduction sits before weakness here. The thread's own stated order has weakness before reduction, so this point is contested and you can go either way.

Each target of an AoE ability is a separate damage instance, so each one gets its own pipeline run and crit check [I].

### 4.4 Healing
- "Restore X Health" is capped at max health.
- **Heal Power +X** adds to every healing ability [C].
- Any heal **removes Bleed** [C].
- Track **total healing done** for counters like Atonement ("each time you restore 20 Health") [C].

---

## 5. Keywords and statuses

| Keyword | Rule | Src |
|---|---|---|
| **Taunt** | Enemies must **Attack** characters with Taunt. It only restricts Attacks, **not** spells or "deal damage". Effects that target lowest/highest-stat enemies or the "opposite" enemy ignore Taunt | C |
| **Stealth** | Can't be attacked or targeted. Lost when the unit **uses any ability** | C. AoE still hits it [I, as in HS] |
| **Divine Shield** | Ignores the first damage instance it takes, then is removed | C |
| **Immune** | Can't be damaged. Damaging abilities aimed at it retarget randomly | C |
| **Freeze** | "Loses its next ability this turn." Only matters if the unit hasn't acted yet. Wears off at end of turn | C |
| **Root** | Can't Attack. The ability still resolves, but the Attack part and everything after it are cancelled. A rooted unit doesn't count as having Attacked | C |
| **Bleed X** | Takes X damage at the end of each turn until it is healed | C. Stacking: [D], suggest additive |
| **Deathblow** | Bonus effect when **this ability** kills a character | C. Should kills by counter-damage count? [D], suggest no |
| **Deathrattle** | Triggers when the unit dies | C |
| **Combo** | Bonus if a friendly unit already **resolved** an ability earlier this turn | C |
| **<School> Combo** | Bonus if a friendly unit already resolved an ability **of that school** this turn | C |
| **Windfury** | Attacks twice (see §4.1) | C |
| **Critical Damage** | Takes 2× damage, applied last | C |
| **+X <School> Damage** | Abilities of that school deal +X. Lasts until the holder dies | C |
| **<School> Weakness / Resistance X** | Takes +X or −X from abilities of that school. Spell Weakness/Resistance applies to all abilities | C |
| **Heal Power X** | Healing abilities restore +X | C |
| **Refresh** | Resets an ability's cooldown | C |
| **Speed modifiers** | "Ability is (X) Speed slower/faster". Can apply this turn only or permanently (Frostbite). Speed is re-sorted when modified mid-combat [I]. Minimum speed 0 [D] | C for existence |
| **Start of Game** | Triggers once before turn 1 | C |
| **Battlecry** | Triggers when a unit is summoned/placed | C |
| **Passive** | Always-on while the unit lives (common on equipment and treasures) | C |

**Status icons under a portrait, as in your first screenshot:** a **lightning bolt** means an active triggered effect, and a **skull** means Deathrattle (the same icons Hearthstone uses) [I]. The icy, cracked frame on two of the portraits looks like the Frozen state [I].

**Speed modified mid-combat [D]:** if an ability's speed changes after the queue is built, re-sort the **not-yet-resolved** part of the queue. Keep the original command order as the stable secondary key.

---

## 6. Summons, positions, targeting helpers
- **Minions** (summoned by abilities, e.g. Mirror Images or Bear Traps) have every merc property **except role and equipment**. Each has one Attack ability whose speed is printed on the minion [C]. They soak random-target abilities, which is a key counterplay tool [C].
- **Board order** is left to right. Helpers you'll need:
  - `adjacent(unit)`: the neighbours on the same side. Taunt tanks are usually put on an edge to limit cleave splash [C].
  - `opposite(unit)`: the enemy at the same index. It ignores Taunt [C].
  - `lowest/highest(stat)`: ties broken randomly [D]. Ignores Taunt [C].
- Board size cap: the sources don't say. **Recommendation:** 3 mercs plus up to 3 minions per side, so 6 total [D].
- Minions never count as bench mercs and don't trigger recruit [I].

---

## 7. PvE: bounties (roguelite layer)

### 7.1 Map [C]
- The map is procedurally generated. You move node by node along connected paths, and the boss is always the final node.
- Node types:
  - **Fight:** the usual encounter. You see the enemy party before it starts.
  - **Elite fight:** marked with a dragon frame. It's harder and gives better treasures and more XP.
  - **Spirit Healer:** revives one dead merc. Sources disagree on whether it's random or your choice. Blizzard's text says random [C].
  - **Boon:** at Start of Game, **every merc of one role on BOTH teams** gets a bonus (Health, Attack, Windfury, Divine Shield, Taunt, Haste…), in tiers by bounty level (≤10, 11–20, 21+) [C].
  - **Mystery:** changes the next fight's rules, or offers a side task [C].
  - **Campfire:** the start node and checkpoint [C].
  - **Boss:** the final node. Winning it completes the bounty [C].

### 7.2 Between fights [C]
- **Health fully resets** after each fight.
- **Dead mercs stay dead** for the rest of the run unless a Spirit Healer revives them.
- If the whole party is wiped, the run fails and you keep only XP.

### 7.3 Treasures [C]
- After each won fight, a **random living merc** is picked and you **choose 1 of 3 treasures** for it.
- Treasures last only for the run.
- They come in three kinds:
  - **Start of Game:** fires at the start of each fight if the holder is alive.
  - **Passive:** always on.
  - **Ability:** adds a **4th ability** to that merc, usually weaker than its own three.
- Elite fights draw from a stronger pool.
- Once every living merc has treasures, offers can be **upgrades (+1 level) of treasures they already hold**.

### 7.4 Enemy AI (PvE)
- The enemy **commits to its intents before you choose**, and you see them [C]. The simplest faithful AI is scripted or weighted ability choice with sensible targets (lowest HP, role advantage, heal the lowest ally).
- Bosses usually have 3+ scripted abilities and passives.
- The endgame "Mythic" mode ran 3 boss fights in a row and then a double boss, with permanent "beyond max" upgrades paid for in a currency (Renown) [C]. Treat this as optional late-game scope.

---

## 8. PvP: Fighting Pit [C]
- Both sides pick hidden, simultaneous commands. The same speed rules apply, and cross-team ties are random.
- 30-turn limit, then a tie.
- Matchmaking weighs merc levels, ability tiers and equipment tiers.

---

## 9. Visual language (from your screenshots)
- **Portrait:** an oval inside a gold frame.
  - Frame bottom colour = role: blue caster, green fighter, red protector, black neutral.
  - **Attack** is bottom-left in a role-shaped gem: a caster orb, a fighter sword-orb, or a protector shield.
  - **Health** is bottom-right in a water-drop gem tinted by role.
- **Number colours:** white = base, **green = buffed above base**, **red = damaged below max**. An attack debuff also shows below base.
- **Ability bar:** a row of round ability icons, each with its **speed** on the wing badge and an hourglass for any **cooldown**. Hovering shows the card: name + tier, text, school banner at the bottom (Holy, Frost…).
- **Order bubbles** ("1st", "2nd?") float above every unit during command.
- **Ready!** button on the right.
- **Tooltips** for keywords (e.g. the "Attack" tooltip text).
- **Effect feedback:** shatter particles for Freeze or a shield break, a floating damage number, and a red flash on the health drop.

---

## 10. Reference resolution pseudocode
```ts
function resolveCombat(state) {
  const queue = [...state.players.flatMap(p => p.commands)]      // {actor, ability, target, cmdIndex, side}
  queue.forEach(c => c.tieRoll = rng())                           // cross-side tie-breaker
  const key = c => [c.ability.currentSpeed(c.actor), sideTieOrder(c), c.cmdIndex]
  sortQueue(queue, key)

  while (queue.length) {
    const cmd = queue.shift()
    const { actor, ability } = cmd
    if (!actor.alive) continue
    if (actor.frozen) { log('frozen'); continue }
    actor.removeStatus('STEALTH')
    let target = validateTarget(cmd)                               // retarget random legal; Taunt for Attacks
    for (const eff of ability.effects) {
      if (eff.kind === 'ATTACK' && actor.rooted) break             // cancel attack + rest
      runEffect(eff, actor, target, state)                        // runs damage pipeline §4.3
      processDeaths(state)                                        // deathrattles, deathblow
      if (state.gameOver) return
    }
    state.turnLog.schoolsResolved[actor.side].add(ability.school) // for Combo
    if (speedsChanged(state)) resort(queue)
  }
}

function endOfTurn(state) {
  applyBleed(state); processDeaths(state)
  expireThisTurnEffects(state); clearFreeze(state)
  tickDurations(state)
  for (const m of allMercs(state /* board + bench */))
    for (const a of m.abilities) a.cdRemaining = Math.max(0, a.cdRemaining - 1)
}
```

---

## 11. Test cases your implementation should pass
1. **Speed order:** a speed-3 enemy spell resolves before a speed-4 friendly heal.
2. **Same-side tie:** two friendly speed-5 abilities resolve in the order they were commanded.
3. **Death skips:** a merc killed at speed 2 never performs its speed-6 action.
4. **Retarget:** A queues an attack on B, B dies earlier in the turn, and A hits a random living enemy (Taunt first if it's an Attack).
5. **Taunt vs spell:** a spell can target a non-Taunt merc while Taunt is up. An Attack can't.
6. **Counter-damage:** a 10/50 attacking a 4/30 ends with the attacker at 46 and the target at 20.
7. **Role crit:** a Protector (ATK 10) attacking a Fighter deals 20. The Fighter's counter isn't doubled.
8. **Crit is last:** 10 damage vs 4 reduction with role advantage gives (10−4)×2 = 12.
9. **Divine Shield:** absorbs one hit, including a crit, then is gone.
10. **Freeze after acting:** freezing a unit that already acted this turn has no effect, and it's not frozen next turn.
11. **Root:** "Attack an enemy. Then gain +5 Attack" while rooted: nothing after the Attack happens.
12. **Cooldown 1:** unusable on turn 1, usable turn 2, unusable turn 3, usable turn 4. Bench cooldowns tick too.
13. **Bleed:** a heal removes it before the end of turn.
14. **Combo:** a Fire Combo bonus applies only if a friendly Fire ability resolved **earlier** this turn.
15. **Recruit:** only the side that lost a merc places from the bench.
16. **Tie:** the last mercs on both sides die in the same resolution, and the game is a draw.
17. **Frostbite:** after it hits, the target's used ability is 1 slower **on every later turn**.

---

## 12. Suggested MVP scope
1. Combat engine (§2–§5) running headless with a text log, and unit tests (§11).
2. 6–8 original mercs (2–3 per role) with 3 abilities each at a fixed tier.
3. PvE fights with visible enemy intents and a basic AI.
4. Board UI (§9): command selection, order bubbles, Ready, animated resolution.
5. Bounty map with Fight, Elite, Spirit Healer and Boss nodes, plus choose-1-of-3 treasures.
6. Later: equipment, levels and XP, boons, mysteries, PvP.

---

## Sources
- Hearthstone Wiki: [Mercenaries](https://hearthstone.wiki.gg/wiki/Mercenaries), [Ability/Speed/Cooldown](https://hearthstone.wiki.gg/wiki/Mercenaries/Ability), [Taunt](https://hearthstone.wiki.gg/wiki/Mercenaries/Taunt), [Role](https://hearthstone.wiki.gg/wiki/Mercenaries/Role), [Critical Damage](https://hearthstone.wiki.gg/wiki/Mercenaries/Critical_Damage), [Freeze](https://hearthstone.wiki.gg/wiki/Mercenaries/Freeze), [Root](https://hearthstone.wiki.gg/wiki/Mercenaries/Root), [Stealth](https://hearthstone.wiki.gg/wiki/Mercenaries/Stealth), [Bleed](https://hearthstone.wiki.gg/wiki/Mercenaries/Bleed), [Combo](https://hearthstone.wiki.gg/wiki/Mercenaries/Combo), [Windfury](https://hearthstone.wiki.gg/wiki/Mercenaries/Windfury), [Heal Power](https://hearthstone.wiki.gg/wiki/Mercenaries/Heal_Power), [Minion](https://hearthstone.wiki.gg/wiki/Mercenaries/Minion), [Bounty](https://hearthstone.wiki.gg/wiki/Mercenaries/Bounty), [Boon](https://hearthstone.wiki.gg/wiki/Mercenaries/Boon), [Spirit Healer](https://hearthstone.wiki.gg/wiki/Mercenaries/Spirit_Healer), [Fighting Pit](https://hearthstone.wiki.gg/wiki/Mercenaries/Fighting_Pit), [Cariel Roame](https://hearthstone.wiki.gg/wiki/Mercenaries/Cariel_Roame), [Xyrella](https://hearthstone.wiki.gg/wiki/Mercenaries/Xyrella)
- Blizzard: [Mercenaries Gameplay Spotlight](https://hearthstone.blizzard.com/en-us/news/23707670/mercenaries-gameplay-spotlight), [Mythic update](https://hearthstone.blizzard.com/en-us/news/23892226/mercenaries-gameplay-spotlight)
- Guides: [Icy Veins gameplay guide](https://www.icy-veins.com/hearthstone/hearthstone-mercenaries-gameplay-guide), [Hearthstone Top Decks ultimate guide](https://www.hearthstonetopdecks.com/hearthstone-mercenaries-ultimate-guide/), [HearthPwn launch FAQ](https://www.hearthpwn.com/news/8629-hearthstone-mercenaries-launch-guide-with-tips-and), [Inven advanced PvP tips](https://www.invenglobal.com/articles/15549/hearthstone-mercenaries-advanced-pvp-tips-and-tricks), [Out of Games keyword article](https://outof.games/news/3625-hearthstone-gets-many-new-mercenaries-card-keywords-what-are-deathblow-bleed-root-spell-combo-and-critical-damage/), [NamuWiki treasures](https://en.namu.wiki/w/%ED%95%98%EC%8A%A4%EC%8A%A4%ED%86%A4/%EC%9A%A9%EB%B3%91%EB%8B%A8/%ED%98%84%EC%83%81%EC%88%98%EB%B0%B0/%EB%B3%B4%EB%AC%BC)
- Community testing: [HearthPwn damage reduction thread](https://www.hearthpwn.com/forums/hearthstone-game-modes/mercenaries/251385-damage-reduction-mechanics)
