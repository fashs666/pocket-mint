(() => {
  const panel=document.getElementById('batchIdentify'), normal=document.getElementById('singleIdentify');
  const image=document.getElementById('batchImage'),overlay=document.getElementById('batchOverlay');
  const status=document.getElementById('batchStatus'),grid=document.getElementById('batchCrops');
  const state={stage:'entry',source:null,sourceUrl:null,regions:[],crops:[],selected:null,adding:false,job:0,cropJob:0,nextNumber:1,checking:false};
  const $=id=>document.getElementById(id);
  function releaseCrops(){state.crops.forEach(c=>URL.revokeObjectURL(c.cropUrl));state.crops=[];}
  function resetPhoto(){window.BatchIdentification?.reset();state.job++;state.cropJob++;releaseCrops();if(state.sourceUrl)URL.revokeObjectURL(state.sourceUrl);state.sourceUrl=null;state.source=null;state.regions=[];state.selected=null;state.adding=false;state.nextNumber=1;state.checking=false;image.removeAttribute('src');$('batchCapturedPreview').removeAttribute('src');$('batchCapturedPreview').hidden=true;$('batchToReview').hidden=true;}
  function stage(next,push=true){
    state.stage=next;panel.hidden=next==='entry';normal.hidden=next!=='entry';
    $('batchCapture').hidden=next!=='capture';$('batchCapturedPreview').hidden=!state.sourceUrl;$('batchToReview').hidden=!state.sourceUrl;$('batchReview').hidden=next!=='review';
    if(push) history.pushState({view:'findView',batchStage:next},'',next==='entry'?'#find':'#batch-'+next);
    if(next!=='entry'){document.querySelector('[data-find-tab="identify"]')?.click();scrollTo(0,0);}
  }
  function leave(){resetPhoto();stage('entry',false);}
  function choose(id){$(id).click();}
  function selectRegion(id){
    state.adding=false;state.selected=state.selected===id?null:id;
    overlay.classList.remove('adding');$('batchAdd').textContent='Add missed coin';$('batchAdd').classList.remove('selected');
    for(const button of overlay.children)button.classList.toggle('selected',button.dataset.regionId===state.selected);
    for(const card of grid.children)card.classList.toggle('selected',card.dataset.regionId===state.selected);
    const active=state.regions.find(r=>r.id===state.selected);
    $('batchRemove').disabled=!active;$('batchClearSelection').hidden=!active;$('batchSizeRow').hidden=!active;
    if(active){$('batchSize').max=Math.round(Math.min(state.source.width,state.source.height)*.48);$('batchSize').value=Math.round(active.width);$('batchSizeValue').textContent=`${Math.round(active.width)} px`;}
    status.textContent=active?`Coin ${active.detectionNumber} selected. Adjust its size or remove it.`:'Selection cleared.';
  }
  function render(){
    const list=BatchCoins.updateRelativeDiameters(state.regions);state.regions=list;
    $('batchCount').textContent=`${list.length} outline${list.length===1?'':'s'} · ${list.filter(r=>!r.reviewed).length} need checking`;
    overlay.replaceChildren();
    for(const region of list){
      const button=document.createElement('button');button.type='button';button.className='batchRegion'+(!region.reviewed?' uncertain':'')+(region.id===state.selected?' selected':'');
      button.style.left=`${region.x/state.source.width*100}%`;button.style.top=`${region.y/state.source.height*100}%`;
      button.style.width=`${region.width/state.source.width*100}%`;button.style.height=`${region.height/state.source.height*100}%`;
      button.textContent=String(region.detectionNumber);button.setAttribute('aria-label',`Select coin ${region.detectionNumber}`);
      button.dataset.regionId=region.id;
      let drag=null,suppressClick=false;
      button.onpointerdown=event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,cx:region.centreX,cy:region.centreY,moved:false};button.setPointerCapture(event.pointerId);};
      button.onpointermove=event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;const rect=overlay.getBoundingClientRect();if(state.selected!==region.id)selectRegion(region.id);
        region.centreX=Math.max(region.radiusX,Math.min(state.source.width-region.radiusX,drag.cx+dx/rect.width*state.source.width));region.centreY=Math.max(region.radiusY,Math.min(state.source.height-region.radiusY,drag.cy+dy/rect.height*state.source.height));region.x=region.centreX-region.radiusX;region.y=region.centreY-region.radiusY;region.reviewed=false;
        button.style.left=`${region.x/state.source.width*100}%`;button.style.top=`${region.y/state.source.height*100}%`;
      };
      const finishDrag=()=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved){suppressClick=true;refreshCrops();status.textContent=`Coin ${region.detectionNumber} moved. Check its crop.`;}};
      button.onpointerup=finishDrag;button.onpointercancel=finishDrag;
      button.onclick=event=>{event.stopPropagation();if(suppressClick){suppressClick=false;return;}selectRegion(region.id);};overlay.append(button);
    }
    $('batchCheckCoins').disabled=state.checking||window.BatchIdentification?.isBusy?.()||!list.length;
    $('batchCheckCoins').textContent=state.checking?'Checking objects…':'Check detected objects';
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
      const card=document.createElement('article');card.className='batchCrop pm-cream-card'+(coin.id===state.selected?' selected':'');card.dataset.regionId=coin.id;
      const title=document.createElement('strong');title.textContent=`Coin ${coin.detectionNumber}`;
      const picture=document.createElement('img');picture.src=coin.cropUrl;picture.alt=`Crop of coin ${coin.detectionNumber}`;
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>removeRegion(coin.id);
      const select=document.createElement('button');select.type='button';select.className='batchCropSelect';select.append(picture);select.setAttribute('aria-label',`Select outline ${coin.detectionNumber}`);select.onclick=()=>selectRegion(coin.id);
      const edit=document.createElement('button');edit.type='button';edit.textContent='Crop / rotate';edit.disabled=state.checking||window.BatchIdentification?.isBusy?.();edit.onclick=()=>window.BatchIdentification?.editCrop(coin);
      card.append(title,select,edit,remove);grid.append(card);
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
      state.regions=regions;state.nextNumber=regions.length+1;await refreshCrops();if(job!==state.job)return;
      status.textContent=regions.length?'Check the detected objects below. Remove false outlines and add any missed coins before identifying.':'No coins detected. Tap Add missed coin, then tap each coin in the photo.';
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
  $('batchClearSelection').onclick=()=>selectRegion(state.selected);
  $('batchSize').oninput=event=>{const coin=state.regions.find(r=>r.id===state.selected);if(!coin)return;const size=Number(event.target.value),aspect=coin.height/coin.width;coin.reviewed=false;coin.detectionStatus='unchecked';coin.checkMessage='Outline changed · check this crop again.';coin.width=size;coin.height=size*aspect;coin.radiusX=size/2;coin.radiusY=coin.height/2;coin.radius=(coin.radiusX+coin.radiusY)/2;coin.x=coin.centreX-coin.radiusX;coin.y=coin.centreY-coin.radiusY;const button=[...overlay.children].find(b=>b.dataset.regionId===coin.id);if(button){button.style.left=`${coin.x/state.source.width*100}%`;button.style.top=`${coin.y/state.source.height*100}%`;button.style.width=`${coin.width/state.source.width*100}%`;button.style.height=`${coin.height/state.source.height*100}%`;} $('batchSizeValue').textContent=`${Math.round(size)} px`;};
  $('batchSize').onchange=()=>{if(state.selected)refreshCrops();};
  $('batchAdd').onclick=()=>{state.adding=!state.adding;state.selected=null;render();status.textContent=state.adding?'Tap the centre of a missed coin in the photo. An outline and crop will appear.':'Adding cancelled. Check each crop below.';};
  overlay.addEventListener('click',async event=>{
    if(!state.adding){if(state.selected)selectRegion(state.selected);return;}
    if(state.regions.length>=BatchCoins.config.maxCoins){status.textContent=`Maximum ${BatchCoins.config.maxCoins} coins in one photo. Remove a detection before adding another.`;return;}
    const rect=overlay.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*state.source.width,y=(event.clientY-rect.top)/rect.height*state.source.height;
    const radius=Math.min(state.source.width,state.source.height)*.065;
    const coin=BatchCoins.regionAt(x,y,radius,radius,0,true);
    coin.detectionNumber=state.nextNumber++;coin.reviewed=false;coin.detectionStatus='unchecked';state.regions.push(coin);state.selected=coin.id;state.adding=false;render();
    status.textContent=`Coin ${coin.detectionNumber} added. Adjust its size below or tap Add missed coin again.`;
    await refreshCrops();
  });
  $('batchCheckCoins').onclick=async()=>{
    if(state.checking||window.BatchIdentification?.isBusy?.()||!state.crops.length)return;
    state.checking=true;const job=state.job;render();
    const queue=[...state.crops];let rejected=0;
    try{for(const crop of queue){
      if(job!==state.job)break;
      const geometry=`${crop.x}:${crop.y}:${crop.width}:${crop.height}`;
      status.textContent=`Checking object ${crop.detectionNumber}…`;
      const reverse=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(crop.crop);});
      if(job!==state.job)break;
      const response=await fetch('/api/identify',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'content-type':'application/json'},body:JSON.stringify({mode:'circulating',batch_check:true,reverse})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Coin check unavailable');
      if(job!==state.job)break;
      const region=state.regions.find(r=>r.id===crop.id);
      if(!region||`${region.x}:${region.y}:${region.width}:${region.height}`!==geometry)continue;
      if(data.status==='not_coin'){state.regions=state.regions.filter(r=>r.id!==crop.id);if(state.selected===crop.id)state.selected=null;rejected++;}
      else{region.detectionStatus=data.status;region.checkMessage=data.reason||'One coin found. Check its outline.';region.reviewed=['ready','needs_other_side','low_quality'].includes(data.status);}
    }
    if(job===state.job){await refreshCrops();status.textContent=`${rejected} non-coin object${rejected===1?'':'s'} removed. Check remaining outlines, then identify the confirmed coins.`;}
    }catch(error){if(job===state.job){await refreshCrops();status.textContent=`${error.message} You can check the remaining outlines manually.`;}}
    finally{if(job===state.job){state.checking=false;render();}}
  };
  window.BatchReview={async approveAll(){if(state.checking)return false;state.regions.forEach(r=>r.reviewed=true);await refreshCrops();return true;},select(id){if(state.regions.some(r=>r.id===id)){if(state.selected!==id)selectRegion(id);document.querySelector('.batchImageFrame')?.scrollIntoView({block:'center',behavior:'smooth'});}}};
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
