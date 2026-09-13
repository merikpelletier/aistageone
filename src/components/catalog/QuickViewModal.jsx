import React from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Box, Sparkles, X } from 'lucide-react';

export default function QuickViewModal({ asset, category, onClose }) {
  return (
    <AnimatePresence>
      {asset && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/70 p-2 text-white hover:text-cyan-300"><X size={20} /></button>
            <div className="grid md:grid-cols-2">
              <div className="aspect-square bg-black">
                {asset.featured_image ? <img src={asset.featured_image} alt={asset.title} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-zinc-700"><Box size={68} /></div>}
              </div>
              <div className="p-7 md:p-9">
                {category && <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">{category.label_en || category.label_fr || category.key}</p>}
                <h2 className="mt-3 text-3xl font-black leading-tight text-white">{asset.title}</h2>
                {asset.creator_name && <p className="mt-3 text-sm text-zinc-500">By {asset.creator_name}</p>}
                <p className="mt-6 leading-relaxed text-zinc-300">{asset.description || 'Production-ready creative asset.'}</p>
                {Array.isArray(asset.tags) && asset.tags.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{asset.tags.slice(0, 8).map((tag) => <span key={tag} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">{tag}</span>)}</div>}
                <div className="mt-8 flex items-center justify-between border-y border-white/10 py-4">
                  <span className="text-sm text-zinc-500">Usage cost</span>
                  <span className="flex items-center gap-2 text-xl font-black text-cyan-300"><Sparkles size={18} />{asset.credit_cost ?? 0} credits</span>
                </div>
                <Link to={`/AssetDetail?id=${encodeURIComponent(asset.id)}`} onClick={onClose} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 font-black text-black hover:brightness-110">VIEW FULL ASSET <ArrowRight size={18} /></Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
