/* One reference/selection surface. Does not analyse images or save collection records. */
(function () {
  const data=window.PocketMintConditionData;
  let dialog, options={}, grade='VF', denomination='', comparing=false, pair=['VF','EF'], returnFocus;
  let swipeStart=null;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const info=code=>data.grades.find(g=>g.grade===code)||data.grades[3];
  const gradeOptions=selected=>data.grades.map(g=>`<option value="${g.grade}" ${g.grade===selected?'selected':''}>${g.grade} — ${g.name}</option>`).join('');
  function remember(){try{sessionStorage.setItem('pocketMintConditionGrade',grade);}catch{}}
  function referenceArea(code) {
    return `<div class="cg-reference" data-reference="${code}"><div class="cg-photo-missing"><span aria-hidden="true">⌕</span><b>Photographic reference being prepared</b><p>No verified ${escape(code)} photograph is available yet. Use the written guide below.</p><a class="cg-example-link" href="${data.referenceSources[code].url}" target="_blank" rel="noopener">View ANDA’s ${escape(code)} photo examples</a><small class="cg-example-online">Opens the official PDF online</small></div></div>`;
  }
  function fillReferences() {
    dialog.querySelectorAll('[data-reference]').forEach(area=>{
      const code=area.dataset.reference;
      const candidates=data.referenceCandidates(code,denomination,options.designId);
      function load(index) {
        const ref=candidates[index]; if(!ref) return;
        const img=new Image(); img.alt=`${info(code).name} photographic example`;
        img.onload=()=>{
          area.replaceChildren(img);
          (ref.callouts||[]).slice(0,3).forEach(point=>{
            if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!point.label)return;
            const label=document.createElement('span'); label.className='cg-callout';
            label.style.left=`${Math.max(12,Math.min(88,point.x))}%`;label.style.top=`${Math.max(8,Math.min(92,point.y))}%`;
            label.textContent=point.label;area.append(label);
          });
          const note=document.createElement('small');note.className='cg-credit';note.textContent=`${ref.denomination?'Denomination reference':'General Australian reference'} · ${ref.source} · ${ref.rightsNote}`;area.append(note);
          const card=area.closest('[data-grade-card]');
          if(ref.description)card.querySelector('.cg-description').textContent=ref.description;
          if(Array.isArray(ref.lookFor)&&ref.lookFor.length)card.querySelector('.cg-look').replaceChildren(...ref.lookFor.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
        };
        img.onerror=()=>load(index+1);img.src=ref.image;
      }
      load(0);
    });
  }
  function card(code) {
    const g=info(code);
    return `<article class="cg-card pm-cream-card" data-grade-card="${code}">${referenceArea(code)}<div class="cg-grade-name"><strong>${g.grade}</strong><h3>${g.name}</h3></div><p class="cg-description">${g.description}</p><h4>What to look for</h4><ul class="cg-look">${g.lookFor.map(p=>`<li>${p}</li>`).join('')}</ul></article>`;
  }
  function draw() {
    const index=data.grades.findIndex(g=>g.grade===grade);
    const denomOptions=`<option value="">Australian coin grading</option>`+data.denominations.map(([id,label])=>`<option value="${id}" ${id===denomination?'selected':''}>${label} coins</option>`).join('');
    dialog.innerHTML=`<div class="cg-shell"><header class="cg-header"><div><span class="eyebrow">A CLOSER LOOK</span><h2 id="cg-title">Coin Condition Guide</h2><label class="cg-context"><span class="sr-only">Reference denomination</span><select id="cg-denomination">${denomOptions}</select></label></div><button type="button" class="cg-close" aria-label="Close Condition Guide">×</button></header>
      <div class="cg-body"><p class="cg-estimate">Your own estimate, using Australian adjectival grades. No certification.</p>
      ${comparing?`<div class="cg-compare-heading"><h3 id="cg-compare-title">Compare conditions</h3><button type="button" id="cg-back">Back to guide</button></div><div class="cg-comparison" aria-labelledby="cg-compare-title">${pair.map((code,i)=>`<section><label for="cg-side-${i}">${i?'Right':'Left'} condition</label><select id="cg-side-${i}">${gradeOptions(code)}</select>${card(code)}${options.onSelect?`<button type="button" class="cg-side-use" data-use-side="${code}">Use ${code} condition</button>`:''}</section>`).join('')}</div><p class="cg-comparison-hint">Compare the high points and remaining detail on both sides. From UNC upwards, compare strike, contact marks and original lustre: all must be unworn.</p>`:
      `<div class="cg-strip" role="tablist" aria-label="Condition grades">${data.grades.map(g=>`<button type="button" role="tab" id="cg-tab-${g.grade}" aria-controls="cg-panel" aria-selected="${g.grade===grade}" tabindex="${g.grade===grade?0:-1}" data-grade="${g.grade}">${g.grade}</button>`).join('')}</div><div id="cg-panel" role="tabpanel" aria-labelledby="cg-tab-${grade}" tabindex="0">${card(grade)}</div><div class="cg-prev-next"><button type="button" id="cg-prev" ${index===0?'disabled':''} aria-label="Previous grade">‹ ${data.grades[index-1]?.grade||''}</button><span aria-live="polite">${grade} · ${index+1} of 9</span><button type="button" id="cg-next" ${index===8?'disabled':''} aria-label="Next grade">${data.grades[index+1]?.grade||''} ›</button></div><button type="button" id="cg-compare">Compare conditions</button>`}
      <details class="cg-basics pm-cream-card"><summary>Look at the whole coin</summary><p>Check both sides, lettering and rim in good light. Wear flattens raised detail; a weak strike may leave detail incomplete from the start. Shine alone is not original mint lustre. Record cleaning, damage and toning separately. Marks also matter when distinguishing UNC, CHU and GEM.</p><a href="${data.source}" target="_blank" rel="noopener">ANDA grading guide</a></details></div>
      ${options.onSelect&&!comparing?`<footer class="cg-footer"><button type="button" id="cg-use">Use ${grade} condition</button><small>Returned to your editor. Save the record to keep it.</small></footer>`:''}</div>`;
    dialog.querySelector('.cg-close').onclick=close;
    dialog.querySelector('#cg-denomination').onchange=e=>{denomination=e.target.value;draw();dialog.querySelector('#cg-denomination').focus();};
    dialog.querySelectorAll('[data-grade]').forEach(btn=>btn.onclick=()=>select(btn.dataset.grade));
    dialog.querySelector('#cg-prev')?.addEventListener('click',()=>step(-1));
    dialog.querySelector('#cg-next')?.addEventListener('click',()=>step(1));
    dialog.querySelector('#cg-compare')?.addEventListener('click',()=>{
      pair=index===8?['CHU','GEM']:[grade,data.grades[index+1].grade];comparing=true;
      history.pushState({...history.state,conditionGuide:true,conditionCompare:true},'');draw();dialog.querySelector('#cg-back').focus();
    });
    dialog.querySelector('#cg-back')?.addEventListener('click',()=>history.back());
    pair.forEach((_,i)=>dialog.querySelector(`#cg-side-${i}`)?.addEventListener('change',e=>{pair[i]=e.target.value;draw();dialog.querySelector(`#cg-side-${i}`).focus();}));
    dialog.querySelector('#cg-use')?.addEventListener('click',()=>{options.onSelect(grade);close();});
    dialog.querySelectorAll('[data-use-side]').forEach(button=>button.onclick=()=>{grade=button.dataset.useSide;remember();options.onSelect(grade);close();});
    dialog.querySelector('.cg-strip')?.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      select(e.key==='Home'?'G':e.key==='End'?'GEM':data.grades[Math.max(0,Math.min(8,index+(e.key==='ArrowRight'?1:-1)))].grade);
    });
    const panel=dialog.querySelector('#cg-panel');
    panel?.addEventListener('touchstart',e=>{swipeStart={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
    panel?.addEventListener('touchend',e=>{if(!swipeStart)return;const dx=e.changedTouches[0].clientX-swipeStart.x,dy=e.changedTouches[0].clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);},{passive:true});
    fillReferences();
    dialog.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function select(code){grade=info(code).grade;remember();draw();dialog.querySelector(`[data-grade="${grade}"]`)?.focus({preventScroll:true});}
  function step(delta){select(data.grades[Math.max(0,Math.min(8,data.grades.findIndex(g=>g.grade===grade)+delta))].grade);}
  function close(){if(!dialog?.open)return;history.go(comparing?-2:-1);}
  function dismiss(){dialog.close();comparing=false;document.body.classList.remove('condition-guide-open');returnFocus?.focus({preventScroll:true});}
  function open(config={}) {
    if(dialog?.open)return;
    options=config;returnFocus=document.activeElement;denomination=config.denomination||'';comparing=false;
    let remembered;try{remembered=sessionStorage.getItem('pocketMintConditionGrade');}catch{}
    grade=info(config.grade||remembered||'VF').grade;
    if(!dialog){dialog=document.createElement('dialog');dialog.id='conditionGuide';dialog.className='condition-guide';dialog.setAttribute('aria-labelledby','cg-title');document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();if(comparing)history.back();else close();});}
    history.pushState({...history.state,conditionGuide:true,conditionCompare:false},'');draw();dialog.showModal();dialog.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});document.body.classList.add('condition-guide-open');dialog.querySelector('.cg-close').focus();
  }
  // Called before the app's route handler so underlying editor DOM survives overlay Back.
  function handleHistory(event) {
    if(!dialog?.open)return false;
    if(event.state?.conditionGuide){comparing=Boolean(event.state.conditionCompare);draw();dialog.querySelector(comparing?'#cg-back':'.cg-close').focus();}
    else dismiss();
    return true;
  }
  window.PocketMintConditionGuide={open,handleHistory};
})();
