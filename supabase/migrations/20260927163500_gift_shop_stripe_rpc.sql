create or replace function public.gift_shop_create_checkout_session(
  p_user_id uuid,
  p_user_email text,
  p_cart jsonb,
  p_payment_mode text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  insert into public.gift_shop_checkout_session(user_id,user_email,cart,totals,payment_mode)
  values (p_user_id,p_user_email,p_cart,'{}'::jsonb,p_payment_mode)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.gift_shop_set_stripe_session(
  p_id uuid,
  p_stripe_checkout_session_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;
  update public.gift_shop_checkout_session
  set stripe_checkout_session_id = p_stripe_checkout_session_id
  where id = p_id;
end;
$$;

create or replace function public.gift_shop_complete_stripe_order(
  p_checkout_session_id uuid,
  p_stripe_checkout_session_id text,
  p_order_id text,
  p_items jsonb,
  p_subtotal double precision,
  p_tax_total double precision,
  p_shipping double precision,
  p_total double precision,
  p_customer_email text,
  p_customer_name text,
  p_shipping_address jsonb,
  p_tax_breakdown jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_existing text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select id into v_existing from public."order"
  where stripe_checkout_session_id = p_stripe_checkout_session_id
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public."order"(
    order_id,items,subtotal,tps,tvq,shipping,total,customer_email,customer_name,
    shipping_address,status,payment_date,payment_processor,tax_total,tax_breakdown,
    stripe_checkout_session_id
  ) values (
    p_order_id,p_items,p_subtotal,0,0,p_shipping,p_total,p_customer_email,p_customer_name,
    p_shipping_address,'completed',now(),'stripe',p_tax_total,coalesce(p_tax_breakdown,'[]'::jsonb),
    p_stripe_checkout_session_id
  ) returning id into v_existing;

  update public.gift_shop_checkout_session
  set consumed_at=now(),
      final_totals=jsonb_build_object(
        'subtotal',p_subtotal,'tax',p_tax_total,'shipping',p_shipping,'total',p_total
      )
  where id=p_checkout_session_id;

  return v_existing;
end;
$$;
