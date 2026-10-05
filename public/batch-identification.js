/* Each crop uses the same opt-in circulating identifier as single Identify.
   Diagnostic reports are independent of collection confirmation. */
(() => {
  const results=new Map(), $=id=>document.getElementById(id);
  let crops=[],generation=0,busy=false;
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
      const haystack=`${coin.year} ${coin.title} ${coin.denomination_display} ${coin.series_id||''} ${coin.id}`.toLocaleLowerCase();
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
      suggestions.replaceChildren();const matches=searchCatalogue(input.value,result.denomination||'');
      if(!input.value.trim())return;
      if(!matches.length){const message=document.createElement('p');message.textContent='No catalogue names match. Try another word or year.';suggestions.append(message);return;}
      for(const coin of matches){
        const button=document.createElement('button');button.type='button';button.className='batchSuggestion';
        const thumbnail=document.createElement('img');thumbnail.src=coin.reference_image;thumbnail.alt='';
        const caption=document.createElement('span');caption.textContent=`${coin.title} · ${coin.denomination_display} · ${coin.year}`;
        button.append(thumbnail,caption);
        button.onclick=()=>{
          result.choices=[catalogueChoice(coin)];result.designId=coin.id;
          const variants=designVariants(coin);
          result.coinId=variants.length===1?coin.id:null;
          result.ready=false;result.status='manual';result.manualOpen=false;
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
  function editable(crop){let result=results.get(crop.id);if(!result){result={status:'manual',choices:[],geometry:geometryOf(crop),ready:false};results.set(crop.id,result);}return result;}
  function photoControl(card,crop,result,side){
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('capture','environment');input.hidden=true;
    const button=document.createElement('button');button.type='button';button.textContent=side==='design'?'Photograph this coin’s design side':result?.obverse?'Replace portrait-side photo':'Add portrait side to read year';button.disabled=busy||result?.added||!crop.reviewed;
    button.onclick=()=>input.click();
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const revision=generation;button.disabled=true;
      try{const source=await BatchCoins.prepareBatchImage(file);const blob=await new Promise((resolve,reject)=>source.toBlob(b=>b?resolve(b):reject(new Error('Could not read photo')),'image/jpeg',.9));source.width=0;source.height=0;
        const data=await fileDataUrl(blob);if(revision!==generation||!activeCrop(crop))return;
        const current=editable(crop);current.ready=false;current.added=false;current.choices=[];current.designId=null;current.coinId=null;current.status='manual';
        if(side==='design'){current.reverse=data;current.reverseBlob=blob;}else current.obverse=data;
        current.message='New photo ready. Identify this coin again.';render(crops);
      }catch(error){$('batchIdentifyStatus').textContent=error.message;}finally{button.disabled=false;input.value='';}
    };card.append(button,input);
  }
  function reset(){generation++;busy=false;crops=[];results.clear();$('batchIdentifyStatus').textContent='';render([]);}
  function sync(regions){
    const active=new Map(regions.map(r=>[r.id,`${r.x}:${r.y}:${r.width}:${r.height}`]));
    for(const [id,result] of results)if(!active.has(id)||result.geometry!==active.get(id))results.delete(id);
  }
  function render(nextCrops){
    crops=nextCrops;
    const root=$('batchResultList');root.replaceChildren();
    $('batchIdentifyAll').disabled=busy||!crops.length;
    $('batchIdentifyAll').textContent=busy?'Identifying coins…':`Outlines look right · identify ${crops.length} coin${crops.length===1?'':'s'}`;
    for(const id of ['batchSaveTests','batchExportTests']){const button=$(id);if(button){button.hidden=!results.size;button.disabled=busy;}}
    for(const crop of crops){
      const result=results.get(crop.id);
      if(!result)continue;
      const card=document.createElement('details');card.className='batchResult pm-cream-card';card.dataset.regionId=crop.id;card.open=Boolean(result.expanded);
      card.ontoggle=()=>{result.expanded=card.open;};
      const cardSummary=document.createElement('summary');cardSummary.className='batchCompactSummary';card.append(cardSummary);
      const heading=document.createElement('h4');heading.textContent=`Coin ${crop.detectionNumber}`;card.append(heading);
      const thumbnail=document.createElement('img');thumbnail.src=result?.reverse||crop.cropUrl;thumbnail.alt=`Coin ${crop.detectionNumber} crop`;thumbnail.onclick=()=>window.BatchReview?.select(crop.id);thumbnail.tabIndex=0;thumbnail.setAttribute('role','button');thumbnail.setAttribute('aria-label',`Locate coin ${crop.detectionNumber} in photo`);thumbnail.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();window.BatchReview?.select(crop.id);}};card.append(thumbnail);
      const summary=document.createElement('p');summary.className='batchResultSummary';
      if(!crop.reviewed)summary.textContent='Check this outline contains one coin before identifying.';
      else if(!result)summary.textContent='Ready to identify.';
      else if(result.status==='loading')summary.textContent='Checking this coin…';
      else if(result.status==='error')summary.textContent=result.message;
      else if(['no_match','not_coin','multiple_coins','check_coin','low_quality','needs_other_side'].includes(result.status))summary.textContent=result.message||'No reliable match. Retry or compare with the catalogue.';
      else summary.textContent=result.status==='manual'?(result.message||'Check the catalogue artwork and choose the exact issue.'):result.status==='confident'?'Likely design and issue: check before adding.':result.status==='year_uncertain'?'Design found · choose the issue year.':'Design uncertain · choose the matching design and issue.';
      card.append(summary);
      cardSummary.append(heading,thumbnail,summary);
      if(!result||result.status==='manual'&&!result.choices?.length){const identify=document.createElement('button');identify.type='button';identify.textContent='Identify this coin';identify.disabled=busy||!crop.reviewed;identify.onclick=()=>identifyOne(crop);card.append(identify);}
      if(result&&['error','no_match','not_coin','multiple_coins','check_coin','low_quality','needs_other_side'].includes(result.status)){
        const retry=document.createElement('button');retry.type='button';retry.textContent='Retry this coin';retry.disabled=busy||!crop.reviewed;retry.onclick=()=>identifyOne(crop);card.append(retry);
      }
      if(result?.status!=='loading'&&!result?.added){
        const manual=document.createElement('button');manual.type='button';manual.textContent=result?.manualOpen?'Close name search':'Type coin name';
        manual.disabled=busy||!crop.reviewed;
        manual.onclick=()=>{const current=results.get(crop.id)||{status:'manual',choices:[],geometry:`${crop.x}:${crop.y}:${crop.width}:${crop.height}`};current.manualOpen=!current.manualOpen;results.set(crop.id,current);render(crops);};
        card.append(manual);
        if(result?.manualOpen)manualSearch(card,result,crop);
      }
      if(result?.status!=='loading'&&!result?.added){
        const label=document.createElement('label');label.textContent='Coin value (choose if unclear)';const select=document.createElement('select');select.add(new Option('Detect automatically',''));for(const value of ['5c','10c','20c','50c','$1','$2'])select.add(new Option(value,value));select.value=result?.denomination||'';select.disabled=busy||!crop.reviewed;
        select.onchange=()=>{const current=editable(crop);current.denomination=select.value;current.choices=[];current.designId=null;current.coinId=null;current.ready=false;current.status='manual';render(crops);};label.append(select);card.append(label);
        photoControl(card,crop,result,'design');photoControl(card,crop,result,'portrait');
      }
      if(result?.observed){const details=document.createElement('p');details.className='batchEvidence';details.textContent=`Value: ${result.observed.denomination||'unreadable'} · Year: ${result.observed.year||'unreadable'}${result.observed.side?` · ${result.observed.side} side`:''}`;card.append(details);}
      if(result?.choices?.length){
        const suggested=result.choices[0];
        const selected=result.choices.find(choice=>choice.id===result.designId);
        if(suggested?.coin){
          const title=document.createElement('strong');title.className='batchSuggestedTitle';
          title.textContent=result.status==='manual'?'Selected from catalogue':`Suggested match${suggested.confidence!==null?` · ${suggested.confidence}%`:''}`;
          const issue=result.coinId?coinById(result.coinId):null;
          const pair=document.createElement('div');pair.className='batchPair';const own=document.createElement('img');own.src=result.reverse||crop.cropUrl;own.alt=`Your coin ${crop.detectionNumber}`;const ownBox=document.createElement('div');const caption=document.createElement('span');caption.textContent='Your photo';ownBox.append(own,caption);pair.append(ownBox,reference(issue||selected?.coin||suggested.coin));card.append(title,pair);
          if(result.choices.length>1){const alternatives=document.createElement('div');alternatives.className='batchAlternatives';for(const choice of result.choices.slice(0,3)){const button=document.createElement('button');button.type='button';button.className='batchSuggestion';button.disabled=busy;const pic=document.createElement('img');pic.src=choice.coin.reference_image;pic.alt='';const text=document.createElement('span');text.textContent=choice.title;button.append(pic,text);button.onclick=()=>{result.designId=choice.id;result.coinId=null;result.ready=false;render(crops);};alternatives.append(button);}card.append(alternatives);}
          const reject=document.createElement('button');reject.type='button';reject.textContent='Not this coin · choose manually';reject.disabled=busy||result.added;reject.onclick=()=>{result.designId=null;result.coinId=null;result.ready=false;result.manualOpen=true;render(crops);};card.append(reject);
        }
        const designLabel=document.createElement('label');designLabel.textContent='Design';
        const designSelect=document.createElement('select');designSelect.setAttribute('aria-label',`Coin ${crop.detectionNumber} design`);
        designSelect.add(new Option('Choose design',''));
        for(const choice of result.choices)designSelect.add(new Option(`${choice.title}${choice.confidence===null?'':` · ${choice.confidence}%`}`,choice.id));
        designSelect.value=result.designId||'';designSelect.disabled=busy||result.added;
        designSelect.onchange=()=>{result.designId=designSelect.value;result.coinId=null;result.ready=false;render(crops);};
        designLabel.append(designSelect);card.append(designLabel);
        if(selected){
          const variants=designVariants(selected.coin);
          const issueLabel=document.createElement('label');issueLabel.textContent='Issue year';
          const issueSelect=document.createElement('select');issueSelect.setAttribute('aria-label',`Coin ${crop.detectionNumber} issue year`);
          issueSelect.add(new Option('Choose issue',''));
          for(const variant of variants)issueSelect.add(new Option(variantIssueLabel(variant,variants),variant.id));
          issueSelect.value=result.coinId||'';issueSelect.disabled=busy||result.added;
          issueSelect.onchange=()=>{result.coinId=issueSelect.value||null;result.ready=false;render(crops);};
          issueLabel.append(issueSelect);card.append(issueLabel);
          if(result.coinId){
            const readyLabel=document.createElement('label');readyLabel.className='batchReady';
            const ready=document.createElement('input');ready.type='checkbox';ready.checked=result.ready&&!result.added;ready.disabled=busy||result.added||!crop.reviewed;
            ready.onchange=()=>{result.ready=ready.checked;render(crops);};
            readyLabel.append(ready,document.createTextNode(result.added?' Added to My Mint':' Confirm this physical coin'));card.append(readyLabel);
          }
        }
      }
      if(result&&result.status!=='loading')renderTestReport(card,result,crop);
      root.append(card);
    }
    const count=crops.filter(crop=>crop.reviewed&&results.get(crop.id)?.ready&&results.get(crop.id)?.coinId&&!results.get(crop.id)?.added).length;
    $('batchAddConfirmed').hidden=!count;
    $('batchAddConfirmed').disabled=busy;
    $('batchAddConfirmed').textContent=`Add ${count} confirmed coin${count===1?'':'s'} to My Mint`;
  }
  function renderTestReport(card,result,crop){
    const section=document.createElement('section');section.className='batchTestReport';
    const title=document.createElement('strong');title.textContent='Test feedback';section.append(title);
    if(result.testSaved){const saved=document.createElement('p');saved.textContent='Test saved locally in Settings. This did not add the coin to My Mint.';section.append(saved);card.append(section);return;}
    const suggested=coinById(result.predictedCoinId);
    if(suggested&&(result.status==='confident'||result.status==='year_uncertain')){
      const quick=document.createElement('button');quick.type='button';quick.className='batchQuickReport';
      quick.textContent=result.status==='confident'?'✓ Yes, this coin is right · save test':'✓ Value and design right · save test';
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
      const actual=quick?coinById(result.coinId||result.predictedCoinId):window.PocketMintIdentificationReport.resolveExpected(expected.value,browseCatalogue.filter(coin=>coin.denomination_display===denomination.value));
      if(!actual&&!failed){status.textContent='Choose a denomination and exact catalogue issue to compare.';return;}
      result.testSaving=true;save.disabled=true;
      try{
        const predicted=coinById(result.predictedCoinId);
        const fields=window.PocketMintIdentificationReport.fields({flow:'batch',expectedLabel:quick?`${actual.year} ${actual.title}`:expected.value.trim(),expectedCoin:actual,predictedCoin:predicted,predictedDenomination:result.observed?.denomination,context:{detection_number:crop.detectionNumber,relative_diameter:crop.relativeDiameter??null}});
        if(quick&&result.status==='year_uncertain'&&!result.coinId){fields.issue_correct=null;fields.expected_coin_id=null;fields.expected_label=`${actual.title} · year not checked`;}
        const test={id:crypto.randomUUID(),created_at:new Date().toISOString(),app_version:APP_VERSION,catalogue_version:catMeta.catalogue_version||'',...fields,
          outcome:outcomeOverride||(failed?result.status==='error'?'error':'no_match':quick?'correct':fields.issue_correct?'correct':fields.denomination_correct?'partial':'wrong'),result_source:'batch_visual',
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
    if(busy&&!fromAll||!crop.reviewed||!activeCrop(crop))return;
    if(!fromAll)busy=true;
    const previous=results.get(crop.id)||{};
    const revision=generation,geometry=`${crop.x}:${crop.y}:${crop.width}:${crop.height}`;
    const pending={...previous,status:'loading',ready:false,geometry};results.set(crop.id,pending);render(crops);
    try{
      const reverse=previous.reverse||await fileDataUrl(crop.crop);
      if(revision!==generation)return;
      const response=await fetch('/api/identify',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'content-type':'application/json'},body:JSON.stringify({mode:'circulating',obverse:previous.obverse||null,reverse,batch_coin:true,batch_reviewed:true,denomination:previous.denomination||''})});
      const data=await response.json();
      if(!response.ok)throw Object.assign(new Error(data.error||'Identification unavailable'),{quota:response.status===429,analysisError:{status:response.status,diagnostic_code:data.diagnostic_code||null,request_id:data.request_id||null,message:data.error||'Identification unavailable'}});
      if(revision!==generation||!activeCrop(crop)||results.get(crop.id)!==pending)return;
      results.set(crop.id,{...previous,...classify(data),geometry,testSaved:false});
    }catch(error){
      if(revision!==generation||!activeCrop(crop)||results.get(crop.id)!==pending)return;
      results.set(crop.id,{...previous,status:'error',ready:false,message:error.quota?'Vision allowance reached. Try again after it resets.':`Could not identify this coin: ${error.message}`,analysisError:error.analysisError||{message:error.message},quota:Boolean(error.quota),geometry});
    }
    finally{if(revision===generation&&!fromAll){busy=false;render(crops);}}
    render(crops);
  }
  $('batchIdentifyAll').onclick=async()=>{
    if(busy||!crops.length)return;
    busy=true;const revision=generation;
    if(window.BatchReview?.approveAll){
      try{const approved=await window.BatchReview.approveAll();if(!approved||revision!==generation){if(revision===generation){busy=false;render(crops);}return;}}
      catch(error){if(revision===generation){busy=false;$('batchIdentifyStatus').textContent=`Could not prepare crops: ${error.message}`;render(crops);}return;}
    }
    const queue=[...crops].filter(crop=>crop.reviewed&&!results.get(crop.id)?.added&&!results.get(crop.id)?.choices?.length);
    if(!queue.length){busy=false;$('batchIdentifyStatus').textContent='All remaining crops have results. Review them or retry a coin individually.';render(crops);return;}
    for(let index=0;index<queue.length;index++){
      if(revision!==generation)break;
      $('batchIdentifyStatus').textContent=`Identifying coin ${index+1} of ${queue.length}…`;
      await identifyOne(queue[index],true);
      if(results.get(queue[index].id)?.quota){$('batchIdentifyStatus').textContent='Vision allowance reached. Remaining coins are still here to try later.';break;}
    }
    if(revision!==generation)return;
    busy=false;
    if(!$('batchIdentifyStatus').textContent.includes('allowance'))$('batchIdentifyStatus').textContent='Review each result, select uncertain designs or years, then confirm the coins you want to add.';
    render(crops);
  };
  async function saveBatchTests(exportFile=false){
    if(busy)return;
    const revision=generation,sourceCrops=[...crops];busy=true;render(crops);
    try{
      for(const crop of sourceCrops){if(revision!==generation)return;const result=results.get(crop.id);if(!result||result.status==='loading')continue;
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
    finally{if(revision===generation){busy=false;render(crops);}}
  }
  if($('batchSaveTests'))$('batchSaveTests').onclick=()=>saveBatchTests(false);
  if($('batchExportTests'))$('batchExportTests').onclick=()=>saveBatchTests(true);
  $('batchAddConfirmed').onclick=async()=>{
    if(busy)return;
    const items=crops.filter(crop=>{const result=results.get(crop.id);return crop.reviewed&&result?.ready&&result.coinId&&!result.added;}).map(crop=>({regionId:crop.id,coinId:results.get(crop.id).coinId,crop:results.get(crop.id).reverseBlob||crop.crop}));
    if(!items.length)return;
    busy=true;render(crops);$('batchIdentifyStatus').textContent='Saving confirmed coins…';
    try{
      const added=await window.PocketMintBatchCollection.addConfirmedBatchCoins(items);
      for(const id of added){const result=results.get(id);if(result){result.added=true;result.ready=false;}}
      $('batchIdentifyStatus').textContent=`${added.length} coin${added.length===1?'':'s'} added. Other crops remain available.`;
    }catch(error){$('batchIdentifyStatus').textContent=`Could not finish saving: ${error.message}`;}
    finally{busy=false;render(crops);}
  };
  window.BatchIdentification={reset,sync,render,isBusy:()=>busy};
  window.BatchIdentificationCore={classify};
})();
