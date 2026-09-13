import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft } from 'lucide-react';

export default function DataDebug() {
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['debug-products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: contents = [], isLoading: loadingContents } = useQuery({
    queryKey: ['debug-contents'],
    queryFn: () => base44.entities.EditableContent.list()
  });

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-20">
      <Link
        to={createPageUrl('Plus')}
        className="inline-flex items-center gap-2 text-white hover:text-white mb-8"
      >
        <ArrowLeft size={18} />
        Retour
      </Link>

      <h1 className="text-2xl mb-8">Debug Structure Données</h1>

      <div className="space-y-8">
        <div>
          <h2 className="text-xl mb-4 text-red-500">Products (Premier item)</h2>
          <pre className="bg-neutral-900 p-4 rounded overflow-auto text-xs">
            {loadingProducts ? 'Chargement...' : JSON.stringify(products[0], null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-xl mb-4 text-red-500">EditableContent (Premier item)</h2>
          <pre className="bg-neutral-900 p-4 rounded overflow-auto text-xs">
            {loadingContents ? 'Chargement...' : JSON.stringify(contents[0], null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-xl mb-4 text-red-500">All Products</h2>
          <pre className="bg-neutral-900 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(products, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-xl mb-4 text-red-500">All Contents</h2>
          <pre className="bg-neutral-900 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(contents, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}