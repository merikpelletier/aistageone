create table public.analytics_ai_prediction_observation (prediction_id text primary key,observed_at timestamptz not null default now(),provider_status text check(provider_status in ('starting','processing','succeeded','failed','canceled','aborted')),http_status integer not null check(http_status between 100 and 599),predict_seconds numeric check(predict_seconds>=0),total_seconds numeric check(total_seconds>=0));
alter table public.analytics_ai_prediction_observation enable row level security;
revoke all on public.analytics_ai_prediction_observation from public,anon,authenticated;
grant select,insert,update on public.analytics_ai_prediction_observation to service_role;
CREATE OR REPLACE FUNCTION public.admin_ai_analytics_snapshot(p_range text DEFAULT '30d'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s timestamptz; e timestamptz:=now(); result jsonb;
begin
 if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 s:=case p_range when 'today' then date_trunc('day',e at time zone 'America/Toronto') at time zone 'America/Toronto' when '7d' then e-interval '7 days' when '30d' then e-interval '30 days' when '90d' then e-interval '90 days' else null end;
 if s is null then raise exception 'invalid_range'; end if;
 with calls as (
 select c.model_key,c.route_key,c.prediction_id,c.status original_status,
 case when c.status in ('succeeded','failed','canceled','aborted') then c.status
 else coalesce(o.provider_status,c.status) end as effective_status,
 o.observed_at,o.http_status
 from public.ai_model_call c left join public.analytics_ai_prediction_observation o on o.prediction_id=c.prediction_id
 where c.created_at between s and e
 ), grouped as (
 select split_part(route_key,'|',1) as tool,model_key,count(*) as calls,
 count(*) filter(where effective_status='succeeded') as succeeded,
 count(*) filter(where effective_status in ('failed','transport_error') or effective_status ~ '^[45][0-9]{2}$') as failed,
 count(*) filter(where effective_status in ('canceled','aborted')) as canceled,
 count(*) filter(where effective_status is null or (effective_status not in ('succeeded','failed','transport_error','canceled','aborted') and effective_status !~ '^[45][0-9]{2}$')) as unresolved
 from calls group by 1,2
 )
 select jsonb_build_object(
 'from',s,'to',e,
 'calls',(select count(*) from calls),
 'succeeded',(select count(*) from calls where effective_status='succeeded'),
 'failed',(select count(*) from calls where effective_status in ('failed','transport_error') or effective_status ~ '^[45][0-9]{2}$'),
 'canceled',(select count(*) from calls where effective_status in ('canceled','aborted')),
 'unresolved',(select count(*) from calls where effective_status is null or (effective_status not in ('succeeded','failed','transport_error','canceled','aborted') and effective_status !~ '^[45][0-9]{2}$')),
 'checked_predictions',(select count(distinct prediction_id) from calls where observed_at is not null and http_status between 200 and 299),
 'unavailable_predictions',(select count(distinct prediction_id) from calls where http_status in (403,404,410)),
 'last_provider_check',(select max(observed_at) from calls),
 'legacy_events',(select count(*) from public.ai_usage_event where created_at between s and e),
 'legacy_last_event',(select max(created_at) from public.ai_usage_event),
 'recorded_cost_cad',(select sum(cost_cad) from public.ai_usage_event where created_at between s and e),
 'cost_records',(select count(cost_cad) from public.ai_usage_event where created_at between s and e),
 'credits_consumed',(select coalesce(sum(credit_cost),0) from public.ai_credit_charge where not coalesce(is_sample,false) and status='consumed' and created_at between s and e),
 'credits_refunded',(select coalesce(sum(credit_cost),0) from public.ai_credit_charge where not coalesce(is_sample,false) and status='refunded' and created_at between s and e),
 'by_model',(select coalesce(jsonb_agg(to_jsonb(g) order by g.calls desc),'[]'::jsonb) from grouped g)
 ) into result;
 return result;
end $function$
;
revoke all on function public.admin_ai_analytics_snapshot(text) from public,anon;
grant execute on function public.admin_ai_analytics_snapshot(text) to authenticated;
CREATE OR REPLACE FUNCTION public.analytics_pending_predictions(p_limit integer DEFAULT 30)
 RETURNS TABLE(prediction_id text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select c.prediction_id from public.ai_model_call c
 left join public.analytics_ai_prediction_observation o on o.prediction_id=c.prediction_id
 where c.prediction_id is not null and c.status in ('starting','processing','submitted')
 and c.created_at>now()-interval '90 days'
 and (o.prediction_id is null or (coalesce(o.provider_status,'') not in ('succeeded','failed','canceled','aborted') and o.http_status not in (403,404,410) and o.observed_at<now()-interval '15 minutes'))
 group by c.prediction_id order by min(c.created_at) asc limit greatest(1,least(p_limit,50));
$function$
;
revoke all on function public.analytics_pending_predictions(integer) from public,anon,authenticated;
grant execute on function public.analytics_pending_predictions(integer) to service_role;
