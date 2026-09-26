import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Eye, Sparkles } from 'lucide-react';

export default function AssetCard({ asset, category, onQuickView, onOpenAsset = null }) {
  return (
    <motion.article layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="group overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 transition hover:-translate-y-1 hover:border-cyan-400/50">
      {onOpenAsset ? <button type="button" onClick={() => onOpenAsset(asset.id)} className="block w-full text-left">
        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          {asset.featured_image ? <img src={asset.featured_image} alt={asset.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-zinc-700"><Box size={52} /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {asset.is_featured && <span className="absolute left-3 top-3 rounded-full bg-cyan-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black">Featured</span>}
          {category && <span className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{category.label_en || category.label_fr || category.key}</span>}
        </div>
      </button> : <Link to={`/AssetDetail?id=${encodeURIComponent(asset.id)}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          {asset.featured_image ? <img src={asset.featured_image} alt={asset.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-zinc-700"><Box size={52} /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {asset.is_featured && <span className="absolute left-3 top-3 rounded-full bg-cyan-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black">Featured</span>}
          {category && <span className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{category.label_en || category.label_fr || category.key}</span>}
        </div>
      </Link>}
      <div className="p-5">
        {onOpenAsset ? <button type="button" onClick={() => onOpenAsset(asset.id)} className="text-left"><h2 className="line-clamp-2 text-lg font-black leading-tight hover:text-cyan-300">{asset.title}</h2></button> : <Link to={`/AssetDetail?id=${encodeURIComponent(asset.id)}`}><h2 className="line-clamp-2 text-lg font-black leading-tight hover:text-cyan-300">{asset.title}</h2></Link>}
        <p className="mt-2 text-xs text-zinc-500">{asset.creator_name ? `By ${asset.creator_name}` : 'AISTAGE.ONE'}</p>
        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-relaxed text-zinc-400">{asset.description || 'Production-ready creative asset.'}</p>
        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex items-center gap-1.5 font-black text-cyan-300"><Sparkles size={15} />{asset.credit_cost ?? 0} credits</div>
          <button onClick={() => onQuickView(asset)} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-cyan-400 hover:text-cyan-300"><Eye size={14} /> Quick view</button>
        </div>
      </div>
    </motion.article>
  );
}
