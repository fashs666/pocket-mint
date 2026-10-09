import assert from 'node:assert/strict';
import worker,{parseBatchOrientation,parseUpright} from '../src/batch-orientation.js';
for(const [choice,angle] of [[1,0],[2,90],[3,180],[4,-90]])assert.deepEqual(parseBatchOrientation(`CHOICE=${choice}; CONFIDENCE=92; CUE=ONE DOLLAR reads at bottom`),{angle,confident:true,reason:'visual_orientation'});
for(const answer of ['CHOICE=unknown; CONFIDENCE=99; CUE=unknown','CHOICE=9; CONFIDENCE=99; CUE=portrait upright','CHOICE=2; CONFIDENCE=84; CUE=portrait upright','CHOICE=3; CONFIDENCE=999; CUE=portrait upright','CHOICE=2; CONFIDENCE=95; CUE=symmetric design'])assert.equal(parseBatchOrientation(answer).confident,false);
const request=()=>new Request('https://test/api/batch-orientation',{method:'POST',body:JSON.stringify({image:'data:image/jpeg;base64,AA=='})});
let calls=0;const env={AI:{run:async()=>{calls++;return {response:'CHOICE=4; CONFIDENCE=95; CUE=standing figure points upward'};}},ASSETS:{fetch:async()=>new Response('original asset')}};
assert.equal((await (await worker.fetch(request(),env)).json()).angle,-90);
assert.equal(await (await worker.fetch(new Request('https://test/'),env)).text(),'original asset');
assert.equal((await worker.fetch(new Request('https://test/api/identify'),env)).status,405);
assert.equal((await (await worker.fetch(new Request('https://test/api/photo-orientation',{method:'POST',body:JSON.stringify({image:'data:image/jpeg;base64,AA=='})}),{...env,AI:{run:async()=>({response:'COIN=yes; UPRIGHT=clear; CLOCKWISE=90; CONFIDENCE=99'})}})).json()).angle,90,'Original single-photo orientation remains unchanged');
assert.equal(calls,1);env.AI.run=async()=>{throw Error('4006: daily free allocation exceeded');};const quotaResponse=await worker.fetch(request(),env);assert.equal(quotaResponse.status,429);assert.equal((await quotaResponse.json()).diagnostic_code,'VISION-DAILY-LIMIT');
env.AI.run=async()=>{throw Error('Rate limit temporary');};assert.equal((await (await worker.fetch(request(),env)).json()).reason,'unavailable');
assert.equal((await (await worker.fetch(request(),{})).json()).reason,'unavailable');
console.log('PASS batch orientation choices, conservative parsing, explicit unavailable/quota states and unchanged single-worker routing');

assert.equal(parseUpright('UPRIGHT=yes; CONFIDENCE=98; CUE=horizontal ONE DOLLAR lettering').confident,true);
for(const text of ['UPRIGHT=no; CONFIDENCE=99; CUE=upside down text','UPRIGHT=unknown; CONFIDENCE=99; CUE=unknown','UPRIGHT=yes; CONFIDENCE=94; CUE=portrait upright','UPRIGHT=yes; CONFIDENCE=99; CUE=circle rim'])assert.equal(parseUpright(text).confident,false);
const verification=await worker.fetch(new Request('https://test/api/batch-orientation',{method:'POST',body:JSON.stringify({phase:'verify',image:'data:image/jpeg;base64,AA=='})}),{AI:{run:async()=>({response:'UPRIGHT=no; CONFIDENCE=99; CUE=sideways text'})}});assert.equal((await verification.json()).confident,false);
