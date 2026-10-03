-- Pre-launch hard gate.
-- All existing platform tables remain subject to their normal RLS policies,
-- plus this restrictive policy requiring an authenticated Admin or Guest role.
-- Public landing/intake tables are intentionally excluded.

do $$
declare
  r record;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname not in (
        'landing_sections',
        'landing_section_items',
        'waitlist_subscribers',
        'team_applications'
      )
  loop
    execute format('drop policy if exists "prelaunch admin guest gate" on public.%I', r.table_name);
    execute format(
      'create policy "prelaunch admin guest gate" on public.%I as restrictive for all to anon, authenticated using (coalesce((select auth.jwt()->''app_metadata''->>''role''), '''') in (''admin'', ''guest'')) with check (coalesce((select auth.jwt()->''app_metadata''->>''role''), '''') in (''admin'', ''guest''))',
      r.table_name
    );
  end loop;
end
$$;
