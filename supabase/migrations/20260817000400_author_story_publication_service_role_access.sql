-- Story Blocks Author publication is an authenticated Edge Function workflow.
-- The function verifies project ownership before using service_role for public writes.
grant select, insert, update on table public.timeline_story to service_role;
grant select, update on table public.author_story_project to service_role;
