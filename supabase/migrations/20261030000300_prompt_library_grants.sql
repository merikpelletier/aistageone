grant select, insert, update, delete on table public.prompt_categories to authenticated;
grant select, insert, update, delete on table public.ai_prompt_library to authenticated;
grant select, insert, update, delete on table public.ai_prompt_tools to authenticated;
grant select, insert, update, delete on table public.ai_prompt_models to authenticated;

grant select, insert, update, delete on table public.prompt_categories to service_role;
grant select, insert, update, delete on table public.ai_prompt_library to service_role;
grant select, insert, update, delete on table public.ai_prompt_tools to service_role;
grant select, insert, update, delete on table public.ai_prompt_models to service_role;
