// Optional real-photo regression. Private supplied photos stay outside the repo.
// BATCH_PHOTO_DIR=/path/to/fixtures PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node tests/batch-photo-detection.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire((process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd())+'/runtime.js');
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']});
try {
  const page=await browser.newPage();
  await page.evaluate(()=>{crypto.randomUUID=()=>String(Math.random());});
  const detector=await fs.readFile('public/batch-detection.js','utf8');
  await page.addScriptTag({content:detector});
  const expectations={
    'IMG_5028.jpeg':[[797,317],[259,778],[816,1210]],
    'IMG_5029.jpeg':[[806,173],[816,557],[336,566],[816,950],[336,960],[346,1354]],
    'IMG_5030.jpeg':[[298,182],[768,182],[288,566],[768,970],[768,1344],[298,1354]],
    'IMG_5031.jpeg':[[826,480],[307,499],[816,883],[326,902],[826,1267],[346,1306]],
    'ghlu-v00957-room-links.jpg':[]
  };
  for(const file of ['IMG_5028.jpeg','IMG_5029.jpeg','IMG_5030.jpeg','IMG_5031.jpeg','ghlu-v00957-room-links.jpg']){
    const data='data:image/jpeg;base64,'+(await fs.readFile(path.join(process.env.BATCH_PHOTO_DIR,file))).toString('base64');
    const result=await page.evaluate(async(data)=>{
      const image=new Image();image.src=data;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);
      const regions=await BatchCoins.detectCoins(canvas);
      return {width:image.width,height:image.height,regions};
    },data);
    console.log(file,JSON.stringify(result));
    assert.equal(result.regions.length,expectations[file].length,`${file}: actual coins only (fully framed)`);
    for(const [x,y] of expectations[file])assert(result.regions.some(r=>Math.hypot(r.centreX-x,r.centreY-y)<40),`${file}: correct coin centre ${x},${y}`);
    // Raising the limit must not manufacture extra outlines.
    for(const limit of [12,48]){
      await page.addScriptTag({content:'{'+detector.replace('maxCoins:24',`maxCoins:${limit}`)+'}'});
      const count=await page.evaluate(async(data)=>{
        const image=new Image();image.src=data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);
        return (await BatchCoins.detectCoins(canvas)).length;
      },data);
      assert.equal(count,expectations[file].length,`${file}: independent of ceiling ${limit}`);
    }
    await page.addScriptTag({content:'{'+detector+'}'});
    if(file==='IMG_5028.jpeg'){
      const negatives=await page.evaluate(async(data)=>{
        const image=new Image();image.src=data;await image.decode();const counts=[];
        for(const [x,y,w,h] of [[35,135,465,395],[580,545,490,435]]){
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);counts.push(await BatchCoins.detectCoins(canvas));
        }return counts;
      },data);
      console.log('Empty pockets',JSON.stringify(negatives));
      assert.deepEqual(negatives.map(r=>r.length),[0,0],'Empty album pockets must have no outlines');
    }
  }
  const conversion=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1200;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#aa7744';ctx.fillRect(500,300,400,400);
    const png=canvas.toDataURL('image/png'),jpeg=await BatchCoins.batchVisionImage(png);
    const image=new Image();image.src=jpeg;await image.decode();
    return {png:png.startsWith('data:image/png;'),jpeg:jpeg.startsWith('data:image/jpeg;base64,'),size:jpeg.length,width:image.width,height:image.height};
  });
  assert(conversion.png&&conversion.jpeg&&conversion.size<5_000_000);assert.equal(conversion.width,960);assert.equal(conversion.height,720);
  console.log('PASS real photographs, no-coin screenshot, empty pockets, independent limits and PNG-to-JPEG batch request conversion');
}finally{await browser.close();}
