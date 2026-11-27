create table public.marketing_campaigns (
id uuid primary key default gen_random_uuid(),
brand text not null check (brand in ('aistage','leplateau')),
name text not null check (length(trim(name)) between 1 and 200),
objective text not null default '',
audience text not null default '',
strategy text not null default '',
budget_cad numeric(12,2) not null default 0 check (budget_cad >= 0),
starts_on date, ends_on date,
status text not null default 'draft' check (status in ('draft','approved','archived')),
created_at timestamptz not null default now(),
check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
alter table public.marketing_campaigns enable row level security;
revoke all on public.marketing_campaigns from public, anon, authenticated;
grant select, insert, update on public.marketing_campaigns to authenticated;
create policy marketing_admin_select on public.marketing_campaigns for select to authenticated using ((select public.is_admin()));
create policy marketing_admin_insert on public.marketing_campaigns for insert to authenticated with check ((select public.is_admin()));
create policy marketing_admin_update on public.marketing_campaigns for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.translation_dictionary(namespace,source_key,translations) values ('ui','Marketing', '{"en":"Marketing","fr":"Marketing"}'::jsonb),
('ui','Campaigns', '{"en":"Campaigns","fr":"Campagnes"}'::jsonb),
('ui','New campaign', '{"en":"New campaign","fr":"Nouvelle campagne"}'::jsonb),
('ui','Campaign name', '{"en":"Campaign name","fr":"Nom de la campagne"}'::jsonb),
('ui','Brand', '{"en":"Brand","fr":"Marque"}'::jsonb),
('ui','Objective', '{"en":"Objective","fr":"Objectif"}'::jsonb),
('ui','Target audience', '{"en":"Target audience","fr":"Public cible"}'::jsonb),
('ui','Strategy', '{"en":"Strategy","fr":"Stratégie"}'::jsonb),
('ui','Budget (CAD)', '{"en":"Budget (CAD)","fr":"Budget (CAD)"}'::jsonb),
('ui','Start date', '{"en":"Start date","fr":"Date de début"}'::jsonb),
('ui','End date', '{"en":"End date","fr":"Date de fin"}'::jsonb),
('ui','Draft', '{"en":"Draft","fr":"Brouillon"}'::jsonb),
('ui','Approved', '{"en":"Approved","fr":"Approuvée"}'::jsonb),
('ui','Archived', '{"en":"Archived","fr":"Archivée"}'::jsonb),
('ui','Save campaign', '{"en":"Save campaign","fr":"Enregistrer la campagne"}'::jsonb),
('ui','Cancel', '{"en":"Cancel","fr":"Annuler"}'::jsonb),
('ui','Edit', '{"en":"Edit","fr":"Modifier"}'::jsonb),
('ui','No campaigns', '{"en":"No campaigns","fr":"Aucune campagne"}'::jsonb),
('ui','All brands', '{"en":"All brands","fr":"Toutes les marques"}'::jsonb),
('ui','Planned budget', '{"en":"Planned budget","fr":"Budget prévu"}'::jsonb),
('ui','Loading', '{"en":"Loading","fr":"Chargement"}'::jsonb),
('ui','Campaign planning only — no automatic publication or spending.', '{"en":"Campaign planning only — no automatic publication or spending.","fr":"Planification uniquement — aucune publication ni dépense automatique."}'::jsonb),
('ui','Status', '{"en":"Status","fr":"Statut"}'::jsonb),
('ui','Retry', '{"en":"Retry","fr":"Réessayer"}'::jsonb) on conflict (namespace,source_key) do nothing;
