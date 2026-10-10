/* Explicit photo adjustments only. Catalogue artwork and matching code are untouched. */
(() => {
  let active=false;
  const transform=(width,height,zoom,angle,offsetX,offsetY,size=768)=>({
    scale:size/Math.min(width,height)*zoom,angle:angle*Math.PI/180,
    x:size/2+offsetX*size,y:size/2+offsetY*size
  });
  async function edit(file,options={}){
    if(active)return null;
    active=true;let bitmap,originalBitmap,dialog;
    try{
      originalBitmap=await decodeIdentifyPhoto(file);bitmap=originalBitmap;
      const suggestion=options.suggest===false?null:await window.AutoCoinPhoto?.suggest(file);
      if(suggestion&&suggestion.file!==file)bitmap=await decodeIdentifyPhoto(suggestion.file);
      return await new Promise(resolve=>{
        dialog=document.createElement('dialog');dialog.className='coinPhotoEditor';
        dialog.innerHTML='<form method="dialog"><h3>Adjust coin photo</h3><p>Check the automatic suggestion. Drag to centre the coin, zoom to its outer rim, or correct its direction.</p><canvas width="768" height="768" aria-label="Coin crop preview"></canvas><label>Crop zoom <input class="photoZoom" type="range" min="0.25" max="8" step="0.01" value="1"></label><label>Rotation <input class="photoAngle" type="range" min="-180" max="180" step="1" value="0"><output>0°</output></label><div class="photoEditorActions"><button type="button" class="rotateLeft">↶ 90°</button><button type="button" class="rotateRight">↷ 90°</button><button type="button" class="resetPhotoEdit">Start from original</button></div><p class="photoEditStatus" role="status"></p><div class="photoEditorActions"><button type="button" class="cancelPhotoEdit">Cancel</button><button type="button" class="applyPhotoEdit">Use cropped photo</button></div></form>';
        document.body.append(dialog);
        if(options.title)dialog.querySelector('h3').textContent=options.title;
        if(options.description)dialog.querySelector('p').textContent=options.description;
        const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),zoom=dialog.querySelector('.photoZoom'),angle=dialog.querySelector('.photoAngle');
        let x=0,y=0,drag=null,done=false;
        function draw(target=ctx,guide=true){
          const t=transform(bitmap.width,bitmap.height,Number(zoom.value),Number(angle.value),x,y);
          target.clearRect(0,0,768,768);target.save();target.beginPath();target.arc(384,384,368,0,Math.PI*2);target.clip();
          target.translate(t.x,t.y);target.rotate(t.angle);target.scale(t.scale,t.scale);target.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);target.restore();
          if(guide){target.save();target.strokeStyle='#ffc65b';target.lineWidth=3;target.beginPath();target.arc(384,384,368,0,Math.PI*2);target.stroke();target.restore();}
          dialog.querySelector('output').textContent=`${angle.value}°`;
        }
        function finish(value){if(done)return;done=true;dialog.close();dialog.remove();resolve(value);}
        dialog.oncancel=event=>{event.preventDefault();finish(null);};dialog.onclose=()=>finish(null);
        dialog.querySelector('.cancelPhotoEdit').onclick=()=>finish(null);
        zoom.oninput=angle.oninput=()=>draw();
        function turn(delta){const next=((Number(angle.value)+delta+180)%360+360)%360-180;angle.value=next;draw();}
        dialog.querySelector('.rotateLeft').onclick=()=>turn(-90);dialog.querySelector('.rotateRight').onclick=()=>turn(90);
        dialog.querySelector('.resetPhotoEdit').onclick=()=>{if(bitmap!==originalBitmap)bitmap.close?.();bitmap=originalBitmap;x=y=0;zoom.value=1;angle.value=0;draw();};
        dialog.querySelector('.photoEditStatus').textContent=options.status||(suggestion?.manual?'Current photo retained. Adjust the crop or direction below.':suggestion?.uncertain?'Direction unclear · kept its current direction. You can correct it below.':suggestion?'Automatic suggestion ready. Check the outer rim and direction.':'');
        canvas.onpointerdown=event=>{drag={clientX:event.clientX,clientY:event.clientY,x,y};canvas.setPointerCapture(event.pointerId);};
        canvas.onpointermove=event=>{if(!drag)return;const rect=canvas.getBoundingClientRect();x=drag.x+(event.clientX-drag.clientX)/rect.width;y=drag.y+(event.clientY-drag.clientY)/rect.height;draw();};
        canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
        dialog.querySelector('.applyPhotoEdit').onclick=async()=>{
          const button=dialog.querySelector('.applyPhotoEdit');button.disabled=true;
          try{const output=document.createElement('canvas');output.width=output.height=768;draw(output.getContext('2d'),false);
            const blob=await canvasBlob(output,'image/png');output.width=output.height=0;
            const adjusted=new File([blob],'coin-cropped.png',{type:'image/png',lastModified:Date.now()});window.AutoCoinPhoto?.markManual(adjusted,file);finish(adjusted);
          }catch(error){dialog.querySelector('.photoEditStatus').textContent=`Could not prepare photo: ${error.message}`;button.disabled=false;}
        };
        dialog.showModal();draw();
      });
    }finally{bitmap?.close?.();if(originalBitmap!==bitmap)originalBitmap?.close?.();dialog?.remove();active=false;}
  }
  function updateSingle(){for(const side of ['obverse','reverse']){const button=document.getElementById(`editCoinPhoto-${side}`);if(button)button.hidden=!identifyState[side]?.file;}}
  function setupSingle(){
    for(const side of ['obverse','reverse']){
      const card=document.getElementById(`${side}Capture`);if(!card||document.getElementById(`editCoinPhoto-${side}`))continue;
      const button=document.createElement('button');button.id=`editCoinPhoto-${side}`;button.type='button';button.className='editCoinPhoto';button.textContent='Crop / rotate photo';button.hidden=true;
      button.onclick=async()=>{const original=identifyState[side];if(!original)return;button.disabled=true;button.textContent='Preparing automatic suggestion…';
        try{const adjusted=await edit(original.specimenFile||original.file);if(adjusted&&identifyState[side]===original){
          original.specimenFile=adjusted;URL.revokeObjectURL(original.url);original.url=URL.createObjectURL(adjusted);document.querySelector(`#${side}Capture .capturePreview`).style.backgroundImage=`url("${original.url}")`;
          setAnalyseStatus('Saved photo adjusted. Identification continues to use your captured photo.');
        }}
        catch(error){setAnalyseStatus(`Could not edit photo: ${error.message}`,true);}finally{button.disabled=false;button.textContent='Crop / rotate saved photo';}
      };
      card.append(button);
    }updateSingle();
  }
  window.CoinPhotoEditor={edit,setupSingle,updateSingle,transform};
})();
