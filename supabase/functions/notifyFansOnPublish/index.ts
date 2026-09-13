import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { data: dossier, event } = body;

    // Only act on publish: status changed to 'published'
    const changedFields = body.changed_fields || [];
    const oldStatus = body.old_data?.status;
    const newStatus = dossier?.status;

    if (newStatus !== 'published' || oldStatus === 'published') {
      return Response.json({ skipped: true });
    }

    const authorEmail = dossier.submitted_by_email;
    if (!authorEmail) {
      return Response.json({ skipped: true, reason: 'no author email' });
    }

    // Fetch all active fans for this profile
    const fans = await base44.asServiceRole.entities.ProfileFanSubscription.filter({
      target_profile_id: authorEmail,
      status: 'active',
    });

    if (fans.length === 0) {
      return Response.json({ sent: 0 });
    }

    const authorName = dossier.submitted_by_name || authorEmail;
    const title = dossier.title || 'New content';
    const dossierUrl = `https://${req.headers.get('host') || 'aistageone.com'}/Magazine?dossier=${dossier.id || ''}`;

    let sent = 0;
    for (const fan of fans) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: fan.email,
        subject: `${authorName} just published new content`,
        body: `
<p>Hi,</p>
<p><strong>${authorName}</strong> just published new content you might love:</p>
<p style="font-size:18px"><strong>${title}</strong></p>
${dossier.description ? `<p>${dossier.description}</p>` : ''}
<p><a href="${dossierUrl}" style="background:#dc2626;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">View now</a></p>
<hr style="margin-top:32px"/>
<p style="font-size:11px;color:#999">You are receiving this because you subscribed as a fan of ${authorName}. 
To unsubscribe, visit their profile page and click the Fan button.</p>
        `.trim(),
      });
      sent++;
    }

    return Response.json({ sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});