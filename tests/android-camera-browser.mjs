import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/runtime.js')('playwright');
const root=path.resolve('public');
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(url==='/'?'/index.html':url));if(!file.startsWith(root+'/'))throw Error();res.setHeader('content-type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const page=await browser.newPage({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',serviceWorkers:'block'});
await page.addInitScript(()=>{
 const settings=new WeakMap(),original=MediaStreamTrack.prototype.getSettings;
 window.__focusCalls=[];
 MediaStreamTrack.prototype.getCapabilities=function(){return {focusMode:['continuous','single-shot','manual'],focusDistance:{min:0,max:10,step:.1},zoom:{min:1,max:3,step:.1}};};
 MediaStreamTrack.prototype.getSettings=function(){return {...original.call(this),...settings.get(this)};};
 MediaStreamTrack.prototype.applyConstraints=async function(c){const values=c.advanced?.[0]||Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v.exact]));window.__focusCalls.push(values);settings.set(this,{...settings.get(this),...values});};
 navigator.mediaDevices.getSupportedConstraints=()=>({pointsOfInterest:true});
});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.querySelector('#diagnostics')?.textContent.includes('0.14.45'));
 await page.evaluate(()=>{navigate('findView');showFindTab('identify');});await page.evaluate(()=>openCoinCamera('reverse'));
 await page.waitForFunction(()=>document.querySelector('#coinCameraAutofocus')&&!document.querySelector('#coinCameraAutofocus').hidden);await page.evaluate(()=>coinCameraFocusQueue);
 assert(await page.locator('#coinCameraGuide').isVisible());assert(await page.locator('#coinCameraAutofocus').isVisible());
 assert(await page.evaluate(()=>__focusCalls.some(c=>c.pointsOfInterest&&c.focusMode==='single-shot')));
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);await page.evaluate(()=>layoutAndroidCoinGuide());
  const g=await page.locator('#coinCameraGuide').boundingBox(),top=await page.locator('.cameraTop').boundingBox(),bottom=await page.locator('.cameraBottom').boundingBox();
  assert(g.x>=0&&g.x+g.width<=size.width+1);assert(g.y>=top.y+top.height-1);assert(g.y+g.height<=bottom.y+1,'Circle does not overlap capture controls');
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>layoutAndroidCoinGuide());
 const guide=await page.locator('#coinCameraGuide').boundingBox();const before=await page.evaluate(()=>__focusCalls.length);await page.mouse.click(guide.x+guide.width/2,guide.y+guide.height/2);await page.evaluate(()=>coinCameraFocusQueue);assert(await page.evaluate(n=>__focusCalls.length>n,before));
 await page.locator('#coinCameraFocus').evaluate(e=>{e.value='3';e.dispatchEvent(new Event('input'));});await page.evaluate(()=>coinCameraFocusQueue);assert.equal(await page.evaluate(()=>coinCameraTrack.getSettings().focusMode),'manual');
 await page.locator('#coinCameraAutofocus').click();await page.evaluate(()=>coinCameraFocusQueue);assert.equal(await page.evaluate(()=>coinCameraTrack.getSettings().focusMode),'continuous');
 await page.screenshot({path:'/workspace/scratch/60af6b8f0471/android44-camera.png'});
 await page.locator('#coinCameraShutter').click();await page.waitForFunction(()=>document.querySelector('#coinCamera').hidden&&identifyState.reverse?.file);
 assert.match(await page.evaluate(()=>identifyState.reverse.file.name),/^guided-reverse-/);
 const dimensions=await page.evaluate(async()=>{const b=await createImageBitmap(identifyState.reverse.file);const r=[b.width,b.height];b.close();return r;});assert.deepEqual(dimensions,[768,768]);
 // A Samsung-style missing/throwing capability API cannot remove the live camera.
 await page.evaluate(()=>{MediaStreamTrack.prototype.getCapabilities=function(){throw Error('Capability API unavailable');};});
 await page.evaluate(()=>openCoinCamera('reverse'));
 await page.waitForFunction(()=>document.querySelector('#coinCameraShutter').disabled===false);
 assert(await page.locator('#coinCameraGuide').isVisible());assert(await page.locator('#coinCameraShutter').isVisible());
 assert.equal(await page.evaluate(()=>document.querySelector('#coinCamera').classList.contains('fallback')),false);
 await page.locator('#coinCameraShutter').click();await page.waitForFunction(()=>document.querySelector('#coinCamera').hidden);
 // Even a driver that never resolves focus constraints must not block opening.
 await page.evaluate(()=>{MediaStreamTrack.prototype.getCapabilities=()=>({focusMode:['continuous']});MediaStreamTrack.prototype.applyConstraints=()=>new Promise(()=>{});});
 await page.evaluate(()=>openCoinCamera('reverse'));
 assert(await page.locator('#coinCameraShutter').isEnabled());assert(await page.locator('#coinCameraGuide').isVisible());
 await page.evaluate(()=>closeCoinCamera());
 // A previous permission failure must be cleared on the next successful opening.
 await page.evaluate(()=>{document.querySelector('#coinCamera').classList.add('fallback');MediaStreamTrack.prototype.getCapabilities=()=>({});MediaStreamTrack.prototype.applyConstraints=async()=>{};});
 await page.evaluate(()=>openCoinCamera('reverse'));
 assert(await page.locator('#coinCameraShutter').isVisible());assert(await page.locator('#coinCameraShutter').isEnabled());
 await page.evaluate(()=>closeCoinCamera());
 console.log('PASS Android guided camera: real simulated stream, centre/tap focus, manual-to-auto, unobstructed circle at three viewports and unchanged 768px guided capture');
}finally{await browser.close();await new Promise(r=>server.close(r));}
