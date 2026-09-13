-- Story publication is an authenticated server workflow. The Edge Function
-- verifies StorySession ownership before using service_role for these writes.
grant select, insert, update, delete on table public.dossier to service_role;
grant select, insert, update, delete on table public.dossier_page to service_role;
