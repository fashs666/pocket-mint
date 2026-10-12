/* Batch orientation only. Rendered coarse direction followed by fine tilt. */
export const ROTATION_MODEL='@cf/qwen/qwen3.8-27b';
export const ROTATION_ANGLES={coarse8:[0,45,90,135,180,-135,-90,-45],fine9:[-30,-22.5,-15,-7.5,0,7.5,15,22.5,30]};
export const ROTATION_PROMPTS={
 coarse8:'Eight numbered panels show rotated views of ONE coin. Choose the view closest to natural upright and level. Check actual engraved letter shapes and directional artwork, not just where words sit on the circular rim. Animals can naturally lie horizontally; denominations are not always at the bottom. Ignore background/album seams, outline rings and numbers inside the coins. Labels above each panel are panel IDs only, in row order. Return ONLY JSON {"choice":1-8 or null if unclear,"confidence":0-100,"cue":"up to 12 words of visible evidence"}.',
 fine9:'Nine numbered panels show the SAME coin in closely spaced tilt corrections, all facing roughly upright. Choose the most naturally upright and LEVEL view. Compare actual letter tops, straight word baselines, portrait/figure verticals or ground/sky. Rim words are curved: do not force every letter onto a horizontal line or assume a universal denomination position. Ignore album seams, rim/crop ellipse, shadows, outlines and overlaid numbers. Labels above the panels are IDs in row order. If you cannot distinguish the tilts from real directional evidence, return null. Return ONLY JSON {"choice":1-9 or null,"confidence":0-100,"cue":"up to 12 words of actual visible evidence"}.'
};
export function parseRenderedChoice(text,phase){
 if(!Object.hasOwn(ROTATION_ANGLES,phase)||typeof text!=='string')return {angle:0,confident:false,reason:'uncertain'};const angles=ROTATION_ANGLES[phase];
 let parsed;try{parsed=JSON.parse(text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i,'$1'));}catch{return {angle:0,confident:false,reason:'uncertain'};}
 if(!Number.isInteger(parsed?.choice)||parsed.choice<1||parsed.choice>angles.length||!Number.isFinite(parsed.confidence)||parsed.confidence<90||parsed.confidence>100||typeof parsed.cue!=='string'||parsed.cue.trim().length<4||/^(unknown|none|symmetr|rim only|circle|unreadable)/i.test(parsed.cue))return {angle:0,confident:false,reason:'uncertain'};
 return {angle:angles[parsed.choice-1],confident:true,reason:phase==='fine9'?'rendered_fine_orientation':'rendered_coarse_orientation'};
}
export async function renderedOrientation(ai,phase,image){
 const output=await ai.run(ROTATION_MODEL,{messages:[{role:'user',content:[{type:'text',text:ROTATION_PROMPTS[phase]},{type:'image_url',image_url:{url:image}}]}],temperature:0,max_completion_tokens:128,chat_template_kwargs:{enable_thinking:false},stream:false,store:false});
 return parseRenderedChoice(typeof output==='string'?output:output?.choices?.[0]?.message?.content||output?.response||'',phase);
}
