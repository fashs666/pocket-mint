/* Shared allowance presentation only. Single recognition inputs/results pass through.
   Batch responses are reused only for identical photos, phases and user clues. */
(() => {
  const nativeFetch=window.fetch.bind(window),storageKey='pm-vision-reset',cache=new Map();
  let resetAt=0,dialog=null,previousFocus=null;
  try{resetAt=Number(localStorage.getItem(storageKey))||0;}catch{}
  function blocked(){if(resetAt<=Date.now()){resetAt=0;return false;}return true;}
  function close(fromBack=false){if(!dialog?.open)return;dialog.close();previousFocus?.focus?.();if(!fromBack&&history.state?.visionAllowance)history.back();}
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
  }
  function exhaustedResponse(){return new Response(JSON.stringify({error:'Today’s photo-identification allowance is used up. Please try again after the daily reset.',diagnostic_code:'VISION-DAILY-LIMIT',reason:'allowance',angle:0,confident:false}),{status:429,headers:{'content-type':'application/json'}});}
  window.addEventListener('storage',event=>{if(event.key===storageKey)resetAt=Number(event.newValue)||0;});
  window.addEventListener('popstate',event=>{if(dialog?.open){close(true);event.stopImmediatePropagation();}},true);
  window.PocketMintVisionAllowance={blocked,show};
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
      if(cache.has(key)){const entry=cache.get(key);return new Response(entry.text,{status:entry.status,headers:entry.headers});}
    }
    if(blocked()){show();return exhaustedResponse();}
    const response=await nativeFetch(input,init);
    let data,text;try{text=await response.clone().text();data=JSON.parse(text);}catch{return response;}
    if(data.diagnostic_code==='VISION-DAILY-LIMIT'||url.pathname==='/api/batch-orientation'&&data.reason==='allowance')record();
    else if(key&&response.ok&&data.reason!=='unavailable'){
      if(cache.size>=64)cache.delete(cache.keys().next().value);
      cache.set(key,{text,status:response.status,headers:Array.from(response.headers.entries())});
    }
    return response;
  };
})();
