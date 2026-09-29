-- User-owned AI connections and models.
-- Credentials are intentionally NOT stored here. A later step will attach
-- encrypted/provider-managed secret references to ai_user_connection.

create table if not exists public.ai_user_connection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  connection_name text not null,
  auth_mode text not null default 'api_key',
  status text not null default 'disconnected'
    check (status in ('disconnected','pending','connected','error','disabled')),
  provider_account_label text,
  metadata jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, connection_name)
);

create table if not exists public.ai_user_connected_model (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.ai_user_connection(id) on delete cascade,
  provider_model_key text not null,
  display_name text not null,
  kind text not null
    check (kind in ('text','image','video','audio','speech','processing','transcription')),
  capabilities jsonb not null default '{}'::jsonb,
  input_schema jsonb not null default '{}'::jsonb,
  provider_metadata jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','error')),
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_model_key)
);

create table if not exists public.ai_user_model_route (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_model_id uuid not null references public.ai_user_connected_model(id) on delete cascade,
  service text not null,
  kind text not null
    check (kind in ('text','image','video','audio','speech','processing','transcription')),
  compatibility_status text not null default 'pending'
    check (compatibility_status in ('pending','compatible','incompatible')),
  enabled boolean not null default false,
  input_mapping jsonb not null default '{}'::jsonb,
  defaults jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connected_model_id, service)
);

create index if not exists ai_user_connection_user_idx
  on public.ai_user_connection(user_id, provider);

create index if not exists ai_user_connected_model_user_idx
  on public.ai_user_connected_model(user_id, kind, enabled);

create index if not exists ai_user_model_route_user_service_idx
  on public.ai_user_model_route(user_id, service, enabled);

alter table public.ai_user_connection enable row level security;
alter table public.ai_user_connected_model enable row level security;
alter table public.ai_user_model_route enable row level security;

drop policy if exists "Users manage own AI connections" on public.ai_user_connection;
create policy "Users manage own AI connections"
  on public.ai_user_connection
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users manage own connected AI models" on public.ai_user_connected_model;
create policy "Users manage own connected AI models"
  on public.ai_user_connected_model
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.ai_user_connection c
      where c.id = connection_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own AI model routes" on public.ai_user_model_route;
create policy "Users manage own AI model routes"
  on public.ai_user_model_route
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.ai_user_connected_model m
      where m.id = connected_model_id
        and m.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.ai_user_connection to authenticated;
grant select, insert, update, delete on public.ai_user_connected_model to authenticated;
grant select, insert, update, delete on public.ai_user_model_route to authenticated;

comment on table public.ai_user_connection is
  'User-owned AI provider connections. No plaintext credentials are stored in this table.';
comment on table public.ai_user_connected_model is
  'Models discovered or registered through a user-owned AI provider connection.';
comment on table public.ai_user_model_route is
  'Explicit compatibility between a user-connected model and an AISTAGE AI service route.';
