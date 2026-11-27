create table public.marketing_publication_drafts (
 id uuid primary key default gen_random_uuid(),
 brand text not null check (brand in ('aistage','leplateau')),
 campaign_id uuid references public.marketing_campaigns(id) on delete restrict,
 network text not null check (network in ('facebook','instagram','youtube')),
 title text not null check(length(trim(title)) between 1 and 200),
 caption text not null default '' check(length(caption)<=10000),
 hashtags text not null default '' check(length(hashtags)<=1000),
 destination_path text not null default '/' check(destination_path ~ '^/[^?#]*$' and destination_path not like '//%' and position(chr(92) in destination_path)=0 and length(destination_path)<=1000),
 media_ids uuid[] not null default '{}' check(cardinality(media_ids)<=10),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.marketing_publication_drafts enable row level security;
revoke all on public.marketing_publication_drafts from public,anon,authenticated;
grant select,insert,update on public.marketing_publication_drafts to authenticated;
create policy marketing_draft_read on public.marketing_publication_drafts for select to authenticated using ((select public.is_admin()));
create policy marketing_draft_insert on public.marketing_publication_drafts for insert to authenticated with check ((select public.is_admin()));
create policy marketing_draft_update on public.marketing_publication_drafts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create function public.marketing_validate_publication_draft() returns trigger language plpgsql set search_path='' as $$
begin
 if new.campaign_id is not null and not exists(select 1 from public.marketing_campaigns c where c.id=new.campaign_id and c.brand=new.brand and c.status<>'archived') then raise exception 'invalid_campaign';end if;
 if exists(select 1 from unnest(new.media_ids) m(id) where not exists(select 1 from public.marketing_media a where a.id=m.id and a.authorized and not a.archived and a.brand in(new.brand,'both') and a.language in(case new.brand when 'aistage' then 'en' else 'fr' end,'both') and a.media_type in('image','video'))) then raise exception 'invalid_media';end if;
 if cardinality(new.media_ids)<>(select count(distinct m) from unnest(new.media_ids) m) then raise exception 'duplicate_media';end if;
 if new.network='youtube' and (cardinality(new.media_ids)>1 or exists(select 1 from public.marketing_media where id=any(new.media_ids) and media_type<>'video')) then raise exception 'youtube_video_only';end if;
 new.updated_at=now();return new;
end $$;
create trigger marketing_validate_publication_draft before insert or update on public.marketing_publication_drafts for each row execute function public.marketing_validate_publication_draft();
