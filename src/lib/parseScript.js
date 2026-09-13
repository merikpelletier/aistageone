// Parses an exported video script (.txt) into structured segments so the
// script reader can surface prompts (narration + action) and dialogs (dialogue).
//
// Exported format (from BlockTextEditor):
//   TITLE
//   =====
//
//   NARRATIVE SUMMARY
//   <summary>
//
//   SEGMENTS (N)
//
//   [SEGMENT 1] — IMAGE • MEDIUM SHOT
//   SET: ...
//   CHARACTERS: ...
//   TONE: ...
//   NARRATION:
//   <narration text>
//   DIALOGUE:
//   <dialogue>
//   ACTION:
//   <story action>
//   SOUND: ...
//   CONTINUITY: ...
//   ---

const INLINE_FIELDS = {
  SET: 'set',
  CHARACTERS: 'characters',
  TONE: 'tone',
  SOUND: 'sound',
  CONTINUITY: 'continuity',
};

const MULTI_FIELDS = ['narration', 'dialogue', 'action'];

export function parseScript(text) {
  if (!text) return { summary: '', segments: [] };
  const lines = text.split('\n');
  const segments = [];
  let summary = '';
  let current = null;
  let currentField = null;
  let inSummary = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const segMatch = trimmed.match(/^\[SEGMENT\s+(\d+)\]\s*(.*)$/i);
    if (segMatch) {
      if (current) segments.push(current);
      current = {
        index: parseInt(segMatch[1], 10),
        header: trimmed,
        set: '', characters: '', tone: '', sound: '', continuity: '',
        narration: '', dialogue: '', action: '',
      };
      currentField = null;
      inSummary = false;
      continue;
    }

    if (trimmed === '---') {
      if (current) { segments.push(current); current = null; }
      currentField = null;
      continue;
    }

    if (/^NARRATIVE SUMMARY/i.test(trimmed)) {
      inSummary = true;
      currentField = null;
      continue;
    }

    if (inSummary && !current) {
      if (/^SEGMENTS\s*\(\d+\)/i.test(trimmed)) {
        inSummary = false;
        continue;
      }
      summary += (summary ? '\n' : '') + line;
      continue;
    }

    if (!current) continue;

    const inlineMatch = trimmed.match(/^(SET|CHARACTERS|TONE|SOUND|CONTINUITY):\s*(.*)$/i);
    if (inlineMatch) {
      const key = INLINE_FIELDS[inlineMatch[1].toUpperCase()];
      current[key] = inlineMatch[2].trim();
      currentField = null;
      continue;
    }

    const multiMatch = trimmed.match(/^(NARRATION|DIALOGUE|ACTION):?$/i);
    if (multiMatch) {
      currentField = multiMatch[1].toLowerCase();
      continue;
    }

    if (currentField && MULTI_FIELDS.includes(currentField)) {
      current[currentField] += (current[currentField] ? '\n' : '') + line;
      continue;
    }
  }
  if (current) segments.push(current);

  summary = summary.trim();
  segments.forEach((s) => {
    s.narration = s.narration.trim();
    s.dialogue = s.dialogue.trim();
    s.action = s.action.trim();
  });

  return { summary, segments };
}