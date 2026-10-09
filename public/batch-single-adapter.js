/* Supplies an isolated photo to the unchanged single-coin preparation/endpoint.
   Never touches identifyState, the single camera, ranking or recognition prompts. */
(() => {
 async function photo(input){
  const blob=typeof input==='string'?await (await fetch(input)).blob():input;
  return makeAnalysisImage(blob);
 }
 async function identify({reverse,obverse=null,denomination='',signal}){
  const design=await photo(reverse);
  async function request(portrait){
   const response=await fetch('/api/identify',{method:'POST',signal,headers:{'content-type':'application/json','x-pocket-mint-batch':'1'},body:JSON.stringify({mode:'circulating',single_coin:true,denomination,reverse:design,obverse:portrait})});
   const data=await response.json();
   if(!response.ok)throw Object.assign(new Error(data.error||'Identification unavailable'),{quota:response.status===429,analysisError:{status:response.status,diagnostic_code:data.diagnostic_code||null,request_id:data.request_id||null,message:data.error||'Identification unavailable'}});
   return data;
  }
  let data=await request(null);
  if(obverse&&(data.uncertain||data.needs_year))data=await request(await photo(obverse));
  return data;
 }
 window.BatchSingleAdapter={identify};
})();
