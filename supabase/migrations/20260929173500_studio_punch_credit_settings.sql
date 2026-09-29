alter table public.credit_economy_settings
  add column if not exists studio_punch_credits integer null check (studio_punch_credits is null or studio_punch_credits > 0),
  add column if not exists studio_punch_duration_hours integer not null default 24 check (studio_punch_duration_hours > 0 and studio_punch_duration_hours <= 168);