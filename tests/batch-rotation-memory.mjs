import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
function pixels(rotation=0,symmetric=false,flat=false){
 const out=new Uint8ClampedArray(180*180*4);
 for(let y=0;y<180;y++)for(let x=0;x<180;x++){
  const a=Math.atan2(y-89.5,x-89.5)-rotation*Math.PI/180,r=Math.hypot(x-89.5,y-89.5),v=flat?128:symmetric?128+50*Math.cos(2*a):128+35*Math.sin(3*a+r*.04)+28*Math.cos(5*a)+24*Math.sin(7*a+r*.06)+18*Math.cos(11*a);
  const i=(y*180+x)*4;out[i]=out[i+1]=out[i+2]=v;out[i+3]=255;
 }return out;
}
const samples=new Map([['data:image/jpeg;base64,AA==',pixels()],['data:image/jpeg;base64,AQ==',pixels(90)],['tilted',pixels(14)],['flat',pixels(0,false,true)]]);
let current,closed=0;
const context={window:{},Float32Array,Math,Map,Set,setTimeout,fetch:async url=>({blob:async()=>url}),decodeIdentifyPhoto:async file=>{current=file;return {width:180,height:180,close(){closed++;}};},
 document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){},getImageData:()=>({data:samples.get(current)})})})}};
vm.createContext(context);vm.runInContext(await readFile('public/batch-rotation-memory.js','utf8'),context);
const api=context.window.BatchRotationMemory;
const reference=api.describe(pixels());
for(const turn of [-90,14,90,180]){const result=api.compare(api.describe(pixels(turn)),reference);assert(Math.abs(((result.angle+turn+540)%360)-180)<=2);assert(result.score>.82&&result.margin>.2);}
assert(api.compare(api.describe(pixels(0,true)),api.describe(pixels(0,true))).margin<.2,'Symmetric references cannot establish a direction');
assert(Math.abs(api.compare(api.describe(pixels(0,false,true)),reference).score)<1e-6);
const report={id:'saved',flow:'batch_rotation',images:{upright:'data:image/jpeg;base64,AA=='},coins:[{upright_confirmed:true,upright_image_ref:'upright'}]};
assert.equal((await api.match('tilted',[report])).angle,-14);
assert.equal(await api.match('flat',[report]),null);
assert.equal(await api.match('tilted',[]),null,'Deleting saved tests removes their references');
assert.equal(api.savedReferences([{...report,flow:'batch'},{...report,coins:[{upright_confirmed:false,upright_image_ref:'upright'}]}]).length,0);
assert.equal(api.savedReferences(Array(100).fill(report)).length,1,'Duplicate images compare once');
assert.equal(await api.match('tilted',[report,{...report,images:{upright:'data:image/jpeg;base64,AQ=='}}]),null,'Conflicting saved upright directions must not be accepted');
assert(closed>0,'Decoded image resources are released');

// Actual coordinator: local matches run even at the model quota; corrupt local
// references fall back; changed saved records invalidate cached model answers.
const events=[],rotationContext={window:{PocketMintVisionAllowance:{blocked:()=>true},BatchRotationMemory:{match:async(_file,tests)=>tests.length?({angle:0,reason:'saved_upright_reference'}):null}},identificationTests:[report],AbortSignal,Math,WeakMap,
 fetch:async()=>{events.push('model');return {ok:true,json:async()=>({confident:true,angle:0})};}};
vm.createContext(rotationContext);vm.runInContext(await readFile('public/batch-photo-rotation.js','utf8'),rotationContext);
const file={};assert.equal((await rotationContext.window.BatchPhotoRotation.suggest(file)).reason,'saved_upright_reference');assert.equal(events.length,0);
rotationContext.identificationTests=[];assert.equal((await rotationContext.window.BatchPhotoRotation.suggest(file)).reason,'allowance');
rotationContext.window.BatchRotationMemory.match=async()=>{throw Error('broken reference');};
assert.equal((await rotationContext.window.BatchPhotoRotation.suggest({})).reason,'allowance','Reference failure still reaches normal allowance/fallback handling');
rotationContext.window.PocketMintVisionAllowance.blocked=()=>false;
const canvasSizes=[];
rotationContext.decodeIdentifyPhoto=async()=>({width:180,height:180,close(){}});
rotationContext.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){},save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},rotate(){},scale(){},drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,AA==',toBlob(callback,type){canvasSizes.push([this.width,this.height]);callback(new Blob(['rotated'],{type}));}})};
rotationContext.fetch=async(_url,request)=>{const phase=JSON.parse(request.body).phase;events.push(phase);return {ok:true,json:async()=>({confident:true,angle:0})};};
const fallback=await rotationContext.window.BatchPhotoRotation.suggest({});assert.equal(fallback.confident,true);assert.deepEqual(events,['coarse8','fine9']);
events.length=0;rotationContext.window.BatchRotationMemory.match=async()=>({angle:14,reason:'saved_upright_reference'});
const originalFile={},fineResult=await rotationContext.window.BatchPhotoRotation.suggest(originalFile);
assert.equal(fineResult.angle,14);assert.notEqual(fineResult.file,originalFile);assert.equal(fineResult.file.type,'image/png');assert.equal(events.length,0);
assert(canvasSizes.at(-1).every(size=>size>180),'Oblique rotation preserves the entire photo, not a clipped square');
console.log('PASS local orientation: signed fine angles, strong-match gating, symmetry/blank/conflict rejection, confirmed-only references, cleanup, quota independence and saved-test invalidation');
