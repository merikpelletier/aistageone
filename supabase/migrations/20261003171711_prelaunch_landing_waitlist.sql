create table if not exists public.landing_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text unique not null,
  eyebrow text,
  title text not null,
  subtitle text,
  body text,
  button_1_label text,
  button_1_url text,
  button_2_label text,
  button_2_url text,
  media_type text not null default 'image' check (media_type in ('image','video','embed','background_video')),
  media_url text,
  poster_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landing_section_items (
  id uuid primary key default gen_random_uuid(),
  section_key text not null,
  title text not null,
  body text,
  media_type text not null default 'image' check (media_type in ('image','video','embed')),
  media_url text,
  poster_url text,
  link_label text,
  link_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_subscribers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  language text,
  interest text,
  country text,
  profile_type text,
  source text not null default 'landing',
  status text not null default 'new' check (status in ('new','contacted','approved','invited','archived')),
  priority boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (email)
);

create table if not exists public.team_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  role_interest text,
  portfolio_url text,
  message text,
  status text not null default 'new' check (status in ('new','reviewing','contacted','accepted','declined','archived')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.landing_sections enable row level security;
alter table public.landing_section_items enable row level security;
alter table public.waitlist_subscribers enable row level security;
alter table public.team_applications enable row level security;

grant select on public.landing_sections, public.landing_section_items to anon, authenticated;
grant insert on public.waitlist_subscribers, public.team_applications to anon, authenticated;
grant select, insert, update, delete on public.landing_sections, public.landing_section_items, public.waitlist_subscribers, public.team_applications to authenticated;

create policy "landing sections public read" on public.landing_sections
for select to anon, authenticated using (
  is_active = true or coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin'
);

create policy "landing items public read" on public.landing_section_items
for select to anon, authenticated using (
  is_active = true or coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin'
);

create policy "waitlist public insert" on public.waitlist_subscribers
for insert to anon, authenticated with check (
  email is not null and length(trim(email)) > 3
);

create policy "team applications public insert" on public.team_applications
for insert to anon, authenticated with check (
  email is not null and length(trim(email)) > 3
);

create policy "landing sections admin all" on public.landing_sections
for all to authenticated
using (coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin')
with check (coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin');

create policy "landing items admin all" on public.landing_section_items
for all to authenticated
using (coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin')
with check (coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin');

create policy "waitlist admin all" on public.waitlist_subscribers
for all to authenticated
using (coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin')
with check (coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin');

create policy "team applications admin all" on public.team_applications
for all to authenticated
using (coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin')
with check (coalesce((select auth.jwt()->'app_metadata'->>'role'),'') = 'admin');

insert into public.landing_sections
(section_key, eyebrow, title, subtitle, body, button_1_label, button_1_url, button_2_label, button_2_url, media_type, media_url, is_active, sort_order)
values
('hero','PEOPLE × STORIES × AI × A GLOBAL STAGE','THE STAGE IS ALMOST YOURS.','Create. Perform. Publish.','A new platform where stories, characters, images, voices and creators come together.','PRE-REGISTER','#pre-register','JOIN THE TEAM','#join-team','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/d33fe251-ab3c-4daf-83fd-ea7416a64f81.png',true,10),
('studio','A CREATIVE PLATFORM FOR A NEW GENERATION','INSIDE THE STUDIO','One place where everything happens.','A unified creative studio for storytellers, performers and innovators — from concept and character to voice, music, scene and final publication.','PRIVATE PREVIEW','/Login',null,null,'image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/c3044927-e5ae-4a2e-916c-589a27894d05.png',true,30),
('join_cast','A NEW KIND OF ENTERTAINMENT','NOT JUST WATCH. JOIN THE CAST.','Real people. Bigger stories.','Creators, performers, designers, writers, developers and partners can all have a place on the stage.','PRE-REGISTER','#pre-register','JOIN THE TEAM','#join-team','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/90644b5b-9586-4054-b822-afdfcc802145.jpg',true,40)
on conflict (section_key) do update set
  eyebrow=excluded.eyebrow,title=excluded.title,subtitle=excluded.subtitle,body=excluded.body,
  button_1_label=excluded.button_1_label,button_1_url=excluded.button_1_url,
  button_2_label=excluded.button_2_label,button_2_url=excluded.button_2_url,
  media_type=excluded.media_type,media_url=excluded.media_url,is_active=excluded.is_active,sort_order=excluded.sort_order,
  updated_at=now();

insert into public.landing_section_items
(section_key,title,body,media_type,media_url,link_label,link_url,is_active,sort_order)
values
('pillars','CREATE','Images, video, voice, characters and worlds.','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/c3044927-e5ae-4a2e-916c-589a27894d05.png','DISCOVER','#studio',true,10),
('pillars','PERFORM','Bring characters to life with AI and your own talent.','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/d038e5f5-622d-48d9-9b84-b30cd314c07c.jpg','DISCOVER','#studio',true,20),
('pillars','PUBLISH','Turn ideas into episodes, experiences and more.','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/4b8ec107-c8d6-4526-9a33-c7d11512fbd6.jpg','DISCOVER','#studio',true,30),
('pillars','BUILD','Grow your audience, collaborate and create value.','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/base44-migration/09/091aa23f594c983427b065d2ed0ccee2d21caae718ca519c950b2768deae859f_a75e55e242d184cc_a42af0d40_musicvideocover.jpg','DISCOVER','#join-team',true,40),
('studio_tools','FotoPlay','Turn ideas into cinematic videos with AI.','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/d33fe251-ab3c-4daf-83fd-ea7416a64f81.png',null,null,true,10),
('studio_tools','Timeline','Build and edit your story.','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/90644b5b-9586-4054-b822-afdfcc802145.jpg',null,null,true,20),
('studio_tools','Lip Sync','Natural voice performance across languages.','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/fd3ceec1-0d99-4d7e-9793-284e342efe90/d038e5f5-622d-48d9-9b84-b30cd314c07c.jpg',null,null,true,30),
('studio_tools','Image Generation','Create characters, scenes and worlds.','image','https://dhpubzhobcccfbcmbvua.supabase.co/storage/v1/object/public/media/base44-migration/0e/0e53b7e90b350aba0f3657e75d4b02f388f8560adacbc961e675df51da5eedef_8ed3b1ed84e1718b_cbfdb7322_segment_8.jpg',null,null,true,40)
on conflict do nothing;
