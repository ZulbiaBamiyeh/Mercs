/**
 * Authoring helpers for content.
 *
 * Mercenaries are written with their level-30 stats, because that is the
 * number a designer actually reasons about when balancing; the level-1 base
 * and per-level growth are derived. Keep this file boring - it exists so the
 * roster reads like a card list.
 */

import type {
  Ability,
  DamageSpec,
  Effect,
  Equipment,
  MercDef,
  Role,
  Selector,
  Status,
} from '../types.ts';

/** Fraction of a merc's level-30 stats it starts with at level 1. */
const LEVEL_1_FRACTION = 0.34;

export interface MercSpec {
  id: string;
  name: string;
  role: Role;
  pantheon: string;
  /** Stats at level 30, the balancing reference point. */
  attack30: number;
  health30: number;
  abilities: Ability[];
  equipment?: Equipment[];
}

export function mercDef(spec: MercSpec): MercDef {
  const baseAttack = Math.max(1, Math.round(spec.attack30 * LEVEL_1_FRACTION));
  const baseHealth = Math.max(1, Math.round(spec.health30 * LEVEL_1_FRACTION));

  return {
    id: spec.id,
    name: spec.name,
    role: spec.role,
    pantheon: spec.pantheon,
    baseAttack,
    baseHealth,
    attackGrowth: (spec.attack30 - baseAttack) / 29,
    healthGrowth: (spec.health30 - baseHealth) / 29,
    abilities: spec.abilities,
    equipment: spec.equipment ?? [],
  };
}

// --- damage shorthands ------------------------------------------------------

/** Flat damage. */
export const flat = (amount: number): DamageSpec => ({ flat: amount });
/** Damage as a multiple of the caster's attack. A plain swing is `swing(1)`. */
export const swing = (multiplier: number): DamageSpec => ({ attackScale: multiplier });
/** Attack-scaled damage plus a flat bonus. */
export const swingPlus = (multiplier: number, bonus: number): DamageSpec => ({
  attackScale: multiplier,
  flat: bonus,
});

// --- effect shorthands ------------------------------------------------------

export const damage = (target: Selector, dmg: DamageSpec): Effect => ({
  kind: 'damage',
  target,
  damage: dmg,
});

export const heal = (target: Selector, amount: number): Effect => ({
  kind: 'heal',
  target,
  amount,
});

export const status = (
  target: Selector,
  kind: Status['kind'],
  magnitude: number,
  remaining: number,
): Effect => ({
  kind: 'apply-status',
  target,
  status: { kind, magnitude, remaining },
});

export const buff = (target: Selector, amount: number, rounds = Infinity): Effect =>
  status(target, 'attack-buff', amount, rounds);

export const shield = (target: Selector, amount: number, rounds = 2): Effect =>
  status(target, 'shield', amount, rounds);

export const poison = (target: Selector, perRound: number, rounds = 2): Effect =>
  status(target, 'dot', perRound, rounds);

export const stun = (target: Selector, rounds = 1): Effect => status(target, 'stun', 0, rounds);

export const taunt = (target: Selector, rounds = 1): Effect => status(target, 'taunt', 0, rounds);
