import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { message, email } = await req.json();

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    const adminEmail = Deno.env.get('ADMIN_EMAIL');
    if (!adminEmail) {
      return Response.json({ error: 'Admin email not configured' }, { status: 500 });
    }

    // Send email to admin
    await base44.integrations.Core.SendEmail({
      to: adminEmail,
      subject: 'New Contact Message',
      body: `New message received:\n\n${message}\n\nReply to: ${email || 'No email provided'}`
    });

    // Save to database
    await base44.asServiceRole.entities.ContactMessage.create({
      message,
      email: email || null
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
