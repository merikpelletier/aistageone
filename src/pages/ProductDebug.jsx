import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

export default function ProductDebug() {
  const [searchParams] = useSearchParams();
  const pageId = searchParams.get('page');

  const { data: allPages = [] } = useQuery({
    queryKey: ['debugPages'],
    queryFn: () => base44.entities.DossierPage.list(),
  });

  const page = allPages.find(p => p.id === pageId);

  return (
    <div className="min-h-screen bg-black text-white p-8 pb-20">
      <h1 className="text-2xl mb-4">Debug Produit</h1>
      
      {page ? (
        <div className="space-y-4">
          <div className="bg-neutral-900 p-4 rounded">
            <h2 className="text-lg mb-2">Page ID: {page.id}</h2>
            <p className="text-white">Titre: {page.title || 'N/A'}</p>
            <p className="text-white">Prix: {page.price || 'N/A'}</p>
            <p className="text-white">Est un produit: {page.is_product ? 'OUI' : 'NON'}</p>
          </div>

          <div className="bg-neutral-900 p-4 rounded">
            <h2 className="text-lg mb-2">Product Options</h2>
            <pre className="text-xs bg-black p-3 rounded overflow-auto">
              {JSON.stringify(page.product_options, null, 2)}
            </pre>
            <p className="text-white text-sm mt-2">
              Type: {typeof page.product_options} | 
              Array: {Array.isArray(page.product_options) ? 'OUI' : 'NON'} |
              Length: {page.product_options?.length || 0}
            </p>
          </div>

          <div className="bg-neutral-900 p-4 rounded">
            <h2 className="text-lg mb-2">Toute la page (raw)</h2>
            <pre className="text-xs bg-black p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(page, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-white mb-4">Pas de page spécifiée ou introuvable</p>
          <div className="bg-neutral-900 p-4 rounded">
            <h2 className="text-lg mb-2">Toutes les pages produits:</h2>
            {allPages.filter(p => p.is_product).map(p => (
              <div key={p.id} className="mb-4 pb-4 border-b border-white/10">
                <p className="text-white">{p.title} (ID: {p.id})</p>
                <pre className="text-xs bg-black p-2 rounded mt-2 overflow-auto">
                  {JSON.stringify(p.product_options, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}