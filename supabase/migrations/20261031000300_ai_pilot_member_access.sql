create table if not exists public.member_ai_pilots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_email text,
  ai_pilot_id uuid not null references public.ai_pilots(id) on delete cascade,
  version_id uuid not null references public.ai_pilot_versions(id) on delete restrict,
  access_source text not null default 'admin' check (access_source in ('admin', 'shop', 'included', 'creator')),
  source_asset_id text,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, ai_pilot_id)
);

create table if not exists public.ai_pilot_project_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id text not null,
  member_ai_pilot_id uuid not null references public.member_ai_pilots(id) on delete cascade,
  ai_pilot_id uuid not null references public.ai_pilots(id) on delete restrict,
  version_id uuid not null references public.ai_pilot_versions(id) on delete restrict,
  is_active boolean not null default true,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id)
);

create index if not exists member_ai_pilots_user_idx
  on public.member_ai_pilots(user_id, granted_at desc);
create index if not exists ai_pilot_project_assignments_user_idx
  on public.ai_pilot_project_assignments(user_id, project_id);

create or replace function public.set_ai_pilot_assignment_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_pilot_project_assignments_updated_at on public.ai_pilot_project_assignments;
create trigger set_ai_pilot_project_assignments_updated_at
before update on public.ai_pilot_project_assignments
for each row execute function public.set_ai_pilot_assignment_updated_at();

alter table public.member_ai_pilots enable row level security;
alter table public.ai_pilot_project_assignments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='member_ai_pilots' and policyname='members_read_own_ai_pilots') then
    create policy members_read_own_ai_pilots on public.member_ai_pilots
      for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='member_ai_pilots' and policyname='admins_manage_member_ai_pilots') then
    create policy admins_manage_member_ai_pilots on public.member_ai_pilots
      for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilot_project_assignments' and policyname='members_manage_own_ai_pilot_assignments') then
    create policy members_manage_own_ai_pilot_assignments on public.ai_pilot_project_assignments
      for all to authenticated
      using (user_id = auth.uid())
      with check (
        user_id = auth.uid()
        and exists (
          select 1
          from public.member_ai_pilots m
          where m.id = member_ai_pilot_id
            and m.user_id = auth.uid()
            and m.ai_pilot_id = ai_pilot_id
            and m.version_id = version_id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilot_project_assignments' and policyname='admins_read_ai_pilot_assignments') then
    create policy admins_read_ai_pilot_assignments on public.ai_pilot_project_assignments
      for select to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilots' and policyname='members_read_owned_ai_pilots') then
    create policy members_read_owned_ai_pilots on public.ai_pilots
      for select to authenticated
      using (
        exists (
          select 1
          from public.member_ai_pilots m
          where m.ai_pilot_id = ai_pilots.id
            and m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilot_versions' and policyname='members_read_owned_ai_pilot_versions') then
    create policy members_read_owned_ai_pilot_versions on public.ai_pilot_versions
      for select to authenticated
      using (
        exists (
          select 1
          from public.member_ai_pilots m
          where m.version_id = ai_pilot_versions.id
            and m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilot_blocks' and policyname='members_read_owned_ai_pilot_blocks') then
    create policy members_read_owned_ai_pilot_blocks on public.ai_pilot_blocks
      for select to authenticated
      using (
        exists (
          select 1
          from public.member_ai_pilots m
          where m.version_id = ai_pilot_blocks.version_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end $$;

grant select on public.member_ai_pilots to authenticated;
grant select, insert, update, delete on public.ai_pilot_project_assignments to authenticated;
