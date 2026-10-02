/* Camera-only Android entry fix. Analysis, guided-camera implementation and
 * matching stay untouched. Native capture exposes the phone's own autofocus. */
const guidedCoinCamera=openCoinCamera;
const originalLoadIdentifyPhoto=loadIdentifyPhoto;
const originalClearIdentifyPhoto=clearIdentifyPhoto;
function androidCoinCamera(){return /Android/i.test(navigator.userAgent);}
openCoinCamera=async function openPreferredCoinCamera(side){
  if(androidCoinCamera())return openNativeCoinCamera(side);
  return guidedCoinCamera(side);
};
function setupCameraEntry(){
  const optional=document.getElementById('identifyBrowserCamera');
  optional.hidden=!androidCoinCamera();
  optional.onclick=()=>guidedCoinCamera('reverse');
  if(!androidCoinCamera())return;
  document.querySelectorAll('[data-camera-side] small').forEach(item=>item.textContent='Phone camera · tap the coin to focus');
  document.querySelector('.identifyIntro').textContent='Start with the design side. Android opens your phone camera so you can tap the coin to focus. Move back if the lettering stays soft, then zoom and hold still. The portrait side is optional.';
}
loadIdentifyPhoto=async function loadPreferredCameraPhoto(...args){
  const result=await originalLoadIdentifyPhoto(...args);
  if(androidCoinCamera())document.querySelectorAll('[data-camera-side] small').forEach(item=>item.textContent='Tap to retake with phone camera');
  return result;
};
clearIdentifyPhoto=function clearPreferredCameraPhoto(...args){
  const result=originalClearIdentifyPhoto(...args);
  if(androidCoinCamera())document.querySelectorAll('[data-camera-side] small').forEach(item=>item.textContent='Phone camera · tap the coin to focus');
  return result;
};
