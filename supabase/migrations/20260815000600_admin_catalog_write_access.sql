-- Réparation globale des écritures utilisées par l'administration AISTAGE.ONE.
-- Chaque table est explicitement autorisée; aucune autre table n'est ouverte.
do $$
declare
  table_name text;
  admin_tables constant text[] := array[
    'agent_config',
    'app_label',
    'character_type',
    'chat_message',
    'contact_message',
    'dossier',
    'dossier_category',
    'dossier_page',
    'editable_content',
    'episode_production',
    'knowledge_entry',
    'member_earnings',
    'membership',
    'membership_pricing',
    'private_message',
    'product',
    'production_kit',
    'profile_placeholder',
    'profile_sponsor',
    'promo_message_package',
    'promo_message_request',
    'quiz_question',
    'salon_label',
    'salon_status',
    'scheduled_promo',
    'shop_settings',
    'sketch_template',
    'sponsor_bracket',
    'sponsor_sale',
    'style_reference',
    'temporary_user',
    'token_package'
  ];
begin
  foreach table_name in array admin_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Expected admin table public.% is missing', table_name;
    end if;

    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      table_name
    );
    execute format(
      'drop policy if exists admin_manage_catalog on public.%I',
      table_name
    );
    execute format(
      'create policy admin_manage_catalog on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end;
$$;
