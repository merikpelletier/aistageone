import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('proposeStoryArc');
import { createClientFromRequest } from './_legacy/base44Compat.ts';
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';

serveWithCors(async (req) => {
  try {
    const billing = await createCreditBillingContext(req);
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { theme_id, hero_character_id, starting_topic_id } = await req.json();
    if (!theme_id || !hero_character_id || !starting_topic_id) {
      return Response.json({ error: 'theme_id, hero_character_id, and starting_topic_id are required' }, { status: 400 });
    }

    const [theme, hero, topic] = await Promise.all([
      base44.entities.StoryTheme.get(theme_id),
      base44.entities.StoryCharacter.get(hero_character_id),
      base44.entities.StartingTopic.get(starting_topic_id),
    ]);
    if (!theme) return Response.json({ error: 'Theme not found' }, { status: 404 });
    if (!hero) return Response.json({ error: 'Hero not found' }, { status: 404 });
    if (!topic) return Response.json({ error: 'Topic not found' }, { status: 404 });

    const themeCharacters = (await Promise.all(
      (theme.story_character_ids || []).map((id) =>
        base44.entities.StoryCharacter.get(id).catch(() => null)
      ),
    )).filter(Boolean);
    const castById = new Map(
      [hero, ...themeCharacters].filter(Boolean).map((character) => [character.id, character]),
    );
    const allowedCast = [...castById.values()];
    const castDescription = allowedCast.map((character) =>
      `- ${character.name} (${character.character_type || 'character'}): ${character.description || 'N/A'}${character.backstory ? ` | Backstory: ${character.backstory.slice(0, 2500)}` : ''}${character.traits?.length ? ` | Traits: ${character.traits.join(', ')}` : ''}`
    ).join('\n');
    const taggedNames = (topic.character_ids || [])
      .map((id) => castById.get(id)?.name)
      .filter(Boolean);

    const prompt = `You are a master story architect. Given a story theme, a hero character, and a starting topic, design a compelling story arc blueprint that an AI will use to write the story chapter by chapter.

THEME:
- Title: ${theme.title}
- Description: ${theme.description}
- Tone rules: ${theme.tone_rules || 'N/A'}
- Story rules: ${theme.story_rules || 'N/A'}

HERO:
- Name: ${hero.name}
- Role: ${hero.character_type || 'Hero'}
- Bio: ${hero.description || 'N/A'}

STARTING TOPIC:
- Title: ${topic.title}
- Description: ${topic.description}

AUTHORIZED CAST â€” THESE ARE THE ONLY NAMED CHARACTERS THAT EXIST IN THIS STORY:
${castDescription}

TOPIC-TAGGED CHARACTERS (feature these when relevant):
${taggedNames.length ? taggedNames.join(', ') : 'None'}

CAST FIDELITY RULES (NON-NEGOTIABLE):
- Use ONLY the exact named characters listed in AUTHORIZED CAST.
- NEVER invent a named guest, official, lawyer, artist, employee, relative, villain, courier, or businessperson.
- Unnamed background extras may exist, but they receive no name, biography, subplot, dialogue, or decisive story role.
- Preserve every listed character's established occupation, relationships, personality, knowledge, and motives. Do not replace them with generic equivalents.
- The Hero remains ${hero.name}. The arc must grow from ${hero.name}'s established biography and the existing Les Oubliettes cast.
- If the topic needs a role not present in the authorized cast, restructure the event around an existing authorized character instead of inventing someone.

Design a story arc. Decide:
- chapter_count: a sensible total number of chapters (between 3 and 12) needed to tell this story well — enough to build tension and reach a satisfying reveal.
- start: 1-3 sentences describing how the story begins (the setup — world, Hero's situation, the inciting conflict).
- middle: 1-3 sentences describing the rising action — complications, twists, escalating stakes, key confrontations.
- reveal: 1-3 sentences describing the climax and resolution — the big reveal/payoff the whole story builds toward.

The arc must be specific to this theme + hero + topic, dramatic, faithful to the authorized cast, and give clear direction for chapter-by-chapter development. Keep each field concise but vivid.

Return ONLY the JSON object.`;

    const { result: arc, charge } = await withCreditCharge({
      ...billing,
      toolId: 'ai_text',
      provider: 'replicate',
      relatedEntity: 'propose_story_arc',
    }, () => base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            chapter_count: { type: 'number' },
            start: { type: 'string' },
            middle: { type: 'string' },
            reveal: { type: 'string' },
          },
          required: ['chapter_count', 'start', 'middle', 'reveal'],
        },
      }));

    if (!arc || typeof arc.chapter_count !== 'number') {
      return Response.json({ error: 'AI failed to produce a valid arc' }, { status: 500 });
    }

    return Response.json({
      chapter_count: Math.max(1, Math.min(20, Math.round(arc.chapter_count))),
      start: arc.start || '',
      middle: arc.middle || '',
      reveal: arc.reveal || '',
      credit_cost: charge.cost,
      balance_after: charge.balanceAfter,
    });
  } catch (error) {
    console.error('proposeStoryArc error:', error.message);
    throw error;
  }
});
