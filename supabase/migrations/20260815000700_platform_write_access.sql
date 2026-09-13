-- Vérifie et rétablit les droits de propriétaire pour toutes les tables
-- modifiées directement par le frontend membre ou par une fonction authentifiée.
do $$
declare
  current_table text;
  owner_expression text;
  member_tables constant text[] := array[
    'campaign', 'campaign_subscription', 'character_sheet', 'chat_message',
    'contact_message', 'dossier', 'dossier_comment', 'dossier_page',
    'dossier_rating', 'magazine_page', 'member_profile', 'membership',
    'post_comment', 'post_like', 'private_message', 'profile_fan_subscription',
    'profile_sponsor', 'promo_message_request', 'set_asset', 'story_block',
    'story_character', 'story_session', 'temporary_user', 'timeline_story',
    'token_transaction', 'user_timeline', 'user_token_balance', 'vault_asset',
    'vault_folder'
  ];
begin
  foreach current_table in array member_tables loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = current_table
        and column_name = 'created_by_id'
    ) then
      raise exception 'Expected owned table public.% with created_by_id is missing', current_table;
    end if;

    owner_expression := format(
      '(created_by_id = (select auth.uid())::text or lower(coalesce(created_by, '''')) = lower(coalesce((select auth.jwt() ->> ''email''), ''''))%s or public.is_admin())',
      case when exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = current_table
          and column_name = 'user_email'
      ) then ' or lower(coalesce(user_email, '''')) = lower(coalesce((select auth.jwt() ->> ''email''), ''''))'
      else '' end
    );

    execute format('grant select, insert, update, delete on table public.%I to authenticated', current_table);
    execute format('drop policy if exists owner_read on public.%I', current_table);
    execute format('create policy owner_read on public.%I for select to authenticated using (%s)', current_table, owner_expression);
    execute format('drop policy if exists owner_insert on public.%I', current_table);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (%s)', current_table, owner_expression);
    execute format('drop policy if exists owner_update on public.%I', current_table);
    execute format('create policy owner_update on public.%I for update to authenticated using (%s) with check (%s)', current_table, owner_expression, owner_expression);
    execute format('drop policy if exists owner_delete on public.%I', current_table);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (%s)', current_table, owner_expression);
  end loop;
end;
$$;

drop policy if exists participant_read_private_message on public.private_message;
create policy participant_read_private_message
on public.private_message for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.temporary_user recipient
    where recipient.session_id = private_message.to_session_id
      and (
        recipient.created_by_id = (select auth.uid())::text
        or lower(coalesce(recipient.created_by, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
  )
);

create or replace function public.member_mark_private_message_read(message_id text)
returns public.private_message
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_message public.private_message;
begin
  update public.private_message message
  set read = true
  where message.id = message_id
    and exists (
      select 1 from public.temporary_user recipient
      where recipient.session_id = message.to_session_id
        and (
          recipient.created_by_id = (select auth.uid())::text
          or lower(coalesce(recipient.created_by, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
    )
  returning * into saved_message;

  if saved_message.id is null then
    raise exception 'PrivateMessage not found or access denied' using errcode = '42501';
  end if;
  return saved_message;
end;
$$;

create or replace function public.member_delete_temporary_profile(profile_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_session_id text;
begin
  select session_id into owned_session_id
  from public.temporary_user profile
  where profile.id = profile_id
    and (
      profile.created_by_id = (select auth.uid())::text
      or lower(coalesce(profile.created_by, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    );

  if owned_session_id is null then
    raise exception 'TemporaryUser not found or access denied' using errcode = '42501';
  end if;

  delete from public.chat_message where session_id = owned_session_id;
  delete from public.private_message where from_session_id = owned_session_id or to_session_id = owned_session_id;
  delete from public.temporary_user where id = profile_id;
end;
$$;

revoke all on function public.member_mark_private_message_read(text) from public;
revoke all on function public.member_delete_temporary_profile(text) from public;
grant execute on function public.member_mark_private_message_read(text) to authenticated;
grant execute on function public.member_delete_temporary_profile(text) to authenticated;
