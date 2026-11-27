import {createClient} from 'npm:@supabase/supabase-js@2.49.4';
const cors={'Access-Control-Allow-Origin':'https://aistage.one','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:cors});
const redirect='https://aistage.one/marketing-oauth-callback.html';
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const scopes={meta:'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish',youtube:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'};
const graph='https://graph.facebook.com/v24.0';
async function request(url:string,opts:RequestInit={}){const r=await fetch(url,{...opts,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('provider_request_failed');return await r.json();}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const scoped=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
 const {data:auth,error:authError}=await scoped.auth.getUser();
 if(authError||auth.user?.app_metadata?.role!=='admin')return reply({error:'admin_required'},403);
 const db=createClient(url,key,{auth:{persistSession:false}});
 const body=await req.json(),{action,brand,provider}=body;
 if(!['aistage','leplateau'].includes(brand)||!['meta','youtube'].includes(provider))return reply({error:'invalid_selection'},400);
 const get=async(q:any)=>{const {data,error}=await q;if(error)throw Error('storage_error');return data;};
 const list=()=>get(db.from('marketing_social_connections').select('brand,provider,network,account_id,account_name,expires_at,scopes,verified_at').eq('brand',brand).eq('provider',provider));
 if(action==='list')return reply({accounts:await list(),redirect});
 const config=await get(db.from('marketing_social_config').select('*').eq('brand',brand).eq('provider',provider).maybeSingle());
 if(!config)return reply({error:'configuration_required'},400);
 const secret=()=>get(db.rpc('marketing_oauth_secret',{p_id:config.secret_id}));
 if(action==='start'){
 await get(db.from('marketing_oauth_attempts').delete().eq('admin_id',auth.user.id).lt('created_at',new Date(Date.now()-600000).toISOString()));
 const verifier=b64(crypto.getRandomValues(new Uint8Array(48)));
 const state=await get(db.from('marketing_oauth_attempts').insert({brand,provider,admin_id:auth.user.id,verifier,config_updated_at:config.updated_at}).select('state').single());
 const u=new URL(provider==='meta'?'https://www.facebook.com/v24.0/dialog/oauth':'https://accounts.google.com/o/oauth2/v2/auth');
 const params:Record<string,string>={client_id:config.client_id,redirect_uri:redirect,response_type:'code',state:state.state,scope:scopes[provider as keyof typeof scopes]};
 if(provider==='youtube'){params.access_type='offline';params.prompt='consent';params.code_challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));params.code_challenge_method='S256';}
 u.search=new URLSearchParams(params).toString();return reply({url:u.toString()});
 }
 if(action==='finish'){
 if(typeof body.code!=='string'||body.code.length>4096||typeof body.state!=='string')return reply({error:'invalid_callback'},400);
 const attempt=await get(db.from('marketing_oauth_attempts').delete().eq('state',body.state).eq('admin_id',auth.user.id).eq('brand',brand).eq('provider',provider).eq('config_updated_at',config.updated_at).gt('created_at',new Date(Date.now()-600000).toISOString()).select('*').maybeSingle());
 if(!attempt)return reply({error:'invalid_or_expired_state'},400);
 const params=new URLSearchParams({client_id:config.client_id,client_secret:await secret(),redirect_uri:redirect,code:body.code,grant_type:'authorization_code'});
 let tok:any;
 if(provider==='youtube'){params.set('code_verifier',attempt.verifier);tok=await request('https://oauth2.googleapis.com/token',{method:'POST',body:params});}
 else{tok=await request(graph+'/oauth/access_token?'+params.toString());const exchange=new URLSearchParams({grant_type:'fb_exchange_token',client_id:config.client_id,client_secret:await secret(),fb_exchange_token:tok.access_token});tok=await request(graph+'/oauth/access_token?'+exchange.toString());}
 if(!tok.access_token)throw Error('missing_token');
 const candidates:any[]=[];
 if(provider==='youtube'){
 const result=await request('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',{headers:{Authorization:'Bearer '+tok.access_token}});
 for(const ch of result.items||[])candidates.push({network:'youtube',account_id:ch.id,account_name:ch.snippet.title,token:tok});
 }else{
 const result=await request(graph+'/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100',{headers:{Authorization:'Bearer '+tok.access_token}});
 for(const page of result.data||[]){if(!page.access_token)continue;candidates.push({network:'facebook',account_id:page.id,account_name:page.name,token:{access_token:page.access_token}});if(page.instagram_business_account)candidates.push({network:'instagram',account_id:page.instagram_business_account.id,account_name:page.instagram_business_account.username||page.name,token:{access_token:page.access_token}});}
 }
 // Store discovered accounts as candidates; explicit selection is required before publication.
 for(const a of candidates){
 const old=await get(db.from('marketing_social_connections').select('token_id').eq('brand',brand).eq('provider',provider).eq('network',a.network).eq('account_id',a.account_id).maybeSingle());
 const token_id=await get(db.rpc('marketing_oauth_store',{p_secret:JSON.stringify(a.token)}));
 try{await get(db.from('marketing_social_connections').upsert({brand,provider,network:a.network,account_id:a.account_id,account_name:a.account_name,token_id,expires_at:a.token.expires_in?new Date(Date.now()+a.token.expires_in*1000).toISOString():null,scopes:tok.scope||null,verified_at:new Date().toISOString()}));}catch(e){await get(db.rpc('marketing_oauth_delete',{p_id:token_id}));throw e;}
 if(old)await get(db.rpc('marketing_oauth_delete',{p_id:old.token_id}));
 }
 return reply({accounts:await list()});
 }
 if(!['verify','disconnect'].includes(action))return reply({error:'invalid_action'},400);
 const row=await get(db.from('marketing_social_connections').select('*').eq('brand',brand).eq('provider',provider).eq('network',body.network).eq('account_id',body.account_id).maybeSingle());
 if(!row)return reply({error:'account_not_found'},404);
 if(action==='disconnect'){
 await get(db.from('marketing_social_connections').delete().eq('brand',brand).eq('provider',provider).eq('network',row.network).eq('account_id',row.account_id));
 await get(db.rpc('marketing_oauth_delete',{p_id:row.token_id}));return reply({accounts:await list()});
 }
 let tok=JSON.parse(await get(db.rpc('marketing_oauth_secret',{p_id:row.token_id})));
 if(provider==='youtube'&&tok.refresh_token&&(!row.expires_at||Date.parse(row.expires_at)<Date.now()+60000)){
 const fresh=await request('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:config.client_id,client_secret:await secret(),refresh_token:tok.refresh_token,grant_type:'refresh_token'})});
 tok={...tok,...fresh};const id=await get(db.rpc('marketing_oauth_store',{p_secret:JSON.stringify(tok)}));await get(db.from('marketing_social_connections').update({token_id:id,expires_at:new Date(Date.now()+fresh.expires_in*1000).toISOString()}).eq('brand',brand).eq('provider',provider).eq('network',row.network).eq('account_id',row.account_id));await get(db.rpc('marketing_oauth_delete',{p_id:row.token_id}));
 }
 const result=await request(provider==='youtube'?'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true':graph+'/'+encodeURIComponent(row.account_id)+'?fields=id',{headers:{Authorization:'Bearer '+tok.access_token}});
 if(provider==='youtube'?!result.items?.some((x:any)=>x.id===row.account_id):result.id!==row.account_id)throw Error('account_mismatch');
 await get(db.from('marketing_social_connections').update({verified_at:new Date().toISOString()}).eq('brand',brand).eq('provider',provider).eq('network',row.network).eq('account_id',row.account_id));
 return reply({accounts:await list()});
 }catch{return reply({error:'oauth_operation_failed'},400);}
});