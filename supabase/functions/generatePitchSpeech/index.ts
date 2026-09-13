import { VOICE_NAMES, validateVoiceLanguage } from '../_shared/voiceCatalog.js';
import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generatePitchSpeech');
import { createClient } from 'npm:@supabase/supabase-js@2';
import { serveWithCors } from './_legacy/cors.ts';
import { generateSpeech } from './_legacy/replicateAi.ts';

const ELEVENLABS_VOICES = new Set(VOICE_NAMES);

function plainText(value: unknown) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

serveWithCors(async (request) => {
  const body = await request.json();
  const projectId = String(body.project_id || '');
  const shareSlug = String(body.share_slug || '');
  const sectionId = String(body.section_id || '');
  const voice = body.voice || 'Rachel';
  if (body.voice && !ELEVENLABS_VOICES.has(body.voice)) return Response.json({ error: 'Unsupported voice' }, { status: 400 });
  if (!projectId || !sectionId) return Response.json({ error: 'Missing pitch section' }, { status: 400 });

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let projectQuery = service.from('pitch_project')
    .select('id,owner_id,working_title,final_title,tagline,creator_name,company_name,original_language,share_slug,is_published,share_access_type,archived')
    .eq('id', projectId);

  if (shareSlug) {
    projectQuery = projectQuery.eq('share_slug', shareSlug).eq('is_published', true).eq('share_access_type', 'link').eq('archived', false);
  } else {
    const authorization = request.headers.get('Authorization') || '';
    const scoped = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: authorization ? { Authorization: authorization } : {} },
      auth: { persistSession: false },
    });
    const { data: authData } = await scoped.auth.getUser();
    if (!authData.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    projectQuery = projectQuery.eq('owner_id', authData.user.id);
  }

  const { data: project, error: projectError } = await projectQuery.single();
  if (projectError || !project) return Response.json({ error: 'Pitch unavailable' }, { status: 404 });

  let sectionQuery = service.from('pitch_section')
    .select('id,section_type,title,subtitle,body,is_visible')
    .eq('id', sectionId)
    .eq('pitch_project_id', project.id);
  if (shareSlug) sectionQuery = sectionQuery.eq('is_visible', true);
  const { data: section, error: sectionError } = await sectionQuery.single();
  if (sectionError || !section) return Response.json({ error: 'Section unavailable' }, { status: 404 });

  const isCover = section.section_type === 'cover';
  const title = isCover && (!section.title || section.title === 'Cover')
    ? project.final_title || project.working_title
    : section.title;
  const subtitle = isCover ? section.subtitle || project.tagline : section.subtitle;
  const creator = isCover ? [project.creator_name, project.company_name].filter(Boolean).join(', ') : '';
  const text = [title, subtitle, section.body, creator].map(plainText).filter(Boolean).join('. ').slice(0, 5000);
  if (!text) return Response.json({ error: 'Nothing to read' }, { status: 400 });

  const languageCode = body.language_code || project.original_language || 'en';
  try { validateVoiceLanguage(languageCode); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
  const hash = await digest(`${section.id}|${voice}|${languageCode}|${text}`);
  const folder = `pitch-readers/elevenlabs-v3/${project.id}`;
  const fileName = `${hash}.mp3`;
  const objectPath = `${folder}/${fileName}`;
  const { data: existing, error: listError } = await service.storage.from('media').list(folder, { search: fileName, limit: 1 });
  if (listError) throw listError;
  if (!existing?.some((item) => item.name === fileName)) {
    const audio = await generateSpeech({ text, voice, languageCode });
    const { error: uploadError } = await service.storage.from('media').upload(objectPath, audio, {
      contentType: 'audio/mpeg',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError && !/already exists/i.test(uploadError.message)) throw uploadError;
  }

  const { data: publicUrl } = service.storage.from('media').getPublicUrl(objectPath);
  return Response.json({ url: publicUrl.publicUrl, voice, language_code: languageCode, cached: true });
});
