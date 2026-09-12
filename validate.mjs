import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public");
const required = ["index.html", "styles.css", "progress.css", "identify.css", "app.js", "progress.js", "identify.js", "catalogue.json", "manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png"];
for (const file of required) await access(path.join(root, file));

const [html, app, progress, identify, worker, sw, manifestText, catalogueText, rootCatalogueText] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "app.js"), "utf8"),
  readFile(path.join(root, "progress.js"), "utf8"),
  readFile(path.join(root, "identify.js"), "utf8"),
  readFile(path.resolve("src/index.js"), "utf8"),
  readFile(path.join(root, "sw.js"), "utf8"),
  readFile(path.join(root, "manifest.webmanifest"), "utf8"),
  readFile(path.join(root, "catalogue.json"), "utf8"),
  readFile(path.resolve("catalogue.json"), "utf8")
]);
const manifest = JSON.parse(manifestText);
const catalogue = JSON.parse(catalogueText);
const {default:workerDefault,rankCatalogue,assessMatches} = await import("./src/index.js");
const visualCase = (overrides={}) => ({year:null,portrait:"",design_type:"commemorative",design:null,words:[],side_confidence:{obverse:100,reverse:100},...overrides});
const qantasMatches = rankCatalogue(catalogue.coins,visualCase({year:"2020",portrait:"Queen Elizabeth II",design:"100 Years of Qantas",words:["Qantas airplane"]}));
const matildasMatches = rankCatalogue(catalogue.coins,visualCase({year:"2022",portrait:"Queen Elizabeth II",design:"series:matildas",words:["Matildas two female footballers"]}));
const sixRoosMatches = rankCatalogue(catalogue.coins,visualCase({year:"2026",portrait:"King Charles III",design_type:"standard",design:"Mob of Six Roos",words:["six kangaroos"]}));
const designOnlyResponse = await workerDefault.fetch(new Request("https://example.test/api/identify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({obverse:null,reverse:"data:image/jpeg;base64,AA=="})}),{
  AI:{run:async()=>({response:"DESIGN=100 Years of Qantas; TYPE=commemorative; WORDS=Qantas airplane; SUBJECT=aircraft; CONFIDENCE=100"})},
  ASSETS:{fetch:async()=>new Response(catalogueText,{headers:{"content-type":"application/json"}})}
});
const designOnlyPayload = await designOnlyResponse.json();
await Promise.all([...new Set(catalogue.coins.map(coin => coin.reference_image).filter(Boolean))].map(file => access(path.join(root, file))));

const checks = [
  [html.includes("PHASE 0 · V0.10.0"), "visible v0.10.0 marker"],
  [html.includes('href="progress.css"') && html.includes('src="progress.js"'), "progress assets loaded"],
  [html.includes('href="identify.css"') && html.includes('src="identify.js"') && html.includes('id="findView"') && html.includes('data-find-tab="identify"'), "combined find workspace loaded"],
  [app.includes("PocketMintPhase0"), "compatible IndexedDB name"],
  [app.includes("DB_VERSION = 3") && app.includes("identificationTests"), "compatible IndexedDB schema and test log store"],
  [app.includes("favourite"), "Favourite support"],
  [app.includes("date_added"), "automatic Date Added support"],
  [app.includes("pushState") && app.includes("popstate"), "History API navigation"],
  [progress.includes("collectionInsights") && progress.includes("multiCoinSeries"), "collection and series intelligence"],
  [progress.includes("Duplicate extras") && progress.includes("Closest to completion"), "duplicate and near-complete series summaries"],
  [identify.includes("analysePhotos") && identify.includes("/api/identify") && identify.includes("confirmIdentification"), "visual-first analysis and confirm flow"],
  [identify.includes("saveIdentificationTest") && html.includes('id="identificationTestLog"'), "identification test capture and review"],
  [worker.includes("body.obverse?") && identify.includes("Analyse design side") && designOnlyResponse.status === 200 && designOnlyPayload.matches?.[0]?.id === "AU1-2020-QANTAS", "design-side-only identification"],
  [qantasMatches.length === 1 && qantasMatches[0]?.id === "AU1-2020-QANTAS", "decisive Qantas result suppresses weak extras"],
  [matildasMatches.length === 3 && matildasMatches.every(match => match.id.includes("MATILDAS")) && assessMatches(matildasMatches,visualCase({year:"2022",design:"series:matildas"}),catalogue.coins).uncertain, "Matildas series ranks first and requests exact-design help"],
  [sixRoosMatches[0]?.id === "AU1-2026-SIX-ROOS" && !assessMatches(sixRoosMatches,visualCase({year:"2026",portrait:"King Charles III",design:"Mob of Six Roos"}),catalogue.coins).uncertain, "six-roos evidence produces a decisive match"],
  [worker.includes("env.AI.run") && worker.includes("llama-4-scout") && worker.includes("env.ASSETS.fetch"), "vision Worker and static assets binding"],
  [sw.includes("pocket-mint-phase0-v0.10.0"), "matching service-worker cache"],
  [sw.includes("./progress.css") && sw.includes("./progress.js"), "progress assets cached offline"],
  [sw.includes("./identify.css") && sw.includes("./identify.js"), "identification assets cached offline"],
  [manifest.start_url === "./#home", "manifest start route"],
  [manifest.icons?.some(icon => icon.sizes === "192x192") && manifest.icons?.some(icon => icon.sizes === "512x512"), "manifest icons"],
  [Array.isArray(catalogue.coins) && catalogue.coins.length > 0, "non-empty catalogue"],
  [new Set(catalogue.coins.map(coin => coin.id)).size === catalogue.coins.length, "unique catalogue IDs"],
  [catalogue.meta.catalogue_version === "0.3.0" && catalogue.coins.some(coin => coin.id === "AU1-2025-ROOS-KC3"), "2025 Five Kangaroos catalogue record"],
  [catalogueText === rootCatalogueText, "root and public catalogue copies match"],
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
