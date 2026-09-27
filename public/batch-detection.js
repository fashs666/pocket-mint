/* Local detector. Regions use coordinates in the downscaled source image. */
const BATCH_CONFIG = Object.freeze({maxSide:900, analysisSide:560, maxCoins:10, minRadius:12, maxRadiusFraction:.18, padding:.13});
const batchPause = () => new Promise(resolve => setTimeout(resolve,0));

async function decodeBatchImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, {imageOrientation:'from-image'}); } catch {}
  }
  const url=URL.createObjectURL(file);
  try {
    const image=new Image(); image.src=url;
    if(image.decode) await image.decode();
    else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
    return image;
  } finally { URL.revokeObjectURL(url); }
}
async function prepareBatchImage(file) {
  const image=await decodeBatchImage(file);
  const factor=Math.min(1,BATCH_CONFIG.maxSide/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(image.width*factor); canvas.height=Math.round(image.height*factor);
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  image.close?.();
  return canvas;
}
function regionAt(x,y,rx,ry,confidence=0,manual=false) {
  return {id:crypto.randomUUID(),x:x-rx,y:y-ry,width:rx*2,height:ry*2,centreX:x,centreY:y,radius:(rx+ry)/2,radiusX:rx,radiusY:ry,confidence,manual};
}
function updateRelativeDiameters(regions) {
  const largest=Math.max(1,...regions.map(r=>Math.max(r.width,r.height)));
  return regions.map((r,index)=>({...r,detectionNumber:index+1,relativeDiameter:Math.max(r.width,r.height)/largest}));
}
async function detectCoins(source) {
  const scale=Math.min(1,BATCH_CONFIG.analysisSide/Math.max(source.width,source.height));
  const width=Math.round(source.width*scale),height=Math.round(source.height*scale);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,width,height);
  const rgba=ctx.getImageData(0,0,width,height).data;canvas.width=0;canvas.height=0;
  // Estimate the surface colour from small patches at the four corners.
  // A coin's face can vary, but its rim generally separates from a fairly even surface.
  const samples=[[],[],[]],corner=Math.max(4,Math.floor(Math.min(width,height)*.035));
  for(const [sx,sy] of [[0,0],[width-corner,0],[0,height-corner],[width-corner,height-corner]])
    for(let y=sy;y<sy+corner;y+=2)for(let x=sx;x<sx+corner;x+=2){const i=(y*width+x)*4;for(let c=0;c<3;c++)samples[c].push(rgba[i+c]);}
  const background=samples.map(channel=>channel.sort((a,b)=>a-b)[Math.floor(channel.length/2)]);
  const mask=new Uint8Array(width*height);
  const threshold=31;
  for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){
    const i=y*width+x,j=i*4;
    const distance=Math.hypot(rgba[j]-background[0],rgba[j+1]-background[1],rgba[j+2]-background[2]);
    if(distance>threshold)mask[i]=1;
  }
  await batchPause();
  const visited=new Uint8Array(mask.length),queue=new Int32Array(mask.length),candidates=[];
  const minDiameter=Math.min(width,height)*.055,maxDiameter=Math.min(width,height)*.48;
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||visited[start])continue;
    let head=0,tail=1;queue[0]=start;visited[start]=1;
    let xMin=width,yMin=height,xMax=0,yMax=0;
    while(head<tail){const i=queue[head++],x=i%width,y=(i-x)/width;
      xMin=Math.min(xMin,x);xMax=Math.max(xMax,x);yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);
      for(const neighbour of [i-1,i+1,i-width,i+width]){
        if(neighbour<0||neighbour>=mask.length||visited[neighbour]||!mask[neighbour])continue;
        if(Math.abs(neighbour%width-x)+Math.abs(Math.floor(neighbour/width)-y)!==1)continue;
        visited[neighbour]=1;queue[tail++]=neighbour;
      }
    }
    const w=xMax-xMin+1,h=yMax-yMin+1,aspect=Math.min(w,h)/Math.max(w,h);
    const fill=tail/(w*h);
    // Loose ellipse test tolerates camera angle and twelve-sided Australian 50c coins.
    if(Math.min(w,h)<minDiameter||Math.max(w,h)>maxDiameter||aspect<.64||fill<.39||fill>.96)continue;
    if(xMin<4||yMin<4||xMax>width-5||yMax>height-5)continue;
    candidates.push({x:(xMin+xMax)/2,y:(yMin+yMax)/2,rx:w/2,ry:h/2,score:fill*aspect*Math.sqrt(tail)});
    if(start%(width*60)<width)await batchPause();
  }
  candidates.sort((a,b)=>b.score-a.score);
  const accepted=[];
  for(const c of candidates){if(accepted.length>=BATCH_CONFIG.maxCoins)break;
    if(accepted.some(previous=>Math.hypot(previous.x-c.x,previous.y-c.y)<Math.max(previous.rx,previous.ry,c.rx,c.ry)*.9))continue;
    accepted.push(c);
  }
  return updateRelativeDiameters(accepted.sort((a,b)=>a.y-b.y||a.x-b.x).map(c=>regionAt(c.x/scale,c.y/scale,c.rx/scale,c.ry/scale,Math.min(1,c.score/65))));
}
async function cropCoins(source,regions) {
  const crops=[];
  for(const region of updateRelativeDiameters(regions)) {
    const diameter=Math.max(region.width,region.height)*(1+BATCH_CONFIG.padding*2);
    const side=Math.min(768,Math.max(256,Math.ceil(diameter)));
    const canvas=document.createElement('canvas');canvas.width=side;canvas.height=side;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f0e9';ctx.fillRect(0,0,side,side);
    const sampling=diameter;
    ctx.drawImage(source,region.centreX-sampling/2,region.centreY-sampling/2,sampling,sampling,0,0,side,side);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Unable to crop photo')),'image/jpeg',.9));
    canvas.width=0;canvas.height=0;
    crops.push({...region,crop:blob,cropUrl:URL.createObjectURL(blob)});
    await batchPause();
  }
  return crops;
}
window.BatchCoins={config:BATCH_CONFIG,prepareBatchImage,detectCoins,cropCoins,regionAt,updateRelativeDiameters};
