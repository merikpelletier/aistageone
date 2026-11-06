update public.ai_pilot_blocks b
set content = jsonb_build_object(
  'music_style', coalesce(b.content->>'music_style', ''),
  'mood', coalesce(b.content->>'mood', ''),
  'tempo', coalesce(b.content->>'tempo', ''),
  'instrumentation', coalesce(b.content->>'instrumentation', ''),
  'music_role', coalesce(b.content->>'music_role', ''),
  'references', coalesce(b.content->>'references', ''),
  'music_notes', coalesce(nullif(b.content->>'music_notes', ''), b.content->>'text', '')
)
from public.ai_pilot_versions v
where b.version_id = v.id
  and v.is_published = false
  and b.block_key = 'music-direction';
