import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft } from 'lucide-react';

export default function ContentDebug() {
  const urlParams = new URLSearchParams(window.location.search);
  const contentKey = urlParams.get('key');

  const { data: rawContents, isLoading } = useQuery({
    queryKey: ['editableContent'],
    queryFn: () => base44.entities.EditableContent.list()
  });

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <Link
        to={createPageUrl('Plus')}
        className="inline-flex items-center gap-2 text-white hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft size={18} />
        <span>Retour</span>
      </Link>

      <h1 className="text-2xl mb-4">Debug Content</h1>
      
      <div className="space-y-4 font-mono text-sm">
        <div>
          <strong className="text-red-400">contentKey from URL:</strong>
          <pre className="bg-neutral-900 p-2 mt-2">{contentKey || 'null'}</pre>
        </div>

        <div>
          <strong className="text-red-400">isLoading:</strong>
          <pre className="bg-neutral-900 p-2 mt-2">{String(isLoading)}</pre>
        </div>

        <div>
          <strong className="text-red-400">rawContents:</strong>
          <pre className="bg-neutral-900 p-2 mt-2 overflow-x-auto">
            {JSON.stringify(rawContents, null, 2)}
          </pre>
        </div>

        <div>
          <strong className="text-red-400">Found item:</strong>
          <pre className="bg-neutral-900 p-2 mt-2 overflow-x-auto">
            {JSON.stringify(
              rawContents?.find(item => item?.data?.key === contentKey),
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}