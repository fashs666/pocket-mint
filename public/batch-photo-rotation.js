/* Orientation only for already isolated batch crops. No detection or grading. */
(() => {
  const suggestions=new WeakMap();
  async function suggest(file){
    if(window.PocketMintVisionAllowance?.blocked())return {file,confident:false,reason:'allowance'};
    if(suggestions.has(file))return suggestions.get(file);
    const pending=analyze(file);suggestions.set(file,pending);
    const result=await pending;
    if(['allowance','unavailable'].includes(result.reason))suggestions.delete(file);
    return result;
  }
  async function analyze(file){
    try {
      // A large single view retains lettering and allows small tilt corrections.
      const image=await makeAnalysisImage(file);
      const response=await fetch('/api/batch-orientation',{method:'POST',signal:AbortSignal.timeout(18000),headers:{'content-type':'application/json'},body:JSON.stringify({phase:'direction',image})});
      const direction=await response.json();
      if(!response.ok)return {file,confident:false,reason:direction.reason==='allowance'?'allowance':'unavailable'};
      if(direction.confident!==true||!Number.isFinite(direction.angle)||Math.abs(direction.angle)>180)return {file,confident:false,reason:direction.reason||'uncertain'};
      const candidate=Math.abs(direction.angle)<1?file:await rotate(file,direction.angle);
      // Independently check the full-size chosen view; a contact-sheet choice alone
      // was confidently wrong on real album photos. Do not expose it until verified.
      const checkImage=await makeAnalysisImage(candidate);
      const check=await fetch('/api/batch-orientation',{method:'POST',signal:AbortSignal.timeout(18000),headers:{'content-type':'application/json'},body:JSON.stringify({phase:'verify',image:checkImage})});
      const verification=await check.json();
      if(!check.ok)return {file,confident:false,reason:verification.reason==='allowance'?'allowance':'unavailable'};
      return verification.confident===true?{file:candidate,confident:true,angle:direction.angle}:{file,confident:false,reason:verification.reason||'uncertain'};
    } catch {return {file,confident:false,reason:'unavailable'};}
  }
  async function rotate(file,angle){
    const bitmap=await decodeIdentifyPhoto(file);
    try{
      const radians=angle*Math.PI/180;
      const canvas=document.createElement('canvas');
      // Preserve the entire crop even at an oblique angle; no clipping/re-detection.
      canvas.width=Math.ceil(Math.abs(bitmap.width*(Math.abs(Math.cos(radians))<1e-8?0:Math.cos(radians)))+Math.abs(bitmap.height*Math.sin(radians)));
      canvas.height=Math.ceil(Math.abs(bitmap.width*Math.sin(radians))+Math.abs(bitmap.height*(Math.abs(Math.cos(radians))<1e-8?0:Math.cos(radians))));
      const context=canvas.getContext('2d');context.translate(canvas.width/2,canvas.height/2);context.rotate(radians);context.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);
      const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      canvas.width=canvas.height=0;
      if(!output)throw new Error("Could not rotate photo");
      window.AutoCoinPhoto?.markManual(output,file);
      return output;
    }finally{bitmap.close?.();}
  }
  window.BatchPhotoRotation={suggest,rotate};
})();
