import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { event, data } = body;
    const dossierId = event?.entity_id;

    if (!dossierId) {
      return Response.json({ error: 'No entity_id provided' }, { status: 400 });
    }

    // Only auto-publish content submitted for review (pending_review).
    // Leave published, rejected, unpublished, and draft untouched — admins control those.
    const currentStatus = data?.status;
    if (currentStatus !== 'pending_review') {
      return Response.json({ message: 'No action needed', status: currentStatus });
    }

    await base44.asServiceRole.entities.Dossier.update(dossierId, {
      status: 'published'
    });

    return Response.json({ success: true, message: `Dossier ${dossierId} auto-published` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});