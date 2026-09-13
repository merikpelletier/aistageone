-- Métadonnées présentes dans les CSV Base44, mais absentes des schémas d'entités.
-- La migration est additive et sans perte.

do $$
declare
  target_table record;
begin
  for target_table in
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format(
      'alter table public.%I add column if not exists created_by_id text',
      target_table.tablename
    );
    execute format(
      'alter table public.%I add column if not exists is_sample boolean not null default false',
      target_table.tablename
    );
  end loop;
end;
$$;
