import {readFile,writeFile,mkdir} from 'node:fs/promises';
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const [browse,identify,master]=await Promise.all([read('public/catalogue-v2.json'),read('public/catalogue.json'),read('scripts/circulation-master.json')]);
const browseVariants=new Map(browse.designs.flatMap(d=>(d.yearVariants||[]).map(v=>[v.id,{...v,design:d}])));
const identifyCoins=new Map(identify.coins.map(c=>[c.id,c]));
const issues=[];
const add=(code,severity,id,detail)=>issues.push({code,severity,id,detail});
const seen=new Set();
for(const d of browse.designs){
 if(seen.has(d.id))add('duplicate_design','error',d.id,'Duplicate design id');
 seen.add(d.id);
}
for(const source of master.expected){
 if(source.eligibility!=='eligible')continue;
 if(!browseVariants.has(source.id))add('missing_verified_issue','error',source.id,'Verified master entry absent from Browse');
 if(!identifyCoins.has(source.id))add('identify_scope_review','info',source.id,'Present or expected in Browse; not in legacy Identify. Assess identification scope, not automatic omission');
}
for(const series of master.seriesExpectations||[]){
 if(!series.suffixes)continue;
 for(const suffix of series.suffixes){
  const id=series.pattern+suffix;
  if(!browseVariants.has(id))add('series_gap_pending_source','warning',id,'Series checklist issue absent; source confirmation still required');
 }
}
const browseOnly=[...browseVariants.keys()].filter(id=>!identifyCoins.has(id));
const identifyOnly=[...identifyCoins.keys()].filter(id=>!browseVariants.has(id));
const summary={browseDesigns:browse.designs.length,browseVariants:browseVariants.size,legacyIdentifyRecords:identifyCoins.size,browseOnly:browseOnly.length,identifyOnly:identifyOnly.length,errors:issues.filter(i=>i.severity==='error').length,warnings:issues.filter(i=>i.severity==='warning').length,information:issues.filter(i=>i.severity==='info').length};
const report={summary,issues,browseOnly,identifyOnly,interpretation:'Browse-only/Identify-only differences are scope differences by default. Verify releases and candidate eligibility before treating them as bugs.'};
if(process.argv.includes('--write')){await mkdir('reports',{recursive:true});await writeFile('reports/catalogue-scope-report.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({summary,issues:issues.slice(0,30)},null,2));
if(process.argv.includes('--strict')&&summary.errors)process.exitCode=1;
