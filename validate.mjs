import { readFile, access } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve("public");
const required = ["index.html", "styles.css", "progress.css", "identify.css", "app.js", "progress.js", "identify.js", "catalogue.json", "manifest.webmanifest", "manifest-seal.webmanifest", "manifest-spiral.webmanifest", "manifest-character.webmanifest", "sw.js", "icon-192.png", "icon-512.png", "icons/seal-192.png", "icons/seal-512.png", "icons/spiral-192.png", "icons/spiral-512.png", "icons/character-192.png", "icons/character-512.png"];
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
const {default:workerDefault,parseObservations,rankCatalogue,assessMatches} = await import("./src/index.js");
const identifySandbox={window:{}};
vm.runInNewContext(identify,identifySandbox);
const identifyCore=identifySandbox.window.PocketMintIdentifyCore;
const visualCase = (overrides={}) => ({year:null,portrait:"",design_type:"commemorative",design:null,words:[],side_confidence:{obverse:100,reverse:100},...overrides});
const qantasMatches = rankCatalogue(catalogue.coins,visualCase({year:"2020",portrait:"Queen Elizabeth II",design:"100 Years of Qantas",words:["Qantas airplane"]}));
const outbackMatches = rankCatalogue(catalogue.coins,visualCase({year:"2002",portrait:"Queen Elizabeth II",design:"Year of the Outback",words:["OUTBACK Southern Cross"]}));
const sixRoosMatches = rankCatalogue(catalogue.coins,visualCase({year:"2026",portrait:"King Charles III",design_type:"standard",design:"Mob of Six Roos",words:["six kangaroos"]}));
const discoveryMatches = rankCatalogue(catalogue.coins,visualCase({year:"2019",portrait:"Queen Elizabeth II",design:"Dollar Discovery S",words:["35 letter S"]}));
const discoveryLetterOnlyMatches = rankCatalogue(catalogue.coins,visualCase({year:"2019",portrait:"Queen Elizabeth II",words:["35 letter U"]}));
const anzacMatches = rankCatalogue(catalogue.coins,visualCase({year:"2014",portrait:"Queen Elizabeth II",design:"ANZAC Centenary",words:["ANZAC"]}));
const anzacDesignOnlyMatches = rankCatalogue(catalogue.coins,visualCase({design:"ANZAC Centenary",words:["ANZAC"]}));
const countedSixRoosMatches = rankCatalogue(catalogue.coins,visualCase({design_type:"unknown",words:["DOLLAR kangaroos"],kangaroo_count:6}));
const invalidTypeObservation = parseObservations("", "DESIGN=unknown; TYPE=standard or commemorative or unknown; WORDS=DOLLAR kangaroos; SUBJECT=kangaroos; KANGAROOS=unknown; CONFIDENCE=80", catalogue.coins);
const olderYearObservation = parseObservations("YEAR=1986; PORTRAIT=Queen Elizabeth II; CONFIDENCE=90", "DESIGN=International Year of Peace; TYPE=commemorative; WORDS=PEACE; SUBJECT=dove; KANGAROOS=unknown; CONFIDENCE=90", catalogue.coins);
const donation2020Clues=identifyCore.rankClueCatalogue(catalogue.coins,{year:"2020",portrait:"",type:"commemorative",words:"Give to help concentric circles",mark:"",scope:"circulation_core",design:"Donation Dollar",kangaroo_count:""});
const donation2021Clues=identifyCore.rankClueCatalogue(catalogue.coins,{year:"2021",portrait:"",type:"commemorative",words:"Money to help others concentric circles",mark:"",scope:"circulation_core",design:"Donation Dollar",kangaroo_count:""});
const manualDonation2021Clues=identifyCore.rankClueCatalogue(catalogue.coins,{year:"2021",portrait:"",type:"commemorative",words:"Donation Dollar Money to help others",mark:"",scope:"circulation_core",design:"",kangaroo_count:""});
const sixRoosClues=identifyCore.rankClueCatalogue(catalogue.coins,{year:"",portrait:"",type:"standard",words:"DOLLAR kangaroos",mark:"",scope:"circulation_core",design:"",kangaroo_count:"6"});
const genericRoosClues=identifyCore.rankClueCatalogue(catalogue.coins,{year:"",portrait:"",type:"",words:"DOLLAR kangaroos",mark:"",scope:"circulation_core",design:"",kangaroo_count:""});
const emptyClues=identifyCore.rankClueCatalogue(catalogue.coins,{year:"",portrait:"",type:"",words:"",mark:"",scope:"circulation_core",design:"",kangaroo_count:""});
const designOnlyResponse = await workerDefault.fetch(new Request("https://example.test/api/identify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({obverse:null,reverse:"data:image/jpeg;base64,AA=="})}),{
  AI:{run:async(_model,input)=>{
    if(input.image!=="data:image/jpeg;base64,AA=="||typeof input.messages?.[1]?.content!=="string")throw new Error("expected direct image input");
    return {response:"DESIGN=100 Years of Qantas; TYPE=commemorative; WORDS=Qantas airplane; SUBJECT=aircraft; CONFIDENCE=100"};
  }},
  ASSETS:{fetch:async()=>new Response(catalogueText,{headers:{"content-type":"application/json"}})}
});
const designOnlyPayload = await designOnlyResponse.json();
const quotaResponse=await workerDefault.fetch(new Request("https://example.test/api/identify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({obverse:null,reverse:"data:image/jpeg;base64,AA=="})}),{
  AI:{run:async()=>{throw new Error("4006: you have used up your daily free allocation of 10,000 neurons");}},
  ASSETS:{fetch:async()=>new Response(catalogueText,{headers:{"content-type":"application/json"}})}
});
const quotaPayload=await quotaResponse.json();
const identifyMock=async responseText=>{
  const response=await workerDefault.fetch(new Request("https://example.test/api/identify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({obverse:null,reverse:"data:image/jpeg;base64,AA=="})}),{
    AI:{run:async()=>({response:responseText})},
    ASSETS:{fetch:async()=>new Response(catalogueText,{headers:{"content-type":"application/json"}})}
  });
  return {status:response.status,payload:await response.json()};
};
const donationVisual=await identifyMock("DESIGN=Donation Dollar; TYPE=commemorative; WORDS=GIVE TO HELP OTHERS; SUBJECT=concentric circles; KANGAROOS=unknown; CONFIDENCE=100");
const sixRoosVisual=await identifyMock("DESIGN=unknown; TYPE=standard; WORDS=DOLLAR; SUBJECT=kangaroos; KANGAROOS=6; CONFIDENCE=80");
const misleadingRoosMatches=rankCatalogue(catalogue.coins,visualCase({year:"2023",portrait:"King Charles III",design_type:"standard",words:["DOLLAR kangaroos"],kangaroo_count:5}));
const misleadingRoosAssessment=assessMatches(misleadingRoosMatches,visualCase({year:"2023",portrait:"King Charles III",design_type:"standard",words:["DOLLAR kangaroos"],kangaroo_count:5}),catalogue.coins);
const partnerSeriesCases=[
  ["afl2023","AU1-2023-AFL2023-COLLINGWOOD","AFL — Collingwood"],
  ["aussie_big_things","AU1-2023-AUSSIE_BIG_THINGS-BANANA","Aussie Big Things — The Big Banana"],
  ["australian_dinosaurs","AU1-2022-AUSTRALIAN_DINOSAURS-AUSTRALOVENATOR","Australian Dinosaurs — Australovenator"],
  ["bluey_dollarbucks","AU1-2024-BLUEY_DOLLARBUCKS-BLUEY","Bluey Dollarbucks — Bluey"],
  ["gach1","AU1-2019-GACH1-O","Great Aussie Coin Hunt 1 — O for Outback"],
  ["gach2","AU1-2021-GACH2-A","Great Aussie Coin Hunt 2 — A for Akubra"],
  ["gach3","AU1-2022-GACH3-T","Great Aussie Coin Hunt 3 — T for Tasmanian Devil"],
  ["gc2018","AU1-2018-GC2018-DIVING","Gold Coast 2018 — Diving"],
  ["matildas","AU1-2023-MATILDAS-KEEPER","Matildas — Keeper"],
  ["mr_squiggle","AU1-2019-MR_SQUIGGLE-ROCKET","Mr Squiggle on a Rocket"],
  ["possum_magic","AU1-2017-POSSUM_MAGIC-INVISIBLE","Possum Magic — Hush Invisible"],
  ["tokyo2020","AU1-2020-TOKYO2020-COURAGE","Tokyo 2020 Olympic Team — Courage"],
  ["wiggles30","AU1-2021-WIGGLES30-ORIGINAL","30 Years of The Wiggles — Anthony, Jeff, Murray & Greg"]
];
const partnerSeriesResults=partnerSeriesCases.map(([series,id,title])=>{
  const observation=parseObservations("",`DESIGN=${title}; TYPE=commemorative; WORDS=${title}; SUBJECT=series artwork; KANGAROOS=unknown; CONFIDENCE=95`,catalogue.coins);
  return {series,id,match:rankCatalogue(catalogue.coins,observation)[0]?.id};
});
let referenceVisionCalls=0;
const referenceCompareResponse=await workerDefault.fetch(new Request("https://example.test/api/identify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({obverse:null,reverse:"data:image/jpeg;base64,AA=="})}),{
  AI:{run:async(_model,input)=>{
    referenceVisionCalls+=1;
    if(referenceVisionCalls===1) return {response:"DESIGN=unknown; TYPE=commemorative; WORDS=Bluey Dollarbucks; SUBJECT=cartoon dog; KANGAROOS=unknown; CONFIDENCE=78"};
    const images=input.messages[1].content.filter(part=>part.type==="image_url");
    if(images.length!==3) throw new Error("expected photographed coin and two official references");
    return {response:"MATCH=AU1-2024-BLUEY_DOLLARBUCKS-BLUEY; CONFIDENCE=97; REASON=character and pose match"};
  }},
  REFERENCE_FETCH:async()=>new Response(Uint8Array.from([255,216,255,217]),{headers:{"content-type":"image/jpeg"}}),
  ENABLE_REFERENCE_COMPARISON:"true",
  ASSETS:{fetch:async()=>new Response(catalogueText,{headers:{"content-type":"application/json"}})}
});
const referenceComparePayload=await referenceCompareResponse.json();
await Promise.all([...new Set(catalogue.coins.map(coin => coin.reference_image).filter(Boolean))].map(file => /^https:\/\/www\.ramint\.gov\.au\//.test(file) ? Promise.resolve() : access(path.join(root, file))));

const checks = [
  [app.includes('APP_VERSION = "0.12.2"') && identify.includes('IDENTIFY_VERSION = "0.12.2"') && html.includes("Pocket Mint v0.12.2"), "v0.12.2 vision and catalogue version"],
  [(html.match(/<nav class="bottomNav"[\s\S]*?<\/nav>/)?.[0].match(/data-nav=/g) || []).length === 3, "three-item primary navigation"],
  [html.includes('<button data-nav="wishlistView"><span>♡</span><b>Wishlist</b>') && html.includes('<button data-nav="statsView"><span>▥</span><b>Stats</b>'), "Wishlist and Stats grouped inside My Mint"],
  [html.includes('data-open-collection="owned"') && html.includes("Your collection"), "Collection grouped under My Mint"],
  [html.includes('href="progress.css"') && html.includes('src="progress.js"'), "progress assets loaded"],
  [html.includes('href="identify.css"') && html.includes('src="identify.js"') && html.includes('id="findView"') && html.includes('data-find-tab="identify"'), "combined find workspace loaded"],
  [app.includes("PocketMintPhase0"), "compatible IndexedDB name"],
  [app.includes("DB_VERSION = 3") && app.includes("identificationTests"), "compatible IndexedDB schema and test log store"],
  [app.includes("favourite"), "Favourite support"],
  [app.includes("date_added"), "automatic Date Added support"],
  [app.includes("pushState") && app.includes("popstate"), "History API navigation"],
  [html.includes('id="installAndroidBtn"') && html.includes('id="installAppleBtn"') && html.includes('id="installHelp"'), "Android and Apple installation controls"],
  [app.includes("beforeinstallprompt") && app.includes("installOnAndroid") && app.includes("Add to Home Screen") && app.includes("open Pocket Mint in Safari"), "platform-appropriate installation flows"],
  [app.includes("installPlatform") && app.includes("setupInstallControls") && app.includes('document.getElementById("installBlock").hidden = true'), "device recommendation and installed-app hiding"],
  [html.includes("Recommended for this device") && html.includes('id="installBlock"'), "device recommendation presentation"],
  [html.includes('data-app-icon="seal"') && html.includes('data-app-icon="spiral"') && html.includes('data-app-icon="character"'), "three Settings app-icon choices"],
  [app.includes("setupAppIconControls") && app.includes("pocketMintAppIcon") && app.includes("manifest-character.webmanifest") && !app.includes("in-app icon has updated"), "app-icon choice persistence without a blocking selection popup"],
  [app.includes("export a backup first") && app.includes("Share → Add to Home Screen") && app.includes("install it again"), "installed-icon refresh guidance protects local data"],
  [progress.includes("collectionInsights") && progress.includes("multiCoinSeries"), "collection and series intelligence"],
  [progress.includes("Duplicate extras") && progress.includes("Closest to completion"), "duplicate and near-complete series summaries"],
  [identify.includes("analysePhotos") && identify.includes("/api/identify") && identify.includes("confirmIdentification"), "visual-first analysis and confirm flow"],
  [identify.includes("saveIdentificationTest") && html.includes('id="identificationTestLog"'), "identification test capture and review"],
  [worker.includes("body.obverse?") && identify.includes("Analyse design side") && designOnlyResponse.status === 200 && designOnlyPayload.matches?.[0]?.id === "AU1-2020-QANTAS", "design-side-only identification"],
  [quotaResponse.status===429 && quotaPayload.diagnostic_code==="VISION-DAILY-LIMIT" && !quotaPayload.provider_error, "daily AI limit receives a safe, specific response"],
  [donationVisual.status === 200 && !donationVisual.payload.uncertain && donationVisual.payload.needs_year && donationVisual.payload.matches?.length === 2 && donationVisual.payload.matches.every(match=>match.id.includes("DONATION")), "design-side Donation Dollar goes directly to grouped matches"],
  [sixRoosVisual.status === 200 && !sixRoosVisual.payload.uncertain && sixRoosVisual.payload.matches[0]?.id === "AU1-2026-SIX-ROOS", "visual kangaroo count can resolve without a manual Step 2 question"],
  [misleadingRoosMatches[0]?.id === "AU1-2023-ROOS-KC3" && !misleadingRoosAssessment.uncertain, "visually supported standard issue can resolve without a manual kangaroo question"],
  [qantasMatches.length === 1 && qantasMatches[0]?.id === "AU1-2020-QANTAS", "decisive Qantas result suppresses weak extras"],
  [outbackMatches.length === 1 && outbackMatches[0]?.id === "AU1-2002-OUTBACK" && !assessMatches(outbackMatches,visualCase({year:"2002",design:"Year of the Outback"}),catalogue.coins).uncertain, "Year of the Outback produces a decisive visual match"],
  [sixRoosMatches[0]?.id === "AU1-2026-SIX-ROOS" && !assessMatches(sixRoosMatches,visualCase({year:"2026",portrait:"King Charles III",design:"Mob of Six Roos"}),catalogue.coins).uncertain, "six-roos visual evidence does not force the clue screen"],
  [discoveryMatches[0]?.id === "AU1-2019-DISCOVERY-S" && discoveryMatches.length === 1, "2019 letter S resolves without wrong-letter extras"],
  [discoveryLetterOnlyMatches[0]?.id === "AU1-2019-DISCOVERY-U", "visible letter U resolves even without an exact model title"],
  [anzacMatches[0]?.id === "AU1-2014-ANZAC" && !assessMatches(anzacMatches,visualCase({year:"2014",design:"ANZAC Centenary"}),catalogue.coins).uncertain, "ANZAC year selects the exact issue"],
  [anzacDesignOnlyMatches[0]?.id === "AU1-2018-ANZAC" && !assessMatches(anzacDesignOnlyMatches,visualCase({design:"ANZAC Centenary"}),catalogue.coins).uncertain, "ANZAC without a readable year goes to grouped matches"],
  [countedSixRoosMatches.length === 1 && countedSixRoosMatches[0]?.id === "AU1-2026-SIX-ROOS", "visible count of six selects Mob of Six Roos"],
  [invalidTypeObservation.design_type === "unknown" && invalidTypeObservation.kangaroo_count === null, "invalid model fields are normalised"],
  [olderYearObservation.year === "1986" && olderYearObservation.design === "International Year of Peace", "older four-digit years and common designs are recognised"],
  [partnerSeriesResults.length === 13 && partnerSeriesResults.every(result=>result.match===result.id), "one automated identification case covers every partner-program series"],
  [referenceVisionCalls === 2 && referenceComparePayload.matches?.[0]?.id === "AU1-2024-BLUEY_DOLLARBUCKS-BLUEY" && referenceComparePayload.matches[0].confidence === .97 && !referenceComparePayload.uncertain && referenceComparePayload.matches[0].evidence.includes("official reference image comparison"), "official reference images resolve an ambiguous visual shortlist"],
  [donation2020Clues.length === 1 && donation2020Clues[0]?.coin.id === "AU1-2020-DONATION", "recognised Donation Dollar plus 2020 yields one exact result"],
  [donation2021Clues.length === 1 && donation2021Clues[0]?.coin.id === "AU1-2021-DONATION", "recognised Donation Dollar plus 2021 yields one exact result"],
  [manualDonation2021Clues.length === 1 && manualDonation2021Clues[0]?.coin.id === "AU1-2021-DONATION", "typed Donation Dollar plus 2021 yields one exact result"],
  [sixRoosClues.length === 1 && sixRoosClues[0]?.coin.id === "AU1-2026-SIX-ROOS", "six-kangaroo help answer excludes Five Kangaroos"],
  [genericRoosClues.every(item => item.confidence < 75), "generic kangaroo wording cannot create a confident match"],
  [emptyClues.length === 0, "empty clues cannot create false high-confidence kangaroo matches"],
  [app.includes("groupCatalogueCoins") && app.includes('id="dYear"') && app.includes("variantIssueLabel") && identify.includes("data-identify-year"), "multi-year and same-year variants use one catalogue card with exact issue selection"],
  [identify.includes('identifyState.resultSource==="clue"?document.getElementById("identifyYear").value:""') && !html.includes("How many kangaroos?") && !identify.includes("identifyKangarooCount"), "visual multi-year results do not preselect a year and Step 2 has no kangaroo-count question"],
  [identify.includes("prepareIdentifyPhoto") && identify.includes("resizeWidth: 1600") && identify.includes('removeAttribute("capture")'), "iPhone-safe photo preparation and picker handling"],
  [html.includes('id="toastRegion"') && app.includes("showToast") && !identify.includes("added to your collection with its photos"), "in-app add confirmation replaces browser alert"],
  [worker.includes("env.AI.run") && worker.includes("llama-4-scout") && worker.includes("llama-3.2-11b-vision-instruct") && worker.includes("env.ASSETS.fetch"), "primary and fallback vision models plus static assets binding"],
  [sw.includes("pocket-mint-v0.12.2") && sw.includes("!/^https?") && sw.includes("./icons/character-512.png"), "matching service-worker cache, icon assets and remote image exclusions"],
  [sw.includes("./progress.css") && sw.includes("./progress.js"), "progress assets cached offline"],
  [sw.includes("./identify.css") && sw.includes("./identify.js"), "identification assets cached offline"],
  [manifest.start_url === "./#home", "manifest start route"],
  [manifest.icons?.some(icon => icon.sizes === "192x192") && manifest.icons?.some(icon => icon.sizes === "512x512"), "manifest icons"],
  [Array.isArray(catalogue.coins) && catalogue.coins.length > 0, "non-empty catalogue"],
  [new Set(catalogue.coins.map(coin => coin.id)).size === catalogue.coins.length, "unique catalogue IDs"],
  [catalogue.meta.catalogue_version === "0.8.0" && catalogue.coins.length === 219 && catalogue.coins.some(coin => coin.id === "AU1-2025-ROOS-KC3"), "expanded catalogue version and record total"],
  [catalogue.coins.filter(coin => coin.title === "Five Kangaroos").length === 28 && catalogue.coins.some(coin => coin.id === "AU1-1984-ROOS-AM") && catalogue.coins.filter(coin => coin.year === 2019 && coin.title === "Five Kangaroos").length === 2, "all standard Five Kangaroos issues and both 2019 effigies"],
  [catalogue.coins.some(coin => coin.id === "AU1-2016-DECIMAL-50" && coin.mintage === 560000), "2016 decimal-currency circulation variant"],
  [catalogue.coins.filter(coin => coin.test_scope === "circulation_sample").length === 48 && catalogue.coins.filter(coin => coin.test_scope === "circulation_core").length === 10 && catalogue.coins.filter(coin => coin.test_scope === "circulation_partner").length === 161, "historical, recent and partner-program circulating totals"],
  [catalogue.coins.some(coin => coin.id === "AU1-2002-OUTBACK") && catalogue.coins.some(coin => coin.id === "AU1-2010-GIRL-GUIDING") && catalogue.coins.filter(coin => coin.series_id === "anzac_centennial").length === 5, "requested Outback, Girl Guiding and full ANZAC run are present"],
  [catalogue.coins.every(coin => coin.test_scope !== "collector_exemplar") && !html.includes("Collector exemplars"), "collector-only entries are excluded from the active catalogue"],
  [html.includes('<select id="scopeFilter" aria-label="Filter by issue group"><option value="">All circulating $1 coins</option>') && html.includes('<option value="circulation_partner">Partner-program releases</option>') && app.includes('scope === "core_circulation"'), "browse defaults to all $1 coins with useful issue-group filters"],
  [html.includes('id="seriesFilter"') && html.includes('id="typeFilter"') && app.includes('coin.series_id === series') && app.includes('coin.issue_type === type') && app.includes('Great Aussie Coin Hunt 3'), "Browse supports labelled year, series, issue-type, issue-group and collection dropdowns"],
  [catalogue.coins.filter(coin => coin.series_id === "gach1").length === 26 && catalogue.coins.filter(coin => coin.series_id === "gach2").length === 27 && catalogue.coins.filter(coin => coin.series_id === "gach3").length === 27, "all Great Aussie Coin Hunt designs and the GACH3 coloured X are present"],
  [catalogue.coins.filter(coin => coin.series_id === "matildas").length === 4 && catalogue.coins.filter(coin => coin.series_id === "afl2023").length === 22 && catalogue.coins.filter(coin => coin.series_id === "aussie_big_things").length === 11 && catalogue.coins.filter(coin => coin.series_id === "aussie_big_things_2").length === 10, "Matildas, AFL and both Aussie Big Things sets are present"],
  [catalogue.coins.filter(coin => coin.series_id === "bluey_dollarbucks").length === 11 && catalogue.coins.some(coin=>coin.id==="AU1-2025-BLUEY-CHRISTMAS"), "Bluey Dollarbucks variants and Bluey Christmas are present"],
  [html.includes('id="clearCatalogueFilters"') && app.includes('document.getElementById("clearCatalogueFilters").onclick') && html.includes('id="catalogueResultCount"'), "Browse has result count and Clear filters control"],
  [catalogueText === rootCatalogueText, "root and public catalogue copies match"],
  [new Set(catalogue.coins.filter(coin => coin.series_id).map(coin => coin.series_id)).size > 0, "series data available"],
  [catalogue.coins.every(coin => coin.reference_image), "every catalogue record has reference artwork"],
  [catalogue.coins.every(coin => ["obverse", "reverse", "series", "product"].includes(coin.reference_image_kind)), "reference artwork is truthfully labelled"]
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  failed ||= !ok;
}
if (failed) process.exitCode = 1;
