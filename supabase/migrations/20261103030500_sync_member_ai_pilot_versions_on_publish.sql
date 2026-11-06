create or replace function public.sync_member_ai_pilot_versions_on_publish()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_published_version_id is not null
     and new.current_published_version_id is distinct from old.current_published_version_id then
    update public.member_ai_pilots
      set version_id = new.current_published_version_id
      where ai_pilot_id = new.id
        and version_id is distinct from new.current_published_version_id;

    update public.ai_pilot_project_assignments
      set version_id = new.current_published_version_id,
          updated_at = now()
      where ai_pilot_id = new.id
        and version_id is distinct from new.current_published_version_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_member_ai_pilot_versions_on_publish on public.ai_pilots;
create trigger sync_member_ai_pilot_versions_on_publish
after update of current_published_version_id on public.ai_pilots
for each row
execute function public.sync_member_ai_pilot_versions_on_publish();

update public.member_ai_pilots m
set version_id = p.current_published_version_id
from public.ai_pilots p
where m.ai_pilot_id = p.id
  and p.current_published_version_id is not null
  and m.version_id is distinct from p.current_published_version_id;

update public.ai_pilot_project_assignments a
set version_id = p.current_published_version_id,
    updated_at = now()
from public.ai_pilots p
where a.ai_pilot_id = p.id
  and p.current_published_version_id is not null
  and a.version_id is distinct from p.current_published_version_id;
