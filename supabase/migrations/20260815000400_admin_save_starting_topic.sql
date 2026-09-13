create or replace function public.admin_save_starting_topic(
  topic_id text,
  topic_values jsonb
)
returns public.starting_topic
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_topic public.starting_topic;
  values_json jsonb := coalesce(topic_values, '{}'::jsonb);
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if nullif(btrim(values_json ->> 'title'), '') is null
    or nullif(btrim(values_json ->> 'description'), '') is null
    or nullif(btrim(values_json ->> 'theme_id'), '') is null then
    raise exception 'Title, description and theme are required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.story_theme
    where id = values_json ->> 'theme_id'
  ) then
    raise exception 'StoryTheme not found' using errcode = 'P0002';
  end if;

  if topic_id is null then
    insert into public.starting_topic (
      created_by_id,
      created_by,
      title,
      description,
      theme_id,
      "order",
      character_ids,
      sim_opening_situation,
      sim_world_conditions,
      sim_public_facts,
      sim_private_facts_by_character,
      sim_hero_initial_goals,
      sim_initial_active_situations
    ) values (
      (select auth.uid())::text,
      (select auth.jwt() ->> 'email'),
      values_json ->> 'title',
      values_json ->> 'description',
      values_json ->> 'theme_id',
      coalesce((values_json ->> 'order')::double precision, 0),
      coalesce(values_json -> 'character_ids', '[]'::jsonb),
      values_json ->> 'sim_opening_situation',
      coalesce(values_json -> 'sim_world_conditions', '[]'::jsonb),
      coalesce(values_json -> 'sim_public_facts', '[]'::jsonb),
      coalesce(values_json -> 'sim_private_facts_by_character', '[]'::jsonb),
      coalesce(values_json -> 'sim_hero_initial_goals', '[]'::jsonb),
      coalesce(values_json -> 'sim_initial_active_situations', '[]'::jsonb)
    ) returning * into saved_topic;
  else
    update public.starting_topic set
      title = values_json ->> 'title',
      description = values_json ->> 'description',
      theme_id = values_json ->> 'theme_id',
      "order" = coalesce((values_json ->> 'order')::double precision, 0),
      character_ids = coalesce(values_json -> 'character_ids', '[]'::jsonb),
      sim_opening_situation = values_json ->> 'sim_opening_situation',
      sim_world_conditions = coalesce(values_json -> 'sim_world_conditions', '[]'::jsonb),
      sim_public_facts = coalesce(values_json -> 'sim_public_facts', '[]'::jsonb),
      sim_private_facts_by_character = coalesce(values_json -> 'sim_private_facts_by_character', '[]'::jsonb),
      sim_hero_initial_goals = coalesce(values_json -> 'sim_hero_initial_goals', '[]'::jsonb),
      sim_initial_active_situations = coalesce(values_json -> 'sim_initial_active_situations', '[]'::jsonb)
    where id = topic_id
    returning * into saved_topic;

    if saved_topic.id is null then
      raise exception 'StartingTopic not found' using errcode = 'P0002';
    end if;
  end if;

  return saved_topic;
end;
$$;

revoke all on function public.admin_save_starting_topic(text, jsonb) from public;
grant execute on function public.admin_save_starting_topic(text, jsonb) to authenticated;
