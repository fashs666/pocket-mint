import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:'',textContent:''});return elements.get(id);};
const context={document:{getElementById:element},Promise};
vm.createContext(context);vm.runInContext(await readFile('public/identify.js','utf8'),context);
let settings={focusMode:'continuous',focusDistance:1};
let constraints=[];
context.track={getCapabilities:()=>({focusMode:['continuous','manual'],focusDistance:{min:0,max:10,step:.1}}),getSettings:()=>settings,applyConstraints:async value=>{constraints.push(value);settings={focusMode:value.focusMode.exact,focusDistance:value.focusDistance?.exact??1};}};
vm.runInContext('coinCameraStream={getVideoTracks:()=>[track]}',context);
await vm.runInContext('setupCoinCameraControls()',context);
assert.equal(element('coinCameraFocusRow').hidden,false);
await vm.runInContext('setCoinCameraFocus(3)',context);
assert.equal(settings.focusMode,'manual');assert.equal(settings.focusDistance,3);
assert.match(element('coinCameraStatus').textContent,/small lettering/);
context.track.applyConstraints=async()=>{throw new Error('unsupported');};
await vm.runInContext('setCoinCameraFocus(4)',context);
assert.equal(element('coinCameraFocusRow').hidden,true);
assert.match(element('coinCameraStatus').textContent,/phone camera/);
context.track.getCapabilities=()=>({});
await vm.runInContext('setupCoinCameraControls()',context);
assert.equal(element('coinCameraFocusRow').hidden,true,'no fake focus control when unsupported');
const pixels=new Uint8ClampedArray(64*64*4);
for(let i=0;i<64*64;i++){pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=120;pixels[i*4+3]=255;}
context.pixels=pixels;
assert.equal(vm.runInContext('measureCoinDetail(pixels,64).laplacian_variance',context),0);
for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=((x>>2)+(y>>2))%2?210:30;}
assert.ok(vm.runInContext('measureCoinDetail(pixels,64).laplacian_variance',context)>35);
// Sharp whole-frame edges must not erase a soft central-detail warning.
const canvas={width:96,height:96};
canvas.getContext=()=>({drawImage:()=>{},getImageData:()=>{
  const size=canvas.width,data=new Uint8ClampedArray(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,value=size===96?(x%2?210:30):120;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  return {data};
}});
context.document.createElement=()=>canvas;
context.createImageBitmap=async()=>({width:768,height:768,close:()=>{}});
context.file={size:100000,type:'image/jpeg'};
const quality=await vm.runInContext('inspectIdentifyPhoto(file)',context);
assert.ok(quality.warnings.some(w=>w.includes('coin detail may be out of focus')));
assert.equal(quality.quality_check_version,2);
const source=await readFile('public/identify.js','utf8');
assert.ok(source.includes('quality.camera=cameraDiagnostics'));
assert.ok(!source.includes('Resolution, lighting and overall sharpness look usable'));
console.log('PASS camera: supported/manual/rejected/unsupported focus, detail metric and honest quality copy (hardware validation still required)');
