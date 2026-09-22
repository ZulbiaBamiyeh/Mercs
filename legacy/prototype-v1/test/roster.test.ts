/** Content tests. These guard the data, not the rules. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ROSTER,
  mercById,
  mercsByRole,
  mercsByPantheon,
  pantheons,
  validateRoster,
} from '../src/data/roster.ts';
import { createMerc } from '../src/battle.ts';
import { attackAtLevel, healthAtLevel, MAX_LEVEL, ROLES } from '../src/types.ts';

describe('roster integrity', () => {
  test('the whole roster validates', () => {
    const problems = validateRoster();
    assert.deepEqual(problems, [], `content problems:\n${problems.join('\n')}`);
  });

  test('every role has an equal share', () => {
    const counts = ROLES.map((role) => mercsByRole(role).length);
    assert.equal(new Set(counts).size, 1, `uneven role split: ${counts.join('/')}`);
    assert.ok(counts[0]! >= 8, 'each role needs enough gods for real party variety');
  });

  test('pantheons are a usable synergy axis', () => {
    const all = pantheons();
    assert.ok(all.length >= 6, `expected several pantheons, got ${all.join(', ')}`);
    // A pantheon nobody can build around is decoration, not a mechanic.
    const buildable = all.filter((p) => mercsByPantheon(p).length >= 3);
    assert.ok(buildable.length >= 3, 'at least a few pantheons should support a themed party');
  });

  test('lookup by id round-trips and rejects unknown ids', () => {
    for (const def of ROSTER) assert.equal(mercById(def.id).name, def.name);
    assert.throws(() => mercById('no-such-god'), /no mercenary/);
  });
});

describe('stat scaling', () => {
  test('stats rise with level and hit their level-30 targets', () => {
    for (const def of ROSTER) {
      const low = attackAtLevel(def, 1);
      const high = attackAtLevel(def, MAX_LEVEL);
      assert.ok(high > low, `${def.id}: attack does not grow`);
      assert.ok(healthAtLevel(def, MAX_LEVEL) > healthAtLevel(def, 1), `${def.id}: health does not grow`);
      assert.ok(low >= 1, `${def.id}: level-1 attack below 1`);
    }
  });

  test('roles sit in the expected stat bands at level 30', () => {
    const band = (role: Parameters<typeof mercsByRole>[0]) =>
      mercsByRole(role).map((d) => ({ atk: attackAtLevel(d, 30), hp: healthAtLevel(d, 30) }));

    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const protectors = band('protector');
    const casters = band('caster');
    const fighters = band('fighter');

    assert.ok(
      avg(protectors.map((s) => s.hp)) > avg(fighters.map((s) => s.hp)),
      'protectors should out-last fighters',
    );
    assert.ok(
      avg(fighters.map((s) => s.hp)) > avg(casters.map((s) => s.hp)),
      'fighters should out-last casters',
    );
    assert.ok(
      avg(fighters.map((s) => s.atk)) > avg(protectors.map((s) => s.atk)),
      'fighters should out-hit protectors',
    );
  });
});

describe('ability unlocks', () => {
  test('a level-1 god has exactly one ability, a level-30 god has three', () => {
    for (const def of ROSTER) {
      assert.equal(createMerc({ def, level: 1 }).abilities.length, 1, `${def.id} at level 1`);
      assert.equal(createMerc({ def, level: 5 }).abilities.length, 2, `${def.id} at level 5`);
      assert.equal(createMerc({ def, level: 30 }).abilities.length, 3, `${def.id} at level 30`);
    }
  });

  test('every god has a usable opening move', () => {
    for (const def of ROSTER) {
      const merc = createMerc({ def, level: 30 });
      const ready = merc.abilities.filter((a) => (merc.cooldowns[a.id] ?? 0) <= 0);
      assert.ok(ready.length > 0, `${def.id} cannot act on round one`);
    }
  });
});

describe('equipment', () => {
  test('every equipment option applies without error and does something', () => {
    for (const def of ROSTER) {
      const bare = createMerc({ def, level: 30 });
      for (const equipment of def.equipment) {
        const kitted = createMerc({ def, level: 30, equippedId: equipment.id });
        const changed =
          kitted.attack !== bare.attack ||
          kitted.maxHealth !== bare.maxHealth ||
          JSON.stringify(kitted.abilities) !== JSON.stringify(bare.abilities);
        assert.ok(changed, `${def.id}/${equipment.id} changed nothing`);
      }
    }
  });

  test('an unknown equipment id is rejected', () => {
    assert.throws(() => createMerc({ def: ROSTER[0]!, equippedId: 'not-a-thing' }), /no equipment/);
  });

  test('equipment never drives a stat below one', () => {
    for (const def of ROSTER) {
      for (const equipment of def.equipment) {
        const merc = createMerc({ def, level: 1, equippedId: equipment.id });
        assert.ok(merc.attack >= 1, `${def.id}/${equipment.id}: attack ${merc.attack} at level 1`);
        assert.ok(merc.maxHealth >= 1, `${def.id}/${equipment.id}: health ${merc.maxHealth} at level 1`);
      }
    }
  });
});
