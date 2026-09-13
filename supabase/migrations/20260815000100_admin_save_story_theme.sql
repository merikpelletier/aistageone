create or replace function public.admin_save_story_theme(
  theme_id text,
  theme_values jsonb
)
returns public.story_theme
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_theme public.story_theme;
  allowed_values jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  -- Only the explicitly referenced keys below can reach the table.
  allowed_values := coalesce(theme_values, '{}'::jsonb);

  if nullif(btrim(allowed_values ->> 'title'), '') is null
    or nullif(btrim(allowed_values ->> 'type'), '') is null
    or nullif(btrim(allowed_values ->> 'description'), '') is null then
    raise exception 'Title, type and description are required' using errcode = '22023';
  end if;

  if theme_id is null then
    insert into public.story_theme (
      created_by_id,
      created_by,
      title,
      type,
      description,
      tone_rules,
      story_rules,
      credit_cost_per_block,
      cover_image,
      cover_template_image,
      is_active,
      "order"
    ) values (
      (select auth.uid())::text,
      (select auth.jwt() ->> 'email'),
      allowed_values ->> 'title',
      allowed_values ->> 'type',
      allowed_values ->> 'description',
      allowed_values ->> 'tone_rules',
      allowed_values ->> 'story_rules',
      coalesce((allowed_values ->> 'credit_cost_per_block')::double precision, 10),
      allowed_values ->> 'cover_image',
      allowed_values ->> 'cover_template_image',
      coalesce((allowed_values ->> 'is_active')::boolean, true),
      coalesce((allowed_values ->> 'order')::double precision, 0)
    )
    returning * into saved_theme;
  else
    update public.story_theme
    set title = allowed_values ->> 'title',
        type = allowed_values ->> 'type',
        description = allowed_values ->> 'description',
        tone_rules = allowed_values ->> 'tone_rules',
        story_rules = allowed_values ->> 'story_rules',
        credit_cost_per_block = coalesce((allowed_values ->> 'credit_cost_per_block')::double precision, 10),
        cover_image = allowed_values ->> 'cover_image',
        cover_template_image = allowed_values ->> 'cover_template_image',
        is_active = coalesce((allowed_values ->> 'is_active')::boolean, true),
        "order" = coalesce((allowed_values ->> 'order')::double precision, 0)
    where id = theme_id
    returning * into saved_theme;

    if saved_theme.id is null then
      raise exception 'StoryTheme not found' using errcode = 'P0002';
    end if;
  end if;

  return saved_theme;
end;
$$;

revoke all on function public.admin_save_story_theme(text, jsonb) from public;
grant execute on function public.admin_save_story_theme(text, jsonb) to authenticated;
