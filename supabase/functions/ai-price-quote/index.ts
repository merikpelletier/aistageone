import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { serveWithCors } from '../_shared/adminFinanceCors.ts';
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';

const incompatibleRequiredMedia=new Set(['image','image_url','input_image','start_image','end_image','last_frame_image','first_frame','video','video_url','base_video','reference_video','reference_videos','audio','reference_audios']);
const shootCompatible=(model:any,mapping:any={})=>{
  const input=model?.schema?.components?.schemas?.Input||{};
  const props=input?.properties||{};
  const sources=Object.keys(props).map((name)=>mapping?.[name]||name);
  if(!sources.includes('prompt')||!sources.includes('reference_images'))return false;
  const requiredSources=(input.required||[]).map((name:string)=>mapping?.[name]||name);
  return !requiredSources.some((source:string)=>incompatibleRequiredMedia.has(source));
};

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
      let assignmentsQuery=serviceClient.from('ai_model_assignment').select('route_key,kind,input_mapping,defaults').eq('service',service).eq('enabled',true);
      if(requestedKind)assignmentsQuery=assignmentsQuery.eq('kind',requestedKind);
      const {data:assignments,error:ae}=await assignmentsQuery.limit(50);
      if(ae)throw ae;
      const effectiveKind=requestedKind||(assignments||[])[0]?.kind||null;
      if(!effectiveKind)return Response.json({options:[]});

      const compatibleAssignments=(assignments||[]).filter((item:any)=>item.kind===effectiveKind);
      if(!compatibleAssignments.length)return Response.json({options:[]});
      const routeKeys=compatibleAssignments.map((item:any)=>item.route_key);
      const {data:routeOptions,error:oe}=await serviceClient.from('ai_model_route_option').select('route_key,model_key,recommended,display_order,kind,input_mapping,defaults').eq('service',service).eq('kind',effectiveKind).eq('enabled',true).in('route_key',routeKeys);
      if(oe)throw oe;

      const optionMap=new Map<string,any>();
      for(const option of routeOptions||[]){
        const current=optionMap.get(option.model_key);
        if(!current||Boolean(option.recommended)&&!Boolean(current.recommended)||(Number(option.display_order||0)<Number(current.display_order||0)))optionMap.set(option.model_key,option);
      }

      const shootVideo=service==='generateVideo:video'&&effectiveKind==='video';
      const modelKeys=shootVideo?null:[...optionMap.keys()];
      if(!shootVideo&&!modelKeys?.length)return Response.json({options:[]});

      let catalogQuery=serviceClient.from('ai_model_catalog').select('model_key,name,description,kind,enabled,schema,capabilities').eq('kind',effectiveKind).eq('enabled',true);
      if(modelKeys)catalogQuery=catalogQuery.in('model_key',modelKeys);
      const {data:catalog,error:ce}=await catalogQuery.order('name',{ascending:true});
      if(ce)throw ce;

      const fallbackAssignment=compatibleAssignments[0];
      const results=[];
      for(const model of catalog||[]){
        const explicit=optionMap.get(model.model_key)||null;
        if(!shootVideo&&!explicit)continue;
        if(shootVideo&&!model.schema)continue;
        const inputMapping=explicit?.input_mapping||fallbackAssignment?.input_mapping||{};
        if(shootVideo&&!shootCompatible(model,inputMapping))continue;
        const base={model_key:model.model_key,name:model.name||model.model_key,description:model.description||'',kind:effectiveKind,recommended:Boolean(explicit?.recommended),display_order:explicit?.display_order??999,schema:model.schema||null,capabilities:model.capabilities||null,input_mapping:inputMapping,defaults:explicit?.defaults||fallbackAssignment?.defaults||{},route_key:explicit?.route_key||fallbackAssignment?.route_key||null};
        try{
          const quote=await quoteAiService(serviceClient,service,body.input||{},model.model_key,effectiveKind);
          results.push({...base,credits:quote.credits,estimated:quote.estimated,billing_type:quote.billing_type});
        }catch(e){
          results.push({...base,credits:null,unavailable_reason:e instanceof Error?e.message:'Tarif indisponible'});
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