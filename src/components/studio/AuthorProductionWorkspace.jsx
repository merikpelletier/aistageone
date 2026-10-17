import React from 'react';
import AuthorProductionWorkspacePage from './AuthorProductionWorkspacePage';

export default function AuthorProductionWorkspace(props) {
  const active = props.project?.chapters?.find((chapter) => chapter.id === props.activeChapterId);
  const firstOpen = active?.segments?.findIndex((segment) => segment.status !== 'approved') ?? -1;
  const current = active?.segments?.[firstOpen < 0 ? Math.max(0, (active?.segments?.length || 1) - 1) : firstOpen];
  const desktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  if (!desktop || !current || current.visual_format !== 'comic') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#202328] p-8 text-white">
        <div className="max-w-xl border border-white/10 bg-[#111418] p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#23c7be]">FotoPlay</p>
          <p className="mt-3 text-lg font-black">Current FotoPlay only</p>
          <p className="mt-2 text-sm text-white/60">The legacy FotoPlay workspace is no longer available.</p>
        </div>
      </div>
    );
  }

  return <AuthorProductionWorkspacePage {...props} />;
}
