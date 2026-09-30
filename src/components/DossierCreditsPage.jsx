import React from 'react';

function clean(value = '') {
  return String(value || '').trim();
}

export default function DossierCreditsPage({ page, dossier }) {
  const manualSections = Array.isArray(page?.credits_sections) ? page.credits_sections : [];
  const placements = Array.isArray(dossier?.product_placements) ? dossier.product_placements : [];

  const sections = manualSections
    .filter((section) => clean(section?.title) || clean(section?.image_url) || (section?.entries || []).some((entry) => clean(entry?.name) || clean(entry?.role)))
    .map((section) => ({
      ...section,
      entries: (section.entries || []).filter((entry) => clean(entry?.name) || clean(entry?.role) || clean(entry?.note)),
    }));

  if (placements.length > 0) {
    sections.push({
      title: 'Product Placements',
      image_url: '',
      automatic: true,
      entries: [...placements]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((placement) => ({
          role: placement.brand_name || 'Product Placement',
          name: placement.name || placement.brand_name || 'Partner',
          note: placement.description || '',
          image_url: placement.image_url || '',
          url: placement.url || '',
        })),
    });
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-black text-white pointer-events-auto">
      <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-20 sm:px-8 md:px-10 md:pt-24 lg:px-14">
        <header className="mb-12 border-b border-white/15 pb-7 md:mb-16 md:pb-9">
          <p className="mb-3 text-[10px] uppercase tracking-[0.34em] text-white/35">
            {dossier?.title || 'Dossier'}
          </p>
          <h2 className="text-5xl font-extralight leading-none tracking-[-0.045em] md:text-7xl lg:text-8xl">
            {page?.title || 'Credits'}
          </h2>
          {page?.content && (
            <div
              className="mt-5 max-w-2xl text-sm font-light leading-relaxed text-white/55 md:text-base"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          )}
        </header>

        <div className="space-y-16 md:space-y-20">
          {sections.map((section, sectionIndex) => (
            <section key={`${section.title || 'section'}-${sectionIndex}`} className="grid gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div>
                {section.image_url ? (
                  <div className="aspect-[4/5] overflow-hidden bg-neutral-900">
                    <img src={section.image_url} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="hidden aspect-[4/5] border border-white/10 md:block" />
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/15 pb-4">
                  <div>
                    <span className="mb-2 block text-[10px] tracking-[0.2em] text-white/25">
                      {String(sectionIndex + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-2xl font-extralight tracking-[-0.02em] md:text-4xl">
                      {section.title || 'Credits'}
                    </h3>
                  </div>
                  {section.automatic && (
                    <span className="text-[9px] uppercase tracking-[0.22em] text-white/25">Automatic</span>
                  )}
                </div>

                <div className="divide-y divide-white/10">
                  {(section.entries || []).map((entry, entryIndex) => (
                    <div key={`${entry.name || entry.role || 'credit'}-${entryIndex}`} className="grid gap-1 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5 md:py-5">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                        {entry.role || ''}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          {entry.image_url && (
                            <img src={entry.image_url} alt="" className="h-12 w-12 flex-shrink-0 object-cover" />
                          )}
                          <div>
                            {entry.url ? (
                              <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-base font-light text-white underline-offset-4 hover:underline md:text-lg">
                                {entry.name || entry.role}
                              </a>
                            ) : (
                              <p className="text-base font-light text-white md:text-lg">{entry.name || entry.role}</p>
                            )}
                            {entry.note && <p className="mt-1 text-xs font-light leading-relaxed text-white/45 md:text-sm">{entry.note}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        {sections.length === 0 && (
          <div className="border-y border-white/15 py-12 text-center text-xs uppercase tracking-[0.22em] text-white/30">
            Credits coming soon
          </div>
        )}
      </div>
    </div>
  );
}
