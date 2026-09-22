/**
 * Balance harness for the React demo.
 *
 * Imports the same `rules.jsx` the board resolves with, so these numbers
 * describe the demo rather than a re-implementation of it. Run with
 * `npm run balance`.
 */

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dir = mkdtempSync(resolve(tmpdir(), 'balance-'));
const entry = resolve(dir, 'entry.mjs');

writeFileSync(entry, `
export * from '${resolve(root, 'web/react/heroes.jsx')}';
export * from '${resolve(root, 'web/react/rules.jsx')}';
`);

const out = resolve(dir, 'bundle.mjs');
await build({
  entryPoints: [entry], bundle: true, format: 'esm', target: 'node22',
  outfile: out, loader: { '.jsx': 'jsx' }, jsx: 'transform',
  jsxFactory: 'h', jsxFragment: 'F', logLevel: 'error',
});

const M = await import(out);
const { PLAYER_TEAM, ENEMY_TEAM, COUNTERS, ROLE_BONUS, TARGET } = M;
const { needsTarget, rangeOf, buildQueue, applyStep, endRound, outcomeOf, strikeDamage } = M;
const { spawn, decideOnHealth } = M;

/** Structured clone would choke on the icon components, so clone by hand. */
const cloneDefs = () => [
  ...PLAYER_TEAM.map((h) => ({ ...h, side: 'player', skills: h.skills.map((s) => ({ ...s })) })),
  ...ENEMY_TEAM.map((h) => ({ ...h, side: 'enemy', skills: h.skills.map((s) => ({ ...s })) })),
];

let PATCH = null;
const seed = () => {
  const defs = cloneDefs();
  if (PATCH) {
    for (const [heroId, skillId, key, value] of PATCH) {
      const skill = defs.find((h) => h.id === heroId)?.skills.find((s) => s.id === skillId);
      if (skill) skill[key] = value;
    }
  }
  return defs.map((h) => spawn(h, h.side));
};

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

/** How close two plays have to score before the policy treats them as equal. */
const GREEDY_EPSILON = 3;

/** Uniformly random legal order. */
function randomOrder(heroes, hero) {
  const ready = hero.skills.filter((s) => (hero.cooldowns[s.id] ?? 0) <= 0);
  if (!ready.length) return null;
  const skill = pick(ready);
  const ids = rangeOf(heroes, hero, skill);
  const pool = heroes.filter((h) => ids.includes(h.id) && h.health > 0);
  return { skillId: skill.id, targetId: needsTarget(skill) && pool.length ? pick(pool).id : null };
}

/**
 * The best single hit any living enemy could land on `victim` next round.
 * Used to price protection, which is otherwise invisible to a policy that
 * only counts damage it deals this turn.
 */
function incomingThreat(heroes, victim) {
  let worst = 0;
  for (const foe of heroes) {
    if (foe.side === victim.side || foe.health <= 0) continue;
    for (const skill of foe.skills) {
      const { amount } = strikeDamage(foe, skill, victim);
      if (amount > worst) worst = amount;
    }
  }
  return worst;
}

/**
 * Greedy: the biggest immediate swing, counting the damage taken back - plus
 * what protecting the party is worth.
 *
 * That last part was missing, and `--trace` showed what it cost. Atlas has a
 * cooldown-0 Attack, so a damage-only policy took it every single round and
 * never once cast his Taunt; Geb's damage abilities both start on cooldown,
 * so the same policy was *forced* to cast his. The enemy Protector walled and
 * the player Protector did not, and the harness reported a 100% enemy win
 * rate that was measuring the policy's blind spot rather than the roster.
 *
 * A human plays Taunt on the round their Caster is about to die, so the
 * policy now prices it that way: what the wall is worth is the damage it
 * redirects off an ally who would otherwise be killed by it.
 */
function greedyOrder(heroes, hero) {
  const ready = hero.skills.filter((s) => (hero.cooldowns[s.id] ?? 0) <= 0);
  if (!ready.length) return null;
  const options = [];

  for (const skill of ready) {
    const ids = rangeOf(heroes, hero, skill);
    const pool = heroes.filter((h) => ids.includes(h.id) && h.health > 0);
    const candidates = needsTarget(skill) ? pool : [null];

    for (const target of candidates) {
      let score = 0;
      const hit = needsTarget(skill) ? [target] : pool;
      for (const t of hit) {
        if (!t) continue;
        const { amount } = strikeDamage(hero, skill, t);
        if (amount > 0) score += Math.min(amount, t.health) + (amount >= t.health ? 18 : 0);
        if (skill.heal) score += Math.min(skill.heal, t.maxHealth - t.health) * 0.85;
        if (skill.shield) score += skill.shield * 0.55;
      }
      // An Attack ability pays for the swing.
      if (skill.isAttack && hit[0]) score -= Math.min(hit[0].attack, hero.health) * 0.9;
      // ...and so does hitting anything with Retaliation up, by any means.
      // Leaving this out was not a small inaccuracy: the harness reported the
      // enemy side winning 100% of skilled matches, and the per-hero table
      // showed 42 of the 142 damage the player team took was self-inflicted,
      // because the policy kept swinging into a taunting Protector carrying
      // Retaliation 8. A policy blind to the strongest defensive keyword in
      // the game is not a skilled policy, and it was measuring the keyword
      // rather than the roster.
      for (const t of hit) {
        if (!t || t.side === hero.side) continue;
        if (t.retaliationRounds > 0 && t.retaliation > 0) {
          score -= Math.min(t.retaliation, hero.health) * 0.9;
        }
      }
      // Protection. Taunt is worth the kill it prevents, not a flat bonus:
      // pulling a lethal hit off a Caster is the whole reason Protectors are
      // in the game, and pulling one off a healthy body is worth little.
      if (skill.taunt && (skill.target === TARGET.self || !needsTarget(skill))) {
        for (const ally of heroes) {
          if (ally.side !== hero.side || ally.id === hero.id || ally.health <= 0) continue;
          const threat = incomingThreat(heroes, ally);
          if (threat >= ally.health) score += Math.min(threat, ally.health) * 0.9;
        }
        // And the wall still has to survive the hits it just invited.
        score -= Math.max(0, incomingThreat(heroes, hero) - hero.shield - (skill.shield ?? 0)) * 0.3;
      }
      if (skill.divineShield && hit[0]) score += incomingThreat(heroes, hit[0]) * 0.7;
      // Buffs last the battle, so they are worth more than their face value.
      if (skill.attackBuff) score += skill.attackBuff * 1.6 * hit.filter(Boolean).length;
      if (skill.healthBuff) score += skill.healthBuff * 1.1 * hit.filter(Boolean).length;
      score -= skill.speed * 0.4;
      options.push({ score, skillId: skill.id, targetId: target ? target.id : null });
    }
  }
  if (!options.length) return null;

  // Break near-ties at random rather than by declaration order.
  //
  // Without this the policy is deterministic, and a deterministic policy
  // against itself in a fixed 3v3 has exactly *one* outcome - so 4000 matches
  // were 4000 copies of the same match and the sweep could only ever report
  // 0% or 100%. Treating choices within a few points of the best as
  // equivalent turns the matchup into a distribution, which is the thing a
  // win rate is supposed to describe. It also models a real player, who does
  // not rank two similar plays to three decimal places.
  const top = Math.max(...options.map((o) => o.score));
  const near = options.filter((o) => o.score >= top - GREEDY_EPSILON);
  const chosen = pick(near);
  return { skillId: chosen.skillId, targetId: chosen.targetId };
}

/** Always takes the biggest hit available, whatever it costs. */
function aggressiveOrder(heroes, hero) {
  const ready = hero.skills.filter((s) => (hero.cooldowns[s.id] ?? 0) <= 0);
  if (!ready.length) return null;
  const options = [];

  for (const skill of ready) {
    const ids = rangeOf(heroes, hero, skill);
    const pool = heroes.filter((h) => ids.includes(h.id) && h.health > 0);
    const candidates = needsTarget(skill) ? pool : [null];
    for (const target of candidates) {
      const hit = needsTarget(skill) ? [target] : pool;
      let score = 0;
      for (const t of hit) {
        if (!t || t.side === hero.side) continue;
        const { amount } = strikeDamage(hero, skill, t);
        score += Math.min(amount, t.health) + (amount >= t.health ? 25 : 0);
      }
      options.push({ score, skillId: skill.id, targetId: target ? target.id : null });
    }
  }
  if (!options.length) return null;
  // Same near-tie randomisation as greedy, for the same reason: otherwise
  // this policy against itself is one match played 4000 times.
  const top = Math.max(...options.map((o) => o.score));
  const chosen = pick(options.filter((o) => o.score >= top - GREEDY_EPSILON));
  return { skillId: chosen.skillId, targetId: chosen.targetId };
}

function playMatch(policyA, policyB, maxRounds = 30) {
  let heroes = seed();
  const damageBy = {};
  const damageTo = {};

  for (let round = 0; round < maxRounds; round++) {
    if (outcomeOf(heroes)) break;
    const orders = {};
    for (const h of heroes) {
      if (h.health <= 0) continue;
      const order = (h.side === 'player' ? policyA : policyB)(heroes, h);
      if (order) orders[h.id] = order;
    }

    const tieSeed = (Math.random() * 0xffffffff) >>> 0;
    for (const step of buildQueue(heroes, orders, tieSeed)) {
      const before = new Map(heroes.map((h) => [h.id, h.health]));
      const { heroes: next } = applyStep(heroes, step);
      for (const h of next) {
        const lost = (before.get(h.id) ?? h.health) - h.health;
        if (lost > 0) {
          damageTo[h.id] = (damageTo[h.id] ?? 0) + lost;
          // Damage the striker takes back counts against it, not for it.
          if (h.id !== step.heroId) damageBy[step.heroId] = (damageBy[step.heroId] ?? 0) + lost;
        }
      }
      heroes = next;
      if (outcomeOf(heroes)) break;
    }

    const ended = endRound(heroes, orders);
    heroes = ended.heroes;
  }

  const clean = outcomeOf(heroes);
  return {
    // A capped-out match is decided on remaining health share, not shrugged off.
    outcome: clean ?? decideOnHealth(heroes),
    cappedOut: !clean,
    heroes, damageBy, damageTo,
  };
}

function run(label, policyA, policyB, n = 4000) {
  const tally = { won: 0, lost: 0, draw: 0 };
  const dmgBy = {}, dmgTo = {}, survived = {};
  let capped = 0;

  for (let i = 0; i < n; i++) {
    const r = playMatch(policyA, policyB);
    tally[r.outcome] += 1;
    if (r.cappedOut) capped += 1;
    for (const [k, v] of Object.entries(r.damageBy)) dmgBy[k] = (dmgBy[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.damageTo)) dmgTo[k] = (dmgTo[k] ?? 0) + v;
    for (const h of r.heroes) if (h.health > 0) survived[h.id] = (survived[h.id] ?? 0) + 1;
  }

  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
  console.log(`\n${label}  (${n} matches)`);
  console.log(`  player wins ${pct(tally.won)}   enemy wins ${pct(tally.lost)}   ` +
    `dead heat ${pct(tally.draw)}   |  hit the 30-round cap ${pct(capped)}`);
  return { n, dmgBy, dmgTo, survived };
}

/**
 * Sweep a handful of knobs looking for a matchup that is actually close.
 *
 * Hand-tuning this overshot twice - 0% then 100% - because with three units a
 * side a single cooldown flips the whole matchup. Searching beats guessing.
 */
/**
 * The knobs, re-picked after `--trace` showed where the matchup actually
 * turns. Two findings drove them. Under skilled play the game is decided by
 * whose Protector gets its wall up, so both walls are here. Under a pure
 * damage race - the aggressive policy, which never defends - it is decided by
 * **speed**: the enemy's opening attacks all land before the player's, so
 * Bastet kills Zeus outright before he has acted twice. Hence the speeds of
 * the three cooldown-0 attacks.
 *
 * The two policies pull in opposite directions, which is the useful part: a
 * knob that fixes one and wrecks the other is not a fix.
 */
const KNOBS = [
  ['ares', 'spear', 'speed', [3, 4]],
  ['atlas', 'backhand', 'speed', [4, 5]],
  ['bastet', 'claws', 'speed', [2, 3]],
  ['geb', 'stonewatch', 'retaliation', [6, 8]],
  ['atlas', 'shoulder', 'shield', [10, 14]],
  ['zeus', 'bolt', 'power', [11, 12]],
];

function winRate(policyA, policyB, n) {
  let won = 0, heat = 0, capped = 0;
  for (let i = 0; i < n; i++) {
    const r = playMatch(policyA, policyB);
    if (r.outcome === 'won') won += 1;
    else if (r.outcome === 'draw') heat += 1;
    if (r.cappedOut) capped += 1;
  }
  return { win: won / n, heat: heat / n, capped: capped / n };
}

/**
 * `--trace` plays one match and prints every pick with its score, the queue,
 * and the board after each round. Summary percentages tell you *that* a side
 * loses; this tells you why, which is the only way to tell a roster problem
 * from a policy problem.
 */
if (process.argv.includes('--trace')) {
  let heroes = seed();
  for (let round = 1; round <= 12 && !outcomeOf(heroes); round++) {
    const orders = {};
    const notes = [];
    for (const h of heroes) {
      if (h.health <= 0) continue;
      const o = greedyOrder(heroes, h);
      if (o) {
        orders[h.id] = o;
        notes.push(`${h.id} -> ${o.skillId}${o.targetId ? '@' + o.targetId : ''}`);
      } else notes.push(`${h.id} -> nothing ready`);
    }
    console.log(`\n--- round ${round} ---`);
    console.log('  picks  ', notes.join('   '));
    for (const step of buildQueue(heroes, orders, (Math.random() * 0xffffffff) >>> 0)) {
      const before = new Map(heroes.map((h) => [h.id, h.health]));
      const { heroes: next } = applyStep(heroes, step);
      heroes = next;
      const delta = heroes.filter((h) => before.get(h.id) !== h.health)
        .map((h) => `${h.id} ${before.get(h.id)}->${h.health}`).join(', ');
      console.log(`  s${step.skill.speed} ${step.heroId.padEnd(7)} ${step.skill.name.padEnd(18)} ${delta || '-'}`);
    }
    ({ heroes } = endRound(heroes, orders));
    console.log('  board  ', heroes.map((h) => `${h.id} ${h.health}/${h.maxHealth}`
      + `${h.shield ? '+' + h.shield : ''}${h.tauntRounds ? ' T' : ''}`
      + `${h.retaliationRounds ? ' R' + h.retaliation : ''}${h.bleedRounds ? ' B' + h.bleed : ''}`).join('  |  '));
  }
  console.log('\noutcome:', outcomeOf(heroes) ?? 'undecided');
  process.exit(0);
}

if (process.argv.includes('--tune')) {
  const combos = KNOBS.reduce(
    (acc, [h, s, k, values]) => acc.flatMap((c) => values.map((v) => [...c, [h, s, k, v]])),
    [[]],
  );
  console.log(`Sweeping ${combos.length} combinations\n`);

  const scored = [];
  for (const combo of combos) {
    PATCH = combo;
    const greedy = winRate(greedyOrder, greedyOrder, 260);
    const random = winRate(randomOrder, randomOrder, 260);
    const aggro = winRate(aggressiveOrder, aggressiveOrder, 260);
    // Close under every policy, and resolving on its own rather than on the cap.
    const cost = Math.abs(greedy.win - 0.5) * 2 + Math.abs(random.win - 0.5)
      + Math.abs(aggro.win - 0.5) + greedy.capped + aggro.capped;
    scored.push({ combo, cost, greedy, random, aggro });
  }
  PATCH = null;

  scored.sort((a, b) => a.cost - b.cost);
  console.log('Closest matchups found');
  for (const r of scored.slice(0, 6)) {
    const desc = r.combo.map(([h, s, k, v]) => `${h}.${s}.${k}=${v}`).join('  ');
    const p = (x) => `${(x * 100).toFixed(0)}%`;
    console.log(`  greedy ${p(r.greedy.win).padStart(4)}  random ${p(r.random.win).padStart(4)}  ` +
      `aggro ${p(r.aggro.win).padStart(4)}  caps ${p(r.greedy.capped).padStart(4)}   ${desc}`);
  }
  console.log('');
  process.exit(0);
}

console.log('='.repeat(64));
console.log('REACT DEMO BALANCE');
console.log('='.repeat(64));

const all = seed();
console.log('\nTeams as written');
for (const side of ['player', 'enemy']) {
  const team = all.filter((h) => h.side === side);
  const hp = team.reduce((a, h) => a + h.maxHealth, 0);
  const atk = team.reduce((a, h) => a + h.attack, 0);
  console.log(`  ${side.padEnd(7)} hp ${String(hp).padStart(3)}  attack ${String(atk).padStart(3)}   ` +
    team.map((h) => `${h.name} ${h.attack}/${h.maxHealth}`).join('  '));
}

/** Damage one use lands on the real opposing team, not a best-case target. */
function oneUse(hero, skill) {
  const foes = all.filter((o) => o.side !== hero.side);
  if (skill.target === TARGET.allEnemies) {
    return foes.reduce((a, f) => a + strikeDamage(hero, skill, f).amount, 0);
  }
  // Single target: take the best legal pick, which is what a player would.
  return Math.max(0, ...foes.map((f) => strikeDamage(hero, skill, f).amount));
}

console.log('\nDamage one use lands on the real opposing team');
for (const h of all) {
  const lines = h.skills.map((s) => `${s.name}=${String(oneUse(h, s)).padStart(3)}${s.isAttack ? '*' : ' '}`);
  const ceiling = h.skills.reduce((a, s) => a + oneUse(h, s), 0);
  console.log(`  ${h.side === 'player' ? 'P' : 'E'} ${h.name.padEnd(7)} ceiling ${String(ceiling).padStart(3)}   ${lines.join('  ')}`);
}
console.log('  (* = Attack keyword: the striker takes the defender\'s Attack back.)');
console.log(`  enemy team total hp ${all.filter((h) => h.side === 'enemy').reduce((a, h) => a + h.maxHealth, 0)}` +
  `, player team total hp ${all.filter((h) => h.side === 'player').reduce((a, h) => a + h.maxHealth, 0)}`);

const rr = run('Both sides random', randomOrder, randomOrder);
const gg = run('Both sides greedy', greedyOrder, greedyOrder);
run('Greedy player vs random enemy', greedyOrder, randomOrder);
run('Random player vs greedy enemy', randomOrder, greedyOrder);
const aa = run('Both sides maximally aggressive', aggressiveOrder, aggressiveOrder);

// Why do matches stall? Shields accumulate and never expire, so a cooldown-0
// self-shield outpacing incoming damage makes a hero permanently unkillable.
// Measure it rather than infer it.
console.log('\nWhy matches stall: shield accrued vs damage taken, aggressive play');
{
  const shields = {}, taken = {}, n = 600;
  for (let i = 0; i < n; i++) {
    const r = playMatch(aggressiveOrder, aggressiveOrder);
    for (const h of r.heroes) shields[h.id] = (shields[h.id] ?? 0) + h.shield;
    for (const [k, v] of Object.entries(r.damageTo)) taken[k] = (taken[k] ?? 0) + v;
  }
  for (const h of all) {
    const shield = (shields[h.id] ?? 0) / n;
    const hit = (taken[h.id] ?? 0) / n;
    const free = h.skills.filter((s) => s.shield && s.cooldown === 0);
    const note = free.length ? `  <- ${free[0].name}: +${free[0].shield} shield, no cooldown` : '';
    console.log(`  ${h.side === 'player' ? 'P' : 'E'} ${h.name.padEnd(7)} ` +
      `unspent shield at cap ${shield.toFixed(0).padStart(4)}   damage taken ${hit.toFixed(0).padStart(3)}` +
      `   hp ${h.maxHealth}${note}`);
  }
}

console.log('\nPer-hero, both sides greedy (per match)');
for (const h of all) {
  const dealt = (gg.dmgBy[h.id] ?? 0) / gg.n;
  const taken = (gg.dmgTo[h.id] ?? 0) / gg.n;
  const live = ((gg.survived[h.id] ?? 0) / gg.n) * 100;
  console.log(`  ${h.side === 'player' ? 'P' : 'E'} ${h.name.padEnd(7)} dealt ${dealt.toFixed(1).padStart(6)}   ` +
    `taken ${taken.toFixed(1).padStart(6)}   survives ${live.toFixed(0).padStart(3)}%`);
}
console.log('');
