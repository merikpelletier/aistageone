-- Stripe checkout/tax metadata for the AISTAGE.ONE Gift Shop.
alter table public."order"
  add column if not exists payment_processor text,
  add column if not exists tax_total double precision default 0,
  add column if not exists tax_breakdown jsonb default '[]'::jsonb,
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists order_stripe_checkout_session_id_uidx
  on public."order"(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.gift_shop_checkout_session
  add column if not exists stripe_checkout_session_id text,
  add column if not exists payment_mode text,
  add column if not exists final_totals jsonb;

create unique index if not exists gift_shop_checkout_stripe_session_uidx
  on public.gift_shop_checkout_session(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- Edge Functions use the service role. Explicit table privileges are required in this project.
grant select on public.products to service_role;
grant select, insert, update on public.gift_shop_checkout_session to service_role;
grant select, insert, update on public."order" to service_role;
