// Deterministic synthetic fixtures for the local detector; no browser or network needed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('public/batch-detection.js','utf8');
function fixture(count,texture=false,ellipse=false){
  const width=480,height=380,data=new Uint8ClampedArray(width*height*4);
  const centers=Array.from({length:count},(_,i)=>[68+(i%5)*87,84+Math.floor(i/5)*160,20+(i%3)*5]);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let base=texture?118+Math.round(Math.sin(x*.21)*16+Math.sin(y*.12)*13):230;
    for(const [cx,cy,r] of centers){const d=Math.hypot(x-cx,(y-cy)/(ellipse?.83:1));
      if(d<r){base=d>r-4?67:135+Math.round(Math.sin(x*.2)*9+Math.sin(y*.2)*7);break;}}
    const i=(y*width+x)*4;data[i]=base;data[i+1]=base;data[i+2]=base;data[i+3]=255;
  }
  return {width,height,data,centers};
}
async function detect(source){
  const context={window:{},crypto:{randomUUID:()=>Math.random().toString(36)},setTimeout,Uint8Array,Uint16Array,Int32Array,Math,
    document:{createElement:()=>({width:0,height:0,getContext(){return{drawImage(){},getImageData(){return{data:source.data}}}}})}};
  vm.runInNewContext(code,context);
  return context.window.BatchCoins.detectCoins(source);
}
for(const [name,count,texture,ellipse] of [['plain',3,false,false],['mixed table',3,true,false],['table',6,true,false],['ten',10,false,false],['perspective',3,false,true],['empty table',0,true,false]]){
  const source=fixture(count,texture,ellipse),start=Date.now(),found=await detect(source);
  // A textured table may need one manual correction; avoid false circles instead
  // of filling all ten slots with weak rim votes.
  if(texture&&count)assert(found.length>=count-1&&found.length<=count,`${name}: conservative detected count`);
  else assert.equal(found.length,count,`${name}: detected count`);
  for(const [x,y] of source.centers)if(!texture)assert(found.some(region=>Math.hypot(region.centreX-x,region.centreY-y)<10),`${name}: coin at ${x},${y} has its own region`);
  if(texture&&count)for(const region of found)assert(source.centers.some(([x,y])=>Math.hypot(region.centreX-x,region.centreY-y)<12),`${name}: no phantom circles`);
  console.log(`PASS ${name}: ${found.length} regions (${Date.now()-start}ms)`);
}
const stableContext={window:{},crypto:{randomUUID:()=> 'test'},setTimeout,Uint8Array,Uint16Array,Int32Array,Math};
vm.runInNewContext(code,stableContext);
const renumbered=stableContext.window.BatchCoins.updateRelativeDiameters([{width:20,height:20,detectionNumber:1},{width:30,height:30,detectionNumber:3}]);
assert.deepEqual(Array.from(renumbered,r=>r.detectionNumber),[1,3],'Removing an outline must preserve physical coin numbers');
console.log('PASS stable outline numbers after removal');
