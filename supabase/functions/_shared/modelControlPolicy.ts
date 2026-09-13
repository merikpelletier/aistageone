export const MODEL_OWNER='fd3ceec1-0d99-4d7e-9793-284e342efe90';
export const BLOCKED_MODEL='bytedance/seedream-4.5';
export function serviceKey(slug:string,body:any){return slug==='replicateGenerate'?`${slug}:${body?.method||'missing'}`:slug==='generateVideo'?`${slug}:${body?.engine||'seedance'}`:slug;}
export function routeKey(service:string,model:string){return `${service}|${model.toLowerCase()}`;}
export function fail(message:string,status=409):never{throw Object.assign(new Error(message),{status});}
export function validateChoice(assignment:any,model:any){
 if(!assignment?.enabled||!model?.enabled)fail('Ce service attend le choix de modèle de Merik. Aucun modèle par défaut ne sera utilisé.');
 if(model.provider!=='replicate'||String(model.model_key).toLowerCase()===BLOCKED_MODEL)fail('Modèle interdit');
 if(model.kind!==assignment.kind)fail('Le type du modèle ne correspond pas à ce service');
 if(model.unit_price_usd==null||!model.billing_type||!model.cost_source_url)fail('Le tarif du modèle doit être renseigné par Merik');
}
function resolve(schema:any,document:any):any{if(schema?.$ref){const key=schema.$ref.replace(/^#\//,'').split('/');return key.reduce((v:any,k:string)=>v?.[k],document);}return schema;}
function valid(value:any,schema:any,doc:any):boolean{
 schema=resolve(schema,doc)||{};
 if(schema.anyOf)return schema.anyOf.some((s:any)=>valid(value,s,doc));
 if(schema.allOf)return schema.allOf.every((s:any)=>valid(value,s,doc));
 if(schema.enum&&!schema.enum.includes(value))return false;
 if(value===null)return schema.nullable===true||schema.type==='null';
 if(schema.type==='string'&&typeof value!=='string')return false;
 if(schema.type==='boolean'&&typeof value!=='boolean')return false;
 if(['number','integer'].includes(schema.type)&&(!Number.isFinite(value)||(schema.type==='integer'&&!Number.isInteger(value))))return false;
 if(schema.type==='array'&&(!Array.isArray(value)||value.some(v=>!valid(v,schema.items,doc))))return false;
 if(schema.type==='object'&&(typeof value!=='object'||Array.isArray(value)))return false;
 if(typeof value==='number'&&(schema.minimum!=null&&value<schema.minimum||schema.maximum!=null&&value>schema.maximum))return false;
 return true;
}
export function adaptInput(input:any,assignment:any,model:any){
 const document=model.schema;const schema=resolve(document?.components?.schemas?.Input,document);
 if(!schema?.properties)fail('Le schéma du modèle doit être importé avant utilisation');
 const out:any={};
 for(const [key,field] of Object.entries(schema.properties)){
  const source=assignment.input_mapping?.[key]||key;
  let value=input?.[source];
  if(value===undefined)value=assignment.defaults?.[key];
  if(value===undefined)value=(field as any).default;
  if(value===undefined)continue;
  if(!valid(value,field,document))fail(`Paramètre incompatible avec le modèle choisi : ${key}`);
  out[key]=value;
 }
 for(const key of schema.required||[])if(out[key]===undefined)fail(`Le modèle choisi exige le paramètre « ${key} ». La correspondance doit être configurée par Merik.`);
 return out;
}
