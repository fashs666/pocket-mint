const MODEL = "@cf/moondream/moondream3.1-9B-A2B";

function json(data,status=200) {
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}

function parseAnswer(answer) {
  const cleaned=String(answer||"").replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
  const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");
  if(start<0||end<=start) throw new Error("The vision model returned an unreadable result");
  return JSON.parse(cleaned.slice(start,end+1));
}

function safeResult(result,validIds) {
  const matches=Array.isArray(result.matches)?result.matches.filter(item=>validIds.has(item.id)).slice(0,5).map(item=>({id:item.id,confidence:Math.max(0,Math.min(1,Number(item.confidence)||0)),evidence:Array.isArray(item.evidence)?item.evidence.slice(0,4).map(String):[String(item.evidence||"visual appearance")]})):[];
  return {matches,uncertain:Boolean(result.uncertain)||!matches.length,reason:String(result.reason||"The visual evidence was not decisive."),observed:{year:result.observed?.year||null,portrait:String(result.observed?.portrait||""),design_type:String(result.observed?.design_type||""),words:Array.isArray(result.observed?.words)?result.observed.words.slice(0,8).map(String):[]}};
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
  const candidates=(catalogue.coins||[]).map(coin=>({id:coin.id,year:coin.year,title:coin.title,series:coin.series_id,portrait:coin.obverse_effigy,type:coin.issue_type,mintmark:coin.mintmark,privy:coin.privy_mark,notes:coin.notes}));
  const prompt=`You are the visual identification engine for Pocket Mint. The supplied image is a composite: portrait side on the left, design side on the right. Identify the photographed Australian one-dollar coin using only visible evidence and the candidate catalogue below. Inspect portrait, year, lettering, symbols, artwork, mintmarks and privy marks. Never invent a candidate ID. Return ONLY strict JSON with this shape: {"matches":[{"id":"exact candidate id","confidence":0.0,"evidence":["short visible reason"]}],"uncertain":true,"reason":"short explanation","observed":{"year":null,"portrait":"","design_type":"","words":[]}}. Include at most 5 ranked matches. Set uncertain true if the date/design is unreadable, the coin is not in the candidates, or the best match is not clearly stronger than alternatives. Candidate catalogue: ${JSON.stringify(candidates)}`;
  try {
    const output=await env.AI.run(MODEL,{task:"query",image:body.image,question:prompt,reasoning:false,temperature:0,max_tokens:1100,stream:false});
    return json(safeResult(parseAnswer(output.answer),new Set(candidates.map(item=>item.id))));
  } catch(error) {
    console.error("Coin identification failed",error);
    return json({error:"Visual analysis could not complete. Please try again or use the clue screen.",diagnostic:String(error?.message||error).slice(0,300)},503);
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
