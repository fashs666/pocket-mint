// Offline actual-JS matcher evaluation. Pillow/numpy preprocess pixels only.
// Usage: node scripts/evaluate-rotation-memory.mjs /path/to/private-report.json
// Saved-example replay is NOT unseen-photo accuracy. Held-out rows expose this.
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
if(!process.argv[2])throw Error('Provide the saved rotation report path');
const {tests,pixels}=JSON.parse(execFileSync('python',['scripts/rotation-report-pixels.py',process.argv[2]],{maxBuffer:100_000_000}));
let current;
const context={window:{},Float32Array,Math,Map,Set,setTimeout,fetch:async url=>({blob:async()=>url}),decodeIdentifyPhoto:async file=>{current=file;return {width:180,height:180};},document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(){},getImageData:()=>({data:Buffer.from(pixels[current],'base64')})})})}};
vm.createContext(context);vm.runInContext(await readFile('public/batch-rotation-memory.js','utf8'),context);
const memory=context.window.BatchRotationMemory;
let replayAccepted=0,replayWrong=0,heldOutAccepted=0;
for(let b=0;b<tests.length;b++)for(let c=0;c<tests[b].coins.length;c++){
 const coin=tests[b].coins[c],image=tests[b].images[coin.original_image_ref];
 const replay=await memory.match(image,tests);
 const heldOut=await memory.match(image,tests.map((t,i)=>({...t,coins:t.coins.filter((_,j)=>i!==b||j!==c)})));
 const expected=coin.evaluation_expected;
 const residual=replay&&expected!==null?Math.abs((replay.angle-expected+540)%360-180):null;
 if(replay)replayAccepted++;if(residual!==null&&residual>8)replayWrong++;if(heldOut)heldOutAccepted++;
 console.log(JSON.stringify({batch:b,coin:c+1,expected,replay,residual_degrees:residual,heldOut}));
}
console.log(JSON.stringify({total:tests.reduce((n,t)=>n+t.coins.length,0),replayAccepted,replayWrong,heldOutAccepted,note:'Replay uses saved corrected examples. This is not evidence of generalization to different photos.'}));
if(replayWrong)process.exitCode=1;
