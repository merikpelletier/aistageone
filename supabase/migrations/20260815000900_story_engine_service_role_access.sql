-- StoryBlock simulation state is mutated only by trusted Edge Functions.
-- Browser roles keep their existing restrictions; this grants the backend role
-- the DML privileges required by initializeSimulation and the resolvers.

grant select, insert, update, delete on table
  public.story_session,
  public.story_block,
  public.sim_active_situation,
  public.sim_asset,
  public.sim_belief,
  public.sim_character,
  public.sim_character_action,
  public.sim_claim,
  public.sim_consequence,
  public.sim_information_transmission,
  public.sim_location,
  public.sim_observation,
  public.sim_state_change,
  public.sim_world_time
to service_role;
