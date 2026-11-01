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
      (new.id,'series-direction','theme_bible','Series Direction','{"tone":"","rules":"","locations":"","sets":"","audience":"","what_to_avoid":"","music":""}'::jsonb,array['fotoplay','set','compose','ai_video','dubbing','tts','music','sound_fx','timeline','layout','pitch'],10,10,true),
      (new.id,'visual-direction','look_bible','Visual Direction','{"text":""}'::jsonb,array['fotoplay','actor','set','compose','ai_video','layout','pitch'],20,20,true),
      (new.id,'performance-dialogue','performance_direction','Performance & Dialogue','{"text":""}'::jsonb,array['fotoplay','actor','compose','ai_video','dubbing','tts','lip_sync'],30,30,true),
      (new.id,'story-structure','episode_structure','Story Structure','{"text":""}'::jsonb,array['fotoplay','timeline','pitch'],40,40,true),
      (new.id,'continuity-rules','continuity_rules','Continuity Rules','{"text":""}'::jsonb,array['fotoplay','actor','set','compose','ai_video','dubbing','tts','lip_sync','timeline','layout'],50,50,true)
    on conflict (version_id, block_key) do nothing;
  end if;
  return new;
end;
$$;

update public.ai_pilot_blocks b
set content = jsonb_build_object(
  'tone', coalesce(b.content->>'tone',''),
  'rules', coalesce(b.content->>'rules',''),
  'locations', coalesce(b.content->>'locations',''),
  'sets', coalesce(b.content->>'sets',''),
  'audience', coalesce(b.content->>'audience',''),
  'what_to_avoid', coalesce(b.content->>'what_to_avoid',''),
  'music', coalesce(b.content->>'music','')
), title='Series Direction', block_type='theme_bible', priority=10, sort_order=10,
    tool_targets=array['fotoplay','set','compose','ai_video','dubbing','tts','music','sound_fx','timeline','layout','pitch'], is_active=true
from public.ai_pilot_versions v
where b.version_id=v.id and v.is_published=false and b.block_key='series-direction';

update public.ai_pilot_blocks b set is_active=true, title='Visual Direction', priority=20, sort_order=20
from public.ai_pilot_versions v where b.version_id=v.id and v.is_published=false and b.block_key='visual-direction';
update public.ai_pilot_blocks b set is_active=true, title='Performance & Dialogue', priority=30, sort_order=30
from public.ai_pilot_versions v where b.version_id=v.id and v.is_published=false and b.block_key='performance-dialogue';
update public.ai_pilot_blocks b set is_active=true, title='Story Structure', priority=40, sort_order=40
from public.ai_pilot_versions v where b.version_id=v.id and v.is_published=false and b.block_key='story-structure';
update public.ai_pilot_blocks b set is_active=true, title='Continuity Rules', priority=50, sort_order=50
from public.ai_pilot_versions v where b.version_id=v.id and v.is_published=false and b.block_key='continuity-rules';

update public.ai_pilot_blocks b set is_active=false
from public.ai_pilot_versions v
where b.version_id=v.id and v.is_published=false
  and b.block_key in ('tone','rules','locations','sets','audience','what-to-avoid','music','production-direction','performance-direction','voice-dialogue-direction','music-direction','sound-direction');
