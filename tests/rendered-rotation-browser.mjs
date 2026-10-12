// Optional real-canvas regression; all vision replies are mocked, no quota used.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/runtime.js')('playwright');
const source=await readFile('public/batch-photo-rotation.js','utf8');
const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/rotation.js'?'text/javascript':'text/html');res.end(req.url==='/rotation.js'?source:'<!doctype html><script>window.decodeIdentifyPhoto=file=>createImageBitmap(file);</script><script src="/rotation.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const phases=[];
 await page.route('**/api/batch-orientation',route=>{const phase=route.request().postDataJSON().phase;phases.push(phase);return route.fulfill({json:{confident:true,angle:phase==='coarse8'?45:-7.5}});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const evidence=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#a87';ctx.beginPath();ctx.arc(64,64,52,0,2*Math.PI);ctx.fill();ctx.fillStyle='red';ctx.fillRect(59,15,10,10);
  const file=await new Promise(r=>c.toBlob(r,'image/png'));
  async function read(image,columns,rows){const bitmap=await createImageBitmap(await (await fetch(image)).blob()),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);bitmap.close();const data=context.getImageData(0,0,canvas.width,canvas.height).data;
   const slots=Array.from({length:columns*rows},()=>({x:0,y:0,n:0}));
   for(let i=0;i<data.length;i+=4)if(data[i]>180&&data[i+1]<65&&data[i+2]<65){const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width),col=Math.floor(x/384),row=Math.floor(y/428),slot=slots[row*columns+col];slot.x+=x-col*384;slot.y+=y-row*428;slot.n++;}
   return {width:canvas.width,height:canvas.height,angles:slots.filter(s=>s.n).map(s=>Math.atan2(s.x/s.n-192,-(s.y/s.n-236))*180/Math.PI)};
  }
  const coarse=await read(await BatchPhotoRotation.renderedChoices(file,BatchPhotoRotation.coarseAngles),4,2);
  const fine=await read(await BatchPhotoRotation.renderedChoices(file,BatchPhotoRotation.fineAngles,45),3,3);
  const result=await BatchPhotoRotation.suggest(file),bitmap=await createImageBitmap(result.file),out=document.createElement('canvas');out.width=bitmap.width;out.height=bitmap.height;const context=out.getContext('2d');context.drawImage(bitmap,0,0);bitmap.close();const data=context.getImageData(0,0,out.width,out.height).data;let x=0,y=0,n=0;
  for(let i=0;i<data.length;i+=4)if(data[i]>180&&data[i+1]<65&&data[i+2]<65&&data[i+3]>100){x+=(i/4)%out.width;y+=Math.floor(i/4/out.width);n++;}
  return {coarse,fine,angle:result.angle,reason:result.reason,pixelAngle:Math.atan2(x/n-(out.width-1)/2,-(y/n-(out.height-1)/2))*180/Math.PI,redPixels:n,outputDimensions:[out.width,out.height],cornerAlpha:data[3]};
 });
 assert.deepEqual(phases,['coarse8','fine9']);assert.deepEqual([evidence.coarse.width,evidence.coarse.height],[1536,856]);assert.deepEqual([evidence.fine.width,evidence.fine.height],[1152,1284]);
 const coarse=[0,45,90,135,180,-135,-90,-45],fine=[15,22.5,30,37.5,45,52.5,60,67.5,75];
 const distance=(a,b)=>Math.abs((a-b+540)%360-180);
 for(let i=0;i<8;i++)assert(distance(evidence.coarse.angles[i],coarse[i])<2);
 for(let i=0;i<9;i++)assert(distance(evidence.fine.angles[i],fine[i])<2);
 assert.equal(evidence.angle,37.5);assert(distance(evidence.pixelAngle,37.5)<2);assert(evidence.redPixels>=85);assert(evidence.outputDimensions.every(s=>s>128));assert.equal(evidence.cornerAlpha,0);
 console.log('PASS actual canvas: eight/fine nine tile positions, unclipped coin cues, signed 37.5-degree PNG pixels, original-image preservation and two mocked requests');
}finally{await browser.close();await new Promise(r=>server.close(r));}
