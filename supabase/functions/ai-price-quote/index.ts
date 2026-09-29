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
      let query=serviceClient.from('ai_model_route_option')
        .select('model_key,recommended,display_order,kind')
        .eq('service',service).eq('enabled',true);
      if(body.kind)query=query.eq('kind',body.kind);
      const {data:options,error:oe}=await query.order('recommended',{ascending:false}).order('display_order',{ascending:true});
      if(oe)throw oe;
      const results=[];
      for(const option of options||[]){
        const {data:model}=await serviceClient.from('ai_model_catalog').select('model_key,name,description').eq('model_key',option.model_key).maybeSingle();
        try{
          const quote=await quoteAiService(serviceClient,service,body.input||{},option.model_key,body.kind||null);
          results.push({...option,name:model?.name||option.model_key,description:model?.description||'',credits:quote.credits,estimated:quote.estimated,billing_type:quote.billing_type});
        }catch(e){
          results.push({...option,name:model?.name||option.model_key,description:model?.description||'',credits:null,unavailable_reason:e instanceof Error?e.message:'Tarif indisponible'});
        }
      }
      return Response.json({options:results});
    }
    const quote=await quoteAiService(serviceClient,service,body.input||{},body.model_key||null,body.kind||null);
    return Response.json(quote);
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:'Quote unavailable'},{status:422});
  }
});
