import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { fetchTranslationDictionary } from '@/lib/translationDictionary';

const field = 'w-full border border-white/20 bg-neutral-950 px-3 py-2 text-sm text-white';
const langs = ['en','fr','es','it'];
function TranslationRow({entry,onSaved}) {
  const [translations,setTranslations] = useState(entry.translations || {});
  const [synonyms,setSynonyms] = useState(entry.synonyms || {});
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState('');
  const save = async () => {
    setSaving(true); setMessage('');
    const cleaned = Object.fromEntries(Object.entries(synonyms).map(([key,value])=>[key,Array.isArray(value)?value:[]]));
    const {error} = await supabase.from('translation_dictionary')
      .update({translations,synonyms:cleaned,updated_at:new Date().toISOString()})
      .eq('namespace',entry.namespace).eq('source_key',entry.source_key);
    setSaving(false);
    if(error) setMessage(error.message);
    else {setMessage('Enregistré');onSaved();}
  };
  return <div className="border border-white/15 bg-neutral-950 p-3 space-y-3">
    <div className="text-sm font-bold">{entry.source_key}<span className="ml-2 text-xs text-white/40">({entry.namespace})</span></div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {langs.map(lang=><label key={lang} className="text-xs text-white/60">{lang.toUpperCase()}
        <input className={field} value={translations[lang] || ''} onChange={e=>setTranslations(v=>({...v,[lang]:e.target.value}))} placeholder={lang==='en'?entry.source_key:''}/>
      </label>)}
    </div>
    <label className="block text-xs text-white/60">Synonymes français pour la recherche (séparés par des virgules)
      <input className={field} value={(synonyms.fr || []).join(', ')} onChange={e=>setSynonyms(v=>({...v,fr:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))}/>
    </label>
    <div className="flex items-center gap-3">
      <button type="button" onClick={save} disabled={saving} className="bg-white px-3 py-2 text-xs font-bold text-black disabled:opacity-50">{saving?'Enregistrement…':'Enregistrer'}</button>
      {message && <span role="status" className="text-xs text-teal-300">{message}</span>}
    </div>
  </div>;
}

export default function AdminTranslations() {
  const qc=useQueryClient();
  const [namespace,setNamespace]=useState('category');
  const [newKey,setNewKey]=useState('');
  const [creating,setCreating]=useState(false);
  const [message,setMessage]=useState('');
  const {data:entries=[],error}=useQuery({queryKey:['translationDictionary'],queryFn:fetchTranslationDictionary});
  const saveRefresh=()=>qc.invalidateQueries({queryKey:['translationDictionary']});
  const add = async () => {
    const name=newKey.trim();
    if(!name)return;
    setCreating(true);setMessage('');
    const {error:err}=await supabase.from('translation_dictionary').insert({namespace,source_key:name,translations:{en:name}});
    setCreating(false);
    if(err)setMessage(err.message);
    else {setNewKey('');saveRefresh();}
  };
  return <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold">Languages &amp; Translations</h2>
      <p className="mt-2 text-sm text-white/55">Les intitulés sont traduits sans changer les identifiants, les catégories des dossiers ni leurs liens. Les traductions manquantes utilisent l'anglais.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {[['category','Catégories'],['class','Classes'],['ui','Interface']].map(([key,label])=><button type="button" key={key} onClick={()=>setNamespace(key)} className={`border px-3 py-2 text-sm ${namespace===key?'bg-white text-black':'border-white/20 text-white'}`}>{label}</button>)}
    </div>
    {namespace==='ui' && <div className="flex gap-2">
      <input className={field} placeholder="Identifiant du nouveau libellé" value={newKey} onChange={e=>setNewKey(e.target.value)}/>
      <button type="button" onClick={add} disabled={creating} className="bg-white px-4 py-2 text-black text-sm">Ajouter</button>
    </div>}
    {message && <p role="status" className="text-sm text-red-300">{message}</p>}
    {error && <p role="alert" className="text-red-300">{error.message}</p>}
    <div className="space-y-3">{entries.filter(e=>e.namespace===namespace).sort((a,b)=>a.source_key.localeCompare(b.source_key)).map(entry=><TranslationRow key={entry.namespace+':'+entry.source_key} entry={entry} onSaved={saveRefresh}/>)}</div>
  </div>;
}
