alter table public.marketing_publication_drafts add column planned_at timestamptz, add column approved_at timestamptz, add column approved_by uuid;
create function public.marketing_publication_approval_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.approved_at=null;new.approved_by=null;return new;end if;
 if row(new.brand,new.campaign_id,new.network,new.title,new.caption,new.hashtags,new.destination_path,new.media_ids,new.planned_at) is distinct from row(old.brand,old.campaign_id,old.network,old.title,old.caption,old.hashtags,old.destination_path,old.media_ids,old.planned_at) then new.approved_at=null;new.approved_by=null;
 elsif new.approved_at is distinct from old.approved_at or new.approved_by is distinct from old.approved_by then
 if new.approved_at is null then new.approved_by=null;
 else
 if not public.is_admin() or auth.uid() is null or new.planned_at is null or new.planned_at<=now() or (new.network in ('instagram','youtube') and cardinality(new.media_ids)=0) then raise exception 'approval_requirements';end if;
 new.approved_at=now();new.approved_by=auth.uid();
 end if;
 end if;
 return new;
end $$;
create trigger marketing_approval_guard before insert or update on public.marketing_publication_drafts for each row execute function public.marketing_publication_approval_guard();
