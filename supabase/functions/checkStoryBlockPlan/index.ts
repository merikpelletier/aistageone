import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('checkStoryBlockPlan');
import { createClientFromRequest } from './_legacy/base44Compat.ts';
import { serveWithCors } from './_legacy/cors.ts';
import { jsonrepair } from 'npm:jsonrepair@3.13.1';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { block_id } = await req.json();
    if (!block_id) return Response.json({ error: 'block_id required' }, { status: 400 });

    // ── 1. Load block ──────────────────────────────────────────────────────────
    const block = await base44.entities.StoryBlock.get(block_id);
    if (!block) return Response.json({ error: 'Block not found' }, { status: 404 });

    // Verify ownership via session
    const session = await base44.entities.StorySession.get(block.session_id);
    if (!session || session.user_email !== user.email) {
      return Response.json({ error: 'Not your block' }, { status: 403 });
    }

    // ── 2. If already past planning WITH content, return current status ───────
    // (If "completed" but empty — corrupted — fall through to recovery below)
    const hasContent = block.narrative_summary || (block.segment_instructions && block.segment_instructions.length > 0);
    if (block.generation_status === 'failed') {
      return Response.json({
        block_id: block.id,
        status: 'failed',
        story_block: block,
        error: block.last_error || 'Planning failed',
      });
    }
    if (block.generation_status !== 'planning' && hasContent) {
      return Response.json({
        block_id: block.id,
        status: block.generation_status,
        story_block: block,
      });
    }

    const conversationId = block.planning_conversation_id;
    if (!conversationId) {
      return Response.json({ error: 'No planning conversation found' }, { status: 500 });
    }

    // ── 3. Check conversation for agent response ──────────────────────────────
    let conversation = await base44.agents.getConversation(conversationId);
    try {
      conversation = await base44.agents.pollMessage(conversation);
    } catch (predictionError) {
      const message = predictionError instanceof Error ? predictionError.message : String(predictionError);
      const failedBlock = await base44.entities.StoryBlock.update(block_id, {
        generation_status: 'failed',
        last_error: message,
      });
      return Response.json({
        block_id: block.id,
        status: 'failed',
        story_block: failedBlock,
        error: message,
      });
    }
    const messages = conversation.messages || [];
    const lastMsg = messages[messages.length - 1];

    // No assistant response yet — still planning
    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.content) {
      return Response.json({
        block_id: block.id,
        status: 'planning',
        message: 'Agent is still writing the story…',
      });
    }

    // ── 4. Try to parse the response as JSON ──────────────────────────────────
    let storyPlan;
    let parseOk = false;
    try {
      let content = lastMsg.content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      try {
        storyPlan = JSON.parse(content);
      } catch {
        // Replicate text models occasionally return JSON-shaped output with
        // unescaped quotes inside long image prompts. Repair it locally rather
        // than paying for a second model call solely to reformat the response.
        storyPlan = JSON.parse(jsonrepair(content));
      }
      parseOk = true;
    } catch {
      parseOk = false;
    }

    if (!parseOk) {
      // Could still be streaming. But if the block has been planning for a while,
      // the agent likely finished with invalid JSON — nudge it once to self-heal.
      const planningAgeMs = Date.now() - new Date(block.created_date).getTime();
      const STALE_MS = 150000; // 2.5 minutes
      if (planningAgeMs > STALE_MS) {
        const alreadyNudged = messages.some(m => m.role === 'user' && typeof m.content === 'string' && m.content.includes('[CORRECT_JSON]'));
        if (alreadyNudged) {
          await base44.entities.StoryBlock.update(block_id, { generation_status: 'failed', last_error: 'Agent did not return valid JSON' });
          return Response.json({ error: 'Agent did not return valid JSON after retry' }, { status: 500 });
        }
        try {
          await base44.agents.startMessage(conversation, {
            role: 'user',
            content: '[CORRECT_JSON] Your previous response could not be parsed as JSON. Respond with ONLY a valid JSON object matching the requested schema — no markdown, no code fences, no commentary. Include "segments" (array), "narrative_summary", "block_title", "selected_characters", "selected_sets", "choice_options", and "updated_memory" fields exactly as specified.',
          });
        } catch (_e) { /* ignore nudge failures */ }
        return Response.json({
          block_id: block.id,
          status: 'planning',
          message: 'Agent is fixing its response format…',
        });
      }
      // Still streaming — keep waiting
      return Response.json({
        block_id: block.id,
        status: 'planning',
        message: 'Agent is still writing the story…',
      });
    }

    // ── 5. Validate plan ──────────────────────────────────────────────────────
    // Enforce cast fidelity for every StoryTheme, not only a specific pack.
    const [theme, hero] = await Promise.all([
      base44.entities.StoryTheme.get(session.theme_id),
      base44.entities.StoryCharacter.get(session.hero_story_character_id),
    ]);
    const themeCharacters = (await Promise.all(
      (theme?.story_character_ids || []).map((id) =>
        base44.entities.StoryCharacter.get(id).catch(() => null)
      ),
    )).filter(Boolean);
    const allowedCharacterNames = [hero?.name, ...themeCharacters.map((character) => character.name), 'NPC']
      .filter(Boolean);
    const allowedLower = new Set(allowedCharacterNames.map((name) => String(name).toLowerCase().trim()));
    const reportedNames = [
      ...(storyPlan.selected_characters || []),
      ...(storyPlan.segments || []).flatMap((segment) => segment.characters_present || []),
    ];
    const dialogueSpeakers = (storyPlan.segments || []).flatMap((segment) => {
      const dialogue = String(segment.dialogue || '');
      return [...dialogue.matchAll(/(?:^|[\n])\s*([\p{L}][\p{L}'â€™.-]*(?:\s+[\p{L}][\p{L}'â€™.-]*){0,3})\s*:/gu)]
        .map((match) => match[1].trim());
    });
    const invalidCharacterNames = [...new Set([...reportedNames, ...dialogueSpeakers]
      .map((name) => String(name || '').trim())
      .filter((name) => name && !allowedLower.has(name.toLowerCase())))];

    if (invalidCharacterNames.length > 0) {
      const alreadyCorrected = messages.some((message) =>
        message.role === 'user' && typeof message.content === 'string' && message.content.includes('[CORRECT_CAST]')
      );
      if (alreadyCorrected) {
        const reason = `Unauthorized named characters: ${invalidCharacterNames.join(', ')}`;
        const failedBlock = await base44.entities.StoryBlock.update(block_id, {
          generation_status: 'failed',
          last_error: reason,
        });
        return Response.json({
          block_id: block.id,
          status: 'failed',
          story_block: failedBlock,
          error: reason,
        });
      }
      await base44.agents.startMessage(conversation, {
        role: 'user',
        content: `[CORRECT_CAST] Rewrite the entire previous JSON story block. Remove or replace every unauthorized named character: ${invalidCharacterNames.join(', ')}. The ONLY allowed named characters and dialogue speakers are: ${allowedCharacterNames.join(', ')}. Preserve their supplied canon, occupations, relationships, personalities, and motives. NPC means unnamed background only and may not speak or drive the plot. Return ONLY the complete corrected JSON object with all required fields and at least 9 segments.`,
      });
      return Response.json({
        block_id: block.id,
        status: 'planning',
        message: 'The agent is correcting cast fidelityâ€¦',
      });
    }

    if (!storyPlan.segments || !Array.isArray(storyPlan.segments) || storyPlan.segments.length === 0) {
      await base44.entities.StoryBlock.update(block_id, { generation_status: 'failed' });
      return Response.json({ error: 'Agent response missing segments' }, { status: 500 });
    }

    // ── 6. Update block with the parsed plan ──────────────────────────────────
    const choices = storyPlan.choice_options || [];
    const selectedChoiceId = choices.length > 0 ? choices[0].id : null;

    const updatedBlock = await base44.entities.StoryBlock.update(block_id, {
      choice_options: choices,
      selected_choice: selectedChoiceId,
      narrative_summary: storyPlan.narrative_summary || '',
      segment_instructions: storyPlan.segments || [],
      block_title: storyPlan.block_title || `Block ${block.order + 1}`,
      selected_characters: storyPlan.selected_characters || [],
      selected_sets: storyPlan.selected_sets || [],
      generation_status: 'pending',
    });

    // ── 7. Update session memory ───────────────────────────────────────────────
    // A one-chapter pivot (is_storyline_switch) must NOT overwrite the main
    // storyline's continuity memory — only real chapters update it.
    const isPivot = block.is_storyline_switch === true;
    const sessionUpdate = { block_count: (session.block_count || 0) + 1 };
    if (!isPivot) {
      sessionUpdate.story_memory = storyPlan.updated_memory || session.story_memory || {};
    }
    await base44.entities.StorySession.update(session.id, sessionUpdate);

    // ── 8. Deduct tokens (now that the plan succeeded) ─────────────────────────
    // generateStoryBlock already reserved and consumed the Story Block charge
    // before starting the AI request. Polling must never charge a second time.
    const balanceRecord = await base44.entities.UserTokenBalance
      .filter({ user_email: user.email })
      .then(r => r[0]);
    const newBalance = balanceRecord?.balance ?? 0;

    // ── 9. Return — ready for video generation ─────────────────────────────────
    return Response.json({
      block_id: block.id,
      status: 'pending',
      story_block: updatedBlock,
      balance_after: newBalance,
      total_segments: storyPlan.segments.length,
    });

  } catch (error) {
    console.error('checkStoryBlockPlan error:', error.message);
    throw error;
  }
});
