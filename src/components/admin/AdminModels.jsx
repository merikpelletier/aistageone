import React,{useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/api/base44Client';
import ModelPricingFields from './ModelPricingFields';
import {billingUnits} from '../../../supabase/functions/_shared/modelPricing.ts';
const box='rounded border border-white/15 bg-neutral-950 p-5 space-y-4';
const input='w-full rounded border border-white/20 bg-neutral-900 p-2 text-white';
const button='rounded bg-white px-4 py-2 text-sm text-black disabled:opacity-40';
const kinds={text:'Texte et raisonnement',image:'Image',video:'Vidéo',speech:'Voix',transcription:'Transcription',audio:'Audio et musique',processing:'Traitement de médias'};
const units=billingUnits;
const labels={replicateGenerate:'Studio',generateVideo:'Vidéo',body_and_voice:'Corps et voix',faceswitch:'Changement de visage',character_photo:'Photo de personnage',reference_sheet_swap:'Habillage acteur',character_sheet:'Fiche personnage',animate_image:'Animer une image',animate_with_reference:'Animation avec référence',lip_sync:'Synchronisation labiale',headshot:'Portrait',compose_scene:'Composition de scène',text_to_video:'Texte vers vidéo',seedance:'Génération vidéo',kling:'Transformation vidéo',kling_morph:'Transformation avec son','generate-image':'Images générales et Story Blocks','generate-speech':'Synthèse vocale',generateSpeech:'Voix des outils',generatePitchSpeech:'Voix Pitch Deck',generateCharacterSheet:'Fiches personnages',generateBlockVideos:'Médias Story Blocks',generateStoryBlock:'Écriture Story Blocks',checkStoryBlockPlan:'Planification Story Blocks',regenerateNarration:'Reprise narration',regenerateSegment:'Reprise segment',proposeStoryArc:'Arc narratif','invoke-llm':'Texte et vision','agent-conversations':'Agents et conversations','transcribe-audio':'Transcription',mixAudioVideo:'Assemblage audio/vidéo',replicateWebhook:'Suite des productions asynchrones'};
const serviceLabel=s=>s.split(':').map(v=>labels[v]||v).join(' · ');
async function api(body){const {data,error}=await supabase.functions.invoke('admin-models',{body,signal:AbortSignal.timeout(25000)});if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{}throw Error(message);}return data;}
function Field({label,...props}){return <label className="block space-y-1 text-sm"><span className="text-white/70">{label}</span><input className={input} {...props}/></label>;}
function Assignment({route,models,save,pending}){
 const [value,setValue]=useState(route);const [mapping,setMapping]=useState(JSON.stringify(route.input_mapping||{},null,2));const [defaults,setDefaults]=useState(JSON.stringify(route.defaults||{},null,2));const [error,setError]=useState('');
 const candidates=models.filter(m=>m.kind===route.kind&&m.enabled);
 return <form className={box} onSubmit={e=>{e.preventDefault();try{const input_mapping=JSON.parse(mapping),parameters=JSON.parse(defaults);setError('');save({action:'save_assignment',assignment:{...value,input_mapping,defaults:parameters}});}catch{setError('Les paramètres avancés doivent être au format JSON valide.');}}}>
  <div className="flex flex-wrap justify-between gap-2"><h4 className="font-medium">{kinds[route.kind]||route.kind}</h4><span className={route.enabled?'text-green-300':'text-amber-200'}>{route.enabled?'Activé par Merik':'Attend ton choix'}</span></div>
  <p className="break-all text-xs text-white/50">Étape existante : {route.source_model==='bytedance/seedream-4.5'?'Ancien modèle interdit — remplacement requis':route.source_model}</p>
  <label className="block text-sm">Ton modèle<select className={input} value={value.model_key||''} onChange={e=>setValue({...value,model_key:e.target.value,enabled:false})}><option value="">Aucun modèle choisi</option>{candidates.map(m=><option key={m.model_key} value={m.model_key}>{m.name} · {m.capabilities?.pricing?.mode==='conditional'?'Tarifs selon paramètres':`${m.unit_price_usd} USD`} · {units[m.billing_type]}</option>)}</select></label>
  {!candidates.length&&<p className="text-sm text-white/60">Ajoute et active un modèle de ce type dans ton catalogue ci-dessous.</p>}
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={value.enabled} disabled={!value.model_key} onChange={e=>setValue({...value,enabled:e.target.checked})}/>J’autorise ce modèle pour cette étape</label>
  <details><summary className="cursor-pointer text-sm text-white/60">Compatibilité des paramètres</summary><p className="my-2 text-xs text-white/50">Les champs portant le même nom sont conservés. Si les modèles emploient des noms différents, précise les correspondances. Un champ obligatoire absent bloque l’appel avant envoi au fournisseur.</p><label className="block text-sm">Correspondances : champ du modèle → champ fourni par l’outil<textarea className={input} rows={3} value={mapping} onChange={e=>setMapping(e.target.value)}/></label><label className="block text-sm">Paramètres fixes<textarea className={input} rows={3} value={defaults} onChange={e=>setDefaults(e.target.value)}/></label></details>
  {error&&<p role="alert" className="text-red-300">{error}</p>}<button className={button} disabled={pending}>Enregistrer mon choix</button>
 </form>;
}
const emptyModel={model_key:'',name:'',kind:'image',description:'',billing_type:'prediction',unit_price_usd:'',output_unit_price_usd:'',cost_source_url:'',notes:'',enabled:false,capabilities:{},schema:{},revision:0};
export default function AdminModels(){
 const qc=useQueryClient();const [model,setModel]=useState(emptyModel);const [filter,setFilter]=useState('');const [notice,setNotice]=useState('');
 const query=useQuery({queryKey:['admin-models'],queryFn:()=>api({action:'overview'}),retry:false});
 const mutation=useMutation({mutationFn:api,onSuccess:(data,variables)=>{if(variables.action==='import_model'){setModel(v=>({...v,...data,capabilities:{...v.capabilities,...data.capabilities},enabled:false}));setNotice(`Informations importées : ${data.name}. ${Object.keys(data.schema?.components?.schemas?.Input?.properties||{}).length} paramètres disponibles. Tes tarifs restent à renseigner.`);}else{if(variables.action==='save_model')setModel(data);setNotice('Ton choix a été enregistré.');qc.invalidateQueries({queryKey:['admin-models']});}},onError:()=>setNotice('')});
 const save=body=>{setNotice('');mutation.mutate(body);};
 if(query.isLoading)return <p className="p-8 text-white">Chargement du contrôle des modèles…</p>;
 if(query.error)return <p className="p-8 text-red-300" role="alert">{query.error.message}</p>;
 const data=query.data;const services=[...new Set(data.assignments.map(a=>a.service))];
 const props=model.schema?.components?.schemas?.Input?.properties||{};
 return <div className="space-y-6 text-white">
  <div><h2 className="text-2xl">Tes modèles IA</h2><p className="mt-2 text-white/60">Le choix des modèles appartient uniquement à Merik. Aucun modèle par défaut ni remplacement automatique. Seedream 4.5 est interdit.</p></div>
  <p role="status" className={data.connection?.connected?'text-green-300':'text-amber-200'}>{data.connection?.connected?`Replicate connecté${data.connection.account_username?` : ${data.connection.account_username}`:''}`:data.connection?.message||'Connexion Replicate non vérifiée.'}</p>
  <p className="rounded border border-amber-400/30 p-4 text-sm text-amber-100">Les services sans choix autorisé attendent ton activation. Les anciennes configurations affichées ne constituent pas une approbation.</p>
  {notice&&<p role="status" className="text-green-300">{notice}</p>}{mutation.error&&<p role="alert" className="text-red-300">{mutation.error.message}</p>}
  <section className={box}><h3 className="text-xl">Ton catalogue</h3>
   <label className="block">Modifier un modèle<select className={input} value={model.revision?model.model_key:''} onChange={e=>setModel(data.models.find(m=>m.model_key===e.target.value)||emptyModel)}><option value="">Ajouter un modèle</option>{data.models.map(m=><option value={m.model_key} key={m.model_key}>{m.name} · {kinds[m.kind]}</option>)}</select></label>
   <div className="grid gap-3 md:grid-cols-[1fr_auto]"><Field label="Identifiant ou lien Replicate du modèle" placeholder="éditeur/nom-du-modèle ou lien Replicate" value={model.model_key} disabled={Boolean(model.revision)||mutation.isPending} onChange={e=>{setModel({...emptyModel,model_key:e.target.value});setNotice('');mutation.reset();}}/><button type="button" className={`${button} self-end`} disabled={mutation.isPending||!model.model_key.trim()} onClick={()=>save({action:'import_model',model_key:model.model_key})}>{mutation.isPending&&mutation.variables?.action==='import_model'?'Importation…':'Importer ses informations'}</button></div>
   {mutation.variables?.action==='import_model'&&<div aria-live="polite">{mutation.isPending?<p className="text-sm text-white/70">Lecture des informations du modèle sur Replicate…</p>:mutation.error?<p role="alert" className="rounded border border-red-400/40 p-3 text-red-200">{mutation.error.message}</p>:notice?<p role="status" className="rounded border border-green-400/40 p-3 text-green-200">{notice}</p>:null}</div>}
   <form className="grid gap-4 md:grid-cols-2" onSubmit={e=>{e.preventDefault();save({action:'save_model',model});}}>
    <Field required label="Nom affiché" value={model.name} onChange={e=>setModel({...model,name:e.target.value})}/>
    <label>Type de modèle<select className={input} value={model.kind} onChange={e=>setModel({...model,kind:e.target.value,enabled:false})}>{Object.entries(kinds).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <ModelPricingFields model={model} onChange={setModel}/>
    <Field label="Langues prises en charge" value={model.capabilities?.languages||''} onChange={e=>setModel({...model,capabilities:{...model.capabilities,languages:e.target.value}})}/>
    <Field label="Limites : durée, résolution ou contexte" value={model.capabilities?.limits||''} onChange={e=>setModel({...model,capabilities:{...model.capabilities,limits:e.target.value}})}/>
    <Field label="Licence / droits d’utilisation" value={model.capabilities?.license_url||''} onChange={e=>setModel({...model,capabilities:{...model.capabilities,license_url:e.target.value}})}/>
    <label className="md:col-span-2">Description<textarea className={input} rows={3} value={model.description||''} onChange={e=>setModel({...model,description:e.target.value})}/></label>
    <label className="md:col-span-2">Notes : qualité, vitesse, restrictions<textarea className={input} rows={2} value={model.notes||''} onChange={e=>setModel({...model,notes:e.target.value})}/></label>
    <label className="flex gap-2 md:col-span-2"><input type="checkbox" checked={model.enabled} onChange={e=>setModel({...model,enabled:e.target.checked})}/>J’autorise ce modèle dans mon catalogue</label>
    <button className={button} disabled={mutation.isPending}>Enregistrer le modèle</button>
   </form>
   {Object.keys(props).length>0&&<details><summary className="cursor-pointer">Paramètres et capacités déclarés par le fournisseur</summary><div className="mt-3 grid gap-2 md:grid-cols-2">{Object.entries(props).map(([key,v])=><div className="rounded border border-white/10 p-3 text-sm" key={key}><strong>{key}</strong><p className="text-white/60">{v.description||v.title||v.type}{v.enum?` · ${v.enum.join(', ')}`:''}</p></div>)}</div></details>}
  </section>
  <section className="space-y-4"><h3 className="text-xl">Choix par outil et service</h3><Field label="Filtrer les services" value={filter} onChange={e=>setFilter(e.target.value)}/>{services.filter(s=>serviceLabel(s).toLowerCase().includes(filter.toLowerCase())).map(s=><details className={box} key={s}><summary className="cursor-pointer font-medium">{serviceLabel(s)} <span className="ml-3 text-sm text-white/50">{data.assignments.filter(a=>a.service===s&&a.enabled).length} étape(s) autorisée(s)</span></summary><div className="grid gap-4 md:grid-cols-2">{data.assignments.filter(a=>a.service===s).map(a=><Assignment key={`${a.route_key}:${a.revision}`} route={a} models={data.models} save={save} pending={mutation.isPending}/>)}</div></details>)}</section>
  <details className={box}><summary className="cursor-pointer">Historique de tes décisions</summary>{data.audit.length?data.audit.map(a=><p className="break-all text-sm text-white/60" key={a.id}>{new Date(a.created_at).toLocaleString('fr-CA')} · {a.entity_key} · révision {a.new_value?.revision}</p>):<p>Aucun choix enregistré.</p>}</details>
  <details className={box}><summary className="cursor-pointer">Derniers modèles réellement appelés</summary>{data.calls.length?data.calls.map(c=><p className="break-all text-sm text-white/60" key={c.id}>{new Date(c.created_at).toLocaleString('fr-CA')} · {c.model_key} · {c.status}</p>):<p>Aucun appel sous le nouveau contrôle.</p>}</details>
 </div>;
}
