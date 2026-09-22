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

import { build, transform } from 'esbuild';
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

/**
 * React, ReactDOM and Framer Motion are inlined, not fetched.
 *
 * They were loaded from cdnjs and jsDelivr, which the artifact host's CSP
 * nominally allows - but in practice the scripts did not arrive in a real
 * client and the page showed nothing but its own "could not load" notice. A
 * page that needs the network to render is a page that sometimes does not
 * render, and at ~90KB gzipped there is no reason to take the risk.
 *
 * Order matters: React first, then ReactDOM, then Framer Motion (its UMD
 * reads the `React` global and defines `Motion`), then the board.
 */
const VENDOR = [
  'node_modules/react/umd/react.production.min.js',
  'node_modules/react-dom/umd/react-dom.production.min.js',
  'node_modules/framer-motion/dist/framer-motion.js',
];

const vendor = [];
for (const rel of VENDOR) {
  const source = readFileSync(resolve(root, rel), 'utf8');
  // The Framer Motion UMD ships unminified; squeeze all three the same way.
  const { code } = await transform(source, { minify: true, target: 'es2019', legalComments: 'none' });
  vendor.push(code);
}

const page = `<title>Theomachy Board</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>${css}</style>

<div id="root"></div>

${vendor.map((code) => `<script>${code}</script>`).join('\n')}
<script>
  // Nothing here is fetched, so a blank board means a real error. Say so
  // rather than leaving an empty page.
  try {
    ${js}
  } catch (err) {
    document.getElementById('root').innerHTML =
      '<div style="font:14px ui-monospace,monospace;color:#94a3b8;padding:48px;max-width:46em;margin:0 auto">'
      + '<p style="color:#f0a0a0"><b>The board failed to start.</b></p><p>' + String(err && err.message || err)
      + '</p></div>';
    throw err;
  }
</script>
`;

writeFileSync(resolve(out, 'index.html'), page);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)}kb`;
console.log(`board.js ${kb(js)}   board.css ${kb(css)}   ` +
  `vendor ${kb(vendor.join(''))}   index.html ${kb(page)}`);
console.log('No runtime fetches: React, ReactDOM and Framer Motion are inlined.');
