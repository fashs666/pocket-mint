/* Guided capture on both platforms; native capture remains an explicit option.
 * Analysis and matching stay untouched. */
const guidedCoinCamera=openCoinCamera;
const originalLoadIdentifyPhoto=loadIdentifyPhoto;
const originalClearIdentifyPhoto=clearIdentifyPhoto;
const originalCameraControls=typeof setupCoinCameraControls==='function'?setupCoinCameraControls:null;
const originalCameraFocus=typeof setCoinCameraFocus==='function'?setCoinCameraFocus:null;
let androidCameraOpening=0;
function cameraOperation(promise,ms=1800){
  let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Camera operation timed out')),ms);})]).finally(()=>clearTimeout(timer));
}
function androidCameraCapabilities(track){try{return track?.getCapabilities?.()||{};}catch{return {};}}
function androidCameraSettings(track){try{return track?.getSettings?.()||{};}catch{return {};}}
function setupAndroidCameraPresentation(){
  const camera=document.getElementById('coinCamera');
  if(document.getElementById('coinCameraOptions'))return;
  const options=document.createElement('button');options.id='coinCameraOptions';options.type='button';options.textContent='Options';options.setAttribute('aria-expanded','false');options.setAttribute('aria-controls','coinCameraSettings');
  document.querySelector('#coinCamera .cameraTop').append(options);
  const panel=document.createElement('section');panel.id='coinCameraSettings';panel.className='cameraSettings';panel.hidden=true;panel.setAttribute('aria-label','Camera options');
  const heading=document.createElement('strong');heading.textContent='Camera options';panel.append(heading);
  const selectLabel=document.createElement('label');selectLabel.id='coinCameraDeviceRow';selectLabel.hidden=true;selectLabel.textContent='Camera';
  const select=document.createElement('select');select.id='coinCameraDevice';select.setAttribute('aria-label','Camera lens');selectLabel.append(select);panel.append(selectLabel);
  panel.append(document.getElementById('coinCameraZoomRow'),document.getElementById('coinCameraFocusRow'));
  const auto=document.createElement('button');auto.id='coinCameraAutofocus';auto.type='button';auto.className='cameraChoose';auto.textContent='Automatic focus';panel.append(auto);
  panel.append(document.getElementById('coinCameraChoose'));
  const hint=document.createElement('p');hint.textContent='Move back if the lettering is soft. Zoom in rather than holding the phone very close.';panel.append(hint);
  camera.append(panel);
  const ring=document.createElement('span');ring.id='coinCameraFocusPoint';ring.className='cameraFocusPoint';ring.hidden=true;ring.setAttribute('aria-hidden','true');camera.append(ring);
  options.onclick=()=>{panel.hidden=!panel.hidden;options.setAttribute('aria-expanded',String(!panel.hidden));};
  document.getElementById('coinCameraNative').textContent='Phone camera';
}
function closeAndroidCameraOptions(){
  const panel=document.getElementById('coinCameraSettings');if(panel)panel.hidden=true;
  document.getElementById('coinCameraOptions')?.setAttribute('aria-expanded','false');
}
async function listAndroidCameraDevices(track){
  try{
    const devices=await navigator.mediaDevices.enumerateDevices();if(coinCameraTrack!==track)return;
    const cameras=devices.filter(d=>d.kind==='videoinput');const select=document.getElementById('coinCameraDevice');select.replaceChildren();
    cameras.forEach((device,index)=>{const option=document.createElement('option');option.value=device.deviceId;option.textContent=device.label||`Camera ${index+1}`;select.append(option);});
    select.value=androidCameraSettings(track).deviceId||cameras[0]?.deviceId||'';
    document.getElementById('coinCameraDeviceRow').hidden=cameras.length<2;
    select.onchange=()=>openCoinCamera(coinCameraSide,select.value);
  }catch{document.getElementById('coinCameraDeviceRow').hidden=true;}
}
function layoutAndroidCoinGuide(){
  const video=document.getElementById('coinCameraVideo'),guide=document.getElementById('coinCameraGuide'),camera=document.getElementById('coinCamera');
  const shade=document.querySelector('#coinCamera .cameraShade'),top=document.querySelector('#coinCamera .cameraTop'),bottom=document.querySelector('#coinCamera .cameraBottom');
  if(!shade||!top||!bottom||!video||!guide)return {x:.5,y:.5};
  const r=video.getBoundingClientRect(),start=Math.max(r.top+12,top.getBoundingClientRect().bottom+12),end=Math.min(r.bottom-12,bottom.getBoundingClientRect().top-12);
  shade.style.top=`${start-r.top}px`;shade.style.bottom=`${r.bottom-end}px`;
  camera.style.setProperty('--coin-guide-size',`${Math.max(80,Math.min(r.width*.76,end-start,380))}px`);
  const g=guide.getBoundingClientRect();return coinCameraSensorPoint(video,g.left+g.width/2,g.top+g.height/2);
}
function coinCameraSensorPoint(video,clientX,clientY){
  if(!video.videoWidth||!video.videoHeight)return {x:.5,y:.5};
  const r=video.getBoundingClientRect(),scale=Math.max(r.width/video.videoWidth,r.height/video.videoHeight);
  const width=video.videoWidth*scale,height=video.videoHeight*scale;
  return {x:Math.max(0,Math.min(1,(clientX-r.left+(width-r.width)/2)/width)),y:Math.max(0,Math.min(1,(clientY-r.top+(height-r.height)/2)/height))};
}
async function applyAndroidFocus(track,values,isCurrent=()=>coinCameraTrack===track){
  // Chrome's image-capture constraints may require an advanced set.
  const constraints=[{advanced:[values]},Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{exact:v}]))];
  let error;
  for(const constraint of constraints){
    if(!isCurrent())throw Error('Focus request is no longer current');
    try{
      await cameraOperation(track.applyConstraints(constraint));const settings=androidCameraSettings(track);
      if(settings.focusMode&&settings.focusMode!==values.focusMode)throw Error('Focus mode was not applied');
      if(values.pointsOfInterest&&!values.pointsOfInterest.every(point=>settings.pointsOfInterest?.some(actual=>Math.abs(actual.x-point.x)<.025&&Math.abs(actual.y-point.y)<.025)))throw Error('Focus point was not reported by the camera');
      if(values.focusDistance!==undefined&&(!Number.isFinite(settings.focusDistance)||Math.abs(settings.focusDistance-values.focusDistance)>(track.getCapabilities().focusDistance.step||.01)*1.5))throw Error('Focus distance was not applied');
      return settings;
    }catch(e){if(!isCurrent())throw e;error=e;}
  }
  throw error;
}
async function refocusAndroidCoin(point={x:.5,y:.5},automatic=false,isLatest=()=>true){
  const track=coinCameraTrack,cap=androidCameraCapabilities(track),modes=cap.focusMode||[];
  const mode=automatic&&modes.includes('continuous')?'continuous':modes.includes('single-shot')?'single-shot':modes.includes('continuous')?'continuous':null;
  const status=document.getElementById('coinCameraStatus');
  if(!track)return false;
  if(!mode){if(!automatic)status.textContent='Tap focus unavailable here. Use Phone camera.';return false;}
  const current=()=>coinCameraTrack===track&&isLatest();
  if(current()&&!automatic)status.textContent='Requesting focus… Hold still.';
  try{
    let values={focusMode:mode},pointAccepted=false;
    if(navigator.mediaDevices?.getSupportedConstraints?.().pointsOfInterest){
      try{await applyAndroidFocus(track,{...values,pointsOfInterest:[point]},current);pointAccepted=true;}
      catch{try{await applyAndroidFocus(track,values,current);}catch(error){if(!current()||mode!=='single-shot'||!modes.includes('continuous'))throw error;await applyAndroidFocus(track,{focusMode:'continuous'},current);}}
    }else {try{await applyAndroidFocus(track,values,current);}catch(error){if(!current()||mode!=='single-shot'||!modes.includes('continuous'))throw error;await applyAndroidFocus(track,{focusMode:'continuous'},current);}}
    if(!current())return false;
    // Keep the requested point/mode. Switching modes immediately can interrupt a sweep.
    const settings=androidCameraSettings(track);
    coinCameraDiagnostics.focus_mode=settings.focusMode||'unreported';coinCameraDiagnostics.focus_error=null;
    coinCameraDiagnostics.focus_point_requested=pointAccepted?point:null;
    coinCameraDiagnostics.focus_point_reported=settings.pointsOfInterest||null;
    coinCameraDiagnostics.tap_focus_verified=pointAccepted;
    status.textContent=automatic?'Keep the full rim inside the circle.':pointAccepted?'Focus requested. Check the lettering.':'Camera refocus requested; tap position unsupported. Use Phone camera if soft.';
    return true;
  }catch{
    if(current()){coinCameraDiagnostics.focus_error='autofocus_not_applied';status.textContent='Focus control unavailable. Use Phone camera if soft.';}
    return false;
  }
}
if(originalCameraControls){
  setupCoinCameraControls=async function setupAndroidCoinControls(){
    if(!androidCoinCamera())return originalCameraControls();
    if(!coinCameraTrack)return;
    const track=coinCameraTrack,video=document.getElementById('coinCameraVideo'),cap=androidCameraCapabilities(track),settings=androidCameraSettings(track),modes=cap.focusMode||[];
    coinCameraDiagnostics={focus_modes:[...modes],focus_mode:settings.focusMode||'unreported',manual_focus_available:Boolean(modes.includes('manual')&&cap.focusDistance),focus_error:null};
    const focusRow=document.getElementById('coinCameraFocusRow'),focus=document.getElementById('coinCameraFocus');focusRow.hidden=!coinCameraDiagnostics.manual_focus_available;
    if(!focusRow.hidden){Object.assign(focus,{min:cap.focusDistance.min,max:cap.focusDistance.max,step:cap.focusDistance.step||.01,value:settings.focusDistance??cap.focusDistance.min});}
    const zoomRow=document.getElementById('coinCameraZoomRow'),zoom=document.getElementById('coinCameraZoom');zoomRow.hidden=!cap.zoom;
    if(cap.zoom){Object.assign(zoom,{min:cap.zoom.min,max:cap.zoom.max,step:cap.zoom.step||.1,value:settings.zoom??cap.zoom.min});coinCameraZoomValue=Number(zoom.value);document.getElementById('coinCameraZoomValue').value=`${coinCameraZoomValue.toFixed(1)}×`;zoom.oninput=()=>setCoinCameraZoom(zoom.value);}
    const autofocus=modes.includes('continuous')||modes.includes('single-shot');
    let button=document.getElementById('coinCameraAutofocus');
    if(!button)return;
    button.hidden=!autofocus;
    let focusRevision=0;
    const request=(point,automatic=false)=>{const revision=++focusRevision;coinCameraFocusQueue=coinCameraFocusQueue.catch(()=>{}).then(()=>revision===focusRevision&&coinCameraTrack===track?cameraOperation(refocusAndroidCoin(point,automatic,()=>revision===focusRevision),2400).catch(()=>{if(revision===focusRevision){focusRevision++;if(coinCameraTrack===track)document.getElementById('coinCameraStatus').textContent='Focus request timed out. Use Phone camera if soft.';}return false;}):false);return coinCameraFocusQueue;};
    button.onclick=()=>request(layoutAndroidCoinGuide(),true);
    focus.oninput=()=>{const revision=++focusRevision,value=focus.value;coinCameraFocusQueue=coinCameraFocusQueue.catch(()=>{}).then(()=>revision===focusRevision&&coinCameraTrack===track?setCoinCameraFocus(value):undefined);};
    let pointer=null;
    video.onpointerdown=event=>{pointer=event.isPrimary?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;};
    video.onpointercancel=()=>pointer=null;
    video.onpointerup=event=>{
      const start=pointer;pointer=null;
      if(start?.id===event.pointerId&&Math.hypot(start.x-event.clientX,start.y-event.clientY)<12){
        closeAndroidCameraOptions();
        const ring=document.getElementById('coinCameraFocusPoint');if(ring){const r=video.getBoundingClientRect();ring.style.left=`${event.clientX-r.left}px`;ring.style.top=`${event.clientY-r.top}px`;ring.hidden=false;setTimeout(()=>{if(coinCameraTrack===track)ring.hidden=true;},900);}
        request(coinCameraSensorPoint(video,event.clientX,event.clientY));
      }
    };
    video.ontouchstart=event=>{if(event.touches.length===2){pointer=null;event.preventDefault();coinCameraPinchStart=cameraTouchDistance(event.touches);coinCameraPinchZoom=coinCameraZoomValue;}};
    video.ontouchmove=event=>{if(cap.zoom&&event.touches.length===2&&coinCameraPinchStart){event.preventDefault();setCoinCameraZoom(coinCameraPinchZoom*cameraTouchDistance(event.touches)/coinCameraPinchStart);}};
    video.ontouchend=()=>coinCameraPinchStart=0;
    request(layoutAndroidCoinGuide(),true);
    listAndroidCameraDevices(track);
  };
}
if(originalCameraFocus){
  setCoinCameraFocus=async function setAndroidManualFocus(value){
    if(!androidCoinCamera())return originalCameraFocus(value);
    const track=coinCameraTrack,distance=androidCameraCapabilities(track).focusDistance;if(!distance)return;
    const next=Math.max(distance.min,Math.min(distance.max,Number(value)));if(!Number.isFinite(next))return;
    try{
      const settings=await applyAndroidFocus(track,{focusMode:'manual',focusDistance:next});if(track!==coinCameraTrack)return;
      coinCameraDiagnostics.focus_mode=settings.focusMode||'unreported';coinCameraDiagnostics.focus_distance=settings.focusDistance;coinCameraDiagnostics.focus_error=null;
      document.getElementById('coinCameraStatus').textContent='Manual focus. Check the lettering.';
    }catch{if(track!==coinCameraTrack)return;coinCameraDiagnostics.focus_error='manual_focus_not_applied';document.getElementById('coinCameraFocusRow').hidden=true;document.getElementById('coinCameraStatus').textContent='Manual focus unavailable. Use Phone camera.';}
  };
}
function androidCoinCamera(){return /Android/i.test(navigator.userAgent);}
openCoinCamera=async function openPreferredCoinCamera(side,deviceId=null){
  if(!androidCoinCamera())return guidedCoinCamera(side);
  const opening=++androidCameraOpening;
  closeCoinCamera();coinCameraSide=side;
  setupAndroidCameraPresentation();closeAndroidCameraOptions();document.getElementById('coinCameraFocusPoint').hidden=true;
  const camera=document.getElementById('coinCamera'),video=document.getElementById('coinCameraVideo'),status=document.getElementById('coinCameraStatus');
  camera.classList.remove('fallback','ready');camera.classList.add('androidGuided');camera.hidden=false;
  document.body.classList.add('cameraOpen');document.getElementById('coinCameraTitle').textContent=side==='obverse'?'Portrait side':'Design side';
  document.getElementById('coinCameraFocusRow').hidden=true;document.getElementById('coinCameraZoomRow').hidden=true;
  document.getElementById('coinCameraShutter').disabled=true;status.textContent='Opening camera…';
  coinCameraFocusQueue=Promise.resolve();layoutAndroidCoinGuide();
  let stream;
  try{
    try{stream=await navigator.mediaDevices.getUserMedia({video:{...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}}),width:{ideal:1920},height:{ideal:1080}},audio:false});}
    catch(error){if(!['OverconstrainedError','NotFoundError'].includes(error.name))throw error;stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});}
    if(camera.hidden||opening!==androidCameraOpening){stream.getTracks().forEach(t=>t.stop());return;}
    coinCameraStream=stream;coinCameraTrack=stream.getVideoTracks()[0];video.srcObject=stream;
    await cameraOperation(new Promise((resolve,reject)=>{
      if(video.readyState>=1&&video.videoWidth){resolve();return;}
      video.onloadedmetadata=resolve;video.onerror=reject;
    }),8000);
    if(camera.hidden||coinCameraStream!==stream)return;
    await cameraOperation(video.play(),4000);
    camera.classList.add('ready');document.getElementById('coinCameraShutter').disabled=false;
    status.textContent='Keep the full rim inside the circle.';
    layoutAndroidCoinGuide();
    // The preview is usable before capability discovery or autofocus completes.
    setupCoinCameraControls().then(()=>{if(coinCameraStream===stream)layoutAndroidCoinGuide();}).catch(()=>{});
  }catch(error){
    if(camera.hidden||stream&&coinCameraStream!==stream)return;
    stream?.getTracks().forEach(t=>t.stop());coinCameraStream=null;coinCameraTrack=null;video.srcObject=null;
    camera.classList.add('fallback');
    status.textContent=error.name==='NotAllowedError'?'Allow camera access in your browser settings, or use the phone camera below.':'The live camera could not open. Use the phone camera below.';
  }
};
if(typeof window!=='undefined')window.addEventListener('resize',()=>{if(androidCoinCamera()&&typeof coinCameraTrack!=='undefined'&&coinCameraTrack)layoutAndroidCoinGuide();});
function setupCameraEntry(){
  const optional=document.getElementById('identifyBrowserCamera');
  optional.hidden=true;
  optional.onclick=()=>guidedCoinCamera('reverse');
  window.CoinPhotoEditor?.setupSingle();
  if(!androidCoinCamera())return;
  optional.hidden=false;optional.textContent='Use Pocket Mint live guide';optional.onclick=()=>openCoinCamera('reverse');
  document.querySelectorAll('[data-camera-side]').forEach(button=>{button.onclick=()=>openNativeCoinCamera(button.dataset.cameraSide);button.querySelector('small').textContent='Phone camera · crop afterward';});
  for(const side of ['obverse','reverse'])document.getElementById(side==='obverse'?'identifyObverseCamera':'identifyReverseCamera').onchange=event=>readAndroidCameraPhoto(event.target,side);
  document.querySelector('.identifyIntro').textContent='Use your phone camera to focus on the coin, then centre it in Pocket Mint’s circular crop guide. The portrait side is optional.';
}
async function readAndroidCameraPhoto(input,side){
  const file=input.files?.[0];if(!file)return;
  let loaded=false;
  try{
    await loadIdentifyPhoto(side,file);loaded=true;const original=identifyState[side];
    const adjusted=await window.CoinPhotoEditor?.edit(file,{suggest:false,title:'Crop your coin',description:'Drag to centre the coin. Zoom until the full rim fits inside the circle.',status:'Your captured photo is kept. This crop adjusts the saved collection photo.'});
    if(adjusted&&identifyState[side]===original){
      original.specimenFile=adjusted;URL.revokeObjectURL(original.url);original.url=URL.createObjectURL(adjusted);
      document.querySelector(`#${side}Capture .capturePreview`).style.backgroundImage=`url("${original.url}")`;
      setAnalyseStatus('Coin photo cropped. Ready to identify.');
    }
  }catch{setAnalyseStatus(loaded?'Could not prepare the crop. Your photo is kept; use Crop / rotate photo to try again.':'That photo could not be loaded. Please take it again.',true);}
  finally{input.value='';}
}
loadIdentifyPhoto=async function loadPreferredCameraPhoto(...args){
  const result=await originalLoadIdentifyPhoto(...args);
  window.CoinPhotoEditor?.updateSingle();
  if(androidCoinCamera())document.querySelector(`#${args[0]}Capture .capturePreview small`).textContent='Tap to retake with phone camera';
  return result;
};
clearIdentifyPhoto=function clearPreferredCameraPhoto(...args){
  const result=originalClearIdentifyPhoto(...args);
  window.CoinPhotoEditor?.updateSingle();
  return result;
};
