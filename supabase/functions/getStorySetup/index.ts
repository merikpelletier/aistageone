import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all story setup data using service role to bypass any RLS issues
    const [themes, characters, sets, pricing] = await Promise.all([
      base44.asServiceRole.entities.StoryTheme.filter({ is_active: true }, 'order', 50),
      base44.asServiceRole.entities.StoryCharacter.filter({ is_active: true }),
      base44.asServiceRole.entities.StorySet.filter({}),
      base44.asServiceRole.entities.ToolPricing.filter({ tool_id: 'story_block', is_active: true }),
    ]);

    // Topics belong to a pack. Fetch them per active pack so a global catalog
    // limit cannot hide every topic from packs that sort after the first 50 rows.
    const topicGroups = await Promise.all(
      themes.map((theme) => base44.asServiceRole.entities.StartingTopic.filter(
        { theme_id: theme.id },
        'order',
        1000,
      )),
    );
    const topics = topicGroups.flat();

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
