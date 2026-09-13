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
