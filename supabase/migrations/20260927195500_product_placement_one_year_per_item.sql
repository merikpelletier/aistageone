alter table public.product_placement_package alter column duration_days set default 365;

update public.product_placement_package
set duration_days = 365,
    updated_at = now()
where duration_days <> 365;
