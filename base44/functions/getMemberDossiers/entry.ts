import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { memberEmail } = await req.json();

    if (!memberEmail) {
      return Response.json({ error: 'Missing memberEmail' }, { status: 400 });
    }

    // Use asServiceRole so this works for both guests and logged-in users
    let dossiers = await base44.asServiceRole.entities.Dossier.filter(
      { status: 'published', submitted_by_email: memberEmail },
      'order'
    );

    // Older dossiers have no submitted_by_email — fall back to created_by
    if (dossiers.length === 0) {
      const all = await base44.asServiceRole.entities.Dossier.filter({ status: 'published' }, 'order');
      dossiers = all.filter(d => d.created_by === memberEmail);
    }

    return Response.json({ dossiers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});