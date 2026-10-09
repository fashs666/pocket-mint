// Optional UI regression suite: requires Playwright/Chromium; no production dependency.
// Run from the repo root: node tests/condition-guide-browser.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
let playwright;
try {playwright=await import('playwright');} catch {
  if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw new Error('Install Playwright to run the optional browser suite.');
  playwright=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/runtime.js')('playwright');
}
const root=path.resolve('public');
const server=http.createServer(async(req,res)=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    // Test-only image, used to exercise fallback and callouts, never added to the app dataset.
    if(pathname==='/condition-references/fixture.png')pathname='/icon-192.png';
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep))throw new Error('Outside asset root');
    const body=await readFile(file);
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await playwright.chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-gpu']});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>document.querySelector('#diagnostics')?.textContent.includes('v0.14.41'));
const closed=()=>page.waitForFunction(()=>!document.querySelector('#conditionGuide').open);
const saved=grade=>page.waitForFunction(g=>state.get(history.state.coinId)?.conditionGrade===g,grade);
try {
  await page.goto(url);await ready();
  await page.waitForFunction(()=>document.querySelector('#settingsView .pm-title-live'));
  const titleSizes=await page.evaluate(()=>[...document.querySelectorAll('.pm-title-live')].map(svg=>Number(svg.getAttribute('viewBox').split(' ')[2])));
  assert(titleSizes.every(width=>width>20),'Hidden page headings retain measurable glossy SVG titles');
  await page.evaluate(()=>{document.querySelector('#collectionTitle').textContent='Duplicates';});
  await page.waitForFunction(()=>document.querySelector('#collectionTitle .pm-title-live text')?.textContent==='Duplicates');
  await page.evaluate(()=>{document.querySelector('#collectionTitle').textContent='Collection';});
  const decoration=await page.evaluate(()=>{
    const card=document.querySelector('#homeSeries .pm-series-card');
    const sample=()=>{const s=getComputedStyle(card,'::after');return {image:s.backgroundImage,content:s.content,animation:s.animationName,top:s.top,bottom:s.bottom,width:s.width,height:s.height,transform:s.transform,opacity:s.opacity};};
    const before=sample();card.classList.add('pm-companion-noxel-idea','pm-companion-grim-clue');
    const during=sample();card.classList.remove('pm-companion-noxel-idea','pm-companion-grim-clue');
    return {before,during};
  });
  assert.deepEqual(decoration.during,decoration.before,'Companion notices must not animate or replace series artwork');
  assert.equal(decoration.during.animation,'none');
  assert(decoration.during.image.includes('artwork/series/'),'Series artwork remains visible');
  assert.equal(await page.locator('#homeView .sectionTitle .pm-title-art').count(),2,'Home section titles follow the approved artwork concept');

  if(process.env.CONDITION_STYLE_PREVIEW){
    await page.evaluate(()=>document.fonts.load('18px "Pocket Mint Bubble"'));
    for(const view of ['homeView','myMintView','findView','settingsView']){
      await page.evaluate(view=>navigate(view),view);
      await page.waitForTimeout(220);await page.screenshot({path:process.env.CONDITION_STYLE_PREVIEW+'-'+view+'.png'});
    }
  }
  if(process.env.CONDITION_STYLE_PREVIEW){
    await page.evaluate(()=>navigate('homeView'));await page.locator('#homeSeries').scrollIntoViewIfNeeded();await page.waitForTimeout(220);
    await page.screenshot({path:process.env.CONDITION_STYLE_PREVIEW+'-home-sections.png'});
    await page.evaluate(()=>navigate('findView'));await page.locator('#catalogueList .coinCard').first().scrollIntoViewIfNeeded();await page.waitForTimeout(220);
    await page.screenshot({path:process.env.CONDITION_STYLE_PREVIEW+'-coin-titles.png'});
  }
  const master=await page.evaluate(()=>JSON.stringify({catalogue,browseCatalogue,catalogueDesigns}));
  const id=await page.evaluate(()=>browseCatalogue.find(c=>c.denomination_cents===200).id);
  await page.evaluate(id=>openCoin(coinById(id)),id);
  assert.equal(await page.locator('#dCondition').inputValue(),'');
  await page.locator('#dQty').fill('1');await page.locator('#dNotes').fill('Unsaved note survives guide');
  await page.locator('#dFavourite').check();
  if(process.env.CONDITION_STYLE_PREVIEW){await page.locator('.editBlock h3').scrollIntoViewIfNeeded();await page.waitForTimeout(220);await page.screenshot({path:process.env.CONDITION_STYLE_PREVIEW+'-record.png'});}
  await page.locator('.condition-help').click();assert.equal(await page.locator('#cg-denomination').inputValue(),'2');
  if(process.env.CONDITION_STYLE_PREVIEW){await page.waitForTimeout(220);await page.screenshot({path:process.env.CONDITION_STYLE_PREVIEW+'-guide.png'});}
  await page.locator('[data-grade="VF"]').click();await page.locator('#cg-use').click();await closed();
  assert.equal(await page.locator('#dCondition').inputValue(),'VF');
  assert.equal(await page.locator('#dNotes').inputValue(),'Unsaved note survives guide');
  assert.equal(await page.locator('#dFavourite').isChecked(),true);
  await page.locator('input[value="toning"]').check();await page.locator('input[value="scratched"]').check();
  await page.locator('#saveDetail').click();await saved('VF');
  assert.deepEqual(await page.evaluate(()=>state.get(history.state.coinId).conditionIssues),['scratched','toning']);
  await page.locator('.condition-summary [data-condition-guide]').click();
  assert.equal(await page.locator('#conditionGuide [aria-selected="true"]').textContent(),'VF');
  await page.locator('#cg-compare').click();assert.equal(await page.locator('#cg-side-0').inputValue(),'VF');assert.equal(await page.locator('#cg-side-1').inputValue(),'EF');
  await page.locator('#cg-side-0').selectOption('F');assert.equal(await page.locator('#cg-side-1').inputValue(),'EF');
  await page.goBack();await page.locator('#cg-compare').waitFor();
  await page.goBack();await closed();assert.equal(await page.locator('#dCondition').inputValue(),'VF');
  await page.locator('.condition-help').click();await page.locator('[data-grade="EF"]').click();await page.locator('.cg-close').click();await closed();
  assert.equal(await page.locator('#dCondition').inputValue(),'VF','cancel must not apply viewed grade');
  await page.locator('.condition-help').click();await page.locator('#cg-compare').click();
  await page.locator('#cg-side-1').selectOption('EF');await page.locator('[data-use-side="EF"]').click();await closed();
  assert.equal(await page.locator('#dCondition').inputValue(),'EF');
  await page.locator('input[value="scratched"]').uncheck();await page.locator('#saveDetail').click();await saved('EF');
  await page.reload();await ready();await page.evaluate(id=>openCoin(coinById(id)),id);
  assert.equal(await page.locator('#dCondition').inputValue(),'EF');assert.equal(await page.locator('input[value="toning"]').isChecked(),true);assert.equal(await page.locator('input[value="scratched"]').isChecked(),false);
  await page.locator('#dCondition').selectOption('');await page.locator('#saveDetail').click();await saved(null);
  await page.reload();await ready();await page.evaluate(id=>openCoin(coinById(id)),id);assert.equal(await page.locator('#dCondition').inputValue(),'');
  await page.locator('#doneDetail').click();await page.waitForFunction(()=>!document.querySelector('#coinDialog').open);
  await page.evaluate(()=>openCoin(browseCatalogue.find(c=>c.denomination_cents===50)));await page.locator('.condition-help').click();assert.equal(await page.locator('#cg-denomination').inputValue(),'50');await page.locator('.cg-close').click();await closed();await page.locator('#doneDetail').click();await page.waitForFunction(()=>!document.querySelector('#coinDialog').open);
  await page.evaluate(()=>navigate('myMintView'));await page.locator('#myMintView [data-nav="helpView"]').click();await page.locator('#helpConditionGuide').click();assert.equal(await page.locator('#cg-use').count(),0);
  // Touch gestures change grades only on horizontal movement.
  await page.locator('[data-grade="VF"]').click();
  const swipe=async(dx,dy=0)=>page.locator('#cg-panel').evaluate((panel,{dx,dy})=>{
    panel.dispatchEvent(new TouchEvent('touchstart',{touches:[new Touch({identifier:1,target:panel,clientX:200,clientY:400})],bubbles:true}));
    panel.dispatchEvent(new TouchEvent('touchend',{changedTouches:[new Touch({identifier:1,target:panel,clientX:200+dx,clientY:400+dy})],bubbles:true}));
  },{dx,dy});
  await swipe(-100);assert.equal(await page.locator('#conditionGuide [aria-selected="true"]').textContent(),'EF');
  await swipe(5,100);assert.equal(await page.locator('#conditionGuide [aria-selected="true"]').textContent(),'EF');
  for(let i=0;i<12;i++)await swipe(-100);assert.equal(await page.locator('#conditionGuide [aria-selected="true"]').textContent(),'GEM');
  for(let i=0;i<12;i++)await swipe(100);assert.equal(await page.locator('#conditionGuide [aria-selected="true"]').textContent(),'G');
  await page.locator('[data-grade="VF"]').click();await page.locator('#cg-tab-VF').press('ArrowRight');assert.equal(await page.locator('#conditionGuide [aria-selected="true"]').textContent(),'EF');
  for(const width of [320,360,390,430,768,1280]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`page overflow at ${width}`);
    assert.equal(await page.evaluate(()=>{const d=document.querySelector('#conditionGuide');return d.scrollWidth<=d.clientWidth;}),true,`guide overflow at ${width}`);
    await page.locator('#cg-compare').click();
    assert.equal(await page.locator('[data-use-side]').count(),0,'reference-only comparison has no apply controls');
    assert.equal(await page.evaluate(()=>{const d=document.querySelector('#conditionGuide');return d.scrollWidth<=d.clientWidth;}),true,`comparison overflow at ${width}`);
    await page.goBack();await page.locator('#cg-compare').waitFor();
  }
  await page.setViewportSize({width:844,height:390});assert.equal(await page.locator('.cg-close').isVisible(),true);
  await page.setViewportSize({width:390,height:844});
  // Controlled test-only reference dataset: missing denomination image falls back to general.
  await page.evaluate(()=>PocketMintConditionData.references.push(
    {grade:'VF',denomination:'2',designId:null,image:'condition-references/missing.png',source:'Test-only fixture',rightsNote:'Not a grade example'},
    {grade:'VF',denomination:null,designId:null,image:'condition-references/fixture.png',source:'Test-only fixture',rightsNote:'Not a grade example',callouts:[{x:50,y:25,label:'Fixture annotation'}]}
  ));
  await page.locator('#cg-denomination').selectOption('2');await page.locator('[data-grade="VF"]').click();
  await page.locator('.cg-reference img').waitFor();assert.equal(await page.locator('.cg-callout').textContent(),'Fixture annotation');
  assert.ok((await page.locator('.cg-reference img').getAttribute('src')).includes('fixture.png'));
  await page.locator('[data-grade="G"]').click();assert.equal(await page.locator('.cg-reference img').count(),0);assert.equal(await page.locator('.cg-photo-missing').isVisible(),true);
  assert.equal(await page.evaluate(()=>JSON.stringify({catalogue,browseCatalogue,catalogueDesigns})),master,'catalogue must not receive condition fields');
  await page.waitForFunction(()=>navigator.serviceWorker.controller,{timeout:30000});
  const assets=await page.evaluate(async()=>{const c=await caches.open('pocket-mint-v0.14.41-batch-catalogue');return Promise.all(['pm-live-headings.js','batch-photo-rotation.js','fonts/coiny-latin-400.woff2','pm-headings.css','artwork/headings/neon-titles.png','artwork/headings/section-titles.png','condition-data.js','condition-guide.js','condition-editor.js','condition-guide.css'].map(async p=>Boolean(await c.match('./'+p))));});
  assert(assets.every(Boolean),'Guide, heading font and title assets must be cached offline');
  await context.setOffline(true);await page.reload();await ready();
  await page.evaluate(()=>navigate('helpView'));await page.locator('#helpConditionGuide').click();await page.locator('[data-grade="GEM"]').click();assert.equal(await page.locator('#conditionGuide [aria-selected="true"]').textContent(),'GEM');
  await page.locator('.cg-close').click();await closed();await page.evaluate(id=>openCoin(coinById(id)),id);await page.locator('#dCondition').selectOption('CHU');await page.locator('#saveDetail').click();await saved('CHU');
  await page.locator('#doneDetail').click();
  const frames=[];
  for(const [view,selector] of [['homeView','#recentCoins .coinCard'],['findView','#catalogueList .coinCard'],['collectionView','#myMintList .coinCard']]){
    await page.evaluate(view=>navigate(view),view);
    if(view==='findView'){
      assert(await page.locator('[data-find-panel="identify"]').isVisible(),'Find opens photo identification first');
      await page.locator('[data-find-tab="catalogue"]').click();
      await page.locator('#catalogueSearch').fill('Coming Home');assert.equal(await page.locator('#catalogueList .coinCard').count(),1,'Coming Home finds the existing 2005 20c issue');await page.locator('#catalogueSearch').fill('');
    }
    const card=page.locator(selector).first();await card.waitFor({state:'visible'});
    const appearance=await card.evaluate(el=>{
      const frame=getComputedStyle(el,'::before'),name=getComputedStyle(el.querySelector('h3')),outer=getComputedStyle(el),well=getComputedStyle(el.querySelector('.coinArtwork'));
      el.classList.add('pm-companion-spotlight');const outline=getComputedStyle(el).outlineStyle;el.classList.remove('pm-companion-spotlight');
      return {frame:{source:frame.borderImageSource,slice:frame.borderImageSlice,repeat:frame.borderImageRepeat,width:frame.borderTopWidth,background:frame.backgroundImage,clip:frame.backgroundClip,filter:frame.filter,outerBorder:outer.borderTopWidth,outerRadius:outer.borderRadius,outerBackground:outer.backgroundImage,wellBorder:well.borderColor,wellRadius:well.borderRadius,wellShadow:well.boxShadow},name:{color:name.color,background:name.backgroundImage,stroke:name.webkitTextStrokeWidth,font:name.fontFamily,weight:name.fontWeight},outline};
    });
    assert.equal(appearance.name.background,'none','Coin names must not have a neon gradient');
    assert.equal(appearance.name.color,'rgb(24, 25, 47)','Coin names keep the original dark colour');
    assert.equal(appearance.name.stroke,'0px');assert.equal(appearance.outline,'none','Companions do not add a rectangular frame');
    assert(appearance.frame.source.includes('coin-wobble.svg'));assert.equal(appearance.frame.repeat,'stretch round');assert.equal(appearance.frame.width,'20px');assert(!appearance.frame.background.includes('coin-wobble.svg'),'No second stretched frame beneath the sliced edge');frames.push(appearance.frame);
    if(process.env.CONDITION_STYLE_PREVIEW){await card.scrollIntoViewIfNeeded();await page.waitForTimeout(220);await page.screenshot({path:process.env.CONDITION_STYLE_PREVIEW+'-cohesion-'+view+'.png'});}
  }
  assert.deepEqual(frames[1],frames[0],'Browse and Home share the coin frame');
  assert.deepEqual(frames[2],frames[0],'My Mint and Home share the coin frame');
  assert.deepEqual(errors,[]);
  console.log('PASS browser: Add/Edit/Detail/Help, choose/cancel/unset/reload, independent issues, compare/apply, Back, swipes, keyboard, six widths/rotation, image fallback/callouts, offline browsing/saving, unchanged catalogue.');
} finally {await browser.close();server.close();}
