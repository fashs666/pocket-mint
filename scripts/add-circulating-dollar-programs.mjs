import {readFile,writeFile} from "node:fs/promises";

const publicPath=new URL("../public/catalogue.json",import.meta.url);
const rootPath=new URL("../catalogue.json",import.meta.url);
const catalogue=JSON.parse(await readFile(publicPath,"utf8"));
const base="https://www.ramint.gov.au/sites/default/files/styles/medium/public";

const common={
  denomination_cents:100,composition:"92% Copper, 6% Aluminium, 2% Nickel",mass_grams:9,
  diameter_mm:25,shape:"Circular",edge:"Interrupted Milled",mint:"RAM",coin_class:"circulating",
  issue_type:"commemorative",circulation_status:"circulation",mintage_status:"published",
  reverse_designer:null,mintmark:null,privy_mark:null,finish:"Uncirculated",verified:1,
  test_scope:"circulation_partner",catalogue_status:"verified",denomination_display:"$1",
  reference_image_kind:"reverse"
};

const sources=[
  ["ram_possum","Possum Magic","woolworths-programs/possum-magic"],
  ["ram_gc2018","Gold Coast Commonwealth Games","woolworths-programs/gold-coast-commonwealth"],
  ["ram_squiggle","Mr Squiggle","woolworths-programs/mr-squiggle"],
  ["ram_gach1","Great Aussie Coin Hunt 1","australia-post-programs/great-aussie-coin"],
  ["ram_tokyo","Tokyo Olympic and Paralympic Games","woolworths-programs/tokyo-olympic-and"],
  ["ram_wiggles","30 Years of the Wiggles","woolworths-programs/30-years-wiggles"],
  ["ram_gach2","Great Aussie Coin Hunt 2","australia-post-programs/great-aussie-coin-hunt-2"],
  ["ram_gach3","Great Aussie Coin Hunt 3","australia-post-programs/great-aussie-coin-hunt-3"],
  ["ram_dinosaurs","Australian Dinosaurs","australia-post-programs/australian"],
  ["ram_matildas","Matildas","woolworths-programs/matildas"],
  ["ram_afl","AFL","woolworths-programs/afl"],
  ["ram_bigthings","Aussie Big Things","australia-post-programs/aussie-big-things"],
  ["ram_bluey","Bluey Dollarbucks","australia-post-programs/bluey-dollarbucks"]
].map(([id,title,path])=>({id,publisher:"Royal Australian Mint",title,url:`https://www.ramint.gov.au/collect/national-coin-collection/corporate-partnerships/${path}`,checked_date:"2026-09-22"}));

const additions=[];
function add({year,series,source,folder,prefix,items,effigy,notes="Public partner-program $1 release."}) {
  for(const item of items) {
    const [code,title,slug,mintage,colour=0,itemFolder]=item;
    additions.push({...common,id:`AU1-${year}-${series.toUpperCase()}-${code.toUpperCase()}`,year,title,
      series_id:series,colour,mintage,mintage_status:mintage===null?"not published":"published",obverse_effigy:effigy,notes,source_id:source,
      reference_image:slug.startsWith("https://")?slug:`${base}/${itemFolder||folder}/${prefix}${slug}`,reference_image_source_id:source});
  }
}

add({year:2017,series:"possum_magic",source:"ram_possum",folder:"2025-04",prefix:"uncirculated-coins-one-dollar-2017-possum-magic-",effigy:"Elizabeth II – Ian Rank-Broadley",items:[
  ["INVISIBLE","Possum Magic — Hush Invisible","grandma-poss-hush-invisible.jpg",401000],
  ["BIKE","Possum Magic — Across Australia","bike.jpg",401000],
  ["LAMINGTONS","Possum Magic — Lamingtons","lamingtons.jpg",401000],
  ["FOOD","Possum Magic — Special Food","special-food.jpg",401000]
]});

add({year:2018,series:"gc2018",source:"ram_gc2018",folder:"2025-04",prefix:"uncirculated-coins-one-dollar-2018-gold-coast-commonwealth-games-",effigy:"Elizabeth II – Ian Rank-Broadley",items:[
  ["DIVING","Gold Coast 2018 — Diving","diving-first.jpg",450000],
  ["WRESTLING","Gold Coast 2018 — Wrestling","wrestling-second.jpg",450000],
  ["SWIMMING","Gold Coast 2018 — Swimming","swimming-third.jpg",450000],
  ["BASKETBALL","Gold Coast 2018 — Basketball","basketball-fourth.jpg",450000]
]});

add({year:2019,series:"mr_squiggle",source:"ram_squiggle",folder:"2025-04",prefix:"uncirculated-coins-one-dollar-2019-mr-squiggle-60-year-anniversary",effigy:"Elizabeth II – Jody Clark",items:[
  ["FRIENDS","Mr Squiggle and Friends",".jpg",365000],
  ["ROCKET","Mr Squiggle on a Rocket","-rocket.jpg",365000]
]});

const gach1=[
  ["A","A for Australia Post","a-australia-post"],["B","B for Boomerang","b-boomerang"],["C","C for Cricket","c-cricket"],
  ["D","D for Didgeridoo","d-didgeridoo"],["E","E for Esky","e-esky"],["F","F for Footy","f-footy"],
  ["G","G for G’Day","g-gday"],["H","H for Hills Hoist","h-hills-hoist"],["I","I for Iced Vovo","i-iced-vovo"],
  ["J","J for Jackaroo & Jillaroo","j-jackaroo-jillaroo"],["K","K for Kangaroo","k-kangaroo"],["L","L for Lamington","l-lamington"],
  ["M","M for Meat Pie","m-meat-pie"],["N","N for Neighbours","n-neighbours"],["O","O for Outback","o-outback"],
  ["P","P for Platypus","p-platypus"],["Q","Q for Quokka","q-quokka"],["R","R for Royal Flying Doctor Service","r-royal-flying-doctor-service"],
  ["S","S for Surf Life Saving","s-surf-life-saving"],["T","T for Thongs","t-thongs"],["U","U for Ute","u-ute"],
  ["V","V for Vegemite","v-vegemite"],["W","W for Weet-Bix","w-weet-bix"],["X","X for Xantippe","x-xantippe"],
  ["Y","Y for Yowie","y-yowie"],["Z","Z for Zooper Dooper","z-zooper-dooper"]
].map(([code,title,slug])=>[code,`Great Aussie Coin Hunt 1 — ${title}`,`${slug}.jpg`,523000,0,code>="M"?"2025-05":null]);
add({year:2019,series:"gach1",source:"ram_gach1",folder:"2025-04",prefix:"uncirculated-coins-one-dollar-2019-great-aussie-coin-hunt-",effigy:"Elizabeth II – Jody Clark",items:gach1});

add({year:2020,series:"tokyo2020",source:"ram_tokyo",folder:"2025-04",prefix:"uncirculated-coins-one-dollar-2020-",effigy:"Elizabeth II – Jody Clark",items:[
  ["PARA","Tokyo 2020 Paralympic Team — Set to Soar","australian-paralympic-set-to-soar.jpg",2150000,1],
  ["COURAGE","Tokyo 2020 Olympic Team — Courage","australian-olympic-courage.jpg",2450000,1],
  ["DEDICATION","Tokyo 2020 Olympic Team — Dedication","australian-olympic-dedication.jpg",2450000,1],
  ["PASSION","Tokyo 2020 Olympic Team — Passion","australian-olympic-passion.jpg",2450000,1],
  ["RESILIENCE","Tokyo 2020 Olympic Team — Resilience","australian-olympic-resilience.jpg",2450000,1],
  ["STRIVING","Tokyo 2020 Olympic Team — Striving","australian-olympic-striving.jpg",2450000,1]
]});

add({year:2021,series:"wiggles30",source:"ram_wiggles",folder:"2025-05",prefix:"uncirculated-coins-one-dollar-2021-thirty-years-wiggles-",effigy:"Elizabeth II – Jody Clark",items:[
  ["CURRENT","30 Years of The Wiggles — Emma, Lachy, Anthony & Simon","emma-lachy-anthony-simon.jpg",300000],
  ["ORIGINAL","30 Years of The Wiggles — Anthony, Jeff, Murray & Greg","anthony-jeff-murray-greg.jpg",300000]
]});

const gach2Names=[
  ["A","Akubra","a-akubra"],["B","BBQ","b-bbq"],["C","Cherry Ripe","c-cherry-ripe"],["D","Dingo","d-dingo"],
  ["E","Emu","e-emu"],["F","Flies","f-flies"],["G","Great Barrier Reef","g-great-barrier-reef"],["H","Home and Away","h-home-and-away"],
  ["I","Ironbark","i-ironbark"],["J","Jolly Swagman","j-jolly-swagman"],["K","Koala","k-koala"],["L","Lyrebird","l-lyrebird"],
  ["M","Milo","m-milo"],["N","Nobby’s Nuts","n-nobbys-nuts"],["O","Opera House","o-opera-house"],["P","Pavlova","p-pavlova"],
  ["Q","Queen Victoria Market","q-queen-victoria-market"],["R","Redback Spider","r-redback-spider"],["S","Sydney Harbour Bridge","s-sydney-harbour-bridge"],
  ["T","Tim Tam","t-tim-tam"],["U","Ulysses Butterfly","u-ulysses-butterfly"],["V","Victa Lawnmower","v-victa-lawnmower"],
  ["W","Witchetty Grub","w-witchetty-grub"],["X","Xanthorrhoea","x-xanthorrhoea"],["Y","Yabby","y-yabby"],["Z","Zinc Sunscreen","z-zinc-sunscreen"]
];
const gach2=gach2Names.map(([code,name,slug])=>[code,`Great Aussie Coin Hunt 2 — ${code} for ${name}`,`${slug}.jpg`,456000]);
gach2.push(["GCOLOUR","Great Aussie Coin Hunt 2 — G for Great Barrier Reef (Coloured)","g-great-barrier-reef-coloured.jpg",225000,1]);
add({year:2021,series:"gach2",source:"ram_gach2",folder:"2025-05",prefix:"uncirculated-coins-one-dollar-2021-great-aussie-coin-hunt-2-",effigy:"Elizabeth II – Jody Clark",items:gach2});

const gach3Names=[
  ["A","Aussie, Aussie, Aussie","a-aussie"],["B","Bushranger","b-bushrangers"],["C","Cockatoo","c-cockatoo"],["D","Darrell Lea","d-darrell-lea"],
  ["E","Echidna","e-echidna"],["F","Farmers","f-farmers"],["G","Great Ocean Road","g-great-ocean-road"],["H","Hooroo","h-hooroo"],
  ["I","Irukandji Jellyfish","i-irukandji-jellyfish"],["J","Jumbuck","j-jumbuck"],["K","Kelpie","k-kelpie"],["L","Luna Park Melbourne","l-luna-park-melbourne"],
  ["M","Magpie","m-magpie"],["N","Nullarbor Plain","n-nullarbor-plain"],["O","Opal","o-opal"],["P","The Pinnacles","p-pinnacles"],
  ["Q","Quoll","q-quoll"],["R","R.M. Williams","r-rm-williams"],["S","Surfing","s-surfing"],["T","Tasmanian Devil","t-tasmanian-devil"]
].map(([code,name,slug])=>[code,`Great Aussie Coin Hunt 3 — ${code} for ${name}`,`${slug}.jpg`,490000]);
add({year:2022,series:"gach3",source:"ram_gach3",folder:"2025-05",prefix:"uncirculated-coins-one-dollar-2022-great-aussie-coin-hunt-3-",effigy:"Elizabeth II – Jody Clark",items:gach3Names});

add({year:2022,series:"australian_dinosaurs",source:"ram_dinosaurs",folder:"2025-05",prefix:"uncirculated-coins-one-dollar-2022-australian-dinosaurs-",effigy:"Elizabeth II – Jody Clark",notes:"Australia Post base-metal program release; non-privy version.",items:[
  ["AUSTRALOVENATOR","Australian Dinosaurs — Australovenator","australovenator.jpg",null],
  ["DIAMANTINASAURUS","Australian Dinosaurs — Diamantinasaurus","diamantinasaurus.jpg",null],
  ["ELAPHROSAURINE","Australian Dinosaurs — Elaphrosaurine","elaphrosaurine.jpg",null],
  ["KUNBARRASAURUS","Australian Dinosaurs — Kunbarrasaurus","kunbarrasaurus.jpg",null]
]});

add({year:2023,series:"matildas",source:"ram_matildas",folder:"2025-04",prefix:"uncirculated-coins-one-dollar-2023-matildas-",effigy:"Elizabeth II – Jody Clark",items:[
  ["HEADER","Matildas — Team Header","header.jpg",1000000],["KEEPER","Matildas — Keeper","keeper.jpg",1000000],
  ["STRIKER","Matildas — Striker","striker.jpg",1000000],["TACKLE","Matildas — Tackle","tackle.jpg",1000000]
]});

const afl=[
  ["ADELAIDE","AFL — Adelaide Crows","adelaide-crows",18000],["BRISBANE","AFL — Brisbane Lions","brisbane-lions",13000],
  ["CARLTON","AFL — Carlton","carlton",23000],["COLLINGWOOD","AFL — Collingwood","collingwood",28000],
  ["ESSENDON","AFL — Essendon","essendon",23000],["FREMANTLE","AFL — Fremantle","freemantle",18000],
  ["GEELONG","AFL — Geelong Cats","https://www.ramint.gov.au/sites/default/files/styles/medium/public/2026-08/2023_%241_Unc_GeelongCats_REV.png",23000],["GOLDCOAST","AFL — Gold Coast Suns","gold-coast-suns",11000],
  ["GWS","AFL — GWS Giants","gws-giants",13000],["HAWTHORN","AFL — Hawthorn","hawthorn-hawks",28000],
  ["MELBOURNE","AFL — Melbourne","melbourne",18000],["NORTHMELB","AFL — North Melbourne Kangaroos","north-melbourne-kangaroos",14000],
  ["PORTADELAIDE","AFL — Port Adelaide","port-adelaide",18000],["RICHMOND","AFL — Richmond","richmond",33000],
  ["STKILDA","AFL — St Kilda","st-kilda",18000],["SYDNEY","AFL — Sydney Swans","sydney-swans",18000],
  ["WESTCOAST","AFL — West Coast Eagles","west-coast-eagles",33000],["BULLDOGS","AFL — Western Bulldogs","western-bulldogs",15000],
  ["PREMIERSHIP","AFL — 2023 Premiership Season","premiership",144000],
  ["PREMIERSHIPCOLOUR","AFL — 2023 Premiership Season (Coloured)","premiership-coloured",16000,1],
  ["AFLW","AFLW — 2023 Premiership Season","aflw-premiership",144000],
  ["AFLWCOLOUR","AFLW — 2023 Premiership Season (Coloured)","aflw-premiership-coloured",16000,1]
].map(([code,title,slug,mintage,colour=0])=>[code,title,slug.startsWith("https://")?slug:`${slug}.${slug==="premiership"?"png":"jpg"}`,mintage,colour]);
add({year:2023,series:"afl2023",source:"ram_afl",folder:"2025-05",prefix:"uncirculated-coins-one-dollar-2023-afl-program-",effigy:"Elizabeth II – Jody Clark",items:afl});

add({year:2023,series:"aussie_big_things",source:"ram_bigthings",folder:"2025-05",prefix:"uncirculated-coins-one-dollar-2023-aussie-big-things-",effigy:"Elizabeth II – Jody Clark",items:[
  ["COD","Aussie Big Things — Giant Murray Cod","giant-murray-cod.png",326000],
  ["CODCOLOUR","Aussie Big Things — Giant Murray Cod (Coloured)","giant-murray-cod-coloured.png",227000,1],
  ["PINEAPPLE","Aussie Big Things — The Big Pineapple","pineapple.png",326000],
  ["BANANA","Aussie Big Things — The Big Banana","banana.png",326000],
  ["HEELER","Aussie Big Things — Big Blue Heeler","blue-heeler.png",326000],
  ["KOALA","Aussie Big Things — Giant Koala","giant-koala.png",326000],
  ["SWOOP","Aussie Big Things — The Big Swoop","swoop.png",326000],
  ["CROC","Aussie Big Things — The Big Jumping Croc","jumping-croc.png",326000],
  ["LOBSTER","Aussie Big Things — The Big Lobster","lobster.png",326000],
  ["DEVIL","Aussie Big Things — The Tasmanian Devil","tasmanian-devil.png",326000],
  ["RAM","Aussie Big Things — Giant Ram","giant-ram.png",326000]
]});

add({year:2024,series:"bluey_dollarbucks",source:"ram_bluey",folder:"2025-05",prefix:"uncirculated-coins-one-dollar-2024-bluey-dollarbucks-",effigy:"Charles III – Daniel Thorne",items:[
  ["BLUEY","Bluey Dollarbucks — Bluey","bluey.png",1250000],["BINGO","Bluey Dollarbucks — Bingo","bingo.png",1250000]
]});

const byId=new Map(catalogue.coins.filter(coin=>coin.test_scope!=="circulation_partner").map(coin=>[coin.id,coin]));
for(const coin of additions)byId.set(coin.id,coin);
catalogue.coins=[...byId.values()].sort((a,b)=>Number(a.year)-Number(b.year)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
const sourceMap=new Map([...(catalogue.sources||[]),...sources].map(source=>[source.id,source]));
catalogue.sources=[...sourceMap.values()];
catalogue.meta={...catalogue.meta,catalogue_version:"0.7.0",
  scope:"Australian $1 catalogue covering the complete Royal Australian Mint circulation table plus base-metal $1 partner-program designs issued through Woolworths and Australia Post. Proof, precious-metal and mintmark-only products are excluded.",
  status:"circulating-dollar-expanded",
  important:"Every official core circulating $1 issue is included, together with the identifiable base-metal $1 designs in the Mint's Woolworths and Australia Post program archive.",
  partner_programs_checked_through:"2026-09-22"};

const output=`${JSON.stringify(catalogue,null,2)}\n`;
await Promise.all([writeFile(publicPath,output),writeFile(rootPath,output)]);
console.log(`Added ${additions.length} partner-program designs; catalogue now has ${catalogue.coins.length} records.`);
