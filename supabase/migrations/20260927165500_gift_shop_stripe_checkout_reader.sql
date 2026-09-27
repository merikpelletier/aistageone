create or replace function public.gift_shop_get_checkout_session(p_id uuid)
returns table(
  id uuid,
  user_id uuid,
  user_email text,
  cart jsonb,
  payment_mode text,
  stripe_checkout_session_id text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  return query
  select s.id, s.user_id, s.user_email, s.cart, s.payment_mode, s.stripe_checkout_session_id
  from public.gift_shop_checkout_session s
  where s.id = p_id
  limit 1;
end;
$$;
