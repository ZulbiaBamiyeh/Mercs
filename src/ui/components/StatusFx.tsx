// Status graphics drawn on and around a portrait. Each is an SVG sized from
// the portrait's --w / --h, so they scale with it.

import { useId } from 'react';

/** A steel heater shield behind the portrait, as in the source game. */
export function TauntShield() {
  const id = useId();
  return (
    <svg className="fx-taunt" viewBox="0 0 100 124" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f6fa" />
          <stop offset=".28" stopColor="#a9afbb" />
          <stop offset=".55" stopColor="#6c7280" />
          <stop offset=".78" stopColor="#b9bec8" />
          <stop offset="1" stopColor="#474c57" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b3f48" />
          <stop offset="1" stopColor="#1c1e24" />
        </linearGradient>
      </defs>
      <path d="M4 12 Q50 -3 96 12 L96 56 Q96 98 50 122 Q4 98 4 56 Z" fill={`url(#${id}r)`} />
      <path d="M7 14 Q50 1 93 14 L93 56 Q93 95 50 118 Q7 95 7 56 Z" fill={`url(#${id}s)`} />
      <path d="M14 19 Q50 9 86 19 L86 56 Q86 88 50 108 Q14 88 14 56 Z" fill="none" stroke="#2a2d34" strokeOpacity=".55" strokeWidth="1.6" />
      <path d="M14 19 Q50 9 86 19" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" />
      {[[12, 18], [88, 18], [10, 60], [90, 60], [50, 114]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="2.6" fill="#2a2d34" />
          <circle cx={x! - 0.6} cy={y! - 0.6} r="1.4" fill="#e8ebf0" />
        </g>
      ))}
      {/* crest on top */}
      <path d="M40 6 L50 -1 L60 6 L55 9 L50 6 L45 9 Z" fill="#d7dbe2" stroke="#2a2d34" strokeWidth="1" />
    </svg>
  );
}

/** A glassy bubble. Gold for Divine Shield, ice-blue when it's Frost Armor. */
export function ShieldBubble({ frost = false }: { frost?: boolean }) {
  const id = useId();
  const [edge, glow, spark] = frost ? ['#bfe9ff', '#64c3ff', '#f2fbff'] : ['#ffe79a', '#ffc53d', '#fffbe6'];
  return (
    <svg className={`fx-bubble ${frost ? 'is-frost' : ''}`} viewBox="0 0 100 124" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}f`} cx=".5" cy=".46" r=".56">
          <stop offset=".72" stopColor={glow} stopOpacity="0" />
          <stop offset=".9" stopColor={glow} stopOpacity=".28" />
          <stop offset="1" stopColor={edge} stopOpacity=".75" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="60" rx="47" ry="58" fill={`url(#${id}f)`} stroke={edge} strokeWidth="1.8" />
      <path d="M18 34 Q30 10 58 7" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M22 44 Q26 36 32 30" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M84 88 Q78 104 64 112" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
      <g className="fx-bubble-orbit">
        {[0, 90, 180, 270].map((a) => (
          <path key={a} transform={`rotate(${a} 50 60) translate(50 3)`} d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" fill={spark} />
        ))}
      </g>
    </svg>
  );
}

/** Ice crystals growing inward from the frame. */
export function FrostCrystals() {
  const id = useId();
  const shards: [number, number, number][] = [
    [8, 40, 60], [4, 70, 90], [12, 100, 120], [30, 116, 150], [50, 121, 180], [70, 116, 210],
    [88, 100, 240], [96, 70, 270], [92, 40, 300], [74, 10, 330], [50, 2, 0], [26, 10, 30],
  ];
  return (
    <svg className="fx-frost" viewBox="0 0 100 124" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}i`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#bfe8ff" />
          <stop offset="1" stopColor="#5aaee8" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="60" rx="44" ry="55" fill="#9ed8ff" fillOpacity=".28" />
      {shards.map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <path d={`M-4 0 L0 ${14 + (i % 3) * 5} L4 0 L0 -3 Z`} fill={`url(#${id}i)`} stroke="#2a6fa8" strokeWidth=".8" />
          <path d={`M-1 1 L0 ${10 + (i % 3) * 4}`} stroke="#fff" strokeWidth=".8" />
        </g>
      ))}
    </svg>
  );
}

/** Vines wrapped around the lower frame, with thorns and leaves. */
export function RootVines() {
  return (
    <svg className="fx-roots" viewBox="0 0 100 124" aria-hidden="true">
      <g fill="none" strokeLinecap="round">
        <path className="vine" d="M2 124 C10 96 -2 80 16 70 C30 62 20 100 40 104 C58 108 50 84 66 86 C84 88 76 110 98 118" stroke="#2f5a1c" strokeWidth="7" />
        <path className="vine" d="M2 124 C10 96 -2 80 16 70 C30 62 20 100 40 104 C58 108 50 84 66 86 C84 88 76 110 98 118" stroke="#6fb64a" strokeWidth="4" />
        <path className="vine" d="M100 104 C88 90 96 70 82 64 C70 60 78 92 58 96" stroke="#2f5a1c" strokeWidth="5" />
        <path className="vine" d="M100 104 C88 90 96 70 82 64 C70 60 78 92 58 96" stroke="#8fce5a" strokeWidth="2.6" />
      </g>
      {[[16, 70, -30], [40, 104, 20], [66, 86, -10], [82, 64, 40], [28, 88, 160]].map(([x, y, r], i) => (
        <path key={i} transform={`translate(${x} ${y}) rotate(${r})`} d="M0 0 C4 -8 12 -8 14 -2 C8 2 4 2 0 0 Z" fill="#79c24a" stroke="#244512" strokeWidth=".8" />
      ))}
      {[[8, 96], [52, 102], [90, 112], [24, 72]].map(([x, y], i) => (
        <path key={`t${i}`} transform={`translate(${x} ${y})`} d="M-2 0 L0 -5 L2 0 Z" fill="#d8e8b0" />
      ))}
    </svg>
  );
}

/** Drifting smoke for Stealth. */
export function StealthSmoke() {
  const id = useId();
  return (
    <svg className="fx-smoke" viewBox="0 0 100 124" aria-hidden="true">
      <defs>
        <filter id={`${id}b`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <g filter={`url(#${id}b)`}>
        <ellipse className="puff p1" cx="22" cy="100" rx="22" ry="12" fill="#6b5a8a" fillOpacity=".7" />
        <ellipse className="puff p2" cx="72" cy="104" rx="26" ry="12" fill="#3f3654" fillOpacity=".75" />
        <ellipse className="puff p3" cx="50" cy="116" rx="34" ry="10" fill="#2a2338" fillOpacity=".8" />
        <ellipse className="puff p4" cx="86" cy="70" rx="12" ry="18" fill="#56487a" fillOpacity=".5" />
      </g>
    </svg>
  );
}

/** Blood dripping from the base of the frame. */
export function BleedDrips({ amount }: { amount: number }) {
  const drops = Math.min(3, 1 + Math.floor(amount / 5));
  return (
    <div className="fx-bleed" aria-hidden="true">
      {Array.from({ length: drops }, (_, i) => <span key={i} style={{ '--i': i } as React.CSSProperties} />)}
    </div>
  );
}
