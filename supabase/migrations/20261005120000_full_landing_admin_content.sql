-- Completes the pre-launch landing CMS seed so every visible content block can be managed from Admin > Pre-launch.
-- Idempotent by design: existing admin-edited content is never overwritten.

insert into public.landing_sections
(section_key, eyebrow, title, subtitle, body, button_1_label, button_1_url, button_2_label, button_2_url, media_type, is_active, sort_order)
values
('header', null, 'AI STAGE ONE', null, null, 'Private Preview', '/Login', 'Login', '/Login', 'image', true, 0),
('pillars_section', null, 'VISION', null, null, null, null, null, null, 'image', true, 20),
('hero_note', null, 'Full platform access is currently limited to Admins and invited Guests.', null, null, null, null, null, null, 'image', true, 11),
('studio_preview', null, 'Play preview', null, null, null, null, null, null, 'image', true, 31),
('forms', null, 'PRE-LAUNCH FORMS', null, null, null, null, null, null, 'image', true, 50),
('pre_register', 'BE PART OF WHAT''S NEXT', 'PRE-REGISTER FOR LAUNCH ACCESS', 'SENDING…', 'Get early updates, behind-the-scenes content and be among the first to know when we open the stage to more creators.', 'PRE-REGISTER →', 'You are on the list. We will keep you informed.', 'You are already on the pre-launch list.', 'Unable to register right now.', 'image', true, 51),
('pre_register_fields', null, 'Your name', 'Email', null, null, null, null, null, 'image', true, 52),
('join_team', 'CREATIVE PEOPLE. REAL IMPACT.', 'JOIN THE TEAM', 'SENDING…', 'We''re looking for exceptional creatives, technologists and partners to help shape the future of AI-powered entertainment.', 'SEND APPLICATION →', 'Thank you. Your application has been received.', 'Unable to send your application right now.', null, 'image', true, 53),
('join_team_fields', null, 'Your name', 'Email', 'Role / specialty', 'Portfolio / website', null, 'Tell us what you would like to bring to AI STAGE ONE', null, 'image', true, 54),
('footer', null, 'AI STAGE ONE', null, 'A global stage for a new creative generation.', null, null, null, null, 'image', true, 100)
on conflict (section_key) do nothing;

insert into public.landing_section_items
(section_key, title, body, media_type, link_url, is_active, sort_order)
select v.section_key, v.title, v.body, 'image', v.link_url, true, v.sort_order
from (values
('header_nav','Vision',null,'#vision',10),
('header_nav','Studio',null,'#studio',20),
('header_nav','Pre-register',null,'#pre-register',30),
('join_cast_roles','Creators','& Performers',null,10),
('join_cast_roles','Writers','& Designers',null,20),
('join_cast_roles','Developers','& Tech Talent',null,30),
('join_cast_roles','Partners','& Collaborators',null,40),
('waitlist_languages','English',null,'English',10),
('waitlist_languages','Français',null,'Français',20),
('waitlist_languages','Español',null,'Español',30),
('waitlist_interests','Creator / Performer',null,'Creator / Performer',10),
('waitlist_interests','Writer / Designer',null,'Writer / Designer',20),
('waitlist_interests','Developer / Tech',null,'Developer / Tech',30),
('waitlist_interests','Brand / Partner',null,'Brand / Partner',40),
('waitlist_interests','Viewer / Fan',null,'Viewer / Fan',50),
('waitlist_interests','Other',null,'Other',60),
('footer_nav','Vision',null,'#vision',10),
('footer_nav','Studio',null,'#studio',20),
('footer_nav','Pre-register',null,'#pre-register',30),
('footer_nav','Login',null,'/Login',40)
) as v(section_key,title,body,link_url,sort_order)
where not exists (
  select 1
  from public.landing_section_items x
  where x.section_key = v.section_key
    and x.sort_order = v.sort_order
);
