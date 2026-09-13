-- Comptes AISTAGE.ONE, profils liés et politiques de propriété.

alter table public.member_profile
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists member_profile_auth_user_id_key
  on public.member_profile(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists member_profile_user_email_key
  on public.member_profile(lower(user_email))
  where user_email is not null;

create unique index if not exists user_token_balance_user_email_key
  on public.user_token_balance(lower(user_email))
  where user_email is not null;

create table if not exists public.ai_conversation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversation enable row level security;
grant select, insert, update, delete on public.ai_conversation to authenticated;

drop policy if exists "owners_manage_ai_conversations" on public.ai_conversation;
create policy "owners_manage_ai_conversations"
on public.ai_conversation
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_aistage_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Member'
  );

  insert into public.member_profile (
    id,
    created_by_id,
    created_by,
    user_email,
    display_name,
    auth_user_id
  ) values (
    gen_random_uuid()::text,
    new.id::text,
    new.email,
    new.email,
    profile_name,
    new.id
  )
  on conflict ((lower(user_email))) where user_email is not null
  do update set
    auth_user_id = excluded.auth_user_id,
    created_by_id = excluded.created_by_id,
    updated_date = now();

  insert into public.user_token_balance (
    id,
    created_by_id,
    created_by,
    user_email,
    balance,
    last_updated
  ) select
    gen_random_uuid()::text,
    new.id::text,
    new.email,
    new.email,
    0,
    now()
  where not exists (
    select 1 from public.user_token_balance balance
    where lower(balance.user_email) = lower(new.email)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_aistage_user();

-- Relie les profils historiques si un compte Supabase du même courriel existe déjà.
update public.member_profile profile
set auth_user_id = account.id,
    created_by_id = account.id::text,
    updated_date = now()
from auth.users account
where lower(profile.user_email) = lower(account.email)
  and profile.auth_user_id is null;

-- Toute table importée possède created_by_id/created_by. Les politiques suivantes
-- donnent aux membres l'accès à leurs propres lignes sans ouvrir les données privées.
do $$
declare
  table_row record;
  owner_expression text;
begin
  for table_row in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'created_by_id'
  loop
    owner_expression := format(
      '(created_by_id = (select auth.uid())::text or lower(coalesce(created_by, '''')) = lower(coalesce((select auth.jwt() ->> ''email''), ''''))%s or public.is_admin())',
      case when exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = table_row.table_name
          and column_name = 'user_email'
      ) then ' or lower(coalesce(user_email, '''')) = lower(coalesce((select auth.jwt() ->> ''email''), ''''))'
      else '' end
    );

    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_row.table_name);
    execute format('drop policy if exists "owner_read" on public.%I', table_row.table_name);
    execute format('create policy "owner_read" on public.%I for select to authenticated using (%s)', table_row.table_name, owner_expression);
    execute format('drop policy if exists "owner_insert" on public.%I', table_row.table_name);
    execute format('create policy "owner_insert" on public.%I for insert to authenticated with check (%s)', table_row.table_name, owner_expression);
    execute format('drop policy if exists "owner_update" on public.%I', table_row.table_name);
    execute format('create policy "owner_update" on public.%I for update to authenticated using (%s) with check (%s)', table_row.table_name, owner_expression, owner_expression);
    execute format('drop policy if exists "owner_delete" on public.%I', table_row.table_name);
    execute format('create policy "owner_delete" on public.%I for delete to authenticated using (%s)', table_row.table_name, owner_expression);
  end loop;
end;
$$;

grant select on public.member_profile to anon, authenticated;
drop policy if exists "public_read_member_profiles" on public.member_profile;
create policy "public_read_member_profiles"
on public.member_profile for select to anon, authenticated using (true);
