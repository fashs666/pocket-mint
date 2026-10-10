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
async function applyAndroidFocus(track,values){
  // Chrome's image-capture constraints may require an advanced set.
  const constraints=[{advanced:[values]},Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{exact:v}]))];
  let error;
  for(const constraint of constraints){
    try{
      await cameraOperation(track.applyConstraints(constraint));const settings=track.getSettings?.()||{};
      if(settings.focusMode&&settings.focusMode!==values.focusMode)throw Error('Focus mode was not applied');
      if(values.focusDistance!==undefined&&(!Number.isFinite(settings.focusDistance)||Math.abs(settings.focusDistance-values.focusDistance)>(track.getCapabilities().focusDistance.step||.01)*1.5))throw Error('Focus distance was not applied');
      return settings;
    }catch(e){error=e;}
  }
  throw error;
}
async function refocusAndroidCoin(point={x:.5,y:.5}){
  const track=coinCameraTrack,cap=androidCameraCapabilities(track),modes=cap.focusMode||[];
  const mode=modes.includes('single-shot')?'single-shot':modes.includes('continuous')?'continuous':null;
  if(!track||!mode)return false;
  const current=()=>coinCameraTrack===track;
  const status=document.getElementById('coinCameraStatus');
  if(current())status.textContent='Refocusing on the coin… Hold still and check the small lettering.';
  try{
    let values={focusMode:mode},pointAccepted=false;
    if(navigator.mediaDevices?.getSupportedConstraints?.().pointsOfInterest){
      try{await applyAndroidFocus(track,{...values,pointsOfInterest:[point]});pointAccepted=true;}
      catch{try{await applyAndroidFocus(track,values);}catch(error){if(mode!=='single-shot'||!modes.includes('continuous'))throw error;await applyAndroidFocus(track,{focusMode:'continuous'});}}
    }else {try{await applyAndroidFocus(track,values);}catch(error){if(mode!=='single-shot'||!modes.includes('continuous'))throw error;await applyAndroidFocus(track,{focusMode:'continuous'});}}
    if(!current())return false;
    await new Promise(resolve=>setTimeout(resolve,450));
    if(!current())return false;
    if(mode==='single-shot'&&modes.includes('continuous'))await applyAndroidFocus(track,{focusMode:'continuous'});
    if(!current())return false;
    const settings=track.getSettings?.()||{};
    coinCameraDiagnostics.focus_mode=settings.focusMode||'unreported';coinCameraDiagnostics.focus_error=null;
    coinCameraDiagnostics.focus_point_requested=pointAccepted?point:null;
    coinCameraDiagnostics.focus_point_reported=settings.pointsOfInterest||null;
    status.textContent='Autofocus requested. Keep the full rim in the circle; tap the coin to refocus. Check the small lettering before taking the photo.';
    return true;
  }catch{
    if(current()){coinCameraDiagnostics.focus_error='autofocus_not_applied';status.textContent='Autofocus could not be controlled. Adjust Focus if available, move farther away and use Zoom, or use the phone camera.';}
    return false;
  }
}
if(originalCameraControls){
  setupCoinCameraControls=async function setupAndroidCoinControls(){
    if(!androidCoinCamera())return originalCameraControls();
    const openingStream=coinCameraStream;
    // Optional hardware controls must never block the live view or shutter.
    try{await cameraOperation(originalCameraControls());}catch{
      if(coinCameraStream!==openingStream)return;
      document.getElementById('coinCameraFocusRow').hidden=true;
      document.getElementById('coinCameraZoomRow').hidden=true;
      coinCameraDiagnostics={focus_modes:[],focus_mode:'unreported',manual_focus_available:false,focus_error:'controls_unavailable'};
    }
    if(!coinCameraTrack||coinCameraStream!==openingStream)return;
    const track=coinCameraTrack,video=document.getElementById('coinCameraVideo'),modes=androidCameraCapabilities(track).focusMode||[];
    const autofocus=modes.includes('continuous')||modes.includes('single-shot');
    let button=document.getElementById('coinCameraAutofocus');
    if(!button){button=document.createElement('button');button.id='coinCameraAutofocus';button.type='button';button.className='cameraChoose';button.textContent='Autofocus';button.style.minHeight='44px';document.querySelector('.cameraAlternatives').prepend(button);}
    button.hidden=!autofocus;
    const request=point=>{coinCameraFocusQueue=coinCameraFocusQueue.catch(()=>{}).then(()=>coinCameraTrack===track?cameraOperation(refocusAndroidCoin(point),2400).catch(()=>false):false);return coinCameraFocusQueue;};
    button.onclick=()=>request(layoutAndroidCoinGuide());
    const focus=document.getElementById('coinCameraFocus');let focusRevision=0;
    focus.oninput=()=>{const revision=++focusRevision,value=focus.value;coinCameraFocusQueue=coinCameraFocusQueue.catch(()=>{}).then(()=>revision===focusRevision&&coinCameraTrack===track?setCoinCameraFocus(value):undefined);};
    let pointer=null;
    video.onpointerdown=event=>{pointer=event.isPrimary?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;};
    video.onpointercancel=()=>pointer=null;
    video.onpointerup=event=>{
      const start=pointer;pointer=null;
      if(autofocus&&start?.id===event.pointerId&&Math.hypot(start.x-event.clientX,start.y-event.clientY)<12)request(coinCameraSensorPoint(video,event.clientX,event.clientY));
    };
    request(layoutAndroidCoinGuide());
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
      document.getElementById('coinCameraStatus').textContent='Manual focus. Adjust until small lettering is sharp; tap Autofocus to return to automatic focus.';
    }catch{if(track!==coinCameraTrack)return;coinCameraDiagnostics.focus_error='manual_focus_not_applied';document.getElementById('coinCameraFocusRow').hidden=true;document.getElementById('coinCameraStatus').textContent='Manual focus was not applied. Tap Autofocus or use the phone camera.';}
  };
}
function androidCoinCamera(){return /Android/i.test(navigator.userAgent);}
openCoinCamera=async function openPreferredCoinCamera(side){
  if(!androidCoinCamera())return guidedCoinCamera(side);
  const opening=++androidCameraOpening;
  closeCoinCamera();coinCameraSide=side;
  const camera=document.getElementById('coinCamera'),video=document.getElementById('coinCameraVideo'),status=document.getElementById('coinCameraStatus');
  camera.classList.remove('fallback','ready');camera.classList.add('androidGuided');camera.hidden=false;
  document.body.classList.add('cameraOpen');document.getElementById('coinCameraTitle').textContent=side==='obverse'?'Portrait side':'Design side';
  document.getElementById('coinCameraFocusRow').hidden=true;document.getElementById('coinCameraZoomRow').hidden=true;
  document.getElementById('coinCameraShutter').disabled=true;status.textContent='Opening camera…';
  coinCameraFocusQueue=Promise.resolve();layoutAndroidCoinGuide();
  let stream;
  try{
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});}
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
    status.textContent='Keep the full rim in the circle. Check the lettering before taking the photo.';
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
  document.querySelectorAll('[data-camera-side] small').forEach(item=>item.textContent='Guided circle · centre the coin');
  document.querySelector('.identifyIntro').textContent='Centre the coin inside the guide and keep the phone straight above it. If focus stays soft, use the phone camera instead, then adjust its crop. The portrait side is optional.';
}
loadIdentifyPhoto=async function loadPreferredCameraPhoto(...args){
  const result=await originalLoadIdentifyPhoto(...args);
  window.CoinPhotoEditor?.updateSingle();
  return result;
};
clearIdentifyPhoto=function clearPreferredCameraPhoto(...args){
  const result=originalClearIdentifyPhoto(...args);
  window.CoinPhotoEditor?.updateSingle();
  return result;
};
