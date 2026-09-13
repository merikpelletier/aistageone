import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { block_id, segment_index, redo_note } = await req.json();
    if (!block_id || segment_index === undefined) {
      return Response.json({ error: 'block_id and segment_index required' }, { status: 400 });
    }

    const block = await base44.entities.StoryBlock.get(block_id);
    if (!block) return Response.json({ error: 'Block not found' }, { status: 404 });

    const session = await base44.entities.StorySession.get(block.session_id);
    if (!session || session.user_email !== user.email) {
      return Response.json({ error: 'Not your block' }, { status: 403 });
    }

    const segments = [...(block.segment_instructions || [])];
    const media = [...(block.video_segments || [])];

    if (segment_index < 0 || segment_index >= segments.length) {
      return Response.json({ error: 'Invalid segment index' }, { status: 400 });
    }

    // Clear the segment's media URL and prediction state
    // Use "" (empty string) — the schema requires video_segments items to be strings (null fails validation)
    while (media.length < segment_index) media.push('');
    media[segment_index] = '';

    segments[segment_index] = {
      ...segments[segment_index],
      prediction_id: null,
      prediction_created_at: null,
      video_stage: null,
      first_frame_url: null,
      last_error: null,
      redo_note: redo_note || null,
    };

    const updated = await base44.entities.StoryBlock.update(block_id, {
      video_segments: media,
      segment_instructions: segments,
      generation_status: 'generating',
      active_prediction_id: null,
      last_error: null,
    });

    return Response.json({ block: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});