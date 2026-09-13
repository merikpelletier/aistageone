import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dossierId, comment } = await req.json();

    if (!dossierId || !comment) {
      return Response.json({ error: 'Missing dossierId or comment' }, { status: 400 });
    }

    await base44.entities.DossierComment.create({
      dossier_id: dossierId,
      user_email: user.email,
      user_name: user.full_name,
      content: comment
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});