const IDENTIFY_VERSION = "0.6.0";
const identifyState = {obverse:null, reverse:null, results:[]};

function setIdentifyStep(step) {
  document.querySelectorAll("[data-identify-step]").forEach(item => item.classList.toggle("on", Number(item.dataset.identifyStep) <= step));
  document.getElementById("identifyPhotos").hidden = step !== 1;
  document.getElementById("identifyClues").hidden = step !== 2;
  document.getElementById("identifyMatches").hidden = step !== 3;
  if (currentView() === "identifyView") scrollTo(0, 0);
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
  const context = canvas.getContext("2d", {willReadFrequently:true});
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  const pixels = context.getImageData(0, 0, size, size).data;
  let brightness = 0, edges = 0, samples = 0;
  const lum = new Float32Array(size * size);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = .2126 * pixels[i*4] + .7152 * pixels[i*4+1] + .0722 * pixels[i*4+2];
    brightness += lum[i];
  }
  for (let y = 1; y < size; y++) for (let x = 1; x < size; x++) {
    const i = y * size + x;
    edges += Math.abs(lum[i] - lum[i-1]) + Math.abs(lum[i] - lum[i-size]);
    samples++;
  }
  brightness /= lum.length;
  const detail = edges / samples;
  const warnings = [];
  if (file.size < 70000) warnings.push("image may be too small");
  if (brightness < 45) warnings.push("photo looks too dark");
  if (brightness > 225) warnings.push("photo may have too much glare");
  if (detail < 13) warnings.push("photo may be blurry");
  return {warnings};
}

async function loadIdentifyPhoto(side, file) {
  if (!file) return;
  clearIdentifyPhoto(side);
  const url = URL.createObjectURL(file);
  try {
    identifyState[side] = {file, url, quality:await inspectIdentifyPhoto(file)};
  } catch {
    identifyState[side] = {file, url, quality:{warnings:["quality could not be checked on this device"]}};
  }
  const preview = document.querySelector(`#${side}Capture .capturePreview`);
  preview.classList.add("hasPhoto");
  preview.style.backgroundImage = `url("${url}")`;
  preview.innerHTML = `<strong>${side === "obverse" ? "Portrait side" : "Design side"}</strong><small>Tap to retake</small>`;
  renderPhotoQuality();
}

function renderPhotoQuality() {
  const photos = [["Portrait",identifyState.obverse],["Design",identifyState.reverse]].filter(([,value]) => value);
  document.getElementById("photoQuality").innerHTML = photos.map(([label,item]) => item.quality.warnings.length
    ? `<div class="qualityItem warn"><b>${label}:</b> ${esc(item.quality.warnings.join("; "))}. Consider retaking it.</div>`
    : `<div class="qualityItem"><b>${label}:</b> photo quality looks usable.</div>`).join("");
}

function identifyHaystack(coin) {
  return [coin.title, coin.series_id, coin.notes, coin.obverse_effigy, coin.privy_mark, coin.mintmark, coin.issue_type].filter(Boolean).join(" ").toLowerCase();
}

function scoreIdentifyCoin(coin, clues) {
  let score = 0, possible = 0;
  const reasons = [];
  if (clues.year) { possible += 35; if (String(coin.year) === clues.year) {score += 35; reasons.push(`year ${coin.year}`);} }
  if (clues.portrait) { possible += 18; if ((coin.obverse_effigy || "").toLowerCase().includes(clues.portrait)) {score += 18; reasons.push(clues.portrait === "charles" ? "King Charles III portrait" : "Queen Elizabeth II portrait");} }
  if (clues.type) { possible += 18; if (coin.issue_type === clues.type) {score += 18; reasons.push(clues.type === "standard" ? "five-kangaroo design" : "special design");} }
  if (clues.scope) { possible += 8; if (coin.test_scope === clues.scope) {score += 8; reasons.push(clues.scope === "circulation_core" ? "circulation issue" : "collector issue");} }
  if (clues.mark) { possible += 8; if ((clues.mark === "mintmark" && coin.mintmark) || (clues.mark === "privy" && coin.privy_mark)) {score += 8; reasons.push(`${clues.mark} recorded`);} }
  if (clues.words) {
    possible += 40;
    const words = clues.words.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const haystack = identifyHaystack(coin);
    const hits = words.filter(word => haystack.includes(word));
    if (hits.length) { score += 40 * hits.length / words.length; reasons.push(`matches “${hits.join(" ")}”`); }
  }
  return {coin, score, confidence:possible ? Math.round(100 * score / possible) : 25, reasons};
}

function readIdentifyClues() {
  return {year:document.getElementById("identifyYear").value,portrait:document.getElementById("identifyPortrait").value,type:document.getElementById("identifyType").value,words:document.getElementById("identifyWords").value.trim(),mark:document.getElementById("identifyMark").value,scope:document.getElementById("identifyScope").value};
}

function runIdentification() {
  const clues = readIdentifyClues();
  const hasStrongClue = Boolean(clues.year || clues.portrait || clues.type || clues.words || clues.mark);
  let ranked = catalogue.map(coin => scoreIdentifyCoin(coin, clues));
  ranked.sort((a,b) => b.score - a.score || b.confidence - a.confidence || Number(b.coin.year) - Number(a.coin.year) || a.coin.title.localeCompare(b.coin.title));
  if (hasStrongClue) ranked = ranked.filter(item => item.score > 0);
  identifyState.results = ranked.slice(0, 8);
  renderIdentifyResults(hasStrongClue);
  setIdentifyStep(3);
}

function renderIdentifyResults(hasStrongClue) {
  const photoCount = [identifyState.obverse,identifyState.reverse].filter(Boolean).length;
  document.getElementById("identifySummary").innerHTML = `<div class="identifyNotice"><b>${identifyState.results.length ? "Best catalogue candidates" : "No catalogue match yet"}</b><br>${photoCount ? `${photoCount} photo${photoCount === 1 ? "" : "s"} ready to attach. ` : ""}Ranking uses your clues; automatic photo comparison needs verified reference images.</div>`;
  const root = document.getElementById("identifyResults");
  if (!identifyState.results.length) { root.innerHTML = '<div class="empty">Try removing an uncertain clue or search the catalogue manually.</div>'; return; }
  root.innerHTML = identifyState.results.map((item,index) => {
    const label = !hasStrongClue ? "Browse" : item.confidence >= 75 ? `${item.confidence}% clue match` : "Possible";
    return `<article class="matchCard"><div class="matchTop"><div><div class="eyebrow">${index === 0 ? "BEST MATCH" : `CANDIDATE ${index+1}`}</div><h3>${item.coin.year} ${esc(item.coin.title)}</h3><div class="meta">${esc(item.coin.denomination_display || "$1")} · ${esc(human(item.coin.issue_type))}</div></div><span class="confidence ${item.confidence < 75 ? "possible" : ""}">${label}</span></div><p class="matchReasons">Matched: ${esc(item.reasons.length ? item.reasons.join(" · ") : "no identifying clues supplied")}</p><div class="matchActions"><button type="button" data-identify-open="${esc(item.coin.id)}">View details</button><button type="button" class="confirmMatch" data-identify-confirm="${esc(item.coin.id)}">Confirm + add</button></div></article>`;
  }).join("");
  root.querySelectorAll("[data-identify-open]").forEach(button => button.onclick = () => openCoin(catalogue.find(coin => coin.id === button.dataset.identifyOpen)));
  root.querySelectorAll("[data-identify-confirm]").forEach(button => button.onclick = () => confirmIdentification(button.dataset.identifyConfirm));
}

async function confirmIdentification(id) {
  const coin = catalogue.find(item => item.id === id);
  if (!coin) return;
  const record = state.get(id) || baseRec(id);
  await saveRec(id, {quantity:(record.quantity || 0) + 1});
  for (const side of ["obverse","reverse"]) if (identifyState[side]?.file) await addPhoto(id, identifyState[side].file);
  await loadLocal(); renderAll();
  alert(`${coin.year} ${coin.title} added to My Mint${identifyState.obverse || identifyState.reverse ? " with its photos" : ""}.`);
  resetIdentification(); navigate("myMintView");
}

function resetIdentification() {
  clearIdentifyPhoto("obverse"); clearIdentifyPhoto("reverse");
  ["identifyYear","identifyPortrait","identifyType","identifyWords","identifyMark"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("identifyScope").value = "circulation_core";
  document.getElementById("identifyObverse").value = ""; document.getElementById("identifyReverse").value = "";
  document.getElementById("photoQuality").innerHTML = ""; setIdentifyStep(1);
}

function wireIdentification() {
  [...new Set(catalogue.map(coin => coin.year))].sort((a,b) => b-a).forEach(year => document.getElementById("identifyYear").add(new Option(year,year)));
  document.getElementById("identifyObverse").onchange = async event => { await loadIdentifyPhoto("obverse",event.target.files[0]); event.target.value = ""; };
  document.getElementById("identifyReverse").onchange = async event => { await loadIdentifyPhoto("reverse",event.target.files[0]); event.target.value = ""; };
  document.getElementById("identifyToClues").onclick = () => setIdentifyStep(2);
  document.getElementById("identifySkipPhotos").onclick = () => setIdentifyStep(2);
  document.getElementById("identifyBackPhotos").onclick = () => setIdentifyStep(1);
  document.getElementById("identifyBackClues").onclick = () => setIdentifyStep(2);
  document.getElementById("identifyFind").onclick = runIdentification;
  document.getElementById("identifyReset").onclick = resetIdentification;
  document.getElementById("identifyNoMatch").onclick = () => document.getElementById("identifySummary").innerHTML = '<div class="noMatchHelp"><b>Not in this test catalogue?</b><br>Pocket Mint currently covers verified Australian $1 test records from 2020 onward. Try “Not sure / all records”, or use Search to check the catalogue directly.</div>';
}

window.addEventListener("load",wireIdentification);
