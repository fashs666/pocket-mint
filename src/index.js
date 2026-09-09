const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

function json(data,status=200) {
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}

function parseFields(answer) {
  const text=String(answer||"").trim();
  if(!text) throw new Error("The vision model returned an empty result");
  const fields={};
  for(const match of text.matchAll(/\b(YEAR|PORTRAIT|DESIGN|TYPE|WORDS|SUBJECT|CONFIDENCE)\s*=\s*([^;\n]+)/gi)) fields[match[1].toLowerCase()]=match[2].trim();
  const confidence=Number((fields.confidence||"").match(/\d+(?:\.\d+)?/)?.[0]||0);
  return {fields,confidence:Math.max(0,Math.min(100,confidence)),raw:text};
}

function normalize(value) {
  return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function usefulWords(value) {
  const ignored=new Set(["australian","australia","dollar","coin","one","the","and","side","portrait","design","unknown","commemorative"]);
  return normalize(value).split(" ").filter(word=>word.length>1&&!ignored.has(word));
}

function identifyDesign(value,titles) {
  const answer=normalize(value);
  const aliases=[
    ["100 Years of Qantas",["qantas","100 years qantas","centenary","aeroplane","airplane","aircraft"]],
    ["Donation Dollar",["donation","give to help others"]],
    ["Five Kangaroos",["five kangaroos","five roos","standard kangaroo"]],
    ["Mob of Six Roos",["mob of six","six roos","six kangaroos"]]
  ];
  for(const title of titles) if(answer.includes(normalize(title))) return title;
  for(const [title,terms] of aliases) if(titles.includes(title)&&terms.some(term=>answer.includes(normalize(term)))) return title;
  return null;
}

function parseObservations(obverseAnswer,reverseAnswer,titles) {
  const obverse=parseFields(obverseAnswer),reverse=parseFields(reverseAnswer);
  const year=(obverse.fields.year||"").match(/20\d{2}/)?.[0]||null;
  const reverseText=[reverse.fields.design,reverse.fields.words,reverse.fields.subject].filter(Boolean).join(" ");
  return {
    year,
    portrait:obverse.fields.portrait||"",
    design_type:reverse.fields.type||"",
    design:identifyDesign(reverseText,titles),
    words:[reverse.fields.words,reverse.fields.subject].filter(value=>value&&!/^(unknown|none)$/i.test(value)).join(" ").split(/[,|]+/).map(value=>value.trim()).filter(Boolean),
    confidence:Math.round((obverse.confidence+reverse.confidence)/2),
    side_confidence:{obverse:obverse.confidence,reverse:reverse.confidence}
  };
}

function rankCatalogue(candidates,observed) {
  const visualWords=usefulWords([observed.words.join(" "),observed.design_type].join(" "));
  const titleCounts=new Map();
  for(const coin of candidates) titleCounts.set(coin.title,(titleCounts.get(coin.title)||0)+1);
  const ranked=candidates.map(coin=>{
    let score=0;const evidence=[];
    const designMatch=observed.design===coin.title;
    const yearMatch=Boolean(observed.year&&String(coin.year)===observed.year);
    if(designMatch){score+=70;evidence.push(`reverse design: ${coin.title}`);}
    if(yearMatch){score+=35;evidence.push(`visible year ${coin.year}`);}
    if(/charles/i.test(observed.portrait)&&/charles/i.test(coin.obverse_effigy||"")){score+=10;evidence.push("King Charles III portrait");}
    if(/elizabeth|queen/i.test(observed.portrait)&&/elizabeth/i.test(coin.obverse_effigy||"")){score+=10;evidence.push("Queen Elizabeth II portrait");}
    const haystack=normalize([coin.title,coin.series_id,coin.notes,coin.issue_type].filter(Boolean).join(" "));
    const hits=visualWords.filter(word=>haystack.includes(word));
    if(!designMatch&&hits.length){score+=Math.min(45,hits.length*15);evidence.push(`visible ${hits.slice(0,3).join(", ")}`);}
    if(/standard|kangaroo/i.test(observed.design_type)&&coin.issue_type==="standard"){score+=8;evidence.push("standard reverse");}
    if(/commemorative|special/i.test(observed.design_type)&&coin.issue_type==="commemorative"){score+=5;evidence.push("commemorative reverse");}
    let confidence=.45;
    if(designMatch&&yearMatch) confidence=.95;
    else if(designMatch&&titleCounts.get(coin.title)===1) confidence=.9;
    else if(designMatch) confidence=.76;
    else if(yearMatch&&hits.length) confidence=.68;
    const modelConfidence=(observed.side_confidence.reverse||50)/100;
    confidence*=.8+.2*modelConfidence;
    return {coin,score,confidence,evidence,designMatch,yearMatch};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||Number(b.yearMatch)-Number(a.yearMatch)||Number(b.designMatch)-Number(a.designMatch)||Number(b.coin.year)-Number(a.coin.year));
  return ranked.slice(0,5).map(item=>({id:item.coin.id,confidence:Math.min(.98,item.confidence),evidence:item.evidence}));
}

function answerText(output) {
  if(typeof output==="string") return output;
  const values=[output?.answer,output?.response,output?.result?.answer,output?.result?.response,output?.choices?.[0]?.message?.content,output?.result];
  return values.find(value=>typeof value==="string")||"";
}

async function runVision(env,image,prompt,maxTokens) {
  return env.AI.run(MODEL,{
    messages:[
      {role:"system",content:"Follow the requested output format exactly and report only details visibly supported by the image."},
      {role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:image}}]}
    ],
    temperature:0,
    max_tokens:maxTokens,
    stream:false
  });
}

async function identify(request,env) {
  if(!env.AI) return json({error:"Pocket Mint’s vision service is not configured yet."},503);
  const length=Number(request.headers.get("content-length")||0);
  if(length>10_000_000) return json({error:"The prepared images are too large."},413);
  let body;
  try { body=await request.json(); } catch { return json({error:"Invalid image request."},400); }
  const validImage=value=>typeof value==="string"&&value.startsWith("data:image/jpeg;base64,")&&value.length<5_000_000;
  if(!validImage(body.obverse)||!validImage(body.reverse)) return json({error:"Two valid prepared coin images are required."},400);
  const catalogueResponse=await env.ASSETS.fetch(new URL("/catalogue.json",request.url));
  const catalogue=await catalogueResponse.json();
  const candidates=catalogue.coins||[];
  const circulationTitles=[...new Set(candidates.filter(coin=>coin.test_scope==="circulation_core").map(coin=>coin.title))];
  const titleOptions=circulationTitles.join(" | ");
  const obversePrompt="This is the portrait side of an Australian one-dollar coin. Read only the four-digit mint year and identify Queen Elizabeth II or King Charles III. Do not infer a year that is not visibly readable. Reply exactly: YEAR=value; PORTRAIT=value; CONFIDENCE=value. Confidence must be one integer from 0 to 100. Use unknown when unreadable.";
  const reversePrompt=`This is the reverse design of an Australian one-dollar coin. Compare the artwork and lettering to these circulation catalogue choices: ${titleOptions}. Select an exact title only when the visible design supports it; otherwise use unknown. Read distinctive visible words and describe the central subject. Reply exactly: DESIGN=value; TYPE=standard or commemorative or unknown; WORDS=value; SUBJECT=value; CONFIDENCE=value. Confidence must be one integer from 0 to 100.`;
  try {
    const [obverseOutput,reverseOutput]=await Promise.all([
      runVision(env,body.obverse,obversePrompt,120),
      runVision(env,body.reverse,reversePrompt,180)
    ]);
    const observed=parseObservations(answerText(obverseOutput),answerText(reverseOutput),circulationTitles);
    const matches=rankCatalogue(candidates,observed),first=matches[0],second=matches[1];
    const gap=first&&second?first.confidence-second.confidence:1;
    const uncertain=!first||first.confidence<.72||gap<.1;
    const sameDesignCount=observed.design?candidates.filter(coin=>coin.title===observed.design).length:0;
    const reason=uncertain
      ? observed.design&&!observed.year&&sameDesignCount>1
        ? "I recognised the reverse, but could not read enough from the portrait side to choose the exact year."
        : "The photos did not produce one clearly stronger catalogue match."
      : "The reverse design and portrait-side details produced a clear catalogue match.";
    return json({matches,uncertain,reason,observed});
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
