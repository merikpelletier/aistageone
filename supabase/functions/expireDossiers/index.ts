import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Find all published dossiers that have a publish_until in the past
    const published = await base44.asServiceRole.entities.Dossier.filter({ status: 'published' });

    const expired = published.filter(d =>
      d.publish_until && d.publish_until < now && d.submitted_by_email
    );

    let count = 0;
    for (const d of expired) {
      await base44.asServiceRole.entities.Dossier.update(d.id, { status: 'unpublished' });
      count++;
    }

    return Response.json({ expired: count, checked: published.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});