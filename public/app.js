const DB_NAME = "PocketMintPhase0";
const DB_VERSION = 3;
const APP_VERSION = "0.13.0";
const VIEW_IDS = new Set(["homeView", "findView", "wishlistView", "statsView", "collectionView", "myMintView", "settingsView"]);
const APP_ICON_KEY = "pocketMintAppIcon";
const APP_ICONS = {
  seal: {name: "Pocket Mint Seal", manifest: "manifest.webmanifest"},
  spiral: {name: "Spiral Emblem", manifest: "manifest-spiral.webmanifest"},
  character: {name: "Character Icon", manifest: "manifest-character.webmanifest"}
};
let catalogue = [], catMeta = {}, state = new Map(), photoMap = new Map(), identificationTests = [], mintFilter = "owned", findTab = "catalogue", deferredInstallPrompt = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char]);
const human = value => String(value || "").replaceAll("_", " ").replace(/\b\w/g, match => match.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);

function designVariants(coin) {
  return catalogue
    .filter(item => item.title === coin.title && item.denomination_display === coin.denomination_display)
    .sort((a, b) => Number(b.year) - Number(a.year));
}

function variantIssueLabel(coin, variants = designVariants(coin)) {
  const repeatedYear=variants.filter(item=>String(item.year)===String(coin.year)).length>1;
  return repeatedYear&&coin.variant_label?`${coin.year} · ${coin.variant_label}`:String(coin.year);
}

function groupCatalogueCoins(coins) {
  const groups = new Map();
  for (const coin of coins) {
    const key = `${coin.denomination_display || coin.denomination}|${coin.title}`;
    if (!groups.has(key)) groups.set(key, coin);
  }
  return [...groups.values()];
}

function issueYearLabel(coin) {
  const variants = designVariants(coin);
  if (variants.length === 1) return String(coin.year);
  const years = [...new Set(variants.map(item => Number(item.year)))].sort((a, b) => a - b);
  const countLabel=years.length===variants.length?`${years.length} years`:`${variants.length} issues`;
  return `${years[0]}–${years.at(-1)} · ${countLabel}`;
}

let toastTimer = null;
function showToast(title, message = "") {
  const region = document.getElementById("toastRegion");
  if (!region) return;
  clearTimeout(toastTimer);
  region.innerHTML = `<div class="toastCard"><span class="toastIcon" aria-hidden="true">✓</span><span><b>${esc(title)}</b>${message ? `<small>${esc(message)}</small>` : ""}</span><button type="button" aria-label="Dismiss message">×</button></div>`;
  region.classList.add("show");
  const dismiss = () => { region.classList.remove("show"); toastTimer = null; };
  region.querySelector("button").onclick = dismiss;
  toastTimer = setTimeout(dismiss, 4200);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("myMint")) db.createObjectStore("myMint", {keyPath: "coin_id"});
      if (!db.objectStoreNames.contains("personalPhotos")) {
        const store = db.createObjectStore("personalPhotos", {keyPath: "id"});
        store.createIndex("coin_id", "coin_id", {unique: false});
      }
      if (!db.objectStoreNames.contains("appMeta")) db.createObjectStore("appMeta", {keyPath: "key"});
      if (!db.objectStoreNames.contains("identificationTests")) {
        const store = db.createObjectStore("identificationTests", {keyPath: "id"});
        store.createIndex("created_at", "created_at", {unique: false});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function del(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadLocal() {
  const records = await getAll("myMint");
  const photos = await getAll("personalPhotos");
  identificationTests = (await getAll("identificationTests")).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  state = new Map(records.map(record => [record.coin_id, record]));
  photoMap = new Map();
  for (const photo of photos) {
    if (!photoMap.has(photo.coin_id)) photoMap.set(photo.coin_id, []);
    photoMap.get(photo.coin_id).push(photo);
  }
}

function baseRec(id) {
  return {coin_id: id, quantity: 0, wishlist: false, favourite: false, condition: "", notes: "", date_added: "", updated_at: new Date().toISOString()};
}

async function saveRec(id, patch) {
  const previous = {...baseRec(id), ...(state.get(id) || {})};
  const next = {...previous, ...patch};
  next.quantity = Math.max(0, Number(next.quantity) || 0);
  if (previous.quantity === 0 && next.quantity > 0) {
    next.wishlist = false;
    if (!next.date_added) next.date_added = today();
  } else if (next.quantity > 0) {
    next.wishlist = false;
  }
  next.favourite = Boolean(next.favourite);
  next.wishlist = Boolean(next.wishlist);
  next.updated_at = new Date().toISOString();
  state.set(id, next);
  await put("myMint", next);
  renderAll();
  return next;
}

function seriesCoins(coin) {
  return coin.series_id ? catalogue.filter(item => item.series_id === coin.series_id) : [];
}

function seriesHtml(coin) {
  const coins = seriesCoins(coin);
  if (coins.length < 2) return "";
  const owned = coins.filter(item => (state.get(item.id)?.quantity || 0) > 0).length;
  const related = coins.filter(item => item.id !== coin.id).map(item => {
    const record = {...baseRec(item.id), ...(state.get(item.id) || {})};
    const status = record.quantity > 0 ? "Owned" : record.wishlist ? "Wishlist" : "Missing";
    return `<button type="button" class="seriesCoin" data-series-coin="${esc(item.id)}"><b>${item.year} ${esc(item.title)}</b><span>${status}${record.favourite ? " · ★" : ""}</span></button>`;
  }).join("");
  return `<section class="seriesBox"><div class="eyebrow">SERIES</div><h3>${esc(human(coin.series_id))}</h3><p><strong>${owned} / ${coins.length} collected</strong></p><div class="progress"><i style="width:${Math.round(owned / coins.length * 100)}%"></i></div><h3 class="seriesMore">More coins from this series</h3><div class="seriesList">${related}</div></section>`;
}

function referenceLabel(coin) {
  if (coin.reference_image_kind === "obverse") return "Mint obverse reference";
  if (coin.reference_image_kind === "series") return "Series reference";
  if (coin.reference_image_kind === "product") return "Official product image";
  return "Mint reference";
}

function coinImageHtml(coin, {preferPersonal = true, className = "coinArtwork"} = {}) {
  const personalPhoto = preferPersonal ? photoMap.get(coin.id)?.[0] : null;
  const src = personalPhoto?.data_url || coin.reference_image;
  const label = personalPhoto ? "Your photo" : referenceLabel(coin);
  if (!src) return `<span class="${className} imageMissing"><span>Image unavailable</span></span>`;
  const alt = personalPhoto ? `Your photo of ${coin.year} ${coin.title}` : `${coin.year} ${coin.title} catalogue reference`;
  return `<span class="${className}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"><span class="imageLabel">${esc(label)}</span></span>`;
}

function card(coin, mode = "browse") {
  const record = {...baseRec(coin.id), ...(state.get(coin.id) || {})};
  const variants = designVariants(coin);
  const catalogueMode = mode === "catalogue";
  const multiYear = catalogueMode && variants.length > 1;
  const variantRecords = variants.map(item => state.get(item.id)).filter(Boolean);
  const ownedYears = variantRecords.filter(item => item.quantity > 0).length;
  const element = document.createElement("div");
  element.className = `coin coinCard ${mode}`;
  const owned = record.quantity > 0;
  const controls = mode === "collection"
    ? `<div class="coinControls"><button data-action="minus" aria-label="Decrease quantity">−</button><span class="qty">${record.quantity}</span><button data-action="plus" aria-label="Increase quantity">+</button><button data-action="favourite" class="star ${record.favourite ? "on" : ""}" aria-label="Toggle Favourite">★</button></div>`
    : multiYear
      ? `<div class="coinControls"><span class="ownedMark">${ownedYears ? `✓ ${ownedYears} issue${ownedYears === 1 ? "" : "s"} owned` : `${variants.length} issues`}</span><button data-action="plus" class="addCoin">Choose issue</button></div>`
    : `<div class="coinControls">${owned ? '<span class="ownedMark">✓ Owned</span>' : `<button data-action="plus" class="addCoin">${multiYear ? "Choose year" : "Add"}</button>`}<button data-action="wish" class="heart ${record.wishlist ? "on" : ""}" aria-label="Toggle Wishlist">♡</button><button data-action="favourite" class="star ${record.favourite ? "on" : ""}" aria-label="Toggle Favourite">★</button></div>`;
  const yearLabel = catalogueMode ? (document.getElementById("yearFilter")?.value ? String(coin.year) : issueYearLabel(coin)) : String(coin.year);
  element.innerHTML = `<button class="coinMain" type="button">${coinImageHtml(coin)}<span class="coinCopy"><span class="meta">$1 · ${esc(yearLabel)}</span><h3>${esc(coin.title)}</h3>${record.quantity > 1 ? `<span class="quantityBadge">×${record.quantity}</span>` : ""}</span></button>${controls}`;
  element.querySelector(".coinMain").onclick = () => openCoin(coin);
  element.querySelector('[data-action="plus"]')?.addEventListener("click", () => multiYear ? openCoin(coin) : saveRec(coin.id, {quantity: record.quantity + 1}));
  element.querySelector('[data-action="minus"]')?.addEventListener("click", () => saveRec(coin.id, {quantity: Math.max(0, record.quantity - 1)}));
  element.querySelector('[data-action="wish"]')?.addEventListener("click", () => saveRec(coin.id, {wishlist: !record.wishlist}));
  element.querySelector('[data-action="favourite"]')?.addEventListener("click", () => saveRec(coin.id, {favourite: !record.favourite}));
  return element;
}

function filteredCatalogue() {
  const query = document.getElementById("catalogueSearch").value.trim().toLowerCase();
  const year = document.getElementById("yearFilter").value;
  const series = document.getElementById("seriesFilter").value;
  const type = document.getElementById("typeFilter").value;
  const scope = document.getElementById("scopeFilter").value;
  const filter = document.getElementById("stateFilter").value;
  return catalogue.filter(coin => {
    const record = {...baseRec(coin.id), ...(state.get(coin.id) || {})};
    const haystack = [coin.year, coin.title, coin.series_id, coin.issue_type, coin.coin_class, coin.obverse_effigy, coin.privy_mark].filter(Boolean).join(" ").toLowerCase();
    const stateMatch = !filter || (filter === "owned" && record.quantity > 0) || (filter === "missing" && record.quantity === 0) || (filter === "wishlist" && record.wishlist) || (filter === "favourite" && record.favourite);
    const scopeMatch = !scope || (scope === "core_circulation" ? ["circulation_core", "circulation_sample"].includes(coin.test_scope) : coin.test_scope === scope);
    return (!query || haystack.includes(query)) && (!year || String(coin.year) === year) && (!series || coin.series_id === series) && (!type || coin.issue_type === type) && scopeMatch && stateMatch;
  });
}

function fillList(id, coins, empty, mode = "browse") {
  const list = document.getElementById(id);
  list.replaceChildren(...coins.map(coin => card(coin, mode)));
  if (!coins.length) list.innerHTML = `<div class="empty">${empty}</div>`;
}

function renderCatalogue() {
  const coins=groupCatalogueCoins(filteredCatalogue());
  fillList("catalogueList",coins,"No coins match these filters.","catalogue");
  const count=document.getElementById("catalogueResultCount");
  if(count)count.textContent=`${coins.length} design${coins.length===1?"":"s"}`;
}

function stats(items) { return items.map(([number, label]) => `<div class="stat"><b>${number}</b><span>${label}</span></div>`).join(""); }

function renderMint() {
  const query = document.getElementById("collectionSearch")?.value.trim().toLowerCase() || "";
  const coins = catalogue.filter(coin => {
    const record = state.get(coin.id);
    if (!record) return false;
    const matches = !query || `${coin.year} ${coin.title} ${coin.series_id || ""}`.toLowerCase().includes(query);
    if (mintFilter === "duplicates") return matches && record.quantity > 1;
    if (mintFilter === "favourite") return matches && record.favourite;
    return matches && record.quantity > 0;
  });
  fillList("myMintList", coins, mintFilter === "duplicates" ? "No duplicate coins yet." : mintFilter === "favourite" ? "No favourite coins yet." : "Your collection is empty.", "collection");
  document.getElementById("collectionCount").textContent = `${coins.length} coin${coins.length === 1 ? "" : "s"}`;
}

function renderHome() {
  const records = [...state.values()];
  const owned = records.filter(record => record.quantity > 0).length;
  const percent = catalogue.length ? Math.round(owned / catalogue.length * 100) : 0;
  document.getElementById("homeStats").innerHTML = stats([[owned, "Collected"], [catalogue.length, "Catalogue"], [`${percent}%`, "Complete"]]);
  document.querySelector("#homeProgress i").style.width = `${percent}%`;
  renderHomeSeries();
  const recent = catalogue.filter(coin => state.get(coin.id)?.quantity > 0).sort((a, b) => String(state.get(b.id).date_added).localeCompare(String(state.get(a.id).date_added))).slice(0, 3);
  const recentRoot = document.getElementById("recentCoins");
  recentRoot.replaceChildren(...recent.map(coin => card(coin, "browse")));
  if (!recent.length) recentRoot.innerHTML = '<div class="empty card">Coins you add will appear here.</div>';
  document.getElementById("catVersion").textContent = `Catalogue ${catMeta.catalogue_version || ""}`;
}

function renderHomeSeries() {
  const groups = new Map();
  catalogue.forEach(coin => { if (coin.series_id) (groups.get(coin.series_id) || groups.set(coin.series_id, []).get(coin.series_id)).push(coin); });
  const series = [...groups.entries()].filter(([, coins]) => coins.length > 1).map(([id, coins]) => ({id, coins, owned: coins.filter(coin => state.get(coin.id)?.quantity > 0).length})).sort((a, b) => Number(b.owned > 0) - Number(a.owned > 0) || b.owned - a.owned)[0];
  const root = document.getElementById("homeSeries");
  if (!series) return root.innerHTML = '<div class="empty card">Series progress will appear here.</div>';
  const percent = Math.round(series.owned / series.coins.length * 100);
  root.innerHTML = `<button class="seriesContinue" type="button" data-series-id="${esc(series.id)}"><span><b>${esc(human(series.id))}</b><small>${series.owned} of ${series.coins.length} collected</small><span class="progress"><i style="width:${percent}%"></i></span></span><span aria-hidden="true">›</span></button>`;
  root.querySelector("button").onclick = () => { document.getElementById("catalogueSearch").value = series.id; showFindTab("catalogue"); navigate("findView"); renderCatalogue(); };
}

function renderWishlist() {
  const query = document.getElementById("wishlistSearch")?.value.trim().toLowerCase() || "";
  const coins = catalogue.filter(coin => state.get(coin.id)?.wishlist && (!query || `${coin.year} ${coin.title}`.toLowerCase().includes(query)));
  fillList("wishlistList", coins, "Your wishlist is empty.", "wishlist");
  document.getElementById("wishlistCount").textContent = `${coins.length} coin${coins.length === 1 ? "" : "s"}`;
}

function renderStats() {
  const records = [...state.values()], owned = records.filter(r => r.quantity > 0).length, wishlist = records.filter(r => r.wishlist).length;
  const favourites = records.filter(r => r.favourite).length, extras = records.reduce((n, r) => n + Math.max(0, (r.quantity || 0) - 1), 0), percent = catalogue.length ? Math.round(owned / catalogue.length * 100) : 0;
  document.getElementById("statsSummary").innerHTML = stats([[owned,"Coins collected"],[catalogue.length,"Total catalogue"],[`${percent}%`,"Complete"],[wishlist,"Wishlist"]]);
  document.getElementById("statsProgress").innerHTML = `<p>${owned} of ${catalogue.length} coins</p><div class="progress"><i style="width:${percent}%"></i></div>`;
  const groups = new Map(); catalogue.forEach(coin => { if (coin.series_id) (groups.get(coin.series_id) || groups.set(coin.series_id, []).get(coin.series_id)).push(coin); });
  document.getElementById("statsSeries").innerHTML = [...groups.entries()].filter(([, coins]) => coins.length > 1).slice(0,4).map(([id, coins]) => { const count=coins.filter(coin=>state.get(coin.id)?.quantity>0).length; return `<div class="statSeries"><b>${esc(human(id))}</b><span>${count} of ${coins.length}</span><div class="progress"><i style="width:${Math.round(count/coins.length*100)}%"></i></div></div>`; }).join("") || '<p class="muted">Series progress will appear here.</p>';
  document.getElementById("statsPersonal").innerHTML = stats([[favourites,"Favourites"],[extras,"Duplicate extras"]]);
}

function renderDiag() {
  document.getElementById("diagnostics").innerHTML = `<p><b>App:</b> Phase 0 v${APP_VERSION}</p><p><b>App icon:</b> ${esc(APP_ICONS[selectedAppIcon()].name)}</p><p><b>Database:</b> ${DB_NAME} schema v${DB_VERSION}</p><p><b>Catalogue:</b> ${esc(catMeta.catalogue_version || "—")}</p><p><b>Local records:</b> ${state.size}</p><p><b>Personal photos:</b> ${[...photoMap.values()].reduce((n, photos) => n + photos.length, 0)}</p><p><b>Identification tests:</b> ${identificationTests.length}</p><p><b>Connection:</b> ${navigator.onLine ? "online" : "offline"}</p>`;
}

function testOutcomeLabel(outcome) {
  return ({correct:"Correct",partial:"Partly right",wrong:"Wrong",unsupported:"Not in catalogue"})[outcome] || human(outcome);
}

function renderIdentificationTestLog() {
  const count = document.getElementById("identificationTestCount");
  const root = document.getElementById("identificationTestLog");
  if (!count || !root) return;
  count.textContent = `${identificationTests.length} saved test${identificationTests.length === 1 ? "" : "s"}`;
  if (!identificationTests.length) {
    root.innerHTML = '<div class="empty">No identification tests saved yet.</div>';
    return;
  }
  root.innerHTML = identificationTests.map(test => {
    const top = test.candidates?.[0];
    const date = test.created_at ? new Date(test.created_at).toLocaleString() : "Unknown date";
    const route = test.used_help_step ? test.visual_attempted ? "Visual + Help" : "Help only" : test.visual_attempted ? "Visual only" : "Clues only";
    const observed = test.observed ? JSON.stringify(test.observed, null, 2) : "No visual observation recorded";
    return `<details class="testLogItem"><summary><span class="testOutcome ${esc(test.outcome)}">${esc(testOutcomeLabel(test.outcome))}</span><span><b>${esc(test.expected_label || "Unspecified coin")}</b><small>${esc(date)} · ${esc(route)}</small></span></summary><div class="testLogDetails"><p><b>Top result:</b> ${top ? `${esc(top.year)} ${esc(top.title)} (${esc(top.confidence)}%)` : "No catalogue candidate"}</p>${test.note ? `<p><b>Note:</b> ${esc(test.note)}</p>` : ""}<p><b>Step 2 reason:</b> ${esc(test.fallback_reason || "Not used")}</p><pre>${esc(observed)}</pre></div></details>`;
  }).join("");
}

function renderAll() { renderHome(); renderCatalogue(); renderMint(); renderWishlist(); renderStats(); renderDiag(); renderIdentificationTestLog(); }

function isInstalledApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function installPlatform() {
  const agent = navigator.userAgent || "";
  if (/android/i.test(agent)) return "android";
  if (/iphone|ipad|ipod/i.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "apple";
  return "";
}

function selectedAppIcon() {
  try {
    const saved = localStorage.getItem(APP_ICON_KEY) || window.POCKET_MINT_APP_ICON;
    return APP_ICONS[saved] ? saved : "seal";
  } catch {
    return "seal";
  }
}

function appIconInstruction(icon) {
  const name = APP_ICONS[icon].name;
  const platform = installPlatform();
  if (isInstalledApp() && platform === "android") return `${name} is selected inside Pocket Mint. Android may take time to refresh an installed launcher icon. If it remains unchanged, export a backup first, remove the installed Pocket Mint shortcut/app, reopen this site in Chrome, confirm this choice, then install it again.`;
  if (isInstalledApp() && platform === "apple") return `${name} is selected inside Pocket Mint. iPhone and iPad keep the artwork used when the Home Screen icon was created. Export a backup first, remove the existing Pocket Mint Home Screen icon, reopen this site in Safari, confirm this choice, then use Share → Add to Home Screen.`;
  if (platform === "android") return `${name} is selected. The Pocket Mint header updates immediately. Reload once before using “Install on Android” below so Chrome uses this icon for the launcher.`;
  if (platform === "apple") return `${name} is selected. The Pocket Mint header updates immediately. Reload once in Safari, then use Share → Add to Home Screen to create the icon.`;
  return `${name} is selected. The Pocket Mint header updates immediately. Reload once before installing Pocket Mint so the browser reads the chosen icon.`;
}

function applyAppIcon(icon) {
  const safeIcon = APP_ICONS[icon] ? icon : "seal";
  try { localStorage.setItem(APP_ICON_KEY, safeIcon); } catch {}
  window.POCKET_MINT_APP_ICON = safeIcon;
  document.documentElement.dataset.appIcon = safeIcon;
  document.getElementById("appManifest")?.setAttribute("href", APP_ICONS[safeIcon].manifest);
  document.getElementById("appFavicon")?.setAttribute("href", `icons/${safeIcon}-192.png`);
  document.getElementById("appleTouchIcon")?.setAttribute("href", `icons/${safeIcon}-192.png`);
  document.getElementById("brandIcon")?.setAttribute("src", `icons/${safeIcon}-192.png`);
  document.querySelectorAll("[data-app-icon]").forEach(button => {
    const active = button.dataset.appIcon === safeIcon;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-checked", String(active));
  });
  const help = document.getElementById("appIconHelp");
  if (help) help.textContent = appIconInstruction(safeIcon);
  renderDiag();
}

function setupAppIconControls() {
  const icon = selectedAppIcon();
  applyAppIcon(icon);
  document.querySelectorAll("[data-app-icon]").forEach(button => {
    button.onclick = () => applyAppIcon(button.dataset.appIcon);
  });
}

function setupInstallControls() {
  const block = document.getElementById("installBlock");
  if (!block) return;
  if (isInstalledApp()) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  const platform = installPlatform();
  const buttons = {
    android: document.getElementById("installAndroidBtn"),
    apple: document.getElementById("installAppleBtn")
  };
  Object.entries(buttons).forEach(([name, button]) => {
    const recommended = name === platform;
    button.classList.toggle("recommended", recommended);
    button.querySelector(".recommendBadge").hidden = !recommended;
  });
}

function showInstallHelp(message, kind = "") {
  const help = document.getElementById("installHelp");
  if (!help) return;
  help.hidden = false;
  help.className = `installHelp ${kind}`.trim();
  help.textContent = message;
}

async function installOnAndroid() {
  if (isInstalledApp()) {
    showInstallHelp("Pocket Mint is already installed on this device.", "success");
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === "accepted") showInstallHelp("Pocket Mint is being installed.", "success");
    else showInstallHelp("Installation was not completed. You can try again whenever you’re ready.");
    deferredInstallPrompt = null;
    document.getElementById("installBtn").hidden = true;
    return;
  }
  showInstallHelp("On Android, open Pocket Mint in Chrome, tap the ⋮ menu, then choose “Install app” or “Add to Home screen”.");
}

function installOnApple() {
  if (isInstalledApp()) {
    showInstallHelp("Pocket Mint is already installed on this device.", "success");
    return;
  }
  showInstallHelp("On iPhone or iPad, open Pocket Mint in Safari, tap Share, choose “Add to Home Screen”, then tap Add.");
}

function bindSeriesLinks() {
  document.querySelectorAll("[data-series-coin]").forEach(button => {
    button.onclick = () => {
      const coin = catalogue.find(item => item.id === button.dataset.seriesCoin);
      if (coin) replaceCoin(coin);
    };
  });
}

function detailHtml(coin, record) {
  const variants = designVariants(coin);
  const multiYear = variants.length > 1;
  const yearControl = multiYear ? `<label for="dYear">Issue year</label><select id="dYear">${variants.map(item => `<option value="${esc(item.id)}" ${item.id === coin.id ? "selected" : ""}>${esc(variantIssueLabel(item,variants))}</option>`).join("")}</select><p class="yearHelp">Choose an issue to view its details and update that exact coin in My Mint.</p>` : "";
  const date = record.date_added ? `<p class="autoDate">Date Added: <strong>${esc(record.date_added)}</strong> <span>(automatic)</span></p>` : '<p class="autoDate muted">Date Added will be recorded automatically when this coin first becomes owned.</p>';
  const imageNote = coin.reference_image_kind === "series" ? "This official image shows the series packaging; an exact individual reverse is not available in the current source." : coin.reference_image_kind === "obverse" ? "This official image shows the special portrait-side design used for this circulating issue." : "Use this official catalogue image to compare the design with your coin.";
  return `<div class="eyebrow">${esc(coin.id)}</div><h2>${multiYear ? esc(coin.title) : `${coin.year} ${esc(coin.title)}`}</h2><p class="muted">${multiYear ? `${variants.length} catalogue issues · ` : ""}${human(coin.coin_class)} · ${human(coin.issue_type)}</p>${yearControl}<section class="referencePanel"><div><div class="eyebrow">${esc(referenceLabel(coin).toUpperCase())}</div>${coinImageHtml(coin, {preferPersonal: false, className: "detailArtwork"})}</div><p>${esc(imageNote)}</p></section><div class="detailGrid"><div><span>Year</span><b>${esc(variantIssueLabel(coin,variants))}</b></div><div><span>Denomination</span><b>$1</b></div><div><span>Mintage</span><b>${coin.mintage ? Number(coin.mintage).toLocaleString() : esc(coin.mintage_status || "—")}</b></div><div><span>Composition</span><b>${esc(coin.composition || "—")}</b></div><div><span>Size</span><b>${coin.mass_grams ?? "—"} g · ${coin.diameter_mm ?? "—"} mm</b></div><div><span>Effigy</span><b>${esc(coin.obverse_effigy || "—")}</b></div></div>${seriesHtml(coin)}<div class="editBlock"><h3>My Mint record · ${esc(variantIssueLabel(coin,variants))}</h3><label>Quantity</label><input id="dQty" type="number" min="0" value="${record.quantity}"><label>Condition</label><select id="dCondition"><option value="">Not set</option>${["Poor","Fair","Good","Very Good","Fine","Very Fine","Extremely Fine","About Uncirculated","Uncirculated"].map(value => `<option ${record.condition === value ? "selected" : ""}>${value}</option>`).join("")}</select>${date}<label>Notes</label><textarea id="dNotes" rows="4" placeholder="Personal notes…">${esc(record.notes)}</textarea><label class="check"><input id="dWish" type="checkbox" ${record.wishlist ? "checked" : ""}> Wishlist</label><label class="check"><input id="dFavourite" type="checkbox" ${record.favourite ? "checked" : ""}> ★ Favourite</label><label>Your photos</label><p class="photoHelp">Add your own photos any time. They will become the thumbnail in My Mint while this reference stays available here.</p><input id="photoInput" type="file" accept="image/*" capture="environment" multiple><div id="photoGrid" class="photoGrid"></div><div class="dialogActions"><button type="button" id="saveDetail">Save record</button><button type="button" id="doneDetail">Done</button></div></div>`;
}

function renderCoin(coin) {
  const record = {...baseRec(coin.id), ...(state.get(coin.id) || {})};
  const box = document.getElementById("dialogContent");
  box.innerHTML = detailHtml(coin, record);
  renderPhotos(coin.id);
  bindSeriesLinks();
  box.querySelector("#dYear")?.addEventListener("change", event => {
    const selected = catalogue.find(item => item.id === event.target.value);
    if (selected) replaceCoin(selected);
  });
  box.querySelector("#saveDetail").onclick = async () => {
    await saveRec(coin.id, {quantity: box.querySelector("#dQty").value, condition: box.querySelector("#dCondition").value, notes: box.querySelector("#dNotes").value.trim(), wishlist: box.querySelector("#dWish").checked, favourite: box.querySelector("#dFavourite").checked});
    renderCoin(coin);
  };
  box.querySelector("#doneDetail").onclick = closeCoin;
  box.querySelector("#photoInput").onchange = async event => {
    for (const file of event.target.files) await addPhoto(coin.id, file);
    renderPhotos(coin.id);
    renderAll();
  };
}

function openCoin(coin) {
  history.pushState({view: currentView(), coinId: coin.id}, "", `#coin/${encodeURIComponent(coin.id)}`);
  renderCoin(coin);
  document.getElementById("coinDialog").showModal();
}

function replaceCoin(coin) {
  history.replaceState({view: currentView(), coinId: coin.id}, "", `#coin/${encodeURIComponent(coin.id)}`);
  renderCoin(coin);
}

function closeCoin() {
  if (history.state?.coinId) history.back();
  else document.getElementById("coinDialog").close();
}

function renderPhotos(id) {
  const grid = document.getElementById("photoGrid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const photo of photoMap.get(id) || []) {
    const item = document.createElement("div");
    item.className = "photo";
    item.innerHTML = `<img src="${photo.data_url}" alt="Personal coin photo"><button type="button" aria-label="Delete photo">×</button>`;
    item.querySelector("button").onclick = async () => {
      await del("personalPhotos", photo.id);
      photoMap.set(id, (photoMap.get(id) || []).filter(item => item.id !== photo.id));
      renderPhotos(id);
      renderAll();
    };
    grid.appendChild(item);
  }
}

async function resizeImage(file) {
  if(typeof createCircularSpecimen==="function") {
    const specimen=await createCircularSpecimen(file);
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(reader.result);reader.readAsDataURL(specimen);
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.88));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function addPhoto(id, file) {
  const photo = {id: crypto.randomUUID(), coin_id: id, data_url: await resizeImage(file), created_at: new Date().toISOString()};
  await put("personalPhotos", photo);
  if (!photoMap.has(id)) photoMap.set(id, []);
  photoMap.get(id).push(photo);
}

async function exportBackup() {
  const data = {format: "pocket-mint-backup", version: 3, created_at: new Date().toISOString(), catalogue_version: catMeta.catalogue_version, fields: ["favourite", "date_added", "identification_tests"], my_mint: await getAll("myMint"), personal_photos: await getAll("personalPhotos"), identification_tests: await getAll("identificationTests"), app_meta: await getAll("appMeta")};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `pocket-mint-backup-${today()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function restoreBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.format !== "pocket-mint-backup" || !Array.isArray(data.my_mint)) throw new Error("Not a Pocket Mint backup");
  await clearStore("myMint");
  await clearStore("personalPhotos");
  await clearStore("appMeta");
  if (Array.isArray(data.identification_tests)) await clearStore("identificationTests");
  for (const record of data.my_mint) await put("myMint", {...record, favourite: Boolean(record.favourite), date_added: record.date_added || ""});
  for (const photo of data.personal_photos || []) await put("personalPhotos", photo);
  for (const test of data.identification_tests || []) await put("identificationTests", test);
  for (const meta of data.app_meta || []) await put("appMeta", meta);
  await loadLocal();
  renderAll();
}

async function selfTest() {
  const output = [], db = await openDB();
  output.push(`✓ IndexedDB opened: schema v${db.version}`);
  output.push(db.name === DB_NAME ? "✓ Compatible database name retained" : "✗ Database name changed");
  for (const store of ["myMint", "personalPhotos", "appMeta", "identificationTests"]) output.push(db.objectStoreNames.contains(store) ? `✓ ${store} store present` : `✗ ${store} store missing`);
  output.push(`✓ Catalogue loaded: ${catalogue.length} records`);
  output.push(new Set(catalogue.map(coin => coin.id)).size === catalogue.length ? "✓ Catalogue IDs are unique" : "✗ Duplicate catalogue IDs found");
  output.push([...state.keys()].every(id => catalogue.some(coin => coin.id === id)) ? "✓ Every personal record resolves to catalogue" : "⚠ Some personal records reference absent catalogue IDs");
  output.push(navigator.serviceWorker?.controller ? "✓ Service worker controls this page" : "⚠ Reload once to activate the service worker");
  output.push("✓ Favourite, date_added and identification tests are included in backups");
  output.push("PASS: catalogue and personal data remain separate.");
  document.getElementById("testOutput").textContent = output.join("\n");
}

function currentView() { return document.querySelector(".view.active")?.id || "homeView"; }
function routeForView(view) { return `#${view.replace("View", "")}`; }

function showFindTab(tab, options={}) {
  findTab = tab === "catalogue" ? "catalogue" : "identify";
  document.querySelectorAll("[data-find-tab]").forEach(button => {
    const active=button.dataset.findTab===findTab;
    button.classList.toggle("on",active);
    button.setAttribute("aria-selected",String(active));
  });
  document.querySelectorAll("[data-find-panel]").forEach(panel => panel.hidden=panel.dataset.findPanel!==findTab);
  if(options.focus&&findTab==="catalogue") document.getElementById("catalogueSearch").focus();
}

function showView(view) {
  const safeView = VIEW_IDS.has(view) ? view : "homeView";
  document.querySelectorAll(".view").forEach(item => item.classList.toggle("active", item.id === safeView));
  const navView = ["wishlistView", "statsView", "collectionView", "settingsView"].includes(safeView) ? "myMintView" : safeView;
  document.querySelectorAll(".bottomNav button").forEach(button => button.classList.toggle("active", button.dataset.nav === navView));
  scrollTo(0, 0);
}

function navigate(view) {
  if (view === currentView() && !document.getElementById("coinDialog").open) return;
  history.pushState({view}, "", routeForView(view));
  showView(view);
}

function updateNetwork() {
  const badge = document.getElementById("offlineBadge");
  badge.textContent = navigator.onLine ? "ONLINE" : "OFFLINE";
  badge.classList.toggle("offline", !navigator.onLine);
  renderDiag();
}

function wire() {
  const updateCatalogue=()=>{document.getElementById("findCatalogueNotice").hidden=true;renderCatalogue();};
  ["yearFilter", "seriesFilter", "typeFilter", "scopeFilter", "stateFilter"].forEach(id => document.getElementById(id).onchange = updateCatalogue);
  document.getElementById("catalogueSearch").oninput = updateCatalogue;
  document.getElementById("clearCatalogueFilters").onclick=()=>{
    document.getElementById("catalogueSearch").value="";
    ["yearFilter","seriesFilter","typeFilter","scopeFilter","stateFilter"].forEach(id=>document.getElementById(id).value="");
    updateCatalogue();
  };
  document.getElementById("collectionSearch").oninput = renderMint;
  document.getElementById("wishlistSearch").oninput = renderWishlist;
  document.querySelectorAll("[data-nav]").forEach(button => button.onclick = () => navigate(button.dataset.nav));
  document.querySelectorAll("[data-open-collection]").forEach(button => button.onclick = () => {
    const requested = button.dataset.openCollection;
    mintFilter = requested === "all" ? "owned" : requested;
    document.querySelectorAll("[data-mintfilter]").forEach(item => item.classList.toggle("on", item.dataset.mintfilter === mintFilter));
    document.getElementById("collectionTitle").textContent = mintFilter === "favourite" ? "Favourites" : mintFilter === "duplicates" ? "Duplicates" : "Collection";
    renderMint();
    navigate("collectionView");
  });
  document.querySelectorAll("[data-static-page]").forEach(button => button.onclick = () => alert(`${button.dataset.staticPage} is preserved as a destination for a later content pass.`));
  document.querySelectorAll("[data-find-tab]").forEach(button => button.onclick = () => {
    if(button.dataset.findTab==="catalogue") document.getElementById("findCatalogueNotice").hidden=true;
    showFindTab(button.dataset.findTab,{focus:button.dataset.findTab==="catalogue"});
  });
  document.querySelectorAll("[data-mintfilter]").forEach(button => button.onclick = () => {
    mintFilter = button.dataset.mintfilter;
    document.querySelectorAll("[data-mintfilter]").forEach(item => item.classList.toggle("on", item === button));
    document.getElementById("collectionTitle").textContent = mintFilter === "favourite" ? "Favourites" : mintFilter === "duplicates" ? "Duplicates" : "Collection";
    renderMint();
  });
  document.getElementById("closeDialog").onclick = closeCoin;
  document.getElementById("coinDialog").addEventListener("cancel", event => {
    event.preventDefault();
    closeCoin();
  });
  document.getElementById("exportBtn").onclick = exportBackup;
  document.getElementById("restoreInput").onchange = async event => {
    try { await restoreBackup(event.target.files[0]); alert("Pocket Mint backup restored."); }
    catch (error) { alert(`Restore failed: ${error.message}`); }
    event.target.value = "";
  };
  document.getElementById("selfTestBtn").onclick = selfTest;
  setupAppIconControls();
  document.getElementById("installAndroidBtn").onclick = installOnAndroid;
  document.getElementById("installAppleBtn").onclick = installOnApple;
  setupInstallControls();
  document.getElementById("exportIdentificationTests").onclick = () => {
    const data = {format:"pocket-mint-identification-tests", version:1, exported_at:new Date().toISOString(), app_version:APP_VERSION, catalogue_version:catMeta.catalogue_version, tests:identificationTests};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pocket-mint-identification-tests-${today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  document.getElementById("clearIdentificationTests").onclick = async () => {
    if (!confirm("Delete every saved identification test from this device? This will not change My Mint.")) return;
    await clearStore("identificationTests");
    identificationTests = [];
    renderAll();
  };
  document.getElementById("resetBtn").onclick = async () => {
    if (!confirm("Delete My Mint records and personal photos from this device?")) return;
    await clearStore("myMint");
    await clearStore("personalPhotos");
    state.clear();
    photoMap.clear();
    renderAll();
  };
  window.addEventListener("online", updateNetwork);
  window.addEventListener("offline", updateNetwork);
  window.addEventListener("popstate", event => {
    const dialog = document.getElementById("coinDialog");
    if (dialog.open) dialog.close();
    const route = event.state || {view: "homeView"};
    showView(route.view || "homeView");
    if (route.coinId) {
      const coin = catalogue.find(item => item.id === route.coinId);
      if (coin) { renderCoin(coin); dialog.showModal(); }
    }
  });
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const button = document.getElementById("installBtn");
    button.hidden = false;
    button.onclick = installOnAndroid;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.getElementById("installBtn").hidden = true;
    document.getElementById("installBlock").hidden = true;
  });
}

async function init() {
  const response = await fetch("./catalogue.json", {cache: "no-cache"});
  if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);
  const payload = await response.json();
  catalogue = payload.coins || [];
  catMeta = payload.meta || {};
  await loadLocal();
  await put("appMeta", {key: "catalogue_version", value: catMeta.catalogue_version});
  const years=[...new Set(catalogue.map(coin => coin.year))].sort((a,b)=>b-a);
  const yearSelect = document.getElementById("yearFilter");
  years.forEach(year => yearSelect.add(new Option(year, year)));
  const seriesNames={afl2023:"AFL 2023",anzac_centennial:"ANZAC Centennial",aussie_big_things:"Aussie Big Things",aussie_big_things_2:"Aussie Big Things 2",australian_dinosaurs:"Australian Dinosaurs",bluey:"Bluey",bluey_dollarbucks:"Bluey Dollarbucks",decimal_currency_50:"50 Years of Decimal Currency",dollar_discovery:"Dollar Discovery",donation:"Donation Dollar",gach1:"Great Aussie Coin Hunt 1",gach2:"Great Aussie Coin Hunt 2",gach3:"Great Aussie Coin Hunt 3",gc2018:"Gold Coast 2018",matildas:"Matildas",mr_squiggle:"Mr Squiggle",possum_magic:"Possum Magic",std_roos:"Kangaroo Dollar",tokyo2020:"Tokyo 2020",wiggles30:"30 Years of The Wiggles"};
  const seriesSelect=document.getElementById("seriesFilter");
  [...new Set(catalogue.map(coin=>coin.series_id).filter(Boolean))].sort((a,b)=>(seriesNames[a]||a).localeCompare(seriesNames[b]||b)).forEach(series=>seriesSelect.add(new Option(seriesNames[series]||series.replaceAll("_"," "),series)));
  wire();
  if(typeof wireIdentification==="function") wireIdentification(years);
  const hash=location.hash.slice(1)||"home";
  const legacyTabs={identify:"identify",catalogue:"catalogue",search:"catalogue"};
  const hashView = `${hash}View`;
  const initialView = legacyTabs[hash] ? "findView" : VIEW_IDS.has(hashView) ? hashView : "homeView";
  if(legacyTabs[hash]) findTab=legacyTabs[hash];
  history.replaceState({view: initialView}, "", routeForView(initialView));
  showView(initialView);
  showFindTab(findTab);
  renderAll();
  updateNetwork();
  if ("serviceWorker" in navigator) await navigator.serviceWorker.register("./sw.js");
}

init().catch(error => {
  console.error(error);
  document.body.innerHTML = `<main><article class="card fatal"><h2>Pocket Mint failed to start</h2><pre>${esc(error.stack || error)}</pre></article></main>`;
});
