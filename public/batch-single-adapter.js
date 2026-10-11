/* Supplies an isolated photo to the unchanged single-coin preparation/endpoint.
   Never touches identifyState, the single camera, ranking or recognition prompts. */
(() => {
 async function photo(input){
  const blob=typeof input==='string'?await (await fetch(input)).blob():input;
  return makeAnalysisImage(blob);
 }
 async function identify({reverse,obverse=null,denomination='',signal}){
  const design=await photo(reverse);
  const request=obverse=>requestSingleCoinIdentification({reverse:design,obverse,denomination,signal,batch:true});
  let data=await request(null);
  if(obverse&&(data.uncertain||data.needs_year))data=await request(await photo(obverse));
  return data;
 }
 window.BatchSingleAdapter={identify};
})();
