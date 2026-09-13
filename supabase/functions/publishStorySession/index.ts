import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      session_id,
      block_ids,
      title: customTitle,
      description: customDesc,
      category: customCategory,
      author_name: customAuthor,
      cover_image: customCover,
      dossier_class: customClass,
      content_rating: contentRating,
      original_language: originalLanguage,
      public_promo_confirmed: publicPromoConfirmed,
    } = await req.json();
    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }
    if (!['all', '13+', '18+'].includes(contentRating)) {
      return Response.json({ error: 'Choose a valid content rating' }, { status: 400 });
    }
    if (!originalLanguage || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(originalLanguage)) {
      return Response.json({ error: 'Choose the story language' }, { status: 400 });
    }
    if (publicPromoConfirmed !== true) {
      return Response.json({ error: 'Public Magazine publication must be confirmed' }, { status: 400 });
    }

    // Get the session and verify ownership
    const session = await base44.entities.StorySession.get(session_id);
    if (!session || session.user_email !== user.email) {
      return Response.json({ error: 'Story session not found' }, { status: 404 });
    }

    // Ownership is verified above. The remaining publication writes are a single
    // trusted server workflow and must not depend on client-side RLS permissions.
    const service = base44.asServiceRole;

    // Collect all StoryBlocks for this session, sorted by order
    const allBlocks = await service.entities.StoryBlock.filter({ session_id }, 'order', 200);

    // Filter to the requested chapter set. No block_ids (or all) => full story compilation.
    let blocks = allBlocks;
    if (Array.isArray(block_ids) && block_ids.length > 0) {
      const idSet = new Set(block_ids);
      blocks = allBlocks.filter(b => idSet.has(b.id));
    }

    // Flatten video segments across selected blocks into a single playable sequence
    const playableSegments = [];
    for (const block of blocks) {
      const segs = block.video_segments || [];
      const instructions = block.segment_instructions || [];
      for (let i = 0; i < segs.length; i++) {
        if (segs[i]) {
          playableSegments.push({
            url: segs[i],
            media_type: instructions[i]?.media_type || 'video',
            title: instructions[i]?.story_action || block.block_title || `Scene ${playableSegments.length + 1}`,
            description: instructions[i]?.narration_text || block.narrative_summary || '',
            narration: (block.narration_audio_urls || [])[i] || '',
            block_order: block.order,
            seg_index: i,
          });
        }
      }
    }

    if (playableSegments.length === 0) {
      return Response.json({ error: 'No video segments to publish. Produce your chapters first.' }, { status: 400 });
    }

    // Block IDs to record on the DossierPage for playback filtering.
    // Empty array = play all chapters (full story). Otherwise the explicit list.
    const isFullStory = blocks.length === allBlocks.length && allBlocks.length > 0;
    const storedBlockIds = isFullStory ? [] : blocks.map(b => b.id);

    // Get theme + hero character for metadata (fallbacks)
    // Only use a VIDEO segment for cover_video — using an image URL breaks the <video> tag
    const firstVideoSeg = playableSegments.find(s => s.media_type === 'video');
    const coverVideo = firstVideoSeg ? firstVideoSeg.url : '';
    let title = 'My Story';
    let subtitle = '';
    let category = '';
    let coverImage = '';
    let coverTemplateImage = '';
    try {
      const theme = await service.entities.StoryTheme.get(session.theme_id);
      if (theme) {
        title = theme.title || title;
        category = theme.type || '';
        subtitle = theme.description || '';
        coverImage = theme.cover_image || '';
        coverTemplateImage = theme.cover_template_image || '';
      }
    } catch {}
    try {
      const hero = await service.entities.StoryCharacter.get(session.hero_story_character_id);
      if (hero?.name) {
        title = `${hero.name}'s Story`;
        if (hero.photos?.[0]) coverImage = hero.photos[0];
      }
    } catch {}
    if (blocks[0]?.narrative_summary) {
      subtitle = blocks[0].narrative_summary.slice(0, 200);
    }

    // Override with user-provided values from the publish modal
    if (customTitle) title = customTitle;
    if (customDesc) subtitle = customDesc;
    if (customCategory) category = customCategory;
    if (customCover) coverImage = customCover;

    const dossierData = {
      title,
      subtitle,
      class: customClass || 'Story',
      category,
      status: 'published',
      order: Date.now(),
      author_name: customAuthor || user.full_name || user.email,
      cover_image: coverImage,
      cover_template_image: coverTemplateImage,
      cover_video: coverVideo,
      has_portrait: true,
      has_landscape: false,
      submitted_by_email: user.email,
      submitted_by_name: user.full_name || user.email,
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      content_rating: contentRating,
      rating_reasons: [],
      public_promo_confirmed: true,
      public_promo_confirmed_by: user.id,
      access_model: 'free',
      original_language: originalLanguage,
      audio_languages: [originalLanguage],
      subtitle_languages: [],
      default_language: originalLanguage,
    };

    // Find an existing DossierPage for this session with the SAME chapter set
    // (so a single chapter and the full story each get their own dossier).
    const existingPages = await service.entities.DossierPage.filter({ block_player_episode_page_id: session_id });
    const sameChapterSet = (page) => {
      const have = ((page?.block_player_block_ids) || []).slice().sort();
      const want = storedBlockIds.slice().sort();
      if (have.length !== want.length) return false;
      return have.every((v, i) => v === want[i]);
    };
    const existingPage = existingPages.find(p => p.page_type === 'block_player' && sameChapterSet(p));

    let dossierId;

    if (existingPage) {
      // Update existing Dossier + page (re-publish)
      await service.entities.Dossier.update(existingPage.dossier_id, dossierData);
      await service.entities.DossierPage.update(existingPage.id, {
        title: dossierData.title,
        content: dossierData.subtitle,
        media_url: coverImage,
        block_player_episode_page_id: session_id,
        block_player_block_ids: storedBlockIds,
      });
      dossierId = existingPage.dossier_id;
    } else {
      // First publish of this chapter set — create new Dossier + page
      const dossier = await service.entities.Dossier.create(dossierData);
      await service.entities.DossierPage.create({
        dossier_id: dossier.id,
        page_type: 'block_player',
        order: 0,
        title: dossierData.title,
        content: dossierData.subtitle,
        media_url: coverImage,
        block_player_episode_page_id: session_id,
        block_player_block_ids: storedBlockIds,
      });
      dossierId = dossier.id;
    }

    // Mark the session as published
    await service.entities.StorySession.update(session_id, {
      is_published: true,
      published_dossier_id: dossierId,
    });

    return Response.json({
      success: true,
      dossier_id: dossierId,
      scene_count: playableSegments.length,
      chapter_count: blocks.length,
      is_full_story: isFullStory,
      message: 'Story published successfully!',
    });
  } catch (error) {
    console.error('Error publishing story session:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
