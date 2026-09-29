export function modelIdentifier(value:unknown){
 let key=String(value||'').trim().replace(/^\`|\`$/g,'');
 if(/^https?:\/\//i.test(key)){
  const url=new URL(key);
  if(!['replicate.com','www.replicate.com'].includes(url.hostname))throw Error('Utilise un lien Replicate ou un identifiant éditeur/modèle.');
  key=url.pathname.split('/').filter(Boolean).slice(0,2).join('/');
 }
 key=key.replace(/\/$/,'').toLowerCase();
 if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(key))throw Error('Identifiant incomplet : colle le lien de la page Replicate du modèle.');
 return key;
}

export function publicModelMetadata(html:string,key:string){
 const records=[...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m=>{try{return JSON.parse(m[1]);}catch{return null;}})
  .filter(Boolean);
 const models=records.map(r=>r.model).filter(Boolean);
 const model=models.find(m=>m.name===key.split('/')[1]&&(m.owner?.username||m.owner)===key.split('/')[0]);
 const version=records.map(r=>r.version||r.model?.latest_version)
  .find(v=>v?.openapi_schema?.components?.schemas?.Input||v?._extras?.dereferenced_openapi_schema?.components?.schemas?.Input);
 if(!model||!version)throw Error('Replicate n’a pas fourni les informations complètes du modèle.');
 return {...model,owner:key.split('/')[0],latest_version:{...version,openapi_schema:version.openapi_schema||version._extras.dereferenced_openapi_schema}};
}

function plainText(html:string){
 return html
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ')
  .replace(/&amp;/g,'&')
  .replace(/\s+/g,' ')
  .trim();
}

function detectPricing(html:string,key:string){
 const t=plainText(html);
 const money='([0-9]+(?:\\.[0-9]+)?)';
 const one=(pattern:string)=>{const m=t.match(new RegExp(pattern,'i'));return m?Number(m[1]):null;};
 let unit_price_usd:number|null=null;
 let output_unit_price_usd:number|null=null;
 let billing_type:string|null=null;
 let quantity=1;

 unit_price_usd=one('\\$'+money+'\\s+per\\s+second of output video');
 if(unit_price_usd!=null)billing_type='output_seconds';

 if(billing_type==null){
  unit_price_usd=one('\\$'+money+'\\s+per\\s+output image');
  if(unit_price_usd!=null)billing_type='output_images';
 }
 if(billing_type==null){
  unit_price_usd=one('\\$'+money+'\\s+per\\s+output video');
  if(unit_price_usd!=null)billing_type='output_videos';
 }
 if(billing_type==null){
  unit_price_usd=one('\\$'+money+'\\s+per\\s+(?:prediction|generation)');
  if(unit_price_usd!=null)billing_type='prediction';
 }

 const input1000=one('\\$'+money+'\\s+per\\s+(?:thousand|1,000) input tokens');
 const output1000=one('\\$'+money+'\\s+per\\s+(?:thousand|1,000) output tokens');
 const inputMillion=one('\\$'+money+'\\s+per\\s+million input tokens');
 const outputMillion=one('\\$'+money+'\\s+per\\s+million output tokens');
 if(input1000!=null&&output1000!=null){
  billing_type='tokens';unit_price_usd=input1000;output_unit_price_usd=output1000;quantity=1000;
 }else if(inputMillion!=null&&outputMillion!=null){
  billing_type='tokens';unit_price_usd=inputMillion/1000;output_unit_price_usd=outputMillion/1000;quantity=1000;
 }

 const chars=one('\\$'+money+'\\s+per\\s+(?:thousand|1,000) characters');
 if(billing_type==null&&chars!=null){
  billing_type='characters';unit_price_usd=chars;quantity=1000;
 }

 const multiple=/Priced by multiple properties/i.test(t)||((t.match(/per second of output video/gi)||[]).length>1);
 return billing_type&&unit_price_usd!=null&&!multiple ? {
   billing_type,
   unit_price_usd,
   output_unit_price_usd,
   cost_source_url:`https://replicate.com/${key}`,
   cost_checked_at:new Date().toISOString(),
   capabilities:{pricing:{mode:'fixed',quantity}},
   pricing_imported:true
 } : {pricing_imported:false};
}

export async function importModel(value:unknown,token:string|undefined,fetcher:typeof fetch=fetch){
 const key=modelIdentifier(value);
 if(key==='bytedance/seedream-4.5')throw Error('Seedream 4.5 est interdit.');

 let model:any=null;
 let pageHtml='';

 if(token){
  try{
   const r=await fetcher(`https://api.replicate.com/v1/models/${key}`,{
    headers:{Authorization:`Bearer ${token}`},
    signal:AbortSignal.timeout(8000)
   });
   if(r.ok)model=await r.json();
  }catch{}
 }

 if(!model?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties){
  const page=await fetcher(`https://replicate.com/${key}/api`,{signal:AbortSignal.timeout(12000)});
  if(!page.ok)throw Error(`La documentation Replicate de ce modèle est indisponible (${page.status}).`);
  pageHtml=await page.text();
  model=publicModelMetadata(pageHtml,key);
 }

 if(!pageHtml){
  try{
   const page=await fetcher(`https://replicate.com/${key}`,{signal:AbortSignal.timeout(12000)});
   if(page.ok)pageHtml=await page.text();
  }catch{}
 }

 if(`${model.owner}/${model.name}`.toLowerCase()==='bytedance/seedream-4.5')throw Error('Modèle interdit.');
 const schema=model.latest_version?.openapi_schema;
 if(!schema?.components?.schemas?.Input?.properties)throw Error('Replicate n’a pas fourni les paramètres de ce modèle.');

 const pricing=pageHtml?detectPricing(pageHtml,key):{pricing_imported:false};
 return {
  model_key:key,
  name:model.name,
  description:model.description||'',
  schema,
  version_id:model.latest_version?.id||null,
  ...pricing,
  capabilities:{
   documentation:model.url,
   license_url:model.license_url||'',
   hardware:model.hardware||'',
   visibility:model.visibility||'',
   ...((pricing as any).capabilities||{})
  }
 };
}
