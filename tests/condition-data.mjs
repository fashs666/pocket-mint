import assert from 'node:assert/strict';
import '../public/condition-data.js';
const d=globalThis.PocketMintConditionData;
assert.deepEqual(d.grades.map(g=>g.grade),['G','VG','F','VF','EF','aUNC','UNC','CHU','GEM']);
for(const grade of d.grades){assert.ok(grade.name&&grade.description&&grade.lookFor.length);assert.equal(d.normalise({condition:grade.name}).conditionGrade,grade.grade);}
assert.equal(d.normalise({condition:'About Uncirculated'}).conditionGrade,'aUNC');
assert.equal(d.normalise({condition:'Poor'}).conditionGrade,null);
assert.equal(d.normalise({condition:'Poor'}).condition,'Poor');
assert.equal(d.normalise({condition:'Fine',conditionGrade:null}).conditionGrade,null,'explicit unset is not remigrated');
assert.equal(d.normalise({}).conditionGrade,null);
assert.deepEqual(d.normalise({conditionGrade:'EF',conditionIssues:['toning','scratched','toning','bad']}).conditionIssues,['toning','scratched']);
assert.equal(d.normalise({conditionGrade:'EF',conditionIssues:['cleaned','dented']}).conditionGrade,'EF');
for(const [cents,id] of [[5,'5'],[10,'10'],[20,'20'],[50,'50'],[100,'1'],[200,'2']])assert.equal(d.denominationFor({denomination_cents:cents}),id);
const r=(denomination,designId,image)=>({grade:'VF',denomination,designId,image,source:'Test fixture',rightsNote:'Test only'});
const refs=[r(null,null,'condition-references/general.webp'),r('2',null,'condition-references/two.webp'),r('2','design','condition-references/design.webp'),r('50',null,'condition-references/fifty.webp'),r(null,null,'https://example.com/uncontrolled.webp'),r(null,null,'condition-references/../escape.webp')];
assert.deepEqual(d.referenceCandidates('VF','2','design',refs).map(r=>r.image),['condition-references/design.webp','condition-references/two.webp','condition-references/general.webp']);
assert.deepEqual(d.referenceCandidates('VF','10',null,refs).map(r=>r.image),['condition-references/general.webp']);
assert.equal(d.referenceCandidates('EF','2',null,refs).length,0);
console.log('Condition model: grades, legacy conversion, unset, independent issues and controlled reference fallback passed.');

for(const g of d.grades){assert.ok(d.referenceSources[g.grade].url.endsWith(`#page=${d.referenceSources[g.grade].page}`));assert.equal(d.referenceSources[g.grade].status,"publisher_link_only");}
assert.equal(d.referenceAcquisition[0].status,"awaiting_local_download_and_visual_review");assert.equal(d.referenceAcquisition[0].license,"CC BY 4.0");
