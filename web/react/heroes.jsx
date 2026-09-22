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

/**
 * Character art.
 *
 * Drop files into `web/react/art/` and point these at them, e.g.
 * `atlas: 'art/atlas.webp'`. Same-origin files load normally; the remote
 * placeholders below only work on a dev server, because the published page's
 * CSP blocks remote images silently. See web/react/art/README.md.
 */
export const ART = {
  atlas: 'https://picsum.photos/seed/atlas/512/512',
  ares: 'https://picsum.photos/seed/ares/512/512',
  zeus: 'https://picsum.photos/seed/zeus/512/512',
  geb: 'https://picsum.photos/seed/geb/512/512',
  bastet: 'https://picsum.photos/seed/bastet/512/512',
  isis: 'https://picsum.photos/seed/isis/512/512',
};

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
    text: 'text-red-300',
    chip: 'bg-red-950/80 text-red-200 ring-1 ring-inset ring-red-800/70',
    wash: 'from-red-900/90 via-red-900/30 to-transparent',
    rule: 'bg-red-700',
    swatch: 'bg-red-700',
  },
  fighter: {
    label: 'Fighter',
    beats: 'Caster',
    icon: I.Swords,
    text: 'text-emerald-300',
    chip: 'bg-emerald-950/80 text-emerald-200 ring-1 ring-inset ring-emerald-800/70',
    wash: 'from-emerald-900/90 via-emerald-900/30 to-transparent',
    rule: 'bg-emerald-700',
    swatch: 'bg-emerald-700',
  },
  caster: {
    label: 'Caster',
    beats: 'Protector',
    icon: I.Sparkles,
    text: 'text-sky-300',
    chip: 'bg-sky-950/80 text-sky-200 ring-1 ring-inset ring-sky-800/70',
    wash: 'from-sky-900/90 via-sky-900/30 to-transparent',
    rule: 'bg-sky-700',
    swatch: 'bg-sky-700',
  },
};

/** Protector > Fighter > Caster > Protector, at double damage. */
export const COUNTERS = { protector: 'fighter', fighter: 'caster', caster: 'protector' };

/** Plain-language range, for the ability sheet - a phone has no hover. */
export const RANGE_LABEL = {
  enemy: 'One enemy',
  allEnemies: 'All enemies',
  ally: 'One ally',
  allAllies: 'Whole team',
  self: 'Self',
};
export const ROLE_BONUS = 2;

const hero = (h) => ({ ...h, health: h.maxHealth, portrait: ART[h.id] ?? null });

export const PLAYER_TEAM = [
  hero({
    id: 'atlas',
    name: 'Atlas',
    title: 'Bearer of the Sky',
    role: 'protector',
    attack: 7,
    maxHealth: 52,

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
    attack: 11,
    maxHealth: 36,
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
    attack: 10,
    maxHealth: 28,
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
    attack: 7,
    maxHealth: 50,
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
    attack: 10,
    maxHealth: 33,
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
    attack: 8,
    maxHealth: 32,
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
