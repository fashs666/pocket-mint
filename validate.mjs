import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public");
const required = ["index.html", "styles.css", "progress.css", "identify.css", "app.js", "progress.js", "identify.js", "catalogue.json", "manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png"];
for (const file of required) await access(path.join(root, file));

const [html, app, progress, identify, sw, manifestText, catalogueText] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "app.js"), "utf8"),
  readFile(path.join(root, "progress.js"), "utf8"),
  readFile(path.join(root, "identify.js"), "utf8"),
  readFile(path.join(root, "sw.js"), "utf8"),
  readFile(path.join(root, "manifest.webmanifest"), "utf8"),
  readFile(path.join(root, "catalogue.json"), "utf8")
]);
const manifest = JSON.parse(manifestText);
const catalogue = JSON.parse(catalogueText);

const checks = [
  [html.includes("PHASE 0 · V0.6.0"), "visible v0.6.0 marker"],
  [html.includes('href="progress.css"') && html.includes('src="progress.js"'), "progress assets loaded"],
  [html.includes('href="identify.css"') && html.includes('src="identify.js"') && html.includes('id="identifyView"'), "identification assets and view loaded"],
  [app.includes("PocketMintPhase0"), "compatible IndexedDB name"],
  [app.includes("DB_VERSION = 2"), "compatible IndexedDB schema"],
  [app.includes("favourite"), "Favourite support"],
  [app.includes("date_added"), "automatic Date Added support"],
  [app.includes("pushState") && app.includes("popstate"), "History API navigation"],
  [progress.includes("collectionInsights") && progress.includes("multiCoinSeries"), "collection and series intelligence"],
  [progress.includes("Duplicate extras") && progress.includes("Closest to completion"), "duplicate and near-complete series summaries"],
  [identify.includes("inspectIdentifyPhoto") && identify.includes("scoreIdentifyCoin") && identify.includes("confirmIdentification"), "photo checks, ranking and confirm flow"],
  [sw.includes("pocket-mint-phase0-v0.6.0"), "matching service-worker cache"],
  [sw.includes("./progress.css") && sw.includes("./progress.js"), "progress assets cached offline"],
  [sw.includes("./identify.css") && sw.includes("./identify.js"), "identification assets cached offline"],
  [manifest.start_url === "./#home", "manifest start route"],
  [manifest.icons?.some(icon => icon.sizes === "192x192") && manifest.icons?.some(icon => icon.sizes === "512x512"), "manifest icons"],
  [Array.isArray(catalogue.coins) && catalogue.coins.length > 0, "non-empty catalogue"],
  [new Set(catalogue.coins.map(coin => coin.id)).size === catalogue.coins.length, "unique catalogue IDs"],
  [new Set(catalogue.coins.filter(coin => coin.series_id).map(coin => coin.series_id)).size > 0, "series data available"]
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  failed ||= !ok;
}
if (failed) process.exitCode = 1;
