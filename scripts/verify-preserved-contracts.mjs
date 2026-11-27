import { readFileSync } from 'node:fs';

const homepagePath = new URL('../src/pages/Index.jsx', import.meta.url);
const homepage = readFileSync(homepagePath, 'utf8');

const requiredHomepageMarkers = [
  ['desktop 9:16 masonry', 'function DesktopMasonry'],
  ['9:16 media ratio', 'aspect-[9/16]'],
  ['real-content priority', 'data-real-tile'],
  ['administrable filler tiles', 'home-filler'],
  ['HomeFiller data source', 'HomeFiller'],
  ['mobile layout preservation', 'lg:hidden'],
  ['desktop-only masonry', 'hidden lg:block'],
];

const missing = requiredHomepageMarkers
  .filter(([, marker]) => !homepage.includes(marker))
  .map(([label]) => label);

if (missing.length > 0) {
  console.error('Build blocked: the validated AISTAGE.ONE homepage contract is missing:');
  for (const label of missing) console.error(`- ${label}`);
  console.error('Restore the validated homepage or document and approve a replacement before deploying.');
  process.exit(1);
}

console.log('Preserved-contract check passed: validated homepage is present.');

const marketing = readFileSync(new URL('../src/components/admin/AdminMarketing.jsx', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/pages/Admin.jsx', import.meta.url), 'utf8');
const marketingSchema = readFileSync(new URL('../supabase/migrations/20261127170122_admin_marketing_campaigns.sql', import.meta.url), 'utf8');
const marketingContracts = [
  [admin, "user?.role === 'admin'"],
  [admin, '<AdminMarketing />'],
  [marketing, "user?.role === 'admin'"],
  [marketing, "from('marketing_campaigns')"],
  [marketing, 'fetchTranslationDictionary'],
  [marketing, "ends_on>=form.starts_on"],
  [marketingSchema, 'enable row level security'],
  [marketingSchema, 'revoke all on public.marketing_campaigns from public, anon, authenticated'],
  [marketingSchema, 'using ((select public.is_admin()))'],
  [marketingSchema, 'with check ((select public.is_admin()))'],
];
for (const [source, marker] of marketingContracts) {
  if (!source.includes(marker)) throw new Error('Marketing contract missing: ' + marker);
}
console.log('Admin Marketing contract check passed.');

const marketingLibrary = readFileSync(new URL('../src/components/admin/AdminMarketingLibrary.jsx', import.meta.url), 'utf8');
const marketingLibrarySchema = readFileSync(new URL('../supabase/migrations/20261127173643_admin_marketing_library.sql', import.meta.url), 'utf8');
for (const [source, marker] of [
  [admin, 'section="speakers"'], [admin, 'section="media"'],
  [marketingLibrary, "user?.role==='admin'"],
  [marketingLibrary, "readRows('marketing_spokespersons')"],
  [marketingLibrary, "readRows('marketing_media')"],
  [marketingLibrary, "from('vault_asset')"],
  [marketingLibrary, "from('marketing-private').upload"],
  [marketingLibrary, 'fetchTranslationDictionary'],
  [marketingLibrarySchema, 'alter table public.marketing_spokespersons enable row level security'],
  [marketingLibrarySchema, 'alter table public.marketing_media enable row level security'],
  [marketingLibrarySchema, "bucket_id='marketing-private' and (select public.is_admin())"],
]) if (!source.includes(marker)) throw new Error('Marketing library contract missing: ' + marker);
console.log('Marketing library contract check passed.');

if (/file\.size\s*(?:[<>]=?)\s*\d/.test(marketingLibrary)) throw new Error('Marketing uploads must not have an artificial file size cap');
const marketingUnlimited = readFileSync(new URL('../supabase/migrations/20261127174034_remove_marketing_upload_size_limit.sql', import.meta.url), 'utf8');
if (!marketingUnlimited.includes("file_size_limit = null where id = 'marketing-private'")) throw new Error('Marketing bucket must inherit infrastructure limits');

const centralUpload = readFileSync(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
for (const [source, marker] of [
  [marketingLibrary, "if(form.media_type==='video')"],
  [marketingLibrary, 'base44.integrations.Core.UploadFile({file,saveToVault:true})'],
  [marketingLibrary, 'payload.vault_asset_id=asset.vault_asset_id'],
  [marketingLibrary, "url.origin+'/'+id+'/iframe'"],
  [centralUpload, 'uploadVideoToCloudflareStream(file, { dossierId })'],
]) if (!source.includes(marker)) throw new Error('Marketing Stream contract missing: ' + marker);
console.log('Marketing Stream routing contract check passed.');

for (const source of [marketing, marketingLibrary]) {
  for (const tag of source.matchAll(/<select\b[^>]*>/g)) {
    if (!tag[0].includes('colorScheme:"dark"')) throw new Error('Marketing select requires dark native menu contrast');
  }
  for (const tag of source.matchAll(/<option\b[^>]*>/g)) {
    if (!tag[0].includes('color:"#fff",backgroundColor:"#171717"')) throw new Error('Marketing option requires readable contrast');
  }
}

const analytics = readFileSync(new URL('../src/components/admin/AdminAnalytics.jsx', import.meta.url), 'utf8');
const analyticsSchema = readFileSync(new URL('../supabase/migrations/20261127175516_admin_analytics_snapshot.sql', import.meta.url), 'utf8');
for (const [source, marker] of [
  [analytics, "queryKey:['admin-analytics-snapshot',range]"],
  [analytics, "supabase.rpc('admin_analytics_snapshot',{p_range:range})"],
  [analytics, "Traffic data unavailable"],
  [analyticsSchema, "if not public.is_admin()"],
  [analyticsSchema, "revoke all on function public.admin_analytics_snapshot(text) from public,anon"],
  [analyticsSchema, "aistage_publication_date between s and e"],
]) if (!source.includes(marker)) throw new Error('Analytics contract missing: ' + marker);
console.log('Live Analytics contract check passed.');

const trafficSchema=readFileSync(new URL('../supabase/migrations/20261127175900_analytics_navigation_and_conversion.sql',import.meta.url),'utf8');
const navigationTracker=readFileSync(new URL('../src/lib/NavigationTracker.jsx',import.meta.url),'utf8');
const landing=readFileSync(new URL('../src/pages/PrelaunchLanding.jsx',import.meta.url),'utf8');
for(const [source,marker] of [
 [trafficSchema,'on conflict(id) do nothing'],
 [trafficSchema,'alter table public.analytics_navigation_event enable row level security'],
 [trafficSchema,'if not public.is_admin()'],
 [trafficSchema,'revoke all on public.analytics_navigation_event from public,anon,authenticated'],
 [navigationTracker,'navigator.globalPrivacyControl'],
 [navigationTracker,"recordNavigationEvent('page_view',location.pathname)"],
 [landing,"recordNavigationEvent('waitlist_success')"],
 [landing,"recordNavigationEvent('team_success')"],
 [analytics,"supabase.rpc('admin_traffic_snapshot',{p_range:range})"],
]) if(!source.includes(marker)) throw new Error('Traffic analytics contract missing: '+marker);
console.log('Traffic analytics contract check passed.');

const analyticsMenu = analytics.match(/<div className="([^"]+)" data-analytics-section-menu>/);
if (!analyticsMenu || !analyticsMenu[1].split(' ').includes('flex-wrap') || analyticsMenu[1].includes('overflow-x-auto')) throw new Error('Analytics tabs must wrap instead of clipping horizontally');
if (!analytics.includes("['ai','AI Usage']") || !analytics.includes("['commerce','Shop / 3D']")) throw new Error('Analytics final tabs must remain accessible');

const aiAnalyticsSchema=readFileSync(new URL('../supabase/migrations/20261127180952_analytics_ai_provider_observations.sql',import.meta.url),'utf8');
for(const [source,marker] of [[analytics,"supabase.rpc('admin_ai_analytics_snapshot',{p_range:range})"],[analytics,"ai?.recorded_cost_cad"],[analytics,"ai?.succeeded"],[aiAnalyticsSchema,"from public.ai_model_call"],[aiAnalyticsSchema,"select sum(cost_cad)"],[aiAnalyticsSchema,"if not public.is_admin()"]])if(!source.includes(marker))throw new Error('AI analytics source contract missing: '+marker);
console.log('AI analytics source contract check passed.');

const reconcileSource=readFileSync(new URL('../supabase/functions/analytics-replicate-reconcile/index.ts',import.meta.url),'utf8');
for(const [source,marker] of [[analytics,"supabase.functions.invoke('analytics-replicate-reconcile'"],[reconcileSource,"data.user?.app_metadata?.role!=='admin'"],[reconcileSource,"method:'GET'"],[reconcileSource,"analytics_ai_prediction_observation"],[reconcileSource,"analytics_pending_predictions"]])if(!source.includes(marker))throw new Error('AI reconciliation contract missing: '+marker);
