/* Series UI and accomplishment history. Catalogue membership stays canonical.
 * History uses appMeta in the existing PocketMintPhase0 IndexedDB database. */
let activeSeriesId=null,milestoneHistory=new Map(),pendingSeriesCelebrations=[],celebrationBusy=false;
const milestoneKey=id=>`milestone:series:${id}`;

function seriesProgressFor(id,records=state){
  const series=catalogueSeries.find(item=>item.id===id);
  if(!series)return null;
  const coins=groupCatalogueCoins(browseCatalogue.filter(coin=>coin.seriesId===id));
  const owned=coins.filter(coin=>designVariants(coin).some(variant=>records.get(variant.id)?.quantity>0)).length;
  const total=coins.length;
  const recent=coins.flatMap(coin=>designVariants(coin)).map(coin=>records.get(coin.id)?.updated_at||'').sort().at(-1)||'';
  return {...series,coins,owned,total,remaining:total-owned,percent:total?Math.round(owned/total*100):0,complete:total>0&&owned===total,recent};
}

function allSeriesProgress(){return catalogueSeries.map(series=>seriesProgressFor(series.id)).filter(series=>series.total>0);}

function continueSeriesChoice(series=allSeriesProgress()){
  const incomplete=series.filter(item=>!item.complete);
  const pool=incomplete.length?incomplete:series;
  return [...pool].sort((a,b)=>Number(b.owned>0)-Number(a.owned>0)||
    (a.complete?String(milestoneHistory.get(b.id)?.completed_at||b.recent).localeCompare(String(milestoneHistory.get(a.id)?.completed_at||a.recent)):
      b.percent-a.percent||a.remaining-b.remaining||b.recent.localeCompare(a.recent))||a.title.localeCompare(b.title))[0];
}

function seriesCardHtml(item,{milestone=null}={}){
  const date=milestone?.completed_at?new Date(milestone.completed_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}):null;
  const subtitle=milestone?`${milestone.total_at_completion} / ${milestone.total_at_completion} collected at completion${date?` · Completed ${date}`:' · Completion recorded from existing collection'}`:`${item.owned} of ${item.total} collected · ${item.remaining?`${item.remaining} remaining`:'100%'}`;
  return `<button type="button" class="pm-series-card pm-frame pm-cream-card ${item.complete?'is-complete':''}" data-series-id="${esc(item.id)}"><span class="pm-progress-ring pm-series-ring" style="--pm-progress:${item.percent}%" aria-hidden="true"><strong>${item.percent}%</strong></span><span class="pm-series-copy"><b>${esc(milestone?.title||item.title)}</b><small>${esc(subtitle)}</small>${milestone||item.complete?`<span class="pm-capsule complete">✓ ${milestone?'Series completed':'Complete'}</span>`:''}${milestone&&!item.complete?'<small>Currently incomplete · your milestone is kept</small>':''}</span><span aria-hidden="true">›</span></button>`;
}

function renderContinueSeries(){
  const root=document.getElementById('homeSeries'),item=continueSeriesChoice();
  root.innerHTML=item?seriesCardHtml(item):'<div class="pm-frame pm-empty-state">No series available in this catalogue.</div>';
}

function renderSeriesDirectory(){
  const root=document.getElementById('statsSeries');
  if(!root)return;
  root.innerHTML=allSeriesProgress().sort((a,b)=>Number(a.complete)-Number(b.complete)||b.percent-a.percent||a.title.localeCompare(b.title)).map(item=>seriesCardHtml(item)).join('');
  const link=document.getElementById('milestoneCount');
  if(link)link.textContent=`${milestoneHistory.size} completed series`;
}

function filteredSeriesCoins(id,{denomination='',status=''}={}){
  const item=seriesProgressFor(id);
  if(!item)return [];
  return item.coins.filter(coin=>{
    const records=recordForDesign(coin),owned=records.some(record=>record.quantity>0);
    return (!denomination||String(coin.denomination_cents)===denomination)&&(!status||status==='owned'&&owned||status==='missing'&&!owned||status==='wishlist'&&records.some(record=>record.wishlist)||status==='favourite'&&records.some(record=>record.favourite));
  });
}

function renderSeriesView(){
  if(!activeSeriesId)return;
  const item=seriesProgressFor(activeSeriesId);
  if(!item){document.getElementById('seriesHeader').innerHTML='<h2>Series not found</h2>';return;}
  document.getElementById('seriesHeader').innerHTML=`<div class="pm-progress-ring" style="--pm-progress:${item.percent}%" role="img" aria-label="${item.percent}% collected"><strong>${item.percent}%</strong></div><div class="seriesHeaderCopy"><div class="eyebrow">YOUR SERIES ALBUM</div><h2>${esc(item.title)}</h2>${item.description?`<p>${esc(item.description)}</p>`:''}<p><b>${item.owned} of ${item.total} collected</b> · ${item.percent}%</p><span class="pm-capsule ${item.complete?'complete':''}">${item.complete?'✓ Series complete':`${item.remaining} coin${item.remaining===1?'':'s'} remaining`}</span></div>`;
  const select=document.getElementById('seriesDenomination'),old=select.value;
  const denominations=[...new Map(item.coins.map(coin=>[coin.denomination_cents,coin.denomination_display])).entries()].sort((a,b)=>a[0]-b[0]);
  select.replaceChildren(new Option('All values',''),...denominations.map(([value,label])=>new Option(label,value)));
  select.value=denominations.some(([value])=>String(value)===old)?old:'';
  const coins=filteredSeriesCoins(activeSeriesId,{denomination:select.value,status:document.getElementById('seriesState').value});
  fillList('seriesCoins',coins,'No coins in this series match these filters.','series');
  document.getElementById('seriesResultCount').textContent=`${coins.length} of ${item.total} designs shown`;
  window.PocketMintCompanions?.refresh();
}

function openSeries(id){
  if(!seriesProgressFor(id))return;
  document.getElementById('coinDialog').close();
  activeSeriesId=id;
  document.getElementById('seriesDenomination').value='';document.getElementById('seriesState').value='';
  history.pushState({view:'seriesView',seriesId:id,fromView:currentView()},'',`#series/${encodeURIComponent(id)}`);
  showView('seriesView');renderSeriesView();
}

function renderMilestones(){
  const root=document.getElementById('milestoneList');
  if(!root)return;
  const items=[...milestoneHistory.values()].sort((a,b)=>String(b.completed_at||b.recorded_at).localeCompare(String(a.completed_at||a.recorded_at)));
  root.innerHTML=items.map(milestone=>{
    const item=seriesProgressFor(milestone.series_id);
    return item?seriesCardHtml(item,{milestone}):`<article class="pm-frame"><h3>${esc(milestone.title)}</h3><p>Completed series · not in the current catalogue</p></article>`;
  }).join('')||'<article class="pm-frame pm-empty-state"><span class="pm-capsule">✧ A little space for big finds</span><h3>Your collection story starts here</h3><p>Complete a series to save your first milestone. No points or streaks — just your collection story.</p></article>';
}

async function loadMilestoneHistory(){
  milestoneHistory=new Map((await getAll('appMeta')).filter(item=>item.key?.startsWith('milestone:series:')&&item.value?.type==='series_completed').map(item=>[item.value.series_id,item.value]));
}

function completionRecord(item,{existing=false}={}){
  const now=new Date().toISOString();
  return {id:`series:${item.id}`,schema_version:1,type:'series_completed',series_id:item.id,title:item.title,total_at_completion:item.total,completed_at:existing?null:now,recorded_at:now,seriesCompletedAt:existing?null:now,seriesCompletionCelebrated:existing,source:existing?'existing_collection':'collection_transition'};
}

// One transaction commits the normal record and its first-completion marker.
// There is no animation or timer between the write and transaction completion.
async function persistCollectionRecord(next){
  const coin=coinById(next.coin_id),before=coin?.seriesId?seriesProgressFor(coin.seriesId):null;
  const projected=new Map(state);projected.set(next.coin_id,next);
  const after=before?seriesProgressFor(before.id,projected):null;
  const completed=before&&!before.complete&&after.complete?after:null;
  const db=await openDB(),events=[];
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['myMint','appMeta'],'readwrite');
    tx.objectStore('myMint').put(next);
    if(completed){
      const request=tx.objectStore('appMeta').get(milestoneKey(completed.id));
      request.onsuccess=()=>{
        if(request.result){milestoneHistory.set(completed.id,request.result.value);return;}
        const milestone=completionRecord(completed);
        tx.objectStore('appMeta').put({key:milestoneKey(completed.id),value:milestone});events.push(milestone);
      };
    }
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Collection write aborted'));tx.onerror=()=>reject(tx.error);
  });
  events.forEach(event=>milestoneHistory.set(event.series_id,event));
  return events;
}

async function initialiseExistingSeriesHistory(){
  // Baseline completed collections without inventing a past completion date
  // or replaying their achievement on first install of this feature.
  for(const item of allSeriesProgress().filter(item=>item.complete&&!milestoneHistory.has(item.id))){
    const db=await openDB();let milestone;
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('appMeta','readwrite'),store=tx.objectStore('appMeta'),request=store.get(milestoneKey(item.id));
      request.onsuccess=()=>{milestone=request.result?.value||completionRecord(item,{existing:true});if(!request.result)store.put({key:milestoneKey(item.id),value:milestone});};
      tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
    });
    milestoneHistory.set(item.id,milestone);
  }
}

function queueSeriesCelebrations(events){
  pendingSeriesCelebrations.push(...events);
  setTimeout(showNextSeriesCelebration,0);
}

async function showNextSeriesCelebration(){
  const dialog=document.getElementById('seriesCelebration');
  if(celebrationBusy||dialog.open||!pendingSeriesCelebrations.length)return;
  celebrationBusy=true;
  const milestone=pendingSeriesCelebrations.shift();
  if(milestone.seriesCompletionCelebrated){celebrationBusy=false;return showNextSeriesCelebration();}
  try{
    // Persist before display so a refresh/remove/re-add cannot replay it.
    const celebrated={...milestone,seriesCompletionCelebrated:true};
    await put('appMeta',{key:milestoneKey(milestone.series_id),value:celebrated});
    milestoneHistory.set(milestone.series_id,celebrated);
    document.getElementById('seriesCelebrationContent').innerHTML=`<button type="button" class="seriesDismiss" data-dismiss-celebration aria-label="Dismiss series completion">×</button><img class="seriesCelebrationArt" src="characters/grim-noxel-high-five.webp" width="360" height="240" alt="Grim and Noxel celebrate"><span class="pm-capsule complete">✧ SERIES COMPLETE!</span><h2 id="seriesCelebrationTitle">${esc(milestone.title)}</h2><p>You collected all ${milestone.total_at_completion} coins in this series.</p><div class="pm-progress-ring" style="--pm-progress:100%" aria-label="100% complete"><strong>100%</strong></div><b>${milestone.total_at_completion} / ${milestone.total_at_completion} collected</b><div class="seriesCelebrationActions"><button type="button" class="pm-primary-button" data-celebration-series="${esc(milestone.series_id)}">View completed series</button><button type="button" class="secondary" data-dismiss-celebration>Keep exploring</button></div>`;
    history.pushState({...history.state,celebrationId:milestone.series_id},'',location.hash);
    dialog.showModal();
    window.PocketMintCompanions?.celebrate();renderMilestones();renderSeriesDirectory();
  }catch(error){console.error('Series celebration could not open',error);showToast('Series milestone saved',milestone.title);}
  finally{celebrationBusy=false;}
}

function dismissSeriesCelebration(){
  const dialog=document.getElementById('seriesCelebration');
  if(history.state?.celebrationId)history.back();
  else{dialog.close();setTimeout(showNextSeriesCelebration,0);}
}

function wireSeriesExperience(){
  const filtersChanged=()=>{history.replaceState({...history.state,seriesFilters:{denomination:document.getElementById('seriesDenomination').value,status:document.getElementById('seriesState').value}},'',location.hash);renderSeriesView();};
  document.getElementById('seriesDenomination').onchange=filtersChanged;
  document.getElementById('seriesState').onchange=filtersChanged;
  document.getElementById('seriesClearFilters').onclick=()=>{document.getElementById('seriesDenomination').value='';document.getElementById('seriesState').value='';filtersChanged();};
  document.querySelectorAll('[data-page-back]').forEach(button=>button.onclick=()=>history.state?.fromView?history.back():navigate(currentView()==='milestonesView'?'statsView':'homeView'));
  document.addEventListener('click',event=>{
    const series=event.target.closest('[data-series-id]');if(series)openSeries(series.dataset.seriesId);
    const view=event.target.closest('[data-celebration-series]');
    if(view){const id=view.dataset.celebrationSeries;const after=()=>{window.removeEventListener('popstate',after);openSeries(id);};if(history.state?.celebrationId){window.addEventListener('popstate',after,{once:true});dismissSeriesCelebration();}else{dismissSeriesCelebration();openSeries(id);}}
    if(event.target.closest('[data-dismiss-celebration]'))dismissSeriesCelebration();
  });
  document.getElementById('seriesCelebration').addEventListener('cancel',event=>{event.preventDefault();dismissSeriesCelebration();});
}
