create temporary table base44_connection_audit (
  table_name text primary key,
  matching_rows bigint not null
);

do $audit$
declare
  relation record;
  matches bigint;
begin
  for relation in
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format(
      'select count(*) from public.%I as row_data where row_to_json(row_data)::text ~* %L',
      relation.tablename,
      'base44\.(app|com)'
    ) into matches;

    if matches > 0 then
      insert into base44_connection_audit(table_name, matching_rows)
      values (relation.tablename, matches);
    end if;
  end loop;
end
$audit$;

select table_name, matching_rows
from base44_connection_audit
order by table_name;
