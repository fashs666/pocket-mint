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
let direction={angle:90,confident:false},orientationCalls=0,verified=true,verifyAngle=-90;const requests=[];
await page.route('**/api/batch-orientation',route=>{if(route.request().postDataJSON().phase==='verify_choice')return route.fulfill({json:{confident:verified,angle:verifyAngle}});orientationCalls++;return route.fulfill({json:direction});});
await page.route('**/api/identify',route=>{requests.push(route.request().postDataJSON());return route.fulfill({json:{matches:[],uncertain:true,status:'no_match'}});});
async function fixture(){await page.evaluate(async()=>{
 showView('findView');showFindTab('identify');const f=window.__batchFixture;f.resetPhoto();
 const source=document.createElement('canvas');source.width=source.height=128;const c=source.getContext('2d');window.__fixtureNumber=(window.__fixtureNumber||0)+1;c.fillStyle=`rgb(${216-window.__fixtureNumber*6},179,107)`;c.beginPath();c.arc(64,64,48,0,Math.PI*2);c.fill();c.fillStyle='#ff0000';c.fillRect(54,26,20,20);c.fillStyle='#0000ff';c.fillRect(54,80,20,20);
 f.state.source=source;f.state.sourceUrl=source.toDataURL();document.querySelector('#batchImage').src=f.state.sourceUrl;
 f.state.regions=[{id:'fixture',x:16,y:16,width:96,height:96,centreX:64,centreY:64,radiusX:48,radiusY:48,detectionNumber:1,reviewed:true}];
 f.stage('review',false);await f.refreshCrops();
 });await page.waitForFunction(()=>!document.querySelector('.batchRotationStatus').textContent.includes('Checking'));await page.locator('#batchNextToCoins').click();await page.waitForFunction(()=>!BatchIdentification.isIdentifying());}
async function pixels(selector){return page.evaluate(async selector=>{const image=document.querySelector(selector);await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let x=0,y=0,n=0;for(let i=0;i<data.length;i+=4)if(data[i]>200&&data[i+1]<70&&data[i+2]<70&&data[i+3]>100){x+=(i/4)%c.width;y+=Math.floor(i/4/c.width);n++;}return {x:x/n/c.width,y:y/n/c.height,n};},selector);}
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.BatchIdentification&&window.__batchFixture&&document.querySelector('#diagnostics')?.textContent.includes('v0.14.49'));await fixture();
 const outline=await page.locator('.batchRegion').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundImage,radius:s.borderRadius,color:s.backgroundColor,border:s.borderTopWidth};});
 assert.equal(outline.background,'none','Coin outlines must not inherit opaque button backgrounds');
 assert.equal(outline.radius,'50%','Coin outlines remain circular');
 assert.equal(outline.border,'3px');assert.equal(outline.color,'rgba(16, 18, 37, 0.11)','Photo remains visible beneath outline');
 assert.equal(await page.locator('#batchSaveTests').evaluate(e=>e.hidden),true,'Crop review does not create an identification report');
 const original=await pixels('#batchCrops img');assert(original.y<.4);
 const choicePixels=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(54,26,20,20);const file=await new Promise(r=>c.toBlob(r,'image/png'));
  const results=[];for(const offset of [0,90]){const img=new Image();img.src=await BatchPhotoRotation.choices(file,offset);await img.decode();c.width=img.width;c.height=img.height;ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;const slots=Array.from({length:4},()=>({x:0,y:0,n:0}));for(let i=0;i<data.length;i+=4)if(data[i]>200&&data[i+1]<70&&data[i+2]<70){const x=(i/4)%c.width,y=Math.floor(i/4/c.width),col=Math.floor(x/512),row=Math.floor(y/556),slot=slots[row*2+col];slot.x+=x-col*512;slot.y+=y-row*556;slot.n++;}results.push(slots.map(s=>({x:s.x/s.n,y:s.y/s.n})));}return results;
 });
 assert(choicePixels[0][0].y<250&&choicePixels[0][1].x>300&&choicePixels[0][2].y>350&&choicePixels[0][3].x<200,'Four rendered choices contain the correct pixel rotations');
 assert(choicePixels[1][0].x>300&&choicePixels[1][3].y<250,'Shifted verification moves upright pixels into a different slot');
 await page.getByRole('button',{name:'Crop coin 1',exact:true}).click();assert(!/Automatic suggestion ready/.test(await page.locator('.photoEditStatus').textContent()));await page.locator('.rotateRight').click();await page.locator('.applyPhotoEdit').click();await page.waitForFunction(()=>!BatchIdentification.isBusy()&&!BatchIdentification.isIdentifying());
 const rotated=await pixels('#batchCrops img');assert(rotated.x>.6&&Math.abs(rotated.y-.5)<.1,'Review pixels rotate clockwise');
 await page.locator('#batchStartIdentification').click();await page.waitForFunction(()=>!BatchIdentification.isIdentifying());await page.locator('#batchIdentificationOverview button').first().click();
 assert.deepEqual(await pixels('#batchResultList img'),rotated,'Result and review show the same edited image');
 assert.equal(await page.getByRole('button',{name:'Auto rotate',exact:true}).count(),0,'No Auto rotate button');
 const edited=await page.locator('#batchCrops img').getAttribute('src');
 await page.evaluate(()=>window.__batchFixture.refreshCrops());assert.equal(await page.locator('#batchCrops img').getAttribute('src'),edited,'Review refresh preserves edits');
 await page.locator('#batchCloseCoin').click();await page.locator('#batchShowCoins').click();await page.getByRole('button',{name:'Crop coin 1',exact:true}).click();await page.locator('.rotateRight').click();await page.locator('.cancelPhotoEdit').click();await page.waitForFunction(()=>!BatchIdentification.isBusy()&&!BatchIdentification.isIdentifying());assert.equal(await page.locator('#batchCrops img').getAttribute('src'),edited,'Cancel preserves existing rotation');
 await page.locator('#batchStartIdentification').click();await page.waitForFunction(()=>!BatchIdentification.isBusy()&&!BatchIdentification.isIdentifying());assert.equal(orientationCalls,1,'Manual correction must not trigger another automatic check');assert(requests.at(-1).reverse.startsWith('data:image/jpeg'));assert.equal(requests.at(-1).single_coin,true);assert.equal(requests.at(-1).batch_coin,undefined);
 const requestPixels=await page.evaluate(async image=>{const img=new Image();img.src=image;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=100;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,100,100);return Array.from(ctx.getImageData(75,50,1,1).data);},requests.at(-1).reverse);assert(requestPixels[0]>150&&requestPixels[1]<100,'Recognition receives rotated pixels');
 direction={angle:90,confident:true};await fixture();await page.locator('#batchStartIdentification').click();await page.waitForFunction(()=>!BatchIdentification.isBusy()&&!BatchIdentification.isIdentifying());assert.equal(orientationCalls,2);assert((await pixels('#batchCrops img')).x>.6,'Auto rotation updates review');
 await page.evaluate(()=>window.__batchFixture.refreshCrops());assert((await pixels('#batchCrops img')).x>.6,'Auto correction survives regenerated crops');
 verified=false;direction={angle:90,confident:true};await fixture();assert.equal(await page.locator('.batchRotationStatus').textContent(),'Check rotation · automatic check uncertain');assert((await pixels('#batchCrops img')).y<.4,'Rejected upright verification never exposes candidate pixels');verified=true;
 verifyAngle=90;await fixture();assert((await pixels('#batchCrops img')).y<.4,'Confident but inconsistent verification retains the original');verifyAngle=-90;
 direction={angle:90,confident:false};await fixture();assert.equal(await page.locator('.batchRotationStatus').textContent(),'Check rotation · automatic check uncertain');assert((await pixels('#batchCrops img')).y<.4,'Uncertain orientation retains original');
 direction={angle:999,confident:true};await fixture();assert.equal(await page.locator('.batchRotationStatus').textContent(),'Check rotation · automatic check uncertain');assert((await pixels('#batchCrops img')).y<.4,'Invalid orientation retains original');
 await page.evaluate(()=>BatchIdentification.closeWorkspace());await page.getByRole('button',{name:'Rotate coin 1 right 90 degrees',exact:true}).click();await page.waitForFunction(()=>!BatchIdentification.isBusy()&&!BatchIdentification.isIdentifying());assert((await pixels('#batchCrops img')).x>.6,'Simple rotation control updates review');
 // Stress the review grid without mounting 24 matching/editing interfaces.
 direction={angle:0,confident:false};
 await page.evaluate(async()=>{const f=window.__batchFixture;f.resetPhoto();const c=document.createElement('canvas');c.width=c.height=640;c.getContext('2d').fillRect(0,0,640,640);f.state.source=c;f.state.sourceUrl=c.toDataURL();f.state.regions=Array.from({length:24},(_,i)=>({id:'stress'+i,x:(i%4)*150,y:Math.floor(i/4)*100,width:80,height:80,centreX:(i%4)*150+40,centreY:Math.floor(i/4)*100+40,radiusX:40,radiusY:40,detectionNumber:i+1,reviewed:true}));f.stage('review',true);await f.refreshCrops();});
 await page.locator('#batchNextToCoins').click();
 assert.equal(await page.locator('#batchCrops img').count(),24);
 await page.evaluate(()=>{window.__stableCards=Array.from(document.querySelector('#batchCrops').children);window.__stableSources=window.__stableCards.map(n=>n.querySelector('img').src);});
 await page.evaluate(()=>{for(let i=0;i<30;i++)BatchReview.redraw();});
 assert(await page.evaluate(()=>window.__stableCards.every((node,i)=>node===document.querySelector('#batchCrops').children[i]&&node.querySelector('img').src===window.__stableSources[i])),'Idle redraw retains all card nodes and image sources');
 await page.locator('#batchStartIdentification').click();await page.waitForFunction(()=>!BatchIdentification.isIdentifying());await page.locator('#batchIdentificationOverview button').nth(11).click();
 assert.equal(await page.locator('#batchResultList .batchResult').count(),1,'Only one coin workspace is mounted');
 await page.evaluate(()=>window.__stableResult=document.querySelector('#batchResultList').firstElementChild);
 await page.evaluate(()=>{for(let i=0;i<30;i++)BatchReview.redraw();});
 assert(await page.evaluate(()=>window.__stableResult===document.querySelector('#batchResultList').firstElementChild),'Workspace survives unrelated redraws');
 await page.goBack();await page.waitForFunction(()=>document.querySelector('#batchWorkspace').hidden);
 assert(await page.locator('#batchIdentificationStep').isVisible(),'Back closes workspace before leaving results');
 await page.goBack();await page.locator('#batchCoinStep').waitFor();await page.goBack();await page.locator('#batchOutlineStep').waitFor();
 assert.equal(await page.locator('.batchRegion').count(),24,'Back preserves outline edits');
 await page.locator('#batchNextToCoins').click();
 for(const width of [320,360,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}px`);}
 await page.setViewportSize({width:844,height:390});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow after rotation');
 await page.screenshot({path:'/workspace/scratch/60af6b8f0471/batch34-grid.png',fullPage:true});
 console.log('PASS stable 24-coin grid, one workspace, Back, review/result/recognition pixels, refresh persistence, cancelled edits, manual override, confident auto rotation, uncertain/invalid fallback and landscape layout');
}finally{await browser.close();await new Promise(r=>server.close(r));}
