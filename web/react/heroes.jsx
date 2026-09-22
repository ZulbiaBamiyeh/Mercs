/**
 * Mock game state.
 *
 * Six heroes is deliberate - this exists to settle how the board feels, not to
 * be a roster. The shapes deliberately match the engine in `src/`
 * (role, attack, maxHealth, and abilities carrying speed / cooldown /
 * targeting) so swapping this file for real engine state is mechanical rather
 * than a rewrite.
 */

import * as I from './icons.jsx';

/** Who an ability may be aimed at. Drives the hover targeting highlight. */
export const TARGET = {
  enemy: 'enemy',
  allEnemies: 'allEnemies',
  ally: 'ally',
  allAllies: 'allAllies',
  self: 'self',
};

export const ROLES = {
  protector: {
    label: 'Protector',
    beats: 'Fighter',
    icon: I.Shield,
    // Literal class strings throughout: Tailwind scans source text, so a
    // template-built class name would simply not be generated.
    border: 'border-[#e0483d]',
    glow: 'shadow-[0_0_26px_-6px_rgba(224,72,61,0.85)]',
    glowStrong: 'shadow-[0_0_38px_-4px_rgba(224,72,61,1)]',
    text: 'text-[#f08a80]',
    chip: 'bg-[#e0483d]/15 text-[#f08a80] ring-1 ring-inset ring-[#e0483d]/40',
    wash: 'from-[#e0483d]/30 via-[#7a2620]/20 to-transparent',
  },
  fighter: {
    label: 'Fighter',
    beats: 'Caster',
    icon: I.Swords,
    border: 'border-[#52a94e]',
    glow: 'shadow-[0_0_26px_-6px_rgba(82,169,78,0.85)]',
    glowStrong: 'shadow-[0_0_38px_-4px_rgba(82,169,78,1)]',
    text: 'text-[#8fd08b]',
    chip: 'bg-[#52a94e]/15 text-[#8fd08b] ring-1 ring-inset ring-[#52a94e]/40',
    wash: 'from-[#52a94e]/30 via-[#2b5a29]/20 to-transparent',
  },
  caster: {
    label: 'Caster',
    beats: 'Protector',
    icon: I.Sparkles,
    border: 'border-[#3f86d4]',
    glow: 'shadow-[0_0_26px_-6px_rgba(63,134,212,0.85)]',
    glowStrong: 'shadow-[0_0_38px_-4px_rgba(63,134,212,1)]',
    text: 'text-[#8cb8e8]',
    chip: 'bg-[#3f86d4]/15 text-[#8cb8e8] ring-1 ring-inset ring-[#3f86d4]/40',
    wash: 'from-[#3f86d4]/30 via-[#1f4570]/20 to-transparent',
  },
};

/** Protector > Fighter > Caster > Protector, at double damage. */
export const COUNTERS = { protector: 'fighter', fighter: 'caster', caster: 'protector' };
export const ROLE_BONUS = 2;

const hero = (h) => ({ ...h, health: h.maxHealth });

export const PLAYER_TEAM = [
  hero({
    id: 'atlas',
    name: 'Atlas',
    title: 'Bearer of the Sky',
    role: 'protector',
    symbol: I.Mountain,
    attack: 7,
    maxHealth: 52,
    /** Drop a real image path here and the frame renders it instead. */
    portrait: null,
    skills: [
      { id: 'shoulder', name: 'Shoulder Sky', icon: I.Shield, speed: 1, cooldown: 0, target: TARGET.self,
        power: 0, shield: 10, text: 'Draw single attacks for a round and shield yourself for 10.' },
      { id: 'backhand', name: 'Backhand', icon: I.Hammer, speed: 5, cooldown: 1, target: TARGET.enemy,
        power: 11, text: 'Deal Attack damage plus 4 to one enemy.' },
      { id: 'heavens', name: 'Bear Heavens', icon: I.Umbrella, speed: 2, cooldown: 3, target: TARGET.allAllies,
        power: 0, shield: 14, text: 'Shield your whole team for 14 and hold the line for 2 rounds.' },
    ],
  }),
  hero({
    id: 'ares',
    name: 'Ares',
    title: 'War Incarnate',
    role: 'fighter',
    symbol: I.Swords,
    attack: 11,
    maxHealth: 36,
    portrait: null,
    skills: [
      { id: 'spear', name: 'Spear Ruin', icon: I.Swords, speed: 4, cooldown: 0, target: TARGET.enemy,
        power: 11, text: "Deal damage equal to this hero's Attack." },
      { id: 'charge', name: 'Charge', icon: I.Wind, speed: 5, cooldown: 1, target: TARGET.allEnemies,
        power: 8, text: 'Deal 75% Attack to the target and its neighbours.' },
      { id: 'sack', name: 'Sack City', icon: I.Flame, speed: 6, cooldown: 2, target: TARGET.enemy,
        power: 23, text: 'Deal Attack damage, plus 12 if the target is under 40% health.' },
    ],
  }),
  hero({
    id: 'zeus',
    name: 'Zeus',
    title: 'Thrower of Bolts',
    role: 'caster',
    symbol: I.Zap,
    attack: 10,
    maxHealth: 28,
    portrait: null,
    skills: [
      { id: 'bolt', name: 'Thunderbolt', icon: I.Zap, speed: 3, cooldown: 0, target: TARGET.enemy,
        power: 11, text: 'Deal 11 damage to one enemy.' },
      { id: 'judgement', name: 'Judgement', icon: I.Scale, speed: 2, cooldown: 2, target: TARGET.enemy,
        power: 6, text: 'Strip all effects from an enemy and inflict 4 a round for 2 rounds.' },
      { id: 'wrath', name: 'Wrath', icon: I.CloudLightning, speed: 7, cooldown: 3, target: TARGET.allEnemies,
        power: 14, text: 'Call down 22 damage on one enemy, or 14 across the field.' },
    ],
  }),
];

export const ENEMY_TEAM = [
  hero({
    id: 'geb',
    name: 'Geb',
    title: 'The Earth Below',
    role: 'protector',
    symbol: I.Shield,
    attack: 7,
    maxHealth: 50,
    portrait: null,
    skills: [
      { id: 'stonewatch', name: 'Stone Watch', icon: I.Shield, speed: 1, cooldown: 0, target: TARGET.self,
        power: 0, shield: 12, text: 'Draw single attacks and negate the next damage taken.' },
      { id: 'quake', name: 'Quake', icon: I.Waves, speed: 4, cooldown: 2, target: TARGET.allEnemies,
        power: 6, drain: true, text: 'Deal 6 to all enemies and recover half the damage dealt.' },
      { id: 'reclaims', name: 'Reclaims', icon: I.Sprout, speed: 2, cooldown: 3, target: TARGET.allAllies,
        power: 0, heal: 10, text: 'Return a fallen ally at 60% health and shield the team for 8.' },
    ],
  }),
  hero({
    id: 'bastet',
    name: 'Bastet',
    title: 'Swift Claw',
    role: 'fighter',
    symbol: I.Cat,
    attack: 10,
    maxHealth: 33,
    portrait: null,
    skills: [
      { id: 'claws', name: 'Quick Claws', icon: I.Cat, speed: 2, cooldown: 0, target: TARGET.enemy,
        power: 8, text: 'Deal 80% Attack damage. Very fast.' },
      { id: 'ninelives', name: 'Nine Lives', icon: I.Heart, speed: 1, cooldown: 3, target: TARGET.self,
        power: 0, shield: 8, text: 'Negate the next damage taken and gain +4 Attack.' },
      { id: 'throat', name: 'Throat', icon: I.Crosshair, speed: 4, cooldown: 2, target: TARGET.enemy,
        power: 16, text: 'Strike the weakest enemy, +16 if it is under 35% health.' },
    ],
  }),
  hero({
    id: 'isis',
    name: 'Isis',
    title: 'Mother of Magic',
    role: 'caster',
    symbol: I.Feather,
    attack: 8,
    maxHealth: 32,
    portrait: null,
    skills: [
      { id: 'mending', name: 'Mending', icon: I.Activity, speed: 2, cooldown: 0, target: TARGET.ally,
        power: 0, heal: 12, text: 'Restore 12 health to one ally.' },
      { id: 'wings', name: 'Wings', icon: I.Feather, speed: 1, cooldown: 2, target: TARGET.allAllies,
        power: 0, heal: 8, text: 'Restore 8 to the team and clear harmful effects.' },
      { id: 'rejoining', name: 'Rejoining', icon: I.Sunrise, speed: 3, cooldown: 4, target: TARGET.allAllies,
        power: 0, heal: 16, text: 'Return a fallen ally at half health.' },
    ],
  }),
];
