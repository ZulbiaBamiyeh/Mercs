import { KEYWORDS } from '../../engine';

/** Renders card text: **Keyword** in bold, {n} as a boosted (green) value. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\{[^}]+\})/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <b key={i} className="kw">{p.slice(2, -2)}</b>;
        if (p.startsWith('{')) return <span key={i} className="boosted">{p.slice(1, -1)}</span>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/** The keywords a text uses, for the tooltip column beside a card. */
export function keywordsIn(text: string): [string, string][] {
  const seen = new Set<string>();
  for (const m of text.matchAll(/\*\*([^*:]+):?\*\*/g)) {
    const k = m[1]!.replace(/s$/, '') in KEYWORDS ? m[1]!.replace(/s$/, '') : m[1]!;
    if (KEYWORDS[k]) seen.add(k);
  }
  return [...seen].map((k) => [k, KEYWORDS[k]!]);
}
