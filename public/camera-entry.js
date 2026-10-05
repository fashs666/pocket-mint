/* Guided capture on both platforms; native capture remains an explicit option.
 * Analysis and matching stay untouched. */
const guidedCoinCamera=openCoinCamera;
const originalLoadIdentifyPhoto=loadIdentifyPhoto;
const originalClearIdentifyPhoto=clearIdentifyPhoto;
function androidCoinCamera(){return /Android/i.test(navigator.userAgent);}
openCoinCamera=async function openPreferredCoinCamera(side){
  return guidedCoinCamera(side);
};
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
