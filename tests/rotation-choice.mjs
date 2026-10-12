import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ROTATION_MODEL,ROTATION_ANGLES,ROTATION_PROMPTS,parseRenderedChoice,renderedOrientation} from '../src/rotation-choice.js';
import worker from '../src/batch-orientation.js';
for(const phase of ['coarse8','fine9'])for(const [i,angle] of ROTATION_ANGLES[phase].entries())assert.equal(parseRenderedChoice(JSON.stringify({choice:i+1,confidence:95,cue:'actual ONE DOLLAR letters'}),phase).angle,angle);
for(const choice of [null,0,10,'2',true,1.5])assert.equal(parseRenderedChoice(JSON.stringify({choice,confidence:95,cue:'actual letters'}),'fine9').confident,false);
for(const confidence of [89,101,null,'95'])assert.equal(parseRenderedChoice(JSON.stringify({choice:1,confidence,cue:'actual letters'}),'coarse8').confident,false);
for(const cue of ['unknown','symmetric design','unreadable text','circle rim',''])assert.equal(parseRenderedChoice(JSON.stringify({choice:1,confidence:99,cue}),'coarse8').confident,false);
assert.equal(parseRenderedChoice('not JSON','fine9').confident,false);assert.equal(parseRenderedChoice('{"choice":1,"confidence":95,"cue":"letters"}','constructor').confident,false);
assert.equal(parseRenderedChoice('```json\n{"choice":4,"confidence":95,"cue":"upright letters"}\n```','fine9').angle,-7.5);
const image='data:image/jpeg;base64,AA==';
let calls=0;
const ai={run:async(model,input)=>{calls++;assert.equal(model,ROTATION_MODEL);assert.equal(input.messages[0].content[0].text,ROTATION_PROMPTS.fine9);assert.equal(input.messages[0].content[1].image_url.url,image);assert.equal(input.chat_template_kwargs.enable_thinking,false);assert.equal(input.store,false);return {choices:[{message:{content:'{"choice":4,"confidence":95,"cue":"upright letters"}'}}],usage:{neurons:75.25}};}};
assert.equal((await renderedOrientation(ai,'fine9',image)).angle,-7.5);
const req=()=>new Request('https://test/api/batch-orientation',{method:'POST',body:JSON.stringify({phase:'fine9',image})});
const response=await worker.fetch(req(),{AI:ai});assert.equal((await response.json()).angle,-7.5);assert.equal(JSON.parse(response.headers.get('x-pocket-mint-usage')).neurons,75.25);
assert.equal(calls,2);assert.equal((await worker.fetch(req(),{AI:{run:async()=>{throw Error('4006 daily free allocation');}}})).status,429);

// Execute the actual client: direction + fine delta rotate the original once;
// unknown/boundary/error/quota responses keep the original with no late retry.
let responses=[],requests=[],turns=[],closed=0;
const context={window:{},AbortSignal,WeakMap,Math,decodeIdentifyPhoto:async()=>({width:180,height:180,close(){closed++;}}),
 document:{createElement:()=>({getContext:()=>({fillRect(){},fillText(){},save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},rotate:a=>turns.push(a),scale(){},drawImage(){}}),toDataURL:()=>image,toBlob:fn=>fn(new Blob(['pixels'],{type:'image/png'}))})},
 fetch:async(_url,request)=>{requests.push(JSON.parse(request.body));const next=responses.shift();return {ok:next.ok!==false,json:async()=>next};}};
vm.createContext(context);vm.runInContext(await readFile('public/batch-photo-rotation.js','utf8'),context);
const api=context.window.BatchPhotoRotation;
async function run(first,second){responses=[first,second];requests=[];turns=[];const file={};return {file,result:await api.suggest(file)};}
let test=await run({angle:90,confident:true},{angle:-22.5,confident:true});assert.equal(test.result.angle,67.5);assert.notEqual(test.result.file,test.file);assert.equal(requests.length,2);assert.deepEqual(requests.map(r=>r.phase),['coarse8','fine9']);assert.equal(turns.at(-1),67.5*Math.PI/180);
test=await run({angle:0,confident:true},{angle:0,confident:true});assert.equal(test.result.file,test.file);
for(const angle of [-30,30,8]){test=await run({angle:90,confident:true},{angle,confident:true});assert.equal(test.result.file,test.file);assert.equal(test.result.confident,false);}
test=await run({angle:0,confident:false,reason:'uncertain'});assert.equal(requests.length,1);assert.equal(test.result.file,test.file);
test=await run({ok:false,reason:'allowance'});assert.equal(requests.length,1);assert.equal(test.result.reason,'allowance');
assert(closed>0);console.log('PASS rendered rotation: eight directions, fine delta, strict parsing, provider usage, one original-image rotation, zero/edge/uncertain/quota safety and unchanged legacy worker');
