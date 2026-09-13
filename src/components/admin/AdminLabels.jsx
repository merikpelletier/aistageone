import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from 'lucide-react';

const DEFAULT_LABELS = [
  { group: 'Navigation', key: 'nav_magazine', label: 'Magazine', defaultValue: 'Magazine' },
  { group: 'Navigation', key: 'nav_index', label: 'Index', defaultValue: 'Index' },
  { group: 'Navigation', key: 'nav_salons', label: 'Salons', defaultValue: 'Salons' },
  { group: 'Navigation', key: 'nav_quiz', label: 'Quiz', defaultValue: 'Quiz' },
  { group: 'Navigation', key: 'nav_plus', label: 'Plus', defaultValue: 'Plus' },
  { group: 'Page Plus', key: 'plus_title', label: 'Titre de la page', defaultValue: 'PLUS' },
  { group: 'Page Plus', key: 'plus_admin_label', label: 'Lien Administration', defaultValue: 'Administration' },
  { group: 'Page Plus', key: 'plus_info_section', label: 'Titre section Informations', defaultValue: 'INFORMATIONS' },
  { group: 'Page Plus', key: 'plus_contact_section', label: 'Titre section Contact', defaultValue: 'ÉCRIRE AU COCHON SAVANT' },
  { group: 'Page Plus', key: 'plus_contact_button', label: 'Bouton Nous contacter', defaultValue: 'Nous contacter' },
  { group: 'Page Plus', key: 'plus_footer', label: 'Texte bas de page', defaultValue: 'Le Cochon Savant est un lieu temporaire, un espace adulte assumé, un objet éditorial vivant, sans mémoire, sans algorithme, sans compétition sociale.' },
];

export default function AdminLabels() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState({});

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['appLabels'],
    queryFn: () => base44.entities.AppLabel.list(),
    onSuccess: (data) => {
      const map = {};
      data.forEach(l => { map[l.key] = l.value; });
      setValues(map);
    }
  });

  const labelsMap = {};
  labels.forEach(l => { labelsMap[l.key] = l; });

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }) => {
      const existing = labelsMap[key];
      if (existing) {
        return base44.entities.AppLabel.update(existing.id, { key, value });
      } else {
        return base44.entities.AppLabel.create({ key, value });
      }
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['appLabels'] });
      setSaved(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 1500);
    }
  });

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = (key) => {
    const value = values[key]?.trim();
    if (!value) return;
    saveMutation.mutate({ key, value });
  };

  const groups = [...new Set(DEFAULT_LABELS.map(l => l.group))];

  if (isLoading) return <div className="text-white text-sm">Loading...</div>;

  return (
    <div className="space-y-8">
      <h2 className="text-white text-lg font-light">Labels & Titles</h2>

      {groups.map(group => (
        <div key={group}>
          <h3 className="text-white text-xs uppercase tracking-widest mb-3">{group}</h3>
          <div className="space-y-3">
            {DEFAULT_LABELS.filter(l => l.group === group).map(({ key, label, defaultValue }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-white text-sm w-48 flex-shrink-0">{label}</span>
                <Input
                  value={values[key] ?? defaultValue}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={defaultValue}
                  className="bg-neutral-900 border-white/10 text-white flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(key)}
                  className={`flex-shrink-0 ${saved[key] ? 'bg-green-600 hover:bg-green-600' : 'bg-white text-black hover:bg-white/90'}`}
                >
                  {saved[key] ? '✓' : <Save size={14} />}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}