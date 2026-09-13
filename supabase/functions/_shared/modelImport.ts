export function modelIdentifier(value:unknown){
 let key=String(value||'').trim().replace(/^`|`$/g,'');
 if(/^https?:\/\//i.test(key)){
  const url=new URL(key);if(!['replicate.com','www.replicate.com'].includes(url.hostname))throw Error('Utilise un lien Replicate ou un identifiant éditeur/modèle.');
  key=url.pathname.split('/').filter(Boolean).slice(0,2).join('/');
 }
 key=key.replace(/\/$/,'').toLowerCase();
 if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(key))throw Error('Identifiant incomplet : colle le lien de la page Replicate du modèle.');
 return key;
}
export function publicModelMetadata(html:string,key:string){
 const records=[...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>{try{return JSON.parse(m[1]);}catch{return null;}}).filter(Boolean);
 const models=records.map(r=>r.model).filter(Boolean);
 const model=models.find(m=>m.name===key.split('/')[1]&&(m.owner?.username||m.owner)===key.split('/')[0]);
 const version=records.map(r=>r.version||r.model?.latest_version).find(v=>v?.openapi_schema?.components?.schemas?.Input||v?._extras?.dereferenced_openapi_schema?.components?.schemas?.Input);
 if(!model||!version)throw Error('Replicate n’a pas fourni les informations complètes du modèle.');
 return {...model,owner:key.split('/')[0],latest_version:{...version,openapi_schema:version.openapi_schema||version._extras.dereferenced_openapi_schema}};
}
export async function importModel(value:unknown,token:string|undefined,fetcher:typeof fetch=fetch){
 const key=modelIdentifier(value);
 if(key==='bytedance/seedream-4.5')throw Error('Seedream 4.5 est interdit.');
 let model:any=null;
 if(token){try{const r=await fetcher(`https://api.replicate.com/v1/models/${key}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});if(r.ok)model=await r.json();}catch{/* Public documentation is a second source for public models only. */}}
 if(!model?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties){
  const page=await fetcher(`https://replicate.com/${key}/api`,{signal:AbortSignal.timeout(12000)});
  if(!page.ok)throw Error(`La documentation Replicate de ce modèle est indisponible (${page.status}).`);
  model=publicModelMetadata(await page.text(),key);
 }
 if(`${model.owner}/${model.name}`.toLowerCase()==='bytedance/seedream-4.5')throw Error('Modèle interdit.');
 const schema=model.latest_version?.openapi_schema;
 if(!schema?.components?.schemas?.Input?.properties)throw Error('Replicate n’a pas fourni les paramètres de ce modèle.');
 return {model_key:key,name:model.name,description:model.description||'',schema,version_id:model.latest_version?.id||null,capabilities:{documentation:model.url,license_url:model.license_url||'',hardware:model.hardware||'',visibility:model.visibility||''}};
}
