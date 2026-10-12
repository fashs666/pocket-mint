/* Orientation only for already isolated batch crops. No detection or grading. */
(() => {
  let suggestions=new WeakMap(),referenceSignature='';
  const coarseAngles=[0,45,90,135,180,-135,-90,-45],fineAngles=[-30,-22.5,-15,-7.5,0,7.5,15,22.5,30];
  async function suggest(file){
    const tests=typeof identificationTests==='undefined'?[]:identificationTests;
    const signature=tests.filter(t=>t.flow==='batch_rotation').map(t=>t.id).join('|');
    if(signature!==referenceSignature){suggestions=new WeakMap();referenceSignature=signature;}
    if(suggestions.has(file))return suggestions.get(file);
    const pending=analyze(file);suggestions.set(file,pending);
    const result=await pending;
    if(['allowance','unavailable'].includes(result.reason))suggestions.delete(file);
    return result;
  }
  async function analyze(file){
    try {
      // Saved upright examples can resolve any angle, including small tilts,
      // without another model request. Only very strong, unambiguous matches
      // qualify; different framing/lighting falls back to the existing check.
      let memory=null;
      try{memory=await window.BatchRotationMemory?.match(file,typeof identificationTests==='undefined'?[]:identificationTests);}catch{/* Reference decode failure must not disable the existing fallback. */}
      if(memory)return {file:Math.abs(memory.angle)<1?file:await rotate(file,memory.angle),confident:true,angle:memory.angle,reason:memory.reason};
      if(window.PocketMintVisionAllowance?.blocked())return {file,confident:false,reason:'allowance'};
      // Eight directions avoid forcing every result into a quarter turn.
      const image=await renderedChoices(file,coarseAngles);
      const response=await fetch('/api/batch-orientation',{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json'},body:JSON.stringify({phase:'coarse8',image})});
      const direction=await response.json();
      if(!response.ok)return {file,confident:false,reason:direction.reason==='allowance'?'allowance':'unavailable'};
      if(direction.confident!==true||!coarseAngles.includes(direction.angle))return {file,confident:false,reason:direction.reason||'uncertain'};
      // Render fine candidates directly from the original, avoiding resampling
      // and shrinking the coin after an expanded oblique rotation.
      const checkImage=await renderedChoices(file,fineAngles,direction.angle);
      const check=await fetch('/api/batch-orientation',{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json'},body:JSON.stringify({phase:'fine9',image:checkImage})});
      const verification=await check.json();
      if(!check.ok)return {file,confident:false,reason:verification.reason==='allowance'?'allowance':'unavailable'};
      if(verification.confident!==true||!fineAngles.includes(verification.angle))return {file,confident:false,reason:verification.reason||'uncertain'};
      // An outermost fine choice suggests the coarse direction was wrong or
      // insufficiently resolved. Do not silently apply a boundary guess.
      if(Math.abs(verification.angle)>=30)return {file,confident:false,reason:'inconsistent'};
      const angle=((direction.angle+verification.angle+540)%360)-180;
      return {file:angle===0?file:await rotate(file,angle),confident:true,angle,reason:'rendered_fine_orientation'};
    } catch {return {file,confident:false,reason:'unavailable'};}
  }
  async function renderedChoices(file,angles,offset=0){
    const bitmap=await decodeIdentifyPhoto(file),canvas=document.createElement('canvas'),columns=angles.length===8?4:3;
    canvas.width=384*columns;canvas.height=428*Math.ceil(angles.length/columns);
    try{
      const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f0e9';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='bold 24px sans-serif';ctx.textAlign='center';
      angles.forEach((angle,i)=>{
        const x=i%columns*384,y=Math.floor(i/columns)*428;ctx.fillStyle='#151528';ctx.fillText(String(i+1),x+192,y+30);
        ctx.save();ctx.beginPath();ctx.rect(x,y+44,384,384);ctx.clip();ctx.translate(x+192,y+236);ctx.rotate((angle+offset)*Math.PI/180);
        const scale=336/Math.max(bitmap.width,bitmap.height);ctx.scale(scale,scale);ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);ctx.restore();
      });return canvas.toDataURL('image/jpeg',.85);
    }finally{bitmap.close?.();canvas.width=canvas.height=0;}
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
  window.BatchPhotoRotation={suggest,rotate,choices,renderedChoices,coarseAngles,fineAngles};
})();
