import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { kit_page_id, dossier_id, production_id } = await req.json();

    if (!production_id) {
      return Response.json({ error: 'Missing production_id' }, { status: 400 });
    }

    // Get the user's production
    const production = await base44.entities.TimelineStory.get(production_id);
    if (!production || production.user_email !== user.email) {
      return Response.json({ error: 'Production not found' }, { status: 404 });
    }

    const blocks = (production.blocks || []).filter(b => b.media_url).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (blocks.length === 0) {
      return Response.json({ error: 'No scenes with media to publish' }, { status: 400 });
    }

    // Use poster_image as cover, fallback to first block's media
    const coverImage = production.poster_image || blocks[0]?.media_url || null;

    const dossierData = {
      title: production.episode_title || 'My Episode',
      subtitle: production.episode_description || '',
      class: 'Story',
      category: production.category || '',
      status: 'published',
      order: Date.now(),
      author_name: production.author_name || user.full_name || user.email,
      cover_image: coverImage,
      has_portrait: true,
      has_landscape: false,
      submitted_by_email: user.email,
      submitted_by_name: user.full_name || user.email,
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    };

    // Check if a Dossier already exists for this production (via its block_player page)
    const existingPages = await base44.entities.DossierPage.filter({ block_player_episode_page_id: production_id });
    const existingPage = existingPages.find(p => p.page_type === 'block_player');

    let dossierId;

    if (existingPage) {
      // Update the existing Dossier in place — no duplicates
      await base44.entities.Dossier.update(existingPage.dossier_id, dossierData);
      // Update the existing DossierPage too
      await base44.entities.DossierPage.update(existingPage.id, {
        title: dossierData.title,
        content: production.episode_description || '',
        media_url: coverImage,
        block_player_episode_page_id: production_id,
      });
      dossierId = existingPage.dossier_id;
    } else {
      // First publish — create new Dossier + page
      const dossier = await base44.entities.Dossier.create(dossierData);
      await base44.entities.DossierPage.create({
        dossier_id: dossier.id,
        page_type: 'block_player',
        order: 0,
        title: dossierData.title,
        content: production.episode_description || '',
        media_url: coverImage,
        block_player_episode_page_id: production_id,
      });
      dossierId = dossier.id;
    }

    // Mark the TimelineStory as published
    await base44.entities.TimelineStory.update(production_id, { is_published: true });

    return Response.json({
      success: true,
      dossier_id: dossierId,
      message: 'Episode published successfully!'
    });
  } catch (error) {
    console.error('Error publishing episode:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});