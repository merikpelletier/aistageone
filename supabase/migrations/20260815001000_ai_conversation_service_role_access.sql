-- The StoryBlock agent bridge runs with the server service role and must be
-- able to persist and update its private conversation state.
grant select, insert, update, delete
on table public.ai_conversation
to service_role;
