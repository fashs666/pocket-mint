const IDENTIFY_VERSION = "0.6.2";
const identifyState = {obverse:null, reverse:null, results:[], resultSource:"clue"};

function setIdentifyStep(step) {
  document.querySelectorAll("[data-identify-step]").forEach(item => item.classList.toggle("on", Number(item.dataset.identifyStep) === step));
  document.getElementById("identifyPhotos").hidden = step !== 1;
  document.getElementById("identifyClues").hidden = step !== 2;
  document.getElementById("identifyMatches").hidden = step !== 3;
  if (currentView() === "identifyView") scrollTo(0,0);
}

function clearIdentifyPhoto(side) {
  const old = identifyState[side];
  if (old?.url) URL.revokeObjectURL(old.url);
  identifyState[side] = null;
  const preview = document.querySelector(`#${side}Capture .capturePreview`);
  preview.classList.remove("hasPhoto");
  preview.style.backgroundImage = "";
  preview.innerHTML = `<b>＋</b><strong>${side === "obverse" ? "Portrait side" : "Design side"}</strong><small>${side === "obverse" ? "King or Queen" : "Artwork or kangaroos"}</small>`;
}

async function inspectIdentifyPhoto(file) {
  const bitmap = await createImageBitmap(file);
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
  return {warnings};
}

async function loadIdentifyPhoto(side,file) {
  if (!file) return;
  clearIdentifyPhoto(side);
  const url=URL.createObjectURL(file);
  try { identifyState[side]={file,url,quality:await inspectIdentifyPhoto(file)}; }
  catch { identifyState[side]={file,url,quality:{warnings:["quality could not be checked on this device"]}}; }
  const preview=document.querySelector(`#${side}Capture .capturePreview`);
  preview.classList.add("hasPhoto"); preview.style.backgroundImage=`url("${url}")`;
  preview.innerHTML=`<strong>${side === "obverse" ? "Portrait side" : "Design side"}</strong><small>Tap to retake</small>`;
  renderPhotoQuality();
  const ready=Boolean(identifyState.obverse&&identifyState.reverse);
  document.getElementById("identifyAnalyse").disabled=!ready;
  document.getElementById("identifyAnalyse").textContent=ready ? "Analyse both photos" : "Add both photos to analyse";
}

function renderPhotoQuality() {
  const photos=[["Portrait",identifyState.obverse],["Design",identifyState.reverse]].filter(([,value])=>value);
  document.getElementById("photoQuality").innerHTML=photos.map(([label,item])=>item.quality.warnings.length
    ? `<div class="qualityItem warn"><b>${label}:</b> ${esc(item.quality.warnings.join("; "))}. Consider retaking it.</div>`
    : `<div class="qualityItem"><b>${label}:</b> photo quality looks usable.</div>`).join("");
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
  if (!identifyState.obverse||!identifyState.reverse) return;
  const button=document.getElementById("identifyAnalyse");
  button.disabled=true; button.textContent="Looking at your coin…"; setAnalyseStatus("Preparing the two sides for visual analysis…");
  try {
    const [obverse,reverse]=await Promise.all([makeAnalysisImage(identifyState.obverse.file),makeAnalysisImage(identifyState.reverse.file)]);
    const response=await fetch("/api/identify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({obverse,reverse})});
    const data=await response.json();
    if (!response.ok) throw new Error(data.error||"Visual analysis is unavailable");
    const matches=(data.matches||[]).map(match=>({coin:catalogue.find(coin=>coin.id===match.id),confidence:Math.round(Number(match.confidence||0)*100),reasons:Array.isArray(match.evidence)?match.evidence:[match.evidence].filter(Boolean)})).filter(item=>item.coin);
    const first=matches[0],second=matches[1];
    const decisive=first&&first.confidence>=72&&(!second||first.confidence-second.confidence>=10)&&!data.uncertain;
    if (decisive) {
      identifyState.results=matches.slice(0,5); identifyState.resultSource="visual";
      renderIdentifyResults(); setIdentifyStep(3);
    } else {
      prefillClues(data.observed||{});
      const notice=document.getElementById("identifyFallbackNotice");
      notice.hidden=false;
      notice.innerHTML=`<b>I need a little help.</b><br>${esc(data.reason||"The photos did not produce one clear match.")} I’ve filled in anything I could read.`;
      setIdentifyStep(2);
    }
  } catch(error) {
    const notice=document.getElementById("identifyFallbackNotice");
    notice.hidden=false; notice.innerHTML=`<b>Visual analysis wasn’t available.</b><br>${esc(error.message)} You can still narrow it down with visible clues.`;
    setIdentifyStep(2);
  } finally {
    button.disabled=false; button.textContent="Analyse both photos"; setAnalyseStatus("");
  }
}

function prefillClues(observed) {
  if (observed.year&&[...document.getElementById("identifyYear").options].some(option=>option.value===String(observed.year))) document.getElementById("identifyYear").value=String(observed.year);
  if (/charles/i.test(observed.portrait||"")) document.getElementById("identifyPortrait").value="charles";
  if (/elizabeth/i.test(observed.portrait||"")) document.getElementById("identifyPortrait").value="elizabeth";
  if (/kangaroo|standard/i.test(observed.design_type||"")) document.getElementById("identifyType").value="standard";
  else if (observed.design_type) document.getElementById("identifyType").value="commemorative";
  if (observed.words) document.getElementById("identifyWords").value=Array.isArray(observed.words)?observed.words.join(" "):observed.words;
}

function identifyHaystack(coin) { return [coin.title,coin.series_id,coin.notes,coin.obverse_effigy,coin.privy_mark,coin.mintmark,coin.issue_type].filter(Boolean).join(" ").toLowerCase(); }

function scoreIdentifyCoin(coin,clues) {
  let score=0,possible=0; const reasons=[];
  if (clues.year) { possible+=35; if (String(coin.year)===clues.year) {score+=35;reasons.push(`year ${coin.year}`);} }
  if (clues.portrait) { possible+=18;if ((coin.obverse_effigy||"").toLowerCase().includes(clues.portrait)) {score+=18;reasons.push(clues.portrait==="charles"?"King Charles III portrait":"Queen Elizabeth II portrait");} }
  if (clues.type) { possible+=18;if (coin.issue_type===clues.type) {score+=18;reasons.push(clues.type==="standard"?"five-kangaroo design":"special design");} }
  if (clues.scope) { possible+=8;if (coin.test_scope===clues.scope) {score+=8;reasons.push(clues.scope==="circulation_core"?"circulation issue":"collector issue");} }
  if (clues.mark) { possible+=8;if ((clues.mark==="mintmark"&&coin.mintmark)||(clues.mark==="privy"&&coin.privy_mark)) {score+=8;reasons.push(`${clues.mark} recorded`);} }
  if (clues.words) { possible+=40;const words=clues.words.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),haystack=identifyHaystack(coin),hits=words.filter(word=>haystack.includes(word));if(hits.length){score+=40*hits.length/words.length;reasons.push(`matches “${hits.join(" ")}”`);} }
  return {coin,score,confidence:possible?Math.round(100*score/possible):25,reasons};
}

function readIdentifyClues() { return {year:document.getElementById("identifyYear").value,portrait:document.getElementById("identifyPortrait").value,type:document.getElementById("identifyType").value,words:document.getElementById("identifyWords").value.trim(),mark:document.getElementById("identifyMark").value,scope:document.getElementById("identifyScope").value}; }

function runIdentification() {
  const clues=readIdentifyClues(),hasStrongClue=Boolean(clues.year||clues.portrait||clues.type||clues.words||clues.mark);
  let ranked=catalogue.map(coin=>scoreIdentifyCoin(coin,clues));
  ranked.sort((a,b)=>b.score-a.score||b.confidence-a.confidence||Number(b.coin.year)-Number(a.coin.year)||a.coin.title.localeCompare(b.coin.title));
  if(hasStrongClue) ranked=ranked.filter(item=>item.score>0);
  identifyState.results=ranked.slice(0,8); identifyState.resultSource="clue"; renderIdentifyResults(); setIdentifyStep(3);
}

function renderIdentifyResults() {
  const visual=identifyState.resultSource==="visual",photoCount=[identifyState.obverse,identifyState.reverse].filter(Boolean).length;
  document.getElementById("identifySummary").innerHTML=`<div class="identifyNotice"><b>${identifyState.results.length?visual?"Visual identification results":"Best catalogue candidates":"No catalogue match yet"}</b><br>${visual?"Pocket Mint analysed the artwork and visible text in both photos.":"Ranked using the clues supplied."}${photoCount?` ${photoCount} photos are ready to attach.`:""}</div>`;
  const root=document.getElementById("identifyResults");
  if(!identifyState.results.length){root.innerHTML='<div class="empty">Try removing an uncertain clue or search the catalogue manually.</div>';return;}
  root.innerHTML=identifyState.results.map((item,index)=>{const label=visual?`${item.confidence}% visual match`:item.confidence>=75?`${item.confidence}% clue match`:"Possible";return `<article class="matchCard"><div class="matchTop"><div><div class="eyebrow">${index===0?"BEST MATCH":`CANDIDATE ${index+1}`}</div><h3>${item.coin.year} ${esc(item.coin.title)}</h3><div class="meta">${esc(item.coin.denomination_display||"$1")} · ${esc(human(item.coin.issue_type))}</div></div><span class="confidence ${item.confidence<75?"possible":""}">${label}</span></div><p class="matchReasons">Matched: ${esc(item.reasons.length?item.reasons.join(" · "):"visual appearance")}</p><div class="matchActions"><button type="button" data-identify-open="${esc(item.coin.id)}">View details</button><button type="button" class="confirmMatch" data-identify-confirm="${esc(item.coin.id)}">Confirm + add</button></div></article>`;}).join("");
  root.querySelectorAll("[data-identify-open]").forEach(button=>button.onclick=()=>openCoin(catalogue.find(coin=>coin.id===button.dataset.identifyOpen)));
  root.querySelectorAll("[data-identify-confirm]").forEach(button=>button.onclick=()=>confirmIdentification(button.dataset.identifyConfirm));
}

async function confirmIdentification(id) {
  const coin=catalogue.find(item=>item.id===id); if(!coin)return;
  const record=state.get(id)||baseRec(id); await saveRec(id,{quantity:(record.quantity||0)+1});
  for(const side of ["obverse","reverse"])if(identifyState[side]?.file)await addPhoto(id,identifyState[side].file);
  await loadLocal();renderAll();alert(`${coin.year} ${coin.title} added to My Mint with its photos.`);resetIdentification();navigate("myMintView");
}

function resetIdentification() {
  clearIdentifyPhoto("obverse");clearIdentifyPhoto("reverse");identifyState.results=[];identifyState.resultSource="clue";
  ["identifyYear","identifyPortrait","identifyType","identifyWords","identifyMark"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("identifyScope").value="circulation_core";document.getElementById("photoQuality").innerHTML="";
  document.getElementById("identifyFallbackNotice").hidden=true;document.getElementById("identifyAnalyse").disabled=true;document.getElementById("identifyAnalyse").textContent="Add both photos to analyse";setIdentifyStep(1);
}

function wireIdentification() {
  [...new Set(catalogue.map(coin=>coin.year))].sort((a,b)=>b-a).forEach(year=>document.getElementById("identifyYear").add(new Option(year,year)));
  document.getElementById("identifyObverse").onchange=async event=>{await loadIdentifyPhoto("obverse",event.target.files[0]);event.target.value="";};
  document.getElementById("identifyReverse").onchange=async event=>{await loadIdentifyPhoto("reverse",event.target.files[0]);event.target.value="";};
  document.getElementById("identifyAnalyse").onclick=analysePhotos;
  document.getElementById("identifyNeedHelp").onclick=()=>setIdentifyStep(2);
  document.getElementById("identifyBackPhotos").onclick=()=>setIdentifyStep(1);
  document.getElementById("identifyBackClues").onclick=()=>setIdentifyStep(2);
  document.getElementById("identifyFind").onclick=runIdentification;
  document.getElementById("identifyReset").onclick=resetIdentification;
  document.getElementById("identifyNoMatch").onclick=()=>document.getElementById("identifySummary").innerHTML='<div class="noMatchHelp"><b>Not in this test catalogue?</b><br>Pocket Mint currently covers verified Australian $1 test records from 2020 onward. Try “Not sure / all records”, or use Search directly.</div>';
}

window.addEventListener("load",wireIdentification);
