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
      (new.id,'series-direction','theme_bible','Series Direction','{"text":""}'::jsonb,array['fotoplay','compose','ai_video','music','sound_fx','pitch'],10,10,true),
      (new.id,'visual-direction','look_bible','Visual Direction','{"text":""}'::jsonb,array['fotoplay','actor','set','compose','ai_video','layout','pitch'],20,20,true),
      (new.id,'production-direction','production_direction','Production Direction','{"text":""}'::jsonb,array['fotoplay','set','compose','ai_video','timeline','layout','pitch'],30,30,true),
      (new.id,'performance-direction','performance_direction','Performance Direction','{"text":""}'::jsonb,array['actor','compose','ai_video','dubbing','lip_sync'],40,40,true),
      (new.id,'voice-dialogue-direction','voice_dialogue_direction','Voice / Dialogue Direction','{"text":""}'::jsonb,array['fotoplay','compose','ai_video','dubbing','tts','lip_sync'],50,50,true),
      (new.id,'music-direction','music_direction','Music Direction','{"text":""}'::jsonb,array['music','fotoplay','ai_video','timeline'],60,60,true),
      (new.id,'sound-direction','sound_direction','Sound Direction','{"text":""}'::jsonb,array['sound_fx','fotoplay','ai_video','timeline','dubbing'],70,70,true),
      (new.id,'story-structure','episode_structure','Story Structure','{"text":""}'::jsonb,array['fotoplay','timeline','pitch'],80,80,true),
      (new.id,'continuity-rules','continuity_rules','Continuity Rules','{"text":""}'::jsonb,array['fotoplay','actor','set','compose','ai_video','dubbing','tts','lip_sync','timeline','layout'],90,90,true)
    on conflict (version_id, block_key) do nothing;
  end if;
  return new;
end;
$$;

update public.ai_pilot_blocks b
set block_key = 'series-direction',
    title = 'Series Direction',
    tool_targets = array['fotoplay','compose','ai_video','music','sound_fx','pitch'],
    sort_order = 10,
    priority = 10
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type = 'theme_bible'
  and b.block_key = 'theme-bible';

update public.ai_pilot_blocks b
set block_key = 'visual-direction',
    title = 'Visual Direction',
    tool_targets = array['fotoplay','actor','set','compose','ai_video','layout','pitch'],
    sort_order = 20,
    priority = 20
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type = 'look_bible'
  and b.block_key = 'look-bible';

update public.ai_pilot_blocks b
set tool_targets = array['fotoplay','set','compose','ai_video','timeline','layout','pitch']
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type = 'production_direction';

update public.ai_pilot_blocks b
set tool_targets = array['actor','compose','ai_video','dubbing','lip_sync']
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type = 'performance_direction';

update public.ai_pilot_blocks b
set tool_targets = array['fotoplay','compose','ai_video','dubbing','tts','lip_sync']
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type = 'voice_dialogue_direction';

update public.ai_pilot_blocks b
set tool_targets = array['music','fotoplay','ai_video','timeline']
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type = 'music_direction';

update public.ai_pilot_blocks b
set tool_targets = array['sound_fx','fotoplay','ai_video','timeline','dubbing']
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type = 'sound_direction';

update public.ai_pilot_blocks b
set block_key = 'story-structure',
    title = 'Story Structure',
    tool_targets = array['fotoplay','timeline','pitch'],
    sort_order = 80,
    priority = 80
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type = 'episode_structure'
  and b.block_key = 'episode-structure';

delete from public.ai_pilot_blocks b
using public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_type in ('assets','tool_direction')
  and coalesce(nullif(trim(b.content->>'text'),''),'') = '';
