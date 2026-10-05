/* Local detector. Regions use coordinates in the downscaled source image. */
const BATCH_CONFIG = Object.freeze({maxSide:2400, analysisSide:480, maxCoins:24, minRadius:12, maxRadiusFraction:.19, padding:.06,
  minShapeRimCoverage:.46, minRingRimCoverage:.70, minRimContrast:17,
  minRingPolarity:.70, minRingSurfaceDifference:10, minRingSurfaceConsistency:.60});
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
  return regions.map((r,index)=>({...r,detectionNumber:r.detectionNumber||index+1,relativeDiameter:Math.max(r.width,r.height)/largest}));
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
  // Gradient voting adds candidates when foreground segmentation fails on a textured
  // surface. Each strong edge votes for plausible centres on both sides of its rim.
  const gray=new Uint8Array(width*height);
  for(let i=0;i<gray.length;i++)gray[i]=Math.round(.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2]);
  function rimEvidence({x,y,rx,ry}) {
    let hits=0,contrast=0,positive=0,negative=0,surface=0,surfacePositive=0,surfaceNegative=0,radialHits=0;
    const quarters=[0,0,0,0];
    // A real coin has a continuous edge all around its perimeter. A textured
    // table can generate centre votes but usually fails this angular check.
    for(let angle=0;angle<48;angle++){
      const theta=angle*Math.PI/24,ux=Math.cos(theta),uy=Math.sin(theta);
      let strongest=0,signed=0;
      let radial=false;
      for(const adjustment of [.94,1,1.06]){
        const ex=Math.round(x+ux*rx*adjustment),ey=Math.round(y+uy*ry*adjustment);
        if(ex>0&&ey>0&&ex<width-1&&ey<height-1){
          const index=ey*width+ex,gx=gray[index+1]-gray[index-1],gy=gray[index+width]-gray[index-width],strength=Math.hypot(gx,gy);
          const nx=ux/rx,ny=uy/ry,alignment=strength?Math.abs(gx*nx+gy*ny)/(strength*Math.hypot(nx,ny)):0;
          if(strength>=12&&alignment>=.75)radial=true;
        }
        const insideX=Math.round(x+ux*rx*(adjustment-.10)),insideY=Math.round(y+uy*ry*(adjustment-.10));
        const outsideX=Math.round(x+ux*rx*(adjustment+.10)),outsideY=Math.round(y+uy*ry*(adjustment+.10));
        if(insideX<1||outsideX<1||insideY<1||outsideY<1||insideX>=width-1||outsideX>=width-1||insideY>=height-1||outsideY>=height-1)continue;
        const difference=gray[outsideY*width+outsideX]-gray[insideY*width+insideX];
        if(Math.abs(difference)>strongest){strongest=Math.abs(difference);signed=difference;}
      }
      if(radial)radialHits++;
      if(strongest>=BATCH_CONFIG.minRimContrast){hits++;quarters[Math.floor(angle/12)]++;contrast+=strongest;if(signed>0)positive++;else negative++;}
      // A real disk has a consistent inside/outside appearance across its rim.
      // Periodic tabletop grain can cast strong edge votes without this signal.
      const ix=Math.round(x+ux*rx*.72),iy=Math.round(y+uy*ry*.72);
      const ox=Math.round(x+ux*rx*1.22),oy=Math.round(y+uy*ry*1.22);
      if(ix>=0&&iy>=0&&ox>=0&&oy>=0&&ix<width&&iy<height&&ox<width&&oy<height){
        const difference=gray[iy*width+ix]-gray[oy*width+ox];
        surface+=Math.abs(difference);if(difference>6)surfacePositive++;else if(difference< -6)surfaceNegative++;
      }
    }
    return {coverage:hits/48,radialCoverage:radialHits/48,balanced:quarters.every(count=>count>=5),contrast:hits?contrast/hits:0,polarity:hits?Math.max(positive,negative)/hits:0,
      surfaceDifference:surface/48,surfaceConsistency:Math.max(surfacePositive,surfaceNegative)/48};
  }
  const radii=[];for(let r=Math.max(12,Math.round(Math.min(width,height)*.029));r<=Math.min(width,height)*BATCH_CONFIG.maxRadiusFraction;r+=Math.max(4,Math.round(r*.12)))radii.push(r);
  const votes=radii.map(()=>new Uint16Array(width*height));
  for(let y=2;y<height-2;y+=2)for(let x=2;x<width-2;x+=2){
    const i=y*width+x,gx=gray[i+1]-gray[i-1],gy=gray[i+width]-gray[i-width],strength=Math.hypot(gx,gy);
    if(strength<31)continue;
    const ux=gx/strength,uy=gy/strength;
    for(let n=0;n<radii.length;n++)for(const sign of [-1,1]){
      const cx=Math.round(x+sign*ux*radii[n]),cy=Math.round(y+sign*uy*radii[n]);
      if(cx>0&&cy>0&&cx<width&&cy<height)votes[n][cy*width+cx]++;
    }
  }
  await batchPause();
  const rings=[];
  for(let n=0;n<radii.length;n++){
    const r=radii[n],vote=votes[n];
    for(let y=Math.ceil(r*1.12);y<height-r*1.12;y+=3)for(let x=Math.ceil(r*1.12);x<width-r*1.12;x+=3){
      let peak=0;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)peak+=vote[(y+dy)*width+x+dx];
      if(peak<Math.max(14,r*.29))continue;
      let best=0,bestRatio=1;
      for(const ratio of [1,.85,.72]){
        let covered=0,contrast=0;
        for(let angle=0;angle<32;angle++){
          const theta=angle*Math.PI/16,ux=Math.cos(theta),uy=Math.sin(theta)*ratio;
          const edgeX=Math.round(x+ux*r),edgeY=Math.round(y+uy*r),edgeIndex=edgeY*width+edgeX;
          const localEdge=Math.abs(gray[edgeIndex+1]-gray[edgeIndex-1])+Math.abs(gray[edgeIndex+width]-gray[edgeIndex-width]);
          if(localEdge>26)covered++;
          contrast+=Math.abs(gray[Math.round(y+uy*r*.78)*width+Math.round(x+ux*r*.78)]-gray[Math.round(y+uy*r*1.10)*width+Math.round(x+ux*r*1.10)]);
        }
        const score=covered/32*peak+contrast/32*.24;
        if(covered>=12&&contrast/32>=10&&score>best){best=score;bestRatio=ratio;}
      }
      if(best>16)rings.push({x,y,rx:r,ry:r*bestRatio,score:best});
    }
    if(n%4===0)await batchPause();
  }
  // Rank confident foreground shapes first, then fill gaps from rim votes.
  candidates.sort((a,b)=>b.score-a.score);
  rings.sort((a,b)=>b.score-a.score);

  const accepted=[];
  for(const suggestion of [...candidates.map(candidate=>({...candidate,kind:'shape'})),...rings.map(ring=>({...ring,kind:'ring'}))]){if(accepted.length>=BATCH_CONFIG.maxCoins)break;
    // Edge votes sometimes land on an inner design circle. Check nearby larger
    // radii before fixing the crop so the actual outside rim stays in frame.
    let c=suggestion,evidence=rimEvidence(c);
    if(c.kind==='ring')for(const factor of [1.12,1.24]){
      const wider={...suggestion,rx:suggestion.rx*factor,ry:suggestion.ry*factor};
      const rim=rimEvidence(wider);
      if(rim.balanced&&rim.coverage>=BATCH_CONFIG.minRingRimCoverage&&rim.coverage*rim.contrast>evidence.coverage*evidence.contrast*1.06){c=wider;evidence=rim;}
    }
    if(!evidence.balanced||evidence.coverage<(c.kind==='shape'?BATCH_CONFIG.minShapeRimCoverage:BATCH_CONFIG.minRingRimCoverage))continue;
    // Fabric edges may cross a circular path without pointing toward its
    // centre. A coin's outer-rim gradients should follow the ellipse normal.
    if(evidence.radialCoverage<(c.kind==='shape'?.36:.52))continue;
    if(c.kind==='shape'&&(evidence.polarity<.62||evidence.surfaceConsistency<.58))continue;
    if(c.kind==='ring'&&(evidence.contrast<24||evidence.polarity<BATCH_CONFIG.minRingPolarity||
      evidence.surfaceDifference<BATCH_CONFIG.minRingSurfaceDifference||evidence.surfaceConsistency<BATCH_CONFIG.minRingSurfaceConsistency))continue;
    if(accepted.some(previous=>Math.hypot(previous.x-c.x,previous.y-c.y)<Math.max(previous.rx,previous.ry,c.rx,c.ry)*.9))continue;
    accepted.push({...c,evidence});
  }
  return updateRelativeDiameters(accepted.sort((a,b)=>a.y-b.y||a.x-b.x).map(c=>({...regionAt(c.x/scale,c.y/scale,c.rx/scale,c.ry/scale,Math.min(1,c.evidence.coverage*c.evidence.polarity)),detectionStatus:'unchecked',reviewed:false,rimEvidence:c.evidence})));
}
async function cropCoins(source,regions) {
  const crops=[];
  for(const region of updateRelativeDiameters(regions)) {
    // Voting can catch an inner ring rather than the outer edge of a coin.
    // Give automatic crops extra room; manual selections keep the tighter pad.
    const padding=BATCH_CONFIG.padding;
    const diameter=Math.max(region.width,region.height)*(1+padding*2);
    const side=Math.min(768,Math.max(256,Math.ceil(diameter)));
    const canvas=document.createElement('canvas');canvas.width=side;canvas.height=side;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f0e9';ctx.fillRect(0,0,side,side);
    const sampling=diameter;
    // Mask background and neighbouring coins before sending this specimen to
    // vision. Keep a small tolerance outside the selected rim (including 50c).
    ctx.save();ctx.beginPath();
    ctx.ellipse(side/2,side/2,region.radiusX/sampling*side*1.05,region.radiusY/sampling*side*1.05,0,0,Math.PI*2);
    ctx.clip();
    ctx.drawImage(source,region.centreX-sampling/2,region.centreY-sampling/2,sampling,sampling,0,0,side,side);
    ctx.restore();
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Unable to crop photo')),'image/jpeg',.9));
    canvas.width=0;canvas.height=0;
    crops.push({...region,crop:blob,cropUrl:URL.createObjectURL(blob)});
    await batchPause();
  }
  return crops;
}
window.BatchCoins={config:BATCH_CONFIG,prepareBatchImage,detectCoins,cropCoins,regionAt,updateRelativeDiameters};
