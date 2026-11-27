create table public.analytics_navigation_event (
 id uuid primary key,
 recorded_at timestamptz not null default now(),
 event_type text not null check(event_type in ('page_view','waitlist_success','team_success')),
 site text not null check(site in ('aistage','leplateau')),
 route text not null check(route in ('/','/index','/studio','/membership','/myprojects','/myaipilots','/mobile','/dossier','/other')),
 source text not null default '' check(source ~ '^[a-zA-Z0-9_.-]{0,80}$'),
 medium text not null default '' check(medium ~ '^[a-zA-Z0-9_.-]{0,80}$'),
 campaign text not null default '' check(campaign ~ '^[a-zA-Z0-9_.-]{0,120}$'),
 referrer text not null default '' check(referrer ~ '^[a-zA-Z0-9.-]{0,253}$')
);
alter table public.analytics_navigation_event enable row level security;
revoke all on public.analytics_navigation_event from public,anon,authenticated;
create index analytics_navigation_recorded_idx on public.analytics_navigation_event(recorded_at);
create function public.record_analytics_navigation(p_id uuid,p_event text,p_site text,p_route text,p_source text default '',p_medium text default '',p_campaign text default '',p_referrer text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_event <> 'page_view' and p_route <> '/' then raise exception 'invalid_conversion_route'; end if;
 insert into public.analytics_navigation_event(id,event_type,site,route,source,medium,campaign,referrer)
 values(p_id,p_event,p_site,p_route,p_source,p_medium,p_campaign,p_referrer) on conflict(id) do nothing;
end $$;
revoke all on function public.record_analytics_navigation(uuid,text,text,text,text,text,text,text) from public;
grant execute on function public.record_analytics_navigation(uuid,text,text,text,text,text,text,text) to anon,authenticated;
create function public.admin_traffic_snapshot(p_range text default '30d')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s timestamptz; e timestamptz:=now(); result jsonb;
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 s:=case p_range when 'today' then date_trunc('day',e at time zone 'America/Toronto') at time zone 'America/Toronto' when '7d' then e-interval '7 days' when '30d' then e-interval '30 days' when '90d' then e-interval '90 days' else null end;
 if s is null then raise exception 'invalid_range'; end if;
 select jsonb_build_object('from',s,'to',e,
 'page_views',(select count(*) from public.analytics_navigation_event where recorded_at between s and e and event_type='page_view'),
 'waitlist_total',(select count(*) from public.waitlist_subscribers where created_at between s and e),
 'team_total',(select count(*) from public.team_applications where created_at between s and e),
 'by_route',(select coalesce(jsonb_agg(to_jsonb(t) order by t.views desc),'[]'::jsonb) from (select route,count(*) as views from public.analytics_navigation_event where recorded_at between s and e and event_type='page_view' group by route order by count(*) desc limit 30)t),
 'by_site',(select coalesce(jsonb_agg(to_jsonb(t) order by t.views desc),'[]'::jsonb) from (select site,count(*) filter(where event_type='page_view') as views,count(*) filter(where event_type='waitlist_success') as waitlist,count(*) filter(where event_type='team_success') as team from public.analytics_navigation_event where recorded_at between s and e group by site)t),
 'by_source',(select coalesce(jsonb_agg(to_jsonb(t) order by t.views desc),'[]'::jsonb) from (select coalesce(nullif(source,''),nullif(referrer,''),'direct') as source,count(*) filter(where event_type='page_view') as views,count(*) filter(where event_type='waitlist_success') as waitlist,count(*) filter(where event_type='team_success') as team from public.analytics_navigation_event where recorded_at between s and e group by 1 order by 2 desc limit 30)t),
 'by_campaign',(select coalesce(jsonb_agg(to_jsonb(t) order by t.views desc),'[]'::jsonb) from (select site,source,medium,campaign,count(*) filter(where event_type='page_view') as views,count(*) filter(where event_type='waitlist_success') as waitlist,count(*) filter(where event_type='team_success') as team from public.analytics_navigation_event where recorded_at between s and e and campaign<>'' group by site,source,medium,campaign order by 5 desc limit 50)t),
 'by_day',(select coalesce(jsonb_agg(to_jsonb(t) order by t.event_day),'[]'::jsonb) from (select (recorded_at at time zone 'America/Toronto')::date as event_day,count(*) as views from public.analytics_navigation_event where recorded_at between s and e and event_type='page_view' group by 1)t)
 ) into result; return result;
end $$;
revoke all on function public.admin_traffic_snapshot(text) from public,anon;
grant execute on function public.admin_traffic_snapshot(text) to authenticated;
