import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { GripHorizontal, Search } from 'lucide-react';

const CLASS_ORDER = ['Videos', 'Story', 'Assets', 'Kits', 'Merchandise'];
const SHEET_SNAPS = [28, 60, 100];

function localDayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededValue(seed, id) {
  let x = hashString(`${seed}:${id}`) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function dailyShuffle(items, seed) {
  return [...items].sort((a, b) => seededValue(seed, a.id) - seededValue(seed, b.id));
}

function dossierDateValue(dossier) {
  const value = dossier.approved_at || dossier.submitted_at || dossier.updated_date || dossier.created_date || 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isMemberDossier(dossier) {
  return Boolean(dossier.ai_member_id || String(dossier.submitted_by_email || '').trim());
}

function buildDailyMasonry(dossiers, dayKey) {
  if (dossiers.length <= 2) return [...dossiers];

  const total = dossiers.length;
  const newCount = Math.min(total, Math.max(1, Math.round(total * 0.4)));
  const houseTarget = Math.min(total - newCount, Math.max(0, Math.round(total * 0.2)));
  const memberTarget = Math.max(0, total - newCount - houseTarget);

  const newest = [...dossiers]
    .sort((a, b) => dossierDateValue(b) - dossierDateValue(a))
    .slice(0, newCount);
  const used = new Set(newest.map(d => d.id));

  const remaining = dossiers.filter(d => !used.has(d.id));
  const house = dailyShuffle(remaining.filter(d => !isMemberDossier(d)), `${dayKey}:mobile-house`).slice(0, houseTarget);
  house.forEach(d => used.add(d.id));

  const member = dailyShuffle(dossiers.filter(d => !used.has(d.id) && isMemberDossier(d)), `${dayKey}:mobile-member`).slice(0, memberTarget);
  member.forEach(d => used.add(d.id));

  const fill = dailyShuffle(dossiers.filter(d => !used.has(d.id)), `${dayKey}:mobile-fill`);
  return [...dailyShuffle(newest, `${dayKey}:mobile-new`), ...house, ...member, ...fill];
}

function buildPopularityMap(ratings) {
  const buckets = new Map();
  ratings.forEach((entry) => {
    if (!entry?.dossier_id || !Number.isFinite(Number(entry.rating))) return;
    const current = buckets.get(entry.dossier_id) || { total: 0, count: 0 };
    current.total += Number(entry.rating);
    current.count += 1;
    buckets.set(entry.dossier_id, current);
  });

  const scores = new Map();
  buckets.forEach((value, id) => {
    const average = value.count ? value.total / value.count : 0;
    scores.set(id, average * 1000 + Math.min(value.count, 999));
  });
  return scores;
}

function languageLabel(dossier) {
  const language = dossier.default_language || dossier.original_language;
  if (!language) return null;
  return ({ en: 'EN', fr: 'FR', es: 'ES', English: 'EN', French: 'FR', Français: 'FR', Spanish: 'ES', Español: 'ES' })[language] || String(language).toUpperCase();
}

function MobileMasonryCard({ dossier, featured = false }) {
  const image = dossier.cover_image || dossier.cover_template_image || dossier.cover_image_landscape;
  const language = languageLabel(dossier);

  return (
    <Link
      to={`${createPageUrl('Magazine')}?dossier=${dossier.id}`}
      className={`relative block overflow-hidden border border-white/10 bg-neutral-950 ${featured ? 'col-span-2 aspect-[16/10]' : 'aspect-[9/16]'}`}
    >
      {image ? (
        <>
          <img src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl" />
          <img src={image} alt={dossier.title} className="relative h-full w-full object-cover" />
        </>
      ) : (
        <div className="flex h-full items-center justify-center p-4 text-center text-sm font-bold text-white/60">{dossier.title}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/20" />
      {(dossier.content_rating || language) && (
        <div className="absolute right-2 top-2 flex gap-1">
          {dossier.content_rating && <span className="border border-white/80 bg-black/80 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">{dossier.content_rating === 'all' ? 'ALL' : dossier.content_rating}</span>}
          {language && <span className="border border-white/80 bg-black/80 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">{language}</span>}
        </div>
      )}
      {!dossier.hide_text_on_cover && (
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="line-clamp-2 text-sm font-black leading-tight text-white">{dossier.title}</p>
          {(featured && dossier.subtitle) && <p className="mt-1 line-clamp-1 text-[10px] text-white/60">{dossier.subtitle}</p>}
        </div>
      )}
    </Link>
  );
}

function CompactCard({ dossier }) {
  const image = dossier.cover_image || dossier.cover_template_image || dossier.cover_image_landscape;
  return (
    <Link to={`${createPageUrl('Magazine')}?dossier=${dossier.id}`} className="w-[92px] flex-none">
      <div className="aspect-[9/16] overflow-hidden border border-white/10 bg-neutral-900">
        {image ? <img src={image} alt={dossier.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-2 text-center text-[9px] font-bold text-white/55">{dossier.title}</div>}
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-tight text-white/75">{dossier.title}</p>
    </Link>
  );
}

function GalleryRow({ title, dossiers }) {
  if (!dossiers.length) return null;
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-[0.12em] text-white">{title}</h3>
        <span className="text-[9px] font-bold text-white/35">{dossiers.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dossiers.map(dossier => <CompactCard key={dossier.id} dossier={dossier} />)}
      </div>
    </section>
  );
}

export default function TopBanner({ dossiers }) {
  const [sheetHeight, setSheetHeight] = useState(() => {
    const saved = Number(window.localStorage.getItem('aistage:mobile-browser-height'));
    return SHEET_SNAPS.includes(saved) ? saved : 28;
  });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('All');
  const draggingRef = useRef(false);
  const dayKey = localDayKey();

  const { data: ratings = [] } = useQuery({
    queryKey: ['dossierRatings', 'indexPopularity'],
    queryFn: async () => { try { return await base44.entities.DossierRating.listAll(); } catch { return []; } },
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    window.localStorage.setItem('aistage:mobile-browser-height', String(sheetHeight));
  }, [sheetHeight]);

  useEffect(() => {
    const onMove = (event) => {
      if (!draggingRef.current) return;
      const height = ((window.innerHeight - event.clientY) / window.innerHeight) * 100;
      setSheetHeight(Math.min(100, Math.max(18, height)));
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';
      const nearest = SHEET_SNAPS.reduce((best, snap) => Math.abs(snap - sheetHeight) < Math.abs(best - sheetHeight) ? snap : best, SHEET_SNAPS[0]);
      setSheetHeight(nearest);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [sheetHeight]);

  const popularityMap = useMemo(() => buildPopularityMap(ratings), [ratings]);
  const masonry = useMemo(() => buildDailyMasonry(dossiers, dayKey), [dossiers, dayKey]);

  const selectorOptions = useMemo(() => {
    const classes = CLASS_ORDER.filter(label => dossiers.some(d => d.class === label));
    const categories = [...new Set(dossiers.map(d => d.category).filter(Boolean))];
    return ['All', ...classes, ...categories.filter(name => !classes.includes(name))];
  }, [dossiers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dossiers.filter((dossier) => {
      const selectorMatch = selected === 'All' || dossier.class === selected || dossier.category === selected;
      if (!selectorMatch) return false;
      if (!q) return true;
      return [dossier.title, dossier.subtitle, dossier.category, dossier.class, dossier.author_name, dossier.submitted_by_name]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    });
  }, [dossiers, query, selected]);

  const rankRow = (items, seed) => {
    const sorted = [...items].sort((a, b) => (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0));
    const featured = sorted.slice(0, 4);
    const featuredIds = new Set(featured.map(d => d.id));
    const rest = dailyShuffle(items.filter(d => !featuredIds.has(d.id)), `${dayKey}:mobile-row:${seed}`);
    return [...featured, ...rest];
  };

  const rows = useMemo(() => {
    if (query.trim()) return [{ title: 'Search results', dossiers: rankRow(visible, 'search') }];
    if (selected !== 'All') return [{ title: selected, dossiers: rankRow(visible, selected) }];

    const result = [];
    CLASS_ORDER.forEach((label) => {
      const items = visible.filter(d => d.class === label);
      if (items.length) result.push({ title: label, dossiers: rankRow(items, `class:${label}`) });
    });
    [...new Set(visible.map(d => d.category).filter(Boolean))].forEach((category) => {
      const items = visible.filter(d => d.category === category);
      if (items.length) result.push({ title: category, dossiers: rankRow(items, `category:${category}`) });
    });
    return result;
  }, [visible, selected, query, popularityMap, dayKey]);

  const startDrag = (event) => {
    event.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
  };

  const cycleSheet = () => {
    const currentIndex = SHEET_SNAPS.findIndex(snap => snap === Math.round(sheetHeight));
    setSheetHeight(SHEET_SNAPS[(currentIndex + 1) % SHEET_SNAPS.length]);
  };

  return (
    <div className="mobile-stage-index relative bg-black pb-[32vh]">
      <style>{`@media (max-width: 1023px) { .mobile-stage-index + div { display: none !important; } }`}</style>

      <section className="grid grid-cols-2 gap-2 p-2">
        {masonry.map((dossier, index) => (
          <MobileMasonryCard key={dossier.id} dossier={dossier} featured={index % 9 === 0} />
        ))}
      </section>

      <aside
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-white/15 bg-black/97 shadow-[0_-22px_60px_rgba(0,0,0,.7)] backdrop-blur-xl transition-[height] duration-200 ease-out lg:hidden"
        style={{ height: `${sheetHeight}dvh` }}
      >
        <button
          type="button"
          onPointerDown={startDrag}
          onDoubleClick={cycleSheet}
          aria-label="Drag classical browser up or down"
          className="flex h-8 flex-none touch-none items-center justify-center border-b border-white/10 text-white/55 active:text-white"
        >
          <GripHorizontal size={28} />
        </button>

        <div className="flex-none border-b border-white/10 px-3 pb-3 pt-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Browse</p>
              <h2 className="text-base font-black text-white">Content Library</h2>
            </div>
            <div className="flex gap-1">
              {SHEET_SNAPS.map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSheetHeight(value)}
                  className={`border px-2 py-1 text-[9px] font-black ${Math.round(sheetHeight) === value ? 'border-white bg-white text-black' : 'border-white/15 text-white/50'}`}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search content..."
              className="w-full border border-white/15 bg-white/[0.04] py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-white/40"
            />
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {selectorOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setSelected(option)}
                className={`whitespace-nowrap border px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] ${selected === option ? 'border-white bg-white text-black' : 'border-white/15 text-white/50'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 overscroll-contain">
          {rows.length ? rows.map(row => <GalleryRow key={row.title} title={row.title} dossiers={row.dossiers} />) : <div className="flex min-h-[180px] items-center justify-center text-xs text-white/35">No content found.</div>}
        </div>
      </aside>
    </div>
  );
}
