import { createClient } from 'npm:@supabase/supabase-js@2';
import { financeContext } from './financeContext.ts';



export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth:{persistSession:false} });
}
export function httpError(message: string, status = 422) { return Object.assign(new Error(message), {status}); }
export async function authenticated(request: Request) {
  const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{
    global:{headers:{Authorization:request.headers.get('Authorization') || ''}},auth:{persistSession:false},
  });
  const {data,error}=await client.auth.getUser();
  if(error || !data.user?.email) throw httpError('Connexion requise',401);
  return data.user;
}
export async function runFinanceRequest(request: Request, handler: (r:Request)=>Promise<Response>|Response) {
 const functionName=new URL(request.url).pathname.split('/').filter(Boolean).pop()!;
 return financeContext.run({requestId:crypto.randomUUID(),functionName,request,usedLines:{}},()=>handler(request));
}
function numeric(value: unknown) { const n=Number(value);return value!=null && Number.isFinite(n) && n>=0?n:null; }
const nativeFetch=globalThis.fetch.bind(globalThis);

// Imported only by provider call sites. It does not replace global fetch.
export async function financeFetch(input: RequestInfo|URL, init?:RequestInit):Promise<Response> {
  const request=new Request(input,init);const url=new URL(request.url);
  if(url.origin!=='https://api.replicate.com' || !url.pathname.includes('/predictions')) return nativeFetch(request);
  const context=financeContext.getStore();
  const creating=request.method==='POST' && /\/predictions$/.test(url.pathname);
  const payload=creating?await request.clone().json().catch(()=>({})):{};
  const model=url.pathname.match(/\/models\/(.+)\/predictions$/)?.[1] || (payload.version?`version:${payload.version}`:null);
  let selected:any=null;
  if(creating && context?.quote) {
    selected=context.quote.plan.lines.find((l:any)=>l.model_key===model);
    if(!selected) throw httpError('Appel fournisseur absent du devis',409);
    const used=context.usedLines[model!] || 0;
    if(used >= (selected.count || 1)) throw httpError('Budget du devis atteint',409);
    context.usedLines[model!]=used+1;
    request.headers.set('Cancel-After',`${selected.rate.max_runtime_seconds || 240}s`);
  }
  const response=await nativeFetch(request);
  try {
    const prediction=await response.clone().json();
    if(!prediction.id) return response;
    const service=context?.service || serviceClient();
    let event:any;
    if(creating) {
      const {data:settings}=await service.from('ai_finance_settings').select('*').eq('id',true).single();
      const {data:rate}=await service.from('ai_model_rate').select('*').eq('model_key',model).maybeSingle();
      const text=payload.input?.text;
      event={prediction_id:prediction.id,quote_id:context?.quote?.id || null,charge_id:context?.chargeId || null,request_id:context?.requestId || null,
        function_name:context?.functionName,tool_id:context?.toolId,model_key:model,model_version:prediction.version || null,
        status:prediction.status || 'starting',usage:{characters:typeof text==='string'?text.length:null,requested_output_seconds:numeric(payload.input?.duration)},
        rate_snapshot:selected?.rate || rate || null,usd_to_cad_rate:context?.quote?.usd_to_cad_rate || settings?.usd_to_cad_rate || null};
    } else {
      const {data}=await service.from('ai_usage_event').select('*').eq('prediction_id',prediction.id).maybeSingle();event=data;
      if(!event) return response;
      if(['succeeded','failed','canceled'].includes(event.status)) return response;
    }
    event.status=prediction.status || event.status;
    event.updated_at=new Date().toISOString();
    const metrics=prediction.metrics || {};
    event.usage={...event.usage,runtime_seconds:numeric(metrics.predict_time),input_tokens:numeric(metrics.input_token_count),output_tokens:numeric(metrics.output_token_count)};
    const terminal=['succeeded','failed','canceled'].includes(event.status);
    if(terminal) {
      event.completed_at=prediction.completed_at || event.updated_at;
      const r=event.rate_snapshot; const u=event.usage;let cost:number|null=null;
      if(r) {
        if(r.billing_type==='runtime_seconds' && u.runtime_seconds!=null) cost=u.runtime_seconds*Number(r.unit_price_usd);
        else if(event.status==='succeeded') {
          if(r.billing_type==='prediction')cost=Number(r.unit_price_usd);
          if(r.billing_type==='characters' && u.characters!=null)cost=u.characters*Number(r.unit_price_usd)/1000;
          if(r.billing_type==='output_seconds' && u.requested_output_seconds!=null)cost=u.requested_output_seconds*Number(r.unit_price_usd);
          if(r.billing_type==='tokens' && u.input_tokens!=null && u.output_tokens!=null && r.output_unit_price_usd!=null)cost=(u.input_tokens*Number(r.unit_price_usd)+u.output_tokens*Number(r.output_unit_price_usd))/1000;
        }
      }
      event.cost_usd=cost;event.cost_cad=cost!=null && event.usd_to_cad_rate?cost*Number(event.usd_to_cad_rate):null;
    }
    const {error}=await service.from('ai_usage_event').upsert(event,{onConflict:'prediction_id'});
    if(error) console.error('AI cost recording unavailable');
  } catch { console.error('AI cost recording unavailable'); }
  return response;
}
