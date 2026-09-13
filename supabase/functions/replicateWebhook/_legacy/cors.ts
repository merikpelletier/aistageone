export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function withCors(response: Response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function serveWithCors(handler: (request: Request) => Response | Promise<Response>) {
  return Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      return withCors(await handler(request));
    } catch (error) {
      console.error(error);
      return withCors(Response.json(
        { error: error instanceof Error ? error.message : 'Unexpected server error' },
        { status: 500 },
      ));
    }
  });
}

