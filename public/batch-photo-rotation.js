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
      // Choosing an actual rendered view avoids unreliable numeric-angle inference.
      const image=await choices(file);
      const response=await fetch('/api/batch-orientation',{method:'POST',signal:AbortSignal.timeout(18000),headers:{'content-type':'application/json'},body:JSON.stringify({phase:'choice',image})});
      const direction=await response.json();
      if(!response.ok)return {file,confident:false,reason:direction.reason==='allowance'?'allowance':'unavailable'};
      if(direction.confident!==true||![0,90,180,-90].includes(direction.angle))return {file,confident:false,reason:direction.reason||'uncertain'};
      const candidate=Math.abs(direction.angle)<1?file:await rotate(file,direction.angle);
      // Shift every verification view by 90°: the same upright choice must now
      // occupy a different slot. Agreement is required; neither call sees the prior answer.
      const checkImage=await choices(candidate,90);
      const check=await fetch('/api/batch-orientation',{method:'POST',signal:AbortSignal.timeout(18000),headers:{'content-type':'application/json'},body:JSON.stringify({phase:'verify_choice',image:checkImage})});
      const verification=await check.json();
      if(!check.ok)return {file,confident:false,reason:verification.reason==='allowance'?'allowance':'unavailable'};
      return verification.confident===true&&verification.angle===-90?{file:candidate,confident:true,angle:direction.angle}:{file,confident:false,reason:verification.confident?'inconsistent':verification.reason||'uncertain'};
    } catch {return {file,confident:false,reason:'unavailable'};}
  }
  async function choices(file,offset=0){
    const bitmap=await decodeIdentifyPhoto(file),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1112;
    try{
      const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f0e9';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='bold 32px sans-serif';ctx.textAlign='center';
      [0,90,180,-90].forEach((angle,i)=>{
        const x=(i%2)*512,y=Math.floor(i/2)*556;ctx.fillStyle='#151528';ctx.fillText(String(i+1),x+256,y+36);
        ctx.save();ctx.translate(x+256,y+300);ctx.rotate((angle+offset)*Math.PI/180);const scale=464/Math.max(bitmap.width,bitmap.height);ctx.scale(scale,scale);ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);ctx.restore();
      });return canvas.toDataURL('image/jpeg',.88);
    }finally{bitmap.close?.();canvas.width=canvas.height=0;}
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
  window.BatchPhotoRotation={suggest,rotate,choices};
})();
