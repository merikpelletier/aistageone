import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('agent-conversations');
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';
import { generateText } from './_legacy/replicateAi.ts';
import { agentPrompts } from './_legacy/generatedAgentPrompts.ts';

serveWithCors(async (request) => {
  const billing = await createCreditBillingContext(request);
  const { user, service } = billing;
  const body = await request.json();
  const action = body.action;

  if (action === 'list') {
    let query = service.from('ai_conversation').select('*').eq('user_id', user.id);
    if (body.agent_name) query = query.eq('agent_name', body.agent_name);
    const { data, error } = await query.order('updated_at', { ascending: false }).limit(20);
    if (error) throw error;
    return Response.json(data || []);
  }

  if (action === 'create') {
    const { data, error } = await service.from('ai_conversation').insert({
      user_id: user.id,
      agent_name: body.agent_name || 'production_assistant',
      metadata: body.metadata || {},
    }).select('*').single();
    if (error) throw error;
    return Response.json(data);
  }

  if (action === 'get') {
    const { data, error } = await service.from('ai_conversation').select('*')
      .eq('id', body.conversation_id).eq('user_id', user.id).single();
    if (error) throw error;
    return Response.json(data);
  }

  if (action === 'message') {
    const { data: conversation, error } = await service.from('ai_conversation').select('*')
      .eq('id', body.conversation_id).eq('user_id', user.id).single();
    if (error || !conversation) throw error || new Error('Conversation not found');

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: String(body.message?.content || ''),
      created_at: new Date().toISOString(),
    };
    const messages = [...(conversation.messages || []), userMessage];
    const recent = messages.slice(-12).map((item) => `${item.role}: ${item.content}`).join('\n\n');

    let knowledgeContext = '';
    let adminBehavior = '';
    if (conversation.agent_name === 'production_assistant') {
      const { data: agentBar } = await service.from('admin_surface_setting').select('active,configuration')
        .eq('surface_type', 'tool').eq('surface_key', 'agent_bar').maybeSingle();
      if (agentBar?.active) {
        const configured = agentBar.configuration || {};
        adminBehavior = [
          configured.prompt ? `Admin-configured behavior: ${configured.prompt}` : '',
          configured.permissions?.length ? `Granted permissions: ${configured.permissions.join(', ')}` : '',
          configured.actions?.length ? `Allowed actions: ${configured.actions.join(', ')}` : '',
        ].filter(Boolean).join('\n');
      }
      const terms = userMessage.content.toLowerCase().split(/\W+/).filter((term) => term.length > 4).slice(0, 8);
      const { data: entries } = await service.from('knowledge_entry').select('title,content,tags').eq('is_active', true).limit(100);
      const ranked = (entries || []).map((entry) => {
        const haystack = `${entry.title || ''} ${entry.content || ''} ${(entry.tags || []).join(' ')}`.toLowerCase();
        return { entry, score: terms.filter((term) => haystack.includes(term)).length };
      }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
      if (ranked.length) {
        knowledgeContext = `\n\nAISTAGE knowledge base:\n${ranked.map(({ entry }) => `${entry.title}: ${entry.content}`).join('\n\n')}`;
      }
    }

    const { result: answer, charge } = await withCreditCharge({
      ...billing,
      toolId: 'ai_agent',
      provider: 'replicate',
      relatedEntity: `agent_${conversation.agent_name}`,
    }, () => generateText({
        instructions: [agentPrompts[conversation.agent_name] || agentPrompts.production_assistant, adminBehavior].filter(Boolean).join('\n\n'),
        prompt: `${recent}${knowledgeContext}`,
        reasoningEffort: conversation.agent_name === 'story_orchestrator' ? 'medium' : 'low',
      }));
    messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: typeof answer === 'string' ? answer : JSON.stringify(answer),
      created_at: new Date().toISOString(),
    });

    const { data: updated, error: updateError } = await service.from('ai_conversation')
      .update({ messages, updated_at: new Date().toISOString() })
      .eq('id', conversation.id).eq('user_id', user.id).select('*').single();
    if (updateError) throw updateError;
    return Response.json({
      ...updated,
      credit_cost: charge.cost,
      balance_after: charge.balanceAfter,
    });
  }

  return Response.json({ error: 'Unsupported action' }, { status: 400 });
});
