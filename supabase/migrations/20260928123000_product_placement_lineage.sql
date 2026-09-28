create table if not exists public.media_product_placement_lineage (
  media_url text not null,
  catalog_asset_id text not null references public.catalog_asset(id) on delete cascade,
  placement_request_id uuid,
  brand_name text,
  product_url text,
  source_media_url text,
  created_at timestamptz not null default now(),
  primary key (media_url, catalog_asset_id)
);

create index if not exists media_product_placement_lineage_asset_idx
  on public.media_product_placement_lineage(catalog_asset_id);

alter table public.catalog_asset
  add column if not exists product_placement_sources jsonb not null default '[]'::jsonb;

alter table public.vault_asset
  add column if not exists product_placement_sources jsonb not null default '[]'::jsonb;

alter table public.dossier
  add column if not exists product_placements jsonb not null default '[]'::jsonb;

create or replace function public.sync_catalog_product_placement_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  clean_tags jsonb;
begin
  if coalesce(new.is_product_placement, false) then
    select coalesce(jsonb_agg(to_jsonb(tag_value)), '[]'::jsonb)
      into clean_tags
      from (
        select distinct value as tag_value
        from jsonb_array_elements_text(coalesce(new.tags, '[]'::jsonb))
        union
        select 'product-placement'
      ) s;

    new.tags := clean_tags;
    new.product_placement_sources := jsonb_build_array(
      jsonb_build_object(
        'asset_id', new.id,
        'placement_request_id', new.placement_request_id,
        'brand_name', coalesce(nullif(new.placement_source_name,''), nullif(new.creator_name,''), 'AISTAGE.ONE'),
        'product_url', new.placement_product_url
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists catalog_product_placement_metadata_trg on public.catalog_asset;
create trigger catalog_product_placement_metadata_trg
before insert or update of is_product_placement, tags, placement_request_id, placement_source_name, creator_name, placement_product_url
on public.catalog_asset
for each row execute function public.sync_catalog_product_placement_metadata();

create or replace function public.seed_catalog_product_placement_lineage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  media text;
begin
  if not coalesce(new.is_product_placement, false) or new.status <> 'published' then
    return new;
  end if;

  if nullif(new.featured_image, '') is not null then
    insert into public.media_product_placement_lineage (
      media_url, catalog_asset_id, placement_request_id, brand_name, product_url, source_media_url
    ) values (
      new.featured_image,
      new.id,
      new.placement_request_id,
      coalesce(nullif(new.placement_source_name,''), nullif(new.creator_name,''), 'AISTAGE.ONE'),
      new.placement_product_url,
      new.featured_image
    )
    on conflict (media_url, catalog_asset_id) do update
      set placement_request_id = excluded.placement_request_id,
          brand_name = excluded.brand_name,
          product_url = excluded.product_url;
  end if;

  for media in
    select value
    from jsonb_array_elements_text(coalesce(new.preview_images, '[]'::jsonb))
  loop
    if nullif(media, '') is not null then
      insert into public.media_product_placement_lineage (
        media_url, catalog_asset_id, placement_request_id, brand_name, product_url, source_media_url
      ) values (
        media,
        new.id,
        new.placement_request_id,
        coalesce(nullif(new.placement_source_name,''), nullif(new.creator_name,''), 'AISTAGE.ONE'),
        new.placement_product_url,
        media
      )
      on conflict (media_url, catalog_asset_id) do update
        set placement_request_id = excluded.placement_request_id,
            brand_name = excluded.brand_name,
            product_url = excluded.product_url;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists catalog_product_placement_lineage_trg on public.catalog_asset;
create trigger catalog_product_placement_lineage_trg
after insert or update of status, featured_image, preview_images, is_product_placement, placement_request_id, placement_source_name, creator_name, placement_product_url
on public.catalog_asset
for each row execute function public.seed_catalog_product_placement_lineage();

create or replace function public.inherit_media_product_placements(
  p_output_url text,
  p_input_urls text[]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'service_role required';
  end if;

  if nullif(p_output_url, '') is null or coalesce(array_length(p_input_urls, 1), 0) = 0 then
    return 0;
  end if;

  insert into public.media_product_placement_lineage (
    media_url, catalog_asset_id, placement_request_id, brand_name, product_url, source_media_url
  )
  select distinct
    p_output_url,
    l.catalog_asset_id,
    l.placement_request_id,
    l.brand_name,
    l.product_url,
    l.media_url
  from public.media_product_placement_lineage l
  where l.media_url = any(p_input_urls)
  on conflict (media_url, catalog_asset_id) do update
    set placement_request_id = excluded.placement_request_id,
        brand_name = excluded.brand_name,
        product_url = excluded.product_url,
        source_media_url = excluded.source_media_url;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.sync_vault_product_placement_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sources jsonb;
  clean_tags jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'asset_id', l.catalog_asset_id,
        'placement_request_id', l.placement_request_id,
        'brand_name', l.brand_name,
        'product_url', l.product_url
      )
      order by l.catalog_asset_id
    ),
    '[]'::jsonb
  )
  into sources
  from public.media_product_placement_lineage l
  where l.media_url = new.url;

  new.product_placement_sources := sources;

  if jsonb_array_length(sources) > 0 then
    select coalesce(jsonb_agg(to_jsonb(tag_value)), '[]'::jsonb)
      into clean_tags
      from (
        select distinct value as tag_value
        from jsonb_array_elements_text(coalesce(new.tags, '[]'::jsonb))
        union
        select 'product-placement'
      ) s;
    new.tags := clean_tags;
  end if;

  return new;
end;
$$;

drop trigger if exists vault_product_placement_metadata_trg on public.vault_asset;
create trigger vault_product_placement_metadata_trg
before insert or update of url, tags
on public.vault_asset
for each row execute function public.sync_vault_product_placement_metadata();

create or replace function public.refresh_dossier_product_placements(p_dossier_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  detected jsonb := '[]'::jsonb;
  manual_items jsonb := '[]'::jsonb;
  merged jsonb := '[]'::jsonb;
begin
  with urls as (
    select distinct (v #>> '{}') as media_url
    from (
      select jsonb_path_query(to_jsonb(d), '$.** ? (@.type() == "string")') as v
      from public.dossier d where d.id = p_dossier_id
      union all
      select jsonb_path_query(to_jsonb(dp), '$.** ? (@.type() == "string")') as v
      from public.dossier_page dp where dp.dossier_id = p_dossier_id
      union all
      select jsonb_path_query(to_jsonb(ep), '$.** ? (@.type() == "string")') as v
      from public.episode_production ep where ep.dossier_id = p_dossier_id
      union all
      select jsonb_path_query(to_jsonb(ts), '$.** ? (@.type() == "string")') as v
      from public.timeline_story ts where ts.dossier_id = p_dossier_id
    ) q
    where (v #>> '{}') like 'http%'
  ),
  placements as (
    select distinct on (l.catalog_asset_id)
      l.catalog_asset_id,
      l.placement_request_id,
      coalesce(nullif(l.brand_name,''), nullif(ca.placement_source_name,''), nullif(ca.creator_name,''), 'AISTAGE.ONE') as brand_name,
      ca.title,
      ca.featured_image,
      ca.description,
      coalesce(nullif(l.product_url,''), ca.placement_product_url) as product_url
    from urls u
    join public.media_product_placement_lineage l on l.media_url = u.media_url
    join public.catalog_asset ca on ca.id = l.catalog_asset_id
    where ca.is_product_placement = true
      and ca.status = 'published'
      and (ca.placement_expires_at is null or ca.placement_expires_at > now())
    order by l.catalog_asset_id, ca.title
  ),
  numbered as (
    select *, row_number() over (order by title, catalog_asset_id) - 1 as display_order
    from placements
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', 'auto_' || catalog_asset_id,
        'asset_id', catalog_asset_id,
        'placement_request_id', placement_request_id,
        'name', title,
        'brand_name', brand_name,
        'image_url', featured_image,
        'description', description,
        'url', product_url,
        'page_reference', '',
        'order', display_order,
        'auto_detected', true
      )
      order by display_order
    ),
    '[]'::jsonb
  )
  into detected
  from numbered;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into manual_items
  from public.dossier d,
       lateral jsonb_array_elements(coalesce(d.product_placements, '[]'::jsonb)) item
  where d.id = p_dossier_id
    and coalesce((item->>'auto_detected')::boolean, false) = false;

  merged := manual_items || detected;

  update public.dossier
  set product_placements = merged,
      updated_date = now()
  where id = p_dossier_id;

  return merged;
end;
$$;

create or replace function public.refresh_product_placements_on_publish()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.refresh_dossier_product_placements(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists dossier_product_placements_publish_trg on public.dossier;
create trigger dossier_product_placements_publish_trg
after insert or update of status on public.dossier
for each row execute function public.refresh_product_placements_on_publish();

update public.catalog_asset
set updated_at = updated_at
where is_product_placement = true;

insert into public.media_product_placement_lineage (
  media_url, catalog_asset_id, placement_request_id, brand_name, product_url, source_media_url
)
select
  ca.featured_image,
  ca.id,
  ca.placement_request_id,
  coalesce(nullif(ca.placement_source_name,''), nullif(ca.creator_name,''), 'AISTAGE.ONE'),
  ca.placement_product_url,
  ca.featured_image
from public.catalog_asset ca
where ca.is_product_placement = true
  and ca.status = 'published'
  and nullif(ca.featured_image,'') is not null
on conflict (media_url, catalog_asset_id) do nothing;
