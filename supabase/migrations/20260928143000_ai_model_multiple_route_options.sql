-- Allow multiple user-selectable AI models per tool/route.
create table if not exists public.ai_model_route_option (
  id uuid primary key default gen_random_uuid(),
  route_key text not null references public.ai_model_assignment(route_key) on delete cascade,
  service text not null,
  kind text not null,
  model_key text not null references public.ai_model_catalog(model_key) on delete cascade,
  enabled boolean not null default true,
  recommended boolean not null default false,
  credit_cost integer check (credit_cost is null or credit_cost >= 0),
  display_order integer not null default 0,
  input_mapping jsonb not null default '{}'::jsonb,
  defaults jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_key, model_key)
);

create index if not exists ai_model_route_option_route_idx
  on public.ai_model_route_option(route_key, enabled, display_order);

create unique index if not exists ai_model_route_option_one_recommended_idx
  on public.ai_model_route_option(route_key)
  where recommended = true and enabled = true;

alter table public.ai_model_route_option enable row level security;

drop policy if exists "model_owner_manage_route_options" on public.ai_model_route_option;
create policy "model_owner_manage_route_options"
on public.ai_model_route_option
for all
to authenticated
using (auth.uid() = 'fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid)
with check (auth.uid() = 'fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid);

insert into public.ai_model_route_option
(route_key, service, kind, model_key, enabled, recommended, credit_cost, display_order, input_mapping, defaults)
select
  a.route_key, a.service, a.kind, a.model_key, true, true, null, 0,
  coalesce(a.input_mapping, '{}'::jsonb), coalesce(a.defaults, '{}'::jsonb)
from public.ai_model_assignment a
where a.model_key is not null and a.enabled = true
on conflict (route_key, model_key) do nothing;
