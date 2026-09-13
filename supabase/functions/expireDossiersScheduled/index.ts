import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();

    const published = await base44.asServiceRole.entities.Dossier.filter({ status: 'published' });

    const expired = published.filter(d =>
      d.publish_until && d.publish_until < now && d.submitted_by_email
    );

    let count = 0;
    for (const d of expired) {
      await base44.asServiceRole.entities.Dossier.update(d.id, { status: 'unpublished' });
      count++;
    }

    console.log(`Expired ${count} dossiers`);
    return Response.json({ expired: count });
  } catch (error) {
    console.error(error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});