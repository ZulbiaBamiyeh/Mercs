/**
 * Test fixtures.
 *
 * The resolver tests use purpose-built gods rather than roster entries, so a
 * balance change to the roster can never turn a mechanics test red. Roster
 * content has its own test file.
 */

import { mercDef } from '../src/data/authoring.ts';
import type { Ability, MercDef, Role } from '../src/types.ts';

let counter = 0;

/** A single-ability god with exactly the stats a test needs. */
export function dummy(options: {
  role: Role;
  attack?: number;
  health?: number;
  abilities: Ability[];
  name?: string;
  pantheon?: string;
}): MercDef {
  counter += 1;
  return mercDef({
    id: `dummy-${counter}`,
    name: options.name ?? `Dummy ${counter}`,
    role: options.role,
    pantheon: options.pantheon ?? 'Test',
    attack30: options.attack ?? 10,
    health30: options.health ?? 100,
    abilities: options.abilities,
  });
}

/** An ability with sensible defaults, so tests state only what they care about. */
export function testAbility(options: Partial<Ability> & Pick<Ability, 'id' | 'effects'>): Ability {
  return {
    name: options.name ?? options.id,
    speed: options.speed ?? 5,
    cooldown: options.cooldown ?? 0,
    unlockLevel: options.unlockLevel ?? 1,
    targeting: options.targeting ?? 'enemy',
    text: options.text ?? 'test ability',
    ...options,
  };
}

/** A god whose stats are exactly `attack` / `health` at level 30. */
export function statBlock(role: Role, attack: number, health: number, abilities: Ability[]): MercDef {
  const def = dummy({ role, attack, health, abilities });
  // Pin level-30 stats exactly rather than relying on the growth curve, so
  // damage assertions can use round numbers.
  return { ...def, baseAttack: attack, baseHealth: health, attackGrowth: 0, healthGrowth: 0 };
}
