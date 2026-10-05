// Photo presentation is isolated from the existing identification worker.
import identificationWorker from './index.js';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export function parseOrientation(text){
  const field=key=>String(text||'').match(new RegExp(`(?:^|[;\\n])\\s*${key}\\s*=\\s*([^;\\n]+)`,'i'))?.[1]?.trim();
  const angle=Number(field('CLOCKWISE')),confidence=Number(field('CONFIDENCE'));
  const safe=field('COIN')?.toLowerCase()==='yes'&&field('UPRIGHT')?.toLowerCase()==='clear'&&Number.isFinite(angle)&&Math.abs(angle)<=180&&Number.isFinite(confidence)&&confidence>=95&&confidence<=100;
  return {angle:safe?Math.round(angle):0,confident:safe};
}
export default {async fetch(request,env,ctx){
  if(new URL(request.url).pathname!=='/api/photo-orientation')return identificationWorker.fetch(request,env,ctx);
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(Number(request.headers.get('content-length')||0)>2_000_000)return reply({error:'Photo too large'},413);
  let body;try{const text=await request.text();if(text.length>2_000_000)return reply({error:'Photo too large'},413);body=JSON.parse(text);}catch{return reply({error:'Invalid photo'},400);}
  if(typeof body.image!=='string'||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.image))return reply({error:'Invalid photo'},400);
  if(!env.AI)return reply({angle:0,confident:false});
  try{
    const output=await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct',{messages:[
      {role:'system',content:'Estimate photo orientation only. Never identify a coin or nominate catalogue matches. If upright direction is ambiguous or unsupported, return unknown.'},
      {role:'user',content:[{type:'text',text:'For the central coin, estimate the CLOCKWISE rotation in degrees (-180 to 180) needed to put clearly visible central lettering, portrait or directional design upright. Ignore lettering that curves around the rim. A circular rim does not reveal upright direction. Symmetric designs, unreadable text and unclear motifs mean UPRIGHT=unknown. Report exactly: COIN=yes/no/unknown; UPRIGHT=clear/unknown; CLOCKWISE=number/unknown; CONFIDENCE=0-100. Be conservative.'},{type:'image_url',image_url:{url:body.image}}]}
    ],temperature:0,max_tokens:100,stream:false});
    const text=typeof output==='string'?output:output?.response||output?.answer||output?.result?.response||'';
    return reply(parseOrientation(text));
  }catch{return reply({angle:0,confident:false,unavailable:true});}
}};
