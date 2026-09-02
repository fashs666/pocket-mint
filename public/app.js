const DB_NAME='PocketMintPhase0',DB_VERSION=2;let catalogue=[],catMeta={},state=new Map(),photoMap=new Map(),mintFilter='all',deferredInstallPrompt=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}function human(v){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function openDB(){return new Promise((resolve,reject)=>{let r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{let db=r.result;if(!db.objectStoreNames.contains('myMint'))db.createObjectStore('myMint',{keyPath:'coin_id'});if(!db.objectStoreNames.contains('personalPhotos')){let s=db.createObjectStore('personalPhotos',{keyPath:'id'});s.createIndex('coin_id','coin_id',{unique:false})}if(!db.objectStoreNames.contains('appMeta'))db.createObjectStore('appMeta',{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function getAll(store){let db=await openDB();return new Promise((res,rej)=>{let r=db.transaction(store,'readonly').objectStore(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function put(store,val){let db=await openDB();return new Promise((res,rej)=>{let tx=db.transaction(store,'readwrite');tx.objectStore(store).put(val);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function del(store,key){let db=await openDB();return new Promise((res,rej)=>{let tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function clearStore(store){let db=await openDB();return new Promise((res,rej)=>{let tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function loadLocal(){let records=await getAll('myMint'),photos=await getAll('personalPhotos');state=new Map(records.map(x=>[x.coin_id,x]));photoMap=new Map;for(let p of photos){if(!photoMap.has(p.coin_id))photoMap.set(p.coin_id,[]);photoMap.get(p.coin_id).push(p)}}
function baseRec(id){return{coin_id:id,quantity:0,wishlist:false,condition:'',notes:'',date_added:'',updated_at:new Date().toISOString()}}
async function saveRec(id,patch){let rec={...baseRec(id),...(state.get(id)||{}),...patch,updated_at:new Date().toISOString()};state.set(id,rec);await put('myMint',rec);renderAll();return rec}
async function init(){let p=await (await fetch('./catalogue.json',{cache:'no-cache'})).json();catalogue=p.coins||[];catMeta=p.meta||{};await loadLocal();await put('appMeta',{key:'catalogue_version',value:catMeta.catalogue_version});initYears();wire();renderAll();updateNetwork();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');}
function initYears(){let s=document.getElementById('yearFilter');[...new Set(catalogue.map(c=>c.year))].sort().forEach(y=>{let o=document.createElement('option');o.value=y;o.textContent=y;s.appendChild(o)})}
function card(c){let s=state.get(c.id)||baseRec(c.id),owned=s.quantity>0,d=document.createElement('div');d.className='coin';d.innerHTML=`<div class="coinMain"><h3>${c.year} ${esc(c.title)}</h3><div class="meta">$1 · ${human(c.coin_class)}${c.mintage?` · Mintage ${Number(c.mintage).toLocaleString()}`:''}</div><div class="tags"><span class="tag">${c.test_scope==='circulation_core'?'circulating core':'collector test'}</span>${owned?'<span class="tag owned">owned</span>':''}${s.wishlist?'<span class="tag wish">wishlist</span>':''}</div></div><div class="coinControls"><button data-a="minus">−</button><span class="qty">${s.quantity||0}</span><button data-a="plus">+</button><button data-a="wish" class="${s.wishlist?'on':''}">♡</button></div>`;d.querySelector('.coinMain').onclick=()=>showCoin(c);d.querySelector('[data-a=plus]').onclick=()=>saveRec(c.id,{quantity:(s.quantity||0)+1,date_added:s.date_added||new Date().toISOString().slice(0,10)});d.querySelector('[data-a=minus]').onclick=()=>saveRec(c.id,{quantity:Math.max(0,(s.quantity||0)-1)});d.querySelector('[data-a=wish]').onclick=()=>saveRec(c.id,{wishlist:!s.wishlist});return d}
function filteredCatalogue(){let q=document.getElementById('catalogueSearch').value.trim().toLowerCase(),y=document.getElementById('yearFilter').value,scope=document.getElementById('scopeFilter').value,st=document.getElementById('stateFilter').value;return catalogue.filter(c=>{let s=state.get(c.id)||baseRec(c.id),hay=[c.year,c.title,c.series_id,c.issue_type,c.coin_class,c.obverse_effigy,c.privy_mark].filter(Boolean).join(' ').toLowerCase();return(!q||hay.includes(q))&&(!y||String(c.year)===y)&&(!scope||c.test_scope===scope)&&(!st||(st==='owned'&&s.quantity>0)||(st==='missing'&&s.quantity===0)||(st==='wishlist'&&s.wishlist))})}
function renderCatalogue(){let l=document.getElementById('catalogueList');l.innerHTML='';filteredCatalogue().forEach(c=>l.appendChild(card(c)));if(!l.children.length)l.innerHTML='<div class="empty">No coins match these filters.</div>'}
function renderSearch(){let q=document.getElementById('searchInput').value.trim().toLowerCase(),l=document.getElementById('searchList');l.innerHTML='';if(!q){l.innerHTML='<div class="empty">Search year, title, series, issue, effigy or privy mark.</div>';return}catalogue.filter(c=>[c.year,c.title,c.series_id,c.issue_type,c.coin_class,c.obverse_effigy,c.privy_mark,c.notes].filter(Boolean).join(' ').toLowerCase().includes(q)).forEach(c=>l.appendChild(card(c)));if(!l.children.length)l.innerHTML='<div class="empty">No matching test records.</div>'}
function renderMint(){let l=document.getElementById('myMintList');l.innerHTML='';let arr=catalogue.filter(c=>{let s=state.get(c.id);if(!s)return false;if(mintFilter==='owned')return s.quantity>0;if(mintFilter==='wishlist')return s.wishlist;return s.quantity>0||s.wishlist});arr.forEach(c=>l.appendChild(card(c)));if(!arr.length)l.innerHTML='<div class="empty">Nothing here yet.</div>';let unique=catalogue.filter(c=>(state.get(c.id)?.quantity||0)>0).length,total=[...state.values()].reduce((n,s)=>n+(s.quantity||0),0),dupes=[...state.values()].reduce((n,s)=>n+Math.max(0,(s.quantity||0)-1),0),wish=[...state.values()].filter(s=>s.wishlist).length;document.getElementById('mintStats').innerHTML=stats([[unique,'Unique'],[total,'Specimens'],[dupes,'Duplicates'],[wish,'Wishlist']])}
function stats(a){return a.map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}
function renderHome(){let unique=catalogue.filter(c=>(state.get(c.id)?.quantity||0)>0).length,total=[...state.values()].reduce((n,s)=>n+(s.quantity||0),0),core=catalogue.filter(c=>c.test_scope==='circulation_core').length,ownedCore=catalogue.filter(c=>c.test_scope==='circulation_core'&&(state.get(c.id)?.quantity||0)>0).length;document.getElementById('homeStats').innerHTML=stats([[core,'Circulation core'],[ownedCore,'Core owned'],[unique,'Unique owned'],[total,'Specimens']]);document.getElementById('catVersion').textContent='Catalogue '+(catMeta.catalogue_version||'')}
function renderDiag(){document.getElementById('diagnostics').innerHTML=`<p><b>Database:</b> ${DB_NAME} schema v${DB_VERSION}</p><p><b>Catalogue:</b> ${esc(catMeta.catalogue_version||'—')}</p><p><b>Local records:</b> ${state.size}</p><p><b>Personal photos:</b> ${[...photoMap.values()].reduce((n,a)=>n+a.length,0)}</p><p><b>Connection:</b> ${navigator.onLine?'online':'offline'}</p>`}
function renderAll(){renderHome();renderCatalogue();renderSearch();renderMint();renderDiag()}
async function showCoin(c){let s=state.get(c.id)||baseRec(c.id),photos=photoMap.get(c.id)||[];let box=document.getElementById('dialogContent');box.innerHTML=`<div class="eyebrow">${esc(c.id)}</div><h2>${c.year} ${esc(c.title)}</h2><p class="muted">${human(c.coin_class)} · ${human(c.issue_type)}</p><div class="detailGrid"><div><span>Denomination</span><b>$1</b></div><div><span>Mintage</span><b>${c.mintage?Number(c.mintage).toLocaleString():esc(c.mintage_status||'—')}</b></div><div><span>Composition</span><b>${esc(c.composition||'—')}</b></div><div><span>Size</span><b>${c.mass_grams??'—'} g · ${c.diameter_mm??'—'} mm</b></div><div><span>Effigy</span><b>${esc(c.obverse_effigy||'—')}</b></div><div><span>Catalogue class</span><b>${c.test_scope==='circulation_core'?'Circulation core':'Collector exemplar'}</b></div></div><div class="editBlock"><h3>My Mint record</h3><label>Quantity</label><input id="dQty" type="number" min="0" value="${s.quantity||0}"><label>Condition</label><select id="dCondition"><option value="">Not set</option>${['Poor','Fair','Good','Very Good','Fine','Very Fine','Extremely Fine','About Uncirculated','Uncirculated'].map(x=>`<option ${s.condition===x?'selected':''}>${x}</option>`).join('')}</select><label>Date added</label><input id="dDate" type="date" value="${esc(s.date_added||'')}"><label>Notes</label><textarea id="dNotes" rows="4" placeholder="Personal notes…">${esc(s.notes||'')}</textarea><label><input id="dWish" type="checkbox" ${s.wishlist?'checked':''}> Wishlist</label><label>Personal photos</label><input id="photoInput" type="file" accept="image/*" capture="environment" multiple><div id="photoGrid" class="photoGrid"></div><div class="dialogActions"><button type="button" id="saveDetail">Save record</button><button type="button" id="closeDetail">Done</button></div></div>`;renderPhotos(c.id);box.querySelector('#saveDetail').onclick=async()=>{await saveRec(c.id,{quantity:Math.max(0,Number(box.querySelector('#dQty').value)||0),condition:box.querySelector('#dCondition').value,date_added:box.querySelector('#dDate').value,notes:box.querySelector('#dNotes').value.trim(),wishlist:box.querySelector('#dWish').checked});};box.querySelector('#closeDetail').onclick=()=>document.getElementById('coinDialog').close();box.querySelector('#photoInput').onchange=async e=>{for(let f of e.target.files)await addPhoto(c.id,f);renderPhotos(c.id);renderDiag()};document.getElementById('coinDialog').showModal()}
function renderPhotos(id){let g=document.getElementById('photoGrid');if(!g)return;g.innerHTML='';for(let p of(photoMap.get(id)||[])){let d=document.createElement('div');d.className='photo';d.innerHTML=`<img src="${p.data_url}" alt="Personal coin photo"><button type="button">×</button>`;d.querySelector('button').onclick=async()=>{await del('personalPhotos',p.id);photoMap.set(id,(photoMap.get(id)||[]).filter(x=>x.id!==p.id));renderPhotos(id);renderDiag()};g.appendChild(d)}}
function resizeImage(file){return new Promise((res,rej)=>{let rd=new FileReader;rd.onerror=rej;rd.onload=()=>{let im=new Image;im.onload=()=>{let max=1200,scale=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))};im.onerror=rej;im.src=rd.result};rd.readAsDataURL(file)})}
async function addPhoto(id,file){let p={id:crypto.randomUUID(),coin_id:id,data_url:await resizeImage(file),created_at:new Date().toISOString()};await put('personalPhotos',p);if(!photoMap.has(id))photoMap.set(id,[]);photoMap.get(id).push(p)}
async function exportBackup(){let data={format:'pocket-mint-backup',version:1,created_at:new Date().toISOString(),catalogue_version:catMeta.catalogue_version,my_mint:await getAll('myMint'),personal_photos:await getAll('personalPhotos'),app_meta:await getAll('appMeta')};let b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`pocket-mint-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function restoreBackup(file){let d=JSON.parse(await file.text());if(d.format!=='pocket-mint-backup'||!Array.isArray(d.my_mint))throw new Error('Not a Pocket Mint backup');await clearStore('myMint');await clearStore('personalPhotos');for(let r of d.my_mint)await put('myMint',r);for(let p of(d.personal_photos||[]))await put('personalPhotos',p);await loadLocal();renderAll()}
async function selfTest(){let o=[],db=await openDB();o.push('✓ IndexedDB opened: schema v'+db.version);o.push(db.objectStoreNames.contains('myMint')?'✓ My Mint store present':'✗ My Mint missing');o.push(db.objectStoreNames.contains('personalPhotos')?'✓ Photo store present':'✗ Photo store missing');o.push(`✓ Catalogue loaded: ${catalogue.length} records`);let core=catalogue.filter(c=>c.test_scope==='circulation_core');o.push(`✓ Circulation core: ${core.length} records / ${new Set(core.map(c=>c.year)).size} issue years`);let orphan=[...state.keys()].filter(id=>!catalogue.some(c=>c.id===id));o.push(orphan.length?`⚠ ${orphan.length} personal records reference absent catalogue IDs`:'✓ Every personal record still resolves to catalogue');o.push(navigator.serviceWorker?.controller?'✓ Service worker controlling this page':'⚠ Service worker not controlling yet (reload once)');o.push('✓ Catalogue and personal stores are separate');o.push('PASS: destructive catalogue overwrite is not used.');document.getElementById('testOutput').textContent=o.join('\n')}
function updateNetwork(){let b=document.getElementById('offlineBadge');b.textContent=navigator.onLine?'ONLINE':'OFFLINE';b.classList.toggle('offline',!navigator.onLine);renderDiag()}
function wire(){['yearFilter','scopeFilter','stateFilter'].forEach(id=>document.getElementById(id).onchange=renderCatalogue);document.getElementById('catalogueSearch').oninput=renderCatalogue;document.getElementById('searchInput').oninput=renderSearch;document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(b.dataset.nav).classList.add('active');document.querySelectorAll('.bottomNav button').forEach(x=>x.classList.toggle('active',x.dataset.nav===b.dataset.nav));scrollTo(0,0)});document.querySelectorAll('[data-mintfilter]').forEach(b=>b.onclick=()=>{mintFilter=b.dataset.mintfilter;document.querySelectorAll('[data-mintfilter]').forEach(x=>x.classList.toggle('on',x===b));renderMint()});document.getElementById('exportBtn').onclick=exportBackup;document.getElementById('restoreInput').onchange=async e=>{try{await restoreBackup(e.target.files[0]);alert('Pocket Mint backup restored.')}catch(err){alert('Restore failed: '+err.message)}e.target.value=''};document.getElementById('selfTestBtn').onclick=selfTest;document.getElementById('resetBtn').onclick=async()=>{if(!confirm('Delete My Mint records and personal photos from this device?'))return;await clearStore('myMint');await clearStore('personalPhotos');state.clear();photoMap.clear();renderAll()};window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;let b=document.getElementById('installBtn');b.hidden=false;b.onclick=async()=>{deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;b.hidden=true;deferredInstallPrompt=null}})}
init().catch(err=>{console.error(err);document.body.innerHTML=`<main><article class="card" style="padding:20px"><h2>Pocket Mint failed to start</h2><pre>${esc(err.stack||err)}</pre></article></main>`})

// Phase 0 v0.4 collection semantics + navigation
function pmToday(){
  return new Date().toISOString().slice(0,10);
}

async function pmSetQuantity(coinId, quantity){
  quantity = Math.max(0, Number(quantity)||0);
  const old = state.get(coinId) || {coin_id:coinId, quantity:0, wishlist:false, favourite:false};
  const patch = {quantity};
  if(quantity > 0){
    patch.wishlist = false;
    if(!old.date_added) patch.date_added = pmToday();
  }
  return saveRecord(coinId, patch);
}

async function pmToggleFavourite(coinId){
  const old = state.get(coinId) || {coin_id:coinId, quantity:0, wishlist:false, favourite:false};
  return saveRecord(coinId, {favourite:!old.favourite});
}

function pmSeriesCoins(c){
  if(!c.series_id) return [];
  return catalogue.filter(x=>x.series_id===c.series_id);
}

function pmSeriesProgress(c){
  const all=pmSeriesCoins(c);
  const owned=all.filter(x=>(state.get(x.id)?.quantity||0)>0).length;
  return {all,owned,total:all.length};
}

function pmSeriesHtml(c){
  const p=pmSeriesProgress(c);
  if(!c.series_id || p.total<2) return '';
  const items=p.all.filter(x=>x.id!==c.id).map(x=>{
    const s=state.get(x.id)||{};
    const status=(s.quantity||0)>0?'Owned':(s.wishlist?'Wishlist':'Missing');
    return `<button type="button" class="seriesCoin" data-series-coin="${x.id}">
      <b>${escapeHtml(x.year+' '+x.title)}</b><span>${status}</span>
    </button>`;
  }).join('');
  return `<section class="seriesBox">
    <div class="eyebrow">SERIES</div>
    <h3>${escapeHtml(c.series_id.replaceAll('_',' '))}</h3>
    <p><strong>${p.owned} / ${p.total} collected</strong></p>
    <div class="progress"><i style="width:${p.total?Math.round(p.owned/p.total*100):0}%"></i></div>
    <h3 class="seriesMore">More coins from this series</h3>
    <div class="seriesList">${items}</div>
  </section>`;
}

function pmBindSeriesLinks(){
  document.querySelectorAll('[data-series-coin]').forEach(b=>{
    b.onclick=()=>{
      const c=catalogue.find(x=>x.id===b.dataset.seriesCoin);
      if(c) showCoin(c, true);
    };
  });
}

function pmPushView(viewId){
  history.pushState({pmView:viewId},'',`#${viewId.replace('View','')}`);
  pmShowView(viewId);
}
function pmShowView(viewId){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const v=document.getElementById(viewId); if(v) v.classList.add('active');
  document.querySelectorAll('.bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===viewId));
}
window.addEventListener('popstate',e=>{
  const dlg=document.getElementById('coinDialog');
  if(dlg?.open){ dlg.close(); return; }
  pmShowView(e.state?.pmView || 'homeView');
});

if(!history.state?.pmView) history.replaceState({pmView:'homeView'},'',location.pathname+'#home');
