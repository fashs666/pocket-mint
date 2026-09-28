import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const catalogue=JSON.parse(await readFile('public/catalogue-v2.json','utf8'));
const variants=catalogue.designs.flatMap(design=>design.yearVariants.map(variant=>({...variant,design_id:design.id,denomination_display:design.denomination_display,title:design.title})));
const find=(denom,title)=>variants.find(coin=>coin.denomination_display===denom&&coin.title===title);
const context={window:{}};
vm.runInNewContext(await readFile('public/identification-report.js','utf8'),context);
const {resolveExpected,fields}=context.window.PocketMintIdentificationReport;
const five=find('5c','Echidna'),two=find('$2','War Animals Remembrance / Purple Poppy');
assert.ok(five&&two);
assert.equal(resolveExpected(`${five.year} ${five.title}`,variants.filter(coin=>coin.denomination_display==='5c')).id,five.id);
assert.equal(resolveExpected(`${five.year} ${five.title}`,variants.filter(coin=>coin.denomination_display==='$2')),null);
for(const flow of ['single','batch']){
  const right=fields({flow,expectedLabel:`${five.year} ${five.title}`,expectedCoin:five,predictedCoin:five});
  assert.deepEqual([right.denomination_correct,right.design_correct,right.issue_correct],[true,true,true]);
  assert.equal(right.flow,flow);
  const wrong=fields({flow,expectedLabel:`${five.year} ${five.title}`,expectedCoin:five,predictedCoin:two});
  assert.deepEqual([wrong.denomination_correct,wrong.design_correct,wrong.issue_correct],[false,false,false]);
  const missed=fields({flow,expectedLabel:`${five.year} ${five.title}`,expectedCoin:five,predictedCoin:null});
  assert.deepEqual([missed.denomination_correct,missed.design_correct,missed.issue_correct],[false,false,false]);
  const valueOnly=fields({flow,expectedLabel:`${five.year} ${five.title}`,expectedCoin:five,predictedCoin:null,predictedDenomination:'5c'});
  assert.deepEqual([valueOnly.denomination_correct,valueOnly.design_correct,valueOnly.issue_correct],[true,false,false]);
}
const echidnas=variants.filter(coin=>coin.design_id===five.design_id);
assert.ok(echidnas.length>1);
const differentYear=fields({flow:'batch',expectedLabel:`${echidnas[1].year} ${echidnas[1].title}`,expectedCoin:echidnas[1],predictedCoin:echidnas[0]});
assert.deepEqual([differentYear.denomination_correct,differentYear.design_correct,differentYear.issue_correct],[true,true,false]);

const handlers={batchIdentifyAll:{},batchAddConfirmed:{}};
const batchContext={window:{},document:{getElementById:id=>handlers[id]},catalogue:variants,browseCatalogue:variants,
  coinById:id=>variants.find(coin=>coin.id===id),designVariants:coin=>variants.filter(item=>item.design_id===coin.design_id)};
vm.runInNewContext(await readFile('public/batch-identification.js','utf8'),batchContext);
const classified=batchContext.window.BatchIdentificationCore.classify({matches:[{id:two.id,confidence:.89}],uncertain:false,observed:{year:two.year,denomination:'$2'}});
assert.equal(classified.predictedCoinId,two.id);
assert.equal(classified.choices[0].coin.denomination_display,'$2');
assert.equal(classified.status,'confident');
const noMatch=batchContext.window.BatchIdentificationCore.classify({matches:[],uncertain:true,observed:{denomination:'unknown'}});
assert.equal(noMatch.predictedCoinId,null);
assert.match(await readFile('public/batch-identification.js','utf8'),/mode:'circulating',obverse:null,reverse/);
console.log('PASS single and batch value, design, issue scoring; six-denomination batch routing; no-match recording');

// The correct-result shortcut can save without the denomination, title, or
// outcome radio having been supplied by the user.
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{value:'',disabled:false,textContent:'',classList:{add(){},remove(){}}});return elements.get(id);}
const saved=[];
const shortcut={window:{},document:{getElementById:element,querySelector:()=>null},crypto:{randomUUID:()=>`test-${saved.length+1}`},
  catMeta:{catalogue_version:'test'},collectionCoins:()=>variants,designVariants:coin=>variants.filter(item=>item.design_id===coin.design_id),
  put:async(store,test)=>{assert.equal(store,'identificationTests');saved.push(test);},identificationTests:[],renderAll:()=>{},
  browseCatalogue:variants,catalogue:variants,Math,Date,JSON};
vm.createContext(shortcut);
vm.runInContext(await readFile('public/identification-report.js','utf8'),shortcut);
vm.runInContext(await readFile('public/identify.js','utf8'),shortcut);
shortcut.topCoin=five;
vm.runInContext('identifyState.results=[{coin:topCoin,confidence:90,reasons:[]}]',shortcut);
element('identifyExpectedDenomination').value='5c';
element('identifyExpected').value=`${five.year} ${five.title}`;
await shortcut.saveIdentificationTest('correct');
assert.equal(saved.length,1);
assert.equal(saved[0].denomination_correct,true);
assert.equal(saved[0].design_correct,true);
assert.equal(saved[0].issue_correct,null);
assert.equal(saved[0].expected_coin_id,null);
assert.equal(element('identifyTestCorrect').disabled,true);
console.log('PASS one-tap correct report saves value and design; unknown year is not scored');
