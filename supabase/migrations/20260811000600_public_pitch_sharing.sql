-- Public pitch-deck delivery.
-- The underlying tables remain private: this function only returns the fields
-- required by the standalone presentation for decks explicitly published by
-- their owner.

create or replace function public.get_public_pitch(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', p.id,
      'working_title', p.working_title,
      'final_title', p.final_title,
      'tagline', p.tagline,
      'project_type', p.project_type,
      'genre', p.genre,
      'subgenre', p.subgenre,
      'format', p.format,
      'original_language', p.original_language,
      'selected_template_id', p.selected_template_id,
      'source_custom_background_url', p.source_custom_background_url,
      'hook_headline', p.hook_headline,
      'logline_short', p.logline_short,
      'logline_full', p.logline_full,
      'share_slug', p.share_slug
    ),
    'sections', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'section_type', s.section_type,
            'title', s.title,
            'subtitle', s.subtitle,
            'body', s.body,
            'original_language', s.original_language,
            'source_media_url', s.source_media_url,
            'source_media_cover_url', s.source_media_cover_url,
            'gallery_media', s.gallery_media,
            'show_text', s.show_text,
            'order_index', s.order_index,
            'layout_type', s.layout_type,
            'transition_type', s.transition_type,
            'is_visible', s.is_visible
          ) order by s.order_index
        ),
        '[]'::jsonb
      )
      from public.pitch_section s
      where s.pitch_project_id = p.id and s.is_visible = true
    ),
    'media', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'title', m.title,
            'media_type', m.media_type,
            'source_media_url', m.source_media_url,
            'source_thumbnail_url', m.source_thumbnail_url,
            'display_order', m.display_order
          ) order by m.display_order
        ),
        '[]'::jsonb
      )
      from public.pitch_media m
      where m.pitch_project_id = p.id
    ),
    'characters', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'role', c.role,
            'description', c.description,
            'source_image_url', c.source_image_url,
            'display_order', c.display_order
          ) order by c.display_order
        ),
        '[]'::jsonb
      )
      from public.pitch_character c
      where c.pitch_project_id = p.id
    )
  )
  from public.pitch_project p
  where p.share_slug = p_slug
    and p.is_published = true
    and p.share_access_type = 'link'
    and p.archived = false
  limit 1;
$$;

revoke all on function public.get_public_pitch(text) from public;
grant execute on function public.get_public_pitch(text) to anon, authenticated;


