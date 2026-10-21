import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { dossierId } = await req.json();

    if (!dossierId) {
      return Response.json({ error: 'Missing dossierId' }, { status: 400 });
    }

    const ratings = await base44.asServiceRole.entities.DossierRating.filter(
      { dossier_id: dossierId },
      '-created_date'
    );

    // Historical duplicates may exist. Only the newest rating for each member counts.
    const latestByUser = new Map();
    for (const item of ratings) {
      const key = String(item.user_email || '').toLowerCase();
      if (!key || latestByUser.has(key)) continue;
      latestByUser.set(key, item);
    }

    const effectiveRatings = Array.from(latestByUser.values());
    const avg = effectiveRatings.length > 0
      ? Number((effectiveRatings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / effectiveRatings.length).toFixed(1))
      : 0;

    let myRating = 0;
    try {
      const user = await base44.auth.me();
      if (user?.email) {
        myRating = Number(latestByUser.get(String(user.email).toLowerCase())?.rating || 0);
      }
    } catch {
      myRating = 0;
    }

    return Response.json({
      avg,
      count: effectiveRatings.length,
      myRating,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});