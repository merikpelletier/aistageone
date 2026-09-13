-- Généré depuis base44/entities par npm run supabase:schema.
-- Ne pas modifier à la main : corriger le générateur ou le schéma source.
-- Les champs métier restent nullables pendant l'import afin de préserver les données historiques.

create extension if not exists pgcrypto with schema extensions;
create or replace function public.set_updated_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;
create table if not exists public."agent_config" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "config_name" text,
  "scope" text default 'global_type',
  "production_type" text,
  "dossier_id" text,
  "dossier_title" text,
  "system_instructions" text,
  "best_practices" text,
  "voice_model" text default 'river',
  "is_active" boolean default true
);
comment on table public."agent_config" is 'Entité Base44 d''origine : AgentConfig';
alter table public."agent_config" enable row level security;
revoke all on table public."agent_config" from anon, authenticated;
drop trigger if exists "set_agent_config_updated_date" on public."agent_config";
create trigger "set_agent_config_updated_date"
before update on public."agent_config"
for each row execute function public.set_updated_date();
create table if not exists public."app_label" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "key" text,
  "value" text
);
comment on table public."app_label" is 'Entité Base44 d''origine : AppLabel';
alter table public."app_label" enable row level security;
revoke all on table public."app_label" from anon, authenticated;
drop trigger if exists "set_app_label_updated_date" on public."app_label";
create trigger "set_app_label_updated_date"
before update on public."app_label"
for each row execute function public.set_updated_date();
create table if not exists public."campaign" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "member_email" text,
  "title" text,
  "description" text,
  "linked_story_id" text,
  "linked_dossier_id" text,
  "start_date" date,
  "end_date" date,
  "subscription_fee" double precision,
  "notify_new_episodes" boolean default true,
  "notify_merch_releases" boolean default false,
  "notify_upcoming_projects" boolean default false,
  "banner_image_url" text,
  "banner_color" text default 'yellow',
  "status" text default 'draft'
);
comment on table public."campaign" is 'Entité Base44 d''origine : Campaign';
alter table public."campaign" enable row level security;
revoke all on table public."campaign" from anon, authenticated;
drop trigger if exists "set_campaign_updated_date" on public."campaign";
create trigger "set_campaign_updated_date"
before update on public."campaign"
for each row execute function public.set_updated_date();
create table if not exists public."campaign_subscription" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "campaign_id" text,
  "subscriber_email" text,
  "subscriber_name" text,
  "campaign_title" text,
  "fee_paid" double precision,
  "status" text default 'active',
  "payment_id" text,
  "subscribed_at" timestamptz
);
comment on table public."campaign_subscription" is 'Entité Base44 d''origine : CampaignSubscription';
alter table public."campaign_subscription" enable row level security;
revoke all on table public."campaign_subscription" from anon, authenticated;
drop trigger if exists "set_campaign_subscription_updated_date" on public."campaign_subscription";
create trigger "set_campaign_subscription_updated_date"
before update on public."campaign_subscription"
for each row execute function public.set_updated_date();
create table if not exists public."cart_item" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "dossier_id" text,
  "dossier_title" text,
  "price" text,
  "cover_image" text,
  "session_id" text
);
comment on table public."cart_item" is 'Entité Base44 d''origine : CartItem';
alter table public."cart_item" enable row level security;
revoke all on table public."cart_item" from anon, authenticated;
drop trigger if exists "set_cart_item_updated_date" on public."cart_item";
create trigger "set_cart_item_updated_date"
before update on public."cart_item"
for each row execute function public.set_updated_date();
create table if not exists public."character_sheet" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "character_name" text,
  "character_bio" text,
  "character_traits" jsonb,
  "character_photos" jsonb,
  "voice_sample_url" text,
  "skills" jsonb,
  "languages" jsonb,
  "notes" text
);
comment on table public."character_sheet" is 'Entité Base44 d''origine : CharacterSheet';
alter table public."character_sheet" enable row level security;
revoke all on table public."character_sheet" from anon, authenticated;
drop trigger if exists "set_character_sheet_updated_date" on public."character_sheet";
create trigger "set_character_sheet_updated_date"
before update on public."character_sheet"
for each row execute function public.set_updated_date();
create table if not exists public."character_type" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "order" double precision
);
comment on table public."character_type" is 'Entité Base44 d''origine : CharacterType';
alter table public."character_type" enable row level security;
revoke all on table public."character_type" from anon, authenticated;
drop trigger if exists "set_character_type_updated_date" on public."character_type";
create trigger "set_character_type_updated_date"
before update on public."character_type"
for each row execute function public.set_updated_date();
create table if not exists public."chat_message" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "salon" text,
  "sender_identifier" text,
  "content" text,
  "photo_url" text,
  "session_id" text,
  "is_admin" boolean default false
);
comment on table public."chat_message" is 'Entité Base44 d''origine : ChatMessage';
alter table public."chat_message" enable row level security;
revoke all on table public."chat_message" from anon, authenticated;
drop trigger if exists "set_chat_message_updated_date" on public."chat_message";
create trigger "set_chat_message_updated_date"
before update on public."chat_message"
for each row execute function public.set_updated_date();
create table if not exists public."contact_message" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "message" text,
  "email" text,
  "status" text default 'unread'
);
comment on table public."contact_message" is 'Entité Base44 d''origine : ContactMessage';
alter table public."contact_message" enable row level security;
revoke all on table public."contact_message" from anon, authenticated;
drop trigger if exists "set_contact_message_updated_date" on public."contact_message";
create trigger "set_contact_message_updated_date"
before update on public."contact_message"
for each row execute function public.set_updated_date();
create table if not exists public."dossier" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "title" text,
  "subtitle" text,
  "category" text,
  "class" text,
  "cover_image" text,
  "cover_template_image" text,
  "cover_image_landscape" text,
  "cover_video" text,
  "cover_video_landscape" text,
  "status" text default 'draft',
  "order" double precision,
  "author_name" text,
  "hide_text_on_cover" boolean default false,
  "has_portrait" boolean default true,
  "has_landscape" boolean default false,
  "submitted_by_email" text,
  "submitted_by_name" text,
  "membership_type" text,
  "duration_days" double precision,
  "publish_until" timestamptz,
  "submitted_at" timestamptz,
  "approved_at" timestamptz,
  "rejection_reason" text,
  "requires_payment" boolean default false,
  "payment_confirmed" boolean default false,
  "description" text
);
comment on table public."dossier" is 'Entité Base44 d''origine : Dossier';
alter table public."dossier" enable row level security;
revoke all on table public."dossier" from anon, authenticated;
drop trigger if exists "set_dossier_updated_date" on public."dossier";
create trigger "set_dossier_updated_date"
before update on public."dossier"
for each row execute function public.set_updated_date();
create table if not exists public."dossier_category" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "order" double precision
);
comment on table public."dossier_category" is 'Entité Base44 d''origine : DossierCategory';
alter table public."dossier_category" enable row level security;
revoke all on table public."dossier_category" from anon, authenticated;
drop trigger if exists "set_dossier_category_updated_date" on public."dossier_category";
create trigger "set_dossier_category_updated_date"
before update on public."dossier_category"
for each row execute function public.set_updated_date();
create table if not exists public."dossier_comment" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "dossier_id" text,
  "user_email" text,
  "user_name" text,
  "content" text
);
comment on table public."dossier_comment" is 'Entité Base44 d''origine : DossierComment';
alter table public."dossier_comment" enable row level security;
revoke all on table public."dossier_comment" from anon, authenticated;
drop trigger if exists "set_dossier_comment_updated_date" on public."dossier_comment";
create trigger "set_dossier_comment_updated_date"
before update on public."dossier_comment"
for each row execute function public.set_updated_date();
create table if not exists public."dossier_page" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "dossier_id" text,
  "page_type" text,
  "title" text,
  "content" text,
  "media_url" text,
  "media_url_landscape" text,
  "images" jsonb,
  "order" double precision,
  "image_layout" text default 'background',
  "text_position" text default 'center',
  "text_color" text default 'white',
  "is_product" boolean default false,
  "price" text,
  "product_options" jsonb,
  "episode_title" text,
  "episode_description" text,
  "episode_role" text,
  "episode_tools_hint" text,
  "cast_episodes" jsonb,
  "cast_members_only" boolean default true,
  "series_presentation" text,
  "series_characters" jsonb,
  "series_sets" jsonb,
  "series_costumes" jsonb,
  "kit_description" text,
  "kit_sets" jsonb,
  "kit_characters" jsonb,
  "kit_costumes" jsonb,
  "kit_reference_media" jsonb,
  "block_player_episode_page_id" text,
  "block_player_block_ids" jsonb,
  "is_locked" boolean default false,
  "is_hidden_from_public" boolean default false,
  "show_studio_banner" boolean default false
);
comment on table public."dossier_page" is 'Entité Base44 d''origine : DossierPage';
alter table public."dossier_page" enable row level security;
revoke all on table public."dossier_page" from anon, authenticated;
drop trigger if exists "set_dossier_page_updated_date" on public."dossier_page";
create trigger "set_dossier_page_updated_date"
before update on public."dossier_page"
for each row execute function public.set_updated_date();
create table if not exists public."dossier_rating" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "dossier_id" text,
  "user_email" text,
  "rating" double precision
);
comment on table public."dossier_rating" is 'Entité Base44 d''origine : DossierRating';
alter table public."dossier_rating" enable row level security;
revoke all on table public."dossier_rating" from anon, authenticated;
drop trigger if exists "set_dossier_rating_updated_date" on public."dossier_rating";
create trigger "set_dossier_rating_updated_date"
before update on public."dossier_rating"
for each row execute function public.set_updated_date();
create table if not exists public."editable_content" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "key" text,
  "title" text,
  "content" text
);
comment on table public."editable_content" is 'Entité Base44 d''origine : EditableContent';
alter table public."editable_content" enable row level security;
revoke all on table public."editable_content" from anon, authenticated;
drop trigger if exists "set_editable_content_updated_date" on public."editable_content";
create trigger "set_editable_content_updated_date"
before update on public."editable_content"
for each row execute function public.set_updated_date();
create table if not exists public."episode_production" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "episode_page_id" text,
  "dossier_id" text,
  "characters" jsonb,
  "timeline" jsonb
);
comment on table public."episode_production" is 'Entité Base44 d''origine : EpisodeProduction';
alter table public."episode_production" enable row level security;
revoke all on table public."episode_production" from anon, authenticated;
drop trigger if exists "set_episode_production_updated_date" on public."episode_production";
create trigger "set_episode_production_updated_date"
before update on public."episode_production"
for each row execute function public.set_updated_date();
create table if not exists public."knowledge_entry" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "category" text,
  "title" text,
  "description" text,
  "tags" jsonb,
  "is_active" boolean default true
);
comment on table public."knowledge_entry" is 'Entité Base44 d''origine : KnowledgeEntry';
alter table public."knowledge_entry" enable row level security;
revoke all on table public."knowledge_entry" from anon, authenticated;
drop trigger if exists "set_knowledge_entry_updated_date" on public."knowledge_entry";
create trigger "set_knowledge_entry_updated_date"
before update on public."knowledge_entry"
for each row execute function public.set_updated_date();
create table if not exists public."magazine_page" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "title" text,
  "template" text,
  "canvas" text default 'portrait',
  "background_url" text,
  "background_color" text,
  "layers" jsonb,
  "order" double precision default 0,
  "is_published" boolean default false
);
comment on table public."magazine_page" is 'Entité Base44 d''origine : MagazinePage';
alter table public."magazine_page" enable row level security;
revoke all on table public."magazine_page" from anon, authenticated;
drop trigger if exists "set_magazine_page_updated_date" on public."magazine_page";
create trigger "set_magazine_page_updated_date"
before update on public."magazine_page"
for each row execute function public.set_updated_date();
create table if not exists public."member_earnings" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "member_email" text,
  "payout_month" text,
  "total_sales" double precision,
  "platform_total" double precision,
  "member_total" double precision,
  "status" text default 'pending',
  "paid_at" timestamptz
);
comment on table public."member_earnings" is 'Entité Base44 d''origine : MemberEarnings';
alter table public."member_earnings" enable row level security;
revoke all on table public."member_earnings" from anon, authenticated;
drop trigger if exists "set_member_earnings_updated_date" on public."member_earnings";
create trigger "set_member_earnings_updated_date"
before update on public."member_earnings"
for each row execute function public.set_updated_date();
create table if not exists public."member_post" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "member_email" text,
  "member_name" text,
  "title" text,
  "description" text,
  "links" jsonb,
  "images" jsonb,
  "likes_count" double precision default 0,
  "comments_count" double precision default 0
);
comment on table public."member_post" is 'Entité Base44 d''origine : MemberPost';
alter table public."member_post" enable row level security;
revoke all on table public."member_post" from anon, authenticated;
drop trigger if exists "set_member_post_updated_date" on public."member_post";
create trigger "set_member_post_updated_date"
before update on public."member_post"
for each row execute function public.set_updated_date();
create table if not exists public."member_profile" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "display_name" text,
  "bio" text,
  "avatar_url" text,
  "title" text,
  "images" jsonb,
  "links" jsonb,
  "custom_banner_url" text,
  "custom_banner_link" text
);
comment on table public."member_profile" is 'Entité Base44 d''origine : MemberProfile';
alter table public."member_profile" enable row level security;
revoke all on table public."member_profile" from anon, authenticated;
drop trigger if exists "set_member_profile_updated_date" on public."member_profile";
create trigger "set_member_profile_updated_date"
before update on public."member_profile"
for each row execute function public.set_updated_date();
create table if not exists public."membership" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "user_name" text,
  "membership_type" text,
  "status" text default 'pending',
  "bio" text,
  "website" text,
  "admin_notes" text,
  "approved_at" timestamptz
);
comment on table public."membership" is 'Entité Base44 d''origine : Membership';
alter table public."membership" enable row level security;
revoke all on table public."membership" from anon, authenticated;
drop trigger if exists "set_membership_updated_date" on public."membership";
create trigger "set_membership_updated_date"
before update on public."membership"
for each row execute function public.set_updated_date();
create table if not exists public."membership_pricing" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "membership_type" text,
  "price_monthly" double precision,
  "tokens_included" double precision default 0,
  "is_active" boolean default true,
  "order" double precision default 0
);
comment on table public."membership_pricing" is 'Entité Base44 d''origine : MembershipPricing';
alter table public."membership_pricing" enable row level security;
revoke all on table public."membership_pricing" from anon, authenticated;
drop trigger if exists "set_membership_pricing_updated_date" on public."membership_pricing";
create trigger "set_membership_pricing_updated_date"
before update on public."membership_pricing"
for each row execute function public.set_updated_date();
create table if not exists public."order" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "order_id" text,
  "items" jsonb,
  "subtotal" double precision,
  "tps" double precision,
  "tvq" double precision,
  "shipping" double precision default 0,
  "total" double precision,
  "customer_email" text,
  "customer_name" text,
  "shipping_address" jsonb,
  "status" text default 'pending',
  "payment_date" timestamptz
);
comment on table public."order" is 'Entité Base44 d''origine : Order';
alter table public."order" enable row level security;
revoke all on table public."order" from anon, authenticated;
drop trigger if exists "set_order_updated_date" on public."order";
create trigger "set_order_updated_date"
before update on public."order"
for each row execute function public.set_updated_date();
create table if not exists public."post_comment" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "post_id" text,
  "author_email" text,
  "author_name" text,
  "content" text
);
comment on table public."post_comment" is 'Entité Base44 d''origine : PostComment';
alter table public."post_comment" enable row level security;
revoke all on table public."post_comment" from anon, authenticated;
drop trigger if exists "set_post_comment_updated_date" on public."post_comment";
create trigger "set_post_comment_updated_date"
before update on public."post_comment"
for each row execute function public.set_updated_date();
create table if not exists public."post_like" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "post_id" text,
  "user_email" text,
  "user_name" text
);
comment on table public."post_like" is 'Entité Base44 d''origine : PostLike';
alter table public."post_like" enable row level security;
revoke all on table public."post_like" from anon, authenticated;
drop trigger if exists "set_post_like_updated_date" on public."post_like";
create trigger "set_post_like_updated_date"
before update on public."post_like"
for each row execute function public.set_updated_date();
create table if not exists public."private_message" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "from_identifier" text,
  "to_identifier" text,
  "from_session_id" text,
  "to_session_id" text,
  "content" text,
  "photo_url" text,
  "read" boolean default false
);
comment on table public."private_message" is 'Entité Base44 d''origine : PrivateMessage';
alter table public."private_message" enable row level security;
revoke all on table public."private_message" from anon, authenticated;
drop trigger if exists "set_private_message_updated_date" on public."private_message";
create trigger "set_private_message_updated_date"
before update on public."private_message"
for each row execute function public.set_updated_date();
create table if not exists public."product" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "description" text,
  "price" text,
  "image_url" text,
  "external_link" text,
  "category" text default 'product',
  "order" double precision,
  "is_active" boolean default true
);
comment on table public."product" is 'Entité Base44 d''origine : Product';
alter table public."product" enable row level security;
revoke all on table public."product" from anon, authenticated;
drop trigger if exists "set_product_updated_date" on public."product";
create trigger "set_product_updated_date"
before update on public."product"
for each row execute function public.set_updated_date();
create table if not exists public."production_kit" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "title" text,
  "subtitle" text,
  "cover_image" text,
  "kit_description" text,
  "kit_characters" jsonb,
  "kit_sets" jsonb,
  "kit_costumes" jsonb,
  "kit_reference_media" jsonb,
  "status" text default 'draft',
  "order" double precision default 0,
  "is_active" boolean default true
);
comment on table public."production_kit" is 'Entité Base44 d''origine : ProductionKit';
alter table public."production_kit" enable row level security;
revoke all on table public."production_kit" from anon, authenticated;
drop trigger if exists "set_production_kit_updated_date" on public."production_kit";
create trigger "set_production_kit_updated_date"
before update on public."production_kit"
for each row execute function public.set_updated_date();
create table if not exists public."profile_fan" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "member_email" text,
  "fan_email" text,
  "status" text default 'active',
  "subscribed_at" timestamptz,
  "unsubscribed_at" timestamptz
);
comment on table public."profile_fan" is 'Entité Base44 d''origine : ProfileFan';
alter table public."profile_fan" enable row level security;
revoke all on table public."profile_fan" from anon, authenticated;
drop trigger if exists "set_profile_fan_updated_date" on public."profile_fan";
create trigger "set_profile_fan_updated_date"
before update on public."profile_fan"
for each row execute function public.set_updated_date();
create table if not exists public."profile_fan_subscription" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "target_profile_id" text,
  "email" text,
  "status" text default 'active',
  "created_at" timestamptz,
  "unsubscribed_at" timestamptz
);
comment on table public."profile_fan_subscription" is 'Entité Base44 d''origine : ProfileFanSubscription';
alter table public."profile_fan_subscription" enable row level security;
revoke all on table public."profile_fan_subscription" from anon, authenticated;
drop trigger if exists "set_profile_fan_subscription_updated_date" on public."profile_fan_subscription";
create trigger "set_profile_fan_subscription_updated_date"
before update on public."profile_fan_subscription"
for each row execute function public.set_updated_date();
create table if not exists public."profile_placeholder" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "icon_url" text,
  "name" text,
  "is_active" boolean default true
);
comment on table public."profile_placeholder" is 'Entité Base44 d''origine : ProfilePlaceholder';
alter table public."profile_placeholder" enable row level security;
revoke all on table public."profile_placeholder" from anon, authenticated;
drop trigger if exists "set_profile_placeholder_updated_date" on public."profile_placeholder";
create trigger "set_profile_placeholder_updated_date"
before update on public."profile_placeholder"
for each row execute function public.set_updated_date();
create table if not exists public."profile_sponsor" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "member_email" text,
  "image_url" text,
  "link" text,
  "is_active" boolean default false,
  "status" text default 'pending',
  "bracket_id" text,
  "bracket_name" text,
  "bracket_price" double precision,
  "bracket_duration" text,
  "platform_share" double precision,
  "member_share" double precision,
  "start_date" timestamptz,
  "end_date" timestamptz,
  "sponsor_name" text,
  "sponsor_email" text,
  "terms_accepted" boolean default false,
  "admin_notes" text,
  "submitted_at" timestamptz,
  "approved_at" timestamptz
);
comment on table public."profile_sponsor" is 'Entité Base44 d''origine : ProfileSponsor';
alter table public."profile_sponsor" enable row level security;
revoke all on table public."profile_sponsor" from anon, authenticated;
drop trigger if exists "set_profile_sponsor_updated_date" on public."profile_sponsor";
create trigger "set_profile_sponsor_updated_date"
before update on public."profile_sponsor"
for each row execute function public.set_updated_date();
create table if not exists public."promo_message_package" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "price" double precision,
  "description" text,
  "is_active" boolean default true
);
comment on table public."promo_message_package" is 'Entité Base44 d''origine : PromoMessagePackage';
alter table public."promo_message_package" enable row level security;
revoke all on table public."promo_message_package" from anon, authenticated;
drop trigger if exists "set_promo_message_package_updated_date" on public."promo_message_package";
create trigger "set_promo_message_package_updated_date"
before update on public."promo_message_package"
for each row execute function public.set_updated_date();
create table if not exists public."promo_message_request" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "package_id" text,
  "package_name" text,
  "package_price" double precision,
  "salon" text,
  "message" text,
  "link" text,
  "link_text" text,
  "send_date" timestamptz,
  "sponsor_name" text,
  "sponsor_email" text,
  "status" text default 'pending',
  "admin_notes" text,
  "submitted_at" timestamptz
);
comment on table public."promo_message_request" is 'Entité Base44 d''origine : PromoMessageRequest';
alter table public."promo_message_request" enable row level security;
revoke all on table public."promo_message_request" from anon, authenticated;
drop trigger if exists "set_promo_message_request_updated_date" on public."promo_message_request";
create trigger "set_promo_message_request_updated_date"
before update on public."promo_message_request"
for each row execute function public.set_updated_date();
create table if not exists public."quiz_question" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "question" text,
  "correct_answers" jsonb,
  "wrong_answers" jsonb,
  "time_limit" double precision default 30,
  "is_active" boolean default true
);
comment on table public."quiz_question" is 'Entité Base44 d''origine : QuizQuestion';
alter table public."quiz_question" enable row level security;
revoke all on table public."quiz_question" from anon, authenticated;
drop trigger if exists "set_quiz_question_updated_date" on public."quiz_question";
create trigger "set_quiz_question_updated_date"
before update on public."quiz_question"
for each row execute function public.set_updated_date();
create table if not exists public."salon_access" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "salon" text,
  "restricted" boolean default false,
  "allowed_membership_types" jsonb
);
comment on table public."salon_access" is 'Entité Base44 d''origine : SalonAccess';
alter table public."salon_access" enable row level security;
revoke all on table public."salon_access" from anon, authenticated;
drop trigger if exists "set_salon_access_updated_date" on public."salon_access";
create trigger "set_salon_access_updated_date"
before update on public."salon_access"
for each row execute function public.set_updated_date();
create table if not exists public."salon_label" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "salon_id" text,
  "name" text,
  "description" text
);
comment on table public."salon_label" is 'Entité Base44 d''origine : SalonLabel';
alter table public."salon_label" enable row level security;
revoke all on table public."salon_label" from anon, authenticated;
drop trigger if exists "set_salon_label_updated_date" on public."salon_label";
create trigger "set_salon_label_updated_date"
before update on public."salon_label"
for each row execute function public.set_updated_date();
create table if not exists public."salon_status" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "salon" text,
  "is_open" boolean default true,
  "closed_message" text
);
comment on table public."salon_status" is 'Entité Base44 d''origine : SalonStatus';
alter table public."salon_status" enable row level security;
revoke all on table public."salon_status" from anon, authenticated;
drop trigger if exists "set_salon_status_updated_date" on public."salon_status";
create trigger "set_salon_status_updated_date"
before update on public."salon_status"
for each row execute function public.set_updated_date();
create table if not exists public."scheduled_promo" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "salon" text,
  "content" text,
  "link_url" text,
  "link_text" text,
  "scheduled_time" timestamptz,
  "sent" boolean default false,
  "sent_at" timestamptz
);
comment on table public."scheduled_promo" is 'Entité Base44 d''origine : ScheduledPromo';
alter table public."scheduled_promo" enable row level security;
revoke all on table public."scheduled_promo" from anon, authenticated;
drop trigger if exists "set_scheduled_promo_updated_date" on public."scheduled_promo";
create trigger "set_scheduled_promo_updated_date"
before update on public."scheduled_promo"
for each row execute function public.set_updated_date();
create table if not exists public."set_asset" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "name" text,
  "description" text,
  "tags" jsonb,
  "images" jsonb
);
comment on table public."set_asset" is 'Entité Base44 d''origine : SetAsset';
alter table public."set_asset" enable row level security;
revoke all on table public."set_asset" from anon, authenticated;
drop trigger if exists "set_set_asset_updated_date" on public."set_asset";
create trigger "set_set_asset_updated_date"
before update on public."set_asset"
for each row execute function public.set_updated_date();
create table if not exists public."shop_settings" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "payment_link" text
);
comment on table public."shop_settings" is 'Entité Base44 d''origine : ShopSettings';
alter table public."shop_settings" enable row level security;
revoke all on table public."shop_settings" from anon, authenticated;
drop trigger if exists "set_shop_settings_updated_date" on public."shop_settings";
create trigger "set_shop_settings_updated_date"
before update on public."shop_settings"
for each row execute function public.set_updated_date();
create table if not exists public."sim_active_situation" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "name" text,
  "description" text,
  "situation_type" text,
  "status" text default 'active',
  "affected_character_ids" jsonb,
  "escalation_stage" double precision default 0,
  "resolution_conditions" jsonb,
  "created_tick" double precision,
  "source_starting_topic_id" text
);
comment on table public."sim_active_situation" is 'Entité Base44 d''origine : SimActiveSituation';
alter table public."sim_active_situation" enable row level security;
revoke all on table public."sim_active_situation" from anon, authenticated;
drop trigger if exists "set_sim_active_situation_updated_date" on public."sim_active_situation";
create trigger "set_sim_active_situation_updated_date"
before update on public."sim_active_situation"
for each row execute function public.set_updated_date();
create table if not exists public."sim_asset" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "name" text,
  "description" text,
  "current_location_id" text,
  "current_holder_id" text,
  "is_secured" boolean default false
);
comment on table public."sim_asset" is 'Entité Base44 d''origine : SimAsset';
alter table public."sim_asset" enable row level security;
revoke all on table public."sim_asset" from anon, authenticated;
drop trigger if exists "set_sim_asset_updated_date" on public."sim_asset";
create trigger "set_sim_asset_updated_date"
before update on public."sim_asset"
for each row execute function public.set_updated_date();
create table if not exists public."sim_belief" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "character_id" text,
  "belief_text" text,
  "belief_type" text,
  "confidence" double precision default 0.5,
  "source" text,
  "source_observation_id" text,
  "created_tick" double precision,
  "communication_status" text default 'not_evaluated',
  "communication_scheduled_tick" double precision,
  "target_recipient_id" text
);
comment on table public."sim_belief" is 'Entité Base44 d''origine : SimBelief';
alter table public."sim_belief" enable row level security;
revoke all on table public."sim_belief" from anon, authenticated;
drop trigger if exists "set_sim_belief_updated_date" on public."sim_belief";
create trigger "set_sim_belief_updated_date"
before update on public."sim_belief"
for each row execute function public.set_updated_date();
create table if not exists public."sim_character" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "name" text,
  "description" text,
  "current_location_id" text,
  "traits" jsonb,
  "physical_description" text,
  "source_story_character_id" text,
  "sim_goals" jsonb,
  "sim_immediate_needs" jsonb,
  "sim_relationships" jsonb,
  "sim_responsibilities" jsonb
);
comment on table public."sim_character" is 'Entité Base44 d''origine : SimCharacter';
alter table public."sim_character" enable row level security;
revoke all on table public."sim_character" from anon, authenticated;
drop trigger if exists "set_sim_character_updated_date" on public."sim_character";
create trigger "set_sim_character_updated_date"
before update on public."sim_character"
for each row execute function public.set_updated_date();
create table if not exists public."sim_character_action" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "actor_id" text,
  "action_type" text,
  "action_description" text,
  "target_asset_id" text,
  "target_location_id" text,
  "proposed_tick" double precision,
  "execution_tick" double precision,
  "status" text default 'proposed',
  "outcome" text,
  "motivation_situation_id" text,
  "motivation_belief_id" text,
  "resulting_state_change_ids" jsonb,
  "resulting_observation_ids" jsonb
);
comment on table public."sim_character_action" is 'Entité Base44 d''origine : SimCharacterAction';
alter table public."sim_character_action" enable row level security;
revoke all on table public."sim_character_action" from anon, authenticated;
drop trigger if exists "set_sim_character_action_updated_date" on public."sim_character_action";
create trigger "set_sim_character_action_updated_date"
before update on public."sim_character_action"
for each row execute function public.set_updated_date();
create table if not exists public."sim_claim" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "claim_text" text,
  "claim_type" text,
  "originator_id" text,
  "source_belief_id" text,
  "subject_character_ids" jsonb,
  "created_tick" double precision,
  "mutation_count" double precision default 0
);
comment on table public."sim_claim" is 'Entité Base44 d''origine : SimClaim';
alter table public."sim_claim" enable row level security;
revoke all on table public."sim_claim" from anon, authenticated;
drop trigger if exists "set_sim_claim_updated_date" on public."sim_claim";
create trigger "set_sim_claim_updated_date"
before update on public."sim_claim"
for each row execute function public.set_updated_date();
create table if not exists public."sim_consequence" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "source_action_id" text,
  "source_state_change_id" text,
  "consequence_type" text,
  "affected_situation_id" text,
  "description" text,
  "consequence_tick" double precision
);
comment on table public."sim_consequence" is 'Entité Base44 d''origine : SimConsequence';
alter table public."sim_consequence" enable row level security;
revoke all on table public."sim_consequence" from anon, authenticated;
drop trigger if exists "set_sim_consequence_updated_date" on public."sim_consequence";
create trigger "set_sim_consequence_updated_date"
before update on public."sim_consequence"
for each row execute function public.set_updated_date();
create table if not exists public."sim_information_transmission" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "claim_id" text,
  "sender_id" text,
  "receiver_id" text,
  "transmission_tick" double precision,
  "original_claim_text" text,
  "transmitted_claim_text" text,
  "mutation_type" text default 'none'
);
comment on table public."sim_information_transmission" is 'Entité Base44 d''origine : SimInformationTransmission';
alter table public."sim_information_transmission" enable row level security;
revoke all on table public."sim_information_transmission" from anon, authenticated;
drop trigger if exists "set_sim_information_transmission_updated_date" on public."sim_information_transmission";
create trigger "set_sim_information_transmission_updated_date"
before update on public."sim_information_transmission"
for each row execute function public.set_updated_date();
create table if not exists public."sim_location" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "name" text,
  "description" text,
  "parent_location_id" text,
  "source_story_set_id" text,
  "sim_location_type" text,
  "sim_public_access" text,
  "sim_crowd_level" text,
  "sim_visibility" text,
  "sim_privacy" text,
  "sim_guard_presence" text,
  "sim_general_danger" text,
  "sim_ambush_risk" text,
  "sim_surveillance_risk" text,
  "sim_escape_difficulty" text,
  "sim_entry_points" jsonb,
  "sim_exit_routes" jsonb,
  "sim_hiding_places" jsonb,
  "sim_environmental_hazards" jsonb,
  "sim_suitable_actions" jsonb,
  "sim_unsuitable_actions" jsonb,
  "sim_special_rules" jsonb,
  "sim_time_profiles" jsonb
);
comment on table public."sim_location" is 'Entité Base44 d''origine : SimLocation';
alter table public."sim_location" enable row level security;
revoke all on table public."sim_location" from anon, authenticated;
drop trigger if exists "set_sim_location_updated_date" on public."sim_location";
create trigger "set_sim_location_updated_date"
before update on public."sim_location"
for each row execute function public.set_updated_date();
create table if not exists public."sim_observation" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "observer_id" text,
  "observation_source_type" text,
  "source_action_id" text,
  "source_state_change_id" text,
  "source_entity_type" text,
  "source_entity_id" text,
  "source_transmission_id" text,
  "observation_tick" double precision,
  "is_understood" boolean default false,
  "understanding_description" text,
  "available_from_tick" double precision,
  "processing_status" text default 'pending'
);
comment on table public."sim_observation" is 'Entité Base44 d''origine : SimObservation';
alter table public."sim_observation" enable row level security;
revoke all on table public."sim_observation" from anon, authenticated;
drop trigger if exists "set_sim_observation_updated_date" on public."sim_observation";
create trigger "set_sim_observation_updated_date"
before update on public."sim_observation"
for each row execute function public.set_updated_date();
create table if not exists public."sim_state_change" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "action_id" text,
  "change_type" text,
  "entity_type" text,
  "entity_id" text,
  "previous_state" jsonb,
  "new_state" jsonb,
  "change_tick" double precision,
  "available_from_tick" double precision
);
comment on table public."sim_state_change" is 'Entité Base44 d''origine : SimStateChange';
alter table public."sim_state_change" enable row level security;
revoke all on table public."sim_state_change" from anon, authenticated;
drop trigger if exists "set_sim_state_change_updated_date" on public."sim_state_change";
create trigger "set_sim_state_change_updated_date"
before update on public."sim_state_change"
for each row execute function public.set_updated_date();
create table if not exists public."sim_world_time" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "simulation_run_id" text,
  "current_tick" double precision default 0,
  "current_time_label" text,
  "tick_duration_label" text
);
comment on table public."sim_world_time" is 'Entité Base44 d''origine : SimWorldTime';
alter table public."sim_world_time" enable row level security;
revoke all on table public."sim_world_time" from anon, authenticated;
drop trigger if exists "set_sim_world_time_updated_date" on public."sim_world_time";
create trigger "set_sim_world_time_updated_date"
before update on public."sim_world_time"
for each row execute function public.set_updated_date();
create table if not exists public."sketch_template" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "category" text default 'comedy',
  "description" text,
  "scenario" text,
  "base_scene_prompt" text,
  "video_prompt" text,
  "transformation_prompt" text,
  "base_scene_image" text,
  "default_duration" double precision default 5,
  "default_aspect_ratio" text default '9:16',
  "cover_image" text,
  "is_active" boolean default true,
  "order" double precision default 0
);
comment on table public."sketch_template" is 'Entité Base44 d''origine : SketchTemplate';
alter table public."sketch_template" enable row level security;
revoke all on table public."sketch_template" from anon, authenticated;
drop trigger if exists "set_sketch_template_updated_date" on public."sketch_template";
create trigger "set_sketch_template_updated_date"
before update on public."sketch_template"
for each row execute function public.set_updated_date();
create table if not exists public."sponsor_bracket" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "price" double precision,
  "duration" text,
  "is_active" boolean default true
);
comment on table public."sponsor_bracket" is 'Entité Base44 d''origine : SponsorBracket';
alter table public."sponsor_bracket" enable row level security;
revoke all on table public."sponsor_bracket" from anon, authenticated;
drop trigger if exists "set_sponsor_bracket_updated_date" on public."sponsor_bracket";
create trigger "set_sponsor_bracket_updated_date"
before update on public."sponsor_bracket"
for each row execute function public.set_updated_date();
create table if not exists public."sponsor_sale" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "member_email" text,
  "bracket_id" text,
  "bracket_name" text,
  "duration" text,
  "total_amount" double precision,
  "platform_share" double precision,
  "member_share" double precision,
  "sale_date" timestamptz,
  "payout_month" text,
  "notes" text
);
comment on table public."sponsor_sale" is 'Entité Base44 d''origine : SponsorSale';
alter table public."sponsor_sale" enable row level security;
revoke all on table public."sponsor_sale" from anon, authenticated;
drop trigger if exists "set_sponsor_sale_updated_date" on public."sponsor_sale";
create trigger "set_sponsor_sale_updated_date"
before update on public."sponsor_sale"
for each row execute function public.set_updated_date();
create table if not exists public."starting_topic" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "title" text,
  "description" text,
  "theme_id" text,
  "order" double precision default 0,
  "character_ids" jsonb,
  "sim_opening_situation" text,
  "sim_world_conditions" jsonb,
  "sim_public_facts" jsonb,
  "sim_private_facts_by_character" jsonb,
  "sim_hero_initial_goals" jsonb,
  "sim_initial_active_situations" jsonb
);
comment on table public."starting_topic" is 'Entité Base44 d''origine : StartingTopic';
alter table public."starting_topic" enable row level security;
revoke all on table public."starting_topic" from anon, authenticated;
drop trigger if exists "set_starting_topic_updated_date" on public."starting_topic";
create trigger "set_starting_topic_updated_date"
before update on public."starting_topic"
for each row execute function public.set_updated_date();
create table if not exists public."story_block" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "session_id" text,
  "order" double precision,
  "block_title" text,
  "video_segments" jsonb,
  "narration_audio_urls" jsonb,
  "sfx_audio_urls" jsonb,
  "choice_options" jsonb,
  "selected_choice" text,
  "narrative_summary" text,
  "director_note" text default '',
  "selected_characters" jsonb,
  "selected_sets" jsonb,
  "segment_instructions" jsonb,
  "generation_status" text default 'pending',
  "planning_conversation_id" text,
  "active_prediction_id" text,
  "last_error" text,
  "rate_limited_until" timestamptz,
  "is_storyline_switch" boolean default false
);
comment on table public."story_block" is 'Entité Base44 d''origine : StoryBlock';
alter table public."story_block" enable row level security;
revoke all on table public."story_block" from anon, authenticated;
drop trigger if exists "set_story_block_updated_date" on public."story_block";
create trigger "set_story_block_updated_date"
before update on public."story_block"
for each row execute function public.set_updated_date();
create table if not exists public."story_character" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "description" text,
  "backstory" text,
  "character_type" text,
  "traits" jsonb,
  "photos" jsonb,
  "reference_sheet" text,
  "reference_sheet_notes" text,
  "reference_sheet_color_palette" jsonb,
  "reference_sheet_wardrobe_anchors" jsonb,
  "reference_sheet_do_not_change" jsonb,
  "reference_sheet_style_constraints" text,
  "is_active" boolean default true,
  "sim_starting_story_set_id" text,
  "sim_goals" jsonb,
  "sim_immediate_needs" jsonb,
  "sim_relationships" jsonb,
  "sim_responsibilities" jsonb,
  "sim_controlled_assets" jsonb,
  "sim_starting_knowledge" jsonb,
  "sim_starting_beliefs" jsonb
);
comment on table public."story_character" is 'Entité Base44 d''origine : StoryCharacter';
alter table public."story_character" enable row level security;
revoke all on table public."story_character" from anon, authenticated;
drop trigger if exists "set_story_character_updated_date" on public."story_character";
create trigger "set_story_character_updated_date"
before update on public."story_character"
for each row execute function public.set_updated_date();
create table if not exists public."story_session" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "theme_id" text,
  "hero_story_character_id" text,
  "starting_topic_id" text,
  "simulation_run_id" text,
  "story_memory" jsonb,
  "director_note" text default '',
  "block_count" double precision default 0,
  "arc_chapter_count" double precision default 0,
  "arc_start" text,
  "arc_middle" text,
  "arc_reveal" text,
  "is_public" boolean default false,
  "status" text default 'active',
  "narrator_voice" text default 'river',
  "is_published" boolean default false,
  "published_dossier_id" text
);
comment on table public."story_session" is 'Entité Base44 d''origine : StorySession';
alter table public."story_session" enable row level security;
revoke all on table public."story_session" from anon, authenticated;
drop trigger if exists "set_story_session_updated_date" on public."story_session";
create trigger "set_story_session_updated_date"
before update on public."story_session"
for each row execute function public.set_updated_date();
create table if not exists public."story_set" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "description" text,
  "tags" jsonb,
  "images" jsonb,
  "sim_location_type" text,
  "sim_public_access" text,
  "sim_crowd_level" text,
  "sim_visibility" text,
  "sim_privacy" text,
  "sim_guard_presence" text,
  "sim_general_danger" text,
  "sim_ambush_risk" text,
  "sim_surveillance_risk" text,
  "sim_escape_difficulty" text,
  "sim_entry_points" jsonb,
  "sim_exit_routes" jsonb,
  "sim_hiding_places" jsonb,
  "sim_environmental_hazards" jsonb,
  "sim_suitable_actions" jsonb,
  "sim_unsuitable_actions" jsonb,
  "sim_special_rules" jsonb,
  "sim_time_profiles" jsonb
);
comment on table public."story_set" is 'Entité Base44 d''origine : StorySet';
alter table public."story_set" enable row level security;
revoke all on table public."story_set" from anon, authenticated;
drop trigger if exists "set_story_set_updated_date" on public."story_set";
create trigger "set_story_set_updated_date"
before update on public."story_set"
for each row execute function public.set_updated_date();
create table if not exists public."story_theme" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "title" text,
  "type" text,
  "description" text,
  "tone_rules" text,
  "story_rules" text,
  "story_character_ids" jsonb,
  "story_set_ids" jsonb,
  "starting_topic_ids" jsonb,
  "credit_cost_per_block" double precision default 10,
  "cover_image" text,
  "cover_template_image" text,
  "media_urls" jsonb,
  "is_active" boolean default true,
  "order" double precision default 0
);
comment on table public."story_theme" is 'Entité Base44 d''origine : StoryTheme';
alter table public."story_theme" enable row level security;
revoke all on table public."story_theme" from anon, authenticated;
drop trigger if exists "set_story_theme_updated_date" on public."story_theme";
create trigger "set_story_theme_updated_date"
before update on public."story_theme"
for each row execute function public.set_updated_date();
create table if not exists public."style_reference" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "url" text,
  "category" text default 'covers',
  "tags" jsonb,
  "order" double precision default 0,
  "is_active" boolean default true
);
comment on table public."style_reference" is 'Entité Base44 d''origine : StyleReference';
alter table public."style_reference" enable row level security;
revoke all on table public."style_reference" from anon, authenticated;
drop trigger if exists "set_style_reference_updated_date" on public."style_reference";
create trigger "set_style_reference_updated_date"
before update on public."style_reference"
for each row execute function public.set_updated_date();
create table if not exists public."temporary_user" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "identifier" text,
  "identifier_number" double precision,
  "session_id" text,
  "description" text,
  "location" text,
  "photos" jsonb,
  "external_links" jsonb,
  "last_activity" timestamptz,
  "is_active" boolean default true,
  "expelled" boolean default false
);
comment on table public."temporary_user" is 'Entité Base44 d''origine : TemporaryUser';
alter table public."temporary_user" enable row level security;
revoke all on table public."temporary_user" from anon, authenticated;
drop trigger if exists "set_temporary_user_updated_date" on public."temporary_user";
create trigger "set_temporary_user_updated_date"
before update on public."temporary_user"
for each row execute function public.set_updated_date();
create table if not exists public."timeline_story" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "kit_page_id" text,
  "dossier_id" text,
  "user_email" text,
  "production_name" text,
  "episode_title" text,
  "episode_description" text,
  "poster_image" text,
  "series_description" text,
  "author_name" text,
  "publication_date" date,
  "category" text,
  "blocks" jsonb,
  "is_published" boolean default false
);
comment on table public."timeline_story" is 'Entité Base44 d''origine : TimelineStory';
alter table public."timeline_story" enable row level security;
revoke all on table public."timeline_story" from anon, authenticated;
drop trigger if exists "set_timeline_story_updated_date" on public."timeline_story";
create trigger "set_timeline_story_updated_date"
before update on public."timeline_story"
for each row execute function public.set_updated_date();
create table if not exists public."token_package" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "name" text,
  "token_amount" double precision,
  "price" double precision,
  "is_active" boolean default true,
  "bonus_percentage" double precision default 0,
  "order" double precision default 0
);
comment on table public."token_package" is 'Entité Base44 d''origine : TokenPackage';
alter table public."token_package" enable row level security;
revoke all on table public."token_package" from anon, authenticated;
drop trigger if exists "set_token_package_updated_date" on public."token_package";
create trigger "set_token_package_updated_date"
before update on public."token_package"
for each row execute function public.set_updated_date();
create table if not exists public."token_transaction" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "transaction_type" text,
  "token_amount" double precision,
  "balance_after" double precision,
  "related_entity" text,
  "payment_id" text,
  "created_at" timestamptz
);
comment on table public."token_transaction" is 'Entité Base44 d''origine : TokenTransaction';
alter table public."token_transaction" enable row level security;
revoke all on table public."token_transaction" from anon, authenticated;
drop trigger if exists "set_token_transaction_updated_date" on public."token_transaction";
create trigger "set_token_transaction_updated_date"
before update on public."token_transaction"
for each row execute function public.set_updated_date();
create table if not exists public."tool_pricing" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "tool_id" text,
  "tool_name" text,
  "token_cost" double precision,
  "is_active" boolean default true,
  "category" text
);
comment on table public."tool_pricing" is 'Entité Base44 d''origine : ToolPricing';
alter table public."tool_pricing" enable row level security;
revoke all on table public."tool_pricing" from anon, authenticated;
drop trigger if exists "set_tool_pricing_updated_date" on public."tool_pricing";
create trigger "set_tool_pricing_updated_date"
before update on public."tool_pricing"
for each row execute function public.set_updated_date();
create table if not exists public."user_timeline" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "episode_page_id" text,
  "user_email" text,
  "selected_character_id" text,
  "selected_method" text,
  "character_photo_url" text,
  "block_overrides" jsonb,
  "is_published" boolean default false
);
comment on table public."user_timeline" is 'Entité Base44 d''origine : UserTimeline';
alter table public."user_timeline" enable row level security;
revoke all on table public."user_timeline" from anon, authenticated;
drop trigger if exists "set_user_timeline_updated_date" on public."user_timeline";
create trigger "set_user_timeline_updated_date"
before update on public."user_timeline"
for each row execute function public.set_updated_date();
create table if not exists public."user_token_balance" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "balance" double precision default 0,
  "last_updated" timestamptz
);
comment on table public."user_token_balance" is 'Entité Base44 d''origine : UserTokenBalance';
alter table public."user_token_balance" enable row level security;
revoke all on table public."user_token_balance" from anon, authenticated;
drop trigger if exists "set_user_token_balance_updated_date" on public."user_token_balance";
create trigger "set_user_token_balance_updated_date"
before update on public."user_token_balance"
for each row execute function public.set_updated_date();
create table if not exists public."vault_asset" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "name" text,
  "url" text,
  "media_type" text,
  "asset_category" text,
  "source_dossier_id" text,
  "folder_id" text,
  "tags" jsonb,
  "style_tags" jsonb,
  "color_palette" jsonb,
  "actor_name" text,
  "source_asset_id" text,
  "is_magazine_ready" boolean default false,
  "aspect_ratio" text
);
comment on table public."vault_asset" is 'Entité Base44 d''origine : VaultAsset';
alter table public."vault_asset" enable row level security;
revoke all on table public."vault_asset" from anon, authenticated;
drop trigger if exists "set_vault_asset_updated_date" on public."vault_asset";
create trigger "set_vault_asset_updated_date"
before update on public."vault_asset"
for each row execute function public.set_updated_date();
create table if not exists public."vault_folder" (
  "id" text primary key default gen_random_uuid()::text,
  "created_date" timestamptz not null default now(),
  "updated_date" timestamptz not null default now(),
  "created_by_id" text,
  "created_by" text,
  "is_sample" boolean not null default false,
  "user_email" text,
  "name" text,
  "color" text default 'blue',
  "order" double precision
);
comment on table public."vault_folder" is 'Entité Base44 d''origine : VaultFolder';
alter table public."vault_folder" enable row level security;
revoke all on table public."vault_folder" from anon, authenticated;
drop trigger if exists "set_vault_folder_updated_date" on public."vault_folder";
create trigger "set_vault_folder_updated_date"
before update on public."vault_folder"
for each row execute function public.set_updated_date();
