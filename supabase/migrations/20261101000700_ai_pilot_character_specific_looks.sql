create or replace function public.seed_ai_pilot_v1_blocks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.version_number = 1 then
    insert into public.ai_pilot_blocks (version_id, block_key, block_type, title, content, tool_targets, priority, sort_order, is_active)
    values
      (new.id,'series-direction','theme_bible','Series Direction','{"tone":"","rules":"","locations":"","sets":"","audience":"","what_to_avoid":""}'::jsonb,array['fotoplay','set','compose','shoot','dubbing','tts','sound_fx','timeline','layout'],10,10,true),
      (new.id,'visual-direction','look_bible','Visual Direction','{"text":""}'::jsonb,array['fotoplay','actor','set','compose','shoot','layout'],20,20,true),
      (new.id,'looks','custom','Looks','{"looks":[]}'::jsonb,array['fotoplay','actor','compose','shoot','layout'],30,30,true),
      (new.id,'story-structure','episode_structure','Story Structure','{"text":""}'::jsonb,array['fotoplay','shoot','timeline'],40,40,true),
      (new.id,'music-direction','music_direction','Music','{"text":""}'::jsonb,array['music','fotoplay','shoot','timeline'],50,50,true)
    on conflict (version_id, block_key) do nothing;
  end if;
  return new;
end;
$$;

update public.ai_pilot_blocks b
set content = case
      when jsonb_typeof(b.content->'looks') = 'array' then b.content
      else jsonb_build_object('looks', '[]'::jsonb)
    end,
    title = 'Looks',
    block_type = 'custom',
    tool_targets = array['fotoplay','actor','compose','shoot','layout'],
    priority = 30,
    sort_order = 30,
    is_active = true
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_key = 'looks';
