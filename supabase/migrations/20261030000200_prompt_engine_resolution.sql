alter table public.ai_prompt_library
  add column if not exists function_key text not null default '',
  add column if not exists context_tags text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_prompt_library_function_key_check'
      and conrelid = 'public.ai_prompt_library'::regclass
  ) then
    alter table public.ai_prompt_library
      add constraint ai_prompt_library_function_key_check
      check (function_key = '' or function_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$');
  end if;
end $$;

create index if not exists ai_prompt_library_function_idx
  on public.ai_prompt_library(function_key, is_active, priority);
create index if not exists ai_prompt_library_context_tags_idx
  on public.ai_prompt_library using gin(context_tags);

create or replace function public.resolve_ai_prompt(
  p_tool_key text default null,
  p_function_key text default null,
  p_model_key text default null,
  p_context_tags text[] default '{}'
)
returns table (
  id uuid,
  prompt_key text,
  name text,
  content text,
  variables jsonb,
  version integer,
  function_key text,
  context_tags text[],
  matched_tool boolean,
  matched_model boolean,
  matched_function boolean,
  match_score integer
)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select
      p.*,
      exists (
        select 1 from public.ai_prompt_tools t
        where t.prompt_id = p.id and t.tool_key = p_tool_key
      ) as exact_tool,
      exists (
        select 1 from public.ai_prompt_models m
        where m.prompt_id = p.id and m.model_key = p_model_key
      ) as exact_model,
      (p.function_key <> '' and p.function_key = coalesce(p_function_key, '')) as exact_function
    from public.ai_prompt_library p
    where p.is_active = true
      and (p.function_key = '' or p.function_key = coalesce(p_function_key, ''))
      and (
        not exists (select 1 from public.ai_prompt_tools t where t.prompt_id = p.id)
        or (p_tool_key is not null and exists (
          select 1 from public.ai_prompt_tools t where t.prompt_id = p.id and t.tool_key = p_tool_key
        ))
      )
      and (
        not exists (select 1 from public.ai_prompt_models m where m.prompt_id = p.id)
        or (p_model_key is not null and exists (
          select 1 from public.ai_prompt_models m where m.prompt_id = p.id and m.model_key = p_model_key
        ))
      )
      and (
        cardinality(p.context_tags) = 0
        or p.context_tags <@ coalesce(p_context_tags, '{}'::text[])
      )
  )
  select
    c.id,
    c.prompt_key,
    c.name,
    c.content,
    c.variables,
    c.version,
    c.function_key,
    c.context_tags,
    c.exact_tool as matched_tool,
    c.exact_model as matched_model,
    c.exact_function as matched_function,
    (
      case when c.exact_function then 1000 else 0 end +
      case when c.exact_tool then 200 else 0 end +
      case when c.exact_model then 100 else 0 end +
      cardinality(c.context_tags) * 10
    )::integer as match_score
  from candidates c
  order by match_score desc, c.priority asc, c.version desc, c.updated_at desc
  limit 1;
$$;

revoke all on function public.resolve_ai_prompt(text, text, text, text[]) from public;
revoke all on function public.resolve_ai_prompt(text, text, text, text[]) from anon;
revoke all on function public.resolve_ai_prompt(text, text, text, text[]) from authenticated;
grant execute on function public.resolve_ai_prompt(text, text, text, text[]) to service_role;
