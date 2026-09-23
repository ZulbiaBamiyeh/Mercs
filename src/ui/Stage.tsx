import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';

/**
 * Two fixed canvases, scaled to fit the window:
 * - landscape: 1600x900
 * - portrait: 900 wide, and as tall as the phone's shape allows (1600-2000),
 *   so a tall phone uses its whole screen instead of letterboxing.
 */
export const LANDSCAPE = { w: 1600, h: 900 };
const PORTRAIT_W = 900;
const PORTRAIT_MIN_H = 1600;
const PORTRAIT_MAX_H = 2000;

interface StageApi {
  scale: number;
  w: number;
  h: number;
  portrait: boolean;
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

function measure() {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (vh > vw) {
    const h = Math.round(Math.max(PORTRAIT_MIN_H, Math.min(PORTRAIT_MAX_H, (PORTRAIT_W * vh) / vw)));
    return { w: PORTRAIT_W, h, scale: Math.min(vw / PORTRAIT_W, vh / h), portrait: true };
  }
  return { ...LANDSCAPE, scale: Math.min(vw / LANDSCAPE.w, vh / LANDSCAPE.h), portrait: false };
}

export function Stage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState(measure);

  useLayoutEffect(() => {
    const fit = () => setDims(measure());
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, []);

  const { scale, w, h, portrait } = dims;
  const api: StageApi = useMemo(() => ({
    scale, w, h, portrait,
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
  }), [scale, w, h, portrait]);

  return (
    <Ctx.Provider value={api}>
      <div className="viewport">
        <div
          ref={ref}
          className={`stage ${portrait ? 'is-portrait' : 'is-landscape'}`}
          style={{ width: w, height: h, transform: `scale(${scale})`, '--H': `${h}px` } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </Ctx.Provider>
  );
}
