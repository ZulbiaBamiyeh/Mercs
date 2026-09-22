/**
 * High-fantasy tactical board.
 *
 * Card anatomy, deliberately in this order:
 *   1. a strict 1:1 portrait plate - thick iron border, heavy drop shadow, two
 *      stacked <img> layers with object-cover, and a role-coloured gradient
 *      wash across the bottom instead of a glowing outline;
 *   2. stat gems riveted half-in and half-out of the plate's bottom corners,
 *      which is why they live outside the plate's overflow-hidden box;
 *   3. a stone skill tray bolted beneath the plate, wider than it, so skill
 *      names never truncate.
 *
 * React + Tailwind v4 + Framer Motion. React, ReactDOM and Framer Motion are
 * globals (`React`, `ReactDOM`, `Motion`) loaded as UMD bundles.
 */

import * as I from './icons.jsx';
import { PORTRAITS } from './portraits.jsx';
import { PLAYER_TEAM, ENEMY_TEAM, ROLES, COUNTERS, ROLE_BONUS, TARGET } from './heroes.jsx';

const { useState, useMemo, useCallback, useRef, useEffect } = React;
const { motion, AnimatePresence } = Motion;

const SPRING = { type: 'spring', stiffness: 320, damping: 24, mass: 0.7 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = (() => { let i = 0; return () => `fx${i++}`; })();
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/* ---------------------------------------------------------------- *
 * Speed sigil - a small winged plate, the stat that orders the round
 * ---------------------------------------------------------------- */

function Winged({ speed, className = '', textClass = 'text-[11px]' }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} title={`Speed ${speed}`}>
      <svg viewBox="0 0 30 19" className="absolute inset-0 h-full w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
        <path d="M2 9.5 L7 5 L7 14 Z" fill="#9fb6cf" />
        <path d="M28 9.5 L23 5 L23 14 Z" fill="#9fb6cf" />
        <rect x="6" y="1.5" width="18" height="16" rx="4" fill="#111823" stroke="#8fa6c0" strokeWidth="1.5" />
      </svg>
      <span className={`relative font-display font-semibold leading-none text-slate-100 ${textClass}`}>{speed}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- *
 * Stat gems. Riveted over the plate's bottom corners, half out.
 * ---------------------------------------------------------------- */

function AttackGem({ value }) {
  return (
    <div
      className="absolute -bottom-5 -left-3 z-30 grid h-10 w-10 place-items-center rounded-full
                 border-[3px] border-amber-900/90 bg-[radial-gradient(circle_at_34%_28%,#ffe9a8,#e6b23c_46%,#8a6212)]
                 shadow-[0_4px_10px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.65)]"
      title={`${value} attack`}
    >
      <span className="font-display text-[15px] font-bold leading-none text-amber-950">{value}</span>
    </div>
  );
}

function HealthGem({ health, maxHealth }) {
  const frac = Math.max(0, Math.min(1, health / Math.max(1, maxHealth)));
  const hurt = frac <= 0.35;
  return (
    <div
      className={`absolute -bottom-5 -right-3 z-30 grid h-10 w-10 place-items-center rounded-full border-[3px]
                  ${hurt
                    ? 'border-red-950/90 bg-[radial-gradient(circle_at_34%_28%,#ffb3a4,#cf3f30_46%,#6d1c14)]'
                    : 'border-emerald-950/90 bg-[radial-gradient(circle_at_34%_28%,#b6f0c9,#3f9e63_46%,#1a5233)]'}
                  shadow-[0_4px_10px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.5)]`}
      title={`${health} of ${maxHealth} health`}
    >
      <span className="font-display text-[15px] font-bold leading-none text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">
        {health}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Stone skill tray, bolted below the plate
 * ---------------------------------------------------------------- */

/**
 * Two stacked portraits. The remote one is decorative and self-removing: a
 * blocked or missing image otherwise renders its alt text straight over the
 * card, and the published page's CSP blocks remote images silently.
 */
function PortraitStack({ hero, role }) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  return (
    <>
      <img
        src={PORTRAITS[hero.id]}
        alt={`${hero.name}, ${role.label}`}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {hero.portrait && !remoteFailed && (
        <img
          src={hero.portrait}
          alt=""
          aria-hidden="true"
          onError={() => setRemoteFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </>
  );
}

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
      className={`group/skill relative flex min-w-0 flex-1 flex-col items-center justify-start gap-1 rounded-md
                  border px-1 pb-1.5 pt-2.5 transition-colors duration-150
                  ${chosen
                    ? (side === 'player'
                        ? 'border-amber-700/80 bg-amber-950/70 shadow-[inset_0_0_10px_rgba(217,160,58,0.28)]'
                        : 'border-rose-800/80 bg-rose-950/60 shadow-[inset_0_0_10px_rgba(190,70,70,0.28)]')
                    : 'border-slate-700/70 bg-slate-900/70 hover:border-slate-500 hover:bg-slate-800/80'}
                  ${interactive && !locked ? 'cursor-pointer' : 'cursor-default'}
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400`}
    >
      <Winged
        speed={skill.speed}
        className={`pointer-events-none absolute -top-2 left-1/2 z-20 h-[18px] w-[29px] -translate-x-1/2
                    ${locked ? 'opacity-45' : ''}`}
        textClass="text-[10.5px]"
      />

      <Icon
        size={19}
        className={chosen
          ? (side === 'player' ? 'text-amber-200' : 'text-rose-200')
          : locked ? 'text-slate-600' : 'text-slate-300 group-hover/skill:text-white'}
      />
      {/* wraps rather than truncates - the tray is wider than the plate for this */}
      <span
        className={`w-full text-center font-body text-[10px] font-semibold leading-[1.1]
                    ${chosen
                      ? (side === 'player' ? 'text-amber-100' : 'text-rose-100')
                      : locked ? 'text-slate-600' : 'text-slate-400'}`}
      >
        {skill.name}
      </span>

      {locked && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-md bg-slate-950/78">
          <span
            className="grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-slate-500
                       bg-slate-900 font-display text-[12px] font-bold text-slate-200"
            title={`Ready in ${cooldown} round${cooldown === 1 ? '' : 's'}`}
          >
            {cooldown}
          </span>
        </div>
      )}
    </button>
  );
}

function SkillTray({ hero, chosenSkillId, interactive, onPickSkill, onHoverSkill, onLeaveSkill }) {
  return (
    <div className="relative -mx-3 mt-7">
      {/* iron straps, so the tray reads as bolted to the plate above */}
      <div aria-hidden className="pointer-events-none absolute -top-6 left-[22%] h-7 w-[9px] rounded-sm bg-gradient-to-b from-slate-600 to-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />
      <div aria-hidden className="pointer-events-none absolute -top-6 right-[22%] h-7 w-[9px] rounded-sm bg-gradient-to-b from-slate-600 to-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />

      <div
        className="relative flex gap-1 rounded-lg border-4 border-slate-700 bg-[linear-gradient(180deg,#2a3038,#171b21)]
                   p-1 shadow-2xl shadow-black/70"
      >
        {hero.skills.map((skill) => (
          <SkillButton
            key={skill.id}
            skill={skill}
            cooldown={hero.cooldowns[skill.id] ?? 0}
            chosen={chosenSkillId === skill.id}
            side={hero.side}
            interactive={interactive}
            onPick={onPickSkill}
            onHover={(s) => onHoverSkill(hero, s)}
            onLeave={onLeaveSkill}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Unit card
 * ---------------------------------------------------------------- */

function UnitCard({
  hero, chosenSkillId, interactive, inRange, rangeKind, isActing, floaters,
  onPickSkill, onHoverSkill, onLeaveSkill,
}) {
  const role = ROLES[hero.role];
  const dead = hero.health <= 0;

  return (
    <motion.div
      layout
      whileHover={interactive && !dead ? { scale: 1.05, zIndex: 40 } : undefined}
      animate={isActing ? { scale: 1.06, y: -5 } : { scale: 1, y: 0 }}
      transition={SPRING}
      className={`relative w-[clamp(140px,19vw,200px)] shrink-0 ${dead ? 'opacity-45 saturate-0' : ''}`}
    >
      {/* portrait plate: strict square */}
      <div className="relative">
        <div
          className={`relative aspect-square w-full overflow-hidden rounded-xl border-4 border-slate-700
                      bg-slate-900 shadow-2xl shadow-black/70
                      ${isActing ? 'border-amber-500/90' : ''}`}
        >
          <PortraitStack hero={hero} role={role} />

          {/* role identity: a gradient wash up from the bottom, plus a solid rule */}
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t ${role.wash}`} />
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[3px] ${role.rule}`} />
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_2px_14px_rgba(0,0,0,0.55)]" />

          <span
            className={`absolute left-1.5 top-1.5 z-20 rounded px-1.5 py-[2px] font-body text-[9px]
                        font-bold uppercase tracking-[0.12em] ${role.chip}`}
          >
            {role.label}
          </span>

          {hero.shield > 0 && (
            <span
              className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 rounded border border-slate-500/70
                         bg-slate-900/85 px-1.5 py-[2px] font-display text-[11px] font-bold text-slate-100"
              title={`Shielded for ${hero.shield}`}
            >
              <I.Shield size={10} /> {hero.shield}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-1.5 z-20 px-7 text-center">
            <div className="truncate font-display text-[16px] font-semibold leading-tight tracking-wide text-white
                            drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
              {hero.name}
            </div>
            <div className="truncate font-body text-[9.5px] italic leading-tight text-white/65">
              {hero.title}
            </div>
          </div>

          {dead && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/60">
              <I.Skull size={38} className="text-slate-300/80" />
            </div>
          )}

          <AnimatePresence>
            {floaters.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 6, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: [-2, -26, -34, -54], scale: [1.3, 1.05, 1, 0.95] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.35, times: [0, 0.14, 0.62, 1] }}
                className={`pointer-events-none absolute inset-x-0 top-1/2 z-40 text-center font-display font-bold
                            drop-shadow-[0_2px_5px_rgba(0,0,0,1)]
                            ${f.kind === 'heal' ? 'text-[28px] text-emerald-300'
                              : f.kind === 'crit' ? 'text-[34px] text-amber-300'
                              : f.kind === 'word' ? 'text-[15px] uppercase tracking-widest text-slate-100'
                              : 'text-[28px] text-red-300'}`}
              >
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* targeting range - a ring outside the plate, not a glow on it */}
        <AnimatePresence>
          {inRange && !dead && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 1.5, repeat: Infinity } }}
              className={`pointer-events-none absolute -inset-2 z-10 rounded-2xl border-2 border-dashed
                          ${rangeKind === 'hostile' ? 'border-red-400/90' : 'border-emerald-300/90'}`}
            />
          )}
        </AnimatePresence>

        {/* gems overlap the plate's bottom corners, half in and half out */}
        <AttackGem value={hero.attack} />
        <HealthGem health={Math.max(0, hero.health)} maxHealth={hero.maxHealth} />
      </div>

      <SkillTray
        hero={hero}
        chosenSkillId={chosenSkillId}
        interactive={interactive && !dead}
        onPickSkill={onPickSkill}
        onHoverSkill={onHoverSkill}
        onLeaveSkill={onLeaveSkill}
      />
    </motion.div>
  );
}

/* ---------------------------------------------------------------- *
 * Turn order banner
 * ---------------------------------------------------------------- */

function TurnQueue({ queue, activeIndex, heroesById }) {
  return (
    <div className="relative rounded-xl border-4 border-slate-700 bg-[linear-gradient(180deg,#242a31,#14181d)]
                    px-3 py-2.5 shadow-2xl shadow-black/70">
      <div className="pointer-events-none absolute inset-1 rounded-lg border border-amber-700/25" />

      <div className="relative mb-2 flex items-center gap-2">
        <I.Hourglass size={13} className="text-amber-500/80" />
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
          Turn order — fastest first
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="relative py-1 font-body text-[13px] italic text-slate-400">
          Choose a skill for each of your heroes to set the order of battle.
        </div>
      ) : (
        <div className="relative flex flex-wrap items-center gap-1.5">
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
                animate={{ opacity: done ? 0.32 : 1, scale: now ? 1.06 : 1 }}
                transition={SPRING}
                className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1
                            ${mine ? 'border-amber-800/80 bg-amber-950/60' : 'border-rose-900/80 bg-rose-950/50'}
                            ${now ? 'ring-2 ring-amber-300' : ''}`}
              >
                <span className={`font-display text-[10px] font-bold uppercase tracking-wider
                                  ${mine ? 'text-amber-300/85' : 'text-rose-300/85'}`}>
                  {ORDINALS[i] ?? `${i + 1}th`}{tied ? '?' : ''}
                </span>
                <img src={PORTRAITS[hero.id]} alt="" aria-hidden
                     className="h-5 w-5 rounded-full border border-slate-600 object-cover" />
                <span className="font-display text-[12px] font-semibold text-slate-100">{hero.name}</span>
                <Icon size={13} className={mine ? 'text-amber-200/80' : 'text-rose-200/80'} />
                <span className="font-body text-[11.5px] text-slate-300">{step.skill.name}</span>
                <Winged speed={step.skill.speed} className="h-[16px] w-[26px]" textClass="text-[9.5px]" />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Board
 * ---------------------------------------------------------------- */

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
  const [hovered, setHovered] = useState(null);
  const [round, setRound] = useState(1);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const [log, setLog] = useState([]);
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  const heroesById = useMemo(() => Object.fromEntries(heroes.map((h) => [h.id, h])), [heroes]);
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
    // Ascending speed; same-side ties keep team order, so committing a buff
    // before the attack that uses it is a decision rather than a coin flip.
    return steps.sort((a, b) => a.skill.speed - b.skill.speed
      || (a.side === b.side ? 0 : a.side === 'player' ? -1 : 1));
  }, [heroes, selections, intents]);

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
      if (!actor || actor.health <= 0) { await sleep(520); continue; }

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
          if (healed > 0) {
            pushFloater(target.id, `+${healed}`, 'heal');
            lines.push({ text: `${target.name} recovers ${healed}`, kind: 'heal' });
          }
        }
        if (step.skill.shield) {
          target.shield += step.skill.shield;
          pushFloater(target.id, 'warded', 'word');
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
            text: `${actor.name} strikes ${target.name} for ${amount}${bonus ? ' (role bonus)' : ''}`
              + (soaked ? ` — ${soaked} absorbed` : ''),
            kind: 'damage',
          });
          if (target.health === 0) lines.push({ text: `${target.name} falls`, kind: 'death' });
        }
      }

      board = next;
      setHeroes(board);
      await sleep(760);
    }

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

  // 13.5rem a card plus gaps: the stage follows the board rather than leaving
  // three cards adrift in a full-width container.
  const columns = Math.max(players.length, enemies.length);
  const stageMax = `min(100%, ${columns * 14 + (columns - 1) * 2.5 + 3}rem)`;

  const rank = (list, interactive) => (
    <div className="flex flex-wrap items-start justify-center gap-8 py-2 sm:gap-10">
      {list.map((hero) => (
        <UnitCard
          key={hero.id}
          hero={hero}
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

  const banner = (text, tone) => (
    <div className="flex items-center gap-3">
      <span className={`h-px flex-1 bg-gradient-to-r from-transparent ${tone === 'foe' ? 'to-rose-800/70' : 'to-amber-800/70'}`} />
      <span className={`font-display text-[11px] font-semibold uppercase tracking-[0.3em]
                        ${tone === 'foe' ? 'text-rose-300/70' : 'text-amber-300/70'}`}>
        {text}
      </span>
      <span className={`h-px flex-1 bg-gradient-to-l from-transparent ${tone === 'foe' ? 'to-rose-800/70' : 'to-amber-800/70'}`} />
    </div>
  );

  return (
    <div className="relative min-h-full overflow-hidden bg-[#0d0a07] pb-12">
      {/* hall: timber, stone and a warm shaft of light */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(91deg,#1c1409_0px,#241a0c_4px,#160f07_9px,#1f1509_14px)] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_54%_at_50%_40%,rgba(214,166,96,0.24),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_118%_92%_at_50%_50%,transparent_34%,rgba(4,3,2,0.93)_100%)]" />
      </div>

      <div className="relative mx-auto px-4 pt-5" style={{ width: stageMax }}>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-4 border-slate-700
                           bg-[linear-gradient(180deg,#242a31,#14181d)] px-4 py-2.5 shadow-2xl shadow-black/70">
          <h1 className="font-display text-[21px] font-semibold uppercase tracking-[0.18em] text-amber-100">
            Theo<span className="text-amber-500">machy</span>
          </h1>
          <div className="flex items-center gap-4">
            <span className="font-display text-[12px] uppercase tracking-[0.18em] text-slate-400">
              Round <b className="text-amber-200">{round}</b>
            </span>
            {Object.entries(ROLES).map(([key, r]) => (
              <span key={key} className="hidden items-center gap-1.5 sm:flex" title={`${r.label} doubles vs ${r.beats}`}>
                <span className={`h-3 w-3 rounded-sm border border-black/60 ${r.swatch}`} />
                <span className={`font-body text-[11.5px] ${r.text}`}>{r.label}</span>
              </span>
            ))}
          </div>
        </header>

        {banner('The Opposition', 'foe')}
        {rank(enemies, false)}

        <div className="my-5">
          <TurnQueue queue={queue} activeIndex={activeIndex} heroesById={heroesById} />
        </div>

        {rank(players, true)}
        {banner('Your Warband', 'ally')}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-4 border-slate-700
                        bg-[linear-gradient(180deg,#242a31,#14181d)] px-4 py-3 shadow-2xl shadow-black/70">
          <div className="min-w-0 font-body text-[13px] text-slate-300">
            {outcome === 'won' ? <span className="text-emerald-300">The field is yours.</span>
              : outcome === 'lost' ? <span className="text-red-300">Your warband has fallen.</span>
              : resolving ? <span className="text-amber-100">{queue[activeIndex]
                  ? `${heroesById[queue[activeIndex].heroId].name} — ${queue[activeIndex].skill.name}`
                  : 'Resolving…'}</span>
              : hovered ? <span>
                  <b className="font-display text-amber-200">{hovered.skill.name}</b>
                  <span className="text-slate-400"> — {hovered.skill.text}</span>
                </span>
              : <span className="italic text-slate-400">
                  {livePlayers.filter((h) => selections[h.id]).length} of {livePlayers.length} orders given
                </span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg border-2 border-slate-600 bg-slate-800/80 px-3 py-2
                         font-display text-[11px] uppercase tracking-[0.14em] text-slate-300 transition-colors
                         hover:border-slate-400 hover:text-white focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <I.RotateCcw size={13} /> Reset
            </button>

            <motion.button
              type="button"
              onClick={resolveRound}
              disabled={!ready || resolving || Boolean(outcome)}
              whileHover={ready && !resolving && !outcome ? { scale: 1.04 } : undefined}
              whileTap={ready && !resolving && !outcome ? { scale: 0.97 } : undefined}
              transition={SPRING}
              className={`rounded-lg border-4 px-8 py-2.5 font-display text-[16px] font-semibold uppercase
                          tracking-[0.18em] shadow-2xl shadow-black/70 transition-colors
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300
                          ${ready && !resolving && !outcome
                            ? 'border-amber-800 bg-[linear-gradient(180deg,#f0cf7f,#c79327)] text-amber-950'
                            : 'cursor-not-allowed border-slate-700 bg-slate-800/70 text-slate-500'}`}
            >
              {resolving ? 'Resolving' : 'Ready'}
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {log.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden rounded-xl border-4 border-slate-700
                         bg-[linear-gradient(180deg,#20252b,#12161a)] px-4 py-3 shadow-2xl shadow-black/70"
            >
              <div className="mb-1.5 font-display text-[10px] uppercase tracking-[0.22em] text-amber-200/60">
                Round {log[0].round}
              </div>
              <ul className="space-y-0.5 font-body text-[12.5px] leading-relaxed">
                {log[0].lines.map((line, i) => (
                  <li key={i} className={
                    line.kind === 'damage' ? 'text-red-300/90'
                      : line.kind === 'death' ? 'font-semibold text-red-400'
                      : line.kind === 'heal' ? 'text-emerald-300/90'
                      : line.kind === 'theirs' ? 'text-rose-200'
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
