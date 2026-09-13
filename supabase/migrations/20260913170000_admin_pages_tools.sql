begin;

create table if not exists public.admin_surface_setting (
  surface_type text not null check (surface_type in ('page', 'tool')),
  surface_key text not null,
  label text not null,
  route text,
  visible boolean not null default true,
  active boolean not null default true,
  look jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (surface_type, surface_key)
);

create table if not exists public.admin_code_change (
  id uuid primary key default gen_random_uuid(),
  surface_type text not null check (surface_type in ('page', 'tool')),
  surface_key text not null,
  requested_prompt text not null,
  model_key text not null,
  title text,
  summary text,
  files jsonb not null default '[]'::jsonb,
  patch text,
  proposed_changes jsonb not null default '{}'::jsonb,
  status text not null default 'review' check (status in ('review', 'approved', 'applied', 'rejected')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table public.admin_surface_setting enable row level security;
alter table public.admin_code_change enable row level security;

grant select, insert, update, delete on public.admin_surface_setting to authenticated;
grant select, insert, update, delete on public.admin_code_change to authenticated;

drop policy if exists admins_manage_surface_settings on public.admin_surface_setting;
create policy admins_manage_surface_settings on public.admin_surface_setting
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists admins_manage_code_changes on public.admin_code_change;
create policy admins_manage_code_changes on public.admin_code_change
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.admin_surface_setting (surface_type, surface_key, label, visible, active, look, configuration)
values
  ('tool', 'agent_bar', 'Agent Bar', false, false,
    '{"background_color":"","accent_color":"#facc15","content_width":"full","spacing":"default"}'::jsonb,
    '{"pages":["Studio"],"position":"top","label":"Production Assistant","placeholder":"Ask the AI...","model":"","prompt":"","permissions":[],"actions":[],"agent_name":"production_assistant","scope":"global"}'::jsonb),
  ('tool', 'bottom_navigation', 'Bottom Navigation', true, true, '{}'::jsonb, '{"scope":"global"}'::jsonb),
  ('tool', 'install_prompt', 'Install Prompt', true, true, '{}'::jsonb, '{"scope":"global"}'::jsonb)
on conflict (surface_type, surface_key) do nothing;

commit;

