-- Restaure les droits de l’éditeur AdminDossiers après la reprise de l’historique.

grant select, insert, update, delete on table public.dossier to authenticated;
drop policy if exists "admin_manage_dossier" on public.dossier;
create policy "admin_manage_dossier"
on public.dossier for all to authenticated
using (public.is_admin())
with check (public.is_admin());
