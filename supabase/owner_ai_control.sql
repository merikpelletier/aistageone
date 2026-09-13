create table public.ai_model_catalog (
 model_key text primary key check (model_key ~ '^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$' and lower(model_key) <> 'bytedance/seedream-4.5'),
 provider text not null default 'replicate' check(provider='replicate'),
 name text not null,
 kind text not null check(kind in ('text','image','video','speech','transcription','audio','processing')),
 description text not null default '',
 schema jsonb not null default '{}',
 version_id text,
 billing_type text check(billing_type in ('prediction','characters','output_seconds','runtime_seconds','tokens')),
 unit_price_usd numeric check(unit_price_usd>=0 and unit_price_usd<1000000),
 output_unit_price_usd numeric check(output_unit_price_usd>=0 and output_unit_price_usd<1000000),
 cost_source_url text,
 cost_checked_at timestamptz,
 capabilities jsonb not null default '{}',
 notes text not null default '',
 enabled boolean not null default false,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 check (not enabled or (unit_price_usd is not null and billing_type is not null and cost_source_url is not null and schema ? 'components'))
);
create table public.ai_model_assignment (
 route_key text primary key,
 service text not null,
 label text not null,
 source_model text not null,
 kind text not null,
 model_key text references public.ai_model_catalog(model_key),
 enabled boolean not null default false,
 input_mapping jsonb not null default '{}',
 defaults jsonb not null default '{}',
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 check(not enabled or model_key is not null)
);
create table public.ai_model_audit (
 id uuid primary key default gen_random_uuid(),
 entity text not null,
 entity_key text not null,
 previous_value jsonb,
 new_value jsonb not null,
 actor uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.ai_model_call (
 id uuid primary key default gen_random_uuid(),
 route_key text not null,
 request_id uuid not null,
 model_key text not null,
 assignment_revision integer not null,
 rate_snapshot jsonb,
 prediction_id text,
 status text not null,
 created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['ai_model_catalog','ai_model_assignment','ai_model_audit','ai_model_call'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = %L::uuid)',t,'fd3ceec1-0d99-4d7e-9793-284e342efe90');
 end loop;
end $$;
grant insert,update on public.ai_model_catalog,public.ai_model_assignment to authenticated;
grant insert on public.ai_model_audit to authenticated;
grant insert,update on public.ai_model_call to service_role;
create policy owner_insert_catalog on public.ai_model_catalog for insert to authenticated with check ((select auth.uid())='fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid);
create policy owner_update_catalog on public.ai_model_catalog for update to authenticated using ((select auth.uid())='fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid) with check ((select auth.uid())='fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid);
create policy owner_insert_assignment on public.ai_model_assignment for insert to authenticated with check ((select auth.uid())='fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid);
create policy owner_update_assignment on public.ai_model_assignment for update to authenticated using ((select auth.uid())='fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid) with check ((select auth.uid())='fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid);
create policy owner_insert_audit on public.ai_model_audit for insert to authenticated with check ((select auth.uid())='fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid and actor=(select auth.uid()));
create function public.ai_model_save(p_entity text,p_key text,p_value jsonb,p_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare before_row jsonb; after_row jsonb; owner_id uuid:=auth.uid();
begin
 if owner_id is distinct from 'fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid then raise exception 'Seul Merik peut choisir les modèles IA' using errcode='42501'; end if;
 if p_entity='model' then
  select to_jsonb(c) into before_row from public.ai_model_catalog c where model_key=p_key for update;
  if coalesce((before_row->>'revision')::integer,0)<>p_revision then raise exception 'La configuration a changé; rechargez'; end if;
  insert into public.ai_model_catalog(model_key,name,kind,description,schema,version_id,billing_type,unit_price_usd,output_unit_price_usd,cost_source_url,cost_checked_at,capabilities,notes,enabled,revision,updated_by)
  values(p_key,p_value->>'name',p_value->>'kind',coalesce(p_value->>'description',''),coalesce(p_value->'schema','{}'),p_value->>'version_id',p_value->>'billing_type',(p_value->>'unit_price_usd')::numeric,(p_value->>'output_unit_price_usd')::numeric,p_value->>'cost_source_url',(p_value->>'cost_checked_at')::timestamptz,coalesce(p_value->'capabilities','{}'),coalesce(p_value->>'notes',''),coalesce((p_value->>'enabled')::boolean,false),p_revision+1,owner_id)
  on conflict(model_key) do update set name=excluded.name,kind=excluded.kind,description=excluded.description,schema=excluded.schema,version_id=excluded.version_id,billing_type=excluded.billing_type,unit_price_usd=excluded.unit_price_usd,output_unit_price_usd=excluded.output_unit_price_usd,cost_source_url=excluded.cost_source_url,cost_checked_at=excluded.cost_checked_at,capabilities=excluded.capabilities,notes=excluded.notes,enabled=excluded.enabled,revision=excluded.revision,updated_at=now(),updated_by=owner_id;
  select to_jsonb(c) into after_row from public.ai_model_catalog c where model_key=p_key;
 elsif p_entity='assignment' then
  select to_jsonb(a) into before_row from public.ai_model_assignment a where route_key=p_key for update;
  if before_row is null or (before_row->>'revision')::integer<>p_revision then raise exception 'La configuration a changé; rechargez'; end if;
  if coalesce((p_value->>'enabled')::boolean,false) and not exists(select 1 from public.ai_model_catalog c where c.model_key=p_value->>'model_key' and c.enabled and c.kind=before_row->>'kind') then raise exception 'Choisissez un modèle actif du bon type'; end if;
  update public.ai_model_assignment set model_key=nullif(p_value->>'model_key',''),enabled=coalesce((p_value->>'enabled')::boolean,false),input_mapping=coalesce(p_value->'input_mapping','{}'),defaults=coalesce(p_value->'defaults','{}'),revision=revision+1,updated_at=now(),updated_by=owner_id where route_key=p_key;
  select to_jsonb(a) into after_row from public.ai_model_assignment a where route_key=p_key;
 else raise exception 'Type inconnu'; end if;
 insert into public.ai_model_audit(entity,entity_key,previous_value,new_value,actor) values(p_entity,p_key,before_row,after_row,owner_id);
 return after_row;
end $$;
revoke all on function public.ai_model_save(text,text,jsonb,integer) from public,anon;
grant execute on function public.ai_model_save(text,text,jsonb,integer) to authenticated;

insert into public.ai_model_assignment(route_key,service,label,source_model,kind) values
('agent-conversations|openai/gpt-5.6-terra','agent-conversations','agent-conversations','openai/gpt-5.6-terra','text'),
('agent-conversations|openai/gpt-5.6-luna','agent-conversations','agent-conversations','openai/gpt-5.6-luna','text'),
('agent-conversations|minimax/speech-2.8-hd','agent-conversations','agent-conversations','minimax/speech-2.8-hd','speech'),
('agent-conversations|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','agent-conversations','agent-conversations','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('checkStoryBlockPlan|openai/gpt-5-mini','checkStoryBlockPlan','checkStoryBlockPlan','openai/gpt-5-mini','text'),
('checkStoryBlockPlan|meta/llama-4-maverick-instruct','checkStoryBlockPlan','checkStoryBlockPlan','meta/llama-4-maverick-instruct','text'),
('checkStoryBlockPlan|minimax/speech-2.8-hd','checkStoryBlockPlan','checkStoryBlockPlan','minimax/speech-2.8-hd','speech'),
('checkStoryBlockPlan|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','checkStoryBlockPlan','checkStoryBlockPlan','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('generate-image|google/nano-banana-2','generate-image','generate-image','google/nano-banana-2','image'),
('generate-speech|openai/gpt-5.6-terra','generate-speech','generate-speech','openai/gpt-5.6-terra','text'),
('generate-speech|minimax/speech-2.8-hd','generate-speech','generate-speech','minimax/speech-2.8-hd','speech'),
('generate-speech|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','generate-speech','generate-speech','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('generateBlockVideos|kwaivgi/kling-v2.6','generateBlockVideos','generateBlockVideos','kwaivgi/kling-v2.6','video'),
('generateBlockVideos|google/nano-banana-2','generateBlockVideos','generateBlockVideos','google/nano-banana-2','image'),
('generateBlockVideos|openai/gpt-5-mini','generateBlockVideos','generateBlockVideos','openai/gpt-5-mini','text'),
('generateBlockVideos|meta/llama-4-maverick-instruct','generateBlockVideos','generateBlockVideos','meta/llama-4-maverick-instruct','text'),
('generateBlockVideos|elevenlabs/v3','generateBlockVideos','generateBlockVideos','elevenlabs/v3','speech'),
('generateBlockVideos|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','generateBlockVideos','generateBlockVideos','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('generateCharacterSheet|bytedance/seedream-4.5','generateCharacterSheet','generateCharacterSheet','bytedance/seedream-4.5','image'),
('generatePitchSpeech|openai/gpt-5-mini','generatePitchSpeech','generatePitchSpeech','openai/gpt-5-mini','text'),
('generatePitchSpeech|meta/llama-4-maverick-instruct','generatePitchSpeech','generatePitchSpeech','meta/llama-4-maverick-instruct','text'),
('generatePitchSpeech|elevenlabs/v3','generatePitchSpeech','generatePitchSpeech','elevenlabs/v3','speech'),
('generatePitchSpeech|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','generatePitchSpeech','generatePitchSpeech','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('generateSpeech|openai/gpt-5-mini','generateSpeech','generateSpeech','openai/gpt-5-mini','text'),
('generateSpeech|meta/llama-4-maverick-instruct','generateSpeech','generateSpeech','meta/llama-4-maverick-instruct','text'),
('generateSpeech|elevenlabs/v3','generateSpeech','generateSpeech','elevenlabs/v3','speech'),
('generateSpeech|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','generateSpeech','generateSpeech','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('generateStoryBlock|openai/gpt-5-mini','generateStoryBlock','generateStoryBlock','openai/gpt-5-mini','text'),
('generateStoryBlock|meta/llama-4-maverick-instruct','generateStoryBlock','generateStoryBlock','meta/llama-4-maverick-instruct','text'),
('generateStoryBlock|minimax/speech-2.8-hd','generateStoryBlock','generateStoryBlock','minimax/speech-2.8-hd','speech'),
('generateStoryBlock|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','generateStoryBlock','generateStoryBlock','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('generateVideo:seedance|bytedance/seedance-1-lite','generateVideo:seedance','generateVideo:seedance','bytedance/seedance-1-lite','video'),
('generateVideo:kling|kwaivgi/kling-v1.6-standard','generateVideo:kling','generateVideo:kling','kwaivgi/kling-v1.6-standard','video'),
('generateVideo:kling_morph|kwaivgi/kling-v2.6','generateVideo:kling_morph','generateVideo:kling_morph','kwaivgi/kling-v2.6','video'),
('invoke-llm|openai/gpt-5.6-terra','invoke-llm','invoke-llm','openai/gpt-5.6-terra','text'),
('invoke-llm|minimax/speech-2.8-hd','invoke-llm','invoke-llm','minimax/speech-2.8-hd','speech'),
('invoke-llm|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','invoke-llm','invoke-llm','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('mixAudioVideo|version:8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109','mixAudioVideo','mixAudioVideo','version:8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109','processing'),
('proposeStoryArc|openai/gpt-5-mini','proposeStoryArc','proposeStoryArc','openai/gpt-5-mini','text'),
('proposeStoryArc|meta/llama-4-maverick-instruct','proposeStoryArc','proposeStoryArc','meta/llama-4-maverick-instruct','text'),
('proposeStoryArc|minimax/speech-2.8-hd','proposeStoryArc','proposeStoryArc','minimax/speech-2.8-hd','speech'),
('proposeStoryArc|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','proposeStoryArc','proposeStoryArc','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('regenerateNarration|openai/gpt-5-mini','regenerateNarration','regenerateNarration','openai/gpt-5-mini','text'),
('regenerateNarration|meta/llama-4-maverick-instruct','regenerateNarration','regenerateNarration','meta/llama-4-maverick-instruct','text'),
('regenerateNarration|elevenlabs/v3','regenerateNarration','regenerateNarration','elevenlabs/v3','speech'),
('regenerateNarration|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','regenerateNarration','regenerateNarration','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('replicateGenerate:body_and_voice|kwaivgi/kling-v3-omni-video','replicateGenerate:body_and_voice','replicateGenerate:body_and_voice','kwaivgi/kling-v3-omni-video','video'),
('replicateGenerate:faceswitch|version:278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34','replicateGenerate:faceswitch','replicateGenerate:faceswitch','version:278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34','processing'),
('replicateGenerate:faceswitch|version:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c','replicateGenerate:faceswitch','replicateGenerate:faceswitch','version:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c','processing'),
('replicateGenerate:faceswitch|version:8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109','replicateGenerate:faceswitch','replicateGenerate:faceswitch','version:8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109','processing'),
('replicateGenerate:faceswitch|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','replicateGenerate:faceswitch','replicateGenerate:faceswitch','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('replicateGenerate:character_photo|bytedance/seedream-4.5','replicateGenerate:character_photo','replicateGenerate:character_photo','bytedance/seedream-4.5','image'),
('replicateGenerate:reference_sheet_swap|bytedance/seedream-4.5','replicateGenerate:reference_sheet_swap','replicateGenerate:reference_sheet_swap','bytedance/seedream-4.5','image'),
('replicateGenerate:character_sheet|bytedance/seedream-4.5','replicateGenerate:character_sheet','replicateGenerate:character_sheet','bytedance/seedream-4.5','image'),
('replicateGenerate:animate_image|kwaivgi/kling-v2.6','replicateGenerate:animate_image','replicateGenerate:animate_image','kwaivgi/kling-v2.6','video'),
('replicateGenerate:animate_image|version:278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34','replicateGenerate:animate_image','replicateGenerate:animate_image','version:278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34','processing'),
('replicateGenerate:animate_image|version:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c','replicateGenerate:animate_image','replicateGenerate:animate_image','version:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c','processing'),
('replicateGenerate:animate_image|version:8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109','replicateGenerate:animate_image','replicateGenerate:animate_image','version:8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109','processing'),
('replicateGenerate:animate_image|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','replicateGenerate:animate_image','replicateGenerate:animate_image','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription'),
('replicateGenerate:animate_with_reference|kwaivgi/kling-v2.6-motion-control','replicateGenerate:animate_with_reference','replicateGenerate:animate_with_reference','kwaivgi/kling-v2.6-motion-control','video'),
('replicateGenerate:lip_sync|kwaivgi/kling-lip-sync','replicateGenerate:lip_sync','replicateGenerate:lip_sync','kwaivgi/kling-lip-sync','video'),
('replicateGenerate:headshot|google/nano-banana-2','replicateGenerate:headshot','replicateGenerate:headshot','google/nano-banana-2','image'),
('replicateGenerate:compose_scene|bytedance/seedream-4.5','replicateGenerate:compose_scene','replicateGenerate:compose_scene','bytedance/seedream-4.5','image'),
('replicateGenerate:text_to_video|kwaivgi/kling-v2.6','replicateGenerate:text_to_video','replicateGenerate:text_to_video','kwaivgi/kling-v2.6','video'),
('transcribe-audio|openai/gpt-5.6-terra','transcribe-audio','transcribe-audio','openai/gpt-5.6-terra','text'),
('transcribe-audio|minimax/speech-2.8-hd','transcribe-audio','transcribe-audio','minimax/speech-2.8-hd','speech'),
('transcribe-audio|version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcribe-audio','transcribe-audio','version:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e','transcription');
