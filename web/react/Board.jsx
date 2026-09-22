/**
 * High-fantasy tactical board, built for a phone in portrait first.
 *
 * The layout decision that makes it fit: abilities are not on the board. Tap a
 * hero and a sheet rises with its three abilities in full - name, speed,
 * cooldown, range and rules text, none of it truncated. Tapping an enemy opens
 * the same sheet read-only, with the ability it has chosen marked. That is how
 * Mercenaries does it, and it buys back the vertical space three permanent
 * skill docks were eating.
 *
 * What stays on the board is only what you read at a glance: the portrait, the
 * two stat gems, the chosen ability, and the turn order.
 *
 * React + Tailwind v4 + Framer Motion, as globals (`React`, `Motion`).
 */

import * as I from './icons.jsx';
import { PORTRAITS } from './portraits.jsx';
import {
  PLAYER_TEAM, ENEMY_TEAM, ROLES, COUNTERS, ROLE_BONUS, TARGET, RANGE_LABEL,
} from './heroes.jsx';

const { useState, useMemo, useCallback, useRef, useEffect } = React;
const { motion, AnimatePresence } = Motion;

const SPRING = { type: 'spring', stiffness: 320, damping: 26, mass: 0.7 };
const SHEET_SPRING = { type: 'spring', stiffness: 380, damping: 34 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = (() => { let i = 0; return () => `fx${i++}`; })();
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/** Literal classes only - Tailwind scans source text, not runtime strings. */
const RANK_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-3', 6: 'grid-cols-3' };

/** An ability needs a target unless it is aimed at its own caster or the field. */
const needsTarget = (skill) => skill.target === TARGET.enemy || skill.target === TARGET.ally;

/** Damage a strike would land, role bonus included. */
function strikeDamage(actor, skill, target) {
  const base = skill.isAttack ? actor.attack + (skill.bonus ?? 0) : (skill.power ?? 0);
  if (base <= 0) return { amount: 0, bonus: false };
  const bonus = Boolean(target) && COUNTERS[actor.role] === target.role;
  return { amount: bonus ? base * ROLE_BONUS : base, bonus };
}

/* ---------------------------------------------------------------- */

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

/**
 * Two stacked portraits. The overlay carries no alt and removes itself on
 * error: a blocked or missing image otherwise paints its alt text across the
 * card, and the published page's CSP blocks remote images silently.
 */
function PortraitStack({ hero, role }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <img src={PORTRAITS[hero.id]} alt={`${hero.name}, ${role.label}`}
           className="absolute inset-0 h-full w-full object-cover" />
      {hero.portrait && !failed && (
        <img src={hero.portrait} alt="" aria-hidden="true" onError={() => setFailed(true)}
             className="absolute inset-0 h-full w-full object-cover" />
      )}
    </>
  );
}

/* ---------------------------------------------------------------- *
 * Unit tile - portrait, two gems, chosen ability. Nothing else.
 * ---------------------------------------------------------------- */

function UnitTile({
  hero, chosenSkill, isActing, isOpen, floaters, onOpen,
  targeting, isTargetable, isCaster, targetTone,
}) {
  const role = ROLES[hero.role];
  const dead = hero.health <= 0;
  const frac = Math.max(0, Math.min(1, hero.health / Math.max(1, hero.maxHealth)));
  const hurt = frac <= 0.35;
  const Chosen = chosenSkill?.icon;

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(hero)}
      animate={isActing ? { scale: 1.06, y: -4 } : { scale: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      aria-label={`${hero.name}, ${role.label}, ${hero.health} of ${hero.maxHealth} health`}
      className={`relative block w-full text-left focus-visible:outline-none
                  ${dead ? 'opacity-45 saturate-0' : ''}
                  ${targeting && !isTargetable && !isCaster ? 'opacity-35 grayscale' : ''}`}
    >
      {/* While choosing a target, a legal one pulses and wears a crosshair. */}
      <AnimatePresence>
        {isTargetable && (
          <motion.span
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={SPRING}
            className={`pointer-events-none absolute -inset-1.5 z-30 rounded-2xl border-[3px]
                        ${targetTone === 'hostile'
                          ? 'border-red-400 shadow-[0_0_24px_rgba(248,113,113,0.6)]'
                          : 'border-emerald-300 shadow-[0_0_24px_rgba(110,231,183,0.55)]'}`}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isTargetable && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: [1, 1.14, 1] }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ scale: { duration: 1.3, repeat: Infinity }, opacity: { duration: 0.15 } }}
            className={`pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2
                        rounded-full border-2 p-1.5
                        ${targetTone === 'hostile'
                          ? 'border-red-300 bg-red-950/80 text-red-200'
                          : 'border-emerald-300 bg-emerald-950/80 text-emerald-200'}`}
          >
            <I.Crosshair size={22} />
          </motion.span>
        )}
      </AnimatePresence>
      {isCaster && targeting && (
        <span className="pointer-events-none absolute -top-2 left-1/2 z-40 -translate-x-1/2 rounded
                         border-2 border-amber-400 bg-amber-950 px-1.5 py-[1px] font-display text-[9px]
                         font-bold uppercase tracking-wider text-amber-200">
          Casting
        </span>
      )}
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-xl border-[3px] bg-slate-900
                    shadow-xl shadow-black/70 transition-colors
                    ${isActing || isCaster ? 'border-amber-500'
                      : isOpen ? 'border-amber-300' : 'border-slate-700'}`}
      >
        <PortraitStack hero={hero} role={role} />

        {/* role reads as a wash from the bottom plus a solid rule, not a glow */}
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t ${role.wash}`} />
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[3px] ${role.rule}`} />

        {hero.shield > 0 && (
          <span className="absolute left-1 top-1 z-20 flex items-center gap-0.5 rounded border border-slate-500/70
                           bg-slate-900/85 px-1 py-[1px] font-display text-[10px] font-bold text-slate-100">
            <I.Shield size={9} /> {hero.shield}
          </span>
        )}

        {/* the committed ability, so every order is visible without opening anything */}
        {Chosen && !dead && (
          <span
            className={`absolute right-1 top-1 z-20 grid h-7 w-7 place-items-center rounded-full border-2
                        ${hero.side === 'player'
                          ? 'border-amber-500 bg-amber-950/90 text-amber-200'
                          : 'border-rose-600 bg-rose-950/90 text-rose-200'}`}
            title={`${chosenSkill.name} — speed ${chosenSkill.speed}`}
          >
            <Chosen size={14} />
          </span>
        )}

        <div className="absolute inset-x-0 bottom-6 z-20 px-1 text-center">
          <div className="truncate font-display text-[13px] font-semibold leading-tight text-white
                          drop-shadow-[0_2px_3px_rgba(0,0,0,1)] sm:text-[15px]">
            {hero.name}
          </div>
        </div>

        {dead && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/60">
            <I.Skull size={30} className="text-slate-300/80" />
          </div>
        )}

        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 6, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: [-2, -22, -30, -48], scale: [1.3, 1.05, 1, 0.95] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, times: [0, 0.14, 0.62, 1] }}
              className={`pointer-events-none absolute inset-x-0 top-1/2 z-40 text-center font-display font-bold
                          drop-shadow-[0_2px_5px_rgba(0,0,0,1)]
                          ${f.kind === 'heal' ? 'text-[24px] text-emerald-300'
                            : f.kind === 'crit' ? 'text-[29px] text-amber-300'
                            : f.kind === 'word' ? 'text-[12px] uppercase tracking-widest text-slate-100'
                            : 'text-[24px] text-red-300'}`}
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* gems straddle the plate's bottom corners, half in and half out */}
      <span
        className="absolute -bottom-3 left-1 z-30 grid h-8 w-8 place-items-center rounded-full border-2
                   border-amber-900/90 bg-[radial-gradient(circle_at_34%_28%,#ffe9a8,#e6b23c_46%,#8a6212)]
                   shadow-[0_3px_8px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.6)]"
      >
        <span className="font-display text-[13px] font-bold leading-none text-amber-950">{hero.attack}</span>
      </span>
      <span
        className={`absolute -bottom-3 right-1 z-30 grid h-8 w-8 place-items-center rounded-full border-2
                    ${hurt
                      ? 'border-red-950/90 bg-[radial-gradient(circle_at_34%_28%,#ffb3a4,#cf3f30_46%,#6d1c14)]'
                      : 'border-emerald-950/90 bg-[radial-gradient(circle_at_34%_28%,#b6f0c9,#3f9e63_46%,#1a5233)]'}
                    shadow-[0_3px_8px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.5)]`}
      >
        <span className="font-display text-[13px] font-bold leading-none text-white">{Math.max(0, hero.health)}</span>
      </span>
    </motion.button>
  );
}

/* ---------------------------------------------------------------- *
 * Turn order - one scrollable line
 * ---------------------------------------------------------------- */

function TurnStrip({ queue, activeIndex, heroesById }) {
  if (queue.length === 0) {
    return (
      <div className="flex h-[38px] shrink-0 items-center justify-center rounded-lg border-2 border-slate-800
                      bg-slate-950/50 px-3 font-body text-[12px] italic text-slate-500">
        Tap a hero to choose an ability
      </div>
    );
  }
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-1.5 overflow-x-auto rounded-lg border-2 border-slate-800
                    bg-slate-950/50 px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {queue.map((step, i) => {
        const hero = heroesById[step.heroId];
        const mine = hero.side === 'player';
        const done = activeIndex > i;
        const now = activeIndex === i;
        const tied = queue.some((o, j) => j !== i && o.skill.speed === step.skill.speed
          && heroesById[o.heroId].side !== hero.side);
        return (
          <motion.div
            key={`${step.heroId}:${step.skill.id}`}
            layout
            animate={{ opacity: done ? 0.3 : 1, scale: now ? 1.07 : 1 }}
            transition={SPRING}
            title={`${hero.name} — ${step.skill.name} (speed ${step.skill.speed})`}
            className={`flex shrink-0 items-center gap-1 rounded-md border px-1 py-0.5
                        ${mine ? 'border-amber-800/80 bg-amber-950/60' : 'border-rose-900/80 bg-rose-950/50'}
                        ${now ? 'ring-2 ring-amber-300' : ''}`}
          >
            <span className={`font-display text-[9px] font-bold uppercase ${mine ? 'text-amber-300/85' : 'text-rose-300/85'}`}>
              {ORDINALS[i] ?? `${i + 1}th`}{tied ? '?' : ''}
            </span>
            <img src={PORTRAITS[hero.id]} alt="" aria-hidden
                 className="h-5 w-5 rounded-full border border-slate-600 object-cover" />
            <Winged speed={step.skill.speed} className="h-[15px] w-[24px]" textClass="text-[9px]" />
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Ability sheet - the whole reason the board is this small
 * ---------------------------------------------------------------- */

function AbilityRow({ skill, cooldown, chosen, readOnly, hero, onPick }) {
  const Icon = skill.icon;
  const locked = cooldown > 0;
  const pickable = !readOnly && !locked;

  return (
    <button
      type="button"
      disabled={!pickable}
      onClick={() => pickable && onPick(skill)}
      className={`relative flex w-full items-start gap-3 rounded-lg border-2 px-3 py-2.5 text-left
                  transition-colors
                  ${chosen
                    ? 'border-amber-600 bg-amber-950/60'
                    : locked ? 'border-slate-800 bg-slate-950/60'
                    : 'border-slate-700 bg-slate-900/70 active:bg-slate-800'}
                  ${pickable ? 'cursor-pointer' : 'cursor-default'}
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
    >
      <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2
                        ${chosen ? 'border-amber-600 bg-amber-900/50 text-amber-200'
                          : locked ? 'border-slate-800 bg-slate-900 text-slate-600'
                          : 'border-slate-700 bg-slate-800 text-slate-200'}`}>
        <Icon size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`font-display text-[15px] font-semibold ${locked ? 'text-slate-500' : 'text-slate-50'}`}>
            {skill.name}
          </span>
          <Winged speed={skill.speed} className="h-[17px] w-[27px]" textClass="text-[10px]" />
          <span className="font-body text-[11px] uppercase tracking-wider text-slate-500">
            {RANGE_LABEL[skill.target]}
          </span>
        </span>
        {/* full text, never truncated - this is why abilities left the board */}
        <span className={`mt-1 block font-body text-[13px] leading-snug ${locked ? 'text-slate-600' : 'text-slate-300'}`}>
          {skill.text}
        </span>
        {/* An Attack trades damage both ways, so say what it costs to swing. */}
        {skill.isAttack && (
          <span className="mt-1 flex items-center gap-1.5 font-body text-[11.5px] text-amber-200/80">
            <I.Swords size={12} />
            Strikes for {hero.attack + (skill.bonus ?? 0)} — and takes the defender's Attack back
          </span>
        )}
      </span>

      <span className="ml-1 shrink-0 self-center text-right">
        {locked ? (
          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-slate-600 bg-slate-900
                           font-display text-[12px] font-bold text-slate-300"
                title={`Ready in ${cooldown} round${cooldown === 1 ? '' : 's'}`}>
            {cooldown}
          </span>
        ) : chosen ? (
          <span className="font-display text-[10px] font-bold uppercase tracking-wider text-amber-300">
            {readOnly ? 'Chosen' : 'Set'}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function AbilitySheet({ hero, chosenSkillId, readOnly, onPick, onClose }) {
  const role = ROLES[hero.role];
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/70"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={SHEET_SPRING}
        role="dialog"
        aria-label={`${hero.name} abilities`}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl rounded-t-2xl border-t-4 border-x-4
                   border-slate-700 bg-[linear-gradient(180deg,#232a31,#12161a)] shadow-2xl shadow-black/90"
      >
        <div className="flex items-center gap-3 border-b-2 border-slate-800 px-4 py-3">
          <img src={hero.portrait || PORTRAITS[hero.id]} alt=""
               onError={(e) => { e.currentTarget.src = PORTRAITS[hero.id]; }}
               className={`h-12 w-12 shrink-0 rounded-lg border-2 object-cover ${role.rule.replace('bg-', 'border-')}`} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[17px] font-semibold leading-tight text-white">{hero.name}</div>
            <div className="font-body text-[12px] italic leading-tight text-slate-400">{hero.title}</div>
          </div>
          <div className="text-right">
            <span className={`rounded px-1.5 py-[2px] font-body text-[10px] font-bold uppercase tracking-[0.1em] ${role.chip}`}>
              {role.label}
            </span>
            <div className="mt-1 font-body text-[10.5px] text-slate-500">doubles vs {role.beats}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-slate-700
                             bg-slate-800/80 text-slate-300 active:bg-slate-700">
            <I.ChevronRight size={18} className="rotate-90" />
          </button>
        </div>

        <div className="space-y-2 px-3 py-3">
          {hero.skills.map((skill) => (
            <AbilityRow
              key={skill.id}
              skill={skill}
              cooldown={hero.cooldowns[skill.id] ?? 0}
              chosen={chosenSkillId === skill.id}
              readOnly={readOnly}
              hero={hero}
              onPick={onPick}
            />
          ))}
        </div>

        <div className="h-[max(0.5rem,env(safe-area-inset-bottom,0px))]" />
      </motion.div>
    </>
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
  // Abilities with a cooldown start spent, so round one is the narrowest.
  cooldowns: Object.fromEntries(h.skills.map((s) => [s.id, s.cooldown])),
}));

function pickIntents(heroes) {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const intents = {};

  for (const h of heroes) {
    if (h.side !== 'enemy' || h.health <= 0) continue;
    const ready = h.skills.filter((s) => (h.cooldowns[s.id] ?? 0) <= 0);
    if (!ready.length) continue;

    const skill = pick(ready);
    let targetId = null;
    if (needsTarget(skill)) {
      const wanted = skill.target === TARGET.ally ? 'enemy' : 'player';
      const pool = heroes.filter((o) => o.side === wanted && o.health > 0);
      targetId = pool.length ? pick(pool).id : null;
    }
    intents[h.id] = { skillId: skill.id, targetId };
  }
  return intents;
}

export default function Board() {
  const [heroes, setHeroes] = useState(seedHeroes);
  const [selections, setSelections] = useState({});
  const [intents, setIntents] = useState(() => pickIntents(seedHeroes()));
  const [openId, setOpenId] = useState(null);
  const [armed, setArmed] = useState(null);   // { heroId, skillId } choosing a target
  const [round, setRound] = useState(1);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const [toast, setToast] = useState(null);
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  const heroesById = useMemo(() => Object.fromEntries(heroes.map((h) => [h.id, h])), [heroes]);
  const players = heroes.filter((h) => h.side === 'player');
  const enemies = heroes.filter((h) => h.side === 'enemy');
  const livePlayers = players.filter((h) => h.health > 0);
  const liveEnemies = enemies.filter((h) => h.health > 0);
  const skillOf = (hero, id) => hero.skills.find((s) => s.id === id);
  const orderOf = (hero) => (hero.side === 'player' ? selections[hero.id] : intents[hero.id]);
  const chosenIdOf = (hero) => orderOf(hero)?.skillId;

  const queue = useMemo(() => {
    const steps = [];
    for (const h of heroes) {
      if (h.health <= 0) continue;
      const order = h.side === 'player' ? selections[h.id] : intents[h.id];
      const skill = order && skillOf(h, order.skillId);
      if (skill) steps.push({ heroId: h.id, skill, side: h.side, targetId: order.targetId });
    }
    // Ascending speed; same-side ties keep team order, so ordering your own
    // heroes is a decision rather than a coin flip.
    return steps.sort((a, b) => a.skill.speed - b.skill.speed
      || (a.side === b.side ? 0 : a.side === 'player' ? -1 : 1));
  }, [heroes, selections, intents]);

  const rangeOf = useCallback((hero, skill) => {
    const allies = (hero.side === 'player' ? livePlayers : liveEnemies).map((h) => h.id);
    const foes = (hero.side === 'player' ? liveEnemies : livePlayers).map((h) => h.id);
    switch (skill.target) {
      case TARGET.self: return [hero.id];
      case TARGET.ally:
      case TARGET.allAllies: return allies;
      default: return foes;
    }
  }, [livePlayers, liveEnemies]);

  /* ---- choosing a target ---- */

  const armedHero = armed ? heroesById[armed.heroId] : null;
  const armedSkill = armedHero ? skillOf(armedHero, armed.skillId) : null;
  const armedRange = useMemo(
    () => (armedHero && armedSkill ? rangeOf(armedHero, armedSkill) : []),
    [armedHero, armedSkill, rangeOf],
  );
  const armedTone = armedSkill && (armedSkill.target === TARGET.ally
    || armedSkill.target === TARGET.allAllies || armedSkill.target === TARGET.self)
    ? 'friendly' : 'hostile';

  /** An ability that needs no target commits on the tap - nothing to confirm. */
  const chooseSkill = (hero, skill) => {
    setOpenId(null);
    if (!needsTarget(skill)) {
      setArmed(null);
      setSelections((prev) => ({ ...prev, [hero.id]: { skillId: skill.id, targetId: null } }));
      return;
    }
    setArmed({ heroId: hero.id, skillId: skill.id });
  };

  const chooseTarget = (target) => {
    if (!armed || !armedRange.includes(target.id)) return;
    setSelections((prev) => ({ ...prev, [armed.heroId]: { skillId: armed.skillId, targetId: target.id } }));
    setArmed(null);
  };

  const pushFloater = (heroId, text, kind) => {
    const id = uid();
    setFloaters((f) => [...f, { id, heroId, text, kind }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1350);
  };

  const ready = livePlayers.length > 0 && livePlayers.every((h) => selections[h.id]);
  const given = livePlayers.filter((h) => selections[h.id]).length;

  async function resolveRound() {
    if (!ready || resolving) return;
    setResolving(true);
    setOpenId(null);
    setArmed(null);
    let board = heroes;

    for (let i = 0; i < queue.length; i++) {
      if (cancelled.current) return;
      const step = queue[i];
      setActiveIndex(i);

      const actor = board.find((h) => h.id === step.heroId);
      if (!actor || actor.health <= 0) { await sleep(480); continue; }

      setToast({ side: actor.side, name: actor.name, skill: step.skill });
      await sleep(640);

      const ids = rangeOf(actor, step.skill);
      const pool = board.filter((h) => ids.includes(h.id) && h.health > 0);
      const chosen = step.targetId && pool.find((h) => h.id === step.targetId);
      const targets = needsTarget(step.skill)
        // The chosen target may have died earlier in the round; fall back to
        // the weakest thing still in range rather than fizzling silently.
        ? [chosen || [...pool].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]].filter(Boolean)
        : pool;

      const next = board.map((h) => ({ ...h }));
      const striker = next.find((x) => x.id === actor.id);

      /** Shields soak first; returns what actually reached health. */
      const dealTo = (victim, raw) => {
        const soaked = Math.min(victim.shield, raw);
        victim.shield -= soaked;
        const through = raw - soaked;
        victim.health = Math.max(0, victim.health - through);
        return through;
      };

      for (const t of targets) {
        const target = next.find((x) => x.id === t.id);
        if (!target) continue;

        if (step.skill.heal) {
          const healed = Math.min(step.skill.heal, target.maxHealth - target.health);
          target.health += healed;
          if (healed > 0) pushFloater(target.id, `+${healed}`, 'heal');
        }
        if (step.skill.shield) {
          target.shield += step.skill.shield;
          pushFloater(target.id, 'warded', 'word');
        }

        const { amount, bonus } = strikeDamage(actor, step.skill, target);
        if (amount > 0) {
          const through = dealTo(target, amount);
          pushFloater(target.id, `-${through}${bonus ? ' ×2' : ''}`, bonus ? 'crit' : 'dmg');
        }
      }

      // The Attack keyword: the striker takes the defender's Attack back, and
      // takes it even if the blow was lethal - the trade is simultaneous.
      if (step.skill.isAttack && targets.length === 1 && striker) {
        const back = targets[0].attack;
        if (back > 0) {
          const through = dealTo(striker, back);
          pushFloater(striker.id, `-${through}`, 'dmg');
        }
      }

      board = next;
      setHeroes(board);
      await sleep(720);
    }

    const ticked = board.map((h) => {
      const used = (h.side === 'player' ? selections[h.id] : intents[h.id])?.skillId;
      const cooldowns = { ...h.cooldowns };
      for (const key of Object.keys(cooldowns)) cooldowns[key] = Math.max(0, cooldowns[key] - 1);
      const skill = used && skillOf(h, used);
      if (skill?.cooldown) cooldowns[used] = skill.cooldown;
      return { ...h, cooldowns };
    });

    setHeroes(ticked);
    setActiveIndex(-1);
    setToast(null);
    setSelections({});
    setIntents(pickIntents(ticked));
    setRound((r) => r + 1);
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
    setToast(null);
    setOpenId(null);
    setArmed(null);
    setResolving(false);
  };

  const outcome = liveEnemies.length === 0 ? 'won' : livePlayers.length === 0 ? 'lost' : null;
  const openHero = openId ? heroesById[openId] : null;

  const rank = (list) => (
    <div className={`grid gap-2 ${RANK_COLS[list.length] ?? 'grid-cols-3'} sm:gap-4`}>
      {list.map((hero) => (
        <UnitTile
          key={hero.id}
          hero={hero}
          chosenSkill={(() => { const id = chosenIdOf(hero); return id ? skillOf(hero, id) : null; })()}
          isActing={activeIndex >= 0 && queue[activeIndex]?.heroId === hero.id}
          isOpen={openId === hero.id}
          floaters={floaters.filter((f) => f.heroId === hero.id)}
          targeting={Boolean(armed)}
          isTargetable={Boolean(armed) && armedRange.includes(hero.id)}
          isCaster={armed?.heroId === hero.id}
          targetTone={armedTone}
          onOpen={(h) => {
            if (resolving) return;
            // While aiming, a tap is the aim; only a legal target lands, and
            // anything else cancels rather than silently doing nothing.
            if (armed) {
              if (armedRange.includes(h.id)) chooseTarget(h);
              else setArmed(null);
              return;
            }
            setOpenId(h.id);
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[#0d0a07]"
      onClick={(e) => {
        // Aiming at nothing should let go. A tap that misses every tile and
        // every control cancels, so you are never stuck holding an ability.
        if (armed && !e.target.closest('button')) setArmed(null);
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(91deg,#1c1409_0px,#241a0c_4px,#160f07_9px,#1f1509_14px)] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_78%_52%_at_50%_44%,rgba(214,166,96,0.22),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_94%_at_50%_50%,transparent_32%,rgba(4,3,2,0.94)_100%)]" />
      </div>

      {/* top bar, deliberately thin */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-3 pb-1 pt-2">
        <h1 className="font-display text-[15px] font-semibold uppercase tracking-[0.2em] text-amber-100">
          Theo<span className="text-amber-500">machy</span>
        </h1>
        <div className="flex items-center gap-2">
          <span className="font-display text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Round <b className="text-amber-200">{round}</b>
          </span>
          <button type="button" onClick={reset} aria-label="Reset battle"
                  className="grid h-8 w-8 place-items-center rounded-lg border-2 border-slate-700 bg-slate-900/70
                             text-slate-400 active:bg-slate-800">
            <I.RotateCcw size={14} />
          </button>
        </div>
      </header>

      {/* board: two ranks and the turn strip, centred in whatever is left */}
      {/* justify-between, not centre: the ranks push to the edges so a tall
          phone screen is a board rather than a strip floating in black */}
      <main className="relative z-10 mx-auto my-auto flex max-h-[26rem] min-h-0 w-full flex-1 flex-col
                       justify-between gap-3 px-3 py-2 sm:max-h-[36rem] sm:max-w-xl sm:gap-8 sm:py-4">
        {rank(enemies)}
        <TurnStrip queue={queue} activeIndex={activeIndex} heroesById={heroesById} />
        {rank(players)}
      </main>

      {/* bottom bar */}
      <footer className="relative z-10 shrink-0 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] pt-2">
        {armed && armedHero && armedSkill ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
            className={`flex items-center gap-3 rounded-xl border-[3px] px-3 py-2
                        ${armedTone === 'hostile'
                          ? 'border-red-500 bg-red-950/70 shadow-[0_0_22px_-4px_rgba(248,113,113,0.6)]'
                          : 'border-emerald-500 bg-emerald-950/70 shadow-[0_0_22px_-4px_rgba(110,231,183,0.55)]'}`}
          >
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.3, repeat: Infinity }}
              className={armedTone === 'hostile' ? 'text-red-300' : 'text-emerald-300'}
            >
              <I.Crosshair size={22} />
            </motion.span>

            <div className="min-w-0 flex-1 leading-tight">
              <div className="font-display text-[13px] font-semibold uppercase tracking-wider text-white">
                {armedSkill.name}
              </div>
              <div className="font-body text-[12px] text-slate-300">
                {armedHero.name} — choose {armedTone === 'hostile' ? 'an enemy' : 'an ally'}
                {armedSkill.isAttack && (
                  <span className="text-amber-200/90">
                    {' · '}strikes for {armedHero.attack + (armedSkill.bonus ?? 0)}, takes their Attack back
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setArmed(null)}
              className="shrink-0 rounded-lg border-2 border-slate-600 bg-slate-900/80 px-3 py-2
                         font-display text-[11px] uppercase tracking-wider text-slate-300 active:bg-slate-800"
            >
              Cancel
            </button>
          </motion.div>
        ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 font-body text-[12.5px] leading-tight">
            {outcome === 'won' ? <span className="text-emerald-300">The field is yours.</span>
              : outcome === 'lost' ? <span className="text-red-300">Your warband has fallen.</span>
              : <span className="text-slate-400">
                  <b className="font-display text-amber-200">{given}</b> of {livePlayers.length} orders given
                </span>}
          </div>
          <motion.button
            type="button"
            onClick={resolveRound}
            disabled={!ready || resolving || Boolean(outcome)}
            whileTap={ready && !resolving && !outcome ? { scale: 0.96 } : undefined}
            transition={SPRING}
            className={`shrink-0 rounded-xl border-[3px] px-7 py-2.5 font-display text-[15px] font-semibold
                        uppercase tracking-[0.16em] shadow-xl shadow-black/70
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300
                        ${ready && !resolving && !outcome
                          ? 'border-amber-800 bg-[linear-gradient(180deg,#f0cf7f,#c79327)] text-amber-950'
                          : 'cursor-not-allowed border-slate-700 bg-slate-900/70 text-slate-600'}`}
          >
            {resolving ? '…' : 'Ready'}
          </motion.button>
        </div>
        )}
      </footer>

      {/* one line naming what is resolving, in place of a log panel */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={`${toast.name}-${toast.skill.id}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={SPRING}
            className="pointer-events-none fixed inset-x-0 top-11 z-40 mx-auto w-fit max-w-[92vw] rounded-lg
                       border-2 border-slate-700 bg-slate-950/92 px-3 py-1.5 text-center shadow-2xl shadow-black/80"
          >
            <span className={`font-display text-[12px] font-semibold uppercase tracking-wider
                              ${toast.side === 'player' ? 'text-amber-300' : 'text-rose-300'}`}>
              {toast.name}
            </span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="font-body text-[13px] text-slate-200">{toast.skill.name}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openHero && (
          <AbilitySheet
            key={openHero.id}
            hero={openHero}
            chosenSkillId={chosenIdOf(openHero)}
            readOnly={openHero.side !== 'player' || resolving || Boolean(outcome)}
            onPick={(skill) => chooseSkill(openHero, skill)}
            onClose={() => setOpenId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
