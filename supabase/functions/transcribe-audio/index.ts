import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('transcribe-audio');
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';
import { transcribeAudio } from './_legacy/replicateAi.ts';
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';

serveWithCors(async (request) => {
  const billing = await createCreditBillingContext(request);
  const body = await request.json();
  const transcriptionQuote = await quoteAiService(
    billing.service, 'transcribe-audio', {},
    'openai/whisper', 'transcription',
  );
  const { result, charge } = await withCreditCharge({
    ...billing,
    toolId: 'voice',
    provider: 'replicate',
    relatedEntity: 'transcribe_audio',
    explicitCost: transcriptionQuote.credits,
  }, () => transcribeAudio(body.audio_url));
  return Response.json(result, {
    headers: {
      'X-AISTAGE-Credit-Cost': String(charge.cost),
      ...(charge.balanceAfter == null
        ? {}
        : { 'X-AISTAGE-Balance-After': String(charge.balanceAfter) }),
    },
  });
});
