import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
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
    const conversation = await base44.agents.getConversation(conversationId);
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
      storyPlan = JSON.parse(content);
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
          await base44.agents.addMessage(conversation, {
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
    const pricing = await base44.entities.ToolPricing.filter({ tool_id: 'story_block', is_active: true }).then(r => r[0]);
    const theme = await base44.entities.StoryTheme.get(session.theme_id).catch(() => null);
    const tokenCost = pricing?.token_cost ?? theme?.credit_cost_per_block ?? 10;

    const adminEmail = (Deno.env.get('ADMIN_EMAIL') || '').toLowerCase().trim();
    const fullUser = await base44.asServiceRole.entities.User.filter({ email: user.email }).then(r => r[0]).catch(() => null);
    const isAdmin = (fullUser?.role || user.role) === 'admin' || (user.email || '').toLowerCase().trim() === adminEmail;

    let newBalance = 0;
    let balanceRecord = await base44.entities.UserTokenBalance.filter({ user_email: user.email }).then(r => r[0]);
    if (!balanceRecord) {
      balanceRecord = await base44.entities.UserTokenBalance.create({
        user_email: user.email, balance: 0, last_updated: new Date().toISOString(),
      });
    }

    newBalance = balanceRecord.balance;
    if (!isAdmin) {
      newBalance = balanceRecord.balance - tokenCost;
      await base44.entities.UserTokenBalance.update(balanceRecord.id, {
        balance: newBalance,
        last_updated: new Date().toISOString(),
      });
      await base44.entities.TokenTransaction.create({
        user_email: user.email,
        transaction_type: 'usage',
        token_amount: -tokenCost,
        balance_after: newBalance,
        related_entity: `story_block_${block_id}`,
        created_at: new Date().toISOString(),
      });
    }

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
    return Response.json({ error: error.message }, { status: 500 });
  }
});