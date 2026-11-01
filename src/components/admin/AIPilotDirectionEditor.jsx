import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';

const SERIES_FIELDS = [
  ['tone', 'Tone'],
  ['rules', 'Rules'],
  ['locations', 'Locations'],
  ['sets', 'Sets'],
  ['audience', 'Audience'],
  ['what_to_avoid', 'What to Avoid'],
  ['music', 'Music'],
];

export default function AIPilotDirectionEditor({ block, setBlock, readOnly, onSave, saving }) {
  if (!block) return <div className="h-full min-h-80 flex items-center justify-center text-sm text-white/35">Select a direction block.</div>;

  const updateContent = (key, value) => {
    setBlock({ ...block, content: { ...(block.content || {}), [key]: value } });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <div className="text-lg text-white">{block.title}</div>
        <div className="text-xs text-white/40 mt-1">Production direction used by the connected creation tools.</div>
      </div>

      {block.block_key === 'series-direction' ? (
        <div className="grid md:grid-cols-2 gap-4">
          {SERIES_FIELDS.map(([key, label]) => (
            <label key={key} className={`space-y-2 ${key === 'rules' || key === 'what_to_avoid' ? 'md:col-span-2' : ''}`}>
              <span className="text-xs text-white/55">{label}</span>
              <Textarea
                className={CONTROL_CLASS}
                rows={key === 'rules' || key === 'what_to_avoid' ? 5 : 4}
                disabled={readOnly}
                value={block.content?.[key] || ''}
                onChange={(event) => updateContent(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      ) : (
        <label className="space-y-2 block">
          <span className="text-xs text-white/55">Direction</span>
          <Textarea
            className={CONTROL_CLASS}
            rows={18}
            disabled={readOnly}
            value={block.content?.text || ''}
            onChange={(event) => updateContent('text', event.target.value)}
          />
        </label>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <Button className={PRIMARY_BUTTON_CLASS} onClick={onSave} disabled={saving}>
            <Save size={15} className="mr-2" /> {saving ? 'Saving…' : 'Save Direction'}
          </Button>
        </div>
      )}
    </div>
  );
}
