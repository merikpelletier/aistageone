create table if not exists public.ai_pilot_component_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  tool_key text,
  slot_key text,
  component_type text not null,
  source_kind text not null check (source_kind in ('published','member_extension')),
  member_ai_pilot_id uuid not null references public.member_ai_pilots(id) on delete cascade,
  ai_pilot_id uuid not null references public.ai_pilots(id) on delete cascade,
  version_id uuid not null references public.ai_pilot_versions(id) on delete cascade,
  block_id uuid references public.ai_pilot_blocks(id) on delete cascade,
  source_item_id text,
  member_extension_id uuid references public.member_ai_pilot_extensions(id) on delete cascade,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_pilot_component_selection_source_check check (
    (source_kind = 'published' and block_id is not null and member_extension_id is null)
    or
    (source_kind = 'member_extension' and member_extension_id is not null)
  )
);

create index if not exists ai_pilot_component_selections_user_project_idx
  on public.ai_pilot_component_selections(user_id, project_id, tool_key, component_type)
  where is_active = true;

create index if not exists ai_pilot_component_selections_member_pilot_idx
  on public.ai_pilot_component_selections(member_ai_pilot_id, selected_at desc);

alter table public.ai_pilot_component_selections enable row level security;

grant select, insert, update, delete on public.ai_pilot_component_selections to authenticated;

create policy "members_read_own_ai_pilot_component_selections"
on public.ai_pilot_component_selections for select
to authenticated
using (user_id = (select auth.uid()));

create policy "members_add_own_ai_pilot_component_selections"
on public.ai_pilot_component_selections for insert
to authenticated
with check (
  ai_pilot_component_selections.user_id = (select auth.uid())
  and exists (
    select 1
    from public.member_ai_pilots map
    where map.id = ai_pilot_component_selections.member_ai_pilot_id
      and map.user_id = (select auth.uid())
      and map.ai_pilot_id = ai_pilot_component_selections.ai_pilot_id
      and map.version_id = ai_pilot_component_selections.version_id
  )
  and (
    ai_pilot_component_selections.member_extension_id is null
    or exists (
      select 1
      from public.member_ai_pilot_extensions ext
      where ext.id = ai_pilot_component_selections.member_extension_id
        and ext.member_ai_pilot_id = ai_pilot_component_selections.member_ai_pilot_id
        and ext.user_id = (select auth.uid())
    )
  )
);

create policy "members_update_own_ai_pilot_component_selections"
on public.ai_pilot_component_selections for update
to authenticated
using (ai_pilot_component_selections.user_id = (select auth.uid()))
with check (
  ai_pilot_component_selections.user_id = (select auth.uid())
  and exists (
    select 1
    from public.member_ai_pilots map
    where map.id = ai_pilot_component_selections.member_ai_pilot_id
      and map.user_id = (select auth.uid())
      and map.ai_pilot_id = ai_pilot_component_selections.ai_pilot_id
      and map.version_id = ai_pilot_component_selections.version_id
  )
);

create policy "members_delete_own_ai_pilot_component_selections"
on public.ai_pilot_component_selections for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "admins_manage_ai_pilot_component_selections"
on public.ai_pilot_component_selections for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');