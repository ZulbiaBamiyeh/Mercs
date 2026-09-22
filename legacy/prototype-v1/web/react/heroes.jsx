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

/**
 * Stat gems are **role-coloured**, which the reference is explicit about: the
 * attack icon and the health drop both take their colour from the role
 * (Caster blue, Fighter green, Protector red) rather than a global
 * attack-is-gold / health-is-green scheme. The attack icon also changes shape
 * per role - an orb for a Caster, a bladed orb for a Fighter, a shield for a
 * Protector - so a glance at the corner tells you the matchup.
 */
export const GEMS = {
  protector: {
    attack: 'bg-[radial-gradient(circle_at_34%_26%,#ff9a86,#c9382a_50%,#5f150f)] border-red-950/90',
    health: 'bg-[radial-gradient(circle_at_34%_26%,#ff9a86,#b82f22_50%,#54120d)] border-red-950/90',
  },
  fighter: {
    attack: 'bg-[radial-gradient(circle_at_34%_26%,#a6f0b4,#2f8f4c_50%,#124a28)] border-emerald-950/90',
    health: 'bg-[radial-gradient(circle_at_34%_26%,#a6f0b4,#2a8446_50%,#0f4426)] border-emerald-950/90',
  },
  caster: {
    attack: 'bg-[radial-gradient(circle_at_34%_26%,#b3b6ff,#3d3fc4_50%,#191a63)] border-indigo-950/90',
    health: 'bg-[radial-gradient(circle_at_34%_26%,#b3b6ff,#3436b4_50%,#15165a)] border-indigo-950/90',
  },
};

const hero = (h) => ({ ...h, portrait: ART[h.id] ?? null });

/**
 * Six units built to docs/mercenaries-reference.md.
 *
 * The numbers are now calibrated against real level-~22 mercenaries, which
 * corrects the one thing the demo had structurally wrong. Real Mercenaries
 * keeps the **Attack stat small and role-shaped** (Protectors and Fighters
 * 7-8, Casters 3-4) while **ability damage runs 2-4x higher** (8-20). Ours
 * had Attack and ability power at roughly the same size, which flattened the
 * whole role triangle: a Caster with Attack 10 punished anyone who Attacked
 * it, so nobody ever did.
 *
 * With Attack 4 on a Caster, Attacking one is nearly free - which is exactly
 * why Fighters hunt them, why Protectors carry Taunt to intercept, and why
 * swinging into a Protector's Attack 8 is a bad trade. Cooldowns cap at 2,
 * the highest the reference shows.
 *
 * Abilities carry a **school** tag, as the real cards do, drawn from the
 * god's domain. Plain weapon work has none, matching Fighters whose Attack
 * abilities show no school footer.
 *
 * Values were then re-tuned with `npm run balance`, not guessed.
 */

export const PLAYER_TEAM = [
  hero({
    id: 'atlas', name: 'Atlas', title: 'Bearer of the Sky', role: 'protector',
    attack: 8, maxHealth: 58,
    skills: [
      { id: 'shoulder', name: 'Shoulder the Sky', icon: I.Umbrella, unlock: 1, speed: 1, cooldown: 1,
        school: 'Sky', target: TARGET.self, shield: 14, shieldRounds: 2, taunt: 2,
        text: 'Gain a 14-point shield for 2 rounds and Taunt for 2 rounds.' },
      { id: 'backhand', name: 'Backhand', icon: I.Hammer, unlock: 5, speed: 5, cooldown: 0,
        target: TARGET.enemy, isAttack: true, bonus: 4,
        text: 'Gain +4 Attack this turn and Attack an enemy.' },
      { id: 'heavens', name: 'Bear the Heavens', icon: I.Shield, unlock: 15, speed: 2, cooldown: 2,
        school: 'Sky', target: TARGET.allAllies, heal: 12, attackBuff: 3,
        text: 'Restore 12 Health to your party and give it +3 Attack.' },
    ],
  }),
  hero({
    id: 'ares', name: 'Ares', title: 'War Incarnate', role: 'fighter',
    attack: 11, maxHealth: 44,
    skills: [
      { id: 'spear', name: 'Spear of Ruin', icon: I.Swords, unlock: 1, speed: 3, cooldown: 0,
        target: TARGET.enemy, isAttack: true,
        text: 'Attack an enemy.' },
      { id: 'charge', name: 'Reckless Charge', icon: I.Wind, unlock: 5, speed: 6, cooldown: 2,
        school: 'War', target: TARGET.allEnemies, power: 8,
        text: 'Deal 8 damage to all enemies.' },
      { id: 'sack', name: 'Sack the City', icon: I.Flame, unlock: 15, speed: 7, cooldown: 2,
        target: TARGET.enemy, isAttack: true, bonus: 8, bleed: 4, bleedRounds: 2,
        text: 'Gain +8 Attack this turn and Attack an enemy. Leave it Bleeding 4.' },
    ],
  }),
  hero({
    id: 'zeus', name: 'Zeus', title: 'Thrower of Bolts', role: 'caster',
    attack: 4, maxHealth: 40,
    skills: [
      { id: 'bolt', name: 'Thunderbolt', icon: I.Zap, unlock: 1, speed: 3, cooldown: 0,
        school: 'Storm', target: TARGET.enemy, power: 12,
        text: 'Deal 12 damage.' },
      { id: 'judgement', name: 'Judgement', icon: I.Scale, unlock: 5, speed: 2, cooldown: 2,
        school: 'Storm', target: TARGET.enemy, power: 6, bleed: 5, bleedRounds: 2,
        text: 'Deal 6 damage and leave the target Bleeding 5.' },
      { id: 'wrath', name: 'Wrath of Olympus', icon: I.CloudLightning, unlock: 15, speed: 8, cooldown: 2,
        school: 'Storm', target: TARGET.allEnemies, power: 9,
        text: 'Deal 9 damage to all enemies.' },
    ],
  }),
];

export const ENEMY_TEAM = [
  hero({
    id: 'geb', name: 'Geb', title: 'The Earth Below', role: 'protector',
    attack: 8, maxHealth: 58,
    skills: [
      { id: 'stonewatch', name: 'Stone Watch', icon: I.Shield, unlock: 1, speed: 1, cooldown: 1,
        school: 'Earth', target: TARGET.self, taunt: 2, retaliation: 8, retaliationRounds: 2,
        text: 'Gain Taunt for 2 rounds and Retaliation 8.' },
      { id: 'quake', name: 'Quake', icon: I.Waves, unlock: 5, speed: 4, cooldown: 2,
        school: 'Earth', target: TARGET.allEnemies, power: 8, drain: true,
        text: 'Deal 8 damage to all enemies. Restore half the damage dealt to this god.' },
      { id: 'reclaims', name: 'Earth Reclaims', icon: I.Sprout, unlock: 15, speed: 2, cooldown: 2,
        school: 'Earth', target: TARGET.allAllies, heal: 12, shield: 10, shieldRounds: 2,
        text: 'Restore 12 Health to your party and give it a 10-point shield for 2 rounds.' },
    ],
  }),
  hero({
    id: 'bastet', name: 'Bastet', title: 'Swift Claw', role: 'fighter',
    attack: 11, maxHealth: 42,
    skills: [
      { id: 'claws', name: 'Quick Claws', icon: I.Cat, unlock: 1, speed: 3, cooldown: 0,
        target: TARGET.enemy, isAttack: true,
        text: 'Attack an enemy.' },
      { id: 'ninelives', name: 'Nine Lives', icon: I.Heart, unlock: 5, speed: 1, cooldown: 2,
        school: 'Beast', target: TARGET.self, divineShield: true, shield: 10, shieldRounds: 2,
        text: 'Gain Divine Shield and a 10-point shield for 2 rounds.' },
      { id: 'throat', name: 'For the Throat', icon: I.Crosshair, unlock: 15, speed: 4, cooldown: 2,
        target: TARGET.enemy, isAttack: true, bonus: 7,
        text: 'Gain +7 Attack this turn and Attack an enemy.' },
    ],
  }),
  hero({
    id: 'isis', name: 'Isis', title: 'Mother of Magic', role: 'caster',
    attack: 4, maxHealth: 40,
    skills: [
      { id: 'searing', name: 'Searing Light', icon: I.Sunrise, unlock: 1, speed: 3, cooldown: 0,
        school: 'Light', target: TARGET.enemy, power: 12,
        text: 'Deal 12 damage.' },
      { id: 'mending', name: 'Mending Word', icon: I.Activity, unlock: 5, speed: 2, cooldown: 2,
        school: 'Light', target: TARGET.ally, heal: 16, cleanse: true,
        text: 'Restore 16 Health to a friendly god and clear its Bleeding.' },
      { id: 'wings', name: 'Sheltering Wings', icon: I.Feather, unlock: 15, speed: 1, cooldown: 2,
        school: 'Light', target: TARGET.allAllies, heal: 10, attackBuff: 4,
        text: 'Restore 10 Health to your party and give it +4 Attack.' },
    ],
  }),
];
