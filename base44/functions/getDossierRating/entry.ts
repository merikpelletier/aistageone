import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { dossierId } = await req.json();

    if (!dossierId) {
      return Response.json({ error: 'Missing dossierId' }, { status: 400 });
    }

    const ratings = await base44.asServiceRole.entities.DossierRating.filter({ dossier_id: dossierId });
    
    const avg = ratings.length > 0 
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : 0;

    return Response.json({ avg: parseFloat(avg), count: ratings.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});