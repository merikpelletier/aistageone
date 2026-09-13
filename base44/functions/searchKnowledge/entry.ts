import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { query = '', category = '' } = body;

    if (!query || query.trim().length < 2) {
      return Response.json({ entries: [], message: 'No query provided.' });
    }

    const q = query.toLowerCase().trim();

    // Fetch all active entries
    const allEntries = await base44.asServiceRole.entities.KnowledgeEntry.filter({ is_active: true });

    // Score entries by relevance
    const scored = allEntries
      .filter(entry => {
        if (category && entry.category !== category) return false;
        return true;
      })
      .map(entry => {
        const titleMatch = entry.title.toLowerCase().includes(q) ? 3 : 0;
        const descMatch = entry.description.toLowerCase().includes(q) ? 2 : 0;
        const tagMatch = (entry.tags || []).some(t => t.toLowerCase().includes(q)) ? 1 : 0;
        // Also check if any word in query matches
        const words = q.split(/\s+/);
        const wordScore = words.reduce((acc, w) => {
          if (w.length < 3) return acc;
          if (entry.title.toLowerCase().includes(w)) return acc + 1;
          if (entry.description.toLowerCase().includes(w)) return acc + 0.5;
          return acc;
        }, 0);
        return { entry, score: titleMatch + descMatch + tagMatch + wordScore };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ entry }) => ({
        category: entry.category,
        title: entry.title,
        description: entry.description,
        tags: entry.tags || []
      }));

    return Response.json({
      entries: scored,
      count: scored.length,
      query
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});