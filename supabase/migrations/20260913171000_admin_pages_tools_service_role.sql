begin;

grant select, insert, update, delete on public.admin_surface_setting to service_role;
grant select, insert, update, delete on public.admin_code_change to service_role;

commit;
