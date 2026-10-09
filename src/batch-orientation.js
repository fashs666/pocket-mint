/* Batch-only orientation. Existing single identification/photo routes pass
   straight through to their original worker. */
import originalWorker from './photo-worker.js';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const angles=[0,90,180,-90];
export function parseBatchOrientation(text){
 const field=key=>String(text||'').match(new RegExp(`(?:^|[;\\n])\\s*${key}\\s*=\\s*([^;\\n]+)`,'i'))?.[1]?.trim();
 const choice=Number(field('CHOICE')),confidence=Number(field('CONFIDENCE')),cue=field('CUE')||'';
 if(!Number.isInteger(choice)||choice<1||choice>4||!Number.isFinite(confidence)||confidence<85||confidence>100||cue.length<4||/^(unknown|none|symmetr|rim only|circle)/i.test(cue))return {angle:0,confident:false,reason:'uncertain'};
 return {angle:angles[choice-1],confident:true,reason:'visual_orientation'};
}
export function parseUpright(text){
 const field=key=>String(text||'').match(new RegExp(`(?:^|[;\\n])\\s*${key}\\s*=\\s*([^;\\n]+)`,'i'))?.[1]?.trim();
 const confidence=Number(field('CONFIDENCE')),cue=field('CUE')||'';
 const confident=field('UPRIGHT')?.toLowerCase()==='yes'&&confidence>=95&&confidence<=100&&cue.length>=4&&!/^(unknown|none|symmetr|rim only|circle)/i.test(cue);
 return {confident,reason:confident?'upright_verified':'uncertain'};
}
export default {async fetch(request,env,ctx){
 if(new URL(request.url).pathname!=='/api/batch-orientation')return originalWorker.fetch(request,env,ctx);
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 let body;try{const text=await request.text();if(text.length>2_000_000)return reply({error:'Photo too large'},413);body=JSON.parse(text);}catch{return reply({error:'Invalid photo'},400);}
 if(typeof body.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.image))return reply({error:'Invalid photo'},400);
 if(!env.AI)return reply({angle:0,confident:false,reason:'unavailable'});
 try{
  if(body.phase==='verify'){
   const verification=await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct',{messages:[{role:'system',content:'Check one coin photo for upright orientation. Do not assume it is upright. Never identify, date or grade it.'},{role:'user',content:[{type:'text',text:'Is this single coin already upright as displayed? Inspect actual letters: horizontal words must read naturally left to right, not sideways, tilted or upside down. Portraits and directional figures should stand naturally. Curved text alone is insufficient unless its placement and readable direction clearly establish the top. A circular rim or symmetric motif cannot establish upright. If any visible directional clue contradicts upright, answer no. If you cannot tell, answer unknown. Report exactly UPRIGHT=yes/no/unknown; CONFIDENCE=0-100; CUE=visible orientation evidence.'},{type:'image_url',image_url:{url:body.image}}]}],temperature:0,max_tokens:130,stream:false});
   return reply(parseUpright(typeof verification==='string'?verification:verification?.response||verification?.answer||verification?.result?.response||''));
  }
  const output=await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct',{messages:[
   {role:'system',content:'Choose the most upright view of ONE coin from four numbered quarter-turn rotations. This is orientation only. Never identify a coin, infer a year, grade it or choose catalogue entries.'},
   {role:'user',content:[{type:'text',text:'The image contains four rotated copies of the same coin, numbered 1 to 4 from left to right across two rows. Select the copy closest to its natural upright orientation. Compare actual lettering and directional artwork. Straight lettering should read left-to-right without being sideways or upside down. Denomination lettering is not always at the bottom: use the actual design rather than assuming a universal label position. Rim lettering may be used when its readable direction and placement clearly support the choice. Portrait heads should point upward, standing people/animals should stand naturally; an Australian map should have north at the top. Ignore the album background and round rim itself. Symmetric motifs without readable directional words are unknown. Do not assume the current view is upright. Report exactly: CHOICE=1-4 or unknown; CONFIDENCE=0-100; CUE=short visible orientation clue. Choose unknown when there is no clear directional cue.'},{type:'image_url',image_url:{url:body.image}}]}
  ],temperature:0,max_tokens:130,stream:false});
  const text=typeof output==='string'?output:output?.response||output?.answer||output?.result?.response||'';
  return reply(parseBatchOrientation(text));
 }catch(error){const quota=/4006|daily free allocation/i.test(String(error));return reply({angle:0,confident:false,reason:quota?'allowance':'unavailable',...(quota?{diagnostic_code:'VISION-DAILY-LIMIT'}:{})},quota?429:200);}
}};
