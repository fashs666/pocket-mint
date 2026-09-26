import fs from "node:fs";

const paths=["public/catalogue.json","catalogue.json"];
const catalogue=JSON.parse(fs.readFileSync(paths[0],"utf8"));
const existing=new Set(catalogue.coins.map(coin=>coin.id));
const common={
  denomination_cents:100,composition:"92% Copper, 6% Aluminium, 2% Nickel",mass_grams:9,diameter_mm:25,
  shape:"Circular",edge:"Interrupted Milled",mint:"RAM",coin_class:"circulating",issue_type:"commemorative",
  circulation_status:"circulation",reverse_designer:null,mintmark:null,privy_mark:null,finish:"Uncirculated",
  verified:1,test_scope:"circulation_partner",catalogue_status:"verified",denomination_display:"$1"
};
const add=coin=>{if(!existing.has(coin.id)){catalogue.coins.push({...common,...coin});existing.add(coin.id);}};

const gach3={
  U:"Undara Lava Tubes",V:"Vanilla Slice",W:"Wattle",X:"Crux",Y:"Yarra Valley",Z:"Zebra Finch"
};
for(const [letter,name] of Object.entries(gach3)) add({
  id:`AU1-2022-GACH3-${letter}`,year:2022,title:`Great Aussie Coin Hunt 3 — ${letter} for ${name}`,series_id:"gach3",colour:0,
  mintage:490000,mintage_status:"published",obverse_effigy:"Elizabeth II – Jody Clark",notes:"Public partner-program $1 release.",
  source_id:"ram_gach3",reference_image:`https://www.ramint.gov.au/sites/default/files/styles/medium/public/2025-05/uncirculated-coins-one-dollar-2022-great-aussie-coin-hunt-3-${letter.toLowerCase()}-${name.toLowerCase().replaceAll(" ","-")}.jpg`,reference_image_kind:"reverse",reference_image_source_id:"ram_gach3"
});
add({id:"AU1-2022-GACH3-XCOLOUR",year:2022,title:"Great Aussie Coin Hunt 3 — X for Crux (Coloured)",series_id:"gach3",colour:1,mintage:19500,mintage_status:"published",obverse_effigy:"Elizabeth II – Jody Clark",notes:"Coloured X coin issued in the A–Z folder.",source_id:"ram_gach3",reference_image:"https://www.ramint.gov.au/sites/default/files/styles/medium/public/2025-05/uncirculated-coins-one-dollar-2022-great-aussie-coin-hunt-3-x-crux.jpg",reference_image_kind:"series",reference_image_source_id:"ram_gach3"});

const bigThings=[
  ["MERINO","Big Merino"],["GUITAR","Big Golden Guitar"],["PENGUIN","Big Penguin"],["GALAH","Big Galah"],["ROCKING-HORSE","Big Rocking Horse"],
  ["WHEELBARROW","Big Wheelbarrow"],["PRAWN","Big Prawn"],["STRAWBERRY","Big Strawberry"],["BARRAMUNDI","Big Barramundi"],["MANGO","Big Mango"]
];
const localBig=new Map([["Big Merino","coin-images/uncirculated-coins-one-dollar-2025-aussie-big-things-big-merino.webp"],["Big Galah","coin-images/uncirculated-coins-one-dollar-2025-aussie-big-things-big-galah.webp"],["Big Wheelbarrow","coin-images/uncirculated-coins-one-dollar-2025-aussie-big-things-big-wheelbarrow.webp"]]);
for(const [code,name] of bigThings){
  const slug=name.toLowerCase().replaceAll(" ","-");
  add({id:`AU1-2025-AUSSIE_BIG_THINGS_2-${code}`,year:2025,title:`Aussie Big Things 2 — ${name}`,series_id:"aussie_big_things_2",colour:0,mintage:null,mintage_status:"not published",obverse_effigy:"Charles III – Daniel Thorne",notes:"Australia Post Aussie Big Things 2 program release.",source_id:"ram_bigthings2",reference_image:localBig.get(name)||`https://www.ramint.gov.au/sites/default/files/styles/full_width/public/2025-09/uncirculated-coins-one-dollar-2025-aussie-big-things-${slug}.png`,reference_image_kind:"reverse",reference_image_source_id:"ram_bigthings2"});
}

const bigThingsTillImage="https://auspost.com.au/shop/static/WFS/AusPost-Shop-Site/-/AusPost-Shop/en_AU/product/2295534INT-AusPost/4/resized_560x560.jpg";
add({id:"AU1-2025-AUSSIE_BIG_THINGS_2-TILL-1",year:2025,title:"Aussie Big Things 2 — Till Design 1",series_id:"aussie_big_things_2",colour:0,mintage:null,mintage_status:"not published",obverse_effigy:"Charles III – Daniel Thorne",notes:"Circulating till design featuring the Big Merino, Big Golden Guitar, Big Strawberry, Big Prawn and Big Wheelbarrow.",source_id:"auspost_bigthings2_set",reference_image:bigThingsTillImage,reference_image_kind:"product",reference_image_source_id:"auspost_bigthings2_set"});
add({id:"AU1-2025-AUSSIE_BIG_THINGS_2-TILL-2",year:2025,title:"Aussie Big Things 2 — Till Design 2",series_id:"aussie_big_things_2",colour:0,mintage:null,mintage_status:"not published",obverse_effigy:"Charles III – Daniel Thorne",notes:"Circulating till design featuring the Big Penguin, Big Barramundi, Big Rocking Horse, Big Galah and Big Mango.",source_id:"auspost_bigthings2_set",reference_image:bigThingsTillImage,reference_image_kind:"product",reference_image_source_id:"auspost_bigthings2_set"});

const afl2024Image="https://auspost.com.au/shop/static/WFS/AusPost-Shop-Site/-/AusPost-Shop/en_AU/product/9024582INT-AusPost/5/resized_1500x1500.jpg";
add({id:"AU1-2024-AFL-PREMIERSHIP",year:2024,title:"AFL — 2024 Premiership Season",series_id:"afl2024",colour:0,mintage:1250000,mintage_status:"published",obverse_effigy:"Elizabeth II – Jody Clark (Memorial Obverse)",reverse_designer:"Tony Dean",notes:"Non-coloured AFL Premiership design distributed into circulation through Australia Post.",source_id:"numista_afl_2024",reference_image:afl2024Image,reference_image_kind:"product",reference_image_source_id:"auspost_afl_2024"});
add({id:"AU1-2024-AFLW-PREMIERSHIP",year:2024,title:"AFLW — 2024 Premiership Season",series_id:"afl2024",colour:0,mintage:1250000,mintage_status:"published",obverse_effigy:"Elizabeth II – Jody Clark (Memorial Obverse)",reverse_designer:"Tony Dean",notes:"Non-coloured AFLW Premiership design distributed into circulation through Australia Post.",source_id:"numista_afl_2024",reference_image:afl2024Image,reference_image_kind:"product",reference_image_source_id:"auspost_afl_2024"});

const bluey=[
  ["BLUEY-FRIENDS","Bluey & Friends"],["MUFFIN-SOCKS","Muffin & Socks"],["GRANNIES","The Grannies"],["RAD-FRISKY","Uncle Rad & Frisky"],
  ["BLUEY-BINGO-FRIENDS","Bluey, Bingo & Friends"],["MUM-DAD","Mum & Dad"],["STRIPE-TRIXIE-NANA","Uncle Stripe, Aunt Trixie & Nana"],["HEELERS","The Heelers"]
];
const blueySeriesImage="https://www.ramint.gov.au/sites/default/files/styles/medium/public/2025-05/uncirculated-coins-one-dollar-2024-bluey-dollarbucks.png";
for(const [code,name] of bluey) add({id:`AU1-2024-BLUEY_DOLLARBUCKS-${code}`,year:2024,title:`Bluey Dollarbucks — ${name}`,series_id:"bluey_dollarbucks",colour:0,mintage:null,mintage_status:"not published",obverse_effigy:"Charles III – Daniel Thorne",notes:"One of ten Bluey Dollarbucks designs; distributed through the Australia Post program.",source_id:"auspost_bluey_2024",reference_image:blueySeriesImage,reference_image_kind:"series",reference_image_source_id:"auspost_bluey_2024"});
add({id:"AU1-2024-BLUEY_DOLLARBUCKS-BLUEY-COLOUR",year:2024,title:"Bluey Dollarbucks — Bluey (Coloured)",series_id:"bluey_dollarbucks",colour:1,mintage:null,mintage_status:"not published",obverse_effigy:"Charles III – Daniel Thorne",notes:"Special coloured Bluey Dollarbucks variant distributed through Australia Post.",source_id:"auspost_bluey_2024",reference_image:blueySeriesImage,reference_image_kind:"series",reference_image_source_id:"auspost_bluey_2024"});
add({id:"AU1-2025-BLUEY-CHRISTMAS",year:2025,title:"Bluey Christmas",series_id:"bluey",colour:1,mintage:125000,mintage_status:"published",obverse_effigy:"Charles III – Daniel Thorne",notes:"Coloured Bluey and Bingo Christmas $1 coin.",source_id:"ram_bluey_christmas",reference_image:blueySeriesImage,reference_image_kind:"series",reference_image_source_id:"ram_bluey_christmas"});

const ensureSource=source=>{if(!catalogue.sources.some(item=>item.id===source.id))catalogue.sources.push(source);};
ensureSource({id:"ram_bigthings2",publisher:"Royal Australian Mint",title:"Aussie Big Things 2",url:"https://www.ramint.gov.au/news-media/news-stories/aussie-big-things-2",checked_date:"2026-09-23"});
ensureSource({id:"auspost_bigthings2_set",publisher:"Australia Post",title:"2025 Aussie Big Things 2 – 12-coin Folder and Tube Set",url:"https://auspost.com.au/shop/product/2025-aussie-big-things-2-12-coin-folder-and-tube-set-10009460",checked_date:"2026-09-26"});
ensureSource({id:"numista_afl_2024",publisher:"Numista",title:"2024 AFL and AFLW Premiership circulating $1 issues",url:"https://en.numista.com/410554",checked_date:"2026-09-26"});
ensureSource({id:"auspost_afl_2024",publisher:"Australia Post",title:"AFL & AFLW 2024 Limited-Edition Numismatic Cover",url:"https://auspost.com.au/shop/product/afl-and-aflw-limited-edition-two-coin-postal-numismatic-cover-pnc-9024582int",checked_date:"2026-09-26"});
ensureSource({id:"auspost_bluey_2024",publisher:"Australia Post",title:"Bluey Dollarbucks FAQ",url:"https://auspost.com.au/content/dam/auspost_corp/media/documents/bluey-dollarbucks-faq.pdf",checked_date:"2026-09-23"});
ensureSource({id:"ram_bluey_christmas",publisher:"Royal Australian Mint",title:"Bluey Christmas",url:"https://www.ramint.gov.au/news-media/news-stories/bluey-christmas-coins",checked_date:"2026-09-23"});

catalogue.coins.sort((a,b)=>a.year-b.year||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
catalogue.meta.catalogue_version="0.8.1";
catalogue.meta.partner_programs_checked_through="2026-09-26";
for(const path of paths)fs.writeFileSync(path,`${JSON.stringify(catalogue,null,2)}\n`);
console.log(`Catalogue ${catalogue.meta.catalogue_version}: ${catalogue.coins.length} records`);
