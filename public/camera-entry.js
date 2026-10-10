/* Guided capture on both platforms; native capture remains an explicit option.
 * Analysis and matching stay untouched. */
const guidedCoinCamera=openCoinCamera;
const originalLoadIdentifyPhoto=loadIdentifyPhoto;
const originalClearIdentifyPhoto=clearIdentifyPhoto;
const originalCameraControls=typeof setupCoinCameraControls==='function'?setupCoinCameraControls:null;
const originalCameraFocus=typeof setCoinCameraFocus==='function'?setCoinCameraFocus:null;
function layoutAndroidCoinGuide(){
  const video=document.getElementById('coinCameraVideo'),guide=document.getElementById('coinCameraGuide'),camera=document.getElementById('coinCamera');
  const shade=document.querySelector('#coinCamera .cameraShade'),top=document.querySelector('#coinCamera .cameraTop'),bottom=document.querySelector('#coinCamera .cameraBottom');
  if(!shade||!top||!bottom)return {x:.5,y:.5};
  const r=video.getBoundingClientRect(),start=Math.max(r.top+12,top.getBoundingClientRect().bottom+12),end=Math.min(r.bottom-12,bottom.getBoundingClientRect().top-12);
  shade.style.top=`${start-r.top}px`;shade.style.bottom=`${r.bottom-end}px`;
  camera.style.setProperty('--coin-guide-size',`${Math.max(80,Math.min(r.width*.76,end-start,380))}px`);
  const g=guide.getBoundingClientRect();return coinCameraSensorPoint(video,g.left+g.width/2,g.top+g.height/2);
}
function coinCameraSensorPoint(video,clientX,clientY){
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
      await track.applyConstraints(constraint);const settings=track.getSettings?.()||{};
      if(settings.focusMode&&settings.focusMode!==values.focusMode)throw Error('Focus mode was not applied');
      if(values.focusDistance!==undefined&&(!Number.isFinite(settings.focusDistance)||Math.abs(settings.focusDistance-values.focusDistance)>(track.getCapabilities().focusDistance.step||.01)*1.5))throw Error('Focus distance was not applied');
      return settings;
    }catch(e){error=e;}
  }
  throw error;
}
async function refocusAndroidCoin(point={x:.5,y:.5}){
  const track=coinCameraTrack,cap=track?.getCapabilities?.()||{},modes=cap.focusMode||[];
  const mode=modes.includes('single-shot')?'single-shot':modes.includes('continuous')?'continuous':null;
  if(!track||!mode)return false;
  const current=()=>coinCameraTrack===track;
  const status=document.getElementById('coinCameraStatus');
  if(current())status.textContent='Refocusing on the coin… Hold still and check the small lettering.';
  try{
    let values={focusMode:mode},pointAccepted=false;
    if(navigator.mediaDevices?.getSupportedConstraints?.().pointsOfInterest){
      try{await applyAndroidFocus(track,{...values,pointsOfInterest:[point]});pointAccepted=true;}
      catch{await applyAndroidFocus(track,values);}
    }else await applyAndroidFocus(track,values);
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
    await originalCameraControls();if(!androidCoinCamera()||!coinCameraTrack)return;
    const track=coinCameraTrack,video=document.getElementById('coinCameraVideo'),modes=track.getCapabilities?.().focusMode||[];
    const autofocus=modes.includes('continuous')||modes.includes('single-shot');
    let button=document.getElementById('coinCameraAutofocus');
    if(!button){button=document.createElement('button');button.id='coinCameraAutofocus';button.type='button';button.className='cameraChoose';button.textContent='Autofocus';button.style.minHeight='44px';document.querySelector('.cameraAlternatives').prepend(button);}
    button.hidden=!autofocus;
    const request=point=>{coinCameraFocusQueue=coinCameraFocusQueue.catch(()=>{}).then(()=>coinCameraTrack===track?refocusAndroidCoin(point):false);return coinCameraFocusQueue;};
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
    await request(layoutAndroidCoinGuide());
  };
}
if(originalCameraFocus){
  setCoinCameraFocus=async function setAndroidManualFocus(value){
    if(!androidCoinCamera())return originalCameraFocus(value);
    const track=coinCameraTrack,distance=track?.getCapabilities?.().focusDistance;if(!distance)return;
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
  if(androidCoinCamera()&&typeof document!=='undefined')document.getElementById('coinCamera')?.classList.add('androidGuided');
  const result=await guidedCoinCamera(side);
  if(androidCoinCamera()&&typeof coinCameraTrack!=='undefined'&&coinCameraTrack){
    const autofocus=coinCameraDiagnostics.focus_modes.some(mode=>['continuous','single-shot'].includes(mode));
    document.getElementById('coinCameraStatus').textContent=coinCameraDiagnostics.focus_error||!autofocus?'The browser controls focus on this camera. Check the lettering; move farther away and use Zoom, or use the phone camera if it stays soft.':'Keep the rim inside the circle. Tap the coin to refocus, or use Focus and Zoom below.';
  }
  return result;
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
