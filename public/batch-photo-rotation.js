/* Orientation only for already isolated batch crops. No detection or grading. */
(() => {
  async function suggest(file){
    try {
      const image=await BatchCoins.batchVisionImage(file);
      const response=await fetch('/api/photo-orientation',{method:'POST',signal:AbortSignal.timeout(12000),headers:{'content-type':'application/json'},body:JSON.stringify({image})});
      if(!response.ok)return {file,confident:false};
      const direction=await response.json();
      if(direction.confident!==true||!Number.isFinite(direction.angle)||Math.abs(direction.angle)>180)return {file,confident:false};
      if(Math.abs(direction.angle)<1)return {file,confident:true};
      return {file:await rotate(file,direction.angle),confident:true};
    } catch {return {file,confident:false};}
  }
  async function rotate(file,angle){
    const bitmap=await createImageBitmap(file);
    try{
      const radians=angle*Math.PI/180;
      const canvas=document.createElement('canvas');
      // Preserve the entire crop even at an oblique angle; no clipping/re-detection.
      canvas.width=Math.ceil(Math.abs(bitmap.width*Math.cos(radians))+Math.abs(bitmap.height*Math.sin(radians)));
      canvas.height=Math.ceil(Math.abs(bitmap.width*Math.sin(radians))+Math.abs(bitmap.height*Math.cos(radians)));
      const context=canvas.getContext('2d');context.translate(canvas.width/2,canvas.height/2);context.rotate(radians);context.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);
      const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      canvas.width=canvas.height=0;
      if(!output)throw new Error("Could not rotate photo");
      window.AutoCoinPhoto?.markManual(output,file);
      return output;
    }finally{bitmap.close();}
  }
  window.BatchPhotoRotation={suggest,rotate};
})();
