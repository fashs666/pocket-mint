import {readFile, access, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const load=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const [catalogue,legacy,prior]=await Promise.all([
  load('public/catalogue-v2.json'),load('public/catalogue.json'),load('scripts/circulation-audit.json')
]);
const issues=[];
function flag(category,severity,detail,extra={}){issues.push({category,severity,detail,...extra});}
const counts={designs:catalogue.designs.length,issueVariants:0,byDenomination:{},series:catalogue.series.length,legacyRecords:legacy.coins.length};
const designIds=new Set(),issueIds=new Set(),legacyIds=new Set(legacy.coins.map(c=>c.id));
const seriesIds=new Set(catalogue.series.map(s=>s.id)),releaseIds=new Set(catalogue.releases.map(r=>r.id));
const designsById=new Map();
for(const d of catalogue.designs){
  if(!d.id||designIds.has(d.id))flag('duplicate_or_invalid_id','error','Duplicate or missing design ID',{designId:d.id});
  designIds.add(d.id);designsById.set(d.id,d);
  const denom=d.denomination_display||String(d.denomination);
  counts.byDenomination[denom]=(counts.byDenomination[denom]||0)+1;
  if(![5,10,20,50,100,200].includes(d.denomination))flag('metadata','error','Invalid denomination',{designId:d.id,denomination:d.denomination});
  if(d.seriesId&&!seriesIds.has(d.seriesId))flag('metadata','error','Unknown series',{designId:d.id,seriesId:d.seriesId});
  if(d.releaseId&&!releaseIds.has(d.releaseId))flag('metadata','error','Unknown release',{designId:d.id,releaseId:d.releaseId});
  if(!d.title?.trim())flag('metadata','error','Missing design title',{designId:d.id});
  if(!Array.isArray(d.yearVariants)||!d.yearVariants.length)flag('metadata','error','Design has no year variants',{designId:d.id});
  for(const v of d.yearVariants||[]){
    counts.issueVariants++;
    if(!v.id||issueIds.has(v.id))flag('duplicate_or_invalid_id','error','Duplicate or missing issue ID',{designId:d.id,issueId:v.id});
    issueIds.add(v.id);
    if(!Number.isInteger(Number(v.year))||Number(v.year)<1966||Number(v.year)>new Date().getFullYear()+1)flag('metadata','warning','Unusual or missing issue year',{designId:d.id,issueId:v.id,year:v.year});
    if(!legacyIds.has(v.id))flag('catalogue_sync','warning','Browse issue not represented in legacy Identify catalogue; investigate intended matching scope',{designId:d.id,issueId:v.id});
  }
}
for(const coin of legacy.coins){
  if(!issueIds.has(coin.id))flag('catalogue_sync','warning','Legacy Identify issue absent from v2 Browse catalogue',{issueId:coin.id});
  if(!coin.reference_image)flag('missing_reference_image','warning','Legacy Identify coin lacks reference image',{issueId:coin.id});
  else if(!/^https?:\/\//i.test(coin.reference_image)){
    try{await access(path.join(root,'public',coin.reference_image));}
    catch{flag('broken_image','error','Referenced local image file is missing',{issueId:coin.id,image:coin.reference_image});}
  }
}
const expected={
  'gach3':Array.from({length:26},(_,i)=>'AU1-2022-GACH3-'+String.fromCharCode(65+i)),
  'big_things_2':Array.from({length:2},(_,i)=>'AU1-2025-AUSSIE_BIG_THINGS_2-TILL-'+(i+1))
};
for(const [group,ids] of Object.entries(expected)){
  for(const id of ids)if(!issueIds.has(id))flag('known_series_gap','error','Expected verified-series entry is absent',{group,issueId:id});
}
for(const d of catalogue.designs){
  if(/bluey/i.test([d.title,d.seriesId].join(' '))&&!d.yearVariants?.length)flag('known_series_gap','error','Bluey design missing year issue',{designId:d.id});
}
const targets=prior.researchedTargets||{};
for(const [denom,target] of Object.entries(targets)){
  if(denom==='total')continue;
  if((counts.byDenomination[denom]||0)<target)flag('baseline_regression','error','Design count fell below researched baseline',{denomination:denom,actual:counts.byDenomination[denom]||0,baseline:target});
}
const summary={generatedAt:new Date().toISOString(),counts,issuesByCategory:Object.fromEntries([...new Set(issues.map(i=>i.category))].map(k=>[k,issues.filter(i=>i.category===k).length])),errors:issues.filter(i=>i.severity==='error').length,warnings:issues.filter(i=>i.severity==='warning').length};
const report={summary,issues,notes:[
  'Catalogue-sync warnings are not proven missing circulating coins: the legacy Identify catalogue may deliberately cover a narrower set.',
  'A missing official issue cannot be inferred solely from current data. Independent Mint/Australia Post reference manifests must be reviewed and maintained.',
  'The checker is read-only; no catalogue, identification engine, collection, or cloud AI changes are performed.'
]};
const output=process.argv.includes('--write');
if(output){await mkdir(path.join(root,'reports'),{recursive:true});await writeFile(path.join(root,'reports/catalogue-integrity.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(summary,null,2));
for(const issue of issues.slice(0,25))console.log(`[${issue.severity}] ${issue.category}: ${issue.detail} ${issue.issueId||issue.designId||''}`);
if(issues.length>25)console.log(`... ${issues.length-25} additional items; run with --write for full JSON report`);
if(process.argv.includes('--strict')&&summary.errors)process.exitCode=1;
