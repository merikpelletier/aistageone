create or replace function public.seed_ai_pilot_v1_blocks()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.version_number = 1 then
    insert into public.ai_pilot_blocks (version_id, block_key, block_type, title, content, tool_targets, priority, sort_order, is_active)
    values
      (new.id,'series-direction','theme_bible','Series Direction','{"tone":"","rules":"","locations":"","sets":"","audience":"","what_to_avoid":""}'::jsonb,array['fotoplay','set','compose','shoot','dubbing','tts','sound_fx','timeline','layout'],10,10,true),
      (new.id,'visual-direction','look_bible','Visual Direction','{"text":""}'::jsonb,array['fotoplay','actor','set','compose','shoot','layout'],20,20,true),
      (new.id,'looks','custom','Looks','{"looks":[]}'::jsonb,array['fotoplay','actor','compose','shoot','layout'],30,30,true),
      (new.id,'story-structure','episode_structure','Story Structure','{"text":""}'::jsonb,array['fotoplay','shoot','timeline'],40,40,true),
      (new.id,'music-direction','music_direction','Music','{"text":""}'::jsonb,array['music','fotoplay','shoot','timeline'],50,50,true),
      (new.id,'action-prompts','prompt_override','Action Prompts — one per line','{"text":""}'::jsonb,array['compose_scene'],60,60,true),
      (new.id,'blocking-prompts','prompt_override','Blocking Prompts — one per line','{"text":""}'::jsonb,array['compose_scene'],70,70,true)
    on conflict (version_id, block_key) do nothing;
  end if;
  return new;
end;
$function$;

insert into public.ai_pilot_blocks (version_id, block_key, block_type, title, content, tool_targets, priority, sort_order, is_active)
select v.id, 'action-prompts', 'prompt_override', 'Action Prompts — one per line', '{"text":""}'::jsonb, array['compose_scene'], 60, 60, true
from public.ai_pilot_versions v
where not exists (
  select 1 from public.ai_pilot_blocks b where b.version_id = v.id and b.block_key = 'action-prompts'
);

insert into public.ai_pilot_blocks (version_id, block_key, block_type, title, content, tool_targets, priority, sort_order, is_active)
select v.id, 'blocking-prompts', 'prompt_override', 'Blocking Prompts — one per line', '{"text":""}'::jsonb, array['compose_scene'], 70, 70, true
from public.ai_pilot_versions v
where not exists (
  select 1 from public.ai_pilot_blocks b where b.version_id = v.id and b.block_key = 'blocking-prompts'
);
