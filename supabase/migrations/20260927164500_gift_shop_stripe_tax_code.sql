alter table public.products
  add column if not exists stripe_tax_code text;
