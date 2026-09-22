import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';

export const STAGE_W = 1600;
export const STAGE_H = 900;

interface StageApi {
  scale: number;
  el: () => HTMLElement | null;
  /** Converts a client point to stage coordinates. */
  toStage: (x: number, y: number) => { x: number; y: number };
  /** Centre of an element in stage coordinates. */
  centerOf: (node: Element) => { x: number; y: number; w: number; h: number };
}

const Ctx = createContext<StageApi | null>(null);
export const useStage = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStage outside Stage');
  return c;
};

/**
 * A fixed 1600x900 canvas scaled to fit the window, so the composition holds
 * from a phone in landscape up to a desktop monitor.
 */
export function Stage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useLayoutEffect(() => {
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      setScale(Math.min(w / STAGE_W, h / STAGE_H));
      setPortrait(h > w * 1.1 && w < 900);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const api: StageApi = useMemo(() => ({
    scale,
    el: () => ref.current,
    toStage: (x, y) => {
      const r = ref.current!.getBoundingClientRect();
      return { x: (x - r.left) / scale, y: (y - r.top) / scale };
    },
    centerOf: (node) => {
      const r = ref.current!.getBoundingClientRect();
      const n = node.getBoundingClientRect();
      return {
        x: (n.left + n.width / 2 - r.left) / scale,
        y: (n.top + n.height / 2 - r.top) / scale,
        w: n.width / scale,
        h: n.height / scale,
      };
    },
  }), [scale]);

  return (
    <Ctx.Provider value={api}>
      <div className="viewport">
        <div ref={ref} className="stage" style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
        {portrait && !dismissed && (
          <button className="rotate-hint" onClick={() => setDismissed(true)} type="button">
            <span className="rotate-icon" aria-hidden="true">⟳</span>
            Turn your phone sideways to see the table properly.
            <small>Tap to dismiss</small>
          </button>
        )}
      </div>
    </Ctx.Provider>
  );
}
