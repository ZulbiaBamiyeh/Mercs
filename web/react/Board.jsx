/**
 * Mercenaries-style battle board.
 *
 * Square unit frames with a permanently attached three-skill dock, a speed
 * queue between the ranks, and a mock resolution so the board can be felt
 * rather than just looked at.
 *
 * React + Tailwind v4 + Framer Motion. React, ReactDOM and Framer Motion come
 * from globals (`React`, `Motion`) because the published page loads them as
 * UMD bundles; everything else is compiled in.
 */

import * as I from './icons.jsx';
import { PLAYER_TEAM, ENEMY_TEAM, ROLES, COUNTERS, ROLE_BONUS, TARGET } from './heroes.jsx';

const { useState, useMemo, useCallback, useRef, useEffect } = React;
const { motion, AnimatePresence } = Motion;

const SPRING = { type: 'spring', stiffness: 320, damping: 24, mass: 0.7 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = (() => { let i = 0; return () => `fx${i++}`; })();
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/* ------------------------------------------------------------------ *
 * Speed badge - a small winged lozenge, the way Mercenaries marks the
 * stat that decides resolution order.
 * ------------------------------------------------------------------ */

function Winged({ speed, className = '', textClass = 'text-[11px]' }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} title={`Speed ${speed}`}>
      <svg viewBox="0 0 30 19" className="absolute inset-0 h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        <path d="M2 9.5 L7 5.5 L7 13.5 Z" fill="#6aa6e8" opacity="0.95" />
        <path d="M28 9.5 L23 5.5 L23 13.5 Z" fill="#6aa6e8" opacity="0.95" />
        <rect x="6" y="1.5" width="18" height="16" rx="5" fill="#123456" stroke="#5f9fe0" strokeWidth="1.4" />
      </svg>
      <span className={`relative font-mono font-semibold leading-none text-[#cfe4fa] ${textClass}`}>{speed}</span>
    </span>
  );
}

function SpeedBadge({ speed, dim = false }) {
  return (
    <Winged
      speed={speed}
      className={`pointer-events-none absolute -top-1.5 -right-1.5 z-20 h-[19px] w-[30px] ${dim ? 'opacity-45' : ''}`}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Stat badges - attack bottom-left in gold, health bottom-right with a
 * ring that shows the proportion a bare number cannot.
 * ------------------------------------------------------------------ */

function AttackBadge({ value }) {
  return (
    <div
      className="absolute bottom-1.5 left-1.5 z-20 grid h-9 w-9 place-items-center rounded-full
                 border-2 border-[#f0d071] bg-gradient-to-b from-[#e8bb45] to-[#a9821c]
                 shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
      title={`${value} attack`}
    >
      <span className="font-mono text-[14px] font-bold leading-none text-[#2a1e05]">{value}</span>
    </div>
  );
}

function HealthBadge({ health, maxHealth }) {
  const frac = Math.max(0, Math.min(1, health / Math.max(1, maxHealth)));
  const hurt = frac <= 0.35;
  const C = 2 * Math.PI * 15.5;

  return (
    <div className="absolute bottom-1.5 right-1.5 z-20 h-9 w-9" title={`${health} of ${maxHealth} health`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#0b0f14" strokeWidth="4.5" />
        <motion.circle
          cx="18" cy="18" r="15.5" fill="none" strokeWidth="4.5" strokeLinecap="round"
          stroke={hurt ? '#e8503c' : '#4aa96c'}
          strokeDasharray={C}
          animate={{ strokeDashoffset: C * (1 - frac) }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.3, 1] }}
        />
      </svg>
      <div
        className={`absolute inset-[4.5px] grid place-items-center rounded-full border
                    ${hurt ? 'border-[#f08a7a] bg-gradient-to-b from-[#d9453a] to-[#8e2a22]'
                           : 'border-[#7fd6a1] bg-gradient-to-b from-[#48a86a] to-[#256b41]'}`}
      >
        <span className="font-mono text-[12px] font-bold leading-none text-white">{health}</span>
        <span className="font-mono text-[7px] leading-none text-white/70">/{maxHealth}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The permanent skill dock
 * ------------------------------------------------------------------ */

function SkillButton({ skill, cooldown, chosen, side, interactive, onPick, onHover, onLeave }) {
  const Icon = skill.icon;
  const locked = cooldown > 0;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => interactive && !locked && onPick(skill)}
      onMouseEnter={() => onHover(skill)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(skill)}
      onBlur={onLeave}
      title={`${skill.name} — speed ${skill.speed}${skill.cooldown ? `, cooldown ${skill.cooldown}` : ''}\n${skill.text}`}
      className={`group/skill relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px]
                  border-r border-white/10 px-1 py-[7px] last:border-r-0
                  transition-colors duration-150
                  ${chosen
                    ? (side === 'player'
                        ? 'bg-amber-300/20 ring-1 ring-inset ring-amber-300/70'
                        : 'bg-cyan-300/20 ring-1 ring-inset ring-cyan-300/70')
                    : 'bg-white/[0.035] hover:bg-white/[0.11]'}
                  ${interactive && !locked ? 'cursor-pointer' : 'cursor-default'}
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400`}
    >
      <SpeedBadge speed={skill.speed} dim={locked} />

      <Icon
        size={17}
        className={chosen
          ? (side === 'player' ? 'text-amber-200' : 'text-cyan-200')
          : locked ? 'text-slate-500' : 'text-slate-200 group-hover/skill:text-white'}
      />
      <span
        className={`w-full truncate text-center text-[7.5px] font-medium uppercase leading-none tracking-[0.06em]
                    ${chosen
                      ? (side === 'player' ? 'text-amber-200/90' : 'text-cyan-200/90')
                      : locked ? 'text-slate-500' : 'text-slate-400'}`}
      >
        {skill.name}
      </span>

      {locked && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/72 backdrop-blur-[1px]">
          <span
            className="grid h-[21px] w-[21px] place-items-center rounded-full border border-slate-400/70
                       bg-slate-900/90 font-mono text-[11px] font-semibold text-slate-200"
            title={`Ready in ${cooldown} round${cooldown === 1 ? '' : 's'}`}
          >
            {cooldown}
          </span>
        </div>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Unit card
 * ------------------------------------------------------------------ */

function Portrait({ hero }) {
  const role = ROLES[hero.role];
  const Symbol = hero.symbol;

  if (hero.portrait) {
    return <img src={hero.portrait} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  }
  // Procedural stand-in until real art lands: a role-washed field behind the
  // hero's own symbol, so every frame reads as deliberate rather than empty.
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${role.wash} bg-slate-800`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.14),transparent_62%)]" />
      <Symbol size={82} strokeWidth={1.1} className="absolute inset-0 m-auto text-white/25" />
    </div>
  );
}

function UnitCard({
  hero, cooldowns, chosenSkillId, interactive, inRange, rangeKind,
  isActing, floaters, onPickSkill, onHoverSkill, onLeaveSkill,
}) {
  const role = ROLES[hero.role];
  const dead = hero.health <= 0;

  return (
    <motion.div
      layout
      whileHover={interactive && !dead ? { scale: 1.05, zIndex: 30 } : undefined}
      animate={isActing ? { scale: 1.06, y: -4 } : { scale: 1, y: 0 }}
      transition={SPRING}
      className={`relative w-[clamp(124px,17.5vw,176px)] shrink-0 ${dead ? 'opacity-40 saturate-0' : ''}`}
    >
      {/* targeting range halo */}
      <AnimatePresence>
        {inRange && !dead && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: [0.45, 1, 0.45], scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ opacity: { duration: 1.5, repeat: Infinity }, scale: SPRING }}
            className={`pointer-events-none absolute -inset-[5px] z-0 rounded-[15px] border-2
                        ${rangeKind === 'hostile'
                          ? 'border-rose-400 shadow-[0_0_26px_-2px_rgba(251,113,133,0.75)]'
                          : 'border-emerald-300 shadow-[0_0_26px_-2px_rgba(110,231,183,0.7)]'}`}
          />
        )}
      </AnimatePresence>

      <div
        className={`relative overflow-hidden rounded-xl border-2 bg-slate-900
                    ${role.border} ${isActing ? role.glowStrong : role.glow}`}
      >
        {/* square hero frame */}
        <div className="relative aspect-square w-full">
          <Portrait hero={hero} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/92 via-slate-950/18 to-transparent" />

          <span
            className={`absolute left-1.5 top-1.5 z-20 rounded-md px-1.5 py-[2px] font-mono text-[8px]
                        font-semibold uppercase tracking-[0.1em] backdrop-blur-sm ${role.chip}`}
          >
            {role.label}
          </span>

          {hero.shield > 0 && (
            <span
              className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 rounded-md bg-sky-400/20 px-1.5
                         py-[2px] font-mono text-[9px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-300/50
                         backdrop-blur-sm"
              title={`Shielded for ${hero.shield}`}
            >
              <I.Shield size={9} /> {hero.shield}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-[42px] z-10 px-2 text-center">
            <div className="truncate font-display text-[15px] leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              {hero.name}
            </div>
            <div className="truncate font-mono text-[7.5px] uppercase tracking-[0.11em] text-white/55">
              {hero.title}
            </div>
          </div>

          <AttackBadge value={hero.attack} />
          <HealthBadge health={Math.max(0, hero.health)} maxHealth={hero.maxHealth} />

          {dead && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/55">
              <I.Skull size={34} className="text-slate-300/80" />
            </div>
          )}

          {/* floating damage and healing */}
          <AnimatePresence>
            {floaters.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 6, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: [-2, -26, -34, -52], scale: [1.25, 1.05, 1, 0.95] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.35, times: [0, 0.14, 0.62, 1] }}
                className={`pointer-events-none absolute inset-x-0 top-1/2 z-40 text-center font-mono font-bold
                            drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)]
                            ${f.kind === 'heal' ? 'text-[26px] text-emerald-300'
                              : f.kind === 'crit' ? 'text-[32px] text-amber-300'
                              : f.kind === 'word' ? 'text-[14px] uppercase tracking-widest text-sky-200'
                              : 'text-[26px] text-rose-300'}`}
              >
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* permanent 3-skill dock, welded to the frame's bottom edge */}
        <div className="flex border-t-2 border-white/10 bg-slate-950/75">
          {hero.skills.map((skill) => (
            <SkillButton
              key={skill.id}
              skill={skill}
              cooldown={cooldowns[skill.id] ?? 0}
              chosen={chosenSkillId === skill.id}
              side={hero.side}
              interactive={interactive && !dead}
              onPick={onPickSkill}
              onHover={(s) => onHoverSkill(hero, s)}
              onLeave={onLeaveSkill}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Speed queue
 * ------------------------------------------------------------------ */

function TurnQueue({ queue, activeIndex, heroesById }) {
  return (
    <div
      className="relative rounded-xl border border-white/12 bg-white/[0.045] px-3 py-2.5
                 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md"
    >
      <div className="mb-2 flex items-center gap-2">
        <I.Hourglass size={12} className="text-slate-400" />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-400">
          Turn order — fastest first
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="py-1 font-mono text-[11px] text-slate-500">
          Pick a skill on each of your heroes to build the order.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {queue.map((step, i) => {
            const hero = heroesById[step.heroId];
            const Icon = step.skill.icon;
            const mine = hero.side === 'player';
            const done = activeIndex > i;
            const now = activeIndex === i;
            const tied = queue.some((o, j) => j !== i && o.skill.speed === step.skill.speed
              && heroesById[o.heroId].side !== hero.side);

            return (
              <motion.div
                key={`${step.heroId}:${step.skill.id}`}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: done ? 0.33 : 1, scale: now ? 1.06 : 1 }}
                transition={SPRING}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1
                            ${mine ? 'border-amber-300/40 bg-amber-300/10' : 'border-cyan-300/35 bg-cyan-300/10'}
                            ${now ? 'ring-2 ring-white/80' : ''}`}
              >
                <span className={`font-mono text-[9px] font-semibold uppercase tracking-wider
                                  ${mine ? 'text-amber-200/80' : 'text-cyan-200/80'}`}>
                  {ORDINALS[i] ?? `${i + 1}th`}{tied ? '?' : ''}
                </span>
                <Icon size={13} className={mine ? 'text-amber-100' : 'text-cyan-100'} />
                <span className="text-[11px] font-medium text-slate-100">{hero.name}</span>
                <span className="font-mono text-[10px] text-slate-400">{step.skill.name}</span>
                <Winged speed={step.skill.speed} className="h-[16px] w-[26px]" textClass="text-[9.5px]" />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */

const seedHeroes = () => [
  ...PLAYER_TEAM.map((h) => ({ ...h, side: 'player' })),
  ...ENEMY_TEAM.map((h) => ({ ...h, side: 'enemy' })),
].map((h) => ({
  ...h,
  health: h.maxHealth,
  shield: 0,
  // Skills with a cooldown start spent, so round one is the narrowest round.
  cooldowns: Object.fromEntries(h.skills.map((s) => [s.id, s.cooldown])),
}));

function pickIntents(heroes) {
  const intents = {};
  for (const h of heroes) {
    if (h.side !== 'enemy' || h.health <= 0) continue;
    const ready = h.skills.filter((s) => (h.cooldowns[s.id] ?? 0) <= 0);
    if (ready.length) intents[h.id] = ready[Math.floor(Math.random() * ready.length)].id;
  }
  return intents;
}

export default function Board() {
  const [heroes, setHeroes] = useState(seedHeroes);
  const [selections, setSelections] = useState({});
  const [intents, setIntents] = useState(() => pickIntents(seedHeroes()));
  const [hovered, setHovered] = useState(null);      // { heroId, skill }
  const [round, setRound] = useState(1);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const [log, setLog] = useState([]);
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  const heroesById = useMemo(
    () => Object.fromEntries(heroes.map((h) => [h.id, h])), [heroes]);

  const players = heroes.filter((h) => h.side === 'player');
  const enemies = heroes.filter((h) => h.side === 'enemy');
  const livePlayers = players.filter((h) => h.health > 0);
  const liveEnemies = enemies.filter((h) => h.health > 0);

  const skillOf = (hero, id) => hero.skills.find((s) => s.id === id);

  const queue = useMemo(() => {
    const steps = [];
    for (const h of heroes) {
      if (h.health <= 0) continue;
      const id = h.side === 'player' ? selections[h.id] : intents[h.id];
      if (!id) continue;
      const skill = skillOf(h, id);
      if (skill) steps.push({ heroId: h.id, skill, side: h.side });
    }
    // Ascending speed. Same-side ties keep team order, which is why a buff
    // before an attack is a decision rather than a coin flip.
    return steps.sort((a, b) => a.skill.speed - b.skill.speed
      || (a.side === b.side ? 0 : a.side === 'player' ? -1 : 1));
  }, [heroes, selections, intents]);

  /** Everything a skill could be aimed at, for the hover highlight. */
  const rangeOf = useCallback((hero, skill) => {
    if (!hero || !skill) return { ids: [], kind: 'friendly' };
    const allies = (hero.side === 'player' ? livePlayers : liveEnemies).map((h) => h.id);
    const foes = (hero.side === 'player' ? liveEnemies : livePlayers).map((h) => h.id);
    switch (skill.target) {
      case TARGET.self: return { ids: [hero.id], kind: 'friendly' };
      case TARGET.ally:
      case TARGET.allAllies: return { ids: allies, kind: 'friendly' };
      default: return { ids: foes, kind: 'hostile' };
    }
  }, [livePlayers, liveEnemies]);

  const highlight = useMemo(() => {
    if (!hovered) return { ids: [], kind: 'friendly' };
    return rangeOf(heroesById[hovered.heroId], hovered.skill);
  }, [hovered, heroesById, rangeOf]);

  const pushFloater = (heroId, text, kind) => {
    const id = uid();
    setFloaters((f) => [...f, { id, heroId, text, kind }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1400);
  };

  const ready = livePlayers.length > 0 && livePlayers.every((h) => selections[h.id]);

  async function resolveRound() {
    if (!ready || resolving) return;
    setResolving(true);
    setHovered(null);
    const lines = [];

    let board = heroes;
    for (let i = 0; i < queue.length; i++) {
      if (cancelled.current) return;
      const step = queue[i];
      setActiveIndex(i);

      const actor = board.find((h) => h.id === step.heroId);
      if (!actor || actor.health <= 0) {
        lines.push({ text: `${step.heroId} is defeated before acting`, kind: 'denied' });
        await sleep(520);
        continue;
      }

      const { ids } = rangeOf(actor, step.skill);
      const pool = board.filter((h) => ids.includes(h.id) && h.health > 0);
      const single = step.skill.target === TARGET.enemy || step.skill.target === TARGET.ally;
      const targets = single
        ? [[...pool].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]].filter(Boolean)
        : pool;

      lines.push({
        text: `${actor.name} — ${step.skill.name} (speed ${step.skill.speed})`,
        kind: actor.side === 'player' ? 'mine' : 'theirs',
      });
      await sleep(620);

      const next = board.map((h) => ({ ...h }));
      for (const t of targets) {
        const target = next.find((x) => x.id === t.id);
        if (!target) continue;

        if (step.skill.heal) {
          const healed = Math.min(step.skill.heal, target.maxHealth - target.health);
          target.health += healed;
          if (healed > 0) { pushFloater(target.id, `+${healed}`, 'heal'); lines.push({ text: `${target.name} recovers ${healed}`, kind: 'heal' }); }
        }
        if (step.skill.shield) {
          target.shield += step.skill.shield;
          pushFloater(target.id, 'shield', 'word');
        }
        if (step.skill.power > 0) {
          const bonus = COUNTERS[actor.role] === target.role;
          let amount = bonus ? step.skill.power * ROLE_BONUS : step.skill.power;
          const soaked = Math.min(target.shield, amount);
          target.shield -= soaked;
          amount -= soaked;
          target.health = Math.max(0, target.health - amount);
          pushFloater(target.id, `-${amount}${bonus ? ' ×2' : ''}`, bonus ? 'crit' : 'dmg');
          lines.push({
            text: `${actor.name} hits ${target.name} for ${amount}${bonus ? ' (role bonus)' : ''}`
              + (soaked ? ` — ${soaked} absorbed` : ''),
            kind: 'damage',
          });
          if (target.health === 0) lines.push({ text: `${target.name} is defeated`, kind: 'death' });
        }
      }

      board = next;
      setHeroes(board);
      await sleep(760);
    }

    // End of round: cooldowns tick, the spent skill goes on cooldown.
    const ticked = board.map((h) => {
      const used = h.side === 'player' ? selections[h.id] : intents[h.id];
      const cooldowns = { ...h.cooldowns };
      for (const key of Object.keys(cooldowns)) cooldowns[key] = Math.max(0, cooldowns[key] - 1);
      if (used) {
        const skill = skillOf(h, used);
        if (skill?.cooldown) cooldowns[used] = skill.cooldown;
      }
      return { ...h, cooldowns };
    });

    setHeroes(ticked);
    setActiveIndex(-1);
    setSelections({});
    setIntents(pickIntents(ticked));
    setRound((r) => r + 1);
    setLog((l) => [{ round, lines }, ...l].slice(0, 8));
    setResolving(false);
  }

  const reset = () => {
    const fresh = seedHeroes();
    setHeroes(fresh);
    setSelections({});
    setIntents(pickIntents(fresh));
    setRound(1);
    setActiveIndex(-1);
    setFloaters([]);
    setLog([]);
    setResolving(false);
  };

  const outcome = liveEnemies.length === 0 ? 'won' : livePlayers.length === 0 ? 'lost' : null;

  // 11rem per card, 1rem gaps, 3rem of breathing room.
  const columns = Math.max(players.length, enemies.length);
  const stageMax = `min(100%, ${columns * 12 + (columns - 1) + 3}rem)`;

  const rank = (list, interactive) => (
    <div className="flex flex-wrap items-start justify-center gap-3 py-1.5 sm:gap-4">
      {list.map((hero) => (
        <UnitCard
          key={hero.id}
          hero={hero}
          cooldowns={hero.cooldowns}
          chosenSkillId={hero.side === 'player' ? selections[hero.id] : intents[hero.id]}
          interactive={interactive && !resolving && !outcome}
          inRange={highlight.ids.includes(hero.id)}
          rangeKind={highlight.kind}
          isActing={activeIndex >= 0 && queue[activeIndex]?.heroId === hero.id}
          floaters={floaters.filter((f) => f.heroId === hero.id)}
          onPickSkill={(skill) => setSelections((s) => ({ ...s, [hero.id]: skill.id }))}
          onHoverSkill={(h, skill) => setHovered({ heroId: h.id, skill })}
          onLeaveSkill={() => setHovered(null)}
        />
      ))}
    </div>
  );

  return (
    <div className="relative min-h-full overflow-hidden bg-[#0a0e13] pb-10">
      {/* wood grain and radial spotlight */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(94deg,#1a130c_0px,#221809_3px,#160f08_7px,#1d1509_11px)] opacity-[0.55]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_78%_58%_at_50%_44%,rgba(96,132,168,0.30),transparent_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_50%,transparent_38%,rgba(5,8,12,0.88)_100%)]" />
      </div>

      <div className="relative mx-auto px-4 pt-4" style={{ width: stageMax }}>
        {/* header */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10
                           bg-white/[0.04] px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-[19px] uppercase tracking-[0.13em] text-white">
              Theo<span className="text-teal-300">machy</span>
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Battle board</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>round <b className="text-slate-100">{round}</b></span>
            {Object.entries(ROLES).map(([key, r]) => (
              <span key={key} className="hidden items-center gap-1.5 sm:flex" title={`${r.label} doubles vs ${r.beats}`}>
                <span className={`h-2.5 w-2.5 rounded-full border-2 ${r.border}`} />
                <span className={r.text}>{r.label}</span>
              </span>
            ))}
          </div>
        </header>

        <section className="mb-1.5 flex items-center gap-2">
          <I.Target size={11} className="text-cyan-300/70" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-cyan-300/70">Opposition</span>
        </section>
        {rank(enemies, false)}

        <div className="my-4">
          <TurnQueue queue={queue} activeIndex={activeIndex} heroesById={heroesById} />
        </div>

        {rank(players, true)}
        <section className="mt-2.5 flex items-center gap-2">
          <I.CircleDot size={11} className="text-amber-300/70" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-amber-300/70">Your team</span>
        </section>

        {/* controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10
                        bg-white/[0.04] px-4 py-3 backdrop-blur-md">
          <div className="min-w-0 font-mono text-[11px] text-slate-400">
            {outcome === 'won' ? <span className="text-emerald-300">The field is yours.</span>
              : outcome === 'lost' ? <span className="text-rose-300">Your team has fallen.</span>
              : resolving ? <span className="text-slate-200">{queue[activeIndex]
                  ? `${heroesById[queue[activeIndex].heroId].name} — ${queue[activeIndex].skill.name}`
                  : 'Resolving…'}</span>
              : hovered ? <span className="text-sky-300">
                  {heroesById[hovered.heroId]?.name} · {hovered.skill.name} — {hovered.skill.text}
                </span>
              : `${livePlayers.filter((h) => selections[h.id]).length} of ${livePlayers.length} skills chosen`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2
                         font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-300
                         transition-colors hover:bg-white/[0.12] focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <I.RotateCcw size={12} /> Reset
            </button>

            <motion.button
              type="button"
              onClick={resolveRound}
              disabled={!ready || resolving || Boolean(outcome)}
              whileHover={ready && !resolving && !outcome ? { scale: 1.04 } : undefined}
              whileTap={ready && !resolving && !outcome ? { scale: 0.97 } : undefined}
              transition={SPRING}
              className={`rounded-lg border px-7 py-2.5 font-display text-[15px] uppercase
                          tracking-[0.12em] transition-colors focus-visible:outline-none
                          focus-visible:ring-2 focus-visible:ring-sky-300
                          ${ready && !resolving && !outcome
                            ? 'border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 shadow-[0_0_26px_-6px_rgba(251,191,36,0.9)]'
                            : 'cursor-not-allowed border-white/10 bg-white/[0.05] text-slate-500'}`}
            >
              {resolving ? 'Resolving' : 'Ready'}
            </motion.button>
          </div>
        </div>

        {/* last round, kept short on purpose */}
        <AnimatePresence>
          {log.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md"
            >
              <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">
                Round {log[0].round}
              </div>
              <ul className="space-y-0.5 font-mono text-[10.5px] leading-relaxed">
                {log[0].lines.map((line, i) => (
                  <li key={i} className={
                    line.kind === 'damage' ? 'text-rose-300/90'
                      : line.kind === 'death' ? 'font-semibold text-rose-400'
                      : line.kind === 'heal' ? 'text-emerald-300/90'
                      : line.kind === 'theirs' ? 'text-cyan-200'
                      : line.kind === 'mine' ? 'text-amber-200'
                      : 'text-slate-400'
                  }>{line.text}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
