// Public-path budget (SPEC §11, CLAUDE.md): JS + CSS that index.html loads up front must stay < 200KB gzipped.
// Lazy chunks (portals, Recharts, Leaflet, ZXing) are excluded because the public page never requests them.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 200 * 1024;
const dist = new URL('../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', dist), 'utf8');

const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
if (!assets.length) {
  console.error('check-size: no assets found in dist/index.html — run the build first');
  process.exit(1);
}

let total = 0;
for (const a of new Set(assets)) {
  const size = gzipSync(readFileSync(new URL(a, dist))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${a}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  total gzipped (budget ${BUDGET / 1024} KB)`);

if (total > BUDGET) {
  console.error('check-size: public path is over budget');
  process.exit(1);
}
