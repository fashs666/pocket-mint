/* Automatic presentation adjustments. Recognition inputs are never replaced here. */
(() => {
  const cache=new WeakMap(),manual=new WeakSet(),originals=new WeakMap();
  async function preserveSource(file){
    const image=await decodeIdentifyPhoto(file);
    try{const scale=Math.min(1,2400/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const url=canvas.toDataURL('image/webp',.92);canvas.width=canvas.height=0;return url;
    }finally{image.close?.();}
  }
  function chooseCrop(regions,width,height){
    if(regions.length!==1)return null;
    const region=regions[0];
    if(region.confidence<.6||region.width<width*.08||region.height<height*.08)return null;
    const margin=.08;
    if(region.x< -region.width*margin||region.y< -region.height*margin||region.x+region.width>width+region.width*margin||region.y+region.height>height+region.height*margin)return null;
    return region;
  }
  async function suggest(file){
    if(manual.has(file))return {file,manual:true,angle:0,cropped:false};
    if(cache.has(file))return cache.get(file);
    const job=prepare(file).catch(()=>({file,angle:0,cropped:false,uncertain:true}));cache.set(file,job);return job;
  }
  async function prepare(file){
    const bitmap=await decodeIdentifyPhoto(file);
    try{
      // Pad the detector image so a large single coin is within its radius range.
      const probe=document.createElement('canvas');probe.width=probe.height=480;
      const ctx=probe.getContext('2d');ctx.fillStyle='#f3f0e9';ctx.fillRect(0,0,480,480);
      const scale=480/(Math.max(bitmap.width,bitmap.height)*2.8),left=(480-bitmap.width*scale)/2,top=(480-bitmap.height*scale)/2;
      ctx.drawImage(bitmap,left,top,bitmap.width*scale,bitmap.height*scale);
      const found=await BatchCoins.detectCoins(probe);probe.width=probe.height=0;
      const regions=found.map(r=>({...r,x:(r.x-left)/scale,y:(r.y-top)/scale,width:r.width/scale,height:r.height/scale,centreX:(r.centreX-left)/scale,centreY:(r.centreY-top)/scale,radiusX:r.radiusX/scale,radiusY:r.radiusY/scale}));
      const crop=chooseCrop(regions,bitmap.width,bitmap.height);
      // Keep the whole source if detection is not unambiguous.
      const diameter=crop?Math.max(crop.width,crop.height)*1.10:Math.max(bitmap.width,bitmap.height);
      const centreX=crop?.centreX??bitmap.width/2,centreY=crop?.centreY??bitmap.height/2;
      const orientation=document.createElement('canvas');orientation.width=orientation.height=640;
      const oc=orientation.getContext('2d');oc.fillStyle='#f3f0e9';oc.fillRect(0,0,640,640);oc.drawImage(bitmap,centreX-diameter/2,centreY-diameter/2,diameter,diameter,0,0,640,640);
      let direction={angle:0,confident:false};
      try{const response=await fetch('/api/photo-orientation',{method:'POST',signal:AbortSignal.timeout(12000),headers:{'content-type':'application/json'},body:JSON.stringify({image:orientation.toDataURL('image/jpeg',.8)})});if(response.ok)direction=await response.json();}catch{}
      orientation.width=orientation.height=0;
      const angle=direction.confident&&Number.isFinite(direction.angle)&&Math.abs(direction.angle)<=180?direction.angle:0;
      if(!crop&&!angle)return {file,cropped:false,angle:0,uncertain:true};
      const canvas=document.createElement('canvas');canvas.width=canvas.height=768;const out=canvas.getContext('2d');
      out.save();out.translate(384,384);
      if(crop){out.beginPath();out.ellipse(0,0,crop.radiusX/diameter*768*1.05,crop.radiusY/diameter*768*1.05,angle*Math.PI/180,0,Math.PI*2);out.clip();}
      const outputDiameter=crop?diameter:Math.hypot(bitmap.width,bitmap.height);
      out.rotate(angle*Math.PI/180);out.scale(768/outputDiameter,768/outputDiameter);out.drawImage(bitmap,-centreX,-centreY);out.restore();
      const blob=await canvasBlob(canvas,'image/png');canvas.width=canvas.height=0;
      const adjusted=new File([blob],'auto-coin.png',{type:'image/png',lastModified:Date.now()});manual.add(adjusted);
      return {file:adjusted,cropped:Boolean(crop),angle,uncertain:!direction.confident};
    }finally{bitmap.close?.();}
  }
  addPhoto=async function addTidiedPhoto(id,file){
    const adjusted=await suggest(file);
    const source=originals.get(file)||file;
    // Save the source alongside the tidy photo in the existing photo record.
    const original=await preserveSource(source);
    const photo={id:crypto.randomUUID(),coin_id:id,data_url:adjusted.file===source?original:await resizeImage(adjusted.file),original_data_url:original,created_at:new Date().toISOString(),auto_adjustment:{cropped:adjusted.cropped,clockwise:adjusted.angle,manual:Boolean(adjusted.manual)}};
    await put('personalPhotos',photo);if(!photoMap.has(id))photoMap.set(id,[]);photoMap.get(id).push(photo);
  };
  window.AutoCoinPhoto={suggest,chooseCrop,markManual(file,source){manual.add(file);if(source&&source!==file)originals.set(file,originals.get(source)||source);}};
})();
