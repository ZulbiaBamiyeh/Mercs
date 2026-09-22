import { useMemo } from 'react';

/** Drifting sparks for atmosphere. Pure CSS; hidden under reduced motion. */
export function Embers({ count = 30 }: { count?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: -Math.random() * 14,
        dur: 9 + Math.random() * 10,
        size: 2 + Math.random() * 4,
        drift: (Math.random() - 0.5) * 160,
        key: i,
      })),
    [count],
  );
  return (
    <div className="embers" aria-hidden="true">
      {sparks.map((s) => (
        <span
          key={s.key}
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
            '--drift': `${s.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
