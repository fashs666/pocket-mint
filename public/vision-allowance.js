/* Shared allowance presentation only. Single recognition inputs/results pass through.
   Batch responses are reused only for identical photos, phases and user clues. */
(() => {
  const nativeFetch=window.fetch.bind(window),storageKey='pm-vision-reset',cache=new Map();
  let resetAt=0,dialog=null,previousFocus=null,dismissing=false;
  const usageKey='pm-vision-usage-v1';
  const today=()=>new Date().toISOString().slice(0,10);
  function loadUsage(){
    let saved;try{saved=JSON.parse(localStorage.getItem(usageKey));}catch{}
    return saved?.day===today()?saved:{day:today(),requests:0,calls:0,measured:0,unknown:0,neurons:0,reused:0,failed:0,last:''};
  }
  function renderUsage(pop=false){
    const box=document.getElementById('visionUsage');if(!box)return;
    const u=loadUsage(),number=box.querySelector('.visionNeuronCount');
    number.textContent=u.measured?`≈ ${Math.round(u.neurons).toLocaleString()}`:'—';
    box.querySelector('.visionUsageCounts').textContent=`${u.requests} requests · ${u.calls} model calls · ${u.reused} cached results reused`;
    box.querySelector('.visionUsageCoverage').textContent=`${u.measured} calls with token usage · ${u.unknown} requests/calls without usage · ${u.failed} connection failures`;
    box.querySelector('.visionUsageLast').textContent=u.last||'The counter starts with your next photo check.';
    const reset=new Date(new Date(today()+'T00:00:00Z').getTime()+86400000).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
    box.querySelector('.visionUsageReset').textContent=`${blocked()?'Daily allowance reached. ':''}Daily counter resets ${reset}.`;
    if(pop){number.classList.remove('visionUsagePop');void number.offsetWidth;number.classList.add('visionUsagePop');}
  }
  function updateUsage(change){
    const u=loadUsage();change(u);try{localStorage.setItem(usageKey,JSON.stringify(u));}catch{}
    renderUsage(true);
  }
  function recordUsage(response){
    let info;try{info=JSON.parse(response.headers.get('x-pocket-mint-usage'));}catch{}
    updateUsage(u=>{
      if(info&&info.day===u.day&&Number.isInteger(info.calls)&&info.calls>0&&Number.isFinite(info.neurons)&&info.neurons>=0){
        u.calls+=info.calls;u.measured+=info.measured||0;u.unknown+=info.unknown||0;u.neurons+=info.neurons;
        u.last=info.measured?`Last photo check: +${info.neurons.toFixed(1)} estimated neurons${info.unknown?' · some usage unavailable':''}.`:'Last photo check: token usage unavailable.';
      }else{u.unknown++;u.last='Last photo check: token usage unavailable.';}
    });
  }
  try{resetAt=Number(localStorage.getItem(storageKey))||0;}catch{}
  function blocked(){if(resetAt<=Date.now()){resetAt=0;return false;}return true;}
  function close(fromBack=false){if(!dialog?.open)return;dialog.close();previousFocus?.focus?.();if(!fromBack&&history.state?.visionAllowance){dismissing=true;history.back();}}
  function show(){
    if(!blocked())return;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='visionAllowanceDialog';dialog.className='visionAllowanceDialog';dialog.setAttribute('aria-labelledby','visionAllowanceTitle');
      dialog.innerHTML='<article class="pm-frame pm-frame-hero"><h2 id="visionAllowanceTitle">A little pause for photos</h2><p>We’ve used today’s photo-identification allowance.</p><p class="visionResetTime"></p><p>You can still browse, edit My Mint and check crops manually. Your current photos and edits are kept.</p><button type="button">Got it</button></article>';
      dialog.querySelector('button').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});document.body.append(dialog);
    }
    const time=new Date(resetAt).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
    dialog.querySelector('.visionResetTime').textContent=`Please try again after ${time}, when the daily allowance resets.`;
    if(!dialog.open){previousFocus=document.activeElement;history.pushState({...history.state,visionAllowance:true},'',location.href);dialog.showModal();dialog.querySelector('button').focus();}
  }
  function record(){
    const now=new Date();resetAt=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
    try{localStorage.setItem(storageKey,String(resetAt));}catch{}
    window.dispatchEvent(new CustomEvent('visionallowanceexhausted'));show();
    renderUsage();
  }
  function exhaustedResponse(){return new Response(JSON.stringify({error:'Today’s photo-identification allowance is used up. Please try again after the daily reset.',diagnostic_code:'VISION-DAILY-LIMIT',reason:'allowance',angle:0,confident:false}),{status:429,headers:{'content-type':'application/json'}});}
  window.addEventListener('storage',event=>{if(event.key===storageKey)resetAt=Number(event.newValue)||0;if([storageKey,usageKey].includes(event.key))renderUsage();});
  window.addEventListener('visibilitychange',()=>renderUsage());
  window.setInterval?.(()=>{if(document.getElementById('settingsView')?.classList.contains('active'))renderUsage();},60000);
  window.addEventListener('popstate',event=>{if(dialog?.open||dismissing){if(dialog?.open)close(true);dismissing=false;event.stopImmediatePropagation();}},true);
  window.PocketMintVisionAllowance={blocked,show,usage:loadUsage,renderUsage};
  renderUsage();
  window.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
    if(url.origin!==location.origin||!['/api/identify','/api/batch-orientation','/api/photo-orientation'].includes(url.pathname))return nativeFetch(input,init);
    const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
    const batch=url.pathname==='/api/batch-orientation'||headers.get('x-pocket-mint-batch')==='1';
    let key=null;
    if(batch&&typeof init?.body==='string'&&window.crypto?.subtle){
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url.pathname+'\n'+init.body));
      key=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
      if(init.signal?.aborted)throw new DOMException('Aborted','AbortError');
      if(cache.has(key)){const entry=cache.get(key);updateUsage(u=>{u.reused++;u.last='Cached result reused · no new model call.';});return new Response(entry.text,{status:entry.status,headers:entry.headers});}
    }
    if(blocked()){show();return exhaustedResponse();}
    updateUsage(u=>{u.requests++;u.last='Photo check sent · waiting for usage…';});
    let response;try{response=await nativeFetch(input,init);}catch(error){updateUsage(u=>{u.failed++;u.unknown++;u.last='Connection failed · model usage unknown.';});throw error;}
    recordUsage(response);
    let data,text;try{text=await response.clone().text();data=JSON.parse(text);}catch{return response;}
    if(data.diagnostic_code==='VISION-DAILY-LIMIT'||url.pathname==='/api/batch-orientation'&&data.reason==='allowance')record();
    else if(key&&response.ok&&data.reason!=='unavailable'){
      if(cache.size>=64)cache.delete(cache.keys().next().value);
      cache.set(key,{text,status:response.status,headers:Array.from(response.headers.entries())});
    }
    return response;
  };
})();
