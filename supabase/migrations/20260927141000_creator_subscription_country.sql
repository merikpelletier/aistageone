alter table public.creator_subscription_plan
  add column if not exists country text not null default 'CA';

update public.creator_subscription_plan
set country = upper(coalesce(nullif(country, ''), 'CA'));

alter table public.creator_subscription_plan
  drop constraint if exists creator_subscription_plan_country_check;

alter table public.creator_subscription_plan
  add constraint creator_subscription_plan_country_check
  check (country ~ '^[A-Z]{2}$');
