import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CatalogFilters({ filters, onChange, categories, subcategories, creators, resultCount }) {
  const availableSubcategories = filters.category === 'all' ? subcategories : subcategories.filter((item) => item.category_id === filters.category);
  const activeCount = [filters.category !== 'all', filters.subcategory !== 'all', filters.creator !== 'all', Boolean(filters.search.trim())].filter(Boolean).length;
  const reset = () => onChange({ category: 'all', subcategory: 'all', creator: 'all', search: '', sort: 'random' });

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-4 backdrop-blur md:p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_190px_190px_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
          <Input value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} placeholder="Search assets, creators or tags" className="h-11 border-zinc-700 bg-black/40 pl-10 text-white placeholder:text-zinc-600" />
        </div>
        <Select value={filters.category} onValueChange={(category) => onChange({ ...filters, category })}>
          <SelectTrigger className="h-11 border-zinc-700 bg-black/40 text-white"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-950 text-white">
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.label_en || item.label_fr || item.key}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.subcategory} onValueChange={(subcategory) => onChange({ ...filters, subcategory })}>
          <SelectTrigger className="h-11 border-zinc-700 bg-black/40 text-white"><SelectValue placeholder="Subcategory" /></SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-950 text-white">
            <SelectItem value="all">All subcategories</SelectItem>
            {availableSubcategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.label_en || item.label_fr || item.key}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.creator} onValueChange={(creator) => onChange({ ...filters, creator })}>
          <SelectTrigger className="h-11 border-zinc-700 bg-black/40 text-white"><SelectValue placeholder="Creator" /></SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-950 text-white">
            <SelectItem value="all">All creators</SelectItem>
            {creators.map((creator) => <SelectItem key={creator} value={creator}>{creator}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.sort} onValueChange={(sort) => onChange({ ...filters, sort })}>
          <SelectTrigger className="h-11 border-zinc-700 bg-black/40 text-white"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-950 text-white">
            <SelectItem value="random">Random selection</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="popular">Most downloaded</SelectItem>
            <SelectItem value="price_asc">Credits: low to high</SelectItem>
            <SelectItem value="price_desc">Credits: high to low</SelectItem>
            <SelectItem value="title">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => onChange({ ...filters, category: 'all' })} className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold ${filters.category === 'all' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300' : 'border-zinc-700 text-zinc-400'}`}>All assets</button>
        {categories.map((item) => (
          <button key={item.id} onClick={() => onChange({ ...filters, category: item.id })} className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold ${filters.category === item.id ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
            {item.label_en || item.label_fr || item.key}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span><strong className="text-white">{resultCount}</strong> results</span>
        {activeCount > 0 && <button onClick={reset} className="flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300"><X size={14} /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}</button>}
      </div>
    </div>
  );
}
