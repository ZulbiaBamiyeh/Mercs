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
const { needsTarget, rangeOf, buildQueue, applyStep, tickCooldowns, outcomeOf, strikeDamage } = M;

const seed = () => [
  ...PLAYER_TEAM.map((h) => ({ ...h, side: 'player' })),
  ...ENEMY_TEAM.map((h) => ({ ...h, side: 'enemy' })),
].map((h) => ({
  ...h, health: h.maxHealth, shield: 0,
  cooldowns: Object.fromEntries(h.skills.map((s) => [s.id, s.cooldown])),
}));

const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

/** Uniformly random legal order. */
function randomOrder(heroes, hero) {
  const ready = hero.skills.filter((s) => (hero.cooldowns[s.id] ?? 0) <= 0);
  if (!ready.length) return null;
  const skill = pick(ready);
  const ids = rangeOf(heroes, hero, skill);
  const pool = heroes.filter((h) => ids.includes(h.id) && h.health > 0);
  return { skillId: skill.id, targetId: needsTarget(skill) && pool.length ? pick(pool).id : null };
}

/** Greedy: the biggest immediate swing, counting the damage taken back. */
function greedyOrder(heroes, hero) {
  const ready = hero.skills.filter((s) => (hero.cooldowns[s.id] ?? 0) <= 0);
  if (!ready.length) return null;
  let best = null;

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
      score -= skill.speed * 0.4;
      if (!best || score > best.score) {
        best = { score, skillId: skill.id, targetId: target ? target.id : null };
      }
    }
  }
  return best ? { skillId: best.skillId, targetId: best.targetId } : null;
}

/** Always takes the biggest hit available, whatever it costs. */
function aggressiveOrder(heroes, hero) {
  const ready = hero.skills.filter((s) => (hero.cooldowns[s.id] ?? 0) <= 0);
  if (!ready.length) return null;
  let best = null;

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
      if (!best || score > best.score) {
        best = { score, skillId: skill.id, targetId: target ? target.id : null };
      }
    }
  }
  return best ? { skillId: best.skillId, targetId: best.targetId } : null;
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

    for (const step of buildQueue(heroes, orders)) {
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

    heroes = tickCooldowns(heroes, orders);
  }

  return {
    outcome: outcomeOf(heroes) ?? 'draw',
    cappedOut: !outcomeOf(heroes),
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
    `unresolved ${pct(tally.draw)}${capped ? ` (all of it the 30-round cap)` : ''}`);
  return { n, dmgBy, dmgTo, survived };
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
