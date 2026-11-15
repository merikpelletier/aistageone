import React, { useMemo, useState } from 'react';

// Revue statique du code du 15 novembre 2026. Elle ne démontre PAS un test de facturation réel.
// Toute fonction non revue reste explicitement "À vérifier".
const reviewed = {
  'invoke-llm': ['dynamic','Tarif dynamique pour l’assistant Studio ; les autres appels peuvent encore utiliser le tarif fixe.'],
  'generateVideo:video': ['dynamic','Réservation dynamique dans generateVideo.'],
  'generateVideo:kling': ['dynamic','Réservation dynamique dans generateVideo.'],
  'generateVideo:kling_morph': ['dynamic','Réservation dynamique dans generateVideo.'],
  'generateVideo:kling_video_edit': ['dynamic','Réservation dynamique dans generateVideo.'],
  'generateVideo:seedance': ['dynamic','Réservation dynamique dans generateVideo.'],
  'replicateGenerate:animate_image': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:animate_with_reference': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:body_and_voice': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:character_photo': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:character_sheet': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:compose_scene': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:faceswitch': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:headshot': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:lip_sync': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:reference_sheet_swap': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'replicateGenerate:text_to_video': ['dynamic','Réservation dynamique dans replicateGenerate.'],
  'generateBlockVideos': ['dynamic','Réservation dynamique dans generateBlockVideos.'],
  'generateStoryBlock': ['dynamic','Réservation dynamique dans generateStoryBlock.'],
  'generateCharacterSheet': ['dynamic','Réservation dynamique dans generateCharacterSheet.'],
  'regenerateNarration': ['dynamic','Réservation dynamique dans regenerateNarration, selon le parcours.'],
  'proposeStoryArc': ['dynamic','Réservation dynamique dans proposeStoryArc.'],
  'generateSpeech': ['dynamic','Réservation dynamique dans generateSpeech.'],
  'generate3d': ['dynamic','Cinq modèles 3D actifs, tarifs enregistrés et réservation dynamique locale. Le fonctionnement réel n’est pas testé ici.'],
  'rig3d': ['unverified','Modèle et tarif configurés, mais aucune fonction Supabase rig3d distincte n’a été trouvée parmi les fonctions déployées. La facturation de cette étape n’est pas confirmée.'], 
  'agent-conversations': ['dynamic','Devis par modèle et réservation dynamique avant chaque message.'],
  'transcribe-audio': ['dynamic','Devis de transcription par modèle et réservation dynamique avant appel.'],
  'mixAudioVideo': ['fixed','Réservation au tarif fixe dans mixAudioVideo.'],
  'generate-image': ['dynamic','Devis central avec tarif 2K de Nano Banana 2, puis réservation dynamique.'],
  'generate-speech': ['dynamic','Devis central basé sur le texte et réservation dynamique.'],
  'generatePitchSpeech': ['dynamic','Voix Pitch Deck : calcul du coût et réservation dynamique avant génération. Les fichiers en cache ne sont pas régénérés.'], 
  'generateMusic': ['dynamic','studioAudio.ts : devis central et réservation avant génération ; validation ou remboursement selon le résultat.'], 
  'generateSoundFx': ['dynamic','studioAudio.ts : devis central et réservation avant génération ; validation ou remboursement selon le résultat.'], 
  'checkStoryBlockPlan': ['unverified','Fonction auxiliaire ; facturation annoncée en amont, non vérifiée de bout en bout.'],
  'regenerateSegment': ['unverified','Fonction auxiliaire ; aucun débit dans le point d’entrée.'],
};

const statusMeta = {
  problem: { label:'Configuration manquante', css:'text-red-300' },
  fixed: { label:'Tarif fixe / à corriger', css:'text-amber-200' },
  unverified: { label:'Facturation non vérifiée', css:'text-amber-200' },
  dynamic: { label:'Raccordement dynamique détecté', css:'text-green-300' },
  unknown: { label:'Code non audité', css:'text-white/60' },
};
function statusFor(service, assignments, models, options) {
  const routes=assignments.filter(a=>a.service===service&&a.enabled);
  if(!routes.length)return {status:'problem', reason:'Aucune route de modèle active.'};
  const activeModels=new Map(models.filter(m=>m.enabled).map(m=>[m.model_key,m]));
  const eligible=routes.some(a=>{
    const configured=activeModels.get(a.model_key);
    const optionModels=options.filter(o=>o.route_key===a.route_key&&o.enabled).map(o=>activeModels.get(o.model_key));
    return [configured,...optionModels].some(m=>{
      // Les outils 3D utilisent des adaptateurs d'entrée propres au service,
      // et non le schéma Cog/Input exigé par le routeur texte/image.
      const supportedSchema = ['generate3d', 'rig3d'].includes(service)
        ? Boolean(m?.schema)
        : Boolean(m?.schema?.components?.schemas?.Input);
      return m&&supportedSchema&&m.billing_type&&m.unit_price_usd!=null&&m.cost_source_url&&(m.billing_type!=='tokens'||m.output_unit_price_usd!=null);
    });
  });
  if(!eligible)return {status:'problem',reason:'Aucun modèle actif avec schéma et tarif fournisseur complets.'};
  const [status, reason] = reviewed[service]||['unknown','Aucune vérification de code enregistrée.'];
  return {status,reason};
}

export default function AdminAIConnectionsAudit({data, serviceLabel}) {
  const [filter,setFilter]=useState('all');
  const rows=useMemo(()=>{
    const assignments=data.assignments||[];
    const services=[...new Set(assignments.map(a=>a.service))].sort();
    return services.map(service=>({
      service, label:serviceLabel(service),
      ...statusFor(service,assignments,data.models||[],data.route_options||[]),
      routes:assignments.filter(a=>a.service===service&&a.enabled).length,
    }));
  },[data,serviceLabel]);
  const count=kind=>rows.filter(r=>r.status===kind).length;
  const filtered=filter==='all'?rows:rows.filter(r=>r.status===filter);
  return <section className="rounded border border-white/15 bg-neutral-950 p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold">Diagnostic des raccordements IA</h3>
        <p className="text-xs text-white/55">État des routes et tarifs : données de Supabase. Facturation : revue statique du code du 15 novembre 2026, non équivalente à un test réel.</p>
      </div>
      <button type="button" onClick={()=>window.location.reload()} className="rounded border border-white/20 px-3 py-1.5 text-xs font-semibold">Actualiser</button>
    </div>
    <div className="flex flex-wrap gap-2 text-xs">
      {[
        ['all','Tous',rows.length],['problem','Configuration manquante',count('problem')],
        ['fixed','Tarif fixe',count('fixed')],['unverified','Non vérifié',count('unverified')],
        ['unknown','Non audité',count('unknown')],['dynamic','Dynamique détecté',count('dynamic')],
      ].map(([key,label,n])=><button key={key} type="button" onClick={()=>setFilter(key)}
        className={`rounded border px-3 py-2 ${filter===key?'border-white bg-white text-black':'border-white/20 text-white/75'}`}>{label} · {n}</button>)}
    </div>
    <div className="max-h-[520px] overflow-auto rounded border border-white/10">
      <table className="w-full min-w-[550px] text-left text-xs">
        <thead className="sticky top-0 bg-neutral-900 text-white/65"><tr><th className="p-3">Outil / service</th><th className="p-3">État</th><th className="p-3">Constat</th></tr></thead>
        <tbody>{filtered.map(r=><tr key={r.service} className="border-t border-white/10 align-top">
          <td className="p-3 font-semibold">{r.label}<div className="text-[10px] font-normal text-white/40">{r.service} · {r.routes} route(s)</div></td>
          <td className={`p-3 font-semibold ${statusMeta[r.status].css}`}>{statusMeta[r.status].label}</td>
          <td className="p-3 text-white/65">{r.reason}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="text-xs text-amber-100">« Raccordement dynamique détecté » n’est pas une garantie de facturation. Les statuts de code ne se mettent pas à jour automatiquement après un déploiement : une nouvelle revue reste nécessaire. Aucun outil n’est désactivé par ce tableau.</p>
  </section>;
}
