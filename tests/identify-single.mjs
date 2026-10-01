import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../src/index.js';
import {singleCoinCandidates,hasDesignClues,readSingleDenomination,normalizeSingleObservation} from '../src/identify-single.js';
const catalogue=JSON.parse(await readFile('public/catalogue-v2.json','utf8'));
const legacy=JSON.parse(await readFile('public/catalogue.json','utf8'));
const reverse='data:image/jpeg;base64,AA==';
async function identify(answers,{reference=false,stableDollar=false,...overrides}={}){
  const calls=[];
  const image=()=>new Response(new Uint8Array([255,216,255,217]),{headers:{'content-type':'image/jpeg'}});
  const response=await worker.fetch(new Request('https://test/api/identify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'circulating',single_coin:true,reverse,...overrides})}),{
    ENABLE_STABLE_DOLLAR_MATCHER:stableDollar?'true':'false',
    AI:{run:async(_model,input)=>{calls.push(input);assert.ok(answers.length,'unexpected extra vision call');return {response:answers.shift()};}},
    REFERENCE_FETCH:async()=>reference?image():new Response('',{status:404}),
    ASSETS:{fetch:async request=>String(request).includes('catalogue-v2')?new Response(JSON.stringify(catalogue)):String(request).includes('catalogue.json')?new Response(JSON.stringify(legacy)):reference?image():new Response('',{status:404})}
  });
  return {status:response.status,data:await response.json(),calls};
}
assert.equal(hasDesignClues({words:'TWO DOLLARS',motif:'round gold coin'}),false);
assert.equal(readSingleDenomination('DENOM=unknown; CONFIDENCE=100; WORDS=ONE DOLLAR QANTAS CENTENARY').denomination,'$1');
assert.equal(readSingleDenomination('DENOM=$ 2; CONFIDENCE=95; WORDS=unknown').denomination,'$2');
assert.equal(readSingleDenomination('DENOM=10 cents; CONFIDENCE=95; WORDS=unknown').denomination,'10c');
assert.equal(readSingleDenomination('DENOM=$2; CONFIDENCE=95; WORDS=ONE DOLLAR').conflict,true);
assert.equal(readSingleDenomination('DENOM=unknown; CONFIDENCE=95; WORDS=2024; MOTIF=gold small circle').denomination,'unknown');
assert.equal(readSingleDenomination('DENOM=$1|unknown; CONFIDENCE=100; WORDS=DOLLAR').denomination,'$1');
assert.equal(readSingleDenomination('DENOM=$1|$2|unknown; CONFIDENCE=100; WORDS=DOLLAR').denomination,'unknown');
assert.equal(normalizeSingleObservation({words:['Centenary','of Scouting'],confidence:50}).words,'Centenary of Scouting');
const exportedCases=JSON.parse(await readFile('tests/fixtures/single-v01412-observations.json','utf8')).cases;
for(const fixture of exportedCases){
  const observed=fixture.observed;
  const raw=`DENOM=${observed.denomination_reading}; CONFIDENCE=${observed.denomination_confidence}; WORDS=${observed.words}; MOTIF=${observed.motif}`;
  // The export lacks later vision replies. Deliberately return unknown to
  // verify retrieval survives uncertainty without inventing a correct match.
  const replay=await identify([raw,'DESIGN=unknown; CONFIDENCE=0']);
  assert.equal(replay.status,200);
  assert.equal(replay.calls.length,2,`${fixture.name}: must reach design matching`);
  assert.equal(replay.data.observed.denomination,'$1');
  assert.equal(replay.data.uncertain,true);
  assert.doesNotMatch(replay.data.reason,/could not read the face value/);
  if(fixture.name==='scouting'){
    assert.equal(replay.data.observed.denomination_confidence,50);
    assert.equal(replay.data.observed.denomination_uncertain,true);
    assert.ok(replay.data.matches.some(match=>catalogue.designs.find(design=>design.title==='Centenary of Scouting in Australia').yearVariants.some(variant=>variant.id===match.id)),'Scouting must remain a review candidate');
  }
}
const broad=singleCoinCandidates(catalogue.designs.filter(design=>design.denomination===100),{words:['Centenary of Scouting','1 Dollar'],motif:'Australian emblem'});
assert.equal(broad[0].title,'Centenary of Scouting in Australia');
const weakValue=await identify(['DENOM=$1; CONFIDENCE=50; WORDS=Centenary of Scouting 1 Dollar; MOTIF=fleur-de-lis','DESIGN=Centenary of Scouting in Australia; CONFIDENCE=95']);
assert.equal(weakValue.data.uncertain,true,'weak denomination must not turn into a confirmed result');
assert.ok(weakValue.data.matches.length);
const newCases=JSON.parse(await readFile('tests/fixtures/single-v01413-observations.json','utf8')).cases;
for(const fixture of newCases){
  const o=fixture.observed;
  const replay=await identify([`DENOM=${o.denomination_reading}; CONFIDENCE=${o.denomination_confidence}; WORDS=${o.words}; MOTIF=${o.motif}`,'DESIGN=unknown; CONFIDENCE=100']);
  assert.equal(replay.status,200);
  assert.equal(replay.calls.length,2);
  assert.ok(replay.data.observed.retrieved_design_count<=8);
  assert.equal(replay.data.observed.design_confidence,0,'confidence in unknown cannot be design certainty');
  assert.equal(replay.data.uncertain,true);
  if(fixture.expected_coin_id)assert.ok(replay.data.matches.some(match=>match.id===fixture.expected_coin_id),`${fixture.name}: known design must remain available for comparison`);
  else assert.equal(replay.data.matches.length,0,'vague lines must not produce arbitrary catalogue cards');
  if(fixture.name==='scouting-unreadable-value'){
    assert.equal(replay.data.observed.denomination,'unknown');
    assert.equal(replay.data.observed.denomination_uncertain,true);
    assert.doesNotMatch(replay.data.reason,/could not read the face value/);
  }
}
const bicentCandidates=singleCoinCandidates(catalogue.designs.filter(d=>d.denomination===100),{words:'ONE DOLLAR',motif:'kangaroo, star shape'});
assert.equal(bicentCandidates[0].title,'Australian Bicentenary');
// A faulty first motif cannot hard-exclude a later image-backed nomination.
const outsideHints=await identify(['DENOM=$1; CONFIDENCE=100; WORDS=ONE DOLLAR; MOTIF=bird','DESIGN=Year of the Outback; CONFIDENCE=95; REASON=visible map and inscription']);
assert.equal(outsideHints.data.matches[0]?.id,'AU1-2002-OUTBACK');
assert.ok(!outsideHints.calls[1].messages[1].content[0].text.includes('Five Kangaroos | International Year of Peace'),'no arbitrary catalogue-order list');
const unknownValue=await identify(['DENOM=unknown; CONFIDENCE=100; WORDS=Centenary of Scouting Scouts; MOTIF=fleur-de-lis','DESIGN=Centenary of Scouting in Australia; CONFIDENCE=95']);
assert.equal(unknownValue.data.uncertain,true);
assert.equal(unknownValue.data.observed.denomination,'unknown');
assert.equal(unknownValue.data.matches[0]?.id,'AU1-2008-SCOUTING');
const shortScouting=await identify(['DENOM=$1; CONFIDENCE=100; WORDS=Centenary of Scouting; MOTIF=fleur-de-lis','DESIGN=Centenary of Scouting; CONFIDENCE=95']);
assert.equal(shortScouting.data.matches[0]?.id,'AU1-2008-SCOUTING');
assert.equal(shortScouting.data.uncertain,false);
const vagueName=await identify(['DENOM=$1; CONFIDENCE=100; WORDS=ONE DOLLAR; MOTIF=kangaroo','DESIGN=Five; CONFIDENCE=100']);
assert.equal(vagueName.data.uncertain,true,'a vague partial name cannot identify a design');
// Restore the independently exercised pre-regression dollar recognition path.
// Its exact catalogue design survives an unavailable optional comparison.
for(const [words,title,id] of [['Centenary of Scouting Australia 1 dollar','Centenary of Scouting in Australia','AU1-2008-SCOUTING'],['ONE DOLLAR','Year of the Outback','AU1-2002-OUTBACK'],['Donation Dollar','Donation Dollar','AU1-2025-DONATION']]){
  const stable=await identify([`DENOM=$1; CONFIDENCE=100; WORDS=${words}; MOTIF=emblem`,`DESIGN=${title}; TYPE=commemorative; WORDS=${words}; SUBJECT=visible artwork; KANGAROOS=unknown; CONFIDENCE=100`],{stableDollar:true});
  assert.equal(stable.data.uncertain,false);
  assert.equal(stable.data.observed.matching_engine,'stable-dollar');
  assert.equal(stable.calls.length,2,'no extra nomination or mandatory reference veto');
  assert.ok(catalogue.designs.find(d=>d.title===title&&d.denomination===100).yearVariants.some(v=>v.id===stable.data.matches[0]?.id));
  assert.equal(stable.data.observed.year,null);
}
const stableWrongYear=await identify(['DENOM=$1; CONFIDENCE=100; WORDS=Outback; MOTIF=map','DESIGN=Year of the Outback; TYPE=commemorative; WORDS=OUTBACK; CONFIDENCE=100','YEAR=2008; CONFIDENCE=100'],{stableDollar:true,obverse:reverse});
assert.equal(stableWrongYear.data.matches.length,0,'restoration must retain the current stamped-year check');
const stableConflict=await identify(['DENOM=$1; CONFIDENCE=100; WORDS=Centenary of Scouting Scouts; MOTIF=fleur-de-lis','DESIGN=100 Years of Qantas; TYPE=commemorative; WORDS=QANTAS; CONFIDENCE=100','DESIGN=Centenary of Scouting in Australia; CONFIDENCE=95'],{stableDollar:true});
assert.equal(stableConflict.data.matches[0]?.id,'AU1-2008-SCOUTING','independent distinctive text must reject an inconsistent legacy design');
const stableRoosFallback=await identify(['DENOM=$1; CONFIDENCE=100; WORDS=ONE DOLLAR; MOTIF=group of kangaroos','DESIGN=unknown; TYPE=standard; WORDS=ONE DOLLAR; SUBJECT=kangaroos; CONFIDENCE=100','DESIGN=Five Kangaroos; CONFIDENCE=95; KANGAROOS=5'],{stableDollar:true});
assert.equal(stableRoosFallback.data.observed.matching_engine,'circulating-design');
assert.equal(stableRoosFallback.data.observed.design,'Five Kangaroos');
const repairedValue=await identify(['DENOM=unknown; CONFIDENCE=100; WORDS=ONE DOLLAR QANTAS CENTENARY; MOTIF=airplane','DESIGN=100 Years of Qantas; CONFIDENCE=95']);
assert.equal(repairedValue.data.matches[0]?.id,'AU1-2020-QANTAS');
assert.equal(singleCoinCandidates(catalogue.designs.filter(d=>d.denomination===10),{words:'unknown',motif:'bird with long tail feathers'})[0].title,'Lyrebird');
assert.ok(singleCoinCandidates(catalogue.designs.filter(d=>d.denomination===20),{words:'unknown',motif:'cricketer holding bat'}).some(d=>d.title==='Sir Donald Bradman'));
for(const [denom,title,motif] of [['5c','Echidna','spiny anteater'],['10c','Lyrebird','bird tail feathers'],['20c','Platypus','duck bill swimming'],['50c','Commonwealth Coat of Arms (dodecagonal)','coat of arms'],['$1','100 Years of Qantas','Qantas aircraft'],['$2','War Animals Remembrance / Purple Poppy','purple poppy']]){
  const {data}=await identify([`DENOM=${denom}; CONFIDENCE=95; WORDS=unknown; MOTIF=${motif}`,`DESIGN=${title}; CONFIDENCE=90; REASON=visible distinctive artwork`]);
  assert.equal(data.uncertain,false,JSON.stringify(data));
  assert.ok(catalogue.designs.find(d=>d.title===title&&d.denomination_display===denom).yearVariants.some(v=>v.id===data.matches[0].id));
}
for(const [title,count] of [['Five Kangaroos',5],['Mob of Six Roos',6]]){
  const {data}=await identify(['DENOM=$1; CONFIDENCE=95; WORDS=unknown; MOTIF=group of kangaroos',`DESIGN=${title}; CONFIDENCE=92; KANGAROOS=${count}; REASON=all kangaroos visible`]);
  assert.equal(data.uncertain,false);assert.equal(data.observed.design,title);assert.equal(data.observed.year,null);
}
const uncertain=await identify(['DENOM=$1; CONFIDENCE=95; WORDS=unknown; MOTIF=group of kangaroos','DESIGN=Five Kangaroos; CONFIDENCE=92; KANGAROOS=unknown']);
assert.equal(uncertain.data.uncertain,true);assert.ok(uncertain.data.matches.length>=2);assert.equal(uncertain.data.observed.year,null);
const contradictory=await identify(['DENOM=$1; CONFIDENCE=95; WORDS=unknown; MOTIF=group of kangaroos','DESIGN=Five Kangaroos; CONFIDENCE=92; KANGAROOS=6']);
assert.equal(contradictory.data.uncertain,true);
const verifiedRoos=await identify(['DENOM=$1; CONFIDENCE=95; WORDS=unknown; MOTIF=group of kangaroos','DESIGN=Five Kangaroos; CONFIDENCE=92; KANGAROOS=6','DESIGN=Five Kangaroos; CONFIDENCE=97; REASON=matching arrangement against the exact reverse'],{reference:true});
assert.equal(verifiedRoos.data.uncertain,false);assert.equal(verifiedRoos.data.observed.design,'Five Kangaroos');assert.equal(verifiedRoos.data.observed.kangaroo_count,null);assert.equal(verifiedRoos.data.observed.kangaroo_count_conflict,true);
const referenceMatch=await identify(['DENOM=10c; CONFIDENCE=95; WORDS=unknown; MOTIF=bird tail feathers','DESIGN=Lyrebird; CONFIDENCE=90','DESIGN=Lyrebird; CONFIDENCE=93; REASON=matching tail pattern'],{reference:true});
assert.equal(referenceMatch.data.uncertain,false);assert.equal(referenceMatch.data.observed.reference_status,'checked');
assert.equal(referenceMatch.calls[2].messages[1].content.filter(item=>item.type==='image_url').length,2);
const referenceReject=await identify(['DENOM=10c; CONFIDENCE=95; WORDS=unknown; MOTIF=bird tail feathers','DESIGN=Lyrebird; CONFIDENCE=90','DESIGN=unknown; CONFIDENCE=90'],{reference:true});
assert.equal(referenceReject.data.uncertain,true);
const year=await identify(['DENOM=10c; CONFIDENCE=95; WORDS=unknown; MOTIF=lyrebird','DESIGN=Lyrebird; CONFIDENCE=90','YEAR=2024; CONFIDENCE=95'],{obverse:reverse});
assert.equal(year.data.observed.year,'2024');assert.equal(year.data.observed.year_confidence,95);assert.equal(year.data.needs_year,false);
const lowYear=await identify(['DENOM=10c; CONFIDENCE=95; WORDS=unknown; MOTIF=lyrebird','DESIGN=Lyrebird; CONFIDENCE=90','YEAR=2024; CONFIDENCE=45'],{obverse:reverse});
assert.equal(lowYear.data.observed.year,null);assert.equal(lowYear.data.needs_year,true);
const wrongYear=await identify(['DENOM=20c; CONFIDENCE=95; WORDS=Bradman; MOTIF=cricketer','DESIGN=Sir Donald Bradman; CONFIDENCE=90','YEAR=2018; CONFIDENCE=95'],{obverse:reverse});
assert.equal(wrongYear.data.uncertain,true);assert.equal(wrongYear.data.matches.length,0);
const generic=await identify(['DENOM=$2; CONFIDENCE=95; WORDS=two dollars; MOTIF=round gold coin']);
assert.equal(generic.data.matches.length,0);assert.equal(generic.calls.length,1);
const mismatch=await identify(['DENOM=$2; CONFIDENCE=95; WORDS=unknown; MOTIF=unknown'],{denomination:'5c'});
assert.equal(mismatch.data.matches.length,0);assert.match(mismatch.data.reason,/selected/);
const collector=await identify(['DENOM=$1; CONFIDENCE=95; WORDS=Bluey; MOTIF=Christmas tree','DESIGN=Bluey Christmas; CONFIDENCE=95']);
assert.equal(collector.data.uncertain,true);assert.equal(collector.data.matches.some(m=>m.id==='AU1-2025-BLUEY-CHRISTMAS'),false);

// Verify the actual result renderer chooses a year only when read confidently,
// keeps same-year variants unresolved, and labels uncertain candidates honestly.
const variants=catalogue.designs.flatMap(d=>d.yearVariants.map(v=>({...v,title:d.title,design_id:d.id,denomination_display:d.denomination_display})));
const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',hidden:false,querySelectorAll:()=>[]});return elements.get(id);};
const context={document:{getElementById:element},window:{},esc:String,human:String,coinImageHtml:()=>'',variantIssueLabel:v=>String(v.year),designVariants:coin=>variants.filter(v=>v.design_id===coin.design_id)};
vm.createContext(context);vm.runInContext(await readFile('public/identify.js','utf8'),context);
context.coin=variants.find(v=>v.title==='Lyrebird');
const render=(year,conf,uncertain=false)=>vm.runInContext(`identifyState.results=[{coin,confidence:90,reasons:[]}];identifyState.resultSource='visual';identifyState.lastObserved={year:${JSON.stringify(year)},year_confidence:${conf}};identifyState.uncertain=${uncertain};renderIdentifyResults();`,context);
render('2024',95);assert.match(element('identifyResults').innerHTML,/AU10-2024-LYREBIRD" selected/);assert.doesNotMatch(element('identifyResults').innerHTML,/disabled/);
render('2024',45);assert.match(element('identifyResults').innerHTML,/Choose issue/);assert.match(element('identifyResults').innerHTML,/disabled/);
render('2024',95,true);assert.match(element('identifyResults').innerHTML,/Review candidate/);assert.match(element('identifyResults').innerHTML,/disabled/);assert.doesNotMatch(element('identifyResults').innerHTML,/BEST MATCH/);
const source=await readFile('public/identify.js','utf8');
const loadPhoto=source.slice(source.indexOf('async function loadIdentifyPhoto'),source.indexOf('function renderPhotoQuality'));
assert.ok(loadPhoto.includes('prepareIdentifyPhoto(file)'));assert.ok(!loadPhoto.includes('createCircularSpecimen(file)'));
console.log('PASS single: six denominations, Roos uncertainty, semantic candidates, image verification, year safety, renderer and intact photo preparation');
