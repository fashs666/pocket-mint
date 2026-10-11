import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const calls=[],context={window:{},crypto,Date,makeAnalysisImage:async blob=>{calls.push(blob);return `data:image/jpeg;base64,${blob.name}`;}};
vm.createContext(context);vm.runInContext(await readFile('public/batch-rotation-report.js','utf8'),context);
const original={name:'original'},automatic={name:'automatic'},upright={name:'upright'};
const crop={id:'a',detectionNumber:1,x:1,y:2,width:300,height:300,crop:original};
const data=await context.window.BatchRotationReport.build({sourceImage:'data:image/jpeg;base64,source',sourceWidth:2048,sourceHeight:1536,appVersion:'test',catalogueVersion:'test',items:[
 {crop,evidence:{attempted:true,confident:true,angle:90,automaticBlob:automatic,manualDegrees:-90},corrected:upright},
 {crop:{...crop,id:'b',detectionNumber:2},evidence:{attempted:true,confident:false,reason:'uncertain',automaticBlob:original,manualDegrees:0},corrected:original},
 {crop:{...crop,id:'c',detectionNumber:3},evidence:{attempted:false,automaticBlob:original,manualDegrees:null,cropEdited:true},corrected:upright}
]});
assert.equal(data.flow,'batch_rotation');assert.equal(data.total_coins,3);assert.equal(data.coins[0].automatic_correct,false);assert.equal(data.coins[0].expected_clockwise_degrees,0);
assert.equal(data.coins[1].automatic_confident,false);assert.equal(data.coins[1].automatic_correct,true);assert.equal(data.coins[2].automatic_correct,null);assert.equal(data.coins[2].expected_clockwise_degrees,null);
assert.equal(calls.length,3,'encode identical source blobs once, not once per use');
for(const coin of data.coins)for(const key of ['original_image_ref','automatic_image_ref','upright_image_ref'])assert(data.images[coin[key]].startsWith('data:image/jpeg;base64,'));
assert.equal(data.images[data.source_image_ref],'data:image/jpeg;base64,source');
assert(data.coins.every(c=>c.upright_confirmed));assert.equal(data.predicted_coin_id,undefined);
assert.equal(JSON.parse(JSON.stringify(data)).coins.length,3,'all coin images are included in the normal JSON export');
await assert.rejects(context.window.BatchRotationReport.build({items:[]}),/No coins/);
const ui=await readFile('public/batch-identify.js','utf8'),html=await readFile('public/index.html','utf8');
assert.equal((html.match(/id="batchSaveRotationTest"/g)||[]).length,1,'one batch-wide save button');
assert(ui.includes("put('identificationTests',report)"));assert(ui.includes('orientationPending'));assert(ui.includes('savedRotationSignature===rotationSignature()'));
console.log('PASS all-coin rotation report: original/automatic/upright images, measured/manual unknown angles, deduplicated encodings, one batch save, JSON export and no collection writes');

// Exercise the actual one-button save handler, not a substitute implementation.
const button={disabled:false},feedback={textContent:''},writes=[];
Object.assign(context,{$:id=>id==='batchSaveRotationTest'?button:feedback,APP_VERSION:'test',catMeta:{catalogue_version:'test'},identificationTests:[],savedRotationSignature:'',
  state:{job:1,checking:false,crops:[crop,{...crop,id:'b',detectionNumber:2}],source:{width:1000,height:1000,toDataURL:()=> 'data:image/jpeg;base64,source'}},
  rotationSignature:()=> 'snapshot',renderAll:()=>{},put:async(store,report)=>writes.push({store,report})});
context.window.BatchIdentification={rotationEvidence:()=>({attempted:true,angle:90,confident:true,automaticBlob:automatic,manualDegrees:-90}),effectivePhoto:()=>({blob:upright})};
context.render=()=>{button.disabled=context.state.checking||context.savedRotationSignature==='snapshot';};
const start=ui.indexOf("  $('batchSaveRotationTest').onclick=async()=>{"),end=ui.indexOf('\n\n  async function removeRegion',start);
assert(start>0&&end>start);vm.runInContext(ui.slice(start,end),context);
await button.onclick();assert.equal(writes.length,1);assert.equal(writes[0].store,'identificationTests');assert.equal(writes[0].report.total_coins,2);assert.equal(context.identificationTests.length,1);assert.equal(button.disabled,true);
await button.onclick();assert.equal(writes.length,1,'repeat press does not duplicate the whole batch');
context.savedRotationSignature='';context.render();context.put=async()=>{throw Error('storage full');};
await button.onclick();assert.equal(context.identificationTests.length,1);assert.equal(button.disabled,false);assert.equal(context.state.checking,false);assert.match(feedback.textContent,/try again/);
console.log('PASS real batch save handler: one atomic all-coin record, duplicate prevention and retry after storage failure');
