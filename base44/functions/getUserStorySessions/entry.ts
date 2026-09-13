import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { theme_id } = await req.json();
    if (!theme_id) return Response.json({ error: 'theme_id required' }, { status: 400 });

    // Service role bypasses client-side rate limits
    const sessions = await base44.asServiceRole.entities.StorySession.filter(
      { theme_id, user_email: user.email, status: 'active' },
      '-created_date',
      50
    );

    return Response.json({ sessions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});