create table if not exists public.video_billing_settings (
  id boolean primary key default true check (id = true),
  provider text not null default 'cloudflare_stream',
  creator_access_monthly_cad numeric(10,2) not null default 10.00 check (creator_access_monthly_cad >= 0),
  storage_credits_per_minute_month numeric(10,4) not null default 1.0000 check (storage_credits_per_minute_month > 0),
  viewing_minutes_per_credit numeric(10,4) not null default 5.0000 check (viewing_minutes_per_credit > 0),
  provider_storage_usd_per_1000_minutes numeric(10,4) not null default 5.0000 check (provider_storage_usd_per_1000_minutes >= 0),
  provider_delivery_usd_per_1000_minutes numeric(10,4) not null default 1.0000 check (provider_delivery_usd_per_1000_minutes >= 0),
  target_margin_pct numeric(6,2) not null default 40.00 check (target_margin_pct >= 0 and target_margin_pct <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.video_billing_settings (id) values (true)
on conflict (id) do nothing;

create table if not exists public.video_asset (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  dossier_id text references public.dossier(id) on delete set null,
  provider text not null default 'cloudflare_stream',
  provider_video_id text,
  source_type text not null default 'upload' check (source_type in ('upload','external_url','import')),
  source_url text,
  playback_url text,
  thumbnail_url text,
  duration_seconds numeric(12,3) check (duration_seconds is null or duration_seconds >= 0),
  status text not null default 'pending' check (status in ('pending','uploading','processing','ready','error','deleted')),
  storage_billing_started_at timestamptz,
  storage_billing_ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_video_id)
);

create index if not exists video_asset_owner_idx on public.video_asset(owner_id);
create index if not exists video_asset_dossier_idx on public.video_asset(dossier_id);
create index if not exists video_asset_status_idx on public.video_asset(status);

create table if not exists public.video_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  billing_month date not null check (billing_month = date_trunc('month', billing_month)::date),
  stored_video_minutes numeric(18,4) not null default 0 check (stored_video_minutes >= 0),
  delivered_view_minutes numeric(18,4) not null default 0 check (delivered_view_minutes >= 0),
  storage_credits integer not null default 0 check (storage_credits >= 0),
  viewing_credits integer not null default 0 check (viewing_credits >= 0),
  total_credits integer generated always as (storage_credits + viewing_credits) stored,
  status text not null default 'open' check (status in ('open','ready','charged','failed')),
  provider_snapshot jsonb not null default '{}'::jsonb,
  charged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, billing_month)
);

create index if not exists video_usage_monthly_month_idx on public.video_usage_monthly(billing_month);
create index if not exists video_usage_monthly_status_idx on public.video_usage_monthly(status);

alter table public.video_billing_settings enable row level security;
alter table public.video_asset enable row level security;
alter table public.video_usage_monthly enable row level security;

create policy "video_asset_owner_select" on public.video_asset
for select to authenticated using (owner_id = auth.uid());

create policy "video_usage_owner_select" on public.video_usage_monthly
for select to authenticated using (owner_id = auth.uid());

create or replace function public.video_quote_credits(
  p_stored_minutes numeric,
  p_viewed_minutes numeric
) returns table(storage_credits integer, viewing_credits integer, total_credits integer)
language sql stable security definer set search_path = public
as $$
  select
    ceil(greatest(coalesce(p_stored_minutes,0),0) * s.storage_credits_per_minute_month)::integer,
    ceil(greatest(coalesce(p_viewed_minutes,0),0) / s.viewing_minutes_per_credit)::integer,
    (
      ceil(greatest(coalesce(p_stored_minutes,0),0) * s.storage_credits_per_minute_month)
      + ceil(greatest(coalesce(p_viewed_minutes,0),0) / s.viewing_minutes_per_credit)
    )::integer
  from public.video_billing_settings s where s.id = true;
$$;

grant execute on function public.video_quote_credits(numeric,numeric) to authenticated;
