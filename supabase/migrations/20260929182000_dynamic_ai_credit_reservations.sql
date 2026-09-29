create or replace function public.reserve_ai_credit_charge_dynamic(
  p_user_id uuid,
  p_user_email text,
  p_tool_id text,
  p_provider text,
  p_related_entity text,
  p_idempotency_key text,
  p_credit_cost double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_charge public.ai_credit_charge%rowtype;
  balance_record public.user_token_balance%rowtype;
  charge_id uuid;
  new_balance double precision;
begin
  if p_user_id is null or nullif(trim(p_user_email), '') is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if nullif(trim(p_tool_id), '') is null or nullif(trim(p_idempotency_key), '') is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_credit_request');
  end if;
  if p_credit_cost is null or p_credit_cost < 0 or p_credit_cost > 100000000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_dynamic_price');
  end if;

  select * into existing_charge
  from public.ai_credit_charge
  where user_id = p_user_id
    and tool_id = p_tool_id
    and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'ok', false, 'code', 'duplicate_request',
      'charge_id', existing_charge.id,
      'cost', existing_charge.credit_cost,
      'balance_after', existing_charge.balance_after,
      'status', existing_charge.status
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

  if coalesce(balance_record.balance, 0) < p_credit_cost then
    return jsonb_build_object(
      'ok', false, 'code', 'insufficient_credits',
      'required', p_credit_cost,
      'balance', coalesce(balance_record.balance, 0)
    );
  end if;

  new_balance := coalesce(balance_record.balance, 0) - p_credit_cost;

  update public.user_token_balance
  set balance = new_balance, last_updated = now()
  where id = balance_record.id;

  insert into public.ai_credit_charge (
    user_id, user_email, tool_id, provider, related_entity,
    idempotency_key, credit_cost, balance_after
  ) values (
    p_user_id, p_user_email, p_tool_id, p_provider, p_related_entity,
    p_idempotency_key, p_credit_cost, new_balance
  )
  returning id into charge_id;

  insert into public.token_transaction (
    id, created_by_id, created_by, user_email, transaction_type,
    token_amount, balance_after, related_entity, payment_id, created_at
  ) values (
    gen_random_uuid()::text, p_user_id::text, p_user_email, p_user_email, 'usage',
    -p_credit_cost, new_balance, coalesce(p_related_entity, p_tool_id),
    charge_id::text, now()
  );

  return jsonb_build_object(
    'ok', true, 'charge_id', charge_id, 'cost', p_credit_cost,
    'balance_after', new_balance, 'status', 'reserved'
  );
end;
$$;

revoke all on function public.reserve_ai_credit_charge_dynamic(uuid,text,text,text,text,text,double precision) from public;
grant execute on function public.reserve_ai_credit_charge_dynamic(uuid,text,text,text,text,text,double precision) to service_role;