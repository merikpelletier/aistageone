alter table public.agent_config
  alter column voice_model set default 'Rachel';

update public.agent_config
set voice_model = case lower(voice_model)
  when 'river' then 'Rachel'
  when 'honey' then 'Rachel'
  when 'sunny' then 'Aria'
  when 'storm' then 'Drew'
  when 'spark' then 'Domi'
  when 'clyde' then 'Rachel'
  when 'fin' then 'Rachel'
  when 'bella' then 'Rachel'
  when 'antoni' then 'Rachel'
  else voice_model
end
where lower(voice_model) in ('river', 'honey', 'sunny', 'storm', 'spark', 'clyde', 'fin', 'bella', 'antoni');

alter table public.story_session
  alter column narrator_voice set default 'Rachel';

update public.story_session
set narrator_voice = case lower(narrator_voice)
  when 'river' then 'Rachel'
  when 'honey' then 'Rachel'
  when 'sunny' then 'Aria'
  when 'storm' then 'Drew'
  when 'spark' then 'Domi'
  when 'clyde' then 'Rachel'
  when 'fin' then 'Rachel'
  when 'bella' then 'Rachel'
  when 'antoni' then 'Rachel'
  else narrator_voice
end
where lower(narrator_voice) in ('river', 'honey', 'sunny', 'storm', 'spark', 'clyde', 'fin', 'bella', 'antoni');
