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
    const quote=await quoteAiService(serviceClient,service,body.input||{},body.model_key||null,body.kind||null);
    return Response.json(quote);
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:'Quote unavailable'},{status:422});
  }
});
