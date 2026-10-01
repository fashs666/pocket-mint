import {DENOMINATIONS,parseDenomination,shortlistDesigns,rankCirculatingDesigns} from './identify-circulating.js';

const field=(answer,key)=>String(answer||'').match(new RegExp(`\\b${key}\\s*=\\s*([^;\\n]+)`,'i'))?.[1]?.split(/\|\s*[A-Z_]+\s*=/i)[0]?.trim()||'';
const confidence=answer=>Math.max(0,Math.min(100,Number(field(answer,'CONFIDENCE'))||0));
const text=value=>Array.isArray(value)?value.map(text).filter(Boolean).join(' '):String(value||'').trim();
export function normalizeSingleObservation(answer){
  if(answer&&typeof answer==='object')return {denomination_reading:text(answer.denomination_reading||answer.denomination),denomination_confidence:Number(answer.denomination_confidence??answer.confidence)||0,words:text(answer.words),motif:text(answer.motif)};
  return {denomination_reading:field(answer,'DENOM'),denomination_confidence:confidence(answer),words:field(answer,'WORDS'),motif:field(answer,'MOTIF')};
}
export function readSingleDenomination(answer){
  const observation=normalizeSingleObservation(answer);
  const original={...parseDenomination(answer),confidence:Math.max(0,Math.min(100,observation.denomination_confidence))};
  const value=observation.denomination_reading.toLowerCase().replace(/["'`]/g,'').replace(/\s+/g,' ').trim();
  const aliases={'1':'$1','2':'$2','5':'5c','10':'10c','20':'20c','50':'50c','1 dollar':'$1','one dollar':'$1','2 dollars':'$2','two dollars':'$2','5 cents':'5c','five cents':'5c','10 cents':'10c','ten cents':'10c','20 cents':'20c','twenty cents':'20c','50 cents':'50c','fifty cents':'50c','$ 1':'$1','$ 2':'$2'};
  const alternatives=[...new Set(value.split('|').map(part=>part.trim()).map(part=>Object.hasOwn(DENOMINATIONS,part)?part:aliases[part]).filter(Boolean))];
  const denomination=alternatives.length===1?alternatives[0]:original.denomination;
  const words=observation.words;
  const readable=[['$1',/\b(?:one|1)\s+dollars?\b/i],['$2',/\b(?:two|2)\s+dollars?\b/i],['5c',/\b(?:five|5)\s+cents?\b/i],['10c',/\b(?:ten|10)\s+cents?\b/i],['20c',/\b(?:twenty|20)\s+cents?\b/i],['50c',/\b(?:fifty|50)\s+cents?\b/i]].filter(([,pattern])=>pattern.test(words));
  // Only explicit face-value lettering can repair an unknown formatted value.
  // Neither colour, relative size nor a familiar motif is sufficient.
  if(readable.length===1){
    if(denomination!=='unknown'&&denomination!==readable[0][0])return {...original,denomination:'unknown',confidence:0,conflict:true};
    return {...original,denomination:readable[0][0],face_value_read:true};
  }
  return {...original,denomination};
}
const roos=title=>/^(Five Kangaroos|Mob of Six Roos)$/.test(title);
const generic=new Set(['unknown','none','coin','coins','australia','australian','dollar','dollars','cent','cents','one','two','five','ten','twenty','fifty','gold','golden','silver','round','metal','colour','coloured','color','design','portrait','year']);
export function hasDesignClues(clues){return `${clues.words} ${clues.motif}`.toLowerCase().split(/[^a-z]+/).some(word=>word.length>2&&!generic.has(word));}

export function singleCoinCandidates(designs,clues){
  clues={words:text(clues.words),motif:text(clues.motif)};
  if(!hasDesignClues(clues))return [];
  const hints={Echidna:'spiny spines anteater',Lyrebird:'bird tail feathers',Platypus:'duck bill swimming', 'Commonwealth Coat of Arms (dodecagonal)':'shield emu kangaroo coat arms', 'Aboriginal Elder':'aboriginal indigenous man elder stars', 'Five Kangaroos':'kangaroos roos group mob', 'Mob of Six Roos':'kangaroos roos group mob'};
  const expanded=designs.map(design=>({...design,searchAliases:[...(design.searchAliases||[]),hints[design.title]||'']}));
  const shortlist=shortlistDesigns(expanded,clues);
  // Wording is a ranking aid, not a reason to exclude every possible design.
  const tokens=value=>[...new Set(text(value).toLowerCase().split(/[^a-z]+/).filter(word=>word.length>=4&&!generic.has(word)))];
  const score=design=>{
    const labels=tokens([design.title,...(design.searchAliases||[]),hints[design.title]||'']);
    const hits=value=>tokens(value).filter(token=>labels.some(label=>label===token||label.length>=5&&token.length>=5&&(label.startsWith(token)||token.startsWith(label)))).length;
    return hits(clues.words)*10+hits(clues.motif);
  };
  return (shortlist.length?shortlist:designs).slice().sort((a,b)=>score(b)-score(a));
}

async function referenceImage(design,request,env){
  if(design.reference_image_kind!=='reverse'||!design.reference_image)return null;
  // Series illustrations and packaging are not exact design references.
  if(!['exact','catalogue','retailer_circulation_photo'].includes(design.image_status))return null;
  try{
    const url=design.reference_image;
    const response=/^https?:/.test(url)
      ?await (env.REFERENCE_FETCH||fetch)(url,{signal:AbortSignal.timeout(5000)})
      :await env.ASSETS.fetch(new URL('/'+url.replace(/^\/+/,''),request.url));
    const type=(response.headers.get('content-type')||'').split(';')[0];
    if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(type))return null;
    if(Number(response.headers.get('content-length'))>1_500_000)return null;
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(!bytes.length||bytes.length>1_500_000)return null;
    let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return `data:${type};base64,${btoa(binary)}`;
  }catch{return null;}
}

async function verifyReferences(designs,request,env,image,answerText){
  const loaded=await Promise.all(designs.slice(0,3).map(async design=>({design,image:await referenceImage(design,request,env)})));
  const references=loaded.filter(item=>item.image);
  if(!references.length)return {status:'unavailable'};
  const content=[{type:'text',text:'Image 1 is the photographed Australian coin. Later images are catalogue reverse references. Compare the actual artwork, lettering and layout, ignoring rotation, wear and lighting. A different commemorative, mintmark or kangaroo count is NOT a match. Reject a crop with missing details. Choose an EXACT reference name only if supported; otherwise unknown. Reply: DESIGN=exact reference name or unknown; CONFIDENCE=0-100; REASON=visible comparison.'},{type:'image_url',image_url:{url:image}}];
  references.forEach(({design,image},index)=>content.push({type:'text',text:`Image ${index+2}: ${design.title}`},{type:'image_url',image_url:{url:image}}));
  try{
    const output=await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct',{messages:[{role:'system',content:'Compare images carefully. Do not guess from coin popularity or year.'},{role:'user',content}],temperature:0,max_tokens:140,stream:false});
    const answer=answerText(output),title=field(answer,'DESIGN');
    return {status:'checked',title:references.find(item=>item.design.title===title)?.design.title||null,confidence:confidence(answer),reason:field(answer,'REASON')};
  }catch(error){if(/4006|daily free allocation/i.test(String(error)))throw error;return {status:'unavailable'};}
}

export async function identifySingleCoin({request,env,body,runVision,answerText,json}){
  const raw=answerText(await runVision(env,body.reverse,'One Australian coin, design side. Describe ONLY visible distinctive lettering and central artwork before seeing any catalogue names. Read FACE VALUE if visible; do not use size alone. If unclear use unknown. Reply: DENOM=5c|10c|20c|50c|$1|$2|unknown; CONFIDENCE=0-100; WORDS=distinctive readable words or unknown; MOTIF=visible objects and arrangement or unknown.',180));
  const normalized=normalizeSingleObservation(raw),detected=readSingleDenomination(raw),clues={words:normalized.words,motif:normalized.motif};
  const supplied=Object.hasOwn(DENOMINATIONS,body.denomination)?body.denomination:'';
  const denomination=supplied||detected.denomination;
  const denominationUncertain=!supplied&&detected.confidence<75;
  const observed={denomination,denomination_confidence:detected.confidence,denomination_reading:normalized.denomination_reading.slice(0,80),denomination_uncertain:denominationUncertain,words:clues.words,motif:clues.motif,year:null,year_confidence:0};
  const stop=reason=>json({matches:[],uncertain:true,needs_year:false,observed,reason});
  if(detected.conflict)return stop('The value reading conflicts with the visible lettering. Check the face value or retake the photo.');
  if(supplied&&detected.denomination!=='unknown'&&detected.confidence>=85&&detected.denomination!==supplied){observed.denomination=detected.denomination;return stop(`The photo appears to show ${detected.denomination}, but ${supplied} was selected. Check the face value.`);}
  if(denomination==='unknown')return stop('Choose the denomination; I could not read the face value reliably.');
  const response=await env.ASSETS.fetch(new URL('/catalogue-v2.json',request.url));
  if(!response.ok)throw new Error('Circulating catalogue unavailable');
  const catalogue=await response.json(),designs=catalogue.designs.filter(design=>design.denomination===DENOMINATIONS[denomination]);
  const candidates=singleCoinCandidates(designs,clues);
  observed.retrieved_designs=candidates.slice(0,5).map(design=>design.title);
  observed.retrieved_design_count=candidates.length;
  if(!candidates.length)return stop('No distinctive artwork or lettering could be read. Retake the design side or search the catalogue.');
  const answer=answerText(await runVision(env,body.reverse,`One Australian ${denomination} coin. Independent observations: WORDS=${clues.words}; MOTIF=${clues.motif}. Compare the ACTUAL image to these catalogue designs: ${candidates.map(design=>design.title).join(' | ')}. Pick an EXACT title only when supported. Do not infer from year. Five Kangaroos and Mob of Six Roos require a clear whole design and an actual count of all animals. Dollar Discovery requires its small A/U/S mark; alphabet coin hunts require the correct letter and subject. If unsure use unknown. Reply: DESIGN=exact title or unknown; CONFIDENCE=0-100; KANGAROOS=5|6|unknown; REASON=distinctive visible evidence.`,200));
  let chosen=candidates.find(design=>design.title===field(answer,'DESIGN'));
  const count=/^[56]$/.test(field(answer,'KANGAROOS'))?Number(field(answer,'KANGAROOS')):null;
  observed.kangaroo_count=count;
  let matchConfidence=confidence(answer);
  observed.design_reading=field(answer,'DESIGN');
  observed.design_confidence=matchConfidence;
  const referenceChoices=chosen?[chosen,...candidates.filter(design=>design.id!==chosen.id)]:candidates.length<=3?candidates:[];
  const reference=referenceChoices.length?await verifyReferences(referenceChoices,request,env,body.reverse,answerText):{status:'unavailable'};
  if(reference.status==='checked'){
    if(reference.title&&reference.confidence>=80){chosen=candidates.find(design=>design.title===reference.title);matchConfidence=reference.confidence;}
    else {chosen=null;matchConfidence=0;}
  }
  observed.reference_status=reference.status;
  const verifiedArtwork=reference.status==='checked'&&reference.title===chosen?.title&&reference.confidence>=90;
  if(chosen&&roos(chosen.title)){
    const countConflict=Boolean(count&&count!==(chosen.title==='Five Kangaroos'?5:6));
    // Counting overlapping animals is unreliable. A strong direct comparison
    // of the actual reverse can resolve it; counting alone never overrides it.
    if(countConflict&&verifiedArtwork){observed.kangaroo_count=null;observed.kangaroo_count_conflict=true;}
    else if(countConflict||!count&&!verifiedArtwork)chosen=null;
  }
  if(!chosen||matchConfidence<80||denominationUncertain){
    // Keep retrieved text matches even when value/design confidence is weak.
    // A generic motif with no retrieval hits cannot justify arbitrary cards.
    const retrieved=shortlistDesigns(candidates,clues);
    const review=chosen?[chosen,...retrieved.filter(design=>design.id!==chosen.id)].slice(0,5):retrieved.length?retrieved.slice(0,5):candidates.length<=5?candidates:[];
    return json({matches:review.map(design=>({id:design.yearVariants.at(-1).id,confidence:.5,evidence:['Candidate for manual comparison; design not confirmed']})),uncertain:true,needs_year:true,observed,reason:denominationUncertain?'Possible design found. Confirm the coin value and compare the candidate artwork before choosing the year.':'The exact design is uncertain. Compare the candidate images, retake the photo, or use visible clues.'});
  }
  if(body.obverse){
    const yearAnswer=answerText(await runVision(env,body.obverse,'Read ONLY the four digits physically stamped on this Australian coin portrait side. Do not infer from the portrait or design. If any digit is unclear use unknown. Reply: YEAR=four digits or unknown; CONFIDENCE=0-100.',70));
    const year=field(yearAnswer,'YEAR');
    if(/^(19|20)\d{2}$/.test(year)&&confidence(yearAnswer)>=80){observed.year=year;observed.year_confidence=confidence(yearAnswer);}
  }
  const result=rankCirculatingDesigns([chosen],denomination,`DESIGN=${chosen.title}; CONFIDENCE=${matchConfidence}`,observed.year);
  if(result.matches.length){result.matches[0].evidence.push(observed.kangaroo_count_conflict?'Initial animal count was inconsistent; matched by reference artwork':field(answer,'REASON')||'distinctive artwork checked');if(reference.status==='checked')result.matches[0].evidence.push('catalogue reference image comparison',reference.reason||'matching reverse artwork');}
  return json({...result,observed:{...observed,design:chosen.title},reference_match:reference.status==='checked'?reference:null});
}
