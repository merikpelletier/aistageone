import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all story setup data using service role to bypass any RLS issues
    const [themes, characters, sets, topics, pricing] = await Promise.all([
      base44.asServiceRole.entities.StoryTheme.filter({ is_active: true }, 'order', 50),
      base44.asServiceRole.entities.StoryCharacter.filter({ is_active: true }),
      base44.asServiceRole.entities.StorySet.filter({}),
      base44.asServiceRole.entities.StartingTopic.filter({}, 'order', 50),
      base44.asServiceRole.entities.ToolPricing.filter({ tool_id: 'story_block', is_active: true }),
    ]);

    // A character is visible to a user only if it belongs to a theme's shared cast
    // (linked via story_character_ids) OR it was created by this user (their own private hero).
    // This keeps user-created characters linked to the user, never attached to everyone's pool.
    const linkedCharIds = new Set<string>();
    themes.forEach(t => (t.story_character_ids || []).forEach((id: string) => linkedCharIds.add(id)));
    const visibleCharacters = characters.filter(c => linkedCharIds.has(c.id) || c.created_by_id === user.id);

    return Response.json({
      themes,
      characters: visibleCharacters,
      sets,
      topics,
      token_cost: pricing[0]?.token_cost ?? 10,
    });
  } catch (error) {
    console.error('getStorySetup error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});