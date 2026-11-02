create table public.member_ai_pilot_extensions (
  id uuid primary key default gen_random_uuid(),
  member_ai_pilot_id uuid not null references public.member_ai_pilots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  extension_type text not null,
  name text not null,
  content jsonb not null default '{}'::jsonb,
  operation text not null default 'add' check (operation in ('add','replace')),
  target_item_id text,
  tool_targets text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_ai_pilot_extensions_member_idx
  on public.member_ai_pilot_extensions(member_ai_pilot_id, extension_type, sort_order, created_at);
create index member_ai_pilot_extensions_user_idx
  on public.member_ai_pilot_extensions(user_id, created_at desc);

alter table public.member_ai_pilot_extensions enable row level security;

grant select, insert, update, delete on public.member_ai_pilot_extensions to authenticated;

create policy "members_read_own_ai_pilot_extensions"
on public.member_ai_pilot_extensions for select
to authenticated
using (user_id = (select auth.uid()));

create policy "members_add_own_ai_pilot_extensions"
on public.member_ai_pilot_extensions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.member_ai_pilots map
    where map.id = member_ai_pilot_id
      and map.user_id = (select auth.uid())
  )
);

create policy "members_update_own_ai_pilot_extensions"
on public.member_ai_pilot_extensions for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.member_ai_pilots map
    where map.id = member_ai_pilot_id
      and map.user_id = (select auth.uid())
  )
);

create policy "members_delete_own_ai_pilot_extensions"
on public.member_ai_pilot_extensions for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "admins_manage_member_ai_pilot_extensions"
on public.member_ai_pilot_extensions for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');
