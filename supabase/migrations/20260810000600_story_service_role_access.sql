-- Backend Story Blocks functions read these tables with the trusted service role.
grant select on table public.starting_topic to service_role;
grant select on table public.story_character to service_role;
grant select on table public.story_set to service_role;
grant select on table public.story_theme to service_role;
grant select on table public.tool_pricing to service_role;
grant select on table public.story_session to service_role;
