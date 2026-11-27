create or replace function public.marketing_director_save_plan(p_brand text,p_plan jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare cid uuid; p jsonb;
begin
 if not public.is_admin() then raise exception 'admin_required';end if;
 if p_brand not in ('aistage','leplateau') or jsonb_typeof(p_plan->'posts') is distinct from 'array' or jsonb_array_length(p_plan->'posts') < 1 then raise exception 'invalid_plan';end if;
 insert into public.marketing_campaigns(brand,name,objective,audience,strategy,budget_cad,status,starts_on,ends_on) values(p_brand,left(p_plan->>'name',200),left(coalesce(p_plan->>'objective',''),4000),left(coalesce(p_plan->>'audience',''),4000),left(coalesce(p_plan->>'strategy',''),8000),0,'draft',(select min((value->>'planned_at')::timestamptz at time zone 'America/Toronto')::date from jsonb_array_elements(p_plan->'posts')),(select max((value->>'planned_at')::timestamptz at time zone 'America/Toronto')::date from jsonb_array_elements(p_plan->'posts'))) returning id into cid;
 for p in select value from jsonb_array_elements(p_plan->'posts') loop
 if (p->>'planned_at')::timestamptz<=now() then raise exception 'invalid_schedule';end if;
 insert into public.marketing_publication_drafts(brand,campaign_id,network,title,caption,hashtags,media_ids,planned_at,production_notes) values(p_brand,cid,p->>'network',p->>'title',coalesce(p->>'caption',''),coalesce(p->>'hashtags',''),array(select value::uuid from jsonb_array_elements_text(p->'media_ids')),(p->>'planned_at')::timestamptz,coalesce(p->>'production_notes',''));
 end loop;
 return cid;
end $$;
revoke all on function public.marketing_director_save_plan(text,jsonb) from public,anon,authenticated;
grant execute on function public.marketing_director_save_plan(text,jsonb) to authenticated;
