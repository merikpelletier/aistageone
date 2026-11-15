import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('invoke-llm');
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';
import { generateText } from './_legacy/replicateAi.ts';
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';

serveWithCors(async (request) => {
  const billing = await createCreditBillingContext(request);
  const body = await request.json();
  // Only the Studio Assistant uses dynamic, model-specific pricing here.
  // Other invoke-llm consumers retain their existing billing behavior.
  let explicitCost: number | null = null;
  if (body.assistant_billing === true) {
    const instructions = String(body.instructions || '');
    const prompt = String(body.prompt || '');
    const quote = await quoteAiService(
      billing.service,
      'invoke-llm',
      { prompt: `${instructions}\n${prompt}`, max_tokens: 4000, max_output_tokens: 4000 },
      body.model_key || null,
      'text',
    );
    if (!Number.isSafeInteger(quote.credits) || quote.credits < 1) {
      throw new Error('Invalid dynamic credit quote; no model request sent.');
    }
    explicitCost = quote.credits;
  }
  const { result } = await withCreditCharge({
    ...billing,
    toolId: 'ai_text',
    provider: 'replicate',
    relatedEntity: 'invoke_llm',
    explicitCost,
  }, () => generateText({
      prompt: body.prompt,
      instructions: body.instructions,
      imageUrls: body.file_urls || body.image_urls || [],
      schema: body.response_json_schema,
      modelKey: body.model_key,
    }));
  return Response.json(result);
});
