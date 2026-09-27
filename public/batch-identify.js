(() => {
  const panel=document.getElementById('batchIdentify'), normal=document.getElementById('singleIdentify');
  const image=document.getElementById('batchImage'),overlay=document.getElementById('batchOverlay');
  const status=document.getElementById('batchStatus'),grid=document.getElementById('batchCrops');
  const state={stage:'entry',source:null,sourceUrl:null,regions:[],crops:[],selected:null,adding:false,job:0};
  const $=id=>document.getElementById(id);
  function releaseCrops(){state.crops.forEach(c=>URL.revokeObjectURL(c.cropUrl));state.crops=[];}
  function resetPhoto(){state.job++;releaseCrops();if(state.sourceUrl)URL.revokeObjectURL(state.sourceUrl);state.sourceUrl=null;state.source=null;state.regions=[];state.selected=null;state.adding=false;image.removeAttribute('src');$('batchCapturedPreview').removeAttribute('src');$('batchCapturedPreview').hidden=true;$('batchToReview').hidden=true;}
  function stage(next,push=true){
    state.stage=next;panel.hidden=next==='entry';normal.hidden=next!=='entry';
    $('batchCapture').hidden=next!=='capture';$('batchCapturedPreview').hidden=!state.sourceUrl;$('batchToReview').hidden=!state.sourceUrl;$('batchReview').hidden=next!=='review';
    if(push) history.pushState({view:'findView',batchStage:next},'',next==='entry'?'#find':'#batch-'+next);
    if(next!=='entry'){document.querySelector('[data-find-tab="identify"]')?.click();scrollTo(0,0);}
  }
  function leave(){resetPhoto();stage('entry',false);}
  function choose(id){$(id).click();}
  function render(){
    const list=BatchCoins.updateRelativeDiameters(state.regions);state.regions=list;
    $('batchCount').textContent=`${list.length} coin${list.length===1?'':'s'} found`;
    overlay.replaceChildren();
    for(const region of list){
      const button=document.createElement('button');button.type='button';button.className='batchRegion'+(region.id===state.selected?' selected':'');
      button.style.left=`${region.x/state.source.width*100}%`;button.style.top=`${region.y/state.source.height*100}%`;
      button.style.width=`${region.width/state.source.width*100}%`;button.style.height=`${region.height/state.source.height*100}%`;
      button.textContent=String(region.detectionNumber);button.setAttribute('aria-label',`Select coin ${region.detectionNumber}`);
      button.onclick=event=>{event.stopPropagation();if(state.adding)return;state.selected=region.id;render();};overlay.append(button);
    }
    $('batchRemove').disabled=!state.selected;
    $('batchAdd').classList.toggle('selected',state.adding);
    grid.replaceChildren();
    for(const coin of state.crops){
      const card=document.createElement('article');card.className='batchCrop pm-cream-card';
      const title=document.createElement('strong');title.textContent=`Coin ${coin.detectionNumber}`;
      const picture=document.createElement('img');picture.src=coin.cropUrl;picture.alt=`Crop of coin ${coin.detectionNumber}`;
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>removeRegion(coin.id);
      card.append(title,picture,remove);grid.append(card);
    }
  }
  async function refreshCrops(){releaseCrops();state.crops=await BatchCoins.cropCoins(state.source,state.regions);render();}
  async function removeRegion(id){state.regions=state.regions.filter(r=>r.id!==id);state.selected=null;await refreshCrops();}
  async function process(file){
    if(!file)return;
    resetPhoto();const job=state.job;
    stage('capture');status.textContent='Finding coins…';$('batchProcess').hidden=false;
    try{
      const source=await BatchCoins.prepareBatchImage(file);if(job!==state.job)return;
      state.source=source;
      const blob=await new Promise((resolve,reject)=>source.toBlob(b=>b?resolve(b):reject(new Error('Unable to read photo')),'image/jpeg',.9));
      state.sourceUrl=URL.createObjectURL(blob);image.src=state.sourceUrl;$('batchCapturedPreview').src=state.sourceUrl;
      const regions=await BatchCoins.detectCoins(source);if(job!==state.job)return;
      state.regions=regions;await refreshCrops();if(job!==state.job)return;
      status.textContent=regions.length?'Check each outline and crop. Tap a coin to remove it, or add a missed coin.':'No coins detected. Tap Add missed coin, then tap each coin in the photo.';
      stage('review');
    }catch(error){if(job===state.job)status.textContent=`Could not process this photo: ${error.message}`;}
    finally{if(job===state.job)$('batchProcess').hidden=true;}
  }
  $('batchOpen').onclick=()=>stage('capture');
  $('batchTake').onclick=()=>choose('batchCameraInput');$('batchChoose').onclick=()=>choose('batchGalleryInput');
  for(const id of ['batchCameraInput','batchGalleryInput']) $(id).addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(file)process(file);});
  $('batchBack').onclick=()=>{if(state.stage==='review'){stage('capture');}else{leave();}};
  $('batchReviewBack').onclick=()=>stage('capture');
  $('batchToReview').onclick=()=>stage('review');
  $('batchRetake').onclick=()=>{resetPhoto();stage('capture');};
  $('batchRemove').onclick=()=>{if(state.selected)removeRegion(state.selected);};
  $('batchAdd').onclick=()=>{state.adding=!state.adding;state.selected=null;render();status.textContent=state.adding?'Tap the centre of a missed coin in the photo. Tap again for more coins.':'Check each crop below.';};
  overlay.addEventListener('click',async event=>{
    if(!state.adding)return;
    if(state.regions.length>=BatchCoins.config.maxCoins){status.textContent='Maximum 10 coins in one photo. Remove a detection before adding another.';return;}
    const rect=overlay.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*state.source.width,y=(event.clientY-rect.top)/rect.height*state.source.height;
    const radius=Math.min(state.source.width,state.source.height)*.065;
    state.regions.push(BatchCoins.regionAt(x,y,radius,radius,0,true));await refreshCrops();
  });
  window.addEventListener('popstate',event=>{
    const target=event.state?.batchStage||'entry';
    if(target==='entry'){leave();return;}
    if(target==='capture'&&state.stage==='review'){stage('capture',false);return;}
    if(target==='review'&&state.source){stage('review',false);return;}
    if(target==='capture'){stage('capture',false);return;}
    leave();
  });
  document.querySelectorAll('[data-nav],[data-find-tab]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.findTab==='identify'&&state.stage!=='entry')return;
    if(state.stage!=='entry')leave();
  }));
})();
