/* Presentation only. Dynamic heading labels remain accessible; coin names and
   fixed title artwork are deliberately excluded. */
(() => {
 const ns='http://www.w3.org/2000/svg';let count=0;
 const selector='.view .sectionHead h2,.view .sectionTitle h3,.view .menuHeading,.statsAlbums>h3';
 function draw(){
  for(const heading of document.querySelectorAll(selector)){
   if(heading.querySelector('.pm-title-art'))continue;
   const label=heading.textContent.trim();if(!label)continue;
   const view=heading.closest('.view')?.id;
   const pair=['myMintView','statsView'].includes(view)?['#fffa55','#00e9e9']:['collectionView','helpView','seriesView'].includes(view)?['#00e9e9','#ff36e9']:['wishlistView','milestonesView','settingsView'].includes(view)?['#ff36e9','#00e9e9']:['#ff36e9','#ffcf42'];
   const svg=document.createElementNS(ns,'svg');svg.classList.add('pm-title-art','pm-title-live');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
   const defs=document.createElementNS(ns,'defs'),gradient=document.createElementNS(ns,'linearGradient');const id=`pm-live-title-${++count}`;
   gradient.id=id;gradient.setAttribute('x2','0');gradient.setAttribute('y2','1');
   for(const [offset,color] of [['0%','#fffaff'],['16%',pair[0]],['42%',pair[0]],['92%',pair[1]]]){const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);gradient.append(stop);}
   defs.append(gradient);svg.append(defs);
   const text=document.createElementNS(ns,'text');text.textContent=label;text.setAttribute('x','4');text.setAttribute('y','40');text.setAttribute('font-family','Pocket Mint Bubble, sans-serif');text.setAttribute('font-size','36');text.setAttribute('fill',`url(#${id})`);text.setAttribute('stroke','#080914');text.setAttribute('stroke-width','3');text.setAttribute('stroke-linejoin','round');text.setAttribute('paint-order','stroke fill');svg.append(text);
   const accessible=document.createElement('span');accessible.className='sr-only';accessible.textContent=label;
   const size=parseFloat(getComputedStyle(heading).fontSize)||28;heading.replaceChildren(accessible,svg);
   const measure=document.createElement("canvas").getContext("2d");measure.font="36px \"Pocket Mint Bubble\"";const width=Math.ceil(measure.measureText(label).width)+8;svg.setAttribute('viewBox',`0 0 ${width} 54`);svg.style.width=`${width*size/36}px`;
  }
 }
 document.fonts.ready.then(()=>{draw();new MutationObserver(changes=>{if(changes.some(change=>change.target.nodeType===1&&(change.target.matches(selector)||[...change.addedNodes].some(node=>node.nodeType===1&&(node.matches(selector)||node.querySelector(selector))))))draw();}).observe(document.body,{childList:true,subtree:true});});
})();
