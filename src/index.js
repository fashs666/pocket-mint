const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

function json(data,status=200) {
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}

function parseFields(answer) {
  const text=String(answer||"").trim();
  if(!text) return {fields:{},confidence:0,raw:""};
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

function identifyDesign(value,candidates) {
  const answer=normalize(value);
  const titles=[...new Set(candidates.map(coin=>coin.title))];
  const aliases=[
    ["100 Years of Qantas",["qantas","100 years qantas","centenary","aeroplane","airplane","aircraft"]],
    ["Donation Dollar",["donation","give to help others"]],
    ["series:matildas",["matildas","female footballers","women footballers"]],
    ["Mob of Six Roos",["mob of six","six roos","six kangaroos"]],
    ["Five Kangaroos",["five kangaroos","five roos","standard kangaroo"]]
  ];
  for(const title of titles) if(answer.includes(normalize(title))) return title;
  for(const [key,terms] of aliases) if((key.startsWith("series:")||titles.includes(key))&&terms.some(term=>answer.includes(normalize(term)))) return key;
  return null;
}

function parseObservations(obverseAnswer,reverseAnswer,candidates) {
  const obverse=parseFields(obverseAnswer),reverse=parseFields(reverseAnswer);
  const year=(obverse.fields.year||"").match(/20\d{2}/)?.[0]||null;
  const reverseText=[reverse.fields.design,reverse.fields.words,reverse.fields.subject].filter(Boolean).join(" ");
  return {
    year,
    portrait:obverse.fields.portrait||"",
    design_type:reverse.fields.type||"",
    design:identifyDesign(reverseText,candidates),
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
    const seriesMatch=observed.design===`series:${coin.series_id}`;
    const designMatch=observed.design===coin.title||seriesMatch;
    const yearMatch=Boolean(observed.year&&String(coin.year)===observed.year);
    const portraitKnown=/charles|elizabeth|queen/i.test(observed.portrait||"");
    const portraitMatch=(/charles/i.test(observed.portrait)&&/charles/i.test(coin.obverse_effigy||""))||(/elizabeth|queen/i.test(observed.portrait)&&/elizabeth/i.test(coin.obverse_effigy||""));
    const portraitConflict=portraitKnown&&!portraitMatch;
    if(designMatch){score+=seriesMatch?90:100;evidence.push(seriesMatch?"Matildas series artwork":`reverse design: ${coin.title}`);}
    if(yearMatch){score+=30;evidence.push(`visible year ${coin.year}`);}
    if(portraitMatch){score+=8;evidence.push(/charles/i.test(observed.portrait)?"King Charles III portrait":"Queen Elizabeth II portrait");}
    if(portraitConflict) score-=18;
    const haystack=normalize([coin.title,coin.series_id,coin.notes,coin.issue_type].filter(Boolean).join(" "));
    const hits=[...new Set(visualWords.filter(word=>haystack.includes(word)))];
    const distinctiveHits=hits.filter(word=>word.length>=4&&!/^(standard|kangaroo|kangaroos|years?)$/.test(word));
    if(!designMatch&&distinctiveHits.length){score+=Math.min(75,distinctiveHits.length*35);evidence.push(`distinctive text: ${distinctiveHits.slice(0,3).join(", ")}`);}
    else if(!designMatch&&hits.length){score+=Math.min(20,hits.length*8);evidence.push(`visible ${hits.slice(0,3).join(", ")}`);}
    if(/standard|kangaroo/i.test(observed.design_type)&&(coin.issue_type==="standard"||/kangaroo|roos/i.test(coin.title))){score+=4;evidence.push("kangaroo-style reverse");}
    if(/commemorative|special/i.test(observed.design_type)&&coin.issue_type==="commemorative"){score+=4;evidence.push("commemorative reverse");}
    const repeatedTitle=titleCounts.get(coin.title)>1;
    const countSensitive=/kangaroo|roos/i.test(coin.title);
    let confidence=.35;
    if(designMatch&&yearMatch) confidence=.95;
    else if(seriesMatch) confidence=.82;
    else if(designMatch&&!repeatedTitle&&!countSensitive) confidence=.94;
    else if(designMatch&&!repeatedTitle) confidence=.8;
    else if(designMatch) confidence=.7;
    else if(distinctiveHits.length&&yearMatch) confidence=.86;
    else if(distinctiveHits.length) confidence=.76;
    else if(yearMatch&&portraitMatch) confidence=.52;
    if(portraitConflict) confidence-=.22;
    return {coin,score,confidence:Math.max(.2,confidence),evidence,designMatch,yearMatch};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||Number(b.yearMatch)-Number(a.yearMatch)||Number(b.designMatch)-Number(a.designMatch)||Number(b.coin.year)-Number(a.coin.year));
  const top=ranked[0];
  if(!top) return [];
  return ranked.filter((item,index)=>index===0||(item.confidence>=.55&&item.confidence>top.confidence-.18&&item.score>=top.score-45)).slice(0,3).map(item=>({id:item.coin.id,confidence:Math.min(.98,item.confidence),evidence:item.evidence}));
}

function assessMatches(matches,observed,candidates) {
  const first=matches[0],second=matches[1];
  const gap=first&&second?first.confidence-second.confidence:1;
  const sameDesignCount=observed.design&&!observed.design.startsWith("series:")?candidates.filter(coin=>coin.title===observed.design).length:0;
  const unresolvedDesign=Boolean(observed.design?.startsWith("series:")||(observed.design&&sameDesignCount>1&&!candidates.some(coin=>coin.title===observed.design&&String(coin.year)===observed.year)));
  const uncertain=!first||first.confidence<.75||gap<.1||unresolvedDesign;
  const reason=uncertain
    ? observed.design?.startsWith("series:")
      ? "I recognised the coin series, but need help choosing the exact design."
      : observed.design&&sameDesignCount>1
        ? "I recognised the reverse, but need a reliable year to choose the exact coin."
        : "The photo did not produce one clearly stronger catalogue match."
    : "The visible design and supporting details produced a clear catalogue match.";
  return {uncertain,reason};
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
  if(!validImage(body.reverse)||(body.obverse!=null&&!validImage(body.obverse))) return json({error:"A valid design-side image is required."},400);
  const catalogueResponse=await env.ASSETS.fetch(new URL("/catalogue.json",request.url));
  const catalogue=await catalogueResponse.json();
  const candidates=catalogue.coins||[];
  const designChoices=[...new Set(candidates.map(coin=>coin.title))];
  const titleOptions=designChoices.join(" | ");
  const obversePrompt="This is the portrait side of an Australian one-dollar coin. Read only the four-digit mint year and identify Queen Elizabeth II or King Charles III. Do not infer a year that is not visibly readable. Reply exactly: YEAR=value; PORTRAIT=value; CONFIDENCE=value. Confidence must be one integer from 0 to 100. Use unknown when unreadable.";
  const reversePrompt=`This is the reverse design of an Australian one-dollar coin. Compare the artwork and lettering to these catalogue choices: ${titleOptions}. Count kangaroos carefully; do not choose Five Kangaroos or Mob of Six Roos from a rough impression alone. Matildas is a valid series even when the exact player design is unclear. Select an exact title only when visible artwork or lettering supports it; otherwise use unknown. Read distinctive visible words and describe the central subject. Reply exactly: DESIGN=value; TYPE=standard or commemorative or unknown; WORDS=value; SUBJECT=value; CONFIDENCE=value. Confidence must be one integer from 0 to 100.`;
  try {
    const [obverseOutput,reverseOutput]=await Promise.all([
      body.obverse?runVision(env,body.obverse,obversePrompt,120):Promise.resolve(null),
      runVision(env,body.reverse,reversePrompt,180)
    ]);
    const observed=parseObservations(answerText(obverseOutput),answerText(reverseOutput),candidates);
    const matches=rankCatalogue(candidates,observed);
    const {uncertain,reason}=assessMatches(matches,observed,candidates);
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

export {normalize,identifyDesign,parseObservations,rankCatalogue,assessMatches};
