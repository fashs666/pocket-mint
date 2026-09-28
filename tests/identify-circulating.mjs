import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDenomination,rankCirculatingDesigns,independentClues,shortlistDesigns} from '../src/identify-circulating.js';
import worker from '../src/index.js';

const circulating=JSON.parse(await readFile('public/catalogue-v2.json','utf8'));
const legacy=JSON.parse(await readFile('public/catalogue.json','utf8'));
const reverse='data:image/jpeg;base64,AA==';
assert.equal(parseDenomination('DENOM=$2; CONFIDENCE=91').denomination,'$2');
assert.equal(parseDenomination('DENOM=unknown; CONFIDENCE=100').denomination,'unknown');
assert.deepEqual(independentClues('DENOM=$2; CONFIDENCE=95; WORDS=PURPLE POPPY; MOTIF=flower'),{words:'PURPLE POPPY',motif:'flower'});
assert.equal(shortlistDesigns(circulating.designs.filter(design=>design.denomination===200),{words:'two dollars',motif:'unknown'}).length,0);

async function identify(answers,overrides={}) {
  const calls=[];
  const response=await worker.fetch(new Request('https://pocket-mint.test/api/identify',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({mode:'circulating',reverse,...overrides})
  }),{
    AI:{run:async(_model,input)=>{const prompt=input.messages[1].content[0].text;calls.push(prompt);return {response:answers.shift()};}},
    ASSETS:{fetch:async request=>new Response(JSON.stringify(String(request).includes('catalogue-v2')?circulating:legacy))}
  });
  return {status:response.status,data:await response.json(),calls};
}

for(const [denom,title] of [['5c','Echidna'],['10c','Lyrebird'],['20c','Platypus'],['50c','Commonwealth Coat of Arms (dodecagonal)'],['$2','War Animals Remembrance / Purple Poppy']]){
  const motif=({Echidna:'echidna',Lyrebird:'lyrebird',Platypus:'platypus','Commonwealth Coat of Arms (dodecagonal)':'coat of arms','War Animals Remembrance / Purple Poppy':'purple poppy'})[title];
  const {data,calls}=await identify([`DENOM=${denom}; CONFIDENCE=95; WORDS=unknown; MOTIF=${motif}`,`DESIGN=${title}; CONFIDENCE=90`]);
  assert.equal(data.observed.denomination,denom);
  assert.equal(data.matches.length,1,`${denom} should produce a result`);
  assert.equal(circulating.designs.find(design=>design.title===title&&design.denomination_display===denom).yearVariants.some(issue=>issue.id===data.matches[0].id),true);
  assert.equal(calls.length,2);
  assert.equal(calls[1].includes('One Australian '+denom+' coin'),true);
  console.log(`PASS ${denom} visual design: ${title}`);
}
const dollars=await identify(['DENOM=$1; CONFIDENCE=92','DESIGN=100 Years of Qantas; TYPE=commemorative; WORDS=Qantas airplane; SUBJECT=aircraft; CONFIDENCE=90']);
assert.equal(dollars.data.matches[0]?.id,'AU1-2020-QANTAS');
console.log('PASS $1 original identifier path');
const collector=await identify(['DENOM=$1; CONFIDENCE=95','DESIGN=Bluey Christmas; TYPE=commemorative; WORDS=Bluey Christmas; SUBJECT=Bluey; CONFIDENCE=95']);
assert.equal(collector.data.uncertain,true);
assert.equal(collector.data.matches.some(match=>match.id==='AU1-2025-BLUEY-CHRISTMAS'),false);
console.log('PASS $1 collector-only result excluded');
const unsure=await identify(['DENOM=unknown; CONFIDENCE=32']);
assert.equal(unsure.data.uncertain,true);assert.equal(unsure.data.matches.length,0);
const mismatched=await identify(['DENOM=$2; CONFIDENCE=95'],{denomination:'5c'});
assert.equal(mismatched.data.matches.length,0);assert.match(mismatched.data.reason,/photo appears/);
const noArtwork=await identify(['DENOM=50c; CONFIDENCE=88; WORDS=unknown; MOTIF=coat of arms','DESIGN=unknown; CONFIDENCE=80']);
assert.equal(noArtwork.data.matches.length,0);
const generic=await identify(['DENOM=$2; CONFIDENCE=92; WORDS=two dollars; MOTIF=unknown']);
assert.equal(generic.data.matches.length,0);assert.equal(generic.calls.length,1);
assert.equal(generic.data.uncertain,true);
const badGuess=rankCirculatingDesigns(circulating.designs,'$2','DESIGN=Echidna; CONFIDENCE=99');
assert.equal(badGuess.matches.length,0);
const withYear=await identify(['DENOM=20c; CONFIDENCE=91; WORDS=BRADMAN; MOTIF=cricketer','DESIGN=Sir Donald Bradman; CONFIDENCE=90','YEAR=2001; CONFIDENCE=95'],{obverse:reverse});
assert.equal(withYear.data.matches[0]?.id,'AU20-2001-SIR-DONALD-BRADMAN');
const wrongYear=await identify(['DENOM=20c; CONFIDENCE=91; WORDS=BRADMAN; MOTIF=cricketer','DESIGN=Sir Donald Bradman; CONFIDENCE=90','YEAR=2018; CONFIDENCE=95'],{obverse:reverse});
assert.equal(wrongYear.data.matches.length,0);
console.log('PASS unknown, contradictory, wrong-design and readable-year safeguards');
