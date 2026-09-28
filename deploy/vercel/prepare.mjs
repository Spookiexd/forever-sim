// Copies the production build (dist/forever, from `tools/windows/native.sh build`) into
// deploy/vercel/public/forever and adds a site-wide notice bar to every HTML page:
// the provisional-numbers label and the credit link to WoWSims (MIT) and ElliotWood/Forever.
// Kept out of the UI source so upstream merges stay conflict-free.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'dist', 'forever');
const out = join(here, 'public');

if (!existsSync(join(src, 'index.html')) || !existsSync(join(src, 'lib.wasm.gz'))) {
	console.error(`No build at ${src}. Run: bash tools/windows/native.sh build`);
	process.exit(1);
}

rmSync(out, { recursive: true, force: true });
cpSync(src, join(out, 'forever'), { recursive: true });

const NOTICE = `
<div id="spookie-notice" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;flex-wrap:wrap;gap:4px 16px;justify-content:center;align-items:center;padding:4px 12px;background:rgba(10,10,12,.92);border-top:1px solid rgba(255,255,255,.12);color:#cfd3da;font:12px/1.4 system-ui,sans-serif;text-align:center">
<strong style="color:#f0c060;font-weight:600">Provisional - not verified against in-game measurements</strong>
<span>Based on <a href="https://github.com/wowsims" target="_blank" rel="noreferrer" style="color:#7fd0e0">WoWSims</a> (MIT) via <a href="https://github.com/ElliotWood/Forever" target="_blank" rel="noreferrer" style="color:#7fd0e0">ElliotWood/Forever</a> &middot; <a href="https://github.com/Spookiexd/forever-sim/blob/master/LICENSE" target="_blank" rel="noreferrer" style="color:#7fd0e0">Licence</a></span>
</div>
<style>body{padding-bottom:32px}</style>
`;

let pages = 0;
const walk = dir => {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p);
		else if (name.endsWith('.html')) {
			const html = readFileSync(p, 'utf8');
			if (!html.includes('</body>')) continue;
			writeFileSync(p, html.replace('</body>', `${NOTICE}</body>`));
			pages++;
		}
	}
};
walk(join(out, 'forever'));
console.log(`public/forever ready, notice added to ${pages} pages`);
