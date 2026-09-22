import {readFile,writeFile} from "node:fs/promises";

const publicPath=new URL("../public/catalogue.json",import.meta.url);
const rootPath=new URL("../catalogue.json",import.meta.url);
const catalogue=JSON.parse(await readFile(publicPath,"utf8"));

const standardIssues=[
  [1984,186300000,"Elizabeth II – Arnold Machin","AM"],
  [1985,96200000,"Elizabeth II – Raphael Maklouf","RM"],
  [1992,8000,"Elizabeth II – Raphael Maklouf","RM"],
  [1994,47600000,"Elizabeth II – Raphael Maklouf","RM"],
  [1995,21400000,"Elizabeth II – Raphael Maklouf","RM"],
  [1998,16200000,"Elizabeth II – Raphael Maklouf","RM"],
  [2000,7600000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2004,8800000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2005,5800000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2006,38900000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2008,30100000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2009,21200000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2010,16700000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2011,17900000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2013,20900000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2014,1052000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2015,22300000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2016,30200000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2017,11100000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2018,8300000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2019,10700000,"Elizabeth II – Ian Rank-Broadley","IRB"],
  [2019,2100000,"Elizabeth II – Jody Clark","JC"]
];

const common={
  denomination_cents:100,
  composition:"92% Copper, 6% Aluminium, 2% Nickel",
  mass_grams:9,
  diameter_mm:25,
  shape:"Circular",
  edge:"Interrupted Milled",
  mint:"RAM",
  colour:0,
  coin_class:"circulating",
  circulation_status:"circulation",
  mintage_status:"published",
  mintmark:null,
  privy_mark:null,
  finish:null,
  source_id:"ram_1d",
  verified:1,
  test_scope:"circulation_sample",
  catalogue_status:"verified",
  denomination_display:"$1",
  reference_image_source_id:"ram_1d"
};

const additions=standardIssues.map(([year,mintage,effigy,code])=>({
  ...common,
  id:`AU1-${year}-ROOS-${code}`,
  year,
  title:"Five Kangaroos",
  series_id:"std_roos",
  issue_type:"standard",
  mintage,
  obverse_effigy:effigy,
  reverse_designer:"Stuart Devlin",
  variant_label:year===2019?(code==="IRB"?"Ian Rank-Broadley effigy":"Jody Clark effigy"):null,
  notes:year===1992?"Low-mintage circulation issue.":null,
  reference_image:"coin-images/five-kangaroos.jpg",
  reference_image_kind:"reverse"
}));

additions.push({
  ...common,
  id:"AU1-2016-DECIMAL-50",
  year:2016,
  title:"50th Anniversary of Decimal Currency",
  series_id:"decimal_currency_50",
  issue_type:"commemorative",
  mintage:560000,
  obverse_effigy:"1966 commemorative obverse",
  reverse_designer:"Stuart Devlin",
  variant_label:"Commemorative obverse",
  notes:"Special obverse issued for the 50th anniversary of Australian decimal currency; Five Kangaroos reverse.",
  reference_image:"https://www.ramint.gov.au/sites/default/files/styles/medium/public/2025-04/circulating-coins-one-dollar-commemorative-design-2016-obverse-50-anniversary-decimal-currency.jpg?itok=cHs3ybYA",
  reference_image_kind:"obverse"
});

const byId=new Map(catalogue.coins.map(coin=>[coin.id,coin]));
for(const coin of additions)byId.set(coin.id,coin);
catalogue.coins=[...byId.values()].sort((a,b)=>Number(a.year)-Number(b.year)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
catalogue.meta={
  ...catalogue.meta,
  catalogue_version:"0.6.0",
  scope:"Australian $1 circulating-coin catalogue. Every standard and commemorative issue listed in the Royal Australian Mint's main One Dollar circulating series from 1984 onward is included; separately distributed partner-program and collector-only products are excluded from this core release.",
  status:"core-circulation-complete",
  important:"Core circulating $1 issues are complete from 1984 through the latest published Royal Australian Mint figures. Partner-program releases will be catalogued separately.",
  circulation_core_complete_through:"2026-09-22"
};

const output=`${JSON.stringify(catalogue,null,2)}\n`;
await Promise.all([writeFile(publicPath,output),writeFile(rootPath,output)]);
console.log(`Pocket Mint catalogue expanded to ${catalogue.coins.length} circulating $1 records.`);
