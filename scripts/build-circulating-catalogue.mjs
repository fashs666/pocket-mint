import {readFile,writeFile} from 'node:fs/promises';
const legacy=JSON.parse(await readFile('public/catalogue.json','utf8')).coins;
const sources=JSON.parse(await readFile('scripts/circulation-source-data.json','utf8'));
const partnerSources=JSON.parse(await readFile('scripts/partner-source-data.json','utf8'));
const releaseSources=JSON.parse(await readFile('scripts/release-source-data.json','utf8'));
const parents=[
 ['bicentenary','Australian Bicentenary',['1988']],
 ['federation','Centenary of Federation',['2001']],
 ['outback','Year of the Outback',['2002']],
 ['volunteers2003','Australia’s Volunteers',['2003']],
 ['wwii60','60th Anniversary of the End of WWII',['2005']],
 ['anzac','Centenary of ANZAC',['2014–2018']],
 ['decimal50','50 Years of Decimal Currency',['2016']],
 ['olympic','Australian Olympic & Paralympic Team',['Rio 2016','Tokyo 2020','Paris 2024']],
 ['possum','Possum Magic',['2017']],
 ['goldcoast','Gold Coast Commonwealth Games',['2018']],
 ['discovery','Dollar Discovery',['2019']],
 ['squiggle','Mr Squiggle',['2019']],
 ['gach','Great Aussie Coin Hunt',['2019','2021','2022']],
 ['dinosaurs','Australian Dinosaurs',['2022']],
 ['commonwealth_team','Australian Commonwealth Games Team',['2022','2026']],
 ['wiggles','The Wiggles',['2021']],
 ['afl','AFL',['2023','2024']],
 ['vegemite','Vegemite Centenary',['2023']],
 ['matildas','Matildas',['2023']],
 ['big_things','Aussie Big Things',['2023','2025']],
 ['bluey','Bluey',['2024','2026']],
 ['nrl','NRL',['2024']],
 ['australian_open','Australian Open',['2025']],
 ['rugby','Rugby Australia',['2025']]
];
const series=parents.map(([id,title])=>({id,title}));
const releases=parents.flatMap(([id,,names])=>names.map(name=>({id:`${id}_${name.replace(/\W+/g,'_').toLowerCase()}`,seriesId:id,title:name})));
const releaseId=(seriesId,year)=>releases.find(r=>r.seriesId===seriesId&&(r.title===String(year)||r.title.includes(String(year))))?.id||null;
const slug=s=>s.normalize('NFKD').replace(/[^\w\s-]/g,'').trim().replace(/[\s_]+/g,'-').toUpperCase();
const display={5:'5c',10:'10c',20:'20c',50:'50c',100:'$1',200:'$2'};
const physical={5:{composition:'Cupro-nickel',mass_grams:2.83,diameter_mm:19.41},10:{composition:'Cupro-nickel',mass_grams:5.65,diameter_mm:23.6},20:{composition:'Cupro-nickel',mass_grams:11.3,diameter_mm:28.52},50:{composition:'Cupro-nickel',mass_grams:15.55,diameter_mm:31.65},100:{composition:'Aluminium bronze',mass_grams:9,diameter_mm:25},200:{composition:'Aluminium bronze',mass_grams:6.6,diameter_mm:20.5}};
const sourceImage=(denom,key)=>{
 if(!key)return null;
 const images=sources[String(denom)].images;
 const tidy=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
 const image=images.find(item=>tidy(item.alt).includes(tidy(key)));
 return image?{reference_image:image.url,reference_image_kind:key.includes('obverse')?'obverse':'reverse',reference_image_source_id:`ram_${denom}_circulation`}:null;
};
function partnerImage(seriesId,year,title){
 if(!seriesId&&[2019,2020,2022].includes(year)){
  const term=year===2019&&title==='Wallabies'?'2019-wallabies':year===2020&&title.includes('T20')?'2020-womens-t20':year===2022&&title.includes('Socceroos')?'2022-socceroos':null;
  const image=term&&partnerSources['sporting-events'].find(item=>item.alt.includes(term));
  if(image)return {reference_image:image.url,reference_image_kind:'reverse',reference_image_source_id:'ram_partner_sporting-events',source_id:'ram_partner_sporting-events',image_status:'exact'};
 }
 const page={olympic:year===2016?'rio-de-janeiro-olympic':year===2024?'paris-olympic':'tokyo-olympic-and',possum:'possum-magic',goldcoast:'gold-coast-commonwealth',squiggle:'mr-squiggle',commonwealth_team:'australian-commonwealth',wiggles:'30-years-wiggles',vegemite:'centenary-vegemite',matildas:'matildas'}[seriesId];
 if(!page||year===2026)return null;
 const name=title.split(' — ').at(-1).toLowerCase();
 const alias={
  'paralympic / wheelchair racer':'wheelchair-racer','paralympic / lizzie':'paralympic-set-to-soar',
  'invisible hush':'hanging-hush-blue','hush sees her tail':'tail-purple','happy hush':'happy-hush-red',
  'team logo':'logo-green','borobi':'borobi-blue','emblem':'emblem-red',
  'mr squiggle':'mr-squiggle-60-year-anniversary-coloured','gus the snail':'mr-squiggle-60-year-anniversary-gus','bill steamshovel':'mr-squiggle-60-year-anniversary-bill',
  'captain feathersword':'captain-feathersword','dorothy the dinosaur':'dorothy-dinosaur','henry the octopus':'henry-octopus','wags the dog':'wags-dog',
  bold:'matildas-dark-green',fierce:'matildas-light-green',united:'matildas-yellow'
 }[name]||name.replaceAll(' ','-').replace(/[^a-z0-9-]/g,'');
 const match=seriesId==='commonwealth_team'&&year===2022?`-team-${alias}`:alias;
 const image=partnerSources[page].find(item=>item.alt.includes('two-dollars')&&item.alt.includes(match)&&item.alt.includes(String(year)));
 return image?{reference_image:image.url,reference_image_kind:'reverse',reference_image_source_id:`ram_partner_${page}`,source_id:`ram_partner_${page}`,image_status:'exact'}:null;
}
function releaseImage(denom,year,title,seriesId){
 const search=(page,term,kind='reverse')=>{
  const image=releaseSources[page]?.find(item=>item.alt.toLowerCase().includes(term.toLowerCase()));
  return image?{reference_image:image.url,reference_image_kind:kind,reference_image_source_id:`ram_release_${page}`,source_id:`ram_release_${page}`,image_status:kind==='reverse'?'exact':kind}:null;
 };
 if(denom===50&&year===2026)return search('unity','50c circulated Unity coin','series');
 if(denom!==200)return null;
 if(year===2024&&seriesId==='nrl')return search('nrl',title.includes('NRLW')?'2024-nrlw-premiership':'2024-nrl-premiership');
 if(year===2026&&seriesId==='bluey')return search('bluey2026','Bluey and Bingo $2 till coins','series');
 if(year===2026&&seriesId==='commonwealth_team')return search('commonwealth2026','Three coins in the 2026','series');
 if(year===2025&&seriesId==='rugby')return search('rugby','2025 $2 Coloured Coin - Wallabies','series');
 if(year===2025&&seriesId==='australian_open')return search('australianopen2025','Australian Open coin program','series');
 if(year===2025&&title.includes('Hickory'))return search('birthday','2025 Australian Women','product');
 if(year===2025&&title.includes('Torres Strait Islander Flag'))return search('torres','Torres Strait Islander flag coins','product');
 if(year===2025&&title.includes('Poppy Wreath'))return search('wwii2025','poppy wreath coin in card','product');
 if(year===2026&&title==='Dawn Service')return search('dawn','2026 $2 Circulating Coin Dawn Service');
 return null;
}
const designs=[],aliases=new Map();
function tags(title,seriesId){const t=`${title} ${seriesId||''}`.toLowerCase(),result=[];
 for(const [tag,pattern] of [
  ['remembrance_military',/wwii|war|anzac|poppy|flanders|rosemary|mosaic|eternal flame|armistice|repatriation|military|peacekeeping|dawn service/],
  ['first_nations',/aiatsis|mabo|indigenous|aboriginal|naidoc|unity/],
  ['royal',/jubilee|royal|coronation|charles.*diana|wedding/],
  ['volunteering_community',/volunteer|police|firefight|ambulance|frontline/],
  ['federation_government',/federation|parkes|apec|chogm/],
  ['decimal_history',/decimal|dollar discovery|six roos/],
  ['commonwealth_games',/commonwealth games|gold coast|brisbane xii|melbourne 2006/]
 ])if(pattern.test(t))result.push(tag);
 return result;
}
function add(denom,year,title,seriesId=null,release=null,imageKey='',extra={}){
 const id=`AU${denom}-${year}-${slug(title)}`;
 const image=sourceImage(denom,imageKey);
 const variants=extra.yearVariants||[{id,year,effigy:year>=2024?'Charles III – Daniel Thorne':year<=2022?'Elizabeth II':null,mintage:extra.mintage||null,colour:extra.colour||null}];
 const design={id:`D${denom}-${slug(title)}${seriesId?'-'+slug(seriesId):''}${release?'-'+slug(release):''}`,title,denomination:denom,denomination_display:display[denom],...physical[denom],seriesId,releaseId:release||null,
   collectionTags:tags(title,seriesId),yearVariants:variants,searchAliases:extra.searchAliases||[],
   ...image,source_id:image?`ram_${denom}_circulation`:extra.source_id||null,
   image_status:image?'exact':extra.image_status||'pending',...extra};
 if(!design.reference_image){design.reference_image=extra.reference_image||null;design.reference_image_kind=extra.reference_image_kind||'unavailable';}
 designs.push(design);return design;
}
for(const [denom,title,key] of [[5,'Echidna','five-cents-standard-design'],[10,'Lyrebird','ten-cents-standard-design'],[20,'Platypus','twenty-cents-standard-design'],[50,'Commonwealth Coat of Arms (dodecagonal)','fifty cents standard Commonwealth'],[200,'Aboriginal Elder','two-dollar-standard-design']]){
 const years=[...new Set([...sources[String(denom)].standardYears,2025])].filter(y=>denom!==50||y>=1969).sort((a,b)=>a-b);
 add(denom,years[0],title,null,null,key,{yearVariants:years.map(year=>({id:`AU${denom}-${year}-${slug(title)}`,year,effigy:year>=2024?'Charles III – Daniel Thorne':year<=2022?'Elizabeth II':null,mintage:year===2025?{5:18001500,10:1250000,20:14375000,50:3690060,200:4000000}[denom]:null})),searchAliases:[title,'standard']});
}
add(50,1966,'Commonwealth Coat of Arms (round silver)',null,null,'fifty cents first standard',{composition:'80% silver, 20% copper',mass_grams:13.28,diameter_mm:31.5,yearVariants:[{id:'AU50-1966-ROUND-SILVER',year:1966,effigy:'Elizabeth II',mintage:null}],searchAliases:['round 50c','silver 50c']});
const federation=['NSW','Victoria','Queensland','South Australia','Western Australia','Tasmania','Northern Territory','ACT','Norfolk Island'];
const placeKey={NSW:'new-south-wales',Victoria:'victoria',Queensland:'queensland','South Australia':'south-australia','Western Australia':'western-australia',Tasmania:'tasmania','Northern Territory':'northern-territory',ACT:'australian-capital-territory','Norfolk Island':'norfolk-island'};
for(const place of federation)add(20,2001,`Federation — ${place}`,'federation',releaseId('federation',2001),`2001-centenary-federation-student-design-${placeKey[place]}`,{searchAliases:[place,'Centenary of Federation']});
for(const place of ['Commonwealth',...federation])add(50,2001,`Federation — ${place==='ACT'?'ACT / Canberra':place}`,'federation',releaseId('federation',2001),place==='Commonwealth'?'2001 Centenary of Federation. Featuring the 1912':place==='ACT'?'2001 Centenary of Federation. Featuring the Coat of Arms of Canberra':`2001 Centenary of Federation. Featuring the Coat of Arms of ${place==='Northern Territory'?'the Northern Territory':place}`,{searchAliases:['Centenary of Federation',place]});
function row(denom,year,title,seriesId,key,extra={}){return add(denom,year,title,seriesId,seriesId?releaseId(seriesId,year):null,key,{...partnerImage(seriesId,year,title),...releaseImage(denom,year,title,seriesId),...extra});}
for(const [denom,title,key] of [[5,'Decimal Currency Changeover','2016-obverse'],[10,'Decimal Currency Changeover','2016-obverse'],[20,'Decimal Currency Changeover','2016-obverse'],[50,'Decimal Currency Changeover','2016 obverse'],[200,'Decimal Currency Changeover','2016-50-anniversary-decimal']])row(denom,2016,title,'decimal50',key);
for(const [year,title,key] of [
 [1995,'50th Anniversary of the United Nations','1995-50-anniversary-united-nations'],[2001,'Sir Donald Bradman','2001-sir-donald-bradman'],[2010,'Centenary of the Australian Taxation Office','2010-centenary-australian-taxation'],[2011,'International Women’s Day','2011-international-womens-day'],[2011,'Royal Wedding: William & Catherine','2011-royal-wedding'],[2011,'International Year of Volunteers','2011-international-year-volunteers'],[2013,'Centenary of Canberra','2013-centenary-canberra']
])row(20,year,title,null,key);
for(const [year,title,seriesId,key] of [[2003,'Australia’s Volunteers','volunteers2003','2003-australia-volunteers'],[2005,'End of WWII','wwii60','2005-60-anniversary-end-world-war']])row(20,year,title,seriesId,key);
for(const [year,title,seriesId,key] of [
 [1970,'Captain Cook Bicentenary',null,'1970 bicentenary'],[1977,'Queen Elizabeth II Silver Jubilee',null,'1977 25th anniversary'],[1981,'Prince Charles & Lady Diana Royal Wedding',null,'1981  marriage'],[1982,'Brisbane XII Commonwealth Games',null,'1982 Brisbane'],[1988,'Australian Bicentenary','bicentenary','1988 Australian Bicentenary'],[1991,'25th Anniversary of Decimal Currency',null,'1991 25th'],[1994,'International Year of the Family',null,'1994 United Nations'],[1995,'50th Anniversary of End of WWII',null,'1995 50th'],[1998,'Bass & Flinders',null,'1998 200th'],[2000,'Millennium',null,'2000 Celebrating'],[2000,'Royal Visit',null,'2000 visit'],[2002,'Year of the Outback','outback','2002 Year of the Outback'],[2003,'Australia’s Volunteers','volunteers2003','2003 Commemorating'],[2004,'Primary School Student Design',null,'2004 Primary School'],[2005,'Melbourne 2006 Commonwealth Games Student Design',null,'2005 secondary school'],[2005,'End of WWII','wwii60','2005 60th'],[2010,'Australia Day',null,'2010 Australia Day'],[2014,'50th Anniversary of AIATSIS',null,'2014 50th'],[2017,'1967 Referendum / Mabo Anniversaries',null,'2017 50 anniversary'],[2019,'International Year of Indigenous Languages',null,'2019 AIATSIS'],[2024,'50 Years of NAIDOC Committee',null,'2024 50th'],[2026,'Unity / Gurindji Wave Hill Walk Off',null,'2026 Unity']
])row(50,year,title,seriesId,key);
const excludedReason=coin=>{
 const s=coin.series_id||'',id=coin.id;
 if(['possum_magic','gc2018','mr_squiggle','wiggles30','bluey'].includes(s))return 'Packaged or collector-only $1 issue';
 if(s==='afl2023'&&!['AU1-2023-AFL2023-PREMIERSHIP','AU1-2023-AFL2023-AFLW'].includes(id))return 'AFL club coin or collector colour version';
 if(s==='aussie_big_things_2'&&!id.includes('-TILL-'))return 'Purchasable 2025 Big Things location coin';
 if(s==='bluey_dollarbucks'&&!['AU1-2024-BLUEY_DOLLARBUCKS-BLUEY','AU1-2024-BLUEY_DOLLARBUCKS-BINGO'].includes(id))return 'Bluey collector or colour version';
 if(s==='gach2'&&id.endsWith('GCOLOUR')||s==='gach3'&&id.endsWith('XCOLOUR')||s==='aussie_big_things'&&id.endsWith('CODCOLOUR'))return 'Collector colour version';
 return null;
};
const excluded=legacy.filter(excludedReason).map(coin=>({id:coin.id,reason:excludedReason(coin),title:coin.title}));
const oldSeries={anzac_centennial:'anzac',decimal_currency_50:'decimal50',dollar_discovery:'discovery',gach1:'gach',gach2:'gach',gach3:'gach',australian_dinosaurs:'dinosaurs',afl2023:'afl',afl2024:'afl',aussie_big_things:'big_things',aussie_big_things_2:'big_things',matildas:'matildas',bluey_dollarbucks:'bluey',tokyo2020:'olympic',donation:null};
const specialStandalone={'AU1-1988-BICENTENARY':'bicentenary','AU1-2001-FEDERATION':'federation','AU1-2002-OUTBACK':'outback','AU1-2003-VOLUNTEERS':'volunteers2003','AU1-2005-WWII':'wwii60'};
const accepted=legacy.filter(coin=>!excludedReason(coin));
const groups=new Map();
for(const coin of accepted){
 const seriesId=oldSeries[coin.series_id]||specialStandalone[coin.id]||null;
 const release=seriesId?releaseId(seriesId,coin.year):null;
 const key=coin.series_id==='std_roos'?'standard':coin.series_id==='donation'?'donation':coin.series_id==='anzac_centennial'?'anzac':`${coin.id.replace(/^AU1-\d{4}-/,'')}`;
 const groupKey=key==='standard'||key==='donation'||key==='anzac'?key:`${seriesId}:${release}:${coin.title}`;
 if(!groups.has(groupKey))groups.set(groupKey,{representative:coin,seriesId,release,variants:[]});
 groups.get(groupKey).variants.push(coin);
}
for(const {representative:coin,seriesId,release,variants} of groups.values()){
 const name=coin.title;
 add(100,coin.year,name,seriesId,release,'',{
   reference_image:coin.reference_image,reference_image_kind:coin.reference_image_kind,reference_image_source_id:coin.reference_image_source_id,
   source_id:coin.source_id,image_status:coin.reference_image?'catalogue':'pending',
   yearVariants:variants.map(v=>({id:v.id,year:v.year,effigy:v.obverse_effigy,mintage:v.mintage,colour:v.colour,variantLabel:v.variant_label||null,reference_image:v.reference_image,reference_image_kind:v.reference_image_kind})),
   searchAliases:coin.series_id?.startsWith('gach')?[coin.title.split(' — ').at(-1)]:[],
   legacyIds:variants.map(v=>v.id)
 });
}
// Two-dollar designs documented on the Mint's circulating-coin pages and
// partner till-coin announcements. A missing exact image stays explicitly pending.
for(const [year,title,key] of [
 [2012,'Remembrance Poppy (uncoloured)','2012-remembrance-day-poppy-no-colour'],[2012,'Remembrance Poppy (red)','2012-remembrance-day-red-poppy'],[2013,'Coronation (purple)','2013 60 anniversary coronation'],[2014,'Remembrance Day Dove / Olive Branch (green)','2014-remembrance-day-dove'],[2015,'100 Years of ANZAC / Lest We Forget (red)','2015-100-years-anzac'],[2015,'In Flanders Fields (orange)','Flanders Field Coin'],[2017,'Remembrance / Rosemary','2017-remembrance-green-leaves'],[2017,'Napier Waller Mosaic','2017-napier-waller'],[2018,'Eternal Flame','2018-eternal-flame'],[2018,'Armistice Centenary','2018-100-anniversary'],[2018,'Invictus Games','2018-invictus-games'],[2019,'100 Years of Repatriation','2019-100-years-repatriation'],[2019,'National Police Remembrance','2019-30-anniversary-national-police'],[2019,'Wallabies','2019-wallabies'],[2020,'Firefighters','2020-firefighters'],[2020,'75th Anniversary End of WWII','2020-75-anniversary-end-world-war'],[2020,'Women’s T20 World Cup','2020-womens-t20'],[2021,'50th Anniversary Aboriginal Flag','2021-50-anniversary-aboriginal-flag'],[2021,'Ambulance Services','2021-ambulance-service'],[2021,'Indigenous Military Service','2021-indigenous-military'],[2022,'Honey Bee','2022-honey-bee'],[2022,'Frontline Workers','2022-frontline'],[2022,'75 Years of Peacekeeping','2022-75-anniversary-peacekeeping'],[2022,'Socceroos Centenary','2022-socceroos'],[2024,'War Animals Remembrance / Purple Poppy','2024-war-animals'],[2025,'Australian Women’s Weekly Birthday Cake Book / Hickory Dickory Watch','2025-hickory'],[2025,'80 Years On / WWII Poppy Wreath','2025-80-years'],[2026,'Dawn Service','2026-dawn-service']
])row(200,year,title,null,key,year===2024&&title.includes('Purple Poppy')?{mintage:2089721,source_id:'ram_2024_25_annual_report'}:{});
row(200,2025,'30th Anniversary of the Torres Strait Islander Flag',null,'',{source_id:'ram_2024_25_annual_report',mintage:2087802,searchAliases:['Torres Strait flag','Dhari']});
for(const [year,seriesId,names] of [
 [2016,'olympic',['Blue Ring','Black Ring','Red Ring','Yellow Ring','Green Ring','Paralympic / Wheelchair Racer']],
 [2024,'olympic',['AllezAus','Community','Olympism','Australian Paralympic Team']],
 [2017,'possum',['Invisible Hush','Hush Sees Her Tail','Happy Hush']],
 [2018,'goldcoast',['Emblem','Borobi','Team Logo']],
 [2019,'squiggle',['Mr Squiggle','Blackboard','Gus the Snail','Bill Steamshovel']],
 [2022,'commonwealth_team',['A','U','S']],
 [2026,'commonwealth_team',['Gymnastics','3×3 Wheelchair Basketball','Athletics']],
 [2021,'wiggles',['Captain Feathersword','Dorothy the Dinosaur','Henry the Octopus','Wags the Dog']],
 [2023,'vegemite',['100 Mitey Years','Tastes Like Australia','Happy Little Vegemites']],
 [2023,'matildas',['Bold','Fierce','United']],
 [2026,'bluey',['Bluey','Bingo']],
 [2024,'nrl',['Men’s Premiership','Women’s Premiership / NRLW']],
 [2025,'australian_open',['Men’s','Women’s']],
 [2025,'rugby',['Wallabies','Wallaroos']]
])for(const name of names)row(200,year,`${series.find(s=>s.id===seriesId).title} — ${name}`,seriesId,'');
const byDenom=Object.fromEntries([5,10,20,50,100,200].map(n=>[display[n],designs.filter(d=>d.denomination===n).length]));
const ids=designs.flatMap(d=>d.yearVariants.map(v=>v.id));
const designIds=designs.map(d=>d.id);
const counts={designs:designs.length,byDenom,series:series.length,releases:releases.length,issueIds:ids.length,duplicateIds:ids.filter((id,index)=>ids.indexOf(id)!==index),duplicateDesignIds:designIds.filter((id,index)=>designIds.indexOf(id)!==index)};
const missingImages=designs.filter(d=>!d.reference_image).map(d=>d.id);
const badParents=designs.filter(d=>d.seriesId&&!series.some(s=>s.id===d.seriesId)||d.releaseId&&!releases.some(r=>r.id===d.releaseId&&r.seriesId===d.seriesId)).map(d=>d.id);
const output={meta:{catalogue_version:'1.0.0-circulation-draft',scope:'Circulating and deliberate till-change designs only',source_pages:Object.values(sources).map(s=>s.source),canonical_target:270,taxonomy_correction:'Tokyo 2020 six designs are $1, per Royal Australian Mint Woolworths program. 2025 Torres Strait Islander Flag $2 circulated. Researched denomination targets: $1 136, $2 75.'},series,releases,designs};
await writeFile('public/catalogue-v2.json',JSON.stringify(output,null,2)+'\n');
await writeFile('scripts/circulation-audit.json',JSON.stringify({counts,originalTargets:{$1:130,$2:80,'5c':2,'10c':2,'20c':20,'50c':35,total:269},researchedTargets:{$1:136,$2:75,'5c':2,'10c':2,'20c':20,'50c':35,total:270},corrections:[{type:'denomination',details:'Tokyo 2020 six coloured Olympic and Paralympic coins are $1 till-change issues, not $2.',source:'https://www.ramint.gov.au/collect/national-coin-collection/corporate-partnerships/woolworths-programs/tokyo-olympic-and'},{type:'missing_design',details:'2025 Torres Strait Islander Flag $2 was produced for circulation (2,087,802 pieces); exclude C-mintmark collector versions.',source:'https://www.ramint.gov.au/sites/default/files/2025-11/2024-25%20Annual%20Report.pdf'}],missingImages,badParents,excluded},null,2)+'\n');
console.log(JSON.stringify({counts,missingImages:missingImages.length,badParents:badParents.length,excluded:excluded.length},null,2));
