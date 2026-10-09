(() => {
  const panel=document.getElementById('batchIdentify'), normal=document.getElementById('singleIdentify');
  const image=document.getElementById('batchImage'),overlay=document.getElementById('batchOverlay');
  const status=document.getElementById('batchStatus'),grid=document.getElementById('batchCrops');
  const state={stage:'entry',source:null,sourceUrl:null,regions:[],crops:[],selected:null,adding:false,job:0,cropJob:0,nextNumber:1,checking:false};
  const $=id=>document.getElementById(id);
  const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  const outlineNodes=new Map(),cropNodes=new Map();let renderedSource=null,reviewStep='outlines';
  function releaseCrops(){state.crops.forEach(c=>URL.revokeObjectURL(c.cropUrl));state.crops=[];}
  function resetPhoto(){window.BatchIdentification?.reset();state.job++;state.cropJob++;releaseCrops();if(state.sourceUrl)URL.revokeObjectURL(state.sourceUrl);state.sourceUrl=null;state.source=null;state.regions=[];state.selected=null;state.adding=false;state.nextNumber=1;state.checking=false;outlineNodes.clear();cropNodes.clear();grid.replaceChildren();overlay.replaceChildren();renderedSource=null;$('batchCheckFeedback').hidden=true;showReviewStep('outlines');image.removeAttribute('src');$('batchCapturedPreview').removeAttribute('src');$('batchCapturedPreview').hidden=true;$('batchToReview').hidden=true;}
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
    text($('batchCount'),`${list.length} coin outline${list.length===1?'':'s'}`);
    const ids=new Set(list.map(c=>c.id));for(const [id,node] of outlineNodes)if(!ids.has(id)){node.remove();outlineNodes.delete(id);}

    for(const region of list){
      let button=outlineNodes.get(region.id);if(!button){button=document.createElement('button');button.type='button';button.dataset.regionId=region.id;outlineNodes.set(region.id,button);overlay.append(button);}
      button.className='batchRegion'+(!region.reviewed?' uncertain':'')+(region.id===state.selected?' selected':'');
      button.style.left=`${region.x/state.source.width*100}%`;button.style.top=`${region.y/state.source.height*100}%`;
      button.style.width=`${region.width/state.source.width*100}%`;button.style.height=`${region.height/state.source.height*100}%`;
      text(button,String(region.detectionNumber));button.setAttribute('aria-label',`Select coin ${region.detectionNumber}`);
      button.dataset.regionId=region.id;
      let drag=null,suppressClick=false;
      button.onpointerdown=event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,cx:region.centreX,cy:region.centreY,moved:false};button.setPointerCapture(event.pointerId);};
      button.onpointermove=event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;const rect=overlay.getBoundingClientRect();if(state.selected!==region.id)selectRegion(region.id);
        region.centreX=Math.max(region.radiusX,Math.min(state.source.width-region.radiusX,drag.cx+dx/rect.width*state.source.width));region.centreY=Math.max(region.radiusY,Math.min(state.source.height-region.radiusY,drag.cy+dy/rect.height*state.source.height));region.x=region.centreX-region.radiusX;region.y=region.centreY-region.radiusY;region.reviewed=false;
        button.style.left=`${region.x/state.source.width*100}%`;button.style.top=`${region.y/state.source.height*100}%`;
      };
      const finishDrag=()=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved){suppressClick=true;refreshCrops();status.textContent=`Coin ${region.detectionNumber} moved. Check its crop.`;}};
      button.onpointerup=finishDrag;button.onpointercancel=finishDrag;
      button.onclick=event=>{event.stopPropagation();if(suppressClick){suppressClick=false;return;}selectRegion(region.id);};
    }
    $('batchCheckCoins').disabled=state.checking||window.BatchIdentification?.isBusy?.()||!list.length;
    text($('batchCheckCoins'),state.checking?'Checking objects…':'Check detected objects');
    $('batchRemove').disabled=!state.selected;
    $('batchClearSelection').hidden=!state.selected;
    text($('batchAdd'),state.adding?'Cancel adding':'Add missed coin');
    $('batchAdd').classList.toggle('selected',state.adding);
    overlay.classList.toggle('adding',state.adding);
    const active=list.find(coin=>coin.id===state.selected);
    $('batchSizeRow').hidden=!active;
    if(active){const slider=$('batchSize');slider.max=Math.round(Math.min(state.source.width,state.source.height)*.48);slider.value=Math.round(active.width);$('batchSizeValue').textContent=`${Math.round(active.width)} px`;}
    window.BatchIdentification?.render(state.crops);
    const cropIds=new Set(state.crops.map(c=>c.id));for(const [id,node] of cropNodes)if(!cropIds.has(id)){node.remove();cropNodes.delete(id);}
    for(const coin of state.crops){
      let card=cropNodes.get(coin.id);
      if(!card){
        card=document.createElement('article');card.className='batchCrop pm-cream-card';card.dataset.regionId=coin.id;
        const title=document.createElement('strong'),picture=document.createElement('img'),select=document.createElement('button'),hint=document.createElement('span'),rotation=document.createElement('div');
        picture.decoding='async';select.type='button';select.className='batchCropSelect';select.append(picture);const edit=document.createElement('button');edit.type='button';edit.className='batchCropEdit';edit.textContent='Crop';edit.onclick=()=>{const current=state.crops.find(c=>c.id===coin.id);if(current)window.BatchIdentification.editCrop(current);};rotation.append(edit);hint.className='batchRotationStatus';hint.setAttribute('role','status');rotation.className='batchRotationControls';
        for(const [angle,label] of [[-90,'↶'],[90,'↷']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.angle=angle;rotation.append(button);}
        card.append(title,select,hint,rotation);cropNodes.set(coin.id,card);grid.append(card);
      }
      card.classList.toggle('selected',coin.id===state.selected);
      text(card.querySelector('strong'),`Coin ${coin.detectionNumber}`);
      const picture=card.querySelector('img'),url=window.BatchIdentification?.effectivePhoto(coin).url||coin.cropUrl;
      if(picture.getAttribute('src')!==url)picture.src=url;
      picture.alt=`Crop of coin ${coin.detectionNumber}`;
      const select=card.querySelector('.batchCropSelect');select.setAttribute('aria-label',`Open crop preview for coin ${coin.detectionNumber}`);select.onclick=()=>window.BatchIdentification?.editCrop(coin);
      text(card.querySelector('.batchRotationStatus'),window.BatchIdentification?.rotationStatus(coin)||'Check rotation');
      let matchStatus=card.querySelector('.batchMatchStatus');if(!matchStatus){matchStatus=document.createElement('span');matchStatus.className='batchMatchStatus';card.append(matchStatus);}text(matchStatus,window.BatchIdentification?.identificationStatus(coin)||'Waiting');
      const edit=card.querySelector('.batchCropEdit');edit.setAttribute('aria-label',`Crop coin ${coin.detectionNumber}`);edit.disabled=state.checking||window.BatchIdentification?.isBusy?.();
      for(const button of card.querySelectorAll('.batchRotationControls button[data-angle]')){const angle=Number(button.dataset.angle);button.setAttribute('aria-label',`Rotate coin ${coin.detectionNumber} ${angle<0?'left':'right'} 90 degrees`);button.disabled=state.checking||window.BatchIdentification?.isBusy?.();button.onclick=()=>window.BatchIdentification?.rotateCrop(coin,angle);}
    }
    $('batchNextToCoins').disabled=!state.crops.length||state.checking;
    const rotationLabels=state.crops.map(c=>window.BatchIdentification?.rotationStatus(c)||'Check rotation');
    text($('batchRotationSummary'),`Automatic rotation: ${rotationLabels.filter(s=>s.includes('corrected')).length} corrected · ${rotationLabels.filter(s=>s.includes('already upright')).length} already upright · ${rotationLabels.filter(s=>s.startsWith('Check rotation')).length} need your check · ${rotationLabels.filter(s=>s.startsWith('Checking')).length} checking · ${rotationLabels.filter(s=>s==='Rotation adjusted').length} manually adjusted`);
  }
  const geometry=c=>`${c.x}:${c.y}:${c.width}:${c.height}`;
  async function refreshCrops(){
    window.BatchIdentification?.sync(state.regions);
    const job=++state.cropJob,source=state.source,old=new Map(state.crops.map(c=>[c.id,c]));
    const missing=state.regions.filter(r=>renderedSource!==source||geometry(old.get(r.id)||{})!==geometry(r));
    const fresh=await BatchCoins.cropCoins(source,missing);
    if(job!==state.cropJob||source!==state.source){fresh.forEach(c=>URL.revokeObjectURL(c.cropUrl));return;}
    const created=new Map(fresh.map(c=>[c.id,c]));const crops=state.regions.map(r=>({...old.get(r.id),...r,...created.get(r.id)}));
    const keep=new Set(crops.map(c=>c.cropUrl));for(const crop of state.crops)if(!keep.has(crop.cropUrl))URL.revokeObjectURL(crop.cropUrl);
    state.crops=crops;renderedSource=source;render();window.BatchIdentification?.scheduleOrientation();
  }
  function showReviewStep(next){
    reviewStep=next;$('batchOutlineStep').hidden=next!=='outlines';$('batchCoinStep').hidden=next!=='coins';$('batchIdentificationStep').hidden=next!=='identify';
    $('batchShowOutlines').setAttribute('aria-pressed',String(next==='outlines'));$('batchShowCoins').setAttribute('aria-pressed',String(next==='coins'));
    $('batchShowIdentify').setAttribute('aria-pressed',String(next==='identify'));
  }
  $('batchShowOutlines').onclick=()=>showReviewStep('outlines');$('batchShowCoins').onclick=()=>showReviewStep('coins');
  $('batchShowIdentify').onclick=()=>$('batchStartIdentification').click();
  $('batchNextToCoins').onclick=async()=>{if(await window.BatchReview.approveAll()){showReviewStep('coins');window.BatchIdentification.scheduleOrientation();}};
  $('batchStartIdentification').onclick=async()=>{
    const button=$('batchStartIdentification'),job=state.job;button.disabled=true;button.textContent='Finishing rotation checks…';
    try{if(!await window.BatchReview.approveAll())return;await window.BatchIdentification.prepareOrientation();if(job!==state.job)return;showReviewStep('identify');window.BatchIdentification.startQueue();}
    finally{button.disabled=false;button.textContent='Crops & rotation checked · identify coins';}
  };

  async function removeRegion(id){state.regions=state.regions.filter(r=>r.id!==id);state.selected=null;await refreshCrops();}
  async function process(file){
    if(!file)return;
    resetPhoto();const job=state.job;
    showReviewStep('outlines');stage('capture');status.textContent='Finding coins…';$('batchProcess').hidden=false;
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
    state.checking=true;const job=state.job;render();const feedback=$('batchCheckFeedback'),progress=$('batchCheckProgress'),list=$('batchCheckList');feedback.hidden=false;list.replaceChildren();progress.max=state.crops.length;progress.value=0;feedback.setAttribute('aria-busy','true');
    const queue=[...state.crops];let rejected=0;
    try{for(const crop of queue){
      if(job!==state.job)break;
      const geometry=`${crop.x}:${crop.y}:${crop.width}:${crop.height}`;
      status.textContent=`Checking object ${crop.detectionNumber} · ${progress.value+1} of ${queue.length}…`;
      const reverse=await BatchCoins.batchVisionImage(window.BatchIdentification?.effectivePhoto(crop).blob||crop.crop);
      if(job!==state.job)break;
      const response=await fetch('/api/identify',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'content-type':'application/json'},body:JSON.stringify({mode:'circulating',batch_check:true,reverse})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Coin check unavailable');
      if(job!==state.job)break;
      const region=state.regions.find(r=>r.id===crop.id);
      if(!region||`${region.x}:${region.y}:${region.width}:${region.height}`!==geometry)continue;
      const outcome=document.createElement('li');outcome.textContent=`Object ${crop.detectionNumber}: ${data.status==='not_coin'?'Not a coin · outline removed':data.status==='ready'?'One coin found · outline kept':data.status==='needs_other_side'?'Coin found · other side needed':data.status==='low_quality'?'Coin found · photo unclear':'Needs your check · outline kept'}`;list.append(outcome);progress.value++;
      if(data.status==='not_coin'){state.regions=state.regions.filter(r=>r.id!==crop.id);if(state.selected===crop.id)state.selected=null;rejected++;}
      else{region.detectionStatus=data.status;region.checkMessage=data.reason||'One coin found. Check its outline.';region.reviewed=['ready','needs_other_side','low_quality'].includes(data.status);}
    }
    if(job===state.job){await refreshCrops();status.textContent=`Check complete: ${queue.length-rejected} outlines kept · ${rejected} removed. ${rejected===0?'No non-coin objects were found. ':''}Review the outlines before continuing.`;}
    }catch(error){if(job===state.job){await refreshCrops();status.textContent=`${error.message} You can check the remaining outlines manually.`;}}
    finally{if(job===state.job){state.checking=false;feedback.setAttribute('aria-busy','false');render();}}
  };
  window.BatchReview={redraw:render,showCoins:()=>showReviewStep('identify'),async approveAll(){if(state.checking)return false;state.regions.forEach(r=>r.reviewed=true);await refreshCrops();return true;},select(id){if(state.regions.some(r=>r.id===id)){if(state.selected!==id)selectRegion(id);document.querySelector('.batchImageFrame')?.scrollIntoView({block:'center',behavior:'smooth'});}}};
  window.addEventListener('popstate',event=>{
    const target=event.state?.batchStage||'entry';
    if(state.stage==='review'&&window.BatchIdentification?.closeWorkspace()){event.stopImmediatePropagation();history.pushState({view:'findView',batchStage:'review'},'','#batch-review');return;}
    if(state.stage==='review'&&reviewStep!=='outlines'){event.stopImmediatePropagation();showReviewStep(reviewStep==='identify'?'coins':'outlines');history.pushState({view:'findView',batchStage:'review'},'','#batch-review');return;}
    if(target==='entry'){leave();return;}
    if(target==='capture'&&state.stage==='review'){stage('capture',false);return;}
    if(target==='review'&&state.source){stage('review',false);return;}
    if(target==='capture'){stage('capture',false);return;}
    leave();
  },true);
  document.querySelectorAll('[data-nav],[data-find-tab]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.findTab==='identify'&&state.stage!=='entry')return;
    if(state.stage!=='entry')leave();
  }));
})();
