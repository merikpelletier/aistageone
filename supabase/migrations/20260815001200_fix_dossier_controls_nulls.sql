create or replace function public.set_dossier_controls()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rating_reasons := coalesce(new.rating_reasons, '{}');
  new.audio_languages := coalesce(new.audio_languages, '{}');
  new.subtitle_languages := coalesce(new.subtitle_languages, '{}');
  new.adult_age_gate_required := coalesce(new.content_rating = '18+', false);
  new.adult_warning_page_required := coalesce(new.content_rating = '18+', false);
  new.commercial_access_required := coalesce(new.access_model = 'paid', false);

  if new.public_promo_confirmed and tg_op = 'INSERT' then
    new.public_promo_confirmed_at := now();
    new.public_promo_confirmed_by := coalesce(auth.uid(), new.public_promo_confirmed_by);
  elsif new.public_promo_confirmed and not coalesce(old.public_promo_confirmed, false) then
    new.public_promo_confirmed_at := now();
    new.public_promo_confirmed_by := coalesce(auth.uid(), new.public_promo_confirmed_by);
  elsif not new.public_promo_confirmed then
    new.public_promo_confirmed_at := null;
    new.public_promo_confirmed_by := null;
  end if;
  return new;
end;
$$;
