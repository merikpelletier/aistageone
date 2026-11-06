alter table public.ai_pilot_characters
add column if not exists reference_images jsonb not null default '[]'::jsonb;
