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
