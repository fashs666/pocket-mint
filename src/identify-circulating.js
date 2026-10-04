import {identifySingleCoin,readSingleDenomination} from './identify-single.js';
// Opt-in circulating identification for one photo or an individual batch crop.
// The existing dollar matcher remains unchanged.
export const DENOMINATIONS = Object.freeze({'5c':5,'10c':10,'20c':20,'50c':50,'$1':100,'$2':200});
const normal=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const generic=new Set(['coin','coins','australia','australian','dollar','dollars','cent','cents','year','portrait','unknown','design','coloured','color','colour','round','silver','gold','metal']);

export function independentClues(answer) {
  const extract=key=>String(answer||'').match(new RegExp(`(?:^|[;\\n])\\s*${key}\\s*=\\s*([^;\\n]+)`,'i'))?.[1]?.trim()||'';
  return {words:extract('WORDS'),motif:extract('MOTIF')};
}

export function shortlistDesigns(designs,clues) {
  const tokens=normal(`${clues.words} ${clues.motif}`).split(' ').filter(token=>token.length>=4&&!generic.has(token));
  if(!tokens.length)return [];
  return designs.filter(design=>{
    const labels=normal([design.title,...(design.searchAliases||[])].join(' ')).split(' ');
    return tokens.some(token=>labels.some(label=>label===token||label.length>=5&&token.length>=5&&(label.startsWith(token)||token.startsWith(label))));
  });
}

export function parseDenomination(answer) {
  const label=(String(answer||'').match(/\bDENOM\s*=\s*(5c|10c|20c|50c|\$1|\$2|unknown)\s*(?:;|$)/i)?.[1]||'unknown').toLowerCase();
  const confidence=Number(String(answer||'').match(/\bCONFIDENCE\s*=\s*(\d+)/i)?.[1]||0);
  return {denomination:Object.hasOwn(DENOMINATIONS,label)?label:'unknown',confidence:Math.min(100,Math.max(0,confidence))};
}

export function rankCirculatingDesigns(designs,denomination,answer,year=null) {
  const exact=String(answer||'').match(/\bDESIGN\s*=\s*([^;\n]+)/i)?.[1]?.trim()||'';
  const confidence=Number(String(answer||'').match(/\bCONFIDENCE\s*=\s*(\d+)/i)?.[1]||0);
  const choice=designs.find(design=>design.denomination===DENOMINATIONS[denomination]&&normal(design.title)===normal(exact));
  // Never promote a vague subject, a readable year alone, or a near-title to
  // an identified coin: that is how an absent coin gets a plausible match.
  if(!choice||confidence<80)return {matches:[],uncertain:true,needs_year:false,observed:{design:exact||null,year,denomination},reason:'The design is not clear enough to select a catalogue coin. Check the photo or enter the visible clues.'};
  const matchingYear=choice.yearVariants.filter(variant=>String(variant.year)===String(year));
  if(year&&matchingYear.length===0)return {matches:[],uncertain:true,needs_year:false,observed:{design:choice.title,year,denomination},reason:`The visible year ${year} does not match this design’s recorded issues. Check the portrait side or search the catalogue.`};
  const preferred=matchingYear.length===1?matchingYear[0]:choice.yearVariants.at(-1);
  const needsYear=choice.yearVariants.length>1&&matchingYear.length!==1;
  return {matches:[{id:preferred.id,confidence:Math.min(.94,confidence/100),evidence:[`visible ${denomination} denomination`,`reverse design: ${choice.title}`]}],uncertain:false,needs_year:needsYear,observed:{design:choice.title,year,denomination},reason:needsYear?'Design recognised. Choose the year or special issue before adding it.':'Check the design against the reference before confirming.'};
}

export async function identifyCirculating({request,env,body,runVision,answerText,json,legacyIdentify}) {
  if(body.batch_check===true||body.batch_coin===true)return identifyBatchCoin({request,env,body,runVision,answerText,json,legacyIdentify});
  if(body.single_coin===true)return identifySingleCoin({request,env,body,runVision,answerText,json,legacyIdentify});
  const raw=answerText(await runVision(env,body.reverse,
    'This is one Australian circulating coin, photographed from the design side. Before seeing any catalogue names, describe only what is actually visible: distinctive readable words and a recognisable object or emblem. Read the FACE VALUE only if visible. Colour and outer shape are secondary: $1 and $2 are gold-coloured; 5c and $2 have similar diameters; 50c is usually twelve-sided. If unclear say unknown. Reply exactly: DENOM=5c|10c|20c|50c|$1|$2|unknown; CONFIDENCE=0-100; WORDS=visible distinctive words or unknown; MOTIF=recognisable object or emblem or unknown.',130));
  const detected=readSingleDenomination(raw);
  const clues=independentClues(raw);
  const supplied=String(body.denomination||'');
  if(detected.conflict)return json({matches:[],uncertain:true,needs_year:false,observed:{denomination:'unknown',denomination_confidence:0},reason:'The value reading conflicts with the visible lettering. Check the face value or retake the photo.'});
  // A user can supply a denomination after an uncertain reading; a clearly
  // contradictory machine reading is still a stop, never a silent override.
  const denomination=Object.hasOwn(DENOMINATIONS,supplied)?supplied:detected.denomination;
  if(supplied&&detected.confidence>=85&&detected.denomination!=='unknown'&&detected.denomination!==supplied)
    return json({matches:[],uncertain:true,needs_year:false,observed:{denomination:detected.denomination,denomination_confidence:detected.confidence},reason:`The photo appears to show ${detected.denomination}, but ${supplied} was selected. Check the face value or retake the photo.`});
  if(denomination==='unknown'||!supplied&&detected.confidence<75)
    return json({matches:[],uncertain:true,needs_year:false,observed:{denomination:detected.denomination,denomination_confidence:detected.confidence},reason:'I could not read the coin’s value reliably. Choose its denomination in the next step.'});
  if(denomination==='$1') {
    const response=await legacyIdentify();
    const payload=await response.json();
    if(!response.ok)return json({...payload,observed:{...payload.observed,denomination,denomination_confidence:detected.confidence}},response.status);
    const circulatingResponse=await env.ASSETS.fetch(new URL('/catalogue-v2.json',request.url));
    if(!circulatingResponse.ok)throw new Error('Circulating catalogue unavailable');
    const circulating=await circulatingResponse.json();
    const accepted=new Set((circulating.designs||[]).filter(design=>design.denomination===100).flatMap(design=>design.yearVariants.map(variant=>variant.id)));
    const matches=(payload.matches||[]).filter(match=>accepted.has(match.id));
    const discardedTop=Boolean(payload.matches?.[0]&&!accepted.has(payload.matches[0].id));
    return json({...payload,matches,uncertain:payload.uncertain||!matches.length||discardedTop,reason:discardedTop?'The strongest visual match is not a circulating issue. Check the artwork against the catalogue.':matches.length?payload.reason:'No circulating $1 issue could be confirmed from the photo.',observed:{...payload.observed,denomination,denomination_confidence:detected.confidence}},response.status);
  }
  const catalogueResponse=await env.ASSETS.fetch(new URL('/catalogue-v2.json',request.url));
  if(!catalogueResponse.ok)throw new Error('Circulating catalogue unavailable');
  const catalogue=await catalogueResponse.json();
  const designs=(catalogue.designs||[]).filter(design=>design.denomination===DENOMINATIONS[denomination]);
  const shortlist=shortlistDesigns(designs,clues);
  if(!shortlist.length)return json({matches:[],uncertain:true,needs_year:false,observed:{denomination,denomination_confidence:detected.confidence,words:clues.words,motif:clues.motif},reason:'I could not verify a design from visible artwork or lettering. Check the crop, enter clues, or search the catalogue.'});
  const titles=shortlist.map(design=>design.title);
  const answer=answerText(await runVision(env,body.reverse,
    `One Australian ${denomination} coin, design side. A separate observation recorded WORDS=${clues.words}; MOTIF=${clues.motif}. Compare the ACTUAL artwork against this short candidate list: ${titles.join(' | ')}. Select the EXACT name only if the photographed design supports it; otherwise say unknown. Do not infer the year or pick a familiar coin. Reply exactly: DESIGN=exact list name or unknown; CONFIDENCE=0-100.`,160));
  let year=null;
  if(body.obverse) {
    const obverse=answerText(await runVision(env,body.obverse,
      'Read the four year digits physically stamped on this Australian coin portrait side. Do not infer the year from the effigy or design. Reply exactly: YEAR=four digits or unknown; CONFIDENCE=0-100.',65));
    const match=obverse.match(/\bYEAR\s*=\s*((?:19|20)\d{2})\b/i);
    if(match&&Number(obverse.match(/\bCONFIDENCE\s*=\s*(\d+)/i)?.[1]||0)>=80)year=match[1];
  }
  const result=rankCirculatingDesigns(shortlist,denomination,answer,year);
  return json({...result,observed:{...result.observed,denomination_confidence:detected.confidence,words:clues.words,motif:clues.motif}});
}


// Batch preflight is isolated from single Identify and the legacy API.
export function parseBatchCheck(answer) {
  const field=key=>String(answer||'').match(new RegExp(`(?:^|[;\\n])\\s*${key}\\s*=\\s*([^;\\n]+)`,'i'))?.[1]?.trim().toLowerCase();
  const coin=field('COIN'),side=field('SIDE'),quality=field('QUALITY');
  const count=Number(field('COUNT'));
  const confidence=Math.max(0,Math.min(100,Number(field('CONFIDENCE'))||0));
  return {coin:['yes','no'].includes(coin)?coin:'unknown',side:['design','portrait'].includes(side)?side:'unknown',quality:['clear','poor'].includes(quality)?quality:'unknown',count:Number.isInteger(count)&&count>=0?count:null,confidence};
}
async function identifyBatchCoin(context) {
  const {env,body,runVision,answerText,json}=context;
  const raw=answerText(await runVision(env,body.reverse,
    'Examine this crop without assuming it contains a coin. Is the central object a real metal coin? Reject buttons, bottle caps, washers, table patterns, shadows and printed circles. Count visible physical coins; ignore rings and artwork inside a coin. State whether the central coin shows a portrait/head or a design. State whether its artwork is sharp enough to inspect. Use unknown when unsure. Reply exactly: COIN=yes|no|unknown; COUNT=integer or unknown; SIDE=design|portrait|unknown; QUALITY=clear|poor|unknown; CONFIDENCE=0-100.',140));
  const check=parseBatchCheck(raw);
  const reason=check.coin==='no'&&check.confidence>=80?'This object does not appear to be a coin. Remove this outline.':check.count!==null&&check.count>1?'This crop contains multiple coins. Adjust the outline or separate the coins.':check.coin!=='yes'||check.confidence<80||check.count!==1?'Check that this crop contains one real coin. Adjust the outline or take a closer photo.':check.quality!=='clear'?'The coin details are not clear enough. Take a closer photo of this coin.':check.side!=='design'?'Photograph the design side of this coin to match its artwork.':'';
  const status=check.coin==='no'&&check.confidence>=80?'not_coin':check.count!==null&&check.count>1?'multiple_coins':check.coin!=='yes'||check.confidence<80||check.count!==1?'check_coin':check.quality!=='clear'?'low_quality':check.side!=='design'?'needs_other_side':'ready';
  if(body.batch_check===true||status!=='ready')return json({check,status,matches:[],uncertain:true,needs_year:false,reason,observed:{side:check.side,quality:check.quality,coin_check:check}});
  const response=await identifySingleCoin(context);
  const payload=await response.json();
  return json({...payload,check,observed:{...payload.observed,side:check.side,quality:check.quality,coin_check:check}},response.status);
}
