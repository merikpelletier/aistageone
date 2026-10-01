import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { serveWithCors } from '../_shared/adminFinanceCors.ts';
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';

serveWithCors(async request=>{
  const auth=request.headers.get('Authorization')||'';
  const scoped=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:auth?{Authorization:auth}:{}},auth:{persistSession:false}});
  const {data,error}=await scoped.auth.getUser();
  if(error||!data.user)return Response.json({error:'Unauthorized'},{status:401});
  const body=await request.json();
  const service=String(body.service||'').trim();
  if(!service)return Response.json({error:'service is required'},{status:400});
  const serviceClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  try{
    if(body.action==='options'){
      const requestedKind=String(body.kind||'').trim()||null;
      let assignmentsQuery=serviceClient.from('ai_model_assignment')
        .select('kind,model_key')
        .eq('service',service).eq('enabled',true);
      if(requestedKind)assignmentsQuery=assignmentsQuery.eq('kind',requestedKind);
      const {data:assignments,error:ae}=await assignmentsQuery.limit(20);
      if(ae)throw ae;
      const effectiveKind=requestedKind||(assignments||[])[0]?.kind||null;
      if(!effectiveKind)return Response.json({options:[]});

      const {data:catalog,error:ce}=await serviceClient.from('ai_model_catalog')
        .select('model_key,name,description,kind,enabled')
        .eq('kind',effectiveKind).eq('enabled',true)
        .neq('model_key','bytedance/seedream-4.5')
        .order('name',{ascending:true});
      if(ce)throw ce;

      const {data:routeOptions,error:oe}=await serviceClient.from('ai_model_route_option')
        .select('model_key,recommended,display_order,kind')
        .eq('service',service).eq('kind',effectiveKind).eq('enabled',true);
      if(oe)throw oe;
      const optionMap=new Map((routeOptions||[]).map((o:any)=>[o.model_key,o]));
      const results=[];
      for(const model of catalog||[]){
        const explicit=optionMap.get(model.model_key);
        try{
          const quote=await quoteAiService(serviceClient,service,body.input||{},model.model_key,effectiveKind);
          results.push({
            model_key:model.model_key,
            name:model.name||model.model_key,
            description:model.description||'',
            kind:effectiveKind,
            recommended:Boolean(explicit?.recommended),
            display_order:explicit?.display_order??999,
            credits:quote.credits,
            estimated:quote.estimated,
            billing_type:quote.billing_type,
          });
        }catch(e){
          results.push({
            model_key:model.model_key,
            name:model.name||model.model_key,
            description:model.description||'',
            kind:effectiveKind,
            recommended:Boolean(explicit?.recommended),
            display_order:explicit?.display_order??999,
            credits:null,
            unavailable_reason:e instanceof Error?e.message:'Tarif indisponible',
          });
        }
      }
      results.sort((a,b)=>Number(b.recommended)-Number(a.recommended)||(a.display_order-b.display_order)||a.name.localeCompare(b.name));
      return Response.json({options:results});
    }
    const quote=await quoteAiService(serviceClient,service,body.input||{},body.model_key||null,body.kind||null);
    return Response.json(quote);
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:'Quote unavailable'},{status:422});
  }
});
