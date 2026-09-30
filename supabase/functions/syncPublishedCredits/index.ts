import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

serveWithCors(async (request) => {
  const base44 = createClientFromRequest(request);
  const user = await base44.auth.me();
  const { project_id: projectId } = await request.json();
  if (!projectId) return Response.json({ error: 'Missing project_id' }, { status: 400 });

  const project = await base44.entities.AuthorStoryProject.get(projectId);
  if (!project || project.created_by_id !== user.id) return Response.json({ error: 'Author project not found' }, { status: 404 });
  if (!project.published_dossier_id) return Response.json({ success: true, synced: false });

  const service = base44.asServiceRole;
  const dossierId = project.published_dossier_id;
  const pages = await service.entities.DossierPage.filter({ dossier_id: dossierId }, 'order', 100);
  const creditsPage = pages.find((item: any) => item.page_type === 'credits');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false } },
  );
  const { data: placementData } = await supabase.rpc('refresh_dossier_product_placements', { p_dossier_id: dossierId });

  const existingSections = Array.isArray(creditsPage?.credits_sections) ? creditsPage.credits_sections : [];
  const existingEntryImage = (sectionTitle: string, sourceId: string | null, name: string) => {
    const section = existingSections.find((s: any) => String(s?.title || '').trim().toLowerCase() === sectionTitle.toLowerCase());
    const entry = (section?.entries || []).find((e: any) =>
      (sourceId && e?.source_asset_id === sourceId) ||
      (!sourceId && String(e?.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase())
    );
    return entry?.image_url || '';
  };

  const contributors = Array.isArray(project.contributors) ? project.contributors : [];
  const characters = Array.isArray(project.characters) ? project.characters : [];
  const locations = Array.isArray(project.locations) ? project.locations : [];
  const placements = Array.isArray(placementData) ? placementData : [];

  const autoSections = [
    {
      title: 'Production Credits', source: 'fotoplay', image_url: '',
      entries: [
        { role: 'Author', name: project.author_name || user.full_name || user.email, note: '' },
        ...contributors.filter((x:any)=>x && (x.name||x.role||x.user_email)).map((x:any)=>({
          role: x.role || 'Collaborator',
          name: x.name || x.user_email || 'Collaborator',
          note: x.user_email ? `AISTAGE.ONE member · ${x.user_email}` : '',
          image_url: existingEntryImage('Production Credits', null, x.name || x.user_email || 'Collaborator'),
        })),
      ],
    },
    ...(characters.length ? [{
      title: 'Characters', source: 'fotoplay', image_url: '',
      entries: characters.filter((x:any)=>x?.name).map((x:any)=>({
        role: 'Character', name: x.name, note: x.description || '',
        image_url: existingEntryImage('Characters', x.id || null, x.name) || x.image_url || '',
        source_asset_id: x.id || null,
      })),
    }] : []),
    ...(locations.length ? [{
      title: 'Sets / Locations', source: 'fotoplay', image_url: '',
      entries: locations.filter((x:any)=>x?.name).map((x:any)=>({
        role: 'Set / Location', name: x.name, note: x.description || '',
        image_url: existingEntryImage('Sets / Locations', x.id || null, x.name) || x.image_url || '',
        source_asset_id: x.id || null,
      })),
    }] : []),
    ...(placements.length ? [{
      title: 'Product Placements', source: 'product_placement_auto', image_url: '',
      entries: placements.filter((x:any)=>x && (x.name||x.brand_name)).map((x:any)=>({
        role: x.brand_name || 'Product Placement',
        name: x.name || x.brand_name || 'Product Placement',
        note: x.description || '',
        image_url: existingEntryImage('Product Placements', x.asset_id || null, x.name || x.brand_name || '') || x.image_url || '',
        url: x.url || '',
        source_asset_id: x.asset_id || null,
      })),
    }] : []),
  ];

  const generatedTitles = new Set(['production credits','characters','sets / locations','sets','locations','product placements']);
  const manualSections = existingSections.filter((section:any)=>{
    const title=String(section?.title||'').trim().toLowerCase();
    return !['fotoplay','product_placement_auto'].includes(section?.source) && !generatedTitles.has(title);
  });

  const payload = {
    dossier_id: dossierId,
    page_type: 'credits',
    order: creditsPage?.order ?? 1,
    title: creditsPage?.title || 'Credits',
    content: creditsPage?.content || '',
    credits_sections: [...autoSections, ...manualSections],
  };

  if (creditsPage) await service.entities.DossierPage.update(creditsPage.id, payload);
  else await service.entities.DossierPage.create(payload);

  return Response.json({ success: true, synced: true, dossier_id: dossierId });
});
