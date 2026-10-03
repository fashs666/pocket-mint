import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/pm-frames.css',import.meta.url),'utf8');
for(const name of ['album-wobble','plaque-wobble']){
  const svg=readFileSync(new URL(`../public/frames/${name}.svg`,import.meta.url),'utf8');
  assert.match(svg,/<path/);
  assert.match(svg,/ C| S/);
  assert.match(svg,/preserveAspectRatio="none"/);
  assert.ok(css.includes(`frames/${name}.svg`));
}
assert.ok(css.includes('artwork/outback-windmill.png'));
const png=readFileSync(new URL('../public/artwork/outback-windmill.png',import.meta.url));
assert.equal(png.subarray(1,4).toString(),'PNG');
assert.ok(png.length<150000,'small UI vignette must stay lightweight');
assert.match(css,/pm-series-card\[data-series-id="outback"\]/);
assert.match(css,/Only decorative layers are shaped/);
console.log('PASS visual assets: drawn curves, reusable frame variants, scoped Outback art and lightweight PNG');
