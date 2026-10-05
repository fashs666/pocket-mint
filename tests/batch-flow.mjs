import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import worker from '../src/index.js';
import {parseBatchCheck} from '../src/identify-circulating.js';
const catalogue=JSON.parse(await readFile('public/catalogue-v2.json','utf8'));
const legacy=JSON.parse(await readFile('public/catalogue.json','utf8'));
const photo='data:image/jpeg;base64,AA==';
async function identify(answer,options={}){
 const calls=[],answers=Array.isArray(answer)?[...answer]:[answer];
 const response=await worker.fetch(new Request('https://pocket-mint.test/api/identify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'circulating',reverse:photo,batch_coin:true,...options})}),{ENABLE_STABLE_DOLLAR_MATCHER:'false',REFERENCE_FETCH:async()=>new Response('',{status:404}),AI:{run:async(_model,input)=>{calls.push(input);assert.ok(answers.length,'Unexpected vision call');return {response:answers.shift()};}},ASSETS:{fetch:async url=>String(url).includes('catalogue-v2')?new Response(JSON.stringify(catalogue)):String(url).includes('catalogue.json')?new Response(JSON.stringify(legacy)):new Response('',{status:404})}});
 return {data:await response.json(),calls,status:response.status};
}
for(const [answer,status] of [
 ['COIN=no; COUNT=0; SIDE=unknown; QUALITY=clear; CONFIDENCE=99','not_coin'],
 ['COIN=yes; COUNT=2; SIDE=design; QUALITY=clear; CONFIDENCE=95','multiple_coins'],
 ['COIN=unknown; COUNT=1; SIDE=unknown; QUALITY=unknown; CONFIDENCE=30','check_coin'],
 ['COIN=yes; COUNT=0; SIDE=design; QUALITY=clear; CONFIDENCE=99','check_coin'],
 ['COIN=yes; COUNT=unknown; SIDE=design; QUALITY=clear; CONFIDENCE=99','check_coin'],
 ['COIN=yes; COUNT=1; SIDE=portrait; QUALITY=clear; CONFIDENCE=95','needs_other_side'],
 ['COIN=yes; COUNT=1; SIDE=design; QUALITY=poor; CONFIDENCE=95','low_quality'],
 ['not a structured answer','check_coin']]){
 const result=await identify(answer);assert.equal(result.data.status,status);assert.equal(result.data.matches.length,0);assert.equal(result.calls.length,1,'Rejected crops must never reach catalogue matching');
}
const checked=await identify('COIN=yes; COUNT=1; SIDE=design; QUALITY=clear; CONFIDENCE=93',{batch_check:true});
assert.equal(checked.data.status,'ready');assert.equal(checked.calls.length,1);
const reviewed=await identify(['DENOM=5c; CONFIDENCE=95; WORDS=FIVE CENTS; MOTIF=echidna','DESIGN=Echidna; CONFIDENCE=95; REASON=visible spiny echidna'],{batch_reviewed:true});
assert.equal(reviewed.data.observed.design,'Echidna');assert.equal(reviewed.calls.length,2,'Reviewed batch crops go directly to the unchanged single matcher');
for(const [path,hash] of Object.entries({
 'public/identify.js':'d9e7eac57ec1c05f81a8954c888774583dae25dfbcadc38dee7cbe044373f0b8',
 'public/identify.css':'61cbce2341a0362c1f17bc59b4f61f95842c36e5e6eee1ca0d37ed9b09329965',
 'src/identify-single.js':'2095df4e9e592c9bffe582c8d65e799da71e608dbd7ef6e83bbe769ded57d413',
 'src/index.js':'ddd2ea47e8cf162cf01e0e963703615929e6553016e7dd11fc2abc89d8c94e45'
}))assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash,`${path}: single-coin code must remain byte-for-byte unchanged`);
const matched=await identify(['COIN=yes; COUNT=1; SIDE=design; QUALITY=clear; CONFIDENCE=93','DENOM=5c; CONFIDENCE=95; WORDS=FIVE CENTS; MOTIF=echidna','DESIGN=Echidna; CONFIDENCE=95; REASON=visible spiny echidna']);assert.equal(matched.status,200);assert.equal(matched.data.observed.design,'Echidna');assert.ok(matched.data.matches.length);assert.equal(matched.calls.length,3,'Coin check must precede current design matching');
assert.equal(parseBatchCheck('COIN=yes; COUNT=1; SIDE=design; QUALITY=clear; CONFIDENCE=999').confidence,100);
console.log('PASS non-coins, multiple coins, malformed checks, poor photos and portrait sides never reach matching');
const variants=catalogue.designs.flatMap(d=>d.yearVariants.map(v=>({...v,design_id:d.id,title:d.title,denomination_display:d.denomination_display})));
const coin=variants.find(c=>c.denomination_display==='5c');
function node(){return {children:[],dataset:{},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(){},add(){},classList:{},value:''};}
const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
let resolveResponse,fetchCount=0;
class Reader{readAsDataURL(){this.result=photo;this.onload();}}
const context={window:{},document:{getElementById:element,createElement:node,createTextNode:text=>text},AbortSignal,Option:function(text,value){return {text,value}},FileReader:Reader,fetch:async()=>{fetchCount++;return await new Promise(resolve=>resolveResponse=resolve)},coinById:id=>variants.find(c=>c.id===id),designVariants:c=>variants.filter(v=>v.design_id===c.design_id),browseCatalogue:variants};
vm.createContext(context);
const code=(await readFile('public/batch-identification.js','utf8')).replace('window.BatchIdentificationCore={classify};','window.BatchIdentificationCore={classify,identifyOne,getResult:id=>results.get(id)};');
vm.runInContext(code,context);
const crop={id:'physical-a',x:10,y:10,width:50,height:50,reviewed:true,detectionNumber:4,crop:{},cropUrl:photo};
context.window.BatchIdentification.render([crop]);
const request=context.window.BatchIdentificationCore.identifyOne(crop);
await new Promise(resolve=>setImmediate(resolve));
assert.equal(fetchCount,1);
context.window.BatchIdentification.sync([]);context.window.BatchIdentification.render([]);
resolveResponse({ok:true,json:async()=>({matches:[{id:coin.id,confidence:.9}],uncertain:false})});await request;
assert.equal(context.window.BatchIdentificationCore.getResult(crop.id),undefined,'Removed crop must not regain an async result');
const unchecked={...crop,id:'unchecked',reviewed:false};context.window.BatchIdentification.render([unchecked]);await context.window.BatchIdentificationCore.identifyOne(unchecked);assert.equal(fetchCount,1,'Unreviewed objects must not be identified');
const prediction=context.window.BatchIdentificationCore.classify({matches:[{id:coin.id,confidence:.9}],uncertain:false});assert.equal(prediction.ready,false);
console.log('PASS crop identity, stale-result rejection, review gate and explicit collection confirmation');
