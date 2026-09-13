import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('invoke-llm');
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';
import { generateText } from './_legacy/replicateAi.ts';

serveWithCors(async (request) => {
  const billing = await createCreditBillingContext(request);
  const body = await request.json();
  const { result } = await withCreditCharge({
    ...billing,
    toolId: 'ai_text',
    provider: 'replicate',
    relatedEntity: 'invoke_llm',
  }, () => generateText({
      prompt: body.prompt,
      instructions: body.instructions,
      imageUrls: body.file_urls || body.image_urls || [],
      schema: body.response_json_schema,
    }));
  return Response.json(result);
});
