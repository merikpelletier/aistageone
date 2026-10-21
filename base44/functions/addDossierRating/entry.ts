import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dossierId, rating } = await req.json();
    const numericRating = Number(rating);

    if (!dossierId || !Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return Response.json({ error: 'Invalid dossierId or rating' }, { status: 400 });
    }

    const existing = await base44.entities.DossierRating.filter({
      dossier_id: dossierId,
      user_email: user.email,
    }, '-created_date');

    if (existing.length > 0) {
      await base44.entities.DossierRating.update(existing[0].id, {
        rating: numericRating,
      });
    } else {
      await base44.entities.DossierRating.create({
        dossier_id: dossierId,
        user_email: user.email,
        rating: numericRating,
      });
    }

    return Response.json({ success: true, rating: numericRating });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});