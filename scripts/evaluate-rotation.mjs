// Explicitly approved real-photo orientation evaluation. Never writes photos to the repo.
// Manifest: [{name,path,turn:0,expected:0}]. Expected is the correction after turn.
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const manifest=process.argv[2],output=process.argv[3];
if(!manifest||!output||!process.argv.includes('--live-approved'))throw Error('Provide manifest, output path and --live-approved only after photo-upload approval');
const cases=JSON.parse(await readFile(manifest,'utf8')),root=path.resolve('public');
const {chromium}=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/runtime.js')('playwright');
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(url==='/'?'/index.html':url));if(!file.startsWith(root+'/'))throw Error();res.setHeader('content-type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({serviceWorkers:'block'}),results=[];let requests=[];
await page.route('**/api/batch-orientation',async route=>{
 const body=route.request().postDataJSON();
 const response=await fetch('https://pocket-mint-test.fash-projects.workers.dev/api/batch-orientation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 const text=await response.text();requests.push({phase:body.phase,status:response.status,response:JSON.parse(text)});await route.fulfill({status:response.status,contentType:'application/json',body:text});
});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.BatchPhotoRotation);
 for(const test of cases){
  requests=[];const source='data:image/jpeg;base64,'+(await readFile(test.path)).toString('base64');
  const result=await page.evaluate(async({source,turn})=>{let file=await (await fetch(source)).blob();if(turn)file=await BatchPhotoRotation.rotate(file,turn);const result=await BatchPhotoRotation.suggest(file);return {confident:result.confident,angle:result.angle??0,reason:result.reason};},{source,turn:test.turn||0});
  const evaluated={name:test.name,expected:test.expected,...result,correct:result.confident?result.angle===test.expected:null,requests};results.push(evaluated);console.log(JSON.stringify(evaluated));
  await writeFile(output,JSON.stringify(results,null,2));if(result.reason==='allowance')break;
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
