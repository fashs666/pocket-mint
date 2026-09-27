(() => {
  const panel=document.getElementById('batchIdentify'), normal=document.getElementById('singleIdentify');
  const image=document.getElementById('batchImage'),overlay=document.getElementById('batchOverlay');
  const status=document.getElementById('batchStatus'),grid=document.getElementById('batchCrops');
  const state={stage:'entry',source:null,sourceUrl:null,regions:[],crops:[],selected:null,adding:false,job:0,cropJob:0};
  const $=id=>document.getElementById(id);
  function releaseCrops(){state.crops.forEach(c=>URL.revokeObjectURL(c.cropUrl));state.crops=[];}
  function resetPhoto(){window.BatchIdentification?.reset();state.job++;state.cropJob++;releaseCrops();if(state.sourceUrl)URL.revokeObjectURL(state.sourceUrl);state.sourceUrl=null;state.source=null;state.regions=[];state.selected=null;state.adding=false;image.removeAttribute('src');$('batchCapturedPreview').removeAttribute('src');$('batchCapturedPreview').hidden=true;$('batchToReview').hidden=true;}
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
      button.onclick=event=>{event.stopPropagation();state.adding=false;state.selected=state.selected===region.id?null:region.id;render();status.textContent=state.selected?`Coin ${region.detectionNumber} selected. Adjust its size, remove it, or tap again to unselect.`:'Selection cleared.';};overlay.append(button);
    }
    $('batchRemove').disabled=!state.selected;
    $('batchClearSelection').hidden=!state.selected;
    $('batchAdd').textContent=state.adding?'Cancel adding':'Add missed coin';
    $('batchAdd').classList.toggle('selected',state.adding);
    overlay.classList.toggle('adding',state.adding);
    const active=list.find(coin=>coin.id===state.selected);
    $('batchSizeRow').hidden=!active;
    if(active){const slider=$('batchSize');slider.max=Math.round(Math.min(state.source.width,state.source.height)*.48);slider.value=Math.round(active.width);$('batchSizeValue').textContent=`${Math.round(active.width)} px`;}
    grid.replaceChildren();
    window.BatchIdentification?.render(state.crops);
    for(const coin of state.crops){
      const card=document.createElement('article');card.className='batchCrop pm-cream-card';
      const title=document.createElement('strong');title.textContent=`Coin ${coin.detectionNumber}`;
      const picture=document.createElement('img');picture.src=coin.cropUrl;picture.alt=`Crop of coin ${coin.detectionNumber}`;
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>removeRegion(coin.id);
      card.append(title,picture,remove);grid.append(card);
    }
  }
  async function refreshCrops(){window.BatchIdentification?.sync(state.regions);const job=++state.cropJob,source=state.source,regions=[...state.regions];const crops=await BatchCoins.cropCoins(source,regions);if(job!==state.cropJob||source!==state.source){crops.forEach(c=>URL.revokeObjectURL(c.cropUrl));return;}releaseCrops();state.crops=crops;render();}
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
  $('batchClearSelection').onclick=()=>{state.selected=null;render();status.textContent='Selection cleared.';};
  $('batchSize').oninput=event=>{const coin=state.regions.find(r=>r.id===state.selected);if(!coin)return;const size=Number(event.target.value),aspect=coin.height/coin.width;coin.width=size;coin.height=size*aspect;coin.radiusX=size/2;coin.radiusY=coin.height/2;coin.radius=(coin.radiusX+coin.radiusY)/2;coin.x=coin.centreX-coin.radiusX;coin.y=coin.centreY-coin.radiusY;render();};
  $('batchSize').onchange=()=>{if(state.selected)refreshCrops();};
  $('batchAdd').onclick=()=>{state.adding=!state.adding;state.selected=null;render();status.textContent=state.adding?'Tap the centre of a missed coin in the photo. An outline and crop will appear.':'Adding cancelled. Check each crop below.';};
  overlay.addEventListener('click',async event=>{
    if(!state.adding)return;
    if(state.regions.length>=BatchCoins.config.maxCoins){status.textContent='Maximum 10 coins in one photo. Remove a detection before adding another.';return;}
    const rect=overlay.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*state.source.width,y=(event.clientY-rect.top)/rect.height*state.source.height;
    const radius=Math.min(state.source.width,state.source.height)*.065;
    const coin=BatchCoins.regionAt(x,y,radius,radius,0,true);
    state.regions.push(coin);state.selected=coin.id;state.adding=false;render();
    status.textContent=`Coin ${state.regions.length} added. Adjust its size below or tap Add missed coin again.`;
    await refreshCrops();
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
