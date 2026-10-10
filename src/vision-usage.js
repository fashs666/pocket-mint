/* Observability only: model inputs and outputs pass through unchanged. */
const rates={
 '@cf/meta/llama-4-scout-17b-16e-instruct':[24545,77273],
 '@cf/meta/llama-3.2-11b-vision-instruct':[4410,61493]
};
// Neurons per million input/output tokens, checked 2026-10-10:
// https://developers.cloudflare.com/workers-ai/platform/pricing/
export function instrumentVision(worker){return {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(!env.AI||request.method!=='POST'||!['/api/identify','/api/batch-orientation','/api/photo-orientation'].includes(path))return worker.fetch(request,env,ctx);
 const usage={id:crypto.randomUUID(),day:new Date().toISOString().slice(0,10),calls:0,measured:0,unknown:0,failed:0,neurons:0};
 const ai=new Proxy(env.AI,{get(target,key){
  if(key!=='run'){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}
  return async(...args)=>{
   usage.calls++;
   try{const output=await target.run(...args),tokens=output?.usage,rate=rates[args[0]];
    if(rate&&Number.isFinite(tokens?.prompt_tokens)&&tokens.prompt_tokens>=0&&Number.isFinite(tokens?.completion_tokens)&&tokens.completion_tokens>=0){
     usage.measured++;usage.neurons+=(tokens.prompt_tokens*rate[0]+tokens.completion_tokens*rate[1])/1e6;
    }else usage.unknown++;
    return output;
   }catch(error){usage.failed++;usage.unknown++;throw error;}
  };
 }});
 const response=await worker.fetch(request,{...env,AI:ai},ctx);
 if(!usage.calls)return response;
 const headers=new Headers(response.headers);headers.set('x-pocket-mint-usage',JSON.stringify(usage));
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};}
