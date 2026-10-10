import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/runtime.js')('playwright');
const root=path.resolve('public');
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+'/'))throw Error();res.setHeader('content-type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
let calls=0,quota=false;
await page.route('**/api/**',route=>{calls++;return route.fulfill({status:quota?429:200,headers:{'x-pocket-mint-usage':JSON.stringify({day:new Date().toISOString().slice(0,10),calls:quota?1:2,measured:quota?0:2,unknown:quota?1:0,neurons:quota?0:60.5})},json:quota?{diagnostic_code:'VISION-DAILY-LIMIT',reason:'allowance',error:'Daily allowance reached'}:{matches:[],uncertain:true,confident:false,reason:'uncertain'}});});
const request=(body,batch=false,url='/api/identify')=>page.evaluate(async({body,batch,url})=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(batch?{'x-pocket-mint-batch':'1'}:{})},body:JSON.stringify(body)});return r.status;},{body,batch,url});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.PocketMintVisionAllowance&&window.BatchIdentification&&document.querySelector('#diagnostics')?.textContent.includes('v0.14.48'));
 await page.evaluate(()=>{navigate('findView');showFindTab('identify');identifyState.reverse=new Blob(['keep photo']);});
 await request({reverse:'a'},true);await request({reverse:'a'},true);assert.equal(calls,1);
 await request({reverse:'b'},true);assert.equal(calls,2);
 const usage=await page.evaluate(()=>PocketMintVisionAllowance.usage());assert.equal(usage.requests,2);assert.equal(usage.calls,4);assert.equal(usage.neurons,121);assert.equal(usage.reused,1);
 await page.evaluate(()=>navigate('settingsView'));assert.match(await page.locator('.visionNeuronCount').textContent(),/121/);assert.match(await page.locator('.visionUsageLast').textContent(),/60.5/);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/workspace/scratch/60af6b8f0471/usage42-settings.png',fullPage:true});await page.evaluate(()=>navigate('findView'));
 quota=true;assert.equal(await request({reverse:'single'}),429);await page.locator('#visionAllowanceDialog').waitFor({state:'visible'});
 assert.match(await page.locator('#visionAllowanceDialog').textContent(),/daily allowance resets/);assert.equal(await page.evaluate(()=>identifyState.reverse.size),10);
 const before=calls;await request({reverse:'another'});await request({image:'another'},false,'/api/photo-orientation');assert.equal(calls,before);
 assert.equal(await request({reverse:'a'},true),200,'Cached batch available during cooldown');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});const box=await page.locator('#visionAllowanceDialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);assert(await page.locator('#visionAllowanceDialog button').isVisible());}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/workspace/scratch/60af6b8f0471/allowance40.png'});
 await page.goBack();assert(await page.locator('#visionAllowanceDialog').isHidden());assert(await page.locator('#findView').isVisible());assert.equal(await page.evaluate(()=>identifyState.reverse.size),10,'Back preserves current photo');
 await page.reload();await page.waitForFunction(()=>window.PocketMintVisionAllowance);await request({reverse:'reload'});assert.equal(calls,before);assert(await page.locator('#visionAllowanceDialog').isVisible());
 assert.equal(await page.evaluate(()=>PocketMintVisionAllowance.usage().neurons),121,'Estimated usage persists and blocked attempts add no cost');
 await page.locator('#visionAllowanceDialog button').click();await page.waitForFunction(()=>!document.querySelector('#visionAllowanceDialog').open);
 quota=false;await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'pm-vision-reset',newValue:String(Date.now()-1)})));assert.equal(await request({reverse:'after-reset'}),200);assert.equal(calls,before+1);
 await page.evaluate(()=>{const u=PocketMintVisionAllowance.usage();localStorage.setItem('pm-vision-usage-v1',JSON.stringify({...u,day:'2000-01-01'}));PocketMintVisionAllowance.renderUsage();});assert.equal(await page.evaluate(()=>PocketMintVisionAllowance.usage().requests),0,'UTC-day rollover clears old usage');
 console.log('PASS live browser quota popup, unchanged single photo, cached batch, prevented orientation traffic, reload cooldown, Back, four widths and reset recovery');
}finally{await browser.close();await new Promise(r=>server.close(r));}
