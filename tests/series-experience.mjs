import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const catalogue=JSON.parse(await readFile('public/catalogue-v2.json','utf8'));
const app=await readFile('public/app.js','utf8'),series=await readFile('public/series.js','utf8');
const variants=catalogue.designs.flatMap(d=>d.yearVariants.map(v=>({id:v.id,year:v.year,title:d.title,seriesId:d.seriesId,design_id:d.id,denomination_cents:d.denomination,denomination_display:d.denomination_display})));
const elements=new Map();
const el=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',open:false,close(){this.open=false;},showModal(){this.open=true;}});return elements.get(id);};
const timers=[],stores={myMint:new Map(),appMeta:new Map()};
let failNext=false;
const db={transaction(names){
  const staged=Object.fromEntries(Object.entries(stores).map(([name,data])=>[name,new Map(data)]));
  const tx={objectStore(name){return {
    put(value){staged[name].set(name==='myMint'?value.coin_id:value.key,structuredClone(value));},
    get(key){const request={};queueMicrotask(()=>{request.result=staged[name].get(key);request.onsuccess?.();});return request;}
  };}};
  setTimeout(()=>{if(failNext){failNext=false;tx.error=new Error('Simulated failed transaction');tx.onabort?.();return;}for(const name of typeof names==='string'?[names]:names)stores[name]=staged[name];tx.oncomplete?.();},0);
  return tx;
}};
const context={console,Date,Map,Set,Promise,structuredClone,setTimeout:callback=>timers.push(callback),clearTimeout:()=>{},document:{readyState:'loading',addEventListener:()=>{},getElementById:el,querySelector:()=>({id:'seriesView'})},window:{PocketMintCompanions:{refresh:()=>{},celebrate:()=>{}}},history:{state:{view:'seriesView',seriesId:'outback'},pushState(value){this.state=value;},back(){}},location:{hash:'#series/outback'}};
vm.createContext(context);vm.runInContext(app,context);vm.runInContext(series,context);
context.data=catalogue;context.variants=variants;
vm.runInContext('catalogueSeries=data.series;catalogueDesigns=data.designs;browseCatalogue=variants;renderAll=()=>{};openDB=async()=>db;getAll=async name=>[...stores[name].values()];put=async(name,value)=>stores[name].set(value.key||value.coin_id,structuredClone(value));',Object.assign(context,{db,stores}));
const evaluate=code=>vm.runInContext(code,context);
const outback=variants.filter(coin=>coin.seriesId==='outback');assert.equal(outback.length,2);
const [first,last]=outback;
context.first=first;context.last=last;
assert.equal(evaluate('seriesProgressFor("outback").total'),2);
assert.equal(evaluate('filteredSeriesCoins("outback",{denomination:"100"}).length'),1);
assert.ok(evaluate('filteredSeriesCoins("outback").every(c=>c.seriesId==="outback")'));
await evaluate('saveRec(first.id,{quantity:1,wishlist:true,favourite:true,notes:"kept"})');
assert.equal(evaluate('seriesProgressFor("outback").owned'),1);
assert.equal(evaluate('continueSeriesChoice().id'),'outback');
assert.equal(evaluate('state.get(first.id).wishlist'),false);assert.equal(evaluate('state.get(first.id).favourite'),true);
await evaluate('saveRec(last.id,{quantity:1})');
assert.equal(evaluate('seriesProgressFor("outback").percent'),100);
assert.equal(evaluate('milestoneHistory.size'),1);
assert.equal(stores.appMeta.get('milestone:series:outback').value.total_at_completion,2);
assert.ok(stores.myMint.get(last.id).quantity===1,'collection write committed before celebration');
await evaluate('showNextSeriesCelebration()');
assert.equal(el('seriesCelebration').open,true);
assert.match(el('seriesCelebrationContent').innerHTML,/View completed series/);
assert.equal(stores.appMeta.get('milestone:series:outback').value.seriesCompletionCelebrated,true);
assert.notEqual(evaluate('continueSeriesChoice().id'),'outback','incomplete series always wins');
el('seriesCelebration').close();
await evaluate('saveRec(last.id,{quantity:0})');await evaluate('saveRec(last.id,{quantity:1})');
assert.equal(evaluate('milestoneHistory.size'),1);assert.equal(evaluate('pendingSeriesCelebrations.length'),0);
assert.equal(evaluate('state.get(first.id).notes'),'kept');
await evaluate('loadMilestoneHistory()');assert.equal(evaluate('milestoneHistory.size'),1,'history reloads from existing IndexedDB metadata');
evaluate('renderMilestones()');assert.match(el('milestoneList').innerHTML,/data-series-id="outback"/);
await evaluate('saveRec(last.id,{quantity:0})');evaluate('renderMilestones()');assert.match(el('milestoneList').innerHTML,/Currently incomplete/);
// Failed writes cannot claim ownership or persist false completions.
failNext=true;await assert.rejects(evaluate('saveRec(last.id,{quantity:1})'),/failed transaction/);
assert.equal(evaluate('state.get(last.id).quantity'),0);
assert.equal(stores.myMint.get(last.id).quantity,0);
await evaluate('Promise.all([saveRec(first.id,{quantity:2}),saveRec(last.id,{quantity:1})])');
assert.equal(evaluate('seriesProgressFor("outback").owned'),2,'extra quantities do not increase design count');
await evaluate('Promise.all([saveRec(first.id,previous=>({quantity:previous.quantity+1})),saveRec(first.id,previous=>({quantity:previous.quantity+1}))])');
assert.equal(evaluate('state.get(first.id).quantity'),4,'rapid quantity clicks cannot lose increments');
// Multi-year designs count once, without changing taxonomy.
assert.equal(evaluate('seriesProgressFor("anzac").total'),catalogue.designs.filter(d=>d.seriesId==='anzac').length);
// Existing completions get a dated-recording baseline, not a fabricated date.
evaluate('milestoneHistory.clear()');stores.appMeta.clear();await evaluate('initialiseExistingSeriesHistory()');
assert.equal(evaluate('milestoneHistory.get("outback").completed_at'),null);
assert.equal(evaluate('milestoneHistory.get("outback").seriesCompletionCelebrated'),true);
const cameraContext={navigator:{userAgent:'Android'},openCoinCamera:async side=>`guided:${side}`,openNativeCoinCamera:side=>`native:${side}`,loadIdentifyPhoto:async()=>{},clearIdentifyPhoto:()=>{}};
vm.createContext(cameraContext);vm.runInContext(await readFile('public/camera-entry.js','utf8'),cameraContext);
assert.equal(await vm.runInContext('openCoinCamera("reverse")',cameraContext),'guided:reverse');
assert.equal(await vm.runInContext('guidedCoinCamera("reverse")',cameraContext),'guided:reverse');
cameraContext.navigator.userAgent='iPhone';assert.equal(await vm.runInContext('openCoinCamera("reverse")',cameraContext),'guided:reverse');
console.log('PASS series: exact membership, completion persistence, quantities; Android and iPhone guided camera entry');
