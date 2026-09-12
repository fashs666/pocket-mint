const POCKET_MINT_APP_VERSION = "0.10.0";

function completionPercent(owned, total) {
  return total ? Math.round((owned / total) * 100) : 0;
}

function collectionInsights() {
  const ownedCoins = catalogue.filter(coin => (state.get(coin.id)?.quantity || 0) > 0);
  const coreCoins = catalogue.filter(coin => coin.test_scope === "circulation_core");
  const coreOwned = coreCoins.filter(coin => (state.get(coin.id)?.quantity || 0) > 0);
  const wishlist = catalogue.filter(coin => state.get(coin.id)?.wishlist);
  const favourites = catalogue.filter(coin => state.get(coin.id)?.favourite);
  const duplicates = catalogue
    .map(coin => ({coin, quantity: state.get(coin.id)?.quantity || 0}))
    .filter(item => item.quantity > 1)
    .sort((a, b) => b.quantity - a.quantity || Number(b.coin.year) - Number(a.coin.year));
  const extraDuplicates = duplicates.reduce((total, item) => total + item.quantity - 1, 0);

  return {
    ownedCoins,
    coreCoins,
    coreOwned,
    wishlist,
    favourites,
    duplicates,
    extraDuplicates,
    missing: catalogue.length - ownedCoins.length,
    overallPercent: completionPercent(ownedCoins.length, catalogue.length),
    corePercent: completionPercent(coreOwned.length, coreCoins.length)
  };
}

function multiCoinSeries() {
  const groups = new Map();
  for (const coin of catalogue) {
    if (!coin.series_id) continue;
    if (!groups.has(coin.series_id)) groups.set(coin.series_id, []);
    groups.get(coin.series_id).push(coin);
  }

  return [...groups.entries()]
    .filter(([, coins]) => coins.length > 1)
    .map(([id, coins]) => {
      const owned = coins.filter(coin => (state.get(coin.id)?.quantity || 0) > 0);
      const missing = coins.filter(coin => (state.get(coin.id)?.quantity || 0) === 0);
      return {
        id,
        coins,
        owned,
        missing,
        total: coins.length,
        ownedCount: owned.length,
        missingCount: missing.length,
        percent: completionPercent(owned.length, coins.length)
      };
    });
}

function miniProgress(label, owned, total, percent) {
  return `<div class="progressMetric"><div class="progressMetricHead"><span>${esc(label)}</span><strong>${owned} / ${total} · ${percent}%</strong></div><div class="progress"><i style="width:${percent}%"></i></div></div>`;
}

function coinInsightButton(coin, secondary) {
  return `<button type="button" class="insightRow" data-progress-coin="${esc(coin.id)}"><span><b>${coin.year} ${esc(coin.title)}</b><small>${esc(secondary)}</small></span><span aria-hidden="true">›</span></button>`;
}

function renderCollectionProgress() {
  const root = document.getElementById("collectionProgress");
  if (!root) return;

  const insight = collectionInsights();
  const duplicateRows = insight.duplicates.slice(0, 3).map(item => coinInsightButton(item.coin, `Quantity ${item.quantity} · ${item.quantity - 1} duplicate${item.quantity - 1 === 1 ? "" : "s"}`)).join("");

  root.innerHTML = `
    <div class="progressMetrics">
      ${miniProgress("Overall catalogue", insight.ownedCoins.length, catalogue.length, insight.overallPercent)}
      ${miniProgress("Circulation core", insight.coreOwned.length, insight.coreCoins.length, insight.corePercent)}
    </div>
    <div class="insightStats">
      <div><b>${insight.missing}</b><span>Missing</span></div>
      <div><b>${insight.extraDuplicates}</b><span>Duplicate extras</span></div>
      <div><b>${insight.wishlist.length}</b><span>Wishlist</span></div>
      <div><b>${insight.favourites.length}</b><span>Favourites</span></div>
    </div>
    <div class="insightActions">
      <button type="button" data-progress-filter="missing">Browse missing coins</button>
      <button type="button" data-progress-filter="wishlist">Open wishlist</button>
    </div>
    <div class="insightSection">
      <h4>Duplicates</h4>
      ${duplicateRows || '<p class="muted compact">No duplicate coins yet.</p>'}
    </div>`;
}

function renderSeriesProgress() {
  const root = document.getElementById("seriesProgress");
  if (!root) return;

  const series = multiCoinSeries();
  const completed = series.filter(item => item.ownedCount === item.total);
  const started = series.filter(item => item.ownedCount > 0 && item.ownedCount < item.total);
  const closest = [...started].sort((a, b) => a.missingCount - b.missingCount || b.percent - a.percent || a.id.localeCompare(b.id)).slice(0, 4);
  const untouched = series.filter(item => item.ownedCount === 0);

  const rows = closest.map(item => {
    const nextCoin = item.missing[0];
    return `<div class="seriesInsight"><div class="seriesInsightTop"><div><b>${esc(human(item.id))}</b><span>${item.ownedCount} / ${item.total} collected · ${item.missingCount} missing</span></div><strong>${item.percent}%</strong></div><div class="progress"><i style="width:${item.percent}%"></i></div>${nextCoin ? coinInsightButton(nextCoin, "Next missing coin in this series") : ""}</div>`;
  }).join("");

  root.innerHTML = `
    <div class="insightStats seriesStats">
      <div><b>${completed.length}</b><span>Complete</span></div>
      <div><b>${started.length}</b><span>In progress</span></div>
      <div><b>${untouched.length}</b><span>Not started</span></div>
      <div><b>${series.length}</b><span>Total series</span></div>
    </div>
    <div class="insightSection">
      <h4>${closest.length ? "Closest to completion" : "Series progress"}</h4>
      ${rows || `<p class="muted compact">${completed.length ? "Every started series is complete." : "Collect a coin from a multi-coin series to see progress here."}</p>`}
    </div>`;
}

function bindProgressActions() {
  document.querySelectorAll("[data-progress-filter]").forEach(button => {
    button.onclick = () => {
      const filter = button.dataset.progressFilter;
      const stateFilter = document.getElementById("stateFilter");
      if (stateFilter) stateFilter.value = filter;
      if (filter === "missing") {
        const scope = document.getElementById("scopeFilter");
        if (scope) scope.value = "";
      }
      renderCatalogue();
      navigate("catalogueView");
    };
  });

  document.querySelectorAll("[data-progress-coin]").forEach(button => {
    button.onclick = () => {
      const coin = catalogue.find(item => item.id === button.dataset.progressCoin);
      if (coin) openCoin(coin);
    };
  });
}

const renderHomeV041 = renderHome;
renderHome = function renderHomeV050() {
  renderHomeV041();
  renderCollectionProgress();
  renderSeriesProgress();
  bindProgressActions();
};

const renderDiagV041 = renderDiag;
renderDiag = function renderDiagV050() {
  renderDiagV041();
  const diagnostics = document.getElementById("diagnostics");
  if (diagnostics) diagnostics.innerHTML = diagnostics.innerHTML.replace("Phase 0 v0.4.1", `Phase 0 v${POCKET_MINT_APP_VERSION}`);
};

window.addEventListener("load", () => {
  if (!catalogue.length) return;
  renderHome();
  renderDiag();
});
