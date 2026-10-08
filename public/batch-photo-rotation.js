/* Orientation only for already isolated batch crops. No detection or grading. */
(() => {
  async function suggest(file){
    let bitmap;
    try {
      const image=await BatchCoins.batchVisionImage(file);
      const response=await fetch('/api/photo-orientation',{method:'POST',signal:AbortSignal.timeout(12000),headers:{'content-type':'application/json'},body:JSON.stringify({image})});
      if(!response.ok)return {file,confident:false};
      const direction=await response.json();
      if(direction.confident!==true||!Number.isFinite(direction.angle)||Math.abs(direction.angle)>180)return {file,confident:false};
      if(Math.abs(direction.angle)<1)return {file,confident:true};
      bitmap=await createImageBitmap(file);
      const radians=direction.angle*Math.PI/180;
      const canvas=document.createElement('canvas');
      // Preserve the entire crop even at an oblique angle; no clipping/re-detection.
      canvas.width=Math.ceil(Math.abs(bitmap.width*Math.cos(radians))+Math.abs(bitmap.height*Math.sin(radians)));
      canvas.height=Math.ceil(Math.abs(bitmap.width*Math.sin(radians))+Math.abs(bitmap.height*Math.cos(radians)));
      const context=canvas.getContext('2d');context.translate(canvas.width/2,canvas.height/2);context.rotate(radians);context.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);
      const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      canvas.width=canvas.height=0;
      if(!output)return {file,confident:false};
      window.AutoCoinPhoto?.markManual(output,file);
      return {file:output,confident:true};
    } catch {return {file,confident:false};}
    finally {bitmap?.close();}
  }
  window.BatchPhotoRotation={suggest};
})();
