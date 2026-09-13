import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dossierId, rating } = await req.json();

    if (!dossierId || !rating || rating < 1 || rating > 5) {
      return Response.json({ error: 'Invalid dossierId or rating' }, { status: 400 });
    }

    await base44.entities.DossierRating.create({
      dossier_id: dossierId,
      user_email: user.email,
      rating
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});