alter table public.video_asset
  add column if not exists player_url text;

create index if not exists video_asset_provider_video_idx
  on public.video_asset(provider, provider_video_id);
