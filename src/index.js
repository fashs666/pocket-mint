const MODEL = "@cf/moondream/moondream3.1-9B-A2B";

function json(data,status=200) {
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}

function parseObservations(answer) {
  const text=String(answer||"").trim();
  if(!text) throw new Error("The vision model returned an empty result");
  const fields={};
  for(const part of text.split(/[;\n]+/)) {
    const split=part.indexOf("=");
    if(split>0) fields[part.slice(0,split).trim().toLowerCase()]=part.slice(split+1).trim();
  }
  return {year:(fields.year||"").match(/20\d{2}/)?.[0]||null,portrait:fields.portrait||"",design_type:fields.type||"",words:[fields.words,fields.subject,fields.likely_name].filter(value=>value&&!/^(unknown|none)$/i.test(value)).join(" ").split(/[,|]+/).map(value=>value.trim()).filter(Boolean),likely_name:fields.likely_name||"",confidence:Math.max(0,Math.min(100,Number(fields.confidence)||0)),raw:text};
}

function words(value) {
  return String(value||"").toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>1&&!new Set(["australian","australia","dollar","coin","one","the","and","side","portrait","design","unknown"]).has(word));
}

function rankCatalogue(candidates,observed) {
  const visualText=[observed.words.join(" "),observed.likely_name,observed.design_type].join(" ").toLowerCase();
  const visualWords=words(visualText);
  const ranked=candidates.map(coin=>{
    let score=0;const evidence=[];
    if(observed.year&&String(coin.year)===observed.year){score+=40;evidence.push(`visible year ${coin.year}`);}
    if(/charles/i.test(observed.portrait)&&/charles/i.test(coin.obverse_effigy||"")){score+=15;evidence.push("King Charles III portrait");}
    if(/elizabeth|queen/i.test(observed.portrait)&&/elizabeth/i.test(coin.obverse_effigy||"")){score+=15;evidence.push("Queen Elizabeth II portrait");}
    const haystack=[coin.title,coin.series_id,coin.notes,coin.issue_type].filter(Boolean).join(" ").toLowerCase();
    const hits=visualWords.filter(word=>haystack.includes(word));
    if(hits.length){score+=Math.min(55,hits.length*18);evidence.push(`visible ${hits.slice(0,3).join(", ")}`);}
    if(/kangaroo|five roos|standard/i.test(visualText)&&coin.issue_type==="standard"){score+=30;evidence.push("five-kangaroo reverse");}
    if(/commemorative|special/i.test(observed.design_type)&&coin.issue_type==="commemorative"){score+=10;evidence.push("commemorative reverse");}
    return {coin,score,evidence};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||Number(b.coin.year)-Number(a.coin.year));
  const max=ranked[0]?.score||1;
  return ranked.slice(0,5).map(item=>({id:item.coin.id,confidence:Math.min(.98,(item.score/max)*Math.max(.55,observed.confidence/100)),evidence:item.evidence}));
}

async function identify(request,env) {
  if(!env.AI) return json({error:"Pocket Mint’s vision service is not configured yet."},503);
  const length=Number(request.headers.get("content-length")||0);
  if(length>6_000_000) return json({error:"The prepared image is too large."},413);
  let body;
  try { body=await request.json(); } catch { return json({error:"Invalid image request."},400); }
  if(typeof body.image!=="string"||!body.image.startsWith("data:image/jpeg;base64,")||body.image.length>6_000_000) return json({error:"A valid prepared coin image is required."},400);
  const catalogueResponse=await env.ASSETS.fetch(new URL("/catalogue.json",request.url));
  const catalogue=await catalogueResponse.json();
  const candidates=catalogue.coins||[];
  const prompt="Inspect this two-panel photograph of an Australian one-dollar coin. The portrait side is left and reverse design is right. Read the year and all visible words; identify the portrait, reverse subject, whether it is the standard five-kangaroo design or commemorative, and the likely official coin name. Do not explain or reason. Reply in exactly one line: YEAR=value; PORTRAIT=value; TYPE=value; WORDS=value; SUBJECT=value; LIKELY_NAME=value; CONFIDENCE=0-100. Use unknown when unreadable.";
  try {
    const output=await env.AI.run(MODEL,{task:"query",image:body.image,question:prompt,reasoning:false,temperature:0,max_tokens:350,stream:false});
    const raw=output?.answer||output?.response||output?.result?.answer||output?.result?.response;
    const observed=parseObservations(raw);
    const matches=rankCatalogue(candidates,observed),first=matches[0],second=matches[1];
    const uncertain=!first||observed.confidence<60||first.confidence<.65||(second&&first.confidence-second.confidence<.1);
    return json({matches,uncertain,reason:uncertain?"The photos did not produce one clearly stronger catalogue match.":"The visible date, portrait and reverse design produced a clear match.",observed});
  } catch(error) {
    console.error("Coin identification failed",error);
    return json({error:"Visual analysis could not complete. Please try again or use the clue screen."},503);
  }
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname==="/api/identify") {
      if(request.method!=="POST") return json({error:"Method not allowed"},405);
      return identify(request,env);
    }
    return env.ASSETS.fetch(request);
  }
};
