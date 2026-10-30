create table if not exists public.prompt_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.prompt_categories(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prompt_categories_no_self_parent check (parent_id is null or parent_id <> id)
);

create unique index if not exists prompt_categories_root_slug_unique
  on public.prompt_categories (slug)
  where parent_id is null;
create unique index if not exists prompt_categories_child_slug_unique
  on public.prompt_categories (parent_id, slug)
  where parent_id is not null;
create index if not exists prompt_categories_parent_idx
  on public.prompt_categories(parent_id, sort_order, name);

create table if not exists public.ai_prompt_library (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null unique check (prompt_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) > 0),
  category_id uuid references public.prompt_categories(id) on delete set null,
  description text not null default '',
  content text not null default '',
  variables jsonb not null default '[]'::jsonb check (jsonb_typeof(variables) = 'array'),
  priority integer not null default 100,
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_prompt_library_category_idx
  on public.ai_prompt_library(category_id, is_active, priority, name);
create index if not exists ai_prompt_library_active_idx
  on public.ai_prompt_library(is_active, priority);

create table if not exists public.ai_prompt_tools (
  prompt_id uuid not null references public.ai_prompt_library(id) on delete cascade,
  tool_key text not null check (char_length(trim(tool_key)) > 0),
  created_at timestamptz not null default now(),
  primary key (prompt_id, tool_key)
);
create index if not exists ai_prompt_tools_tool_idx
  on public.ai_prompt_tools(tool_key, prompt_id);

create table if not exists public.ai_prompt_models (
  prompt_id uuid not null references public.ai_prompt_library(id) on delete cascade,
  model_key text not null references public.ai_model_catalog(model_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prompt_id, model_key)
);
create index if not exists ai_prompt_models_model_idx
  on public.ai_prompt_models(model_key, prompt_id);

alter table public.prompt_categories enable row level security;
alter table public.ai_prompt_library enable row level security;
alter table public.ai_prompt_tools enable row level security;
alter table public.ai_prompt_models enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prompt_categories' and policyname='admin_manage_prompt_categories') then
    create policy admin_manage_prompt_categories on public.prompt_categories for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_prompt_library' and policyname='admin_manage_ai_prompt_library') then
    create policy admin_manage_ai_prompt_library on public.ai_prompt_library for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_prompt_tools' and policyname='admin_manage_ai_prompt_tools') then
    create policy admin_manage_ai_prompt_tools on public.ai_prompt_tools for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_prompt_models' and policyname='admin_manage_ai_prompt_models') then
    create policy admin_manage_ai_prompt_models on public.ai_prompt_models for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;
end $$;
