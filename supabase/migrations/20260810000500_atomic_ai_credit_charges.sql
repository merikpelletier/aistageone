-- Réservations atomiques de crédits pour les appels IA payants.

create table if not exists public.ai_credit_charge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  tool_id text not null,
  provider text not null,
  related_entity text,
  idempotency_key text not null,
  credit_cost double precision not null check (credit_cost >= 0),
  balance_after double precision,
  status text not null default 'reserved'
    check (status in ('reserved', 'consumed', 'refunded')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  refunded_at timestamptz,
  unique (user_id, tool_id, idempotency_key)
);

alter table public.ai_credit_charge enable row level security;
revoke all on public.ai_credit_charge from anon, authenticated;

create or replace function public.reserve_ai_credit_charge(
  p_user_id uuid,
  p_user_email text,
  p_tool_id text,
  p_provider text,
  p_related_entity text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_charge public.ai_credit_charge%rowtype;
  balance_record public.user_token_balance%rowtype;
  configured_cost double precision;
  charge_id uuid;
  new_balance double precision;
begin
  if p_user_id is null or nullif(trim(p_user_email), '') is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  if nullif(trim(p_tool_id), '') is null or nullif(trim(p_idempotency_key), '') is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_credit_request');
  end if;

  select * into existing_charge
  from public.ai_credit_charge
  where user_id = p_user_id
    and tool_id = p_tool_id
    and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'ok', false,
      'code', 'duplicate_request',
      'charge_id', existing_charge.id,
      'cost', existing_charge.credit_cost,
      'balance_after', existing_charge.balance_after,
      'status', existing_charge.status
    );
  end if;

  select pricing.token_cost into configured_cost
  from public.tool_pricing pricing
  where pricing.tool_id = p_tool_id
    and pricing.is_active is true
  order by pricing.updated_date desc
  limit 1;

  if configured_cost is null or configured_cost < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'pricing_not_configured',
      'tool_id', p_tool_id
    );
  end if;

  insert into public.user_token_balance (
    id, created_by_id, created_by, user_email, balance, last_updated
  ) values (
    gen_random_uuid()::text, p_user_id::text, p_user_email, p_user_email, 0, now()
  )
  on conflict ((lower(user_email))) where user_email is not null do nothing;

  select * into balance_record
  from public.user_token_balance
  where lower(user_email) = lower(p_user_email)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'balance_unavailable');
  end if;

  if coalesce(balance_record.balance, 0) < configured_cost then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_credits',
      'required', configured_cost,
      'balance', coalesce(balance_record.balance, 0)
    );
  end if;

  new_balance := coalesce(balance_record.balance, 0) - configured_cost;

  update public.user_token_balance
  set balance = new_balance,
      last_updated = now()
  where id = balance_record.id;

  insert into public.ai_credit_charge (
    user_id, user_email, tool_id, provider, related_entity,
    idempotency_key, credit_cost, balance_after
  ) values (
    p_user_id, p_user_email, p_tool_id, p_provider, p_related_entity,
    p_idempotency_key, configured_cost, new_balance
  )
  returning id into charge_id;

  insert into public.token_transaction (
    id, created_by_id, created_by, user_email, transaction_type,
    token_amount, balance_after, related_entity, payment_id, created_at
  ) values (
    gen_random_uuid()::text, p_user_id::text, p_user_email, p_user_email, 'usage',
    -configured_cost, new_balance, coalesce(p_related_entity, p_tool_id),
    charge_id::text, now()
  );

  return jsonb_build_object(
    'ok', true,
    'charge_id', charge_id,
    'cost', configured_cost,
    'balance_after', new_balance,
    'status', 'reserved'
  );
end;
$$;

create or replace function public.complete_ai_credit_charge(p_charge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed public.ai_credit_charge%rowtype;
begin
  update public.ai_credit_charge
  set status = 'consumed', completed_at = now()
  where id = p_charge_id and status = 'reserved'
  returning * into completed;

  if not found then
    select * into completed from public.ai_credit_charge where id = p_charge_id;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'charge_not_found');
  end if;

  return jsonb_build_object(
    'ok', completed.status = 'consumed',
    'charge_id', completed.id,
    'status', completed.status,
    'cost', completed.credit_cost,
    'balance_after', completed.balance_after
  );
end;
$$;

create or replace function public.refund_ai_credit_charge(
  p_charge_id uuid,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  charge public.ai_credit_charge%rowtype;
  balance_record public.user_token_balance%rowtype;
  new_balance double precision;
begin
  select * into charge
  from public.ai_credit_charge
  where id = p_charge_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'charge_not_found');
  end if;

  if charge.status = 'refunded' then
    return jsonb_build_object(
      'ok', true,
      'charge_id', charge.id,
      'status', charge.status,
      'balance_after', charge.balance_after
    );
  end if;

  if charge.status <> 'reserved' then
    return jsonb_build_object('ok', false, 'code', 'charge_not_refundable', 'status', charge.status);
  end if;

  select * into balance_record
  from public.user_token_balance
  where lower(user_email) = lower(charge.user_email)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'balance_unavailable');
  end if;

  new_balance := coalesce(balance_record.balance, 0) + charge.credit_cost;

  update public.user_token_balance
  set balance = new_balance, last_updated = now()
  where id = balance_record.id;

  update public.ai_credit_charge
  set status = 'refunded',
      balance_after = new_balance,
      error_message = left(p_error_message, 1000),
      refunded_at = now()
  where id = charge.id;

  insert into public.token_transaction (
    id, created_by_id, created_by, user_email, transaction_type,
    token_amount, balance_after, related_entity, payment_id, created_at
  ) values (
    gen_random_uuid()::text, charge.user_id::text, charge.user_email,
    charge.user_email, 'refund', charge.credit_cost, new_balance,
    coalesce(charge.related_entity, charge.tool_id), charge.id::text, now()
  );

  return jsonb_build_object(
    'ok', true,
    'charge_id', charge.id,
    'status', 'refunded',
    'balance_after', new_balance
  );
end;
$$;

revoke all on function public.reserve_ai_credit_charge(uuid, text, text, text, text, text) from public;
revoke all on function public.complete_ai_credit_charge(uuid) from public;
revoke all on function public.refund_ai_credit_charge(uuid, text) from public;

grant execute on function public.reserve_ai_credit_charge(uuid, text, text, text, text, text) to service_role;
grant execute on function public.complete_ai_credit_charge(uuid) to service_role;
grant execute on function public.refund_ai_credit_charge(uuid, text) to service_role;

-- Prix validés par Merik le 10 août 2026.
insert into public.tool_pricing (
  id, created_by, tool_id, tool_name, token_cost, is_active, category
)
select gen_random_uuid()::text, 'system', 'ai_agent', 'AI Assistant Message', 1, true, 'other'
where not exists (select 1 from public.tool_pricing where tool_id = 'ai_agent');

insert into public.tool_pricing (
  id, created_by, tool_id, tool_name, token_cost, is_active, category
)
select gen_random_uuid()::text, 'system', 'ai_text', 'AI Text Generation', 1, true, 'other'
where not exists (select 1 from public.tool_pricing where tool_id = 'ai_text');

update public.tool_pricing
set token_cost = 1, is_active = true
where tool_id in ('ai_agent', 'ai_text');
