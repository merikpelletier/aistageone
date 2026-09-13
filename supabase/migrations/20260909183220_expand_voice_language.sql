-- Voice language is production metadata, separate from narrative memory.
alter table public.story_session add column if not exists narrator_language text not null default 'en';
notify pgrst, 'reload schema';
