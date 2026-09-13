-- Additive project-level production settings for Story Blocks Author.
-- Existing projects remain valid and receive an empty private settings object.
alter table public.author_story_project
  add column if not exists production_settings jsonb not null default '{}'::jsonb;

comment on column public.author_story_project.production_settings is
  'Private Story Blocks Author production configuration, including the locked narrator voice.';

