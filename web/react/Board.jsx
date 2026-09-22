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
import { PLAYER_TEAM, ENEMY_TEAM, ROLES, TARGET, RANGE_LABEL, GEMS } from './heroes.jsx';
import {
  needsTarget, rangeOf, buildQueue, applyStep, endRound, outcomeOf, spawn,
} from './rules.jsx';

const { useState, useMemo, useCallback, useRef, useEffect } = React;
const { motion, AnimatePresence } = Motion;

const SPRING = { type: 'spring', stiffness: 320, damping: 26, mass: 0.7 };
const SHEET_SPRING = { type: 'spring', stiffness: 380, damping: 34 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = (() => { let i = 0; return () => `fx${i++}`; })();
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/** Literal classes only - Tailwind scans source text, not runtime strings. */
const RANK_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-3', 6: 'grid-cols-3' };



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
 * A spiked starburst, built once at module scope.
 *
 * Damage numbers in Mercenaries land inside a jagged burst rather than just
 * floating, and that shape is most of why a hit reads as a *hit*. Sixteen
 * points, alternating between two radii.
 */
const BURST_POINTS = Array.from({ length: 32 }, (_, i) => {
  const angle = (i / 32) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 === 0 ? 50 : 33;
  return `${(50 + Math.cos(angle) * r).toFixed(1)},${(50 + Math.sin(angle) * r).toFixed(1)}`;
}).join(' ');

/** Palette per event kind: fill, stroke, text. */
const BURST_TONE = {
  crit: ['#f59e0b', '#fffbeb', '#4c2a02'],
  dmg: ['#dc2626', '#fee2e2', '#ffffff'],
  heal: ['#16a34a', '#dcfce7', '#ffffff'],
  buff: ['#a855f7', '#f3e8ff', '#ffffff'],
};

/**
 * Four bevelled corner plates.
 *
 * Real card frames are not extruded rectangles; they have a cast plate at
 * each corner catching the light. Each is a triangle clipped out of a bright
 * gold gradient, rotated to face outward.
 */
function Bevels({ size = 15 }) {
  const corner = `pointer-events-none absolute bg-[linear-gradient(135deg,#fff6d8,#dcb35c_52%,#7d5a22)]`;
  const box = { width: size, height: size };
  return (
    <>
      <span style={box} className={`${corner} left-0 top-0 rounded-tl-xl [clip-path:polygon(0_0,100%_0,0_100%)]`} />
      <span style={box} className={`${corner} right-0 top-0 rounded-tr-xl [clip-path:polygon(100%_0,100%_100%,0_0)]`} />
      <span style={box} className={`${corner} bottom-0 left-0 rounded-bl-xl [clip-path:polygon(0_0,0_100%,100%_100%)]`} />
      <span style={box} className={`${corner} bottom-0 right-0 rounded-br-xl [clip-path:polygon(100%_0,100%_100%,0_100%)]`} />
    </>
  );
}

function Burst({ text, kind }) {
  const [fill, stroke, ink] = BURST_TONE[kind] ?? BURST_TONE.dmg;
  const big = kind === 'crit';
  return (
    <span className={`relative grid place-items-center ${big ? 'h-[76px] w-[76px]' : 'h-[58px] w-[58px]'}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)]">
        <polygon points={BURST_POINTS} fill={fill} stroke={stroke} strokeWidth="4" />
      </svg>
      <span
        className={`relative font-display font-bold leading-none ${big ? 'text-[25px]' : 'text-[20px]'}`}
        style={{ color: ink, WebkitTextStroke: kind === 'crit' ? '0' : '0.5px rgba(0,0,0,0.35)' }}
      >
        {text}
      </span>
    </span>
  );
}

/**
 * The firing ability, shown large while it fires.
 *
 * This is the piece Mercenaries uses to answer "what just happened": the
 * ability's own card slides in against the left edge, bleeding slightly off
 * it, and stays for as long as the effect plays. Without it a round is six
 * anonymous numbers; with it you can read the enemy's whole turn.
 *
 * Same card grammar as the picker - gold ring, winged speed plate, name
 * banner, parchment text, school strip - scaled up and tinted by side so
 * whose turn it is never needs a label.
 */
/**
 * One ability, as a full card.
 *
 * The same object appears in two places, which is the point: the card that
 * pops while you are choosing an ability is the card that slides in when it
 * fires. Learn it once.
 *
 * Portrait proportions, art in a heavy ring with the winged speed plate
 * biting into its lower left, a cooldown badge in the corner, a struck brass
 * name banner, rules text on parchment, and the school on a strip. Plain
 * weapon work has no school, so that strip is simply absent.
 */
function SkillCard({ hero, skill, cooldown = 0, byline = null }) {
  const Icon = skill.icon;
  const mine = hero.side === 'player';
  const role = ROLES[hero.role];
  const locked = cooldown > 0;

  return (
    <div className="frame-metal relative rounded-xl p-[5px]">
      <div className={`relative rounded-[8px] px-2.5 pb-2.5 pt-3
                       ${mine
                         ? 'bg-[linear-gradient(180deg,#5c4a23,#2a2010)]'
                         : 'bg-[linear-gradient(180deg,#5a2a2e,#281014)]'}`}>
        <div className="relative mx-auto w-fit">
          <span className={`frame-well grid h-[74px] w-[74px] place-items-center rounded-full
                            border-[4px] border-amber-500/90
                            bg-[radial-gradient(circle_at_36%_28%,#4d5d72,#141b24_72%)]
                            ${locked ? 'text-slate-500 saturate-50' : role.text}`}>
            <Icon size={34} />
          </span>
          <Winged speed={skill.speed} className="absolute -bottom-1.5 -left-3 h-[26px] w-[40px]"
                  textClass="text-[15px]" />
          {(skill.cooldown > 0 || locked) && (
            <span className="seal-brass absolute -right-2.5 -top-1 grid h-[22px] w-[22px] place-items-center
                             rounded-full font-display text-[11px] font-extrabold leading-none text-amber-950">
              {locked ? cooldown : skill.cooldown}
            </span>
          )}
        </div>

        {byline && (
          <div className={`mt-2 text-center font-body text-[8.5px] font-bold uppercase tracking-[0.16em]
                           ${mine ? 'text-amber-300/70' : 'text-rose-300/70'}`}>
            {byline}
          </div>
        )}

        <div className={`${byline ? 'mt-1' : 'mt-2.5'} rounded-sm border-y-2 border-amber-600/70
                         bg-[linear-gradient(180deg,#e2bd76,#a87c34)] px-1 py-[3px] text-center`}>
          <span className="ink-outline-sm font-display text-[12px] font-bold uppercase leading-tight
                           tracking-tight text-amber-950">
            {skill.name}
          </span>
        </div>

        <div className="frame-well mt-2 rounded-sm bg-[linear-gradient(180deg,#ddd2b9,#c0b399)] px-2 py-2
                        text-center font-body text-[12px] leading-snug text-stone-900">
          {skill.text}
          {/* An Attack trades damage both ways, so say what the swing costs. */}
          {skill.isAttack && (
            <span className="mt-1.5 block border-t border-stone-500/40 pt-1.5 text-[11px] font-semibold text-stone-700">
              Strikes {hero.attack + (skill.bonus ?? 0)} · takes their Attack back
            </span>
          )}
          {locked && (
            <span className="mt-1.5 block border-t border-stone-500/40 pt-1.5 text-[11px] font-bold text-red-900">
              Ready in {cooldown} round{cooldown === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {skill.school && (
          <div className="mx-auto mt-1.5 w-fit rounded-sm border border-amber-900/60 bg-stone-300/90 px-2.5
                          font-body text-[9px] font-bold uppercase tracking-[0.12em] text-stone-800">
            {skill.school}
          </div>
        )}
      </div>
      <Bevels size={12} />
    </div>
  );
}

/** Where a full card sits: left edge on a wide screen, the band below the
 *  ranks on a phone, where a tall card cannot cover the board. */
const CARD_SLOT = `fixed bottom-[4.25rem] left-2 z-40 w-[58vw] max-w-[208px]
                   sm:bottom-auto sm:left-4 sm:top-1/2 sm:w-[224px] sm:-translate-y-1/2`;

function CastCard({ cast }) {
  const { hero, skill } = cast;
  return (
    <motion.div
      initial={{ x: '-108%', opacity: 0, rotate: -5 }}
      animate={{ x: 0, opacity: 1, rotate: 0 }}
      exit={{ x: '-108%', opacity: 0, rotate: -5 }}
      transition={{ type: 'spring', stiffness: 240, damping: 25 }}
      className={`pointer-events-none ${CARD_SLOT}`}
    >
      <SkillCard hero={hero} skill={skill}
                 byline={`${hero.side === 'player' ? 'Your god' : 'Enemy'} · ${hero.name}`} />
    </motion.div>
  );
}

/**
 * The picker: three medallions on a tray, in the middle of the board.
 *
 * This is the shape the reference uses, and it is far lighter than the bottom
 * sheet it replaces. Tapping one of your gods lays its three abilities out as
 * discs - art, speed, cooldown, nothing else - and focusing one pops the full
 * card in the usual slot. A sheet full of three complete cards was trying to
 * say everything at once; this says the minimum on the board and the whole
 * card only for the one you are actually considering.
 *
 * On a phone a tap is the hover: the first tap focuses a medallion and lights
 * its legal targets, the second tap on a lit target commits. Abilities that
 * need no target commit on that first tap, since there is nothing to choose.
 */
function MedallionTray({ hero, focusId, chosenSkillId, readOnly, onFocus }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
      transition={SPRING}
      className="frame-metal relative flex shrink-0 items-center justify-center gap-3 rounded-xl p-[4px] sm:gap-5"
    >
      <div className={`flex w-full items-start justify-center gap-3 rounded-[8px] px-3 pb-1 pt-2 sm:gap-6
                       ${hero.side === 'player'
                         ? 'bg-[linear-gradient(180deg,#4a3418,#241a0b)]'
                         : 'bg-[linear-gradient(180deg,#4a2024,#240e11)]'}`}>
        {hero.skills.map((skill) => {
          const Icon = skill.icon;
          const cd = hero.cooldowns[skill.id] ?? 0;
          const locked = cd > 0;
          const focused = focusId === skill.id;
          const chosen = chosenSkillId === skill.id;
          return (
            <button
              key={skill.id}
              type="button"
              disabled={readOnly && locked}
              onClick={(e) => { e.stopPropagation(); onFocus(skill); }}
              title={`${skill.name} — speed ${skill.speed}${locked ? `, ready in ${cd}` : ''}`}
              className="relative flex flex-col items-center focus-visible:outline-none"
            >
              <span className={`frame-metal relative grid h-[52px] w-[52px] place-items-center rounded-full p-[3px]
                                transition-transform sm:h-[60px] sm:w-[60px]
                                ${locked ? 'opacity-50 saturate-50' : 'active:scale-95'}
                                ${focused || chosen
                                  ? 'shadow-[0_0_0_3px_rgba(253,230,138,0.95),0_0_22px_4px_rgba(251,191,36,0.6)]'
                                  : ''}`}>
                <span className={`frame-well grid h-full w-full place-items-center rounded-full
                                  bg-[radial-gradient(circle_at_36%_28%,#4d5d72,#141b24_72%)]
                                  ${locked ? 'text-slate-500' : ROLES[hero.role].text}`}>
                  <Icon size={24} />
                </span>
                {(skill.cooldown > 0 || locked) && (
                  <span className="seal-brass absolute -right-1 -top-1 grid h-[19px] w-[19px] place-items-center
                                   rounded-full font-display text-[10px] font-extrabold leading-none text-amber-950">
                    {locked ? cd : skill.cooldown}
                  </span>
                )}
              </span>
              {/* speed hangs below the disc, as on the reference tray */}
              <Winged speed={skill.speed} className="-mt-1.5 h-[20px] w-[32px]" textClass="text-[12px]" />
            </button>
          );
        })}
      </div>
      <Bevels size={11} />
    </motion.div>
  );
}

/**
 * Two stacked portraits. The overlay carries no alt and removes itself on
 * error: a blocked or missing image otherwise paints its alt text across the
 * card, and the published page's CSP blocks remote images silently.
 */
function PortraitStack({ hero, role }) {
  const [failed, setFailed] = useState(false);
  // `portrait-fill` is object-fit: cover in a square well, biased slightly
  // above centre so a bust crops to the face rather than the chin. Any aspect
  // ratio dropped in is filled and centre-cropped, never squashed. The inner
  // top radius matches the well so art never squares off the frame's corners.
  const fill = 'absolute inset-0 portrait-fill rounded-t-[8px]';
  return (
    <>
      <img src={PORTRAITS[hero.id]} alt={`${hero.name}, ${role.label}`} className={fill} />
      {hero.portrait && !failed && (
        <img src={hero.portrait} alt="" aria-hidden="true" onError={() => setFailed(true)}
             className={fill} />
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
  ordinal, lunging, struck, aimed, dim, resolving,
}) {
  const role = ROLES[hero.role];
  const gem = GEMS[hero.role];
  const dead = hero.health <= 0;
  const frac = Math.max(0, Math.min(1, hero.health / Math.max(1, hero.maxHealth)));
  const hurt = frac <= 0.35;
  const Chosen = chosenSkill?.icon;

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(hero)}
      /* Three states, in order of precedence. Lunging: the caster drives at the
         opposing rank, up for your gods and down for theirs, so the blow has a
         direction. Struck: a hard recoil shake. Otherwise the acting unit just
         sits raised. */
      animate={
        lunging ? { scale: 1.12, y: hero.side === 'player' ? -26 : 26 }
        : struck ? { scale: 1, x: [0, -7, 6, -4, 3, 0], y: 0 }
        : isActing ? { scale: 1.06, y: -4 }
        : { scale: 1, x: 0, y: 0 }
      }
      whileTap={{ scale: 0.97 }}
      transition={struck ? { duration: 0.38 } : SPRING}
      aria-label={`${hero.name}, ${role.label}, ${hero.health} of ${hero.maxHealth} health`}
      className={`relative block w-full text-left transition-opacity duration-500 focus-visible:outline-none
                  ${dead ? 'opacity-45 saturate-0' : ''}
                  ${targeting && !isTargetable && !isCaster ? 'opacity-35 grayscale' : ''}
                  ${dim ? 'opacity-40' : ''}`}
    >
      {/* While choosing a target, a legal one pulses and wears a crosshair. */}
      <AnimatePresence>
        {isTargetable && (
          <motion.span
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={SPRING}
            /* Green means "you may aim here". Red is reserved for the unit
               actually being struck during resolution, so the two never mean
               the same thing. The reference pools the glow at the unit's base
               rather than outlining it evenly, which is what makes a rank of
               legal targets read as lit from below. */
            className="pointer-events-none absolute -inset-1.5 z-30 rounded-2xl border-[3px]
                       border-emerald-300 shadow-[0_0_26px_rgba(52,211,153,0.65)]"
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
            className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2
                       rounded-full border-2 border-emerald-300 bg-emerald-950/80 p-1.5 text-emerald-200" 
          >
            <I.Crosshair size={22} />
          </motion.span>
        )}
      </AnimatePresence>
      {/* Turn order as a bubble on the unit itself, which is where Mercenaries
          puts it - reading the order off the board beats reading it off a
          separate strip. */}
      <AnimatePresence>
        {ordinal && !isActing && !resolving && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={SPRING}
            className={`seal-brass pointer-events-none absolute -top-3 left-1/2 z-40 grid h-[26px] w-[26px]
                        -translate-x-1/2 place-items-center rounded-full
                        ${hero.side === 'enemy' ? 'seal-brass-foe' : ''}`}
          >
            {/* The ordinal is the seal's stamp: dark gold, not white. A tie
                marker rides as a superscript so the number stays centred in
                the circle. */}
            <span className={`ink-outline-sm font-display text-[10px] font-extrabold leading-none
                              ${hero.side === 'enemy' ? 'text-rose-950' : 'text-amber-950'}`}
                  style={{ textShadow: '0 1px 0 rgba(255,248,219,0.55)' }}>
              {ordinal.replace('?', '')}
              {ordinal.endsWith('?') && <sup className="text-[8px] font-bold">?</sup>}
            </span>
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTargetable && (
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute -bottom-4 left-1/2 z-20 h-6 w-[85%] -translate-x-1/2
                       rounded-[50%] bg-[radial-gradient(ellipse_at_50%_50%,rgba(52,211,153,0.85),transparent_70%)]
                       blur-[2px]"
          />
        )}
      </AnimatePresence>

      {isCaster && targeting && (
        <span className="pointer-events-none absolute -top-2 left-1/2 z-40 -translate-x-1/2 rounded
                         border-2 border-amber-400 bg-amber-950 px-1.5 py-[1px] font-display text-[9px]
                         font-bold uppercase tracking-wider text-amber-200">
          Casting
        </span>
      )}
      {/* A cast bronze frame with bevelled corners around a sunken well. The
          frame is gold on every card, so selection can no longer be a border
          colour - it is a glow ring instead, and role identity keeps reading
          from the bottom wash, the rule and the two gems. */}
      <div className="frame-metal relative aspect-square w-full rounded-xl p-[5px]">
        <AnimatePresence>
          {(isActing || isCaster || isOpen) && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={`pointer-events-none absolute -inset-[4px] z-30 rounded-[16px]
                          ${isActing || isCaster
                            ? 'shadow-[0_0_0_3px_rgba(253,230,138,0.95),0_0_26px_4px_rgba(251,191,36,0.6)]'
                            : 'shadow-[0_0_0_2px_rgba(253,230,138,0.65)]'}`}
            />
          )}
        </AnimatePresence>

        {/* The unit about to be hit is ringed red before the blow lands, so you
            see where an ability is going rather than only where it went. */}
        <AnimatePresence>
          {aimed && (
            <motion.span
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-none absolute -inset-[4px] z-30 rounded-[16px]
                         shadow-[0_0_0_4px_rgba(239,68,68,0.95),0_0_24px_5px_rgba(239,68,68,0.55)]"
            />
          )}
        </AnimatePresence>

        <div className="frame-well relative h-full w-full overflow-hidden rounded-[8px] bg-slate-900">
        <PortraitStack hero={hero} role={role} />

        {/* the caster lights up as it swings */}
        <AnimatePresence>
          {lunging && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0.85, 0.5] }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute inset-0 z-20
                         bg-[radial-gradient(circle_at_50%_45%,rgba(255,240,190,0.75),transparent_72%)]"
            />
          )}
        </AnimatePresence>
        {/* and the target takes a white slam */}
        <AnimatePresence>
          {struck && (
            <motion.span
              initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.34 }}
              className="pointer-events-none absolute inset-0 z-20 bg-white"
            />
          )}
        </AnimatePresence>

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
          <div className="ink-outline truncate font-display text-[14px] font-bold leading-tight
                          text-amber-50 sm:text-[16px]">
            {hero.name}
          </div>
        </div>

        {dead && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/60">
            <I.Skull size={30} className="text-slate-300/80" />
          </div>
        )}
        {/* Numbers punch in oversized and settle, rather than drifting up from
            nothing: the earlier version was legible only if you already knew
            what to look for. Keyword callouts stay plain text - a starburst on
            the word "taunt" would read as damage. */}
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, scale: 0.2, y: 8 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.2, 1.35, 1, 1.05], y: [8, -6, -14, -34] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.35, times: [0, 0.18, 0.66, 1], ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 z-40 grid place-items-center"
            >
              {f.kind === 'word' ? (
                <span className="rounded border border-slate-400/60 bg-slate-950/90 px-1.5 py-[1px]
                                 font-display text-[10.5px] font-bold uppercase tracking-widest text-slate-100
                                 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                  {f.text}
                </span>
              ) : (
                <Burst text={f.text} kind={f.kind} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        </div>

        <Bevels />
      </div>

      {/* Gems straddle the plate's bottom corners, half in and half out, and
          take their colour from the *role* rather than the stat - which is
          what the real cards do, so the matchup reads from the corner. The
          health gem is a teardrop; the attack gem keeps the round orb. */}
      <span
        className={`absolute -bottom-3 left-1 z-30 grid h-8 w-8 place-items-center rounded-full border-2
                    ${gem.attack}
                    shadow-[0_3px_8px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.55)]`}
      >
        <span className="font-display text-[13px] font-bold leading-none text-white
                         drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">{hero.attack}</span>
      </span>
      {/* A teardrop, not an orb - a square rotated 45 degrees with one square
          corner, and the number counter-rotated back to upright. */}
      <span
        className={`absolute -bottom-3 right-1 z-30 grid h-8 w-8 rotate-45 place-items-center border-2
                    rounded-full rounded-tl-none
                    ${hurt ? 'border-slate-900/90 bg-[radial-gradient(circle_at_50%_50%,#ffd3cb,#8d1f16_52%,#3c0a06)]' : gem.health}
                    shadow-[0_3px_8px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(255,255,255,0.5)]`}
      >
        {/* White at full health, red the moment it drops. The reference reads
            the whole board's condition off those two states alone. */}
        <span className={`-rotate-45 font-display text-[13px] font-bold leading-none
                          ${hero.health < hero.maxHealth ? 'text-red-300' : 'text-white'}`}
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.85)' }}>
          {Math.max(0, hero.health)}
        </span>
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

/* ---------------------------------------------------------------- *
 * Board
 * ---------------------------------------------------------------- */

// Abilities with a cooldown start spent, so round one is the narrowest.
const seedHeroes = () => [
  ...PLAYER_TEAM.map((h) => spawn(h, 'player')),
  ...ENEMY_TEAM.map((h) => spawn(h, 'enemy')),
];

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
  const [focusId, setFocusId] = useState(null); // medallion whose card is popped
  const [armed, setArmed] = useState(null);   // { heroId, skillId } choosing a target
  // One tie-break coin per round: cross-side speed ties are random, but the
  // order shown has to be the order that resolves.
  const [tieSeed, setTieSeed] = useState(() => (Math.random() * 0xffffffff) >>> 0);
  const [round, setRound] = useState(1);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const [cast, setCast] = useState(null);      // the card on screen, mid-resolution
  const [lunging, setLunging] = useState(null);// hero id currently swinging
  const [struck, setStruck] = useState([]);    // hero ids taking the hit
  const [flash, setFlash] = useState(null);    // screen tint on a doubled hit
  const [aiming, setAiming] = useState(null);  // hero id ringed as the target
  const [spotlight, setSpotlight] = useState(null); // ids kept bright; rest dim
  const [fast, setFast] = useState(false);     // 2x, for when you have seen it
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

  const allOrders = useMemo(() => ({ ...selections, ...intents }), [selections, intents]);
  const queue = useMemo(() => buildQueue(heroes, allOrders, tieSeed), [heroes, allOrders, tieSeed]);
  const aimedAt = useCallback((hero, skill) => rangeOf(heroes, hero, skill), [heroes]);

  /* ---- choosing a target ---- */

  const armedHero = armed ? heroesById[armed.heroId] : null;
  const armedSkill = armedHero ? skillOf(armedHero, armed.skillId) : null;
  const armedRange = useMemo(
    () => (armedHero && armedSkill ? aimedAt(armedHero, armedSkill) : []),
    [armedHero, armedSkill, aimedAt],
  );
  const armedTone = armedSkill && (armedSkill.target === TARGET.ally
    || armedSkill.target === TARGET.allAllies || armedSkill.target === TARGET.self)
    ? 'friendly' : 'hostile';

  /**
   * Tapping a medallion.
   *
   * On a touch screen the first tap is the hover: it pops the ability's full
   * card and, if the ability needs a target, lights the legal ones. An ability
   * that needs no target has nothing left to choose, so it commits there and
   * then. Tapping a locked medallion still shows its card - reading what you
   * cannot use yet is how you plan the next round.
   */
  const focusSkill = (hero, skill) => {
    setFocusId(skill.id);
    if (hero.side !== 'player' || resolving || outcome) return;
    if ((hero.cooldowns[skill.id] ?? 0) > 0) { setArmed(null); return; }

    if (!needsTarget(skill)) {
      setArmed(null);
      setOpenId(null);
      setFocusId(null);
      setSelections((prev) => ({ ...prev, [hero.id]: { skillId: skill.id, targetId: null } }));
      return;
    }
    setArmed({ heroId: hero.id, skillId: skill.id });
  };

  const chooseTarget = (target) => {
    if (!armed || !armedRange.includes(target.id)) return;
    setSelections((prev) => ({ ...prev, [armed.heroId]: { skillId: armed.skillId, targetId: target.id } }));
    setArmed(null);
    setOpenId(null);
    setFocusId(null);
  };

  const pushFloater = (heroId, text, kind) => {
    const id = uid();
    setFloaters((f) => [...f, { id, heroId, text, kind }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1350);
  };

  const ready = livePlayers.length > 0 && livePlayers.every((h) => selections[h.id]);
  const given = livePlayers.filter((h) => selections[h.id]).length;

  /**
   * Play the round out one step at a time.
   *
   * The pacing *is* the feature. Mercenaries shows one ability at a time and
   * gives it room: the card arrives, the board goes quiet for well over a
   * second while you read it, and only then does anything move. An earlier
   * version overlapped those - card sliding in while the hit was already
   * landing - which made a six-step round a blur even though every element
   * was present.
   *
   * So each step is: card in, **a long still beat with nothing else moving**,
   * target ringed, caster drives, impact, then the numbers hang with the card
   * still up so cause and effect share the screen. About 3.4s a step, so a
   * round runs 20s. `fast` halves every beat once you have seen it.
   *
   * Everything not involved in the current step dims, so the two units that
   * matter are the two you are looking at.
   */
  async function resolveRound() {
    if (!ready || resolving) return;
    setResolving(true);
    setOpenId(null);
    setFocusId(null);
    setArmed(null);
    let board = heroes;
    const beat = (ms) => sleep(fast ? ms / 2 : ms);

    for (let i = 0; i < queue.length; i++) {
      if (cancelled.current) return;
      const step = queue[i];
      setActiveIndex(i);

      const actor = board.find((h) => h.id === step.heroId);
      // A god killed earlier in the round never acts - show nothing for it.
      if (!actor || actor.health <= 0) { await beat(240); continue; }

      // 1. The card arrives and the board goes quiet. Nothing else moves for
      //    over a second: this is the beat where you read what is about to
      //    happen, and it is the whole reason the phase is followable.
      setCast({ hero: actor, skill: step.skill });
      setSpotlight([actor.id]);
      await beat(440);
      if (cancelled.current) return;
      await beat(1150);
      if (cancelled.current) return;

      // 2. Only now does anything move. The target is ringed, then struck.
      if (step.targetId) setAiming(step.targetId);
      setLunging(actor.id);
      await beat(330);

      const { heroes: next, events } = applyStep(board, step);
      const hits = events.filter((e) => e.kind === 'dmg' || e.kind === 'crit');
      setStruck(hits.map((e) => e.heroId));
      setSpotlight([actor.id, ...events.map((e) => e.heroId)]);
      if (events.some((e) => e.kind === 'crit')) setFlash('crit');
      for (const e of events) pushFloater(e.heroId, e.text, e.kind);

      board = next;
      setHeroes(board);
      await beat(480);
      setLunging(null);
      setStruck([]);
      setFlash(null);

      // 3. The numbers hang for a moment with the card still up, so the cause
      //    and the effect are on screen together.
      await beat(700);
      setCast(null);
      setAiming(null);
      setSpotlight(null);
      await beat(300);
    }

    const ended = endRound(board, allOrders);
    for (const e of ended.events) pushFloater(e.heroId, e.text, e.kind);
    const ticked = ended.heroes;
    // Bleed ticks at the end of the round, so give it a moment of its own.
    if (ended.events.length) await beat(700);

    setHeroes(ticked);
    setActiveIndex(-1);
    setCast(null);
    setLunging(null);
    setStruck([]);
    setAiming(null);
    setSpotlight(null);
    setSelections({});
    setIntents(pickIntents(ticked));
    setTieSeed((Math.random() * 0xffffffff) >>> 0);
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
    setCast(null);
    setLunging(null);
    setStruck([]);
    setFlash(null);
    setAiming(null);
    setSpotlight(null);
    setOpenId(null);
    setFocusId(null);
    setArmed(null);
    setTieSeed((Math.random() * 0xffffffff) >>> 0);
    setResolving(false);
  };

  const outcome = outcomeOf(heroes);
  const openHero = openId ? heroesById[openId] : null;
  // The card on show follows the armed ability when one is armed, so the card
  // stays up while you pick a target - which is how the reference behaves.
  const previewHero = armedHero ?? openHero;
  const previewSkill = armedSkill
    ?? (openHero && focusId ? openHero.skills.find((sk) => sk.id === focusId) : null);
  /** The button is pressable: every order in, nothing resolving, no result. */
  const live = ready && !resolving && !outcome;

  // Where each god falls in the resolved order, for the bubble on its tile.
  // Only once every order is in - a partial order would be a lie, since a
  // pick you have not made yet can land anywhere in the queue.
  const ordinalOf = (heroId) => {
    // Shown as soon as a god has an order, not only once every order is in.
    // The positions do shift as you add picks - which is exactly what the
    // reference does, and watching the order form as you choose is worth more
    // than never showing a number that might move.
    const at = queue.findIndex((step) => step.heroId === heroId);
    if (at < 0) return null;
    // A cross-side speed tie is settled by a coin, so the position is a guess
    // until it resolves - the same `?` the turn strip carries. Ties within one
    // side are not marked, because those follow your own pick order.
    const step = queue[at];
    const tied = queue.some((o, j) => j !== at && o.skill.speed === step.skill.speed
      && heroesById[o.heroId].side !== heroesById[step.heroId].side);
    return `${ORDINALS[at] ?? `${at + 1}th`}${tied ? '?' : ''}`;
  };

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
          ordinal={ordinalOf(hero.id)}
          lunging={lunging === hero.id}
          struck={struck.includes(hero.id)}
          aimed={aiming === hero.id}
          dim={Boolean(spotlight) && !spotlight.includes(hero.id)}
          resolving={resolving}
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
          <button
            type="button"
            onClick={() => setFast((f) => !f)}
            aria-label={fast ? 'Play at normal speed' : 'Play at double speed'}
            title={fast ? 'Double speed' : 'Normal speed'}
            className={`h-8 rounded-lg border-2 px-2 font-display text-[11px] font-bold tracking-wider
                        active:bg-slate-800
                        ${fast
                          ? 'border-amber-600 bg-amber-950/70 text-amber-300'
                          : 'border-slate-700 bg-slate-900/70 text-slate-500'}`}
          >
            2×
          </button>
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
        <AnimatePresence mode="wait">
          {openHero ? (
            <MedallionTray
              key={`tray-${openHero.id}`}
              hero={openHero}
              focusId={openHero.side === 'player' ? (armed?.skillId ?? focusId) : focusId}
              chosenSkillId={chosenIdOf(openHero)}
              readOnly={openHero.side !== 'player' || resolving || Boolean(outcome)}
              onFocus={(skill) => focusSkill(openHero, skill)}
            />
          ) : (
            <TurnStrip key="strip" queue={queue} activeIndex={activeIndex} heroesById={heroesById} />
          )}
        </AnimatePresence>
        {rank(players)}
      </main>

      {/* bottom bar */}
      {/* The footer clears out while the round plays: the reference shows a
          bare board during the attack phase, and the button has nothing to
          offer until it is your turn to decide again. */}
      <footer className={`relative z-10 shrink-0 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] pt-2
                          transition-opacity duration-500
                          ${resolving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        {armed && armedHero && armedSkill ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
            className="flex items-center gap-3 rounded-xl border-[3px] border-emerald-500 bg-emerald-950/70 px-3 py-2
                       shadow-[0_0_22px_-4px_rgba(52,211,153,0.6)]" 
          >
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.3, repeat: Infinity }}
              className="text-emerald-300" 
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
          {/* The one thing you press. A carved plate in the same cast metal as
              the cards, and once every order is in it breathes a gold halo so
              the round is obviously waiting on you. */}
          <motion.button
            type="button"
            onClick={resolveRound}
            disabled={!ready || resolving || Boolean(outcome)}
            whileTap={live ? { scale: 0.95 } : undefined}
            transition={SPRING}
            aria-label={live ? 'Fight - resolve the round' : 'Fight - give every god an order first'}
            className={`relative shrink-0 rounded-xl p-[3px]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200
                        ${live ? 'frame-metal' : 'cursor-not-allowed bg-[linear-gradient(158deg,#4a4a4a,#2a2a2a_55%,#555)] shadow-lg shadow-black/70'}`}
          >
            {live && (
              <motion.span
                aria-hidden
                animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.045, 1] }}
                transition={{ duration: 1.75, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute -inset-1 rounded-[15px]
                           shadow-[0_0_22px_6px_rgba(251,191,36,0.55),0_0_44px_14px_rgba(245,158,11,0.3)]"
              />
            )}
            <span className={`relative block rounded-[9px] px-8 py-3 font-display text-[19px] font-bold
                              uppercase tracking-[0.13em] sm:px-10 sm:text-[22px]
                              ${live ? 'btn-carved text-amber-200 ink-outline' : 'btn-carved btn-carved-dead text-slate-600'}`}>
              {resolving ? '…' : 'Fight!'}
            </span>
            <Bevels size={11} />
          </motion.button>
        </div>
        )}
      </footer>

      {/* The board darkens at the edges while an ability plays, which is what
          pulls your eye to the middle in the reference footage. */}
      <AnimatePresence>
        {resolving && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none fixed inset-0 z-20
                       bg-[radial-gradient(ellipse_at_50%_45%,transparent_28%,rgba(0,0,0,0.55)_78%,rgba(0,0,0,0.85)_100%)]"
          />
        )}
      </AnimatePresence>

      {/* the firing ability's own card, held on screen while it fires */}
      <AnimatePresence>
        {cast && <CastCard key={`${cast.hero.id}-${cast.skill.id}`} cast={cast} />}
      </AnimatePresence>

      {/* and the same card while you are only considering the ability */}
      <AnimatePresence>
        {!cast && previewHero && previewSkill && (
          <motion.div
            key={`preview-${previewHero.id}-${previewSkill.id}`}
            initial={{ opacity: 0, x: -14, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -14, scale: 0.96 }}
            transition={SPRING}
            className={`pointer-events-none ${CARD_SLOT}`}
          >
            <SkillCard
              hero={previewHero}
              skill={previewSkill}
              cooldown={previewHero.cooldowns[previewSkill.id] ?? 0}
              byline={previewHero.side === 'player' ? null : `Enemy · ${previewHero.name}`}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* a role-doubled hit tints the whole screen for a moment */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.5, 0] }} exit={{ opacity: 0 }}
            transition={{ duration: 0.52 }}
            className="pointer-events-none fixed inset-0 z-30
                       bg-[radial-gradient(circle_at_50%_45%,rgba(255,196,92,0.8),transparent_70%)]"
          />
        )}
      </AnimatePresence>

    </div>
  );
}
