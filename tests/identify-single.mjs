import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../src/index.js';
import {singleCoinCandidates,hasDesignClues,readSingleDenomination} from '../src/identify-single.js';
const catalogue=JSON.parse(await readFile('public/catalogue-v2.json','utf8'));
const legacy=JSON.parse(await readFile('public/catalogue.json','utf8'));
const reverse='data:image/jpeg;base64,AA==';
async function identify(answers,{reference=false,...overrides}={}){
  const calls=[];
  const image=()=>new Response(new Uint8Array([255,216,255,217]),{headers:{'content-type':'image/jpeg'}});
  const response=await worker.fetch(new Request('https://test/api/identify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'circulating',single_coin:true,reverse,...overrides})}),{
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
render('2024',95,true);assert.match(element('identifyResults').innerHTML,/Review candidate/);assert.match(element('identifyResults').innerHTML,/disabled/);
const source=await readFile('public/identify.js','utf8');
const loadPhoto=source.slice(source.indexOf('async function loadIdentifyPhoto'),source.indexOf('function renderPhotoQuality'));
assert.ok(loadPhoto.includes('prepareIdentifyPhoto(file)'));assert.ok(!loadPhoto.includes('createCircularSpecimen(file)'));
console.log('PASS single: six denominations, Roos uncertainty, semantic candidates, image verification, year safety, renderer and intact photo preparation');
