import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft } from 'lucide-react';

export default function Content() {
  const [searchParams] = useSearchParams();
  const contentKey = searchParams.get('key');
  
  const { data: contentList, isLoading } = useQuery({
    queryKey: ['content', contentKey],
    queryFn: () => base44.entities.EditableContent.list(),
    enabled: !!contentKey
  });

  const content = contentList?.find(c => c.key === contentKey);

  if (!contentKey || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-black pb-20 pt-8 px-6">
        <Link to={createPageUrl('Plus')} className="inline-flex items-center gap-2 text-white hover:text-white mb-8">
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </Link>
        <p className="text-white text-center mt-20">Content not available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 pt-8 px-6">
      <Link to={createPageUrl('Plus')} className="inline-flex items-center gap-2 text-white hover:text-white mb-8">
        <ArrowLeft size={18} />
        <span className="text-sm">Back</span>
      </Link>

      <h1 className="text-white text-3xl font-extralight mb-4">{content?.title || 'Untitled'}</h1>
      <div className="w-12 h-0.5 bg-red-600 mb-8" />

      <div className="text-white font-light leading-relaxed whitespace-pre-wrap">
        {content?.content || 'No content'}
      </div>
    </div>
  );
}