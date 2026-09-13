import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { memberEmail } = await req.json();
    if (!memberEmail) return Response.json({ error: 'Missing memberEmail' }, { status: 400 });

    // 1. Get member's dossiers
    let dossiers = await base44.asServiceRole.entities.Dossier.filter(
      { status: 'published', submitted_by_email: memberEmail }, 'order'
    );
    if (dossiers.length === 0) {
      const all = await base44.asServiceRole.entities.Dossier.filter({ status: 'published' }, 'order');
      dossiers = all.filter(d => d.created_by === memberEmail);
    }
    const dossierMap = {};
    for (const d of dossiers) dossierMap[d.id] = d.title;

    // 2. Get comments on member's dossiers (received)
    const receivedDossierComments = [];
    for (const d of dossiers) {
      try {
        const comments = await base44.asServiceRole.entities.DossierComment.filter({ dossier_id: d.id });
        for (const c of comments) {
          if (c.user_email !== memberEmail) {
            receivedDossierComments.push({
              ...c,
              source_type: 'dossier',
              source_title: d.title,
              source_id: d.id,
              date: c.created_date,
            });
          }
        }
      } catch {}
    }

    // 3. Get comments sent by the member on dossiers
    const sentDossierComments = await base44.asServiceRole.entities.DossierComment.filter({ user_email: memberEmail });
    const sentDossierFormatted = sentDossierComments.map(c => {
      let sourceTitle = dossierMap[c.dossier_id];
      if (!sourceTitle) {
        // Try to fetch the dossier title
        // We can't do async in map, so we'll handle it below
      }
      return {
        ...c,
        source_type: 'dossier',
        source_title: sourceTitle || 'Dossier',
        source_id: c.dossier_id,
        date: c.created_date,
      };
    });

    // For sent comments on dossiers we don't own, fetch titles
    for (const c of sentDossierFormatted) {
      if (c.source_title === 'Dossier') {
        try {
          const d = await base44.asServiceRole.entities.Dossier.get(c.dossier_id);
          if (d) c.source_title = d.title;
        } catch {}
      }
    }

    // 4. Get member's posts
    const memberPosts = await base44.asServiceRole.entities.MemberPost.filter({ member_email: memberEmail });
    const postMap = {};
    for (const p of memberPosts) postMap[p.id] = p.title;

    // 5. Get comments on member's posts (received)
    const receivedPostComments = [];
    for (const p of memberPosts) {
      try {
        const comments = await base44.asServiceRole.entities.PostComment.filter({ post_id: p.id });
        for (const c of comments) {
          if (c.author_email !== memberEmail) {
            receivedPostComments.push({
              ...c,
              source_type: 'post',
              source_title: p.title,
              source_id: p.id,
              date: c.created_date,
            });
          }
        }
      } catch {}
    }

    // 6. Get comments sent by the member on posts
    const sentPostComments = await base44.asServiceRole.entities.PostComment.filter({ author_email: memberEmail });
    const sentPostFormatted = sentPostComments.map(c => ({
      ...c,
      source_type: 'post',
      source_title: postMap[c.post_id] || 'Post',
      source_id: c.post_id,
      date: c.created_date,
    }));

    // For sent comments on posts we don't own, fetch titles
    for (const c of sentPostFormatted) {
      if (c.source_title === 'Post') {
        try {
          const p = await base44.asServiceRole.entities.MemberPost.get(c.post_id);
          if (p) c.source_title = p.title;
        } catch {}
      }
    }

    // Merge and sort
    const received = [...receivedDossierComments, ...receivedPostComments]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const sent = [...sentDossierFormatted, ...sentPostFormatted]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return Response.json({
      received,
      sent,
      unreadCount: received.filter(c => !c.read && c.status !== 'read').length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});