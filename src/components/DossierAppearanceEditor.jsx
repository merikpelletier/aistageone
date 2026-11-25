import React from 'react';
import { THEMES,FONTS,INDEX_STYLES,resolveAppearance,appearanceStyle } from '@/lib/dossierAppearance';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
export default function DossierAppearanceEditor({value,onChange,title,onUpload,uploading}){
 const t=useStudioTranslation();
 const a=resolveAppearance(value);
 const set=(key,v)=>onChange({...value,[key]:v});
 const selectClass='w-full rounded border border-white/20 bg-[#181a1e] p-2 text-sm text-white';
 return <section className="mt-6 border-t border-white/10 pt-5 space-y-3">
  <h3 className="text-[11px] font-bold uppercase tracking-[0.13em] text-teal-300">{t('Dossier appearance','Dossier appearance')}</h3>
  <label className="block text-xs text-white/70">{t('Visual theme','Visual theme')}<select className={selectClass} value={a?.preset||''} onChange={e=>onChange(e.target.value?{preset:e.target.value}:null)}><option value="">{t('Original appearance','Original appearance')}</option>{Object.entries(THEMES).map(([key,v])=><option key={key} value={key}>{t(v.label,v.label)}</option>)}</select></label>
  {a&&<div className="grid gap-4 md:grid-cols-[1fr_1fr]">
   <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">{[['background','Background color'],['secondary','Secondary color'],['text','Text color'],['accent','Accent color']].map(([key,label])=><label key={key} className="flex items-center gap-2 text-xs text-white/70"><input type="color" className="h-9 w-10 cursor-pointer bg-transparent" value={a[key]} onChange={e=>set(key,e.target.value)}/>{t(label,label)}</label>)}</div>
    { [['titleFont','Title font'],['bodyFont','Body font']].map(([key,label])=><label key={key} className="block text-xs text-white/70">{t(label,label)}<select className={selectClass} value={a[key]} onChange={e=>set(key,e.target.value)}>{Object.entries(FONTS).map(([id,f])=><option key={id} value={id}>{t(f.label,f.label)}</option>)}</select></label>)}
    <label className="block text-xs text-white/70">{t('Index style','Index style')}<select className={selectClass} value={a.indexStyle} onChange={e=>set('indexStyle',e.target.value)}>{Object.entries(INDEX_STYLES).map(([id,label])=><option key={id} value={id}>{t(label,label)}</option>)}</select></label>
    <label className="block text-xs text-white/70">{t('Background image','Background image')}<input type="file" accept="image/*" disabled={uploading} onChange={onUpload} className="block w-full text-xs mt-2"/></label>
    {a.backgroundImage&&<button type="button" onClick={()=>set('backgroundImage','')} className="text-xs underline">{t('Remove background image','Remove background image')}</button>}
   </div>
   <div><p className="mb-2 text-xs text-white/70">{t('Appearance preview','Appearance preview')}</p><div style={appearanceStyle(a)} className="rounded-xl p-5 min-h-[240px]">
    <h4 className="text-2xl font-bold" style={{fontFamily:'var(--dossier-title-font)'}}>{title||t('Contents','Contents')}</h4>
    <div className={a.indexStyle==='mosaic'?'mt-4 grid grid-cols-2 gap-2':'mt-4 grid gap-2'}>{['Watch','Questions'].map((label,i)=><div key={label} style={{background:a.secondary,borderRadius:a.radius}} className="p-3 flex items-center gap-3"><span style={{background:a.accent,color:'var(--dossier-accent-text)',borderRadius:a.radius}} className="grid w-10 h-10 shrink-0 place-items-center text-lg">{i?'?':'▶'}</span><b>{t(label,label)}</b></div>)}</div>
    <div className="mt-4 inline-block px-4 py-2 font-bold" style={{background:a.accent,color:'var(--dossier-accent-text)',borderRadius:a.radius}}>{t('Open','Open')} →</div>
   </div></div>
  </div>}
 </section>;
}
