import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (request) => {
  const base44 = createClientFromRequest(request);
  const user = await base44.auth.me();
  const {
    project_id: projectId, chapter_ids: chapterIds, title: publicTitle,
    description: publicDescription, author_name: publicAuthor, dossier_class: dossierClass,
    category: publicCategory, cover_image: publicCover, content_rating: contentRating,
    original_language: originalLanguage, public_promo_confirmed: publicPromoConfirmed,
  } = await request.json();
  if (!projectId) return Response.json({ error: 'Missing project_id' }, { status: 400 });
  if (!['all', '13+', '18+'].includes(contentRating)) return Response.json({ error: 'Choose a valid content rating' }, { status: 400 });
  if (!originalLanguage || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(originalLanguage)) return Response.json({ error: 'Choose the original language' }, { status: 400 });
  if (publicPromoConfirmed !== true) return Response.json({ error: 'Public Magazine publication must be confirmed' }, { status: 400 });

  const project = await base44.entities.AuthorStoryProject.get(projectId);
  if (!project || project.created_by_id !== user.id) return Response.json({ error: 'Author project not found' }, { status: 404 });
  const selectedChapterIds = new Set(Array.isArray(chapterIds) ? chapterIds : []);
  const chapters = (project.chapters || []).filter((chapter: any) => selectedChapterIds.has(chapter.id) && chapter.segments?.length === 9 && chapter.segments.every((segment: any) => segment.status === 'approved' && segment.image_url && segment.narration_url));
  if (!chapters.length) return Response.json({ error: 'Complete and approve all 9 segments of at least one chapter first' }, { status: 400 });
  if (!publicTitle?.trim()) return Response.json({ error: 'Add the public title' }, { status: 400 });
  if (!publicAuthor?.trim()) return Response.json({ error: 'Add the public author name' }, { status: 400 });
  if (!['Story', 'Videos', 'Assets', 'Kits', 'Merchandise'].includes(dossierClass)) return Response.json({ error: 'Choose a valid publication class' }, { status: 400 });

  const blocks = chapters.flatMap((chapter: any) => chapter.segments.map((segment: any) => ({
    id: `${chapter.id}-${segment.id}`,
    order: (chapter.number - 1) * 9 + segment.number,
    title: `Chapter ${chapter.number} · Segment ${segment.number}`,
    description: segment.narration_text || segment.summary || '',
    media_url: segment.image_url,
    media_type: 'image',
    narration_audio: segment.narration_url,
    image_aspect_ratio: chapter.image_aspect_ratio || '16:9',
  })));
  const service = base44.asServiceRole;
  const now = new Date().toISOString();
  const dossierData = {
    title: publicTitle.trim(),
    subtitle: publicDescription?.trim() || project.story_description || '',
    description: publicDescription?.trim() || project.story_description || '',
    class: dossierClass, category: publicCategory?.trim() || project.genre || 'Story', status: 'published', order: Date.now(),
    author_name: publicAuthor.trim(),
    cover_image: publicCover || project.cover_image || blocks[0]?.media_url || '',
    has_portrait: true, has_landscape: false,
    submitted_by_email: user.email, submitted_by_name: user.full_name || user.email,
    submitted_at: now, approved_at: now,
    content_rating: contentRating, rating_reasons: [], access_model: 'free',
    public_promo_confirmed: true, public_promo_confirmed_by: user.id,
    original_language: originalLanguage, audio_languages: [originalLanguage],
    subtitle_languages: [], default_language: originalLanguage,
  };

  let existingDossier = null;
  if (project.published_dossier_id) {
    existingDossier = await service.entities.Dossier.get(project.published_dossier_id).catch(() => null);
  }
  const republished = Boolean(existingDossier);
  let dossier;
  if (existingDossier) dossier = await service.entities.Dossier.update(existingDossier.id, dossierData);
  else dossier = await service.entities.Dossier.create(dossierData);

  const existingStories = await service.entities.TimelineStory.filter({ dossier_id: dossier.id }, '-updated_date', 1);
  const storyData = {
    dossier_id: dossier.id, user_email: user.email, production_name: dossierData.title,
    episode_title: dossierData.title, episode_description: dossierData.description,
    poster_image: dossierData.cover_image, series_description: dossierData.description,
    author_name: dossierData.author_name, publication_date: now.slice(0, 10), category: project.genre || 'Story',
    blocks, is_published: true,
  };
  const story = existingStories[0]
    ? await service.entities.TimelineStory.update(existingStories[0].id, storyData)
    : await service.entities.TimelineStory.create(storyData);

  const existingPages = await service.entities.DossierPage.filter({ dossier_id: dossier.id }, 'order', 20);
  const pageData = { dossier_id: dossier.id, page_type: 'block_player', order: 0, title: dossierData.title, content: dossierData.description, media_url: dossierData.cover_image, block_player_episode_page_id: story.id, block_player_block_ids: [] };
  const page = existingPages.find((item: any) => item.page_type === 'block_player');
  if (page) await service.entities.DossierPage.update(page.id, pageData);
  else await service.entities.DossierPage.create(pageData);

  await service.entities.AuthorStoryProject.update(project.id, { status: 'published', published_dossier_id: dossier.id });
  return Response.json({ success: true, dossier_id: dossier.id, story_id: story.id, chapter_count: chapters.length, segment_count: blocks.length, republished });
});
