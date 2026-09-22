import { useStage } from '../Stage';

export interface ArrowSpec {
  from: string;
  to: { x: number; y: number } | string;
  tone: 'aim' | 'player' | 'enemy';
}

/**
 * The targeting arrow: a bowed, segmented path from the acting unit to the
 * pointer or target, with a head that follows the curve's tangent.
 */
export function Arrow({ arrow, els }: { arrow: ArrowSpec | null; els: Map<string, HTMLElement> }) {
  const stage = useStage();
  if (!arrow) return null;
  const fromEl = els.get(arrow.from);
  if (!fromEl) return null;
  const a = stage.centerOf(fromEl);
  let b: { x: number; y: number };
  if (typeof arrow.to === 'string') {
    const el = els.get(arrow.to);
    if (!el) return null;
    b = stage.centerOf(el);
  } else {
    b = arrow.to;
  }
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 40) return null;
  // Bow the curve sideways, more for longer arrows.
  const nx = -dy / dist, ny = dx / dist;
  const bow = Math.min(140, dist * 0.28) * (dx >= 0 ? -1 : 1);
  const cx = (a.x + b.x) / 2 + nx * bow;
  const cy = (a.y + b.y) / 2 + ny * bow;
  // Stop short of the target so the head sits on it.
  const t = 1 - 26 / dist;
  const ex = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x;
  const ey = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y;
  const angle = (Math.atan2(b.y - cy, b.x - cx) * 180) / Math.PI;
  const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${ex} ${ey}`;
  return (
    <svg className={`arrow tone-${arrow.tone}`} viewBox="0 0 1600 900" aria-hidden="true">
      <defs>
        <filter id="arrow-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <path d={d} className="arrow-glow" filter="url(#arrow-glow)" />
      <path d={d} className="arrow-body" />
      <path d={d} className="arrow-dash" />
      <g transform={`translate(${b.x} ${b.y}) rotate(${angle})`}>
        <path d="M 6 0 L -34 -24 L -24 0 L -34 24 Z" className="arrow-head" />
      </g>
      <circle cx={a.x} cy={a.y} r="12" className="arrow-root" />
    </svg>
  );
}
