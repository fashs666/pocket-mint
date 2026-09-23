const IDENTIFY_VERSION = "0.12.2";
const identifyState = {obverse:null, reverse:null, results:[], resultSource:"clue", lastObserved:null, visualAttempted:false, usedHelpStep:false, fallbackReason:"", testLogSaved:false, analysisCertain:null};

function setIdentifyStep(step) {
  document.querySelectorAll("[data-identify-step]").forEach(item => item.classList.toggle("on", Number(item.dataset.identifyStep) === step));
  document.getElementById("identifyPhotos").hidden = step !== 1;
  document.getElementById("identifyClues").hidden = step !== 2;
  document.getElementById("identifyMatches").hidden = step !== 3;
  if (currentView() === "findView") scrollTo(0,0);
}

function clearIdentifyPhoto(side) {
  const old = identifyState[side];
  if (old?.url) URL.revokeObjectURL(old.url);
  identifyState[side] = null;
  const preview = document.querySelector(`#${side}Capture .capturePreview`);
  preview.classList.remove("hasPhoto");
  preview.style.backgroundImage = "";
  preview.innerHTML = `<b>＋</b><strong>${side === "obverse" ? "Portrait side" : "Design side"}</strong><small>${side === "obverse" ? "Optional · year and portrait" : "Required · artwork and words"}</small>`;
}

async function inspectIdentifyPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const width=bitmap.width,height=bitmap.height;
  const size = 96, canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d",{willReadFrequently:true});
  context.drawImage(bitmap,0,0,size,size); bitmap.close();
  const pixels = context.getImageData(0,0,size,size).data;
  let brightness = 0, edges = 0, samples = 0;
  const lum = new Float32Array(size*size);
  for (let i=0;i<lum.length;i++) { lum[i]=.2126*pixels[i*4]+.7152*pixels[i*4+1]+.0722*pixels[i*4+2]; brightness+=lum[i]; }
  for (let y=1;y<size;y++) for (let x=1;x<size;x++) { const i=y*size+x; edges+=Math.abs(lum[i]-lum[i-1])+Math.abs(lum[i]-lum[i-size]); samples++; }
  brightness/=lum.length;
  const warnings=[];
  if (file.size<70000) warnings.push("image may be too small");
  if (brightness<45) warnings.push("photo looks too dark");
  if (brightness>225) warnings.push("photo may have too much glare");
  if (edges/samples<13) warnings.push("photo may be blurry");
  return {warnings,width,height,bytes:file.size,type:file.type||"unknown"};
}

async function prepareIdentifyPhoto(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, {resizeWidth: 1600, resizeQuality: "high"});
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Photo preparation failed")), "image/jpeg", .86));
  return new File([blob], file.name?.replace(/\.[^.]+$/, ".jpg") || "coin-photo.jpg", {type: "image/jpeg", lastModified: Date.now()});
}

async function loadIdentifyPhoto(side,file) {
  if (!file) return;
  identifyState.analysisCertain=null;
  clearIdentifyPhoto(side);
  const preview=document.querySelector(`#${side}Capture .capturePreview`);
  preview.innerHTML=`<b class="photoSpinner">◌</b><strong>Preparing photo…</strong><small>Keep Pocket Mint open</small>`;
  let prepared=file;
  try { prepared=await prepareIdentifyPhoto(file); }
  catch { /* Keep the original when this browser cannot resize it. */ }
  const url=URL.createObjectURL(prepared);
  try { identifyState[side]={file:prepared,url,quality:await inspectIdentifyPhoto(prepared)}; }
  catch { identifyState[side]={file:prepared,url,quality:{warnings:["quality could not be checked on this device"]}}; }
  preview.classList.add("hasPhoto"); preview.style.backgroundImage=`url("${url}")`;
  preview.innerHTML=`<strong>${side === "obverse" ? "Portrait side" : "Design side"}</strong><small>Tap to retake</small>`;
  renderPhotoQuality();updateAnalyseButton();
}

function renderPhotoQuality() {
  const photos=[["Portrait",identifyState.obverse],["Design",identifyState.reverse]].filter(([,value])=>value);
  document.getElementById("photoQuality").innerHTML=photos.map(([label,item])=>item.quality.warnings.length
    ? `<div class="qualityItem warn"><b>${item.quality.warnings.length>1?"Retake recommended":"May reduce accuracy"} · ${label}</b><span>${esc(item.quality.warnings.join("; "))}.</span></div>`
    : identifyState.analysisCertain===false&&label==="Design"
      ? `<div class="qualityItem warn"><b>May reduce accuracy · ${label}</b><span>Basic checks passed, but the photo did not produce a reliable identification.</span></div>`
      : identifyState.analysisCertain===true&&label==="Design"
        ? `<div class="qualityItem good"><b>Analysis-ready · ${label}</b><span>Basic checks passed and the design was recognised.</span></div>`
        : `<div class="qualityItem"><b>Basic checks passed · ${label}</b><span>Resolution, lighting and overall sharpness look usable. Coin detail is checked during identification.</span></div>`).join("");
}

function updateAnalyseButton() {
  const button=document.getElementById("identifyAnalyse"),hasDesign=Boolean(identifyState.reverse),hasPortrait=Boolean(identifyState.obverse);
  button.disabled=!hasDesign;
  button.textContent=!hasDesign?"Add the design side to analyse":hasPortrait?"Analyse both photos":"Analyse design side";
}

async function drawContained(context,file,x,y,width,height) {
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(width/bitmap.width,height/bitmap.height);
  const drawWidth=bitmap.width*scale,drawHeight=bitmap.height*scale;
  context.drawImage(bitmap,x+(width-drawWidth)/2,y+(height-drawHeight)/2,drawWidth,drawHeight);
  bitmap.close();
}

async function makeAnalysisImage(file) {
  const canvas=document.createElement("canvas"); canvas.width=1024; canvas.height=1024;
  const context=canvas.getContext("2d");
  context.fillStyle="#17211d"; context.fillRect(0,0,canvas.width,canvas.height);
  await drawContained(context,file,0,0,1024,1024);
  return canvas.toDataURL("image/jpeg",.88);
}

function setAnalyseStatus(message,isError=false) {
  const status=document.getElementById("identifyAnalyseStatus");
  status.textContent=message; status.classList.toggle("error",isError);
}

async function analysePhotos() {
  if (!identifyState.reverse) return;
  identifyState.visualAttempted=true;
  const button=document.getElementById("identifyAnalyse");
  button.disabled=true; button.textContent="Looking at your coin…"; setAnalyseStatus(identifyState.obverse?"Preparing both sides for visual analysis…":"Preparing the design side for visual analysis…");
  try {
    const [obverse,reverse]=await Promise.all([identifyState.obverse?makeAnalysisImage(identifyState.obverse.file):Promise.resolve(null),makeAnalysisImage(identifyState.reverse.file)]);
    const response=await fetch("/api/identify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({obverse,reverse})});
    const data=await response.json();
    if (!response.ok) throw new Error(data.error||"Visual analysis is unavailable");
    identifyState.lastObserved=data.observed||null;
    const matches=(data.matches||[]).map(match=>({coin:catalogue.find(coin=>coin.id===match.id),confidence:Math.round(Number(match.confidence||0)*100),reasons:Array.isArray(match.evidence)?match.evidence:[match.evidence].filter(Boolean)})).filter(item=>item.coin);
    if (matches.length&&!data.uncertain) {
      identifyState.analysisCertain=true;renderPhotoQuality();
      identifyState.results=matches.slice(0,3); identifyState.resultSource="visual";
      renderIdentifyResults(); setIdentifyStep(3);
    } else {
      identifyState.analysisCertain=false;renderPhotoQuality();
      identifyState.usedHelpStep=true;
      identifyState.fallbackReason=data.reason||"The photos did not produce one clear match.";
      prefillClues(data.observed||{});
      const notice=document.getElementById("identifyFallbackNotice");
      notice.hidden=false;
      notice.innerHTML=`<b>I need a little help.</b><br>${esc(data.reason||"The photos did not produce one clear match.")} I’ve filled in anything I could read.`;
      setIdentifyStep(2);
    }
  } catch(error) {
    identifyState.usedHelpStep=true;
    identifyState.fallbackReason=`Visual analysis unavailable: ${error.message}`;
    const notice=document.getElementById("identifyFallbackNotice");
    notice.hidden=false; notice.innerHTML=`<b>Visual analysis wasn’t available.</b><br>${esc(error.message)} You can still narrow it down with visible clues.`;
    setIdentifyStep(2);
  } finally {
    updateAnalyseButton();setAnalyseStatus("");
  }
}

function prefillClues(observed) {
  if (observed.year&&[...document.getElementById("identifyYear").options].some(option=>option.value===String(observed.year))) document.getElementById("identifyYear").value=String(observed.year);
  if (/charles/i.test(observed.portrait||"")) document.getElementById("identifyPortrait").value="charles";
  if (/elizabeth/i.test(observed.portrait||"")) document.getElementById("identifyPortrait").value="elizabeth";
  if (observed.design_type==="standard") document.getElementById("identifyType").value="standard";
  else if (observed.design_type==="commemorative") document.getElementById("identifyType").value="commemorative";
  if (observed.words) document.getElementById("identifyWords").value=Array.isArray(observed.words)?observed.words.join(" "):observed.words;
}

function identifyHaystack(coin) { return [coin.title,coin.series_id,coin.notes,coin.obverse_effigy,coin.privy_mark,coin.mintmark,coin.issue_type].filter(Boolean).join(" ").toLowerCase(); }

function identifyTerms(value) {
  const ignored=new Set(["australia","australian","coin","dollar","one","the","and","to","for","of","a","an","give","gives","help","helps","other","others","money","two","female","footballers","standard","special","design","concentric","circle","circles","kangaroo","kangaroos","roo","roos"]);
  return String(value||"").toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>1&&!ignored.has(word));
}

function scoreIdentifyCoin(coin,clues) {
  let score=0,possible=0; const reasons=[];
  let identityScore=0;
  const exactDesign=Boolean(clues.design&&(clues.design===coin.title||clues.design===`series:${coin.series_id}`));
  const sameDesign=Boolean(clues.design&&!clues.design.startsWith("series:")&&clues.design===coin.title);
  if(clues.design){possible+=100;if(exactDesign){score+=100;identityScore=100;reasons.push(clues.design.startsWith("series:")?"recognised series":"recognised design");}}
  if (clues.words) {
    possible+=70;
    const words=identifyTerms(clues.words),haystack=identifyHaystack(coin),hits=[...new Set(words.filter(word=>haystack.includes(word)))];
    const title=coin.title.toLowerCase(),series=String(coin.series_id||"").replaceAll("_"," ").toLowerCase();
    const phraseMatch=title.includes(clues.words.toLowerCase())||clues.words.toLowerCase().includes(title)||series&&words.some(word=>series.includes(word));
    const wordScore=phraseMatch?70:Math.min(65,hits.length*32);
    identityScore=Math.max(identityScore,wordScore);
    if(wordScore){score+=wordScore;reasons.push(`distinctive text “${hits.length?hits.join(" "):clues.words}"`);}
  }
  if (clues.year) { possible+=25; if (String(coin.year)===clues.year) {score+=25;reasons.push(`year ${coin.year}`);} }
  if (clues.portrait) { possible+=8;if ((coin.obverse_effigy||"").toLowerCase().includes(clues.portrait)) {score+=8;reasons.push(clues.portrait==="charles"?"King Charles III portrait":"Queen Elizabeth II portrait");} }
  if (clues.type) { possible+=6;const typeMatch=clues.type==="standard"?(coin.issue_type==="standard"||/kangaroo|roos/i.test(coin.title)):coin.issue_type==="commemorative"||coin.issue_type==="series";if(typeMatch){score+=6;reasons.push(clues.type==="standard"?"kangaroo design":"special design");} }
  if (clues.scope) { possible+=2;if (clues.scope==="circulation_core"?coin.coin_class==="circulating":coin.test_scope===clues.scope) {score+=2;reasons.push(clues.scope==="circulation_core"?"circulation issue":"collector issue");} }
  if (clues.mark) { possible+=6;if ((clues.mark==="mintmark"&&coin.mintmark)||(clues.mark==="privy"&&coin.privy_mark)) {score+=6;reasons.push(`${clues.mark} recorded`);} }
  if (clues.kangaroo_count) {
    possible+=80;
    const count=Number(clues.kangaroo_count),isSix=coin.id==="AU1-2026-SIX-ROOS",isFive=/Five Kangaroos/i.test(coin.title);
    if((count===6&&isSix)||(count===5&&isFive)){score+=80;identityScore=Math.max(identityScore,90);reasons.push(`${count} kangaroos visible`);}
    else if((count===6&&isFive)||(count===5&&isSix))score-=100;
  }
  let confidence=possible?Math.round(100*score/possible):25;
  if(exactDesign&&clues.year&&String(coin.year)===clues.year)confidence=96;
  else if(exactDesign)confidence=Math.max(confidence,sameDesign?84:82);
  else if(identityScore>=65&&clues.year&&String(coin.year)===clues.year)confidence=Math.max(confidence,92);
  else if(identityScore>=65)confidence=Math.max(confidence,82);
  return {coin,score,confidence:Math.max(0,Math.min(96,confidence)),reasons,identityScore,exactDesign};
}

function readIdentifyClues() { return {year:document.getElementById("identifyYear").value,portrait:document.getElementById("identifyPortrait").value,type:document.getElementById("identifyType").value,words:document.getElementById("identifyWords").value.trim(),mark:document.getElementById("identifyMark").value,scope:document.getElementById("identifyScope").value,design:identifyState.lastObserved?.design||"",kangaroo_count:""}; }

function rankClueCatalogue(coins,clues) {
  const hasStrongClue=Boolean(clues.year||clues.portrait||clues.words||clues.mark||clues.design||clues.kangaroo_count);
  if(!hasStrongClue)return [];
  let ranked=coins.map(coin=>scoreIdentifyCoin(coin,clues));
  ranked.sort((a,b)=>b.identityScore-a.identityScore||b.score-a.score||b.confidence-a.confidence||Number(b.coin.year)-Number(a.coin.year)||a.coin.title.localeCompare(b.coin.title));
  if(hasStrongClue)ranked=ranked.filter(item=>item.score>0);
  const words=String(clues.words||"").toLowerCase();
  const exactYearDesign=clues.year?ranked.filter(item=>String(item.coin.year)===clues.year&&(item.exactDesign||words.includes(item.coin.title.toLowerCase()))):[];
  if(exactYearDesign.length===1)return exactYearDesign;
  const exactCount=clues.kangaroo_count?ranked.filter(item=>item.reasons.some(reason=>reason.includes("kangaroos visible"))):[];
  if(exactCount.length===1)return exactCount;
  const top=ranked[0];
  return ranked.filter((item,index)=>index===0||!top||item.confidence>=55&&item.confidence>top.confidence-18&&item.score>=top.score-35).slice(0,3);
}

function runIdentification() {
  identifyState.results=rankClueCatalogue(catalogue,readIdentifyClues()); identifyState.resultSource="clue"; renderIdentifyResults(); setIdentifyStep(3);
}

function identifyCoinLabel(coin) { return `${coin.year} ${coin.title}`; }

function resetTestFeedback() {
  document.querySelectorAll('input[name="identifyOutcome"]').forEach(input=>input.checked=false);
  document.getElementById("identifyExpected").value="";
  document.getElementById("identifyExpected").placeholder="e.g. 2020 Donation Dollar";
  document.getElementById("identifyTestNote").value="";
  document.getElementById("identifyTestStatus").textContent="";
  const button=document.getElementById("saveIdentificationTest");
  button.disabled=false;button.textContent="Save test result";
  identifyState.testLogSaved=false;
}

async function saveIdentificationTest() {
  if(identifyState.testLogSaved)return;
  const outcome=document.querySelector('input[name="identifyOutcome"]:checked')?.value;
  const expectedLabel=document.getElementById("identifyExpected").value.trim();
  const status=document.getElementById("identifyTestStatus");
  if(!outcome){status.textContent="Choose how the identification performed.";status.classList.add("error");return;}
  if(!expectedLabel){status.textContent="Enter the coin you tested so the result is useful.";status.classList.add("error");return;}
  const expectedCoin=catalogue.find(coin=>identifyCoinLabel(coin).toLowerCase()===expectedLabel.toLowerCase());
  const clean=value=>value==null?null:JSON.parse(JSON.stringify(value));
  const test={
    id:crypto.randomUUID(),created_at:new Date().toISOString(),app_version:IDENTIFY_VERSION,catalogue_version:catMeta.catalogue_version||"",
    outcome,expected_label:expectedLabel,expected_coin_id:expectedCoin?.id||null,result_source:identifyState.resultSource,
    visual_attempted:identifyState.visualAttempted,used_help_step:identifyState.usedHelpStep,fallback_reason:identifyState.fallbackReason||"",
    observed:clean(identifyState.lastObserved),clues:readIdentifyClues(),
    photo_quality:{obverse:clean(identifyState.obverse?.quality)||null,reverse:clean(identifyState.reverse?.quality)||null},
    candidates:identifyState.results.map((item,index)=>({rank:index+1,coin_id:item.coin.id,year:item.coin.year,title:item.coin.title,confidence:item.confidence,reasons:[...item.reasons]})),
    note:document.getElementById("identifyTestNote").value.trim()
  };
  await put("identificationTests",test);
  identificationTests.unshift(test);
  identifyState.testLogSaved=true;
  const button=document.getElementById("saveIdentificationTest");
  button.disabled=true;button.textContent="Test result saved";
  status.classList.remove("error");status.textContent="Saved locally. You can review or export it from Settings.";
  renderAll();
}

function renderIdentifyResults() {
  const visual=identifyState.resultSource==="visual",photoCount=[identifyState.obverse,identifyState.reverse].filter(Boolean).length;
  document.getElementById("identifySummary").innerHTML=`<div class="identifyNotice"><b>${identifyState.results.length?visual?"Visual identification results":"Best catalogue candidates":"No catalogue match yet"}</b><br>${visual?`Pocket Mint analysed the visible artwork and text${photoCount===2?" across both sides":" on the design side"}.`:"Ranked using the clues supplied."}${photoCount?` ${photoCount} photo${photoCount===1?" is":"s are"} ready to attach.`:""}</div>`;
  if(!identifyState.testLogSaved){
    const expected=document.getElementById("identifyExpected");
    if(!expected.value&&identifyState.results[0]) expected.placeholder=`e.g. ${identifyCoinLabel(identifyState.results[0].coin)}`;
  }
  const root=document.getElementById("identifyResults");
  if(!identifyState.results.length){root.innerHTML='<div class="empty">Try removing an uncertain clue or search the catalogue manually.</div>';return;}
  const grouped=[];
  for(const item of identifyState.results){
    const existing=grouped.find(result=>result.coin.title===item.coin.title&&result.coin.denomination_display===item.coin.denomination_display);
    if(existing){existing.confidence=Math.max(existing.confidence,item.confidence);existing.reasons=[...new Set([...existing.reasons,...item.reasons])];}
    else grouped.push({...item,reasons:[...item.reasons]});
  }
  root.innerHTML=grouped.map((item,index)=>{
    const variants=designVariants(item.coin),multiYear=variants.length>1;
    const label=visual?`${item.confidence}% visual match`:item.confidence>=75?`${item.confidence}% clue match`:"Possible";
    const exactYear=identifyState.resultSource==="clue"?document.getElementById("identifyYear").value:"";
    const yearMatches=variants.filter(variant=>String(variant.year)===String(exactYear));
    const selected=yearMatches.length===1?yearMatches[0]:null;
    const yearPicker=multiYear?`<label class="matchYear"><span>Issue year</span><select data-identify-year>${selected?"":'<option value="">Choose issue</option>'}${variants.map(variant=>`<option value="${esc(variant.id)}" ${selected?.id===variant.id?"selected":""}>${esc(variantIssueLabel(variant,variants))}</option>`).join("")}</select></label>`:"";
    return `<article class="matchCard"><div class="matchLayout">${coinImageHtml(item.coin,{preferPersonal:false,className:"matchArtwork"})}<div><div class="matchTop"><div><div class="eyebrow">${index===0?"BEST MATCH":`CANDIDATE ${index+1}`}</div><h3>${multiYear?esc(item.coin.title):`${item.coin.year} ${esc(item.coin.title)}`}</h3><div class="meta">${esc(item.coin.denomination_display||"$1")} · ${multiYear?`${variants.length} issue years`:esc(human(item.coin.issue_type))}</div></div><span class="confidence ${item.confidence<75?"possible":""}">${label}</span></div><p class="matchReasons">Matched: ${esc(item.reasons.length?item.reasons.join(" · "):"visual appearance")}</p>${yearPicker}<div class="matchActions"><button type="button" data-identify-open="${esc(item.coin.id)}">View details</button><button type="button" class="confirmMatch" data-identify-confirm="${esc(selected?.id||item.coin.id)}" ${multiYear&&!selected?"disabled":""}>Confirm + add</button></div></div></div></article>`;
  }).join("");
  root.querySelectorAll("[data-identify-open]").forEach(button=>button.onclick=()=>openCoin(catalogue.find(coin=>coin.id===button.dataset.identifyOpen)));
  root.querySelectorAll("[data-identify-year]").forEach(select=>select.onchange=()=>{const button=select.closest(".matchCard").querySelector("[data-identify-confirm]");button.disabled=!select.value;button.dataset.identifyConfirm=select.value||button.dataset.identifyConfirm;});
  root.querySelectorAll("[data-identify-confirm]").forEach(button=>button.onclick=()=>confirmIdentification(button.dataset.identifyConfirm));
}

async function confirmIdentification(id) {
  const coin=catalogue.find(item=>item.id===id); if(!coin)return;
  const record=state.get(id)||baseRec(id); await saveRec(id,{quantity:(record.quantity||0)+1});
  for(const side of ["obverse","reverse"])if(identifyState[side]?.file)await addPhoto(id,identifyState[side].file);
  const photoCount=[identifyState.obverse,identifyState.reverse].filter(Boolean).length;
  await loadLocal();renderAll();resetIdentification();mintFilter="owned";navigate("collectionView");
  showToast("Added to My Mint",`${coin.year} ${coin.title}${photoCount?` · ${photoCount} photo${photoCount===1?"":"s"} saved`:""}`);
}

function resetIdentification() {
  clearIdentifyPhoto("obverse");clearIdentifyPhoto("reverse");identifyState.results=[];identifyState.resultSource="clue";identifyState.lastObserved=null;identifyState.visualAttempted=false;identifyState.usedHelpStep=false;identifyState.fallbackReason="";identifyState.analysisCertain=null;
  ["identifyYear","identifyPortrait","identifyType","identifyWords","identifyMark"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("identifyScope").value="circulation_core";document.getElementById("photoQuality").innerHTML="";
  document.getElementById("identifyFallbackNotice").hidden=true;updateAnalyseButton();resetTestFeedback();setIdentifyStep(1);
}

if(typeof window!=="undefined")window.PocketMintIdentifyCore={identifyTerms,scoreIdentifyCoin,rankClueCatalogue};

function openFullCatalogueFromIdentification() {
  const clues=readIdentifyClues(),observed=identifyState.lastObserved||{};
  const detectedWords=Array.isArray(observed.words)?observed.words.join(" "):"";
  const query=(clues.words||observed.design||detectedWords||"").trim();
  const year=clues.year||observed.year||"";
  document.getElementById("catalogueSearch").value=query;
  document.getElementById("scopeFilter").value="";
  document.getElementById("stateFilter").value="";
  document.getElementById("yearFilter").value=[...document.getElementById("yearFilter").options].some(option=>option.value===String(year))?String(year):"";
  const notice=document.getElementById("findCatalogueNotice");
  notice.hidden=false;
  notice.innerHTML=`<b>Searching the full catalogue.</b><br>${query||year?"I carried across the clues Pocket Mint could read. Adjust or clear them to broaden the results.":"No reliable clues were found, so every current catalogue record is shown."}`;
  showFindTab("catalogue",{focus:true});
  renderCatalogue();
  scrollTo(0,0);
}

function wireIdentification(years=[]) {
  const yearSelect=document.getElementById("identifyYear");
  yearSelect.replaceChildren(new Option("Not sure",""));
  years.forEach(year=>yearSelect.add(new Option(year,year)));
  const coinOptions=document.getElementById("identificationCoinOptions");
  coinOptions.replaceChildren(...catalogue.map(coin=>new Option(identifyCoinLabel(coin))));
  const photoInputs=[document.getElementById("identifyObverse"),document.getElementById("identifyReverse")];
  if(typeof installPlatform==="function"&&installPlatform()==="apple")photoInputs.forEach(input=>input.removeAttribute("capture"));
  document.getElementById("identifyObverse").onchange=async event=>{const file=event.target.files[0];event.target.value="";await loadIdentifyPhoto("obverse",file);};
  document.getElementById("identifyReverse").onchange=async event=>{const file=event.target.files[0];event.target.value="";await loadIdentifyPhoto("reverse",file);};
  document.getElementById("identifyAnalyse").onclick=analysePhotos;
  document.getElementById("identifyNeedHelp").onclick=()=>{identifyState.usedHelpStep=true;identifyState.fallbackReason="Visual analysis skipped by tester";setIdentifyStep(2);};
  document.getElementById("identifyBackPhotos").onclick=()=>setIdentifyStep(1);
  document.getElementById("identifyBackClues").onclick=()=>{identifyState.usedHelpStep=true;if(!identifyState.fallbackReason)identifyState.fallbackReason="Tester changed or added clues";setIdentifyStep(2);};
  document.getElementById("identifyFind").onclick=runIdentification;
  document.getElementById("identifyReset").onclick=resetIdentification;
  document.getElementById("identifyNoMatch").onclick=openFullCatalogueFromIdentification;
  document.getElementById("saveIdentificationTest").onclick=saveIdentificationTest;
  document.querySelectorAll('input[name="identifyOutcome"]').forEach(input=>input.onchange=()=>{
    const expected=document.getElementById("identifyExpected");
    if(input.value==="correct"&&input.checked&&!expected.value&&identifyState.results[0])expected.value=identifyCoinLabel(identifyState.results[0].coin);
    document.getElementById("identifyTestStatus").classList.remove("error");
  });
}
