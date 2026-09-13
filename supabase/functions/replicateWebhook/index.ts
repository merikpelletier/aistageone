import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('replicateWebhook');
import { createClientFromRequest } from './_legacy/base44Compat.ts';
import { serveWithCors } from './_legacy/cors.ts';

const MAX_SEGMENT_ATTEMPTS = 3;

serveWithCors(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.text();
    const data = JSON.parse(body);

    const predictionId = data.id;
    const status = data.status;
    const output = data.output;
    const error = data.error || '';

    console.log(`[replicateWebhook] Received: prediction=${predictionId} status=${status}`);

    if (!predictionId) {
      return Response.json({ error: 'No prediction ID' }, { status: 400 });
    }

    // Find the block by active_prediction_id
    const blocks = await base44.asServiceRole.entities.StoryBlock.filter({
      active_prediction_id: predictionId
    });

    if (!blocks || blocks.length === 0) {
      console.log(`[replicateWebhook] No block found for prediction ${predictionId}`);
      return Response.json({ received: true, message: 'No matching block' });
    }

    const block = blocks[0];
    const segments = block.segment_instructions || [];
    const existingMedia = block.video_segments || [];

    // Find the segment index with this prediction_id
    const segIndex = segments.findIndex(s => s.prediction_id === predictionId);
    if (segIndex === -1) {
      console.log(`[replicateWebhook] Prediction ${predictionId} not found in segments`);
      await base44.asServiceRole.entities.StoryBlock.update(block.id, {
        active_prediction_id: null
      });
      return Response.json({ received: true });
    }

    const segment = segments[segIndex];
    const mediaType = segment.media_type || 'image';

    // ── Handle failure ──
    if (status === 'failed' || status === 'canceled') {
      console.log(`[replicateWebhook] Prediction ${predictionId} failed: ${error}`);
      const attempts = Number(segment.generation_attempts || 0) + 1;
      const terminal = attempts >= MAX_SEGMENT_ATTEMPTS;
      const updatedSegments = [...segments];
      updatedSegments[segIndex] = {
        ...segment,
        prediction_id: null,
        prediction_created_at: null,
        generation_attempts: attempts,
        last_error: error || `Generation ${status}`,
      };
      await base44.asServiceRole.entities.StoryBlock.update(block.id, {
        segment_instructions: updatedSegments,
        active_prediction_id: null,
        last_error: error || `Generation ${status}`,
        generation_status: terminal ? 'failed' : 'generating'
      });
      return Response.json({ received: true, status: terminal ? 'failed' : 'retry', attempt: attempts });
    }

    // ── Handle success ──
    if (status !== 'succeeded') {
      return Response.json({ received: true, status });
    }

    // Extract media URL (works for both images and videos)
    let mediaUrl;
    if (typeof output === 'string') mediaUrl = output;
    else if (Array.isArray(output)) mediaUrl = output[0];
    else if (output?.url) mediaUrl = output.url;
    else if (output?.image) mediaUrl = output.image;
    else if (output?.video) mediaUrl = output.video;

    if (!mediaUrl) {
      console.error(`[replicateWebhook] No media URL in output for ${predictionId}`);
      const attempts = Number(segment.generation_attempts || 0) + 1;
      const terminal = attempts >= MAX_SEGMENT_ATTEMPTS;
      const updatedSegments = [...segments];
      updatedSegments[segIndex] = {
        ...segment,
        prediction_id: null,
        prediction_created_at: null,
        generation_attempts: attempts,
        last_error: 'No media URL in Replicate output',
      };
      await base44.asServiceRole.entities.StoryBlock.update(block.id, {
        segment_instructions: updatedSegments,
        active_prediction_id: null,
        last_error: 'No media URL in Replicate output',
        generation_status: terminal ? 'failed' : 'generating',
      });
      return Response.json({ received: true, error: 'No media URL' });
    }

    // Download the media from Replicate
    const ext = mediaType === 'video' ? 'mp4' : 'jpg';
    const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) {
      throw new Error(`Failed to fetch media: ${mediaRes.status}`);
    }
    const blob = await mediaRes.blob();
    const file = new File([blob], `segment_${segIndex}.${ext}`, { type: contentType });
    const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    // Update the block
    const updatedMedia = [...existingMedia];
    while (updatedMedia.length < segIndex) updatedMedia.push(null);
    updatedMedia[segIndex] = uploaded.file_url;

    const updatedSegments = [...segments];
    updatedSegments[segIndex] = {
      ...segment,
      prediction_id: null,
      prediction_created_at: null,
      generation_attempts: 0,
      last_error: null,
    };

    const allDone = updatedMedia.filter(Boolean).length >= segments.length;

    await base44.asServiceRole.entities.StoryBlock.update(block.id, {
      video_segments: updatedMedia,
      segment_instructions: updatedSegments,
      active_prediction_id: null,
      last_error: null,
      generation_status: allDone ? 'completed' : 'generating'
    });

    console.log(`[replicateWebhook] Block ${block.id} segment ${segIndex + 1}/${segments.length} (${mediaType}) done. All done: ${allDone}`);
    return Response.json({ received: true, status: 'succeeded', all_done: allDone });

  } catch (error) {
    console.error('[replicateWebhook] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
