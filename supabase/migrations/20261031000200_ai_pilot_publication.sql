create or replace function public.publish_ai_pilot_version(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pilot_id uuid;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Admin access required';
  end if;

  select v.ai_pilot_id
    into v_pilot_id
  from public.ai_pilot_versions v
  where v.id = p_version_id
    and v.is_published = false;

  if v_pilot_id is null then
    raise exception 'Draft AI Pilot version not found';
  end if;

  if not exists (
    select 1
    from public.ai_pilot_blocks b
    where b.version_id = p_version_id
      and b.is_active = true
  ) then
    raise exception 'AI Pilot version requires at least one active direction block';
  end if;

  update public.ai_pilot_versions
  set is_published = true,
      published_at = now()
  where id = p_version_id;

  update public.ai_pilots
  set current_published_version_id = p_version_id,
      status = 'published',
      published_at = coalesce(published_at, now())
  where id = v_pilot_id;
end;
$$;

revoke all on function public.publish_ai_pilot_version(uuid) from public, anon;
grant execute on function public.publish_ai_pilot_version(uuid) to authenticated;

create or replace function public.protect_published_ai_pilot_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.is_published = true then
    raise exception 'Published AI Pilot versions are immutable';
  end if;

  if tg_op = 'DELETE' and old.is_published = true then
    raise exception 'Published AI Pilot versions cannot be deleted';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_published_ai_pilot_version on public.ai_pilot_versions;
create trigger protect_published_ai_pilot_version
before update or delete on public.ai_pilot_versions
for each row execute function public.protect_published_ai_pilot_version();

create or replace function public.protect_published_ai_pilot_block()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version_id uuid;
begin
  if tg_op = 'DELETE' then
    v_version_id := old.version_id;
  else
    v_version_id := new.version_id;
  end if;

  if exists (
    select 1
    from public.ai_pilot_versions v
    where v.id = v_version_id
      and v.is_published = true
  ) then
    raise exception 'Blocks in a published AI Pilot version are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_published_ai_pilot_block on public.ai_pilot_blocks;
create trigger protect_published_ai_pilot_block
before insert or update or delete on public.ai_pilot_blocks
for each row execute function public.protect_published_ai_pilot_block();
