/**
 * Build the React board for the artifact host.
 *
 * Everything that can be compiled ahead of time is: JSX through esbuild,
 * Tailwind v4 through its own CLI, Lucide icons inlined from lucide-static.
 * The published page's CSP only admits scripts from a short CDN allowlist, so
 * the fewer things it fetches at runtime the fewer ways it fails silently.
 *
 * React, ReactDOM and Framer Motion stay external - they load as UMD bundles
 * and the bundle references them as the globals `React`, `ReactDOM`, `Motion`.
 */

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'web/react/dist');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [resolve(root, 'web/react/main.jsx')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: true,
  outfile: resolve(out, 'board.js'),
  logLevel: 'warning',
});

execFileSync(
  resolve(root, 'node_modules/.bin/tailwindcss'),
  ['-i', resolve(root, 'web/react/input.css'), '-o', resolve(out, 'board.css'), '--minify'],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

const js = readFileSync(resolve(out, 'board.js'), 'utf8');
const css = readFileSync(resolve(out, 'board.css'), 'utf8');

const CDN = {
  react: 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  reactDom: 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  motion: 'https://cdn.jsdelivr.net/npm/framer-motion@11.18.2/dist/framer-motion.js',
};

const page = `<title>Theomachy Board</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${css}</style>

<div id="root"></div>

<script src="${CDN.react}"></script>
<script src="${CDN.reactDom}"></script>
<script src="${CDN.motion}"></script>
<script>
  // The runtime libraries are the one thing this page fetches. Say so plainly
  // rather than leaving a blank board if a CDN is unreachable.
  (function () {
    var missing = ['React', 'ReactDOM', 'Motion'].filter(function (g) { return !window[g]; });
    if (!missing.length) return;
    document.getElementById('root').innerHTML =
      '<div style="font:14px ui-monospace,monospace;color:#94a3b8;padding:48px;max-width:46em;margin:0 auto">'
      + '<p style="color:#f0a0a0"><b>Could not load ' + missing.join(', ') + '.</b></p>'
      + '<p>The board needs React, ReactDOM and Framer Motion from cdnjs and jsDelivr. '
      + 'A network or content blocker is stopping them.</p></div>';
    window.__boardBlocked = true;
  })();
</script>
<script>if (!window.__boardBlocked) { ${js} }</script>
`;

writeFileSync(resolve(out, 'index.html'), page);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)}kb`;
console.log(`board.js ${kb(js)}   board.css ${kb(css)}   index.html ${kb(page)}`);
