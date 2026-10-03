import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/pm-frames.css',import.meta.url),'utf8');
for(const name of ['album-wobble','plaque-wobble','neon-wobble','coin-wobble']){
  const svg=readFileSync(new URL(`../public/frames/${name}.svg`,import.meta.url),'utf8');
  assert.match(svg,/<path/);
  assert.match(svg,/ C| S/);
  assert.match(svg,/preserveAspectRatio="none"/);
  assert.ok(css.includes(`frames/${name}.svg`));
}
const catalogue=JSON.parse(readFileSync(new URL('../public/catalogue-v2.json',import.meta.url),'utf8'));
let total=0;
for(const series of catalogue.series){
  const path=`artwork/series/${series.id}.png`;
  assert.ok(css.includes(`data-series-id="${series.id}"`)&&css.includes(path),`${series.id} must have matching artwork`);
  const png=readFileSync(new URL(`../public/${path}`,import.meta.url));
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.ok(png.length<150000,'small UI vignette must stay lightweight');
  total+=png.length;
}
assert.ok(total<2000000,'all series art should remain under 2 MB');
assert.match(css,/Only decorative layers are shaped/);
console.log(`PASS visual assets: drawn curves, reusable frame variants, ${catalogue.series.length} scoped illustrations, ${Math.round(total/1024)} KB total`);
