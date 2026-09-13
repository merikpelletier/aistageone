-- Accès public minimal nécessaire pour afficher le catalogue AISTAGE.ONE.
-- Les données de comptes, messages, paiements et créations privées restent fermées.

grant usage on schema public to anon, authenticated;
grant select on table public.app_label to anon, authenticated;
grant select on table public.character_type to anon, authenticated;
grant select on table public.dossier to anon, authenticated;
grant select on table public.dossier_category to anon, authenticated;
grant select on table public.dossier_page to anon, authenticated;
grant select on table public.editable_content to anon, authenticated;
grant select on table public.episode_production to anon, authenticated;
grant select on table public.knowledge_entry to anon, authenticated;
grant select on table public.membership_pricing to anon, authenticated;
grant select on table public.product to anon, authenticated;
grant select on table public.production_kit to anon, authenticated;
grant select on table public.quiz_question to anon, authenticated;
grant select on table public.salon_label to anon, authenticated;
grant select on table public.salon_status to anon, authenticated;
grant select on table public.shop_settings to anon, authenticated;
grant select on table public.sketch_template to anon, authenticated;
grant select on table public.sponsor_bracket to anon, authenticated;
grant select on table public.starting_topic to anon, authenticated;
grant select on table public.story_block to anon, authenticated;
grant select on table public.story_character to anon, authenticated;
grant select on table public.story_session to anon, authenticated;
grant select on table public.story_set to anon, authenticated;
grant select on table public.story_theme to anon, authenticated;
grant select on table public.style_reference to anon, authenticated;
grant select on table public.timeline_story to anon, authenticated;
grant select on table public.token_package to anon, authenticated;
grant select on table public.tool_pricing to anon, authenticated;
drop policy if exists "public_read_app_label" on public.app_label;
create policy "public_read_app_label" on public.app_label for select to anon, authenticated using (true);
drop policy if exists "public_read_character_type" on public.character_type;
create policy "public_read_character_type" on public.character_type for select to anon, authenticated using (true);
drop policy if exists "public_read_published_dossier" on public.dossier;
create policy "public_read_published_dossier" on public.dossier for select to anon, authenticated using (status = 'published');
drop policy if exists "public_read_dossier_category" on public.dossier_category;
create policy "public_read_dossier_category" on public.dossier_category for select to anon, authenticated using (true);
drop policy if exists "public_read_published_dossier_page" on public.dossier_page;
create policy "public_read_published_dossier_page" on public.dossier_page
for select to anon, authenticated
using (
  coalesce(is_hidden_from_public, false) = false
  and exists (
    select 1 from public.dossier
    where dossier.id = dossier_page.dossier_id
      and dossier.status = 'published'
  )
);
drop policy if exists "public_read_editable_content" on public.editable_content;
create policy "public_read_editable_content" on public.editable_content for select to anon, authenticated using (true);
drop policy if exists "public_read_published_episode_production" on public.episode_production;
create policy "public_read_published_episode_production" on public.episode_production
for select to anon, authenticated
using (
  exists (
    select 1 from public.dossier
    where dossier.id = episode_production.dossier_id
      and dossier.status = 'published'
  )
);
drop policy if exists "public_read_knowledge" on public.knowledge_entry;
create policy "public_read_knowledge" on public.knowledge_entry for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_membership_pricing" on public.membership_pricing;
create policy "public_read_membership_pricing" on public.membership_pricing for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_product" on public.product;
create policy "public_read_product" on public.product for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_production_kit" on public.production_kit;
create policy "public_read_production_kit" on public.production_kit for select to anon, authenticated using (coalesce(is_active, true) and status = 'published');
drop policy if exists "public_read_quiz" on public.quiz_question;
create policy "public_read_quiz" on public.quiz_question for select to anon, authenticated using (true);
drop policy if exists "public_read_salon_label" on public.salon_label;
create policy "public_read_salon_label" on public.salon_label for select to anon, authenticated using (true);
drop policy if exists "public_read_salon_status" on public.salon_status;
create policy "public_read_salon_status" on public.salon_status for select to anon, authenticated using (true);
drop policy if exists "public_read_shop_settings" on public.shop_settings;
create policy "public_read_shop_settings" on public.shop_settings for select to anon, authenticated using (true);
drop policy if exists "public_read_sketch_template" on public.sketch_template;
create policy "public_read_sketch_template" on public.sketch_template for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_sponsor_bracket" on public.sponsor_bracket;
create policy "public_read_sponsor_bracket" on public.sponsor_bracket for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_starting_topic" on public.starting_topic;
create policy "public_read_starting_topic" on public.starting_topic for select to anon, authenticated using (true);
drop policy if exists "public_read_story_character" on public.story_character;
create policy "public_read_story_character" on public.story_character for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_story_set" on public.story_set;
create policy "public_read_story_set" on public.story_set for select to anon, authenticated using (true);
drop policy if exists "public_read_story_theme" on public.story_theme;
create policy "public_read_story_theme" on public.story_theme for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_style_reference" on public.style_reference;
create policy "public_read_style_reference" on public.style_reference for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_story_session" on public.story_session;
create policy "public_read_story_session" on public.story_session for select to anon, authenticated using (coalesce(is_public, false) or coalesce(is_published, false));
drop policy if exists "public_read_story_block" on public.story_block;
create policy "public_read_story_block" on public.story_block
for select to anon, authenticated
using (
  exists (
    select 1 from public.story_session
    where story_session.id = story_block.session_id
      and (coalesce(story_session.is_public, false) or coalesce(story_session.is_published, false))
  )
);
drop policy if exists "public_read_timeline_story" on public.timeline_story;
create policy "public_read_timeline_story" on public.timeline_story for select to anon, authenticated using (coalesce(is_published, false));
drop policy if exists "public_read_token_package" on public.token_package;
create policy "public_read_token_package" on public.token_package for select to anon, authenticated using (coalesce(is_active, true));
drop policy if exists "public_read_tool_pricing" on public.tool_pricing;
create policy "public_read_tool_pricing" on public.tool_pricing for select to anon, authenticated using (coalesce(is_active, true));
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;
drop policy if exists "public_read_media" on storage.objects;
create policy "public_read_media" on storage.objects for select to public using (bucket_id = 'media');
drop policy if exists "authenticated_upload_own_media" on storage.objects;
create policy "authenticated_upload_own_media" on storage.objects
for insert to authenticated
with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "authenticated_update_own_media" on storage.objects;
create policy "authenticated_update_own_media" on storage.objects
for update to authenticated
using (bucket_id = 'media' and owner_id = auth.uid()::text)
with check (bucket_id = 'media' and owner_id = auth.uid()::text);
drop policy if exists "authenticated_delete_own_media" on storage.objects;
create policy "authenticated_delete_own_media" on storage.objects
for delete to authenticated
using (bucket_id = 'media' and owner_id = auth.uid()::text);
