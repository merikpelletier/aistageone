begin;
create table if not exists public.studio_audio_job (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  tool text not null check (tool in ('music','sound_fx')),
  title text not null,
  input jsonb not null,
  format text not null check (format in ('mp3','wav')),
  status text not null check (status in ('submitting','processing','finalizing','succeeded','failed')),
  prediction_id text unique,
  callback_token text not null unique,
  charge jsonb,
  file_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_audio_job_owner_history on public.studio_audio_job(user_id,tool,created_at desc);
alter table public.studio_audio_job enable row level security;
-- All access goes through the authenticated Edge Functions. Callback secrets
-- must never be selectable through the browser's Data API.
revoke all on public.studio_audio_job from public, anon, authenticated;
grant all on public.studio_audio_job to service_role;
-- Merik selected these exact models; preserve all subsequent Admin changes.
insert into public.ai_model_assignment(route_key,service,label,source_model,kind,model_key,enabled)
values
 ('generateMusic|minimax/music-2.6','generateMusic','Studio — Music','minimax/music-2.6','audio','minimax/music-2.6',true),
 ('generateSoundFx|sepal/audiogen','generateSoundFx','Studio — Sound FX','sepal/audiogen','audio','sepal/audiogen',true)
on conflict (route_key) do nothing;
insert into public.tool_pricing(tool_id,tool_name,token_cost,is_active,category)
select 'music','Music',1,true,'audio'
where not exists (select 1 from public.tool_pricing where tool_id='music');
-- Sound FX price is deliberately not invented. The deployment script asks
-- Merik for it, or preserves an existing value.
insert into public.tool_pricing(tool_id,tool_name,token_cost,is_active,category)
select 'sound_fx','Sound FX',null,true,'audio'
where not exists (select 1 from public.tool_pricing where tool_id='sound_fx');
notify pgrst,'reload schema';
commit;
