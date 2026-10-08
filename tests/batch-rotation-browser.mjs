// Optional browser regression: verifies real image pixels and both batch views.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/runtime.js')('playwright');
const root=path.resolve('public');
const server=http.createServer(async(req,res)=>{
 try{const name=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+'/'))throw Error();
 let body=await readFile(file);
 if(name==='/batch-identify.js')body=Buffer.from(body.toString().replace('window.BatchReview={','window.__batchFixture={state,refreshCrops,resetPhoto,stage};window.BatchReview={'));
 res.setHeader('content-type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
let direction={angle:90,confident:true},orientationCalls=0;const requests=[];
await page.route('**/api/photo-orientation',route=>{orientationCalls++;return route.fulfill({json:direction});});
await page.route('**/api/identify',route=>{requests.push(route.request().postDataJSON());return route.fulfill({json:{matches:[],uncertain:true,status:'no_match'}});});
async function fixture(){await page.evaluate(async()=>{
 showView('findView');showFindTab('identify');const f=window.__batchFixture;f.resetPhoto();
 const source=document.createElement('canvas');source.width=source.height=128;const c=source.getContext('2d');c.fillStyle='#d8b36b';c.beginPath();c.arc(64,64,48,0,Math.PI*2);c.fill();c.fillStyle='#ff0000';c.fillRect(54,26,20,20);c.fillStyle='#0000ff';c.fillRect(54,80,20,20);
 f.state.source=source;f.state.sourceUrl=source.toDataURL();document.querySelector('#batchImage').src=f.state.sourceUrl;
 f.state.regions=[{id:'fixture',x:16,y:16,width:96,height:96,centreX:64,centreY:64,radiusX:48,radiusY:48,detectionNumber:1,reviewed:true}];
 f.stage('review',false);await f.refreshCrops();
 });}
async function pixels(selector){return page.evaluate(async selector=>{const image=document.querySelector(selector);await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let x=0,y=0,n=0;for(let i=0;i<data.length;i+=4)if(data[i]>200&&data[i+1]<70&&data[i+2]<70&&data[i+3]>100){x+=(i/4)%c.width;y+=Math.floor(i/4/c.width);n++;}return {x:x/n/c.width,y:y/n/c.height,n};},selector);}
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.BatchIdentification&&window.__batchFixture&&document.querySelector('#diagnostics')?.textContent.includes('v0.14.31'));await fixture();
 const original=await pixels('#batchCrops img');assert(original.y<.4);
 await page.locator('#batchCrops button').filter({hasText:'Crop / rotate'}).click();await page.locator('.rotateRight').click();await page.locator('.applyPhotoEdit').click();await page.waitForFunction(()=>!BatchIdentification.isBusy());
 const rotated=await pixels('#batchCrops img');assert(rotated.x>.6&&Math.abs(rotated.y-.5)<.1,'Review pixels rotate clockwise');
 assert.deepEqual(await pixels('#batchResultList img'),rotated,'Result and review show the same edited image');
 const edited=await page.locator('#batchCrops img').getAttribute('src');
 await page.evaluate(()=>window.__batchFixture.refreshCrops());assert.equal(await page.locator('#batchCrops img').getAttribute('src'),edited,'Review refresh preserves edits');
 await page.locator('#batchCrops button').filter({hasText:'Crop / rotate'}).click();await page.locator('.rotateRight').click();await page.locator('.cancelPhotoEdit').click();await page.waitForFunction(()=>!BatchIdentification.isBusy());assert.equal(await page.locator('#batchCrops img').getAttribute('src'),edited,'Cancel preserves existing rotation');
 await page.locator('#batchIdentifyAll').click();await page.waitForFunction(()=>!BatchIdentification.isBusy());assert.equal(orientationCalls,0,'Manual correction must not be automatically replaced');assert(requests.at(-1).reverse.startsWith('data:image/jpeg'));
 const requestPixels=await page.evaluate(async image=>{const img=new Image();img.src=image;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=100;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,100,100);return Array.from(ctx.getImageData(75,50,1,1).data);},requests.at(-1).reverse);assert(requestPixels[0]>150&&requestPixels[1]<100,'Recognition receives rotated pixels');
 await fixture();await page.locator('#batchIdentifyAll').click();await page.waitForFunction(()=>!BatchIdentification.isBusy());assert.equal(orientationCalls,1);assert((await pixels('#batchCrops img')).x>.6,'Auto rotation updates review');
 await page.evaluate(()=>window.__batchFixture.refreshCrops());assert((await pixels('#batchCrops img')).x>.6,'Auto correction survives regenerated crops');
 direction={angle:90,confident:false};await fixture();await page.locator('#batchCrops button').filter({hasText:'Auto rotate'}).click();await page.waitForFunction(()=>!BatchIdentification.isBusy());assert((await pixels('#batchCrops img')).y<.4,'Uncertain orientation retains original');
 direction={angle:999,confident:true};await fixture();await page.locator('#batchCrops button').filter({hasText:'Auto rotate'}).click();await page.waitForFunction(()=>!BatchIdentification.isBusy());assert((await pixels('#batchCrops img')).y<.4,'Invalid orientation retains original');
 await page.setViewportSize({width:844,height:390});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow after rotation');
 console.log('PASS review/result/recognition pixels, refresh persistence, cancelled edits, manual override, confident auto rotation, uncertain/invalid fallback and landscape layout');
}finally{await browser.close();await new Promise(r=>server.close(r));}
