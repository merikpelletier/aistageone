import {createClient} from 'npm:@supabase/supabase-js@2.112.2';
export async function checkReplicateConnection(){
 const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:recent}=await service.from('ai_provider_connection').select('*').eq('provider','replicate').maybeSingle();
 if(recent&&Date.now()-Date.parse(recent.checked_at)<60000)return recent;
 const token=Deno.env.get('REPLICATE_API_TOKEN');
 const state:any={provider:'replicate',configured:Boolean(token),connected:false,account_username:null,http_status:null,message:token?'Connexion non vérifiée.':'La clé Replicate du serveur est absente.',checked_at:new Date().toISOString()};
 if(token){try{
  const r=await fetch('https://api.replicate.com/v1/account',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});state.http_status=r.status;
  if(r.ok){const account=await r.json();state.connected=true;state.account_username=account.username||null;state.message='Connexion Replicate vérifiée.';}
  else state.message=[401,403].includes(r.status)?'La clé configurée est refusée par Replicate.':'Replicate est temporairement indisponible.';
 }catch{state.message='Replicate ne répond pas au contrôle de connexion.';}}
 const {error}=await service.from('ai_provider_connection').upsert(state,{onConflict:'provider'});if(error)console.error('Provider connection status could not be saved');
 return state;
}
