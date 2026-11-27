CREATE OR REPLACE FUNCTION public.admin_ai_cost_estimates(p_range text DEFAULT '30d'::text)
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
 select split_part(c.route_key,'|',1) as tool,c.model_key,c.prediction_id,
 case when c.status='succeeded' or o.provider_status='succeeded' then
 case when c.rate_snapshot->>'unit_price_usd' ~ '^[0-9]+([.][0-9]+)?$' then
 case when c.rate_snapshot->>'billing_type'='prediction' then (c.rate_snapshot->>'unit_price_usd')::numeric
 when c.rate_snapshot->>'billing_type'='runtime_seconds' and o.predict_seconds is not null then (c.rate_snapshot->>'unit_price_usd')::numeric*o.predict_seconds end end end as estimated_usd
 from public.ai_model_call c left join public.analytics_ai_prediction_observation o on o.prediction_id=c.prediction_id where c.created_at between s and e
 ), grouped as (select tool,model_key,count(*) as calls,count(estimated_usd) as priced_calls,sum(estimated_usd) as estimated_usd from calls group by 1,2)
 select jsonb_build_object('estimated_usd',(select sum(estimated_usd) from calls),'priced_calls',(select count(estimated_usd) from calls),'total_calls',(select count(*) from calls),'by_model',(select coalesce(jsonb_agg(to_jsonb(g) order by g.calls desc),'[]'::jsonb) from grouped g)) into result;
 return result;
end $function$
;
revoke all on function public.admin_ai_cost_estimates(text) from public,anon;
grant execute on function public.admin_ai_cost_estimates(text) to authenticated;
