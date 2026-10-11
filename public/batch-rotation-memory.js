/* On-device orientation references from the user's explicitly saved upright
   crops. No catalogue decisions, uploads, training requests or collection writes. */
(() => {
  const size=180,steps=180,rings=24,cache=new Map();
  const distance=(a,b)=>Math.abs(((a-b+540)%360)-180);
  function describe(pixels){
    const values=new Float32Array(steps*rings);
    for(let r=0;r<rings;r++){
      const radius=size*(.098+(r/(rings-1))*.324);let mean=0;
      for(let a=0;a<steps;a++){
        const theta=a*Math.PI*2/steps,x=Math.round((size-1)/2+radius*Math.cos(theta)),y=Math.round((size-1)/2+radius*Math.sin(theta));
        const i=(y*size+x)*4,value=(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114)*(pixels[i+3]/255);
        values[r*steps+a]=value;mean+=value;
      }
      mean/=steps;let variance=0;
      for(let a=0;a<steps;a++){const i=r*steps+a;values[i]-=mean;variance+=values[i]*values[i];}
      const deviation=Math.max(5,Math.sqrt(variance/steps));
      for(let a=0;a<steps;a++)values[r*steps+a]/=deviation;
    }
    return values;
  }
  function compare(input,reference){
    const scores=new Float32Array(steps);let best=0;
    for(let shift=0;shift<steps;shift++){
      let sum=0;
      for(let r=0;r<rings;r++)for(let a=0;a<steps;a++)sum+=input[r*steps+a]*reference[r*steps+(a+shift)%steps];
      scores[shift]=sum/(steps*rings);if(scores[shift]>scores[best])best=shift;
    }
    const angle=best*2>180?best*2-360:best*2;let other=-Infinity;
    for(let i=0;i<steps;i++)if(distance(i*2,angle)>12)other=Math.max(other,scores[i]);
    return {angle,score:scores[best],margin:scores[best]-other};
  }
  async function descriptor(file){
    const bitmap=await decodeIdentifyPhoto(file),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    try{
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#f3f0e9';ctx.fillRect(0,0,size,size);
      const scale=size/Math.max(bitmap.width,bitmap.height);
      ctx.drawImage(bitmap,(size-bitmap.width*scale)/2,(size-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);
      return describe(ctx.getImageData(0,0,size,size).data);
    }finally{bitmap.close?.();canvas.width=canvas.height=0;}
  }
  function savedReferences(tests){
    const references=[];
    // Bound work on phones. Newest corrections take priority; skip unsupported,
    // incomplete or legacy identification records without an upright assertion.
    for(const test of tests||[]){
      if(test.flow!=='batch_rotation')continue;
      for(const coin of test.coins||[]){
        const image=test.images?.[coin.upright_image_ref];
        if(coin.upright_confirmed===true&&typeof image==='string'&&/^data:image\/jpeg;base64,/.test(image)&&!references.includes(image))references.push(image);
        if(references.length===32)return references;
      }
    }
    return references;
  }
  async function match(file,tests){
    const references=savedReferences(tests);if(!references.length){cache.clear();return null;}
    const live=new Set(references);for(const key of cache.keys())if(!live.has(key))cache.delete(key);
    const input=await descriptor(file);let best=null;const accepted=[];
    for(const image of references){
      try{
        // Give touch/scroll and pending manual edits a turn between comparisons.
        await new Promise(resolve=>setTimeout(resolve,0));
        if(!cache.has(image)){const blob=await (await fetch(image)).blob();cache.set(image,await descriptor(blob));}
        const result=compare(input,cache.get(image));
        if(result.score>=.82&&result.margin>=.2){accepted.push(result);if(!best||result.score>best.score)best=result;}
      }catch{cache.delete(image);}
    }
    if(!best||accepted.some(result=>distance(result.angle,best.angle)>8))return null;
    return {...best,reason:'saved_upright_reference'};
  }
  window.BatchRotationMemory={match,describe,compare,savedReferences};
})();
