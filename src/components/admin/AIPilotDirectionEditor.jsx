import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AIPilotDirectionEditorBase from './AIPilotDirectionEditorBase';

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';
const SECONDARY_BUTTON_CLASS = 'bg-white/[0.04] text-white border border-white/15 hover:bg-white/[0.08] hover:border-white/25';
const REMOVE_BUTTON_CLASS = 'h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md bg-transparent border-0 p-0 cursor-pointer hover:bg-white/[0.06]';

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizePrompts = (content, prefix) => {
  if (Array.isArray(content?.prompts)) {
    return content.prompts.map((item, index) => ({
      id: item?.id || `${prefix}-${index + 1}`,
      name: item?.name || '',
      text: item?.text || '',
    }));
  }

  return String(content?.text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `${prefix}-legacy-${index + 1}`,
      name: '',
      text: line,
    }));
};

function PromptCollectionEditor({ block, setBlock, readOnly, onSave, saving }) {
  const isAction = block.block_key === 'action-prompts';
  const prefix = isAction ? 'action-prompt' : 'blocking-prompt';
  const singularLabel = isAction ? 'Action Prompt' : 'Blocking Prompt';
  const pluralLabel = isAction ? 'Action Prompts' : 'Blocking Prompts';
  const prompts = normalizePrompts(block.content || {}, prefix);
  const [expandedPromptId, setExpandedPromptId] = useState(null);

  const updatePrompts = (nextPrompts) => {
    setBlock({
      ...block,
      content: {
        ...(block.content || {}),
        text: '',
        prompts: nextPrompts,
      },
    });
  };

  const addPrompt = () => {
    const id = makeId(prefix);
    updatePrompts([...prompts, { id, name: '', text: '' }]);
    setExpandedPromptId(id);
  };

  const updatePrompt = (id, patch) => {
    updatePrompts(prompts.map((prompt) => prompt.id === id ? { ...prompt, ...patch } : prompt));
  };

  const removePrompt = (id) => {
    updatePrompts(prompts.filter((prompt) => prompt.id !== id));
    if (expandedPromptId === id) setExpandedPromptId(null);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg text-white">{pluralLabel}</div>
          <div className="text-xs text-white/40 mt-1">Each prompt is stored and selectable as an independent AI Pilot component.</div>
        </div>
        {!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={addPrompt}><Plus size={14} className="mr-1.5" /> Add {singularLabel}</Button>}
      </div>

      {!prompts.length && (
        <div className="border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/35">
          No {pluralLabel.toLowerCase()} yet.
        </div>
      )}

      <div className="space-y-1.5">
        {prompts.map((prompt, index) => {
          const expanded = expandedPromptId === prompt.id;
          return (
            <div key={prompt.id} className="border border-white/10 bg-black/20">
              <div className="flex items-center gap-2 min-h-11 px-2">
                <button
                  type="button"
                  className="flex flex-1 min-w-0 items-center gap-2 text-left py-2"
                  onClick={() => setExpandedPromptId(expanded ? null : prompt.id)}
                >
                  {expanded ? <ChevronDown size={16} className="text-white/50 shrink-0" /> : <ChevronRight size={16} className="text-white/50 shrink-0" />}
                  <span className="text-sm text-white truncate">{prompt.name || `${singularLabel} ${index + 1}`}</span>
                  {!expanded && prompt.text && <span className="hidden md:block text-xs text-white/30 truncate">{prompt.text}</span>}
                </button>
                {!readOnly && <button type="button" className={REMOVE_BUTTON_CLASS} onClick={() => removePrompt(prompt.id)} title={`Remove ${singularLabel.toLowerCase()}`} aria-label={`Remove ${singularLabel.toLowerCase()}`}><Trash2 size={16} /></button>}
              </div>

              {expanded && (
                <div className="border-t border-white/10 p-3 space-y-3">
                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Name</span>
                    <Input
                      className={CONTROL_CLASS}
                      disabled={readOnly}
                      placeholder={isAction ? 'e.g. Runway entrance, Confrontation, Reveal' : 'e.g. Two-shot confrontation, Group entrance, Cross-room movement'}
                      value={prompt.name || ''}
                      onChange={(event) => updatePrompt(prompt.id, { name: event.target.value })}
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Prompt</span>
                    <Textarea
                      className={CONTROL_CLASS}
                      rows={5}
                      disabled={readOnly}
                      placeholder={isAction ? 'Describe the reusable action direction.' : 'Describe the reusable staging, placement and movement direction.'}
                      value={prompt.text || ''}
                      onChange={(event) => updatePrompt(prompt.id, { text: event.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={onSave} disabled={saving}><Save size={15} className="mr-2" /> {saving ? 'Saving…' : `Save ${pluralLabel}`}</Button></div>}
    </div>
  );
}

export default function AIPilotDirectionEditor(props) {
  const blockKey = props.block?.block_key;
  if (blockKey === 'action-prompts' || blockKey === 'blocking-prompts') {
    return <PromptCollectionEditor {...props} />;
  }
  return <AIPilotDirectionEditorBase {...props} />;
}
