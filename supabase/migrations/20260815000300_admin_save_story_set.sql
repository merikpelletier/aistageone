create or replace function public.admin_save_story_set(
  set_id text,
  set_values jsonb
)
returns public.story_set
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_set public.story_set;
  values_json jsonb := coalesce(set_values, '{}'::jsonb);
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if nullif(btrim(values_json ->> 'name'), '') is null
    or nullif(btrim(values_json ->> 'description'), '') is null then
    raise exception 'Name and description are required' using errcode = '22023';
  end if;

  if set_id is null then
    insert into public.story_set (
      created_by_id, created_by, name, description, tags, images,
      sim_location_type, sim_public_access, sim_crowd_level, sim_visibility,
      sim_privacy, sim_guard_presence, sim_general_danger, sim_ambush_risk,
      sim_surveillance_risk, sim_escape_difficulty, sim_entry_points,
      sim_exit_routes, sim_hiding_places, sim_environmental_hazards,
      sim_suitable_actions, sim_unsuitable_actions, sim_special_rules,
      sim_time_profiles
    ) values (
      (select auth.uid())::text,
      (select auth.jwt() ->> 'email'),
      values_json ->> 'name',
      values_json ->> 'description',
      coalesce(values_json -> 'tags', '[]'::jsonb),
      coalesce(values_json -> 'images', '[]'::jsonb),
      values_json ->> 'sim_location_type',
      values_json ->> 'sim_public_access',
      values_json ->> 'sim_crowd_level',
      values_json ->> 'sim_visibility',
      values_json ->> 'sim_privacy',
      values_json ->> 'sim_guard_presence',
      values_json ->> 'sim_general_danger',
      values_json ->> 'sim_ambush_risk',
      values_json ->> 'sim_surveillance_risk',
      values_json ->> 'sim_escape_difficulty',
      coalesce(values_json -> 'sim_entry_points', '[]'::jsonb),
      coalesce(values_json -> 'sim_exit_routes', '[]'::jsonb),
      coalesce(values_json -> 'sim_hiding_places', '[]'::jsonb),
      coalesce(values_json -> 'sim_environmental_hazards', '[]'::jsonb),
      coalesce(values_json -> 'sim_suitable_actions', '[]'::jsonb),
      coalesce(values_json -> 'sim_unsuitable_actions', '[]'::jsonb),
      coalesce(values_json -> 'sim_special_rules', '[]'::jsonb),
      coalesce(values_json -> 'sim_time_profiles', '[]'::jsonb)
    ) returning * into saved_set;
  else
    update public.story_set set
      name = values_json ->> 'name',
      description = values_json ->> 'description',
      tags = coalesce(values_json -> 'tags', '[]'::jsonb),
      images = coalesce(values_json -> 'images', '[]'::jsonb),
      sim_location_type = values_json ->> 'sim_location_type',
      sim_public_access = values_json ->> 'sim_public_access',
      sim_crowd_level = values_json ->> 'sim_crowd_level',
      sim_visibility = values_json ->> 'sim_visibility',
      sim_privacy = values_json ->> 'sim_privacy',
      sim_guard_presence = values_json ->> 'sim_guard_presence',
      sim_general_danger = values_json ->> 'sim_general_danger',
      sim_ambush_risk = values_json ->> 'sim_ambush_risk',
      sim_surveillance_risk = values_json ->> 'sim_surveillance_risk',
      sim_escape_difficulty = values_json ->> 'sim_escape_difficulty',
      sim_entry_points = coalesce(values_json -> 'sim_entry_points', '[]'::jsonb),
      sim_exit_routes = coalesce(values_json -> 'sim_exit_routes', '[]'::jsonb),
      sim_hiding_places = coalesce(values_json -> 'sim_hiding_places', '[]'::jsonb),
      sim_environmental_hazards = coalesce(values_json -> 'sim_environmental_hazards', '[]'::jsonb),
      sim_suitable_actions = coalesce(values_json -> 'sim_suitable_actions', '[]'::jsonb),
      sim_unsuitable_actions = coalesce(values_json -> 'sim_unsuitable_actions', '[]'::jsonb),
      sim_special_rules = coalesce(values_json -> 'sim_special_rules', '[]'::jsonb),
      sim_time_profiles = coalesce(values_json -> 'sim_time_profiles', '[]'::jsonb)
    where id = set_id
    returning * into saved_set;

    if saved_set.id is null then
      raise exception 'StorySet not found' using errcode = 'P0002';
    end if;
  end if;

  return saved_set;
end;
$$;

create or replace function public.admin_set_story_theme_sets(
  theme_id text,
  set_ids jsonb
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
  set story_set_ids = coalesce(set_ids, '[]'::jsonb)
  where id = theme_id
  returning * into saved_theme;

  if saved_theme.id is null then
    raise exception 'StoryTheme not found' using errcode = 'P0002';
  end if;
  return saved_theme;
end;
$$;

revoke all on function public.admin_save_story_set(text, jsonb) from public;
revoke all on function public.admin_set_story_theme_sets(text, jsonb) from public;
grant execute on function public.admin_save_story_set(text, jsonb) to authenticated;
grant execute on function public.admin_set_story_theme_sets(text, jsonb) to authenticated;
