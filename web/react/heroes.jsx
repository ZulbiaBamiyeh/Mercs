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

/**
 * Mercenaries splits damaging abilities in two, and this is the split.
 *
 * `isAttack` marks the Attack keyword: the striker deals its own Attack stat
 * (plus any `bonus`) and *takes the defender's Attack back in the process*,
 * exactly like minion combat in Hearthstone. That is what makes a defender's
 * Attack stat defensive, and why Attack on a tanky unit is worth anything.
 *
 * Everything else behaves like a spell: it deals its stated `power` and the
 * caster takes nothing back.
 *
 * The role bonus applies to the strike only, not to the damage coming back -
 * a design call, since a symmetric bonus would make trades unreadable.
 */

/** Plain-language range, for the ability sheet - a phone has no hover. */
export const RANGE_LABEL = {
  enemy: 'One enemy',
  allEnemies: 'All enemies',
  ally: 'One ally',
  allAllies: 'Whole team',
  self: 'Self',
};
export const ROLE_BONUS = 2;

const hero = (h) => ({ ...h, portrait: ART[h.id] ?? null });

/**
 * Six units built to docs/mercenaries-reference.md.
 *
 * The structure is faithful - three abilities unlocking at 1 / 5 / 15, a
 * speed and cooldown on each, the Attack keyword carrying mutual damage, and
 * keywords that expire. The numbers are ours: every mercenary database is
 * blocked from this environment, so nothing could be copied. They were tuned
 * with `npm run balance`, not guessed.
 */

export const PLAYER_TEAM = [
  hero({
    id: 'atlas', name: 'Atlas', title: 'Bearer of the Sky', role: 'protector',
    attack: 9, maxHealth: 54,
    skills: [
      { id: 'shoulder', name: 'Shoulder Sky', icon: I.Umbrella, unlock: 1, speed: 1, cooldown: 1,
        target: TARGET.self, shield: 11, shieldRounds: 2, taunt: 2,
        text: 'Gain an 11-point shield for 2 rounds and draw single attacks for 2 rounds.' },
      { id: 'backhand', name: 'Backhand', icon: I.Hammer, unlock: 5, speed: 5, cooldown: 0,
        target: TARGET.enemy, isAttack: true, bonus: 3,
        text: 'Attack an enemy for your Attack plus 3. You take their Attack back.' },
      { id: 'heavens', name: 'Bear Heavens', icon: I.Shield, unlock: 15, speed: 2, cooldown: 3,
        target: TARGET.allAllies, shield: 9, shieldRounds: 2,
        text: 'Give your whole team a 9-point shield for 2 rounds.' },
    ],
  }),
  hero({
    id: 'ares', name: 'Ares', title: 'War Incarnate', role: 'fighter',
    attack: 12, maxHealth: 36,
    skills: [
      { id: 'spear', name: 'Spear Ruin', icon: I.Swords, unlock: 1, speed: 4, cooldown: 0,
        target: TARGET.enemy, isAttack: true,
        text: 'Attack an enemy for your Attack. You take their Attack back.' },
      { id: 'charge', name: 'Reckless Charge', icon: I.Wind, unlock: 5, speed: 6, cooldown: 2,
        target: TARGET.allEnemies, power: 6,
        text: 'Deal 6 damage to every enemy. Takes nothing back.' },
      { id: 'sack', name: 'Sack City', icon: I.Flame, unlock: 15, speed: 7, cooldown: 3,
        target: TARGET.enemy, isAttack: true, bonus: 7, bleed: 3, bleedRounds: 2,
        text: 'Attack an enemy for your Attack plus 7 and leave it bleeding for 3. You take their Attack back.' },
    ],
  }),
  hero({
    id: 'zeus', name: 'Zeus', title: 'Thrower of Bolts', role: 'caster',
    attack: 10, maxHealth: 28,
    skills: [
      { id: 'bolt', name: 'Thunderbolt', icon: I.Zap, unlock: 1, speed: 3, cooldown: 0,
        target: TARGET.enemy, power: 10,
        text: 'Deal 10 damage to one enemy.' },
      { id: 'judgement', name: 'Judgement', icon: I.Scale, unlock: 5, speed: 2, cooldown: 2,
        target: TARGET.enemy, power: 5, bleed: 4, bleedRounds: 2,
        text: 'Deal 5 damage and leave the target bleeding for 4 a round.' },
      { id: 'wrath', name: 'Wrath', icon: I.CloudLightning, unlock: 15, speed: 8, cooldown: 3,
        target: TARGET.allEnemies, power: 7,
        text: 'Call down 7 damage on every enemy.' },
    ],
  }),
];

export const ENEMY_TEAM = [
  hero({
    id: 'geb', name: 'Geb', title: 'The Earth Below', role: 'protector',
    attack: 7, maxHealth: 50,
    skills: [
      { id: 'stonewatch', name: 'Stone Watch', icon: I.Shield, unlock: 1, speed: 1, cooldown: 1,
        target: TARGET.self, taunt: 2, retaliation: 6, retaliationRounds: 2,
        text: 'Draw single attacks for 2 rounds and gain Retaliation 6.' },
      { id: 'quake', name: 'Quake', icon: I.Waves, unlock: 5, speed: 4, cooldown: 2,
        target: TARGET.allEnemies, power: 7, drain: true,
        text: 'Deal 7 damage to every enemy and recover half the damage dealt.' },
      { id: 'reclaims', name: 'Earth Reclaims', icon: I.Sprout, unlock: 15, speed: 2, cooldown: 3,
        target: TARGET.allAllies, heal: 9, shield: 8, shieldRounds: 2,
        text: 'Restore 9 health to your team and give it an 8-point shield for 2 rounds.' },
    ],
  }),
  hero({
    id: 'bastet', name: 'Bastet', title: 'Swift Claw', role: 'fighter',
    attack: 11, maxHealth: 33,
    skills: [
      { id: 'claws', name: 'Quick Claws', icon: I.Cat, unlock: 1, speed: 2, cooldown: 0,
        target: TARGET.enemy, isAttack: true,
        text: 'Attack an enemy for your Attack. Very fast. You take their Attack back.' },
      { id: 'ninelives', name: 'Nine Lives', icon: I.Heart, unlock: 5, speed: 1, cooldown: 3,
        target: TARGET.self, divineShield: true, shield: 8, shieldRounds: 2,
        text: 'Negate the next damage taken and gain an 8-point shield for 2 rounds.' },
      { id: 'throat', name: 'Throat', icon: I.Crosshair, unlock: 15, speed: 4, cooldown: 2,
        target: TARGET.enemy, isAttack: true, bonus: 6,
        text: 'Attack an enemy for your Attack plus 6. You take their Attack back.' },
    ],
  }),
  hero({
    id: 'isis', name: 'Isis', title: 'Mother of Magic', role: 'caster',
    attack: 9, maxHealth: 32,
    skills: [
      { id: 'searing', name: 'Searing Light', icon: I.Sunrise, unlock: 1, speed: 3, cooldown: 0,
        target: TARGET.enemy, power: 10,
        text: 'Deal 10 damage to one enemy.' },
      { id: 'mending', name: 'Mending', icon: I.Activity, unlock: 5, speed: 2, cooldown: 2,
        target: TARGET.ally, heal: 13, cleanse: true,
        text: 'Restore 13 health to one ally and clear its bleeding.' },
      { id: 'wings', name: 'Sheltering Wings', icon: I.Feather, unlock: 15, speed: 1, cooldown: 3,
        target: TARGET.allAllies, heal: 8, shield: 7, shieldRounds: 2,
        text: 'Restore 8 health to your team and give it a 7-point shield for 2 rounds.' },
    ],
  }),
];
