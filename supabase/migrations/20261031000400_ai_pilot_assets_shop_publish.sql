alter table public.ai_pilots
  add column if not exists asset_subcategory_id text
  references public.asset_subcategory(id)
  on delete set null;

create or replace function public.publish_ai_pilot_version(p_version_id uuid)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  v_pilot public.ai_pilots%rowtype;
  v_catalog_asset_id text;
  v_ai_pilot_category_id text;
  v_preview_images jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Admin access required';
  end if;

  select p.*
    into v_pilot
  from public.ai_pilot_versions v
  join public.ai_pilots p on p.id = v.ai_pilot_id
  where v.id = p_version_id
    and v.is_published = false;

  if v_pilot.id is null then
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

  if v_pilot.distribution_mode = 'assets_shop' then
    select c.id
      into v_ai_pilot_category_id
    from public.asset_category c
    where c.key = 'ai-pilot'
      and c.is_active = true
    limit 1;

    if v_ai_pilot_category_id is null then
      raise exception 'Active Assets Shop category AI Pilot not found';
    end if;

    if v_pilot.asset_subcategory_id is null or not exists (
      select 1
      from public.asset_subcategory s
      where s.id = v_pilot.asset_subcategory_id
        and s.category_id = v_ai_pilot_category_id
        and s.is_active = true
    ) then
      raise exception 'Select a valid AI Pilot subcategory before publishing';
    end if;

    v_preview_images := case
      when nullif(v_pilot.cover_url, '') is null then '[]'::jsonb
      else jsonb_build_array(v_pilot.cover_url)
    end;

    if v_pilot.catalog_asset_id is not null then
      update public.catalog_asset
      set title = v_pilot.name,
          description = v_pilot.description,
          category_id = v_ai_pilot_category_id,
          subcategory_id = v_pilot.asset_subcategory_id,
          tags = to_jsonb(v_pilot.tags),
          preview_images = v_preview_images,
          featured_image = nullif(v_pilot.cover_url, ''),
          source_id = v_pilot.id::text,
          owner_id = coalesce(owner_id, auth.uid()),
          status = 'published',
          updated_at = now()
      where id = v_pilot.catalog_asset_id
      returning id into v_catalog_asset_id;
    end if;

    if v_catalog_asset_id is null then
      insert into public.catalog_asset (
        source_id,
        owner_id,
        title,
        description,
        category_id,
        subcategory_id,
        tags,
        preview_images,
        featured_image,
        status
      ) values (
        v_pilot.id::text,
        auth.uid(),
        v_pilot.name,
        v_pilot.description,
        v_ai_pilot_category_id,
        v_pilot.asset_subcategory_id,
        to_jsonb(v_pilot.tags),
        v_preview_images,
        nullif(v_pilot.cover_url, ''),
        'published'
      )
      returning id into v_catalog_asset_id;

      update public.ai_pilots
      set catalog_asset_id = v_catalog_asset_id
      where id = v_pilot.id;
    end if;
  end if;

  update public.ai_pilot_versions
  set is_published = true,
      published_at = now()
  where id = p_version_id;

  update public.ai_pilots
  set current_published_version_id = p_version_id,
      status = 'published',
      published_at = coalesce(published_at, now())
  where id = v_pilot.id;
end;
$function$;
