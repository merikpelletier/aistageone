import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { dossierId } = await req.json();

    if (!dossierId) {
      return Response.json({ error: 'Missing dossierId' }, { status: 400 });
    }

    const comments = await base44.asServiceRole.entities.DossierComment.filter(
      { dossier_id: dossierId },
      '-created_date'
    );

    return Response.json({ comments });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
