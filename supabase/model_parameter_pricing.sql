alter table public.ai_model_catalog drop constraint ai_model_catalog_billing_type_check;
alter table public.ai_model_catalog add constraint ai_model_catalog_billing_type_check
 check(billing_type in ('prediction','output_images','output_videos','characters','output_seconds','runtime_seconds','tokens'));

-- Freeze the owner's pricing at submission, including all conditional rates.
-- Existing generation functions already insert this journal before provider calls.
create function public.ai_model_freeze_pricing() returns trigger
language plpgsql security invoker set search_path='' as $$
declare model public.ai_model_catalog;
begin
 select * into model from public.ai_model_catalog where model_key=new.model_key;
 if not found then raise exception 'Modèle absent du catalogue'; end if;
 new.rate_snapshot=jsonb_build_object(
  'billing_type',model.billing_type,'unit_price_usd',model.unit_price_usd,
  'output_unit_price_usd',model.output_unit_price_usd,'source_url',model.cost_source_url,
  'pricing',model.capabilities->'pricing','catalog_revision',model.revision);
 return new;
end $$;
revoke all on function public.ai_model_freeze_pricing() from public,anon,authenticated;
grant execute on function public.ai_model_freeze_pricing() to service_role;
create trigger freeze_owner_pricing before insert on public.ai_model_call
 for each row execute function public.ai_model_freeze_pricing();

create table public.ai_provider_connection (
 provider text primary key check(provider='replicate'),
 configured boolean not null,connected boolean not null,
 account_username text,http_status integer,message text,checked_at timestamptz not null default now()
);
alter table public.ai_provider_connection enable row level security;
revoke all on public.ai_provider_connection from public,anon,authenticated;
grant select on public.ai_provider_connection to authenticated;
grant select,insert,update on public.ai_provider_connection to service_role;
create policy owner_read_connection on public.ai_provider_connection for select to authenticated
 using ((select auth.uid())='fd3ceec1-0d99-4d7e-9793-284e342efe90'::uuid);
