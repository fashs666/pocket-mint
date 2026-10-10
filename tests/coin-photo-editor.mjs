import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const calls=[];
const ctx={clearRect(){calls.push('clear')},save(){},restore(){},beginPath(){},arc(){calls.push('mask')},clip(){},translate(x,y){calls.push(['translate',x,y])},rotate(a){calls.push(['rotate',a])},scale(){},drawImage(){calls.push('image')},stroke(){calls.push('guide')}};
const controls=new Map();
function element(selector){if(!controls.has(selector))controls.set(selector,{value:selector.includes('Zoom')?'1':'0',width:768,height:768,getContext:()=>ctx,getBoundingClientRect:()=>({width:384,height:384}),setPointerCapture(){}});return controls.get(selector);}
let removed=0,closed=0;
const dialog={querySelector:element,showModal(){},close(){this.onclose?.()},remove(){removed++}};
const context={window:{},document:{body:{append(){}},createElement:tag=>tag==='dialog'?dialog:{width:768,height:768,getContext:()=>ctx}},
 decodeIdentifyPhoto:async()=>({width:1600,height:1200,close(){closed++}}),canvasBlob:async(_canvas,type)=>{assert.equal(type,'image/png');return new Blob(['photo'],{type})},Blob,File,Date,Math};
vm.createContext(context);vm.runInContext(await readFile('public/coin-photo-editor.js','utf8'),context);
const api=context.window.CoinPhotoEditor;
const t=api.transform(1600,1200,2,90,.1,-.2);
assert.equal(t.scale,1.28);assert.equal(t.angle,Math.PI/2);assert.equal(t.x,460.8);assert.equal(t.y,230.39999999999998);
const editing=api.edit(new Blob());await new Promise(resolve=>setImmediate(resolve));
assert.equal(await api.edit(new Blob()),null,'Only one editor can be opened');
element('.rotateRight').onclick();assert.equal(element('.photoAngle').value,90);
element('canvas').onpointerdown({clientX:0,clientY:0,pointerId:1});element('canvas').onpointermove({clientX:38.4,clientY:0});
assert.ok(calls.some(c=>Array.isArray(c)&&c[0]==='translate'&&Math.abs(c[1]-460.8)<.001));
calls.length=0;await element('.applyPhotoEdit').onclick();const file=await editing;
assert.equal(file.type,'image/png');assert.ok(calls.includes('mask'));assert.ok(!calls.includes('guide'),'Export excludes yellow preview guide');assert.equal(closed,1);
const cancelled=api.edit(new Blob());await new Promise(resolve=>setImmediate(resolve));element('.cancelPhotoEdit').onclick();assert.equal(await cancelled,null);assert.equal(closed,2);
assert.ok(removed>=2);console.log('PASS photo editor: rotation, pan, transparent mask, guide-free export, cancel and resource cleanup');
context.window.AutoCoinPhoto={suggest(){throw Error('Manual crop must not request orientation');}};
const manual=api.edit(new Blob(),{suggest:false});await new Promise(resolve=>setImmediate(resolve));element('.cancelPhotoEdit').onclick();assert.equal(await manual,null);
