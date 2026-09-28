create or replace function public.admin_review_product_placement(
  p_request_id uuid,
  p_action text,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.product_placement_request;
  asset_id text;
  start_at timestamptz;
  end_at timestamptz;
  placement_tags jsonb;
begin
  if not public.is_admin() then raise exception 'Admin required'; end if;

  select * into r from public.product_placement_request where id = p_request_id for update;
  if not found then raise exception 'Product placement request not found'; end if;

  if p_action = 'reject' then
    update public.product_placement_request
       set review_status='rejected', placement_status='inactive',
           admin_notes=p_notes, updated_at=now()
     where id=p_request_id;
    return jsonb_build_object('status','rejected');
  end if;

  if p_action <> 'approve' then raise exception 'Unsupported action'; end if;
  if r.payment_status <> 'paid' then raise exception 'Placement must be paid before approval'; end if;
  if not r.rights_confirmed or not r.terms_accepted then raise exception 'Rights and terms must be confirmed'; end if;

  start_at := coalesce(r.starts_at, now());
  end_at := start_at + make_interval(days => greatest(coalesce(r.duration_days, 365), 1));

  select jsonb_agg(to_jsonb(tag_value))
    into placement_tags
    from (
      select distinct value as tag_value
      from jsonb_array_elements_text(coalesce(r.tags, '[]'::jsonb))
      union
      select 'product-placement'
    ) s;
  placement_tags := coalesce(placement_tags, '["product-placement"]'::jsonb);

  if r.linked_asset_id is null then
    insert into public.catalog_asset (
      owner_id, title, creator_name, description, category_id, subcategory_id,
      tags, preview_images, featured_image, credit_cost, credit_cost_influencer,
      credit_cost_production, credit_cost_brands, status, is_featured,
      rights_confirmed, rights_source, is_digital_download,
      is_product_placement, placement_request_id, placement_expires_at,
      placement_product_url, placement_source_name, created_by_id
    ) values (
      r.submitter_id, r.product_name, coalesce(nullif(r.company_name,''), nullif(r.contact_name,''), r.submitter_email),
      r.product_description, r.category_id, r.subcategory_id,
      placement_tags, r.preview_images, r.featured_image, 0, 0, 0, 0, 'published',
      r.includes_featured, true, 'Paid product placement submission', false,
      true, r.id, end_at, r.product_url, coalesce(nullif(r.company_name,''), r.submitter_email),
      r.submitter_id::text
    ) returning id into asset_id;
  else
    asset_id := r.linked_asset_id;
    update public.catalog_asset
       set title=r.product_name,
           creator_name=coalesce(nullif(r.company_name,''), nullif(r.contact_name,''), r.submitter_email),
           description=r.product_description,
           category_id=r.category_id,
           subcategory_id=r.subcategory_id,
           tags=placement_tags,
           preview_images=r.preview_images,
           featured_image=r.featured_image,
           status='published',
           is_featured=r.includes_featured,
           rights_confirmed=true,
           credit_cost=0,
           credit_cost_influencer=0,
           credit_cost_production=0,
           credit_cost_brands=0,
           is_product_placement=true,
           placement_expires_at=end_at,
           placement_product_url=r.product_url,
           placement_source_name=coalesce(nullif(r.company_name,''), r.submitter_email),
           updated_at=now()
     where id=asset_id;
  end if;

  update public.product_placement_request
     set review_status='approved', placement_status='active',
         starts_at=start_at, expires_at=end_at, linked_asset_id=asset_id,
         admin_notes=p_notes, updated_at=now()
   where id=p_request_id;

  return jsonb_build_object('status','approved','asset_id',asset_id,'expires_at',end_at);
end;
$$;