create table public.marketing_social_config (
 brand text not null check(brand in ('aistage','leplateau')),
 provider text not null check(provider in ('meta','youtube')),
 client_id text not null check(length(client_id) between 1 and 512),
 secret_id uuid not null,
 updated_at timestamptz not null default now(),
 primary key(brand,provider)
);
alter table public.marketing_social_config enable row level security;
revoke all on public.marketing_social_config from public,anon,authenticated;
grant select,insert,update,delete on public.marketing_social_config to service_role;
create function public.marketing_social_save_config(p_brand text,p_provider text,p_client_id text,p_secret text) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 if p_brand not in ('aistage','leplateau') or p_provider not in ('meta','youtube') or length(trim(p_client_id)) not between 1 and 512 or length(p_secret) not between 1 and 4096 then raise exception 'invalid_configuration'; end if;
 perform pg_advisory_xact_lock(hashtextextended('marketing-social:'||p_brand||':'||p_provider,0));
 select secret_id into sid from public.marketing_social_config where brand=p_brand and provider=p_provider;
 if sid is null then sid:=vault.create_secret(p_secret,'marketing-social-'||p_brand||'-'||p_provider,'Marketing OAuth client secret');
 else perform vault.update_secret(sid,p_secret); end if;
 insert into public.marketing_social_config(brand,provider,client_id,secret_id) values(p_brand,p_provider,trim(p_client_id),sid) on conflict(brand,provider) do update set client_id=excluded.client_id,secret_id=excluded.secret_id,updated_at=now();
end $$;
revoke all on function public.marketing_social_save_config(text,text,text,text) from public,anon;
grant execute on function public.marketing_social_save_config(text,text,text,text) to authenticated;
create function public.marketing_social_list_config() returns table(brand text,provider text,client_id text,updated_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 return query select c.brand,c.provider,c.client_id,c.updated_at from public.marketing_social_config c;
end $$;
revoke all on function public.marketing_social_list_config() from public,anon;
grant execute on function public.marketing_social_list_config() to authenticated;
