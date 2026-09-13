import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { dossierId } = await req.json();

    if (!dossierId) {
      return Response.json({ error: 'Missing dossierId' }, { status: 400 });
    }

    const comments = await base44.entities.DossierComment.filter(
      { dossier_id: dossierId },
      '-created_date'
    );

    return Response.json({ comments });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});