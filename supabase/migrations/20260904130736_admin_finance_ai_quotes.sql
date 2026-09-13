-- Administration financière AISTAGE.ONE. Les prix existants restent inchangés.
create table public.ai_finance_settings (
  id boolean primary key default true check (id),
  credit_value_cad numeric check (credit_value_cad > 0 and credit_value_cad < 1000000),
  usd_to_cad_rate numeric check (usd_to_cad_rate > 0 and usd_to_cad_rate < 1000),
  quotes_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.ai_finance_settings(id) values(true);

create table public.ai_model_rate (
  model_key text primary key,
  billing_type text not null check (billing_type in ('prediction','characters','output_seconds','runtime_seconds','tokens')),
  unit_price_usd numeric not null check (unit_price_usd > 0 and unit_price_usd < 1000000),
  output_unit_price_usd numeric check (output_unit_price_usd >= 0 and output_unit_price_usd < 1000000),
  max_runtime_seconds integer check (max_runtime_seconds between 5 and 240),
  source_url text not null,
  notes text not null default '',
  quote_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.ai_quote (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  user_email text not null,
  function_name text not null,
  tool_id text not null,
  payload_hash text not null,
  credit_price numeric not null check (credit_price > 0 and credit_price = trunc(credit_price) and credit_price < 1000000000),
  starting_credits numeric not null,
  cost_usd numeric not null check (cost_usd > 0 and cost_usd < 1000000000),
  credit_value_cad numeric not null check (credit_value_cad > 0),
  usd_to_cad_rate numeric not null check (usd_to_cad_rate > 0),
  settings_date timestamptz not null,
  plan jsonb not null,
  status text not null default 'quoted' check (status in ('quoted','running','succeeded','failed')),
  charged_credits numeric not null default 0,
  balance_after numeric,
  result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  completed_at timestamptz
);
create index ai_quote_user_created on public.ai_quote(user_id,created_at desc);

create table public.ai_usage_event (
  prediction_id text primary key,
  quote_id uuid references public.ai_quote(id),
  charge_id uuid references public.ai_credit_charge(id),
  request_id uuid,
  function_name text,
  tool_id text,
  model_key text not null,
  model_version text,
  status text not null,
  usage jsonb not null default '{}',
  rate_snapshot jsonb,
  cost_usd numeric check (cost_usd >= 0 and cost_usd < 1000000000),
  usd_to_cad_rate numeric,
  cost_cad numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index ai_usage_created on public.ai_usage_event(created_at desc);
create index ai_usage_quote on public.ai_usage_event(quote_id);

create table public.finance_entry (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('expense','member_payout','income')),
  amount numeric not null check (amount > 0 and amount < 1000000000),
  currency text not null check (currency in ('CAD','USD','EUR')),
  occurred_on date not null,
  label text not null,
  reference text not null,
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.finance_tax_confirmation (
  order_id text primary key references public."order"(id),
  tax_month date not null check (extract(day from tax_month)=1),
  currency text not null check (currency='CAD'),
  tps numeric not null check (tps >= 0 and tps < 1000000000),
  tvq numeric not null check (tvq >= 0 and tvq < 1000000000),
  reference text not null,
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now()
);
create table public.finance_tax_deposit (
  id uuid primary key default gen_random_uuid(),
  tax_month date not null unique check (extract(day from tax_month)=1),
  tps numeric not null,
  tvq numeric not null,
  snapshot jsonb not null,
  deposited_on date not null,
  reference text not null,
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['ai_finance_settings','ai_model_rate','ai_quote','ai_usage_event','finance_entry','finance_tax_confirmation','finance_tax_deposit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public,anon,authenticated', t);
    execute format('grant select,insert,update on public.%I to service_role', t);
  end loop;
end $$;

create function public.finance_record_tax_deposit(p_month date,p_date date,p_reference text,p_notes text,p_user uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare rows jsonb; gst numeric; qst numeric; result jsonb;
begin
  if extract(day from p_month)<>1 or nullif(trim(p_reference),'') is null then raise exception 'Mois ou référence invalide'; end if;
  select jsonb_agg(to_jsonb(t)),sum(tps),sum(tvq) into rows,gst,qst
    from public.finance_tax_confirmation t where tax_month=p_month;
  if rows is null then raise exception 'Aucune taxe confirmée pour ce mois'; end if;
  insert into public.finance_tax_deposit(tax_month,tps,tvq,snapshot,deposited_on,reference,notes,created_by)
    values(p_month,gst,qst,rows,p_date,p_reference,p_notes,p_user) returning to_jsonb(finance_tax_deposit.*) into result;
  return result;
end $$;

revoke all on function public.finance_record_tax_deposit(date,date,text,text,uuid) from public,anon,authenticated;
grant execute on function public.finance_record_tax_deposit(date,date,text,text,uuid) to service_role;
grant select on public.ai_credit_charge,public."order",public.sponsor_sale,public.token_transaction,public.tool_pricing,public.asset_purchase to service_role;
