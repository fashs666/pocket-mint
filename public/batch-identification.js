/* Batch results use the existing single-coin /api/identify endpoint. No collection
   mutation occurs until the user presses the separate batch confirmation button. */
(() => {
  const results=new Map(), $=id=>document.getElementById(id);
  let crops=[],generation=0,busy=false;
  const fileDataUrl=blob=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
  function reset(){generation++;busy=false;crops=[];results.clear();$('batchIdentifyStatus').textContent='';render([]);}
  function sync(regions){
    const active=new Map(regions.map(r=>[r.id,`${r.x}:${r.y}:${r.width}:${r.height}`]));
    for(const [id,result] of results)if(!active.has(id)||result.geometry!==active.get(id))results.delete(id);
  }
  function render(nextCrops){
    crops=nextCrops;
    const root=$('batchResultList');root.replaceChildren();
    $('batchIdentifyAll').disabled=busy||!crops.length;
    $('batchIdentifyAll').textContent=busy?'Identifying coins…':`Identify ${crops.length} coin${crops.length===1?'':'s'}`;
    for(const crop of crops){
      const result=results.get(crop.id);
      const card=document.createElement('article');card.className='batchResult pm-cream-card';
      const heading=document.createElement('h4');heading.textContent=`Coin ${crop.detectionNumber}`;card.append(heading);
      const thumbnail=document.createElement('img');thumbnail.src=crop.cropUrl;thumbnail.alt=`Coin ${crop.detectionNumber} crop`;card.append(thumbnail);
      const summary=document.createElement('p');summary.className='batchResultSummary';
      if(!result)summary.textContent='Ready to identify.';
      else if(result.status==='loading')summary.textContent='Checking this coin…';
      else if(result.status==='error')summary.textContent=result.message;
      else if(result.status==='no_match')summary.textContent='No reliable match. Retry or compare with the catalogue.';
      else summary.textContent=result.status==='confident'?'Likely design and issue: check before adding.':result.status==='year_uncertain'?'Design found · choose the issue year.':'Design uncertain · choose the matching design and issue.';
      card.append(summary);
      if(result?.status==='error'||result?.status==='no_match'){
        const retry=document.createElement('button');retry.type='button';retry.textContent='Retry this coin';retry.disabled=busy;retry.onclick=()=>identifyOne(crop);card.append(retry);
        if(result.status==='no_match'){const browse=document.createElement('button');browse.type='button';browse.textContent='Search catalogue';browse.onclick=()=>window.open('./#catalogue','_blank','noopener');card.append(browse);}
      }
      if(result?.choices?.length){
        const designLabel=document.createElement('label');designLabel.textContent='Design';
        const designSelect=document.createElement('select');designSelect.setAttribute('aria-label',`Coin ${crop.detectionNumber} design`);
        designSelect.add(new Option('Choose design',''));
        for(const choice of result.choices)designSelect.add(new Option(`${choice.title} · ${choice.confidence}%`,choice.id));
        designSelect.value=result.designId||'';
        designSelect.onchange=()=>{result.designId=designSelect.value;result.coinId=null;result.ready=false;render(crops);};
        designLabel.append(designSelect);card.append(designLabel);
        const selected=result.choices.find(choice=>choice.id===result.designId);
        if(selected){
          const variants=designVariants(selected.coin);
          const issueLabel=document.createElement('label');issueLabel.textContent='Issue year';
          const issueSelect=document.createElement('select');issueSelect.setAttribute('aria-label',`Coin ${crop.detectionNumber} issue year`);
          issueSelect.add(new Option('Choose issue',''));
          for(const variant of variants)issueSelect.add(new Option(variantIssueLabel(variant,variants),variant.id));
          issueSelect.value=result.coinId||'';
          issueSelect.onchange=()=>{result.coinId=issueSelect.value||null;result.ready=Boolean(result.coinId);render(crops);};
          issueLabel.append(issueSelect);card.append(issueLabel);
          if(result.coinId){
            const readyLabel=document.createElement('label');readyLabel.className='batchReady';
            const ready=document.createElement('input');ready.type='checkbox';ready.checked=result.ready&&!result.added;ready.disabled=result.added;
            ready.onchange=()=>{result.ready=ready.checked;render(crops);};
            readyLabel.append(ready,document.createTextNode(result.added?' Added to My Mint':' Confirm this physical coin'));card.append(readyLabel);
          }
        }
      }
      root.append(card);
    }
    const count=[...results.values()].filter(result=>result.ready&&result.coinId&&!result.added).length;
    $('batchAddConfirmed').hidden=!count;
    $('batchAddConfirmed').disabled=busy;
    $('batchAddConfirmed').textContent=`Add ${count} confirmed coin${count===1?'':'s'} to My Mint`;
  }
  function classify(data){
    const choices=[];
    for(const match of data.matches||[]){
      const coin=catalogue.find(item=>item.id===match.id);if(!coin)continue;
      if(!choices.some(choice=>choice.title===coin.title&&choice.coin.denomination_display===coin.denomination_display))choices.push({id:coin.id,title:coin.title,coin,confidence:Math.round(Number(match.confidence||0)*100)});
    }
    if(!choices.length)return {status:'no_match',choices:[],ready:false};
    const definite=!data.uncertain;
    const chosen=definite?choices[0]:null;
    const variants=chosen?designVariants(chosen.coin):[];
    const observedYear=String(data.observed?.year||'');
    const matching=variants.filter(coin=>String(coin.year)===observedYear);
    const coinId=chosen&&(variants.length===1?chosen.coin.id:matching.length===1&&!data.needs_year?matching[0].id:null);
    return {status:!definite?'design_uncertain':coinId?'confident':'year_uncertain',choices,designId:chosen?.id||null,coinId,ready:Boolean(coinId),added:false};
  }
  async function identifyOne(crop,fromAll=false){
    if(busy&&!fromAll)return;
    const revision=generation,geometry=`${crop.x}:${crop.y}:${crop.width}:${crop.height}`;
    results.set(crop.id,{status:'loading',geometry});render(crops);
    try{
      const reverse=await fileDataUrl(crop.crop);
      if(revision!==generation)return;
      const response=await fetch('/api/identify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({obverse:null,reverse})});
      const data=await response.json();
      if(!response.ok)throw Object.assign(new Error(data.error||'Identification unavailable'),{quota:response.status===429});
      if(revision!==generation)return;
      results.set(crop.id,{...classify(data),geometry});
    }catch(error){
      if(revision!==generation)return;
      results.set(crop.id,{status:'error',message:error.quota?'Vision allowance reached. Try again after it resets.':`Could not identify this coin: ${error.message}`,quota:Boolean(error.quota),geometry});
    }
    render(crops);
  }
  $('batchIdentifyAll').onclick=async()=>{
    if(busy||!crops.length)return;
    busy=true;const revision=generation,queue=[...crops].filter(crop=>!results.get(crop.id)?.added);
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
  $('batchAddConfirmed').onclick=async()=>{
    if(busy)return;
    const items=crops.filter(crop=>{const result=results.get(crop.id);return result?.ready&&result.coinId&&!result.added;}).map(crop=>({regionId:crop.id,coinId:results.get(crop.id).coinId,crop:crop.crop}));
    if(!items.length)return;
    busy=true;render(crops);$('batchIdentifyStatus').textContent='Saving confirmed coins…';
    try{
      const added=await window.PocketMintBatchCollection.addConfirmedBatchCoins(items);
      for(const id of added){const result=results.get(id);if(result){result.added=true;result.ready=false;}}
      $('batchIdentifyStatus').textContent=`${added.length} coin${added.length===1?'':'s'} added. Other crops remain available.`;
    }catch(error){$('batchIdentifyStatus').textContent=`Could not finish saving: ${error.message}`;}
    finally{busy=false;render(crops);}
  };
  window.BatchIdentification={reset,sync,render};
  window.BatchIdentificationCore={classify};
})();
