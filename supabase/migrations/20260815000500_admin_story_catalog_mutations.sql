create or replace function public.admin_delete_starting_topic(topic_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  delete from public.starting_topic where id = topic_id;
  if not found then
    raise exception 'StartingTopic not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_delete_story_theme(theme_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  delete from public.starting_topic where starting_topic.theme_id = admin_delete_story_theme.theme_id;
  delete from public.story_theme where id = theme_id;
  if not found then
    raise exception 'StoryTheme not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_delete_story_character(character_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  update public.story_theme
  set story_character_ids = coalesce(story_character_ids, '[]'::jsonb) - character_id
  where coalesce(story_character_ids, '[]'::jsonb) ? character_id;
  update public.starting_topic
  set character_ids = coalesce(character_ids, '[]'::jsonb) - character_id
  where coalesce(character_ids, '[]'::jsonb) ? character_id;
  delete from public.story_character where id = character_id;
  if not found then
    raise exception 'StoryCharacter not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_delete_story_set(set_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  update public.story_theme
  set story_set_ids = coalesce(story_set_ids, '[]'::jsonb) - set_id
  where coalesce(story_set_ids, '[]'::jsonb) ? set_id;
  delete from public.story_set where id = set_id;
  if not found then
    raise exception 'StorySet not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_set_story_theme_media(theme_id text, media_urls jsonb)
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
  set media_urls = coalesce(admin_set_story_theme_media.media_urls, '[]'::jsonb)
  where id = theme_id
  returning * into saved_theme;
  if saved_theme.id is null then
    raise exception 'StoryTheme not found' using errcode = 'P0002';
  end if;
  return saved_theme;
end;
$$;

revoke all on function public.admin_delete_starting_topic(text) from public;
revoke all on function public.admin_delete_story_theme(text) from public;
revoke all on function public.admin_delete_story_character(text) from public;
revoke all on function public.admin_delete_story_set(text) from public;
revoke all on function public.admin_set_story_theme_media(text, jsonb) from public;
grant execute on function public.admin_delete_starting_topic(text) to authenticated;
grant execute on function public.admin_delete_story_theme(text) to authenticated;
grant execute on function public.admin_delete_story_character(text) to authenticated;
grant execute on function public.admin_delete_story_set(text) to authenticated;
grant execute on function public.admin_set_story_theme_media(text, jsonb) to authenticated;
