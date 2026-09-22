/**
 * The full roster, plus a content validator.
 *
 * `validateRoster` exists because content bugs are silent: an ability that
 * references a missing id, or a speed outside 1-9, will resolve "fine" and
 * quietly distort every balance number downstream. The test suite runs it
 * over the whole roster.
 */

import { ROLES, type MercDef, type Role } from '../types.ts';
import { CASTERS } from './casters.ts';
import { FIGHTERS } from './fighters.ts';
import { PROTECTORS } from './protectors.ts';

export const ROSTER: readonly MercDef[] = [...FIGHTERS, ...CASTERS, ...PROTECTORS];

export { CASTERS, FIGHTERS, PROTECTORS };

const BY_ID = new Map(ROSTER.map((def) => [def.id, def]));

export function mercById(id: string): MercDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`no mercenary with id ${id}`);
  return def;
}

export function mercsByRole(role: Role): MercDef[] {
  return ROSTER.filter((def) => def.role === role);
}

export function mercsByPantheon(pantheon: string): MercDef[] {
  return ROSTER.filter((def) => def.pantheon === pantheon);
}

/** Every pantheon present in the roster, alphabetically. */
export function pantheons(): string[] {
  return [...new Set(ROSTER.map((def) => def.pantheon))].sort();
}

/** Unlock levels the source game used: one ability from the start, then 5 and 15. */
export const EXPECTED_UNLOCK_LEVELS: readonly number[] = [1, 5, 15];

export function validateRoster(roster: readonly MercDef[] = ROSTER): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();

  for (const def of roster) {
    if (seenIds.has(def.id)) problems.push(`duplicate mercenary id: ${def.id}`);
    seenIds.add(def.id);

    if (!ROLES.includes(def.role)) problems.push(`${def.id}: unknown role ${def.role}`);
    if (def.baseAttack < 1) problems.push(`${def.id}: base attack below 1`);
    if (def.baseHealth < 1) problems.push(`${def.id}: base health below 1`);

    const abilityIds = new Set<string>();
    const unlocks: number[] = [];

    for (const ability of def.abilities) {
      if (abilityIds.has(ability.id)) {
        problems.push(`${def.id}: duplicate ability id ${ability.id}`);
      }
      abilityIds.add(ability.id);
      unlocks.push(ability.unlockLevel);

      if (ability.speed < 1 || ability.speed > 9) {
        problems.push(`${def.id}/${ability.id}: speed ${ability.speed} outside 1-9`);
      }
      if (ability.cooldown < 0) {
        problems.push(`${def.id}/${ability.id}: negative cooldown`);
      }
      if (ability.effects.length === 0) {
        problems.push(`${def.id}/${ability.id}: has no effects`);
      }
      if (ability.text.trim() === '') {
        problems.push(`${def.id}/${ability.id}: has no rules text`);
      }

      // An ability that needs a pick must actually consume one, or the player
      // is being asked for a target that changes nothing.
      const needsPick = ability.targeting === 'enemy' || ability.targeting === 'ally';
      const usesPick = ability.effects.some(
        (e) => 'target' in e && (e.target === 'chosen' || e.target === 'chosen-and-adjacent'),
      );
      if (needsPick && !usesPick) {
        problems.push(`${def.id}/${ability.id}: asks for a target but no effect uses it`);
      }
      if (!needsPick && usesPick) {
        problems.push(`${def.id}/${ability.id}: uses a chosen target but asks for none`);
      }
    }

    const sortedUnlocks = [...unlocks].sort((x, y) => x - y);
    if (
      sortedUnlocks.length !== EXPECTED_UNLOCK_LEVELS.length ||
      sortedUnlocks.some((level, i) => level !== EXPECTED_UNLOCK_LEVELS[i])
    ) {
      problems.push(
        `${def.id}: unlock levels [${sortedUnlocks.join(', ')}], expected [${EXPECTED_UNLOCK_LEVELS.join(', ')}]`,
      );
    }

    const equipmentIds = new Set<string>();
    for (const equipment of def.equipment) {
      if (equipmentIds.has(equipment.id)) {
        problems.push(`${def.id}: duplicate equipment id ${equipment.id}`);
      }
      equipmentIds.add(equipment.id);

      if (
        equipment.grantsTo !== undefined &&
        equipment.grantsTo !== 'all' &&
        !abilityIds.has(equipment.grantsTo)
      ) {
        problems.push(
          `${def.id}/${equipment.id}: grants to unknown ability ${equipment.grantsTo}`,
        );
      }
      if (equipment.speedDelta !== undefined && equipment.grantsTo !== undefined) {
        const targets =
          equipment.grantsTo === 'all'
            ? def.abilities
            : def.abilities.filter((a) => a.id === equipment.grantsTo);
        // Speed is clamped to 1, so "1 faster" on a speed-1 ability is a no-op
        // that reads like a real upgrade. Catch it here rather than in play.
        const anyEffect = targets.some(
          (a) => Math.max(1, a.speed + equipment.speedDelta!) !== a.speed,
        );
        if (targets.length > 0 && !anyEffect) {
          problems.push(
            `${def.id}/${equipment.id}: speed delta ${equipment.speedDelta} cannot change ${equipment.grantsTo}`,
          );
        }
      }

      const doesSomething =
        equipment.attackBonus !== undefined ||
        equipment.healthBonus !== undefined ||
        equipment.speedDelta !== undefined ||
        (equipment.grants?.length ?? 0) > 0;
      if (!doesSomething) problems.push(`${def.id}/${equipment.id}: has no effect`);
    }
  }

  return problems;
}
