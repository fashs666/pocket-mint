/* Orientation only for already isolated batch crops. No detection or grading. */
(() => {
  async function suggest(file){
    try {
      const bitmap=await decodeIdentifyPhoto(file);
      const tile=384,pad=28,canvas=document.createElement('canvas');canvas.width=tile*2;canvas.height=(tile+pad)*2;
      const context=canvas.getContext('2d');context.fillStyle='#faf5e9';context.fillRect(0,0,canvas.width,canvas.height);
      const angles=[0,90,180,-90];
      for(let i=0;i<angles.length;i++){
        const x=(i%2)*tile,y=Math.floor(i/2)*(tile+pad),angle=angles[i]*Math.PI/180;
        context.fillStyle='#111827';context.font='bold 22px sans-serif';context.textAlign='center';context.fillText(String(i+1),x+tile/2,y+23);
        context.save();context.translate(x+tile/2,y+pad+tile/2);context.rotate(angle);
        const size=tile*.85,scale=Math.min(size/bitmap.width,size/bitmap.height);context.drawImage(bitmap,-bitmap.width*scale/2,-bitmap.height*scale/2,bitmap.width*scale,bitmap.height*scale);context.restore();
      }
      bitmap.close?.();const image=canvas.toDataURL('image/jpeg',.88);canvas.width=canvas.height=0;
      const response=await fetch('/api/batch-orientation',{method:'POST',signal:AbortSignal.timeout(18000),headers:{'content-type':'application/json'},body:JSON.stringify({image})});
      if(!response.ok)return {file,confident:false,reason:'unavailable'};
      const direction=await response.json();
      if(direction.confident!==true||!Number.isFinite(direction.angle)||Math.abs(direction.angle)>180)return {file,confident:false,reason:direction.reason||'uncertain'};
      const candidate=Math.abs(direction.angle)<1?file:await rotate(file,direction.angle);
      // Independently check the full-size chosen view; a contact-sheet choice alone
      // was confidently wrong on real album photos. Do not expose it until verified.
      const checkImage=await makeAnalysisImage(candidate);
      const check=await fetch('/api/batch-orientation',{method:'POST',signal:AbortSignal.timeout(18000),headers:{'content-type':'application/json'},body:JSON.stringify({phase:'verify',image:checkImage})});
      if(!check.ok)return {file,confident:false,reason:'unavailable'};
      const verification=await check.json();
      return verification.confident===true?{file:candidate,confident:true}:{file,confident:false,reason:verification.reason||'uncertain'};
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
