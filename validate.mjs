import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public");
const required = ["index.html", "styles.css", "progress.css", "identify.css", "app.js", "progress.js", "identify.js", "catalogue.json", "manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png"];
for (const file of required) await access(path.join(root, file));

const [html, app, progress, identify, worker, sw, manifestText, catalogueText] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "app.js"), "utf8"),
  readFile(path.join(root, "progress.js"), "utf8"),
  readFile(path.join(root, "identify.js"), "utf8"),
  readFile(path.resolve("src/index.js"), "utf8"),
  readFile(path.join(root, "sw.js"), "utf8"),
  readFile(path.join(root, "manifest.webmanifest"), "utf8"),
  readFile(path.join(root, "catalogue.json"), "utf8")
]);
const manifest = JSON.parse(manifestText);
const catalogue = JSON.parse(catalogueText);
await Promise.all([...new Set(catalogue.coins.map(coin => coin.reference_image).filter(Boolean))].map(file => access(path.join(root, file))));

const checks = [
  [html.includes("PHASE 0 · V0.8.0"), "visible v0.8.0 marker"],
  [html.includes('href="progress.css"') && html.includes('src="progress.js"'), "progress assets loaded"],
  [html.includes('href="identify.css"') && html.includes('src="identify.js"') && html.includes('id="findView"') && html.includes('data-find-tab="identify"'), "combined find workspace loaded"],
  [app.includes("PocketMintPhase0"), "compatible IndexedDB name"],
  [app.includes("DB_VERSION = 2"), "compatible IndexedDB schema"],
  [app.includes("favourite"), "Favourite support"],
  [app.includes("date_added"), "automatic Date Added support"],
  [app.includes("pushState") && app.includes("popstate"), "History API navigation"],
  [progress.includes("collectionInsights") && progress.includes("multiCoinSeries"), "collection and series intelligence"],
  [progress.includes("Duplicate extras") && progress.includes("Closest to completion"), "duplicate and near-complete series summaries"],
  [identify.includes("analysePhotos") && identify.includes("/api/identify") && identify.includes("confirmIdentification"), "visual-first analysis and confirm flow"],
  [worker.includes("env.AI.run") && worker.includes("llama-4-scout") && worker.includes("env.ASSETS.fetch"), "vision Worker and static assets binding"],
  [sw.includes("pocket-mint-phase0-v0.8.0"), "matching service-worker cache"],
  [sw.includes("./progress.css") && sw.includes("./progress.js"), "progress assets cached offline"],
  [sw.includes("./identify.css") && sw.includes("./identify.js"), "identification assets cached offline"],
  [manifest.start_url === "./#home", "manifest start route"],
  [manifest.icons?.some(icon => icon.sizes === "192x192") && manifest.icons?.some(icon => icon.sizes === "512x512"), "manifest icons"],
  [Array.isArray(catalogue.coins) && catalogue.coins.length > 0, "non-empty catalogue"],
  [new Set(catalogue.coins.map(coin => coin.id)).size === catalogue.coins.length, "unique catalogue IDs"],
  [new Set(catalogue.coins.filter(coin => coin.series_id).map(coin => coin.series_id)).size > 0, "series data available"],
  [catalogue.coins.every(coin => coin.reference_image), "every catalogue record has reference artwork"],
  [catalogue.coins.every(coin => ["reverse", "series", "product"].includes(coin.reference_image_kind)), "reference artwork is truthfully labelled"]
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  failed ||= !ok;
}
if (failed) process.exitCode = 1;
