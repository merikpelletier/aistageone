create temporary table base44_connection_details (
  table_name text not null,
  row_id text,
  column_name text not null,
  value_excerpt text not null
);

do $audit$
declare
  field record;
begin
  for field in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.data_type in ('text', 'character varying', 'json', 'jsonb')
    order by c.table_name, c.ordinal_position
  loop
    execute format(
      'insert into base44_connection_details(table_name, row_id, column_name, value_excerpt)
       select %L, coalesce(to_jsonb(row_data)->>''id'', ''''), %L,
              left(coalesce(to_jsonb(row_data)->>%L, ''''), 500)
       from public.%I as row_data
       where coalesce(to_jsonb(row_data)->>%L, '''') ~* %L',
      field.table_name,
      field.column_name,
      field.column_name,
      field.table_name,
      field.column_name,
      'base44\.(app|com)'
    );
  end loop;
end
$audit$;

select table_name, row_id, column_name, value_excerpt
from base44_connection_details
order by table_name, row_id, column_name;
