import {readFile,writeFile,mkdir} from 'node:fs/promises';
const catalogue=JSON.parse(await readFile('public/catalogue-v2.json','utf8'));
const variants=catalogue.designs.flatMap(d=>(d.yearVariants||[]).map(v=>({...v,designId:d.id,title:d.title,denomination:d.denomination_display})));
const byId=new Map(variants.map(v=>[v.id,v]));
const byLabel=new Map(variants.map(v=>[String(v.year)+' '+v.title,v]));
const file=process.argv.find((arg,i)=>i>1&&!arg.startsWith('--'));
if(!file){console.error('Usage: npm run audit:identify -- path/to/exported-tests.json');process.exit(2);}
const raw=JSON.parse(await readFile(file,'utf8'));
const rows=Array.isArray(raw)?raw:Array.isArray(raw.tests)?raw.tests:Array.isArray(raw.identificationTests)?raw.identificationTests:Array.isArray(raw.records)?raw.records:[];
const findings=[];
for(const [index,t] of rows.entries()){
 const expectedId=t.expected_coin_id||t.expectedCoinId||t.expected_id||t.correct_coin_id||null;
 const expected=byId.get(expectedId)||byLabel.get(t.expected_label)||null;
 const predictedId=t.predicted_coin_id||t.predictedCoinId||t.coin_id||null;
 const predicted=byId.get(predictedId)||null;
 const candidates=(t.candidates||t.matches||t.results||[]).map(x=>typeof x==='string'?x:x?.id||x?.coin_id).filter(Boolean);
 const catalogueStatus=expected?'present_in_browse':expectedId?'unknown_expected_id':'unresolved_expected_coin';
 let category;
 if(!expected)category='needs_ground_truth';
 else if(predicted?.id===expected.id)category='correct';
 else if(predicted?.designId===expected.designId)category='correct_design_wrong_year';
 else if(candidates.includes(expected.id))category='ranking_or_confirmation_failure';
 else if(predicted||candidates.length)category='wrong_candidate_or_no_top_match';
 else category='no_match_recorded';
 const identifyScope=t.expected_coin_id&&expected?undefined:undefined;
 findings.push({index,testId:t.id||null,flow:t.flow||null,expectedId:expected?.id||expectedId,predictedId:predicted?.id||predictedId,category,catalogueStatus,candidateCount:candidates.length,aiCallsTriggered:0});
}
const totals=Object.fromEntries([...new Set(findings.map(f=>f.category))].map(c=>[c,findings.filter(f=>f.category===c).length]));
const report={input:file,tests:rows.length,processed:findings.length,classificationTotals:totals,aiCalls:0,findings,notes:['Historical reports cannot be re-run through image recognition without the original images and matching harness.','This offline analysis makes no Workers AI requests.','If candidate lists are absent, rank failures cannot be distinguished from recognition misses.']};
await mkdir('reports',{recursive:true});await writeFile('reports/identification-misses.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({tests:rows.length,classificationTotals:totals,aiCalls:0},null,2));
