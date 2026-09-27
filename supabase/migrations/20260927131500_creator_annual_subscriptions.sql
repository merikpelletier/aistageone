-- Creator annual subscriptions for AISTAGE.ONE
-- Public audience subscriptions are separate from production credits.

alter table public.dossier
  add column if not exists access_level text not null default 'public'
  check (access_level in ('public', 'subscribers'));

create table if not exists public.creator_subscription_plan (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_email text not null,
  annual_price_cents integer not null default 0 check (annual_price_cents >= 0),
  currency text not null default 'cad',
  active boolean not null default false,
  stripe_account_id text unique,
  stripe_details_submitted boolean not null default false,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  created_date timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id)
);

create unique index if not exists creator_subscription_plan_email_idx
  on public.creator_subscription_plan (lower(creator_email));

create table if not exists public.creator_subscription (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references auth.users(id) on delete cascade,
  subscriber_email text not null,
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_email text not null,
  stripe_account_id text,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_date timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscriber_id, creator_id)
);

create index if not exists creator_subscription_subscriber_idx
  on public.creator_subscription (subscriber_id, status);

create index if not exists creator_subscription_creator_idx
  on public.creator_subscription (creator_id, status);

alter table public.creator_subscription_plan enable row level security;
alter table public.creator_subscription enable row level security;

grant select on public.creator_subscription_plan to anon, authenticated;
grant insert, update on public.creator_subscription_plan to authenticated;
grant select on public.creator_subscription to authenticated;

drop policy if exists "creator_plan_public_or_owner_read" on public.creator_subscription_plan;
create policy "creator_plan_public_or_owner_read"
on public.creator_subscription_plan
for select to anon, authenticated
using (active = true or creator_id = auth.uid());

drop policy if exists "creator_plan_owner_insert" on public.creator_subscription_plan;
create policy "creator_plan_owner_insert"
on public.creator_subscription_plan
for insert to authenticated
with check (creator_id = auth.uid());

drop policy if exists "creator_plan_owner_update" on public.creator_subscription_plan;
create policy "creator_plan_owner_update"
on public.creator_subscription_plan
for update to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

drop policy if exists "creator_subscription_party_read" on public.creator_subscription;
create policy "creator_subscription_party_read"
on public.creator_subscription
for select to authenticated
using (subscriber_id = auth.uid() or creator_id = auth.uid());

create or replace function public.has_active_creator_subscription(target_creator_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.creator_subscription s
    where s.subscriber_id = auth.uid()
      and lower(s.creator_email) = lower(target_creator_email)
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

grant execute on function public.has_active_creator_subscription(text) to anon, authenticated;

create or replace function public.can_access_dossier(target_dossier_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dossier d
    where d.id = target_dossier_id
      and d.status = 'published'
      and (
        coalesce(d.access_level, 'public') = 'public'
        or d.created_by_id = auth.uid()::text
        or lower(coalesce(d.submitted_by_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or (
          coalesce(d.access_level, 'public') = 'subscribers'
          and public.has_active_creator_subscription(
            coalesce(nullif(d.submitted_by_email, ''), d.created_by)
          )
        )
      )
  );
$$;

grant execute on function public.can_access_dossier(text) to anon, authenticated;

create or replace function public.can_access_published_production(target_production_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (
      select 1
      from public.dossier_page dp
      join public.dossier d on d.id = dp.dossier_id
      where dp.block_player_episode_page_id::text = target_production_id
        and d.status = 'published'
        and coalesce(d.access_level, 'public') = 'subscribers'
    )
    or exists (
      select 1
      from public.dossier_page dp
      where dp.block_player_episode_page_id::text = target_production_id
        and public.can_access_dossier(dp.dossier_id)
    );
$$;

grant execute on function public.can_access_published_production(text) to anon, authenticated;

-- Covers remain visible in the public catalogue, but premium pages require access.
drop policy if exists "public_read_published_dossier_page" on public.dossier_page;
create policy "public_read_published_dossier_page"
on public.dossier_page
for select to anon, authenticated
using (
  coalesce(is_hidden_from_public, false) = false
  and public.can_access_dossier(dossier_id)
);

drop policy if exists "public_read_published_episode_production" on public.episode_production;
create policy "public_read_published_episode_production"
on public.episode_production
for select to anon, authenticated
using (public.can_access_dossier(dossier_id));

drop policy if exists "public_read_timeline_story" on public.timeline_story;
create policy "public_read_timeline_story"
on public.timeline_story
for select to anon, authenticated
using (
  coalesce(is_published, false)
  and public.can_access_published_production(id::text)
);

drop policy if exists "public_read_story_session" on public.story_session;
create policy "public_read_story_session"
on public.story_session
for select to anon, authenticated
using (
  (coalesce(is_public, false) or coalesce(is_published, false))
  and public.can_access_published_production(id::text)
);

drop policy if exists "public_read_story_block" on public.story_block;
create policy "public_read_story_block"
on public.story_block
for select to anon, authenticated
using (
  exists (
    select 1
    from public.story_session s
    where s.id = story_block.session_id
      and (coalesce(s.is_public, false) or coalesce(s.is_published, false))
      and public.can_access_published_production(s.id::text)
  )
);
