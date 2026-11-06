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
      (new.id,'looks','custom','Looks','{"costume":"","makeup":"","hair":""}'::jsonb,array['fotoplay','actor','compose','shoot','layout'],30,30,true),
      (new.id,'story-structure','episode_structure','Story Structure','{"text":""}'::jsonb,array['fotoplay','shoot','timeline'],40,40,true),
      (new.id,'music-direction','music_direction','Music','{"text":""}'::jsonb,array['music','fotoplay','shoot','timeline'],50,50,true)
    on conflict (version_id, block_key) do nothing;
  end if;
  return new;
end;
$$;

insert into public.ai_pilot_blocks (version_id, block_key, block_type, title, content, tool_targets, priority, sort_order, is_active)
select v.id,
       'looks',
       'custom',
       'Looks',
       '{"costume":"","makeup":"","hair":""}'::jsonb,
       array['fotoplay','actor','compose','shoot','layout'],
       30,
       30,
       true
from public.ai_pilot_versions v
where v.is_published = false
on conflict (version_id, block_key) do update
set title = excluded.title,
    block_type = excluded.block_type,
    tool_targets = excluded.tool_targets,
    priority = excluded.priority,
    sort_order = excluded.sort_order,
    is_active = true;

insert into public.ai_pilot_blocks (version_id, block_key, block_type, title, content, tool_targets, priority, sort_order, is_active)
select v.id,
       'music-direction',
       'music_direction',
       'Music',
       jsonb_build_object('text', coalesce(sd.content->>'music','')),
       array['music','fotoplay','shoot','timeline'],
       50,
       50,
       true
from public.ai_pilot_versions v
left join public.ai_pilot_blocks sd on sd.version_id = v.id and sd.block_key = 'series-direction'
where v.is_published = false
on conflict (version_id, block_key) do update
set title = excluded.title,
    block_type = excluded.block_type,
    tool_targets = excluded.tool_targets,
    priority = excluded.priority,
    sort_order = excluded.sort_order,
    is_active = true,
    content = case
      when coalesce(public.ai_pilot_blocks.content->>'text','') = '' then excluded.content
      else public.ai_pilot_blocks.content
    end;

update public.ai_pilot_blocks b
set content = b.content - 'music',
    tool_targets = array['fotoplay','set','compose','shoot','dubbing','tts','sound_fx','timeline','layout'],
    priority = 10,
    sort_order = 10
from public.ai_pilot_versions v
where b.version_id = v.id and v.is_published = false and b.block_key = 'series-direction';

update public.ai_pilot_blocks b
set title = 'Visual Direction',
    block_type = 'look_bible',
    tool_targets = array['fotoplay','actor','set','compose','shoot','layout'],
    priority = 20,
    sort_order = 20,
    is_active = true
from public.ai_pilot_versions v
where b.version_id = v.id and v.is_published = false and b.block_key = 'visual-direction';

update public.ai_pilot_blocks b
set tool_targets = array['fotoplay','shoot','timeline'],
    priority = 40,
    sort_order = 40,
    is_active = true
from public.ai_pilot_versions v
where b.version_id = v.id and v.is_published = false and b.block_key = 'story-structure';

update public.ai_pilot_blocks b
set is_active = false
from public.ai_pilot_versions v
where b.version_id = v.id and v.is_published = false
  and b.block_key = 'continuity-rules';