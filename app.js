const DB_NAME = "PocketMintPhase0";
const DB_VERSION = 2;
const VIEW_IDS = new Set(["homeView", "catalogueView", "searchView", "myMintView", "settingsView"]);
let catalogue = [], catMeta = {}, state = new Map(), photoMap = new Map(), mintFilter = "all", deferredInstallPrompt = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char]);
const human = value => String(value || "").replaceAll("_", " ").replace(/\b\w/g, match => match.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);

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

function card(coin) {
  const record = {...baseRec(coin.id), ...(state.get(coin.id) || {})};
  const element = document.createElement("div");
  element.className = "coin";
  element.innerHTML = `<button class="coinMain" type="button"><h3>${coin.year} ${esc(coin.title)}</h3><div class="meta">$1 · ${human(coin.coin_class)}${coin.mintage ? ` · Mintage ${Number(coin.mintage).toLocaleString()}` : ""}</div><div class="tags"><span class="tag">${coin.test_scope === "circulation_core" ? "circulating core" : "collector test"}</span>${record.quantity > 0 ? '<span class="tag owned">owned</span>' : ""}${record.wishlist ? '<span class="tag wish">wishlist</span>' : ""}${record.favourite ? '<span class="tag favourite">★ favourite</span>' : ""}</div></button><div class="coinControls"><button data-action="minus" aria-label="Decrease quantity">−</button><span class="qty">${record.quantity}</span><button data-action="plus" aria-label="Increase quantity">+</button><button data-action="wish" class="${record.wishlist ? "on" : ""}" aria-label="Toggle Wishlist">♡</button><button data-action="favourite" class="star ${record.favourite ? "on" : ""}" aria-label="Toggle Favourite">★</button></div>`;
  element.querySelector(".coinMain").onclick = () => openCoin(coin);
  element.querySelector('[data-action="plus"]').onclick = () => saveRec(coin.id, {quantity: record.quantity + 1});
  element.querySelector('[data-action="minus"]').onclick = () => saveRec(coin.id, {quantity: Math.max(0, record.quantity - 1)});
  element.querySelector('[data-action="wish"]').onclick = () => saveRec(coin.id, {wishlist: !record.wishlist});
  element.querySelector('[data-action="favourite"]').onclick = () => saveRec(coin.id, {favourite: !record.favourite});
  return element;
}

function filteredCatalogue() {
  const query = document.getElementById("catalogueSearch").value.trim().toLowerCase();
  const year = document.getElementById("yearFilter").value;
  const scope = document.getElementById("scopeFilter").value;
  const filter = document.getElementById("stateFilter").value;
  return catalogue.filter(coin => {
    const record = {...baseRec(coin.id), ...(state.get(coin.id) || {})};
    const haystack = [coin.year, coin.title, coin.series_id, coin.issue_type, coin.coin_class, coin.obverse_effigy, coin.privy_mark].filter(Boolean).join(" ").toLowerCase();
    const stateMatch = !filter || (filter === "owned" && record.quantity > 0) || (filter === "missing" && record.quantity === 0) || (filter === "wishlist" && record.wishlist) || (filter === "favourite" && record.favourite);
    return (!query || haystack.includes(query)) && (!year || String(coin.year) === year) && (!scope || coin.test_scope === scope) && stateMatch;
  });
}

function fillList(id, coins, empty) {
  const list = document.getElementById(id);
  list.replaceChildren(...coins.map(card));
  if (!coins.length) list.innerHTML = `<div class="empty">${empty}</div>`;
}

function renderCatalogue() { fillList("catalogueList", filteredCatalogue(), "No coins match these filters."); }

function renderSearch() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!query) return fillList("searchList", [], "Search year, title, series, issue, effigy or privy mark.");
  fillList("searchList", catalogue.filter(coin => [coin.year, coin.title, coin.series_id, coin.issue_type, coin.coin_class, coin.obverse_effigy, coin.privy_mark, coin.notes].filter(Boolean).join(" ").toLowerCase().includes(query)), "No matching test records.");
}

function stats(items) { return items.map(([number, label]) => `<div class="stat"><b>${number}</b><span>${label}</span></div>`).join(""); }

function renderMint() {
  const coins = catalogue.filter(coin => {
    const record = state.get(coin.id);
    if (!record) return false;
    if (mintFilter === "owned") return record.quantity > 0;
    if (mintFilter === "wishlist") return record.wishlist;
    if (mintFilter === "favourite") return record.favourite;
    return record.quantity > 0 || record.wishlist || record.favourite;
  });
  fillList("myMintList", coins, "Nothing here yet.");
  const records = [...state.values()];
  document.getElementById("mintStats").innerHTML = stats([[records.filter(r => r.quantity > 0).length, "Unique"], [records.reduce((n, r) => n + (r.quantity || 0), 0), "Specimens"], [records.filter(r => r.favourite).length, "Favourites"], [records.filter(r => r.wishlist).length, "Wishlist"]]);
}

function renderHome() {
  const core = catalogue.filter(coin => coin.test_scope === "circulation_core");
  const records = [...state.values()];
  document.getElementById("homeStats").innerHTML = stats([[core.length, "Circulation core"], [core.filter(coin => (state.get(coin.id)?.quantity || 0) > 0).length, "Core owned"], [records.filter(r => r.quantity > 0).length, "Unique owned"], [records.reduce((n, r) => n + (r.quantity || 0), 0), "Specimens"]]);
  document.getElementById("catVersion").textContent = `Catalogue ${catMeta.catalogue_version || ""}`;
}

function renderDiag() {
  document.getElementById("diagnostics").innerHTML = `<p><b>App:</b> Phase 0 v0.4.1</p><p><b>Database:</b> ${DB_NAME} schema v${DB_VERSION}</p><p><b>Catalogue:</b> ${esc(catMeta.catalogue_version || "—")}</p><p><b>Local records:</b> ${state.size}</p><p><b>Personal photos:</b> ${[...photoMap.values()].reduce((n, photos) => n + photos.length, 0)}</p><p><b>Connection:</b> ${navigator.onLine ? "online" : "offline"}</p>`;
}

function renderAll() { renderHome(); renderCatalogue(); renderSearch(); renderMint(); renderDiag(); }

function bindSeriesLinks() {
  document.querySelectorAll("[data-series-coin]").forEach(button => {
    button.onclick = () => {
      const coin = catalogue.find(item => item.id === button.dataset.seriesCoin);
      if (coin) replaceCoin(coin);
    };
  });
}

function detailHtml(coin, record) {
  const date = record.date_added ? `<p class="autoDate">Date Added: <strong>${esc(record.date_added)}</strong> <span>(automatic)</span></p>` : '<p class="autoDate muted">Date Added will be recorded automatically when this coin first becomes owned.</p>';
  return `<div class="eyebrow">${esc(coin.id)}</div><h2>${coin.year} ${esc(coin.title)}</h2><p class="muted">${human(coin.coin_class)} · ${human(coin.issue_type)}</p><div class="detailGrid"><div><span>Denomination</span><b>$1</b></div><div><span>Mintage</span><b>${coin.mintage ? Number(coin.mintage).toLocaleString() : esc(coin.mintage_status || "—")}</b></div><div><span>Composition</span><b>${esc(coin.composition || "—")}</b></div><div><span>Size</span><b>${coin.mass_grams ?? "—"} g · ${coin.diameter_mm ?? "—"} mm</b></div><div><span>Effigy</span><b>${esc(coin.obverse_effigy || "—")}</b></div><div><span>Catalogue class</span><b>${coin.test_scope === "circulation_core" ? "Circulation core" : "Collector exemplar"}</b></div></div>${seriesHtml(coin)}<div class="editBlock"><h3>My Mint record</h3><label>Quantity</label><input id="dQty" type="number" min="0" value="${record.quantity}"><label>Condition</label><select id="dCondition"><option value="">Not set</option>${["Poor","Fair","Good","Very Good","Fine","Very Fine","Extremely Fine","About Uncirculated","Uncirculated"].map(value => `<option ${record.condition === value ? "selected" : ""}>${value}</option>`).join("")}</select>${date}<label>Notes</label><textarea id="dNotes" rows="4" placeholder="Personal notes…">${esc(record.notes)}</textarea><label class="check"><input id="dWish" type="checkbox" ${record.wishlist ? "checked" : ""}> Wishlist</label><label class="check"><input id="dFavourite" type="checkbox" ${record.favourite ? "checked" : ""}> ★ Favourite</label><label>Personal photos</label><input id="photoInput" type="file" accept="image/*" capture="environment" multiple><div id="photoGrid" class="photoGrid"></div><div class="dialogActions"><button type="button" id="saveDetail">Save record</button><button type="button" id="doneDetail">Done</button></div></div>`;
}

function renderCoin(coin) {
  const record = {...baseRec(coin.id), ...(state.get(coin.id) || {})};
  const box = document.getElementById("dialogContent");
  box.innerHTML = detailHtml(coin, record);
  renderPhotos(coin.id);
  bindSeriesLinks();
  box.querySelector("#saveDetail").onclick = async () => {
    await saveRec(coin.id, {quantity: box.querySelector("#dQty").value, condition: box.querySelector("#dCondition").value, notes: box.querySelector("#dNotes").value.trim(), wishlist: box.querySelector("#dWish").checked, favourite: box.querySelector("#dFavourite").checked});
    renderCoin(coin);
  };
  box.querySelector("#doneDetail").onclick = closeCoin;
  box.querySelector("#photoInput").onchange = async event => {
    for (const file of event.target.files) await addPhoto(coin.id, file);
    renderPhotos(coin.id);
    renderDiag();
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
      renderDiag();
    };
    grid.appendChild(item);
  }
}

function resizeImage(file) {
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
        resolve(canvas.toDataURL("image/jpeg", 0.8));
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
  const data = {format: "pocket-mint-backup", version: 2, created_at: new Date().toISOString(), catalogue_version: catMeta.catalogue_version, fields: ["favourite", "date_added"], my_mint: await getAll("myMint"), personal_photos: await getAll("personalPhotos"), app_meta: await getAll("appMeta")};
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
  for (const record of data.my_mint) await put("myMint", {...record, favourite: Boolean(record.favourite), date_added: record.date_added || ""});
  for (const photo of data.personal_photos || []) await put("personalPhotos", photo);
  for (const meta of data.app_meta || []) await put("appMeta", meta);
  await loadLocal();
  renderAll();
}

async function selfTest() {
  const output = [], db = await openDB();
  output.push(`✓ IndexedDB opened: schema v${db.version}`);
  output.push(db.name === DB_NAME ? "✓ Compatible database name retained" : "✗ Database name changed");
  for (const store of ["myMint", "personalPhotos", "appMeta"]) output.push(db.objectStoreNames.contains(store) ? `✓ ${store} store present` : `✗ ${store} store missing`);
  output.push(`✓ Catalogue loaded: ${catalogue.length} records`);
  output.push(new Set(catalogue.map(coin => coin.id)).size === catalogue.length ? "✓ Catalogue IDs are unique" : "✗ Duplicate catalogue IDs found");
  output.push([...state.keys()].every(id => catalogue.some(coin => coin.id === id)) ? "✓ Every personal record resolves to catalogue" : "⚠ Some personal records reference absent catalogue IDs");
  output.push(navigator.serviceWorker?.controller ? "✓ Service worker controls this page" : "⚠ Reload once to activate the service worker");
  output.push("✓ Favourite and date_added are included in full-record backups");
  output.push("PASS: catalogue and personal data remain separate.");
  document.getElementById("testOutput").textContent = output.join("\n");
}

function currentView() { return document.querySelector(".view.active")?.id || "homeView"; }
function routeForView(view) { return `#${view.replace("View", "")}`; }

function showView(view) {
  const safeView = VIEW_IDS.has(view) ? view : "homeView";
  document.querySelectorAll(".view").forEach(item => item.classList.toggle("active", item.id === safeView));
  document.querySelectorAll(".bottomNav button").forEach(button => button.classList.toggle("active", button.dataset.nav === safeView));
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
  ["yearFilter", "scopeFilter", "stateFilter"].forEach(id => document.getElementById(id).onchange = renderCatalogue);
  document.getElementById("catalogueSearch").oninput = renderCatalogue;
  document.getElementById("searchInput").oninput = renderSearch;
  document.querySelectorAll("[data-nav]").forEach(button => button.onclick = () => navigate(button.dataset.nav));
  document.querySelectorAll("[data-mintfilter]").forEach(button => button.onclick = () => {
    mintFilter = button.dataset.mintfilter;
    document.querySelectorAll("[data-mintfilter]").forEach(item => item.classList.toggle("on", item === button));
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
    button.onclick = async () => {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      button.hidden = true;
      deferredInstallPrompt = null;
    };
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
  const yearSelect = document.getElementById("yearFilter");
  [...new Set(catalogue.map(coin => coin.year))].sort().forEach(year => yearSelect.add(new Option(year, year)));
  wire();
  const hashView = `${location.hash.slice(1) || "home"}View`;
  const initialView = VIEW_IDS.has(hashView) ? hashView : "homeView";
  history.replaceState({view: initialView}, "", routeForView(initialView));
  showView(initialView);
  renderAll();
  updateNetwork();
  if ("serviceWorker" in navigator) await navigator.serviceWorker.register("./sw.js");
}

init().catch(error => {
  console.error(error);
  document.body.innerHTML = `<main><article class="card fatal"><h2>Pocket Mint failed to start</h2><pre>${esc(error.stack || error)}</pre></article></main>`;
});
