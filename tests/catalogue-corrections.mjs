import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const legacy=JSON.parse(await readFile('public/catalogue.json','utf8'));
const catalogue=JSON.parse(await readFile('public/catalogue-v2.json','utf8'));
const tokyo=legacy.coins.filter(c=>c.series_id==='tokyo2020');assert.equal(tokyo.length,6);
for(const c of tokyo){assert.equal(c.denomination_cents,200);assert.equal(c.denomination_display,'$2');assert.equal(c.mass_grams,6.6);assert.equal(c.diameter_mm,20.5);assert(c.id.startsWith('AU1-2020-TOKYO2020-'),'Historical owned-record IDs remain stable');}
const designs=catalogue.designs.filter(d=>d.releaseId==='olympic_tokyo_2020');assert.equal(designs.length,6);
for(const d of designs){assert.equal(d.denomination,200);assert.equal(d.denomination_display,'$2');assert(d.id.startsWith('D100-'),'Design links remain stable');assert(tokyo.some(c=>c.id===d.yearVariants[0].id));}
assert.equal(await readFile('catalogue.json','utf8'),await readFile('public/catalogue.json','utf8'));
const browseCatalogue=catalogue.designs.flatMap(d=>d.yearVariants.map(v=>({...d,...v,series_id:d.seriesId})));
const code=await readFile('public/batch-identification.js','utf8');const search=code.slice(code.indexOf('  function searchCatalogue('),code.indexOf('  function manualSearch('));
const context={browseCatalogue};vm.createContext(context);vm.runInContext(search,context);
assert.equal(context.searchCatalogue('2020 para','$2')[0].id,'AU1-2020-TOKYO2020-PARA');assert.equal(context.searchCatalogue('2020 para','$1').length,0);
assert.equal(context.searchCatalogue('AUS Commonwealth','$2').filter(c=>c.year===2022).length,3);
assert.equal(context.searchCatalogue('Birmingham Commonwealth','$2').length,3);assert.equal(context.searchCatalogue('2018 AUS Commonwealth','$2')[0].title,'Gold Coast Commonwealth Games — Team Logo');
console.log('PASS six Tokyo $2 denominations/specs, preserved issue/design IDs, mirrored data and Commonwealth batch aliases');
