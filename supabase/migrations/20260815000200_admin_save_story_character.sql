create or replace function public.admin_save_story_character(
  character_id text,
  character_values jsonb
)
returns public.story_character
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_character public.story_character;
  values_json jsonb := coalesce(character_values, '{}'::jsonb);
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if nullif(btrim(values_json ->> 'name'), '') is null
    or nullif(btrim(values_json ->> 'description'), '') is null then
    raise exception 'Name and description are required' using errcode = '22023';
  end if;

  if character_id is null then
    insert into public.story_character (
      created_by_id, created_by, name, description, backstory, character_type,
      traits, photos, reference_sheet, reference_sheet_notes,
      reference_sheet_color_palette, reference_sheet_wardrobe_anchors,
      reference_sheet_do_not_change, reference_sheet_style_constraints,
      is_active, sim_starting_story_set_id, sim_goals, sim_immediate_needs,
      sim_relationships, sim_responsibilities, sim_controlled_assets,
      sim_starting_knowledge, sim_starting_beliefs
    ) values (
      (select auth.uid())::text,
      (select auth.jwt() ->> 'email'),
      values_json ->> 'name', values_json ->> 'description', values_json ->> 'backstory',
      values_json ->> 'character_type', coalesce(values_json -> 'traits', '[]'::jsonb),
      coalesce(values_json -> 'photos', '[]'::jsonb), values_json ->> 'reference_sheet',
      values_json ->> 'reference_sheet_notes',
      coalesce(values_json -> 'reference_sheet_color_palette', '[]'::jsonb),
      coalesce(values_json -> 'reference_sheet_wardrobe_anchors', '[]'::jsonb),
      coalesce(values_json -> 'reference_sheet_do_not_change', '[]'::jsonb),
      values_json ->> 'reference_sheet_style_constraints',
      coalesce((values_json ->> 'is_active')::boolean, true),
      values_json ->> 'sim_starting_story_set_id',
      coalesce(values_json -> 'sim_goals', '[]'::jsonb),
      coalesce(values_json -> 'sim_immediate_needs', '[]'::jsonb),
      coalesce(values_json -> 'sim_relationships', '[]'::jsonb),
      coalesce(values_json -> 'sim_responsibilities', '[]'::jsonb),
      coalesce(values_json -> 'sim_controlled_assets', '[]'::jsonb),
      coalesce(values_json -> 'sim_starting_knowledge', '[]'::jsonb),
      coalesce(values_json -> 'sim_starting_beliefs', '[]'::jsonb)
    ) returning * into saved_character;
  else
    update public.story_character set
      name = values_json ->> 'name',
      description = values_json ->> 'description',
      backstory = values_json ->> 'backstory',
      character_type = values_json ->> 'character_type',
      traits = coalesce(values_json -> 'traits', '[]'::jsonb),
      photos = coalesce(values_json -> 'photos', '[]'::jsonb),
      reference_sheet = values_json ->> 'reference_sheet',
      reference_sheet_notes = values_json ->> 'reference_sheet_notes',
      reference_sheet_color_palette = coalesce(values_json -> 'reference_sheet_color_palette', '[]'::jsonb),
      reference_sheet_wardrobe_anchors = coalesce(values_json -> 'reference_sheet_wardrobe_anchors', '[]'::jsonb),
      reference_sheet_do_not_change = coalesce(values_json -> 'reference_sheet_do_not_change', '[]'::jsonb),
      reference_sheet_style_constraints = values_json ->> 'reference_sheet_style_constraints',
      is_active = coalesce((values_json ->> 'is_active')::boolean, true),
      sim_starting_story_set_id = values_json ->> 'sim_starting_story_set_id',
      sim_goals = coalesce(values_json -> 'sim_goals', '[]'::jsonb),
      sim_immediate_needs = coalesce(values_json -> 'sim_immediate_needs', '[]'::jsonb),
      sim_relationships = coalesce(values_json -> 'sim_relationships', '[]'::jsonb),
      sim_responsibilities = coalesce(values_json -> 'sim_responsibilities', '[]'::jsonb),
      sim_controlled_assets = coalesce(values_json -> 'sim_controlled_assets', '[]'::jsonb),
      sim_starting_knowledge = coalesce(values_json -> 'sim_starting_knowledge', '[]'::jsonb),
      sim_starting_beliefs = coalesce(values_json -> 'sim_starting_beliefs', '[]'::jsonb)
    where id = character_id
    returning * into saved_character;

    if saved_character.id is null then
      raise exception 'StoryCharacter not found' using errcode = 'P0002';
    end if;
  end if;

  return saved_character;
end;
$$;

create or replace function public.admin_set_story_theme_characters(
  theme_id text,
  character_ids jsonb
)
returns public.story_theme
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_theme public.story_theme;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.story_theme
  set story_character_ids = coalesce(character_ids, '[]'::jsonb)
  where id = theme_id
  returning * into saved_theme;

  if saved_theme.id is null then
    raise exception 'StoryTheme not found' using errcode = 'P0002';
  end if;
  return saved_theme;
end;
$$;

revoke all on function public.admin_save_story_character(text, jsonb) from public;
revoke all on function public.admin_set_story_theme_characters(text, jsonb) from public;
grant execute on function public.admin_save_story_character(text, jsonb) to authenticated;
grant execute on function public.admin_set_story_theme_characters(text, jsonb) to authenticated;
