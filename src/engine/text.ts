// Card text for abilities, built from the same numbers the rules use.
// Markup: **Keyword** gets a tooltip, {n} is a number boosted by equipment or
// by the fight so far (drawn green, like the source game).

import { atonementDamage, N } from './abilities';
import type { BattleState, Unit } from './types';

interface Holder { item: string | null; side?: Unit['side']; arcaneDamage?: number }

const up = (base: number, bonus: number) => (bonus ? `{${base + bonus}}` : `${base}`);

export function abilityText(id: string, u: Holder | null, s?: BattleState | null): string {
  const item = u?.item ?? null;
  const has = (i: string) => item === i;
  const arcane = u?.arcaneDamage ?? 0;
  switch (id) {
    case 'crusaders-blow':
      return has('hammer-of-dawn')
        ? `**Attack** an enemy. **Deathblow:** Restore ${N.crusadersBlowHeal} Health to {all} your characters.`
        : `**Attack** an enemy. **Deathblow:** Restore ${N.crusadersBlowHeal} Health to this Merc.`;
    case 'taunt':
      return `Restore ${N.tauntHeal} Health to this Merc and gain **Taunt** for ${N.tauntTurns} turns.`;
    case 'seal-of-light':
      return has('tome-of-judgment')
        ? `Restore ${N.sealHeal} Health to a friendly character and give it +${N.sealAttack} Attack, plus {+${N.judgmentPerAlliance}} for each of your Alliance characters.`
        : `Restore ${N.sealHeal} Health to a friendly character and give it +${N.sealAttack} Attack.`;
    case 'martial-mastery': {
      const g = has('striking-gauntlets') ? N.gauntlets : 0;
      return `Gain +${up(N.martialHealth, g)} Health and **Attack** an enemy. If it's a Fighter, gain +${up(N.martialFighterHealth, g)} Health instead.`;
    }
    case 'hold-the-front':
      return `Gain **Taunt** for ${N.holdTurns} turns. Restore ${up(N.holdHeal, has('band-of-enlightenment') ? N.enlightenment : 0)} Health to adjacent characters.`;
    case 'blessing-of-sacrifice':
      return `Restore ${N.sacrificeHeal} Health to another friendly Merc. Whenever it takes damage this turn, this Merc takes it instead.`;
    case 'blood-fervor':
      return `**Attack** an enemy. **Deathblow:** Give +${N.fervorAttack} Attack to your Horde characters${has('gorehowl') ? ` and restore {${N.gorehowlHeal}} Health to this Merc` : ''}.`;
    case 'staggering-slam':
      return `Deal ${up(N.slamDamage, has('halting-sash') ? N.haltingSash : 0)} damage to an enemy. Its next ability is (${N.slamSlow}) Speed slower.`;
    case 'battlefury':
      return `Gain +${up(N.furyAttack, has('bloodthirst-amulet') ? N.bloodthirst : 0)} Attack. **Attack** an enemy and one of its neighbors.`;
    case 'arcane-shot':
      return has('elunes-charm')
        ? `Deal ${N.arcaneShot} damage to an enemy, or {${N.arcaneShot + N.elunesCharm}} if it has already acted.`
        : `Deal ${N.arcaneShot} damage to an enemy.`;
    case 'arcane-salvo':
      return `Deal ${up(N.salvo, has('verdant-recurve') ? N.verdant : 0)} damage to two random enemies. If any die, repeat this.`;
    case 'elunes-grace':
      return `Your next Arcane ability casts twice and is permanently (${N.graceSpeed}) Speed faster.`;
    case 'double-strike':
      return `**Attack** an enemy. If it was damaged this turn, gain +${N.doubleStrikeAttack} Attack and **Attack** it again.`;
    case 'mirror-image':
      return has('sash-of-illusion')
        ? `Choose an enemy. Summon {two} copies of this Merc that **Attack** it and die at the end of the turn.`
        : `Choose an enemy. Summon a copy of this Merc that **Attacks** it and dies at the end of the turn.`;
    case 'whirling-blade':
      return `Deal ${up(N.whirl, has('honed-blade') ? N.honed : 0)} damage to all enemies. Gain **Immune** this turn.`;
    case 'tribal-warfare':
      return `**Attack** an enemy. If you control another Orc, gain +${up(N.tribalAttack, has('frostwolf-talisman') ? N.frostwolf : 0)} Attack first.`;
    case 'offensive-rally': {
      const h = has('helm-of-inspiration');
      return `Whenever a friendly character **Attacks** this turn, give it +${up(N.rallyAttack, h ? N.helmAttack : 0)}/+${up(N.rallyHealth, h ? N.helmHealth : 0)}.`;
    }
    case 'orc-onslaught':
      return `Deal ${N.onslaught} damage to an enemy. Repeat for each other Orc you control.`;
    case 'blinding-luminance': {
      const w = has('radiant-wand');
      return `Deal ${up(N.luminance, w ? N.radiantDamage : 0)} damage to an enemy and give it -${up(N.luminanceDebuff, w ? N.radiantDebuff : 0)} Attack this turn.`;
    }
    case 'flash-heal':
      return `Restore ${up(N.flashHeal, has('shard-of-the-naaru') ? N.naaru : 0)} Health to a friendly character.`;
    case 'atonement': {
      const threshold = N.atonementThreshold - (has('robes-of-purity') ? N.robes : 0);
      if (s && u && 'uid' in u) {
        const a = atonementDamage({ s }, u as Unit);
        const dmg = a.damage > N.atonement ? `{${a.damage}}` : `${a.damage}`;
        return `Deal ${dmg} damage to an enemy. +${N.atonementStep} damage each time your team restores ${threshold} Health. (${a.remaining} remaining.)`;
      }
      return `Deal ${N.atonement} damage to an enemy. +${N.atonementStep} damage each time your team restores ${threshold < N.atonementThreshold ? `{${threshold}}` : threshold} Health.`;
    }
    case 'arcane-explosion':
      return `Deal ${up(N.explosion, (has('arcane-powder') ? N.powder : 0) + arcane)} damage to all enemies.`;
    case 'arcane-bolt':
      return `Deal ${up(N.bolt, arcane)} damage to an enemy. Gain +${up(N.boltArcane, has('mana-rod') ? N.manaRod : 0)} Arcane Damage.`;
    case 'greater-arcane-missiles':
      return `Shoot ${N.missiles} missiles at ${has('ley-line-wand') ? '{the lowest Health}' : 'random'} enemies that deal ${up(N.missileDamage, arcane)} damage each.`;
    default:
      return '';
  }
}

export const KEYWORDS: Record<string, string> = {
  Attack: 'Deal your Attack to a character and take its Attack back as damage. Most Attacks can be blocked by Taunt.',
  Attacks: 'Deal your Attack to a character and take its Attack back as damage. Most Attacks can be blocked by Taunt.',
  Taunt: 'Enemies must Attack characters with Taunt. Abilities that deal damage without Attacking ignore it.',
  Deathblow: 'A bonus that happens if this ability kills a character.',
  Immune: "Can't be damaged. Damaging abilities aimed at it pick another target.",
};

export const ROLE_INFO = {
  PROTECTOR: { label: 'Protector', beats: 'FIGHTER', color: 'red' },
  FIGHTER: { label: 'Fighter', beats: 'CASTER', color: 'green' },
  CASTER: { label: 'Caster', beats: 'PROTECTOR', color: 'blue' },
} as const;
