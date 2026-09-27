/* Batch results use the existing single-coin /api/identify endpoint. No collection
   mutation occurs until the user presses the separate batch confirmation button. */
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
  function searchCatalogue(query){
    const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if(!words.length)return [];
    const unique=new Map();
    for(const coin of catalogue){
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
      suggestions.replaceChildren();const matches=searchCatalogue(input.value);
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
      else summary.textContent=result.status==='manual'?'Check the catalogue artwork and choose the exact issue.':result.status==='confident'?'Likely design and issue: check before adding.':result.status==='year_uncertain'?'Design found · choose the issue year.':'Design uncertain · choose the matching design and issue.';
      card.append(summary);
      if(!result){const identify=document.createElement('button');identify.type='button';identify.textContent='Identify this coin';identify.disabled=busy;identify.onclick=()=>identifyOne(crop);card.append(identify);}
      if(result?.status==='error'||result?.status==='no_match'){
        const retry=document.createElement('button');retry.type='button';retry.textContent='Retry this coin';retry.disabled=busy;retry.onclick=()=>identifyOne(crop);card.append(retry);
      }
      if(result?.status!=='loading'&&!result?.added){
        const manual=document.createElement('button');manual.type='button';manual.textContent=result?.manualOpen?'Close name search':'Type coin name';
        manual.onclick=()=>{const current=results.get(crop.id)||{status:'manual',choices:[],geometry:`${crop.x}:${crop.y}:${crop.width}:${crop.height}`};current.manualOpen=!current.manualOpen;results.set(crop.id,current);render(crops);};
        card.append(manual);
        if(result?.manualOpen)manualSearch(card,result,crop);
      }
      if(result?.choices?.length){
        const suggested=result.choices[0];
        const selected=result.choices.find(choice=>choice.id===result.designId);
        if(suggested?.coin){
          const title=document.createElement('strong');title.className='batchSuggestedTitle';
          title.textContent=result.status==='manual'?'Selected from catalogue':`Suggested match${suggested.confidence!==null?` · ${suggested.confidence}%`:''}`;
          const issue=result.coinId?catalogue.find(coin=>coin.id===result.coinId):null;
          card.append(title,reference(issue||selected?.coin||suggested.coin));
        }
        const designLabel=document.createElement('label');designLabel.textContent='Design';
        const designSelect=document.createElement('select');designSelect.setAttribute('aria-label',`Coin ${crop.detectionNumber} design`);
        designSelect.add(new Option('Choose design',''));
        for(const choice of result.choices)designSelect.add(new Option(`${choice.title}${choice.confidence===null?'':` · ${choice.confidence}%`}`,choice.id));
        designSelect.value=result.designId||'';
        designSelect.onchange=()=>{result.designId=designSelect.value;result.coinId=null;result.ready=false;render(crops);};
        designLabel.append(designSelect);card.append(designLabel);
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
      if(!choices.some(choice=>choice.title===coin.title&&choice.coin.denomination_display===coin.denomination_display))choices.push(catalogueChoice(coin,Math.round(Number(match.confidence||0)*100)));
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
    busy=true;const revision=generation,queue=[...crops].filter(crop=>!results.get(crop.id)?.added&&!results.get(crop.id)?.choices?.length);
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
