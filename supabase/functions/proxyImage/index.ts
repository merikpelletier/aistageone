import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async () => {
  return Response.json({ error: 'Legacy media proxy disabled' }, { status: 410 });
});
