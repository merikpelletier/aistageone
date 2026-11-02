create or replace function public.protect_published_ai_pilot_block()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' and exists (
    select 1
    from public.ai_pilot_versions v
    where v.id = old.version_id
      and v.is_published = true
  ) then
    raise exception 'Blocks in a published AI Pilot version cannot be deleted';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;
