/* Each crop uses the same opt-in circulating identifier as single Identify.
   Diagnostic reports are independent of collection confirmation. */
(() => {
  const results=new Map(), $=id=>document.getElementById(id);
  let crops=[],generation=0,busy=false,focusId=null,renderKey="",renderResult=null,finalMode=false;
  const finalRows=new Map();
  let queueEnabled=false,queueRunning=false,queuePaused=false;const inFlight=new Set();let queueAbort=typeof AbortController==='function'?new AbortController():null;
  const orientationJobs=new Map(),orientationQueue=[];let orientationRunning=0;
  function rotationStatus(crop){return results.get(crop.id)?.orientationLabel||(orientationJobs.has(crop.id)?'Checking rotation…':'Check rotation');}
  function scheduleOrientation(){
    if(!window.BatchPhotoRotation)return;
    for(const crop of crops){
      const result=results.get(crop.id),existing=orientationJobs.get(crop.id);
      if(!crop.reviewed||result?.orientationAttempted||result?.reverse||existing?.geometry===geometryOf(crop))continue;
      if(!result)results.set(crop.id,{status:'manual',choices:[],geometry:geometryOf(crop),ready:false,orientationOnly:true});
      let resolve;const job={crop,geometry:geometryOf(crop),revision:generation,promise:new Promise(r=>resolve=r),resolve:()=>resolve()};
      orientationJobs.set(crop.id,job);orientationQueue.push(job);
    }
    pumpOrientation();window.BatchReview?.redraw();
  }
  function pumpOrientation(){
    if(busy)return;
    while(orientationRunning<2&&orientationQueue.length){
      const job=orientationQueue.shift();orientationRunning++;
      (async()=>{try{if(job.revision===generation&&activeCrop(job.crop))await orientCrop(job.crop);}finally{
        orientationRunning--;if(orientationJobs.get(job.crop.id)===job)orientationJobs.delete(job.crop.id);
        job.resolve();pumpOrientation();if(job.revision===generation)window.BatchReview?.redraw();
      }})();
    }
  }
  async function prepareOrientation(){
    const revision=generation;
    // All crop orientation checks complete before recognition claims their pixels.
    scheduleOrientation();
    await Promise.all([...orientationJobs.values()].map(job=>job.promise));
    return revision===generation;
  }
  async function rotateCrop(crop,angle){
    if(busy||!activeCrop(crop)||results.get(crop.id)?.added)return;
    const revision=generation;busy=true;
    // Claim a manual override before awaiting pixels, rejecting late automatic results.
    const manual={...editable(crop),orientationAttempted:true,orientationLabel:'Rotation adjusted'};results.set(crop.id,manual);
    window.BatchReview?.redraw();
    try{
      const blob=await window.BatchPhotoRotation.rotate(effectivePhoto(crop).blob,angle),reverse=await fileDataUrl(blob);
      if(revision!==generation||!activeCrop(crop)||results.get(crop.id)!==manual)return;
      results.set(crop.id,{...manual,status:'manual',choices:[],ready:false,coinId:null,designId:null,reverse,reverseBlob:blob,message:'Rotation adjusted. Identify this coin again before confirming.'});
    }catch(error){if(revision===generation)$('batchIdentifyStatus').textContent=error.message;}
    finally{if(revision===generation){busy=false;window.BatchReview?.redraw();pumpOrientation();runQueue();}}
  }
  const fileDataUrl=blob=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
  function catalogueChoice(coin,confidence=null){return {id:coin.id,title:coin.title,coin,confidence};}
  function reference(coin){
    const box=document.createElement('div');box.className='batchReference';
    const picture=document.createElement('img');picture.src=coin.reference_image;picture.alt=`Catalogue reference for ${coin.title}`;
    const description=document.createElement('span');description.textContent=`Catalogue reference · ${coin.year} ${coin.title}${coin.reference_image_kind==='series'?' (series image)':coin.reference_image_kind==='product'?' (product image)':coin.reference_image_kind==='obverse'?' (portrait side)':''}`;
    box.append(picture,description);return box;
  }
  function searchCatalogue(query,denomination=''){
    const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if(!words.length)return [];
    const unique=new Map();
    for(const coin of browseCatalogue){
      if(denomination&&coin.denomination_display!==denomination)continue;
      const key=`${coin.denomination_display}:${coin.title}`;
      if(unique.has(key))continue;
      const haystack=`${coin.year} ${coin.title} ${coin.denomination_display} ${coin.series_id||''} ${coin.id} ${(coin.searchAliases||[]).join(' ')}`.toLocaleLowerCase();
      if(words.every(word=>haystack.includes(word)))unique.set(key,coin);
    }
    return [...unique.values()].slice(0,8);
  }
  function manualSearch(card,result,crop){
    const search=document.createElement('div');search.className='batchManualSearch';
    const label=document.createElement('label');label.textContent='Type the coin name';
    const input=document.createElement('input');input.type='search';input.placeholder='e.g. Donation Dollar';input.autocomplete='off';input.setAttribute('aria-label',`Coin ${crop.detectionNumber} coin name`);
    input.value=result.manualQuery||'';label.append(input);
    const suggestions=document.createElement('div');suggestions.className='batchSuggestions';
    function update(){
      suggestions.replaceChildren();let matches=searchCatalogue(input.value,result.denomination||'');
      if(!input.value.trim())return;
      if(!matches.length&&result.denomination){matches=searchCatalogue(input.value);if(matches.length){const message=document.createElement('p');message.textContent='No match for that coin value. These names match at another value:';suggestions.append(message);}}
      if(!matches.length){const message=document.createElement('p');message.textContent='No catalogue names match. Try another word or year.';suggestions.append(message);return;}
      for(const coin of matches){
        const button=document.createElement('button');button.type='button';button.className='batchSuggestion';
        const thumbnail=document.createElement('img');thumbnail.src=coin.reference_image;thumbnail.alt='';
        const caption=document.createElement('span');caption.textContent=`${coin.title} · ${coin.denomination_display} · ${coin.year}`;
        button.append(thumbnail,caption);
        button.onclick=()=>{
          result.orientationOnly=false;result.choices=[catalogueChoice(coin)];result.designId=coin.id;result.denomination=coin.denomination_display;
          const variants=designVariants(coin);
          result.coinId=variants.length===1?coin.id:null;
          result.ready=false;result.reviewConfirmed=false;result.status='manual';result.manualOpen=false;
          render(crops);
        };
        suggestions.append(button);
      }
    }
    input.oninput=()=>{result.manualQuery=input.value;update();};
    update();search.append(label,suggestions);card.append(search);
  }
  const geometryOf=crop=>`${crop.x}:${crop.y}:${crop.width}:${crop.height}`;
  const activeCrop=crop=>crops.some(current=>current.id===crop.id&&geometryOf(current)===geometryOf(crop));
  function editable(crop){let result=results.get(crop.id);if(!result){result={status:'manual',choices:[],geometry:geometryOf(crop),ready:false,orientationOnly:true};results.set(crop.id,result);}return result;}
  const effectivePhoto=crop=>{
    const result=results.get(crop.id);
    return result?.geometry===geometryOf(crop)?{blob:result.reverseBlob||crop.crop,url:result.reverse||crop.cropUrl}:{blob:crop.crop,url:crop.cropUrl};
  };
  async function orientCrop(crop,force=false){
    const expected=results.get(crop.id),previous=expected||{};
    if(!window.BatchPhotoRotation||!force&&(previous.orientationAttempted||previous.reverse))return;
    const revision=generation;
    const adjustment=await window.BatchPhotoRotation.suggest(effectivePhoto(crop).blob);
    if(revision!==generation||!activeCrop(crop)||results.get(crop.id)!==expected)return;
    const reverse=adjustment.file!==effectivePhoto(crop).blob?await fileDataUrl(adjustment.file):undefined;
    if(revision!==generation||!activeCrop(crop)||results.get(crop.id)!==expected)return;
    results.set(crop.id,{...previous,status:'manual',choices:previous.choices||[],geometry:geometryOf(crop),ready:false,
      orientationOnly:previous.orientationOnly??!previous.status,orientationAttempted:true,orientationLabel:adjustment.confident?(reverse?'Auto rotation · corrected':'Auto rotation · already upright'):adjustment.reason==='unavailable'?'Check rotation · service unavailable':adjustment.reason==='allowance'?'Check rotation · allowance reached':'Check rotation · automatic check uncertain',...(reverse?{reverse,reverseBlob:adjustment.file}:{}),
      message:adjustment.confident?'Orientation checked. Use Crop / rotate if it needs correcting.':'Orientation unclear. Use Crop / rotate to choose it yourself.'});
    window.BatchReview?.redraw();
  }
  async function autoRotate(crop){
    if(busy||!activeCrop(crop)||results.get(crop.id)?.added)return;
    const revision=generation;busy=true;render(crops);
    try{await orientCrop(crop,true);}finally{if(revision===generation){busy=false;window.BatchReview?.redraw();render(crops);}}
  }
  async function editCrop(crop){
    if(busy||!activeCrop(crop)||results.get(crop.id)?.added)return;
    const revision=generation,previous=results.get(crop.id);busy=true;render(crops);
    try{const source=effectivePhoto(crop).blob;
      // Batch crops already have an outline: do not re-detect or auto-rotate inside the shared editor.
      window.AutoCoinPhoto?.markManual(source,source);
      const adjusted=await window.CoinPhotoEditor.edit(source);
      if(!adjusted||revision!==generation||!activeCrop(crop))return;
      const reverse=await fileDataUrl(adjusted);if(revision!==generation||!activeCrop(crop))return;
      results.set(crop.id,{status:'manual',choices:[],geometry:geometryOf(crop),ready:false,reverse,reverseBlob:adjusted,obverse:previous?.obverse,denomination:previous?.denomination,expanded:true,orientationAttempted:true,orientationLabel:'Rotation adjusted',message:'Photo adjusted. Identify this coin again before confirming.'});
    }catch(error){if(revision===generation)$('batchIdentifyStatus').textContent=`Could not edit coin: ${error.message}`;}
    finally{if(revision===generation){busy=false;window.BatchReview?.redraw();render(crops);pumpOrientation();runQueue();}}
  }
  function photoControl(card,crop,result,side){
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('capture','environment');input.hidden=true;
    const button=document.createElement('button');button.type='button';button.textContent=result?.obverse?'Replace other side':'Add other side';button.disabled=busy||result?.added||!crop.reviewed;
    button.onclick=()=>input.click();
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const revision=generation;button.disabled=true;
      try{const firstSideIsPortrait=result.firstSideIsPortrait||result.status==='needs_other_side'||result.observed?.side==='portrait';const source=await BatchCoins.prepareBatchImage(file);const blob=await new Promise((resolve,reject)=>source.toBlob(b=>b?resolve(b):reject(new Error('Could not read photo')),'image/jpeg',.9));source.width=0;source.height=0;
        const data=await fileDataUrl(blob);if(revision!==generation||!activeCrop(crop))return;
        const current=editable(crop);current.ready=false;current.reviewConfirmed=false;current.added=false;current.choices=[];current.designId=null;current.coinId=null;current.status='manual';
        const updated={...current,firstSideIsPortrait,obverse:data,orientationOnly:true};results.set(crop.id,updated);
        updated.message='Other side added. Waiting to identify again.';window.BatchReview?.redraw();render(crops);startQueue();
      }catch(error){$('batchIdentifyStatus').textContent=error.message;}finally{button.disabled=false;input.value='';}
    };card.append(button,input);
  }
  function reset(){queueAbort?.abort();queueAbort=typeof AbortController==='function'?new AbortController():null;queueEnabled=false;queuePaused=false;queueRunning=false;inFlight.clear();focusId=null;renderKey="";renderResult=null;for(const job of orientationQueue.splice(0))job.resolve();orientationJobs.clear();generation++;busy=false;crops=[];results.clear();$('batchIdentifyStatus').textContent='';if($('batchFinishSummary'))$('batchFinishSummary').hidden=true;if($('batchNewPhoto'))$('batchNewPhoto').hidden=true;render([]);}
  function sync(regions){
    const active=new Map(regions.map(r=>[r.id,`${r.x}:${r.y}:${r.width}:${r.height}`]));
    for(const [id,result] of results)if(!active.has(id)||result.geometry!==active.get(id))results.delete(id);
  }
  function render(nextCrops){
    crops=nextCrops;
    if(!crops.length){finalMode=false;finalRows.clear();$('batchFinalList')?.replaceChildren();if($('batchFinalStatus'))$('batchFinalStatus').textContent='';}
    if($('batchFinalReview'))$('batchFinalReview').hidden=!finalMode;
    $('batchReview')?.classList?.toggle?.('final-review',finalMode);
    if($('batchFinishSummary'))$('batchFinishSummary').hidden=!finalMode;
    if($('batchResults'))$('batchResults').hidden=finalMode;
    if($('batchFinish'))$('batchFinish').hidden=finalMode;
    if($('batchNewPhoto')){$('batchNewPhoto').hidden=!finalMode;$('batchNewPhoto').disabled=busy;}
    if(finalMode)renderFinalReview();
    const root=$('batchResultList');
    $('batchWorkspace').hidden=!focusId;
    const selected=crops.find(c=>c.id===focusId);
    if(focusId&&!selected){focusId=null;$('batchWorkspace').hidden=true;}
    const progress=`${crops.filter(c=>results.get(c.id)?.added).length} of ${crops.length} added`;if($('batchProgress').textContent!==progress)$('batchProgress').textContent=progress;
    const overview=$('batchIdentificationOverview');
    if(overview){
      const ids=new Set(crops.map(c=>c.id));for(const node of [...overview.children])if(!ids.has(node.dataset.regionId))node.remove();
      for(const crop of crops){let button=[...overview.children].find(n=>n.dataset.regionId===crop.id);if(!button){button=document.createElement('button');button.type='button';button.dataset.regionId=crop.id;overview.append(button);}const label=`Coin ${crop.detectionNumber} · ${identificationStatus(crop)}`;if(button.textContent!==label)button.textContent=label;button.onclick=()=>openCoin(crop.id);}
      overview.hidden=Boolean(focusId)||finalMode;
    }
    $('batchCrops').hidden=Boolean(focusId);$('batchResults').classList?.toggle?.('workspace-open',Boolean(focusId));$('batchReview')?.classList?.toggle?.('workspace-open',Boolean(focusId));
    const current=selected?results.get(selected.id):null;
    const key=JSON.stringify([focusId,busy,current?.status,current?.coinId,current?.designId,current?.manualOpen,current?.ready,current?.added,current?.testSaved,current?.denomination,current?.choices?.map(c=>c.id)]);
    const rebuild=key!==renderKey||current!==renderResult;
    renderKey=key;renderResult=current;
    if(rebuild)root.replaceChildren();
    $('batchIdentifyAll').disabled=busy||!crops.length;
    const action=crops.every(c=>c.reviewed)?'Review coins':'Confirm crops & review';if($('batchIdentifyAll').textContent!==action)$('batchIdentifyAll').textContent=action;
    for(const id of ['batchSaveTests','batchExportTests']){const button=$(id);if(button){button.hidden=![...results.values()].some(result=>!result.orientationOnly);button.disabled=busy;}}
    for(const crop of rebuild&&selected?[selected]:[]){
      const result=results.get(crop.id)||editable(crop);
      const card=document.createElement('article');card.className='batchResult pm-cream-card';card.dataset.regionId=crop.id;
      const cardSummary=document.createElement('div');cardSummary.className='batchCompactSummary';card.append(cardSummary);
      const heading=document.createElement('h4');heading.textContent=`Coin ${crop.detectionNumber}`;card.append(heading);
      const rotation=document.createElement('p');rotation.className='batchRotationStatus';rotation.textContent=rotationStatus(crop);card.append(rotation);
      const thumbnail=document.createElement('img');thumbnail.src=result?.reverse||crop.cropUrl;thumbnail.alt=`Coin ${crop.detectionNumber} crop`;card.append(thumbnail);
      const support=document.createElement('details');support.className='batchMatchHelp';support.open=Boolean(result.manualOpen);const supportTitle=document.createElement('summary');supportTitle.textContent='Search manually or change coin value';support.append(supportTitle);
      const summary=document.createElement('p');summary.className='batchResultSummary';
      if(!crop.reviewed)summary.textContent='Check this outline contains one coin before identifying.';
      else if(!result)summary.textContent='Ready to identify.';
      else if(result.status==='loading')summary.textContent='Identifying this coin… You can review other coins while it finishes.';
      else if(result.status==='error')summary.textContent=result.message;
      else if(['no_match','not_coin','multiple_coins','check_coin','low_quality','needs_other_side'].includes(result.status))summary.textContent=result.message||'No reliable match. Retry or compare with the catalogue.';
      else summary.textContent=result.status==='manual'?(result.message||'Check the catalogue artwork and choose the exact issue.'):result.status==='confident'?'Likely design and issue: check before adding.':result.status==='year_uncertain'?'Design found · choose the issue year.':'Design uncertain · choose the matching design and issue.';
      card.append(summary);
      cardSummary.append(heading,thumbnail,summary);
      if(result?.orientationOnly&&result.status!=='loading')summary.textContent=queuePaused?'Identification paused. Resume when ready.':'Waiting for identification in coin order…';
      if(result&&['error','no_match','not_coin','multiple_coins','check_coin','low_quality','needs_other_side'].includes(result.status)){
        const retry=document.createElement('button');retry.type='button';retry.textContent='Retry this coin';retry.disabled=busy||!crop.reviewed;retry.onclick=()=>{results.set(crop.id,{...result,status:'manual',orientationOnly:true,quota:false});startQueue();};card.append(retry);
      }
      if(result?.status!=='loading'&&!result?.added){
        const manual=document.createElement('button');manual.type='button';manual.textContent=result?.manualOpen?'Close name search':'Type coin name';
        manual.disabled=busy||!crop.reviewed;
        manual.onclick=()=>{const current=results.get(crop.id)||{status:'manual',choices:[],geometry:`${crop.x}:${crop.y}:${crop.width}:${crop.height}`};current.manualOpen=!current.manualOpen;results.set(crop.id,current);render(crops);};
        support.append(manual);
        if(result?.manualOpen)manualSearch(support,result,crop);
      }
      if(result?.status!=='loading'&&!result?.added){
        const label=document.createElement('label');label.textContent='Coin value (choose if unclear)';const select=document.createElement('select');select.add(new Option('Detect automatically',''));for(const value of ['5c','10c','20c','50c','$1','$2'])select.add(new Option(value,value));select.value=result?.denomination||'';select.disabled=busy||!crop.reviewed;
        select.onchange=()=>{const current=editable(crop);current.denomination=select.value;current.choices=[];current.designId=null;current.coinId=null;current.ready=false;current.reviewConfirmed=false;current.status='manual';render(crops);};label.append(select);support.append(label);
      }
      if(result?.observed){const details=document.createElement('p');details.className='batchEvidence';details.textContent=`Value: ${result.observed.denomination||'unreadable'} · Year: ${result.observed.year||'unreadable'}${result.observed.side?` · ${result.observed.side} side`:''}`;card.append(details);}
      if(result?.choices?.length){
        const suggested=result.choices[0];
        const selected=result.choices.find(choice=>choice.id===result.designId);
        if(suggested?.coin){
          const title=document.createElement('strong');title.className='batchSuggestedTitle';
          title.textContent=result.status==='manual'?'Selected from catalogue':`Suggested match${suggested.confidence!==null?` · ${suggested.confidence}%`:''}`;
          const issue=result.coinId?coinById(result.coinId):null;
          const pair=document.createElement('div');pair.className='batchPair';const ownBox=document.createElement('div');const caption=document.createElement('span');caption.textContent='Your photo';thumbnail.removeAttribute?.('role');thumbnail.removeAttribute?.('tabindex');thumbnail.onclick=null;thumbnail.onkeydown=null;ownBox.append(thumbnail,caption);pair.append(ownBox,reference(issue||selected?.coin||suggested.coin));cardSummary.insertBefore?cardSummary.insertBefore(pair,summary):cardSummary.append(pair);cardSummary.append(title);
          if(result.choices.length>1){const alternatives=document.createElement('div');alternatives.className='batchAlternatives';for(const choice of result.choices.slice(0,3)){const button=document.createElement('button');button.type='button';button.className='batchSuggestion';button.disabled=busy;const pic=document.createElement('img');pic.src=choice.coin.reference_image;pic.alt='';const text=document.createElement('span');text.textContent=choice.title;button.append(pic,text);button.onclick=()=>{result.designId=choice.id;result.coinId=null;result.ready=false;result.reviewConfirmed=false;render(crops);};alternatives.append(button);}card.append(alternatives);}
          const reject=document.createElement('button');reject.type='button';reject.textContent='Not this coin · choose manually';reject.disabled=busy||result.added;reject.onclick=()=>{result.designId=null;result.coinId=null;result.ready=false;result.reviewConfirmed=false;result.manualOpen=true;render(crops);};card.append(reject);
        }
        const designLabel=document.createElement('label');designLabel.textContent='Design';
        const designSelect=document.createElement('select');designSelect.setAttribute('aria-label',`Coin ${crop.detectionNumber} design`);
        designSelect.add(new Option('Choose design',''));
        for(const choice of result.choices)designSelect.add(new Option(`${choice.title}${choice.confidence===null?'':` · ${choice.confidence}%`}`,choice.id));
        designSelect.value=result.designId||'';designSelect.disabled=busy||result.added;
        designSelect.onchange=()=>{result.designId=designSelect.value;result.coinId=null;result.ready=false;result.reviewConfirmed=false;render(crops);};
        designLabel.append(designSelect);card.append(designLabel);
        if(selected){
          const variants=designVariants(selected.coin);
          const issueLabel=document.createElement('label');issueLabel.textContent='Issue year';
          const issueSelect=document.createElement('select');issueSelect.setAttribute('aria-label',`Coin ${crop.detectionNumber} issue year`);
          issueSelect.add(new Option('Choose issue',''));
          for(const variant of variants)issueSelect.add(new Option(variantIssueLabel(variant,variants),variant.id));
          issueSelect.value=result.coinId||'';issueSelect.disabled=busy||result.added;
          issueSelect.onchange=()=>{result.coinId=issueSelect.value||null;result.ready=false;result.reviewConfirmed=false;render(crops);};
          issueLabel.append(issueSelect);card.append(issueLabel);

        }
      }
      if(result.status!=='loading'&&!result.added){photoControl(card,crop,result,'other');card.append(support);}
      if(result&&!result.orientationOnly&&result.status!=='loading')renderTestReport(card,result,crop);
      root.append(card);
    }
    const count=Boolean(selected?.reviewed&&current?.coinId&&!current?.added);
    $('batchAddConfirmed').hidden=!count;
    $('batchAddConfirmed').disabled=busy;
    if($('batchBottomNext')){$('batchBottomNext').disabled=busy;const index=crops.findIndex(c=>c.id===focusId);$('batchBottomNext').textContent=crops.slice(index+1).some(c=>!results.get(c.id)?.added)?'Next coin ›':'Review & add ›';}
    if($('batchAddConfirmed').textContent!=='Confirm & next')$('batchAddConfirmed').textContent='Confirm & next';
  
  }
  function renderTestReport(card,result,crop){
    const section=document.createElement('details');section.className='batchTestReport';section.open=true;
    const title=document.createElement('summary');title.textContent='Test feedback';section.append(title);
    if(result.testSaved){const saved=document.createElement('p');saved.textContent='Test saved locally in Settings. This did not add the coin to My Mint.';section.append(saved);card.append(section);return;}
    const suggested=coinById(result.predictedCoinId);
    if(suggested){
      const quick=document.createElement('button');quick.type='button';quick.className='batchQuickReport';
      quick.textContent=result.status==='confident'?'✓ Yes, this coin is right · save test':result.status==='year_uncertain'?'✓ Value and design right · save test':'✓ Suggested design is right · save test';
      quick.onclick=()=>saveReport(true);section.append(quick);
    }
    const correction=document.createElement('details');correction.className='batchTestCorrection';
    const expand=document.createElement('summary');expand.textContent='Wrong or partly right? Enter the actual coin';correction.append(expand);
    const denomination=document.createElement('select');denomination.setAttribute('aria-label',`Coin ${crop.detectionNumber} actual denomination`);
    denomination.add(new Option('Actual denomination',''));
    for(const value of ['5c','10c','20c','50c','$1','$2'])denomination.add(new Option(value,value));
    denomination.value=result.expectedDenomination||'';
    const denomLabel=document.createElement('label');denomLabel.textContent='Actual denomination';denomLabel.append(denomination);correction.append(denomLabel);
    const expected=document.createElement('input');expected.setAttribute('aria-label',`Coin ${crop.detectionNumber} actual coin`);expected.placeholder='Type the coin name';expected.value=result.expectedLabel||'';
    const options=document.createElement('datalist');options.id=`batchExpected-${crop.detectionNumber}`;expected.setAttribute('list',options.id);
    function fillOptions(){options.replaceChildren(...browseCatalogue.filter(coin=>coin.denomination_display===denomination.value).map(coin=>new Option(`${coin.year} ${coin.title}`)));}
    denomination.onchange=()=>{result.expectedDenomination=denomination.value;result.expectedLabel='';expected.value='';fillOptions();};
    expected.oninput=()=>{result.expectedLabel=expected.value;};fillOptions();
    const expectedLabel=document.createElement('label');expectedLabel.textContent='Actual coin (choose a catalogue suggestion)';expectedLabel.append(expected,options);correction.append(expectedLabel);
    const save=document.createElement('button');save.type='button';save.textContent='Save test report';
    const status=document.createElement('p');status.setAttribute('role','status');
    async function saveReport(quick=false,failed=false,outcomeOverride=null){
      if(result.testSaving||result.testSaved)return;
      const actual=quick?coinById(result.predictedCoinId):window.PocketMintIdentificationReport.resolveExpected(expected.value,browseCatalogue.filter(coin=>coin.denomination_display===denomination.value));
      if(!actual&&!failed){status.textContent='Choose a denomination and exact catalogue issue to compare.';return;}
      result.testSaving=true;save.disabled=true;
      try{
        const predicted=coinById(result.predictedCoinId);
        const fields=window.PocketMintIdentificationReport.fields({flow:'batch',expectedLabel:quick?`${actual.year} ${actual.title}`:expected.value.trim(),expectedCoin:actual,predictedCoin:predicted,predictedDenomination:result.observed?.denomination,context:{detection_number:crop.detectionNumber,relative_diameter:crop.relativeDiameter??null}});
        if(quick&&!result.coinId){fields.issue_correct=null;fields.expected_coin_id=null;fields.expected_label=`${actual.title} · year not checked`;}
        const test={id:crypto.randomUUID(),created_at:new Date().toISOString(),app_version:APP_VERSION,catalogue_version:catMeta.catalogue_version||'',...fields,
          outcome:outcomeOverride||(failed?result.status==='error'?'error':'no_match':quick?(fields.denomination_correct===false?'partial':'correct'):fields.issue_correct?'correct':fields.denomination_correct?'partial':'wrong'),result_source:'batch_visual',
          result_status:result.status,region_id:crop.id||null,crop_bounds:{x:crop.x,y:crop.y,width:crop.width,height:crop.height},
          expected_denomination:actual?.denomination_display||denomination.value||null,
          candidates:result.predictedChoices||[],observed:result.observed||null,analysis_error:result.analysisError||null,fallback_reason:result.message||'',note:''};
        await put('identificationTests',test);identificationTests.unshift(test);result.testSaved=true;result.testId=test.id;renderAll();render(crops);
      }catch(error){save.disabled=false;status.textContent=`Could not save report: ${error.message}`;}
      finally{result.testSaving=false;}
    }
    result.saveReport=saveReport;
    save.onclick=()=>saveReport(false);
    if(!result.choices?.length||result.status==='error'){
      const failed=document.createElement('button');failed.type='button';failed.className='batchQuickReport';failed.textContent='Save failed test';
      failed.onclick=()=>saveReport(false,true);section.append(failed,status);
    }
    else{const wrong=document.createElement('button');wrong.type='button';wrong.textContent='Wrong match · save test';wrong.onclick=()=>saveReport(false,true,'wrong');section.append(wrong);}
    correction.append(save);if(result.status==='error'||result.status==='no_match')section.append(status);else correction.append(status);
    section.append(correction);card.append(section);
  }
  function classify(data){
    const choices=[];
    for(const match of data.matches||[]){
      const coin=coinById(match.id);if(!coin)continue;
      if(!choices.some(choice=>choice.coin.design_id===coin.design_id))choices.push(catalogueChoice(coin,Math.round(Number(match.confidence||0)*100)));
    }
    if(!choices.length)return {status:data.status||'no_match',message:data.reason||'',choices:[],ready:false,predictedCoinId:null,observed:data.observed||null,predictedChoices:[]};
    const definite=!data.uncertain&&!data.observed?.denomination_uncertain;
    const chosen=definite?choices[0]:null;
    const variants=chosen?designVariants(chosen.coin):[];
    const observedYear=String(data.observed?.year||'');
    const matching=variants.filter(coin=>String(coin.year)===observedYear);
    const coinId=chosen&&(variants.length===1?chosen.coin.id:matching.length===1&&!data.needs_year?matching[0].id:null);
    return {status:!definite?'design_uncertain':coinId?'confident':'year_uncertain',choices,designId:chosen?.id||null,coinId,ready:false,added:false,
      predictedCoinId:choices[0].coin.id,predictedChoices:(data.matches||[]).map((item,index)=>({rank:index+1,coin_id:item.id,confidence:Math.round(Number(item.confidence||0)*100)})),observed:data.observed||null};
  }
  async function identifyOne(crop,fromAll=false){
    if(busy&&!fromAll||inFlight.has(crop.id)||!crop.reviewed||!activeCrop(crop))return;
    if(!fromAll)busy=true;
    const orientationRevision=generation;
    // The queue waits for orientation before starting; manual edits still outrank
    // any late response through the crop/result identity checks below.
    if(orientationRevision!==generation||!activeCrop(crop)){if(orientationRevision===generation&&!fromAll){busy=false;render(crops);}return;}
    const previous=results.get(crop.id)||{};
    const revision=generation,geometry=`${crop.x}:${crop.y}:${crop.width}:${crop.height}`;
    inFlight.add(crop.id);const pending={...previous,status:'loading',ready:false,geometry};results.set(crop.id,pending);render(crops);
    try{
      const first=previous.reverseBlob||previous.reverse||crop.crop;const swap=Boolean(previous.firstSideIsPortrait&&previous.obverse);
      const data=await window.BatchSingleAdapter.identify({reverse:swap?previous.obverse:first,obverse:swap?first:previous.obverse||null,denomination:previous.denomination||'',signal:queueAbort&&typeof AbortSignal.any==='function'?AbortSignal.any([queueAbort.signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});
      if(revision!==generation||!activeCrop(crop)||results.get(crop.id)!==pending)return;
      results.set(crop.id,{...previous,...classify(data),orientationOnly:false,geometry,testSaved:false,reviewConfirmed:false});
    }catch(error){
      if(revision!==generation||!activeCrop(crop)||results.get(crop.id)!==pending)return;
      results.set(crop.id,{...previous,orientationOnly:false,status:'error',ready:false,message:error.quota?'Vision allowance reached. Try again after it resets.':`Could not identify this coin: ${error.message}`,analysisError:error.analysisError||{message:error.message},quota:Boolean(error.quota),geometry});
    }
    finally{if(revision===generation){inFlight.delete(crop.id);if(!fromAll){busy=false;pumpOrientation();}window.BatchReview?.redraw();render(crops);}}
    render(crops);
  }
  function openCoin(id){
    if(!crops.some(c=>c.id===id))return;
    finalMode=false;
    focusId=id;renderKey='';window.BatchReview?.showCoins();render(crops);
    $('batchWorkspace').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function closeWorkspace(){if(!focusId&&!finalMode)return false;finalMode=false;focusId=null;render(crops);($('batchIdentificationOverview')||$('batchCrops')).scrollIntoView({block:'start',behavior:'smooth'});return true;}
  $('batchCloseCoin').onclick=closeWorkspace;
  function advanceCoin(){
    const index=crops.findIndex(c=>c.id===focusId);const next=crops.slice(index+1).find(c=>!results.get(c.id)?.added);
    if(next)openCoin(next.id);else finishBatch();
  }
  function finishBatch(){
    focusId=null;finalMode=true;render(crops);$('batchFinalReview')?.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function renderFinalReview(){
    const root=$('batchFinalList');if(!root)return;
    const ids=new Set(crops.map(c=>c.id));for(const [id,row] of finalRows)if(!ids.has(id)){row.node.remove();finalRows.delete(id);}
    let selected=0,added=0;
    for(const crop of crops){
      const result=results.get(crop.id),coin=coinById(result?.coinId),eligible=Boolean(crop.reviewed&&coin&&!result?.added&&result?.status!=='loading'&&!result?.orientationOnly);
      if(result?.added)added++;if(eligible&&result.reviewConfirmed)selected++;
      let row=finalRows.get(crop.id);
      if(!row){const node=document.createElement('article');node.className='batchFinalCoin pm-cream-card';const image=document.createElement('img'),label=document.createElement('label'),checkbox=document.createElement('input'),name=document.createElement('span'),review=document.createElement('button');checkbox.type='checkbox';review.type='button';review.textContent='Review';label.append(checkbox,name);node.append(image,label,review);root.append(node);row={node,image,checkbox,name,review};finalRows.set(crop.id,row);}
      const url=effectivePhoto(crop).url||crop.cropUrl;if(row.image.getAttribute('src')!==url)row.image.src=url;row.image.alt=`Coin ${crop.detectionNumber}`;row.image.decoding='async';
      row.checkbox.checked=eligible&&Boolean(result.reviewConfirmed);row.checkbox.disabled=busy||!eligible;row.checkbox.setAttribute('aria-label',`Select coin ${crop.detectionNumber} to add`);row.checkbox.onchange=()=>{result.reviewConfirmed=row.checkbox.checked;render(crops);};
      row.name.textContent=`Coin ${crop.detectionNumber} · ${coin?`${coin.denomination_display} · ${coin.year} ${coin.title}`:identificationStatus(crop)}${result?.added?' · Added':''}`;row.review.textContent='›';row.review.setAttribute('aria-label',`Review coin ${crop.detectionNumber}`);row.review.onclick=()=>openCoin(crop.id);row.review.disabled=busy;
    }
    const summary=$('batchFinishSummary');summary.hidden=false;summary.textContent=`${selected} selected to add · ${added} already added · ${crops.length-added-selected} left out`;
    $('batchQuickAdd').disabled=busy||!selected;$('batchQuickAdd').textContent=busy?'Adding coins…':`Add ${selected} selected coin${selected===1?'':'s'} to My Mint`;
  }
  if($('batchReturnReview'))$('batchReturnReview').onclick=closeWorkspace;
  if($('batchBottomNext'))$('batchBottomNext').onclick=advanceCoin;
  if($('batchFinish'))$('batchFinish').onclick=finishBatch;
  if($('batchNewPhoto'))$('batchNewPhoto').onclick=()=>{if(!crops.some(c=>!results.get(c.id)?.added)||confirm('Start a new photo? Coins not added in this batch will be cleared. Saved coins and test reports are kept.'))$('batchRetake').click();};
  $('batchNextCoin').onclick=advanceCoin;
  function identificationStatus(crop){const r=results.get(crop.id);return r?.added?'Added':r?.reviewConfirmed?'Confirmed for final add':r?.status==='loading'?'Identifying…':r&&!r.orientationOnly?r.status==='error'?'Try again':r.choices?.length?'Ready to review':'Choose manually':queuePaused?'Paused':'Waiting';}
  function queueProgress(){
    const done=crops.filter(c=>{const r=results.get(c.id);return r&&!r.orientationOnly&&r.status!=='loading';}).length;
    const active=crops.find(c=>inFlight.has(c.id));
    $('batchIdentifyStatus').textContent=queuePaused?`Identification paused · ${done} of ${crops.length} processed. Review available results or resume.`:active?`Identifying coin ${active.detectionNumber} · ${done} of ${crops.length} processed`:`${done} of ${crops.length} processed · choose each issue and confirm to add.`;
    $('batchResumeQueue').hidden=!queuePaused;
  }
  async function runQueue(){
    if(queueRunning||!queueEnabled||queuePaused||busy)return;
    queueRunning=true;const revision=generation;
    try{while(revision===generation&&queueEnabled&&!queuePaused&&!busy){
      const next=[...crops].sort((a,b)=>a.detectionNumber-b.detectionNumber).find(c=>c.reviewed&&!inFlight.has(c.id)&&!results.get(c.id)?.added&&(!results.has(c.id)||results.get(c.id).orientationOnly||results.get(c.id).status==='manual'&&!results.get(c.id).choices?.length));
      if(!next)break;
      const work=identifyOne(next,true);queueProgress();window.BatchReview?.redraw();await work;
      if(revision!==generation)return;
      if(results.get(next.id)?.quota)queuePaused=true;
      queueProgress();
    }}finally{if(revision===generation){queueRunning=false;queueProgress();window.BatchReview?.redraw();}}
  }
  async function startQueue(){const revision=generation;if(!await prepareOrientation()||revision!==generation)return;queueEnabled=true;queuePaused=false;runQueue();}
  $('batchResumeQueue').onclick=startQueue;
  $('batchIdentifyAll').onclick=async()=>{if(!crops.every(c=>c.reviewed)&&!await window.BatchReview?.approveAll())return;const next=crops.find(c=>!results.get(c.id)?.added);if(next)openCoin(next.id);startQueue();};

  async function saveBatchTests(exportFile=false){
    if(busy)return;
    const revision=generation,sourceCrops=[...crops];busy=true;render(crops);
    try{
      for(const crop of sourceCrops){if(revision!==generation)return;const result=results.get(crop.id);if(!result||result.orientationOnly||result.status==='loading')continue;
        if(!result.saveReport)renderTestReport(document.createElement('div'),result,crop);
        if(!result.testSaved)await result.saveReport?.(false,true,result.status==='error'?'error':result.choices?.length?'unreviewed':'no_match');
        if(!result.testSaved)throw new Error(`Coin ${crop.detectionNumber}: test could not be saved`);
      }
      if(revision!==generation)return;
      const ids=new Set(sourceCrops.map(crop=>results.get(crop.id)?.testId).filter(Boolean));
      const tests=identificationTests.filter(test=>ids.has(test.id));
      if(exportFile){const payload={format:'pocket-mint-identification-tests',version:1,flow:'batch',exported_at:new Date().toISOString(),app_version:APP_VERSION,catalogue_version:catMeta.catalogue_version,total_outlines:sourceCrops.length,unprocessed:sourceCrops.length-tests.length,tests};
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`pocket-mint-batch-tests-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      $('batchIdentifyStatus').textContent=`${tests.length} batch tests saved${exportFile?' and exported':''}. No coins were added. Unreviewed matches are not scored as correct.`;
    }catch(error){if(revision===generation)$('batchIdentifyStatus').textContent=`Could not finish saving tests: ${error.message}`;}
    finally{if(revision===generation){busy=false;render(crops);runQueue();}}
  }
  if($('batchSaveTests'))$('batchSaveTests').onclick=()=>saveBatchTests(false);
  if($('batchExportTests'))$('batchExportTests').onclick=()=>saveBatchTests(true);
  $('batchAddConfirmed').onclick=async()=>{
    const current=results.get(focusId);if(busy||!current?.coinId||current.added||!crops.find(c=>c.id===focusId)?.reviewed)return;
    current.reviewConfirmed=true;advanceCoin();
  };
  if($('batchQuickAdd'))$('batchQuickAdd').onclick=async()=>{
    if(busy)return;
    const items=crops.filter(crop=>{const result=results.get(crop.id);return crop.reviewed&&result?.reviewConfirmed&&result?.coinId&&!result.added&&result.status!=='loading'&&!result.orientationOnly;}).map(crop=>({regionId:crop.id,coinId:results.get(crop.id).coinId,crop:results.get(crop.id).reverseBlob||crop.crop}));
    if(!items.length)return;
    const revision=generation,completed=new Set();busy=true;render(crops);$('batchFinalStatus').textContent='Saving selected coins…';
    const markSaved=id=>{completed.add(id);if(revision===generation){const result=results.get(id);if(result){result.added=true;result.ready=false;result.reviewConfirmed=false;}}};
    try{
      const added=await window.PocketMintBatchCollection.addConfirmedBatchCoins(items,markSaved);if(revision!==generation)return;
      for(const id of added)markSaved(id);
      $('batchFinalStatus').textContent=`${added.length} coin${added.length===1?'':'s'} added to My Mint. ${items.length-added.length?'Some selected coins were not saved; try those again.':'Other coins have been left out.'}`;
    }catch(error){if(revision===generation)$('batchFinalStatus').textContent=`${completed.size?`${completed.size} already saved. `:''}Could not finish saving: ${error.message}. Unsaved selections are kept; try again.`;}
    finally{if(revision===generation){busy=false;render(crops);runQueue();}}
  };
  window.BatchIdentification={reset,sync,render,editCrop,autoRotate,rotateCrop,scheduleOrientation,prepareOrientation,rotationStatus,identificationStatus,startQueue,effectivePhoto,openCoin,closeWorkspace,isBusy:()=>busy,isIdentifying:()=>queueRunning||inFlight.size>0};
  window.BatchIdentificationCore={classify};
})();
