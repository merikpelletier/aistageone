import React from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { QUIZ_SOUND_OPTIONS, playQuizSound } from '@/components/DossierQuizSounds';

export function parseDossierQuiz(content) {
  try {
    const data = JSON.parse(content || '{}');
    return { questions: Array.isArray(data.questions) ? data.questions : [], sounds: data.sounds || {} };
  } catch {
    return { questions: [], sounds: {} };
  }
}

export default function DossierQuizEditor({ value, onChange }) {
  const t = useStudioTranslation();
  const quiz = parseDossierQuiz(value);
  const change = (questions, sounds = quiz.sounds) => onChange(JSON.stringify({ version: 1, questions, sounds }));
  const updateSound = (event, value) => change(quiz.questions, { ...quiz.sounds, [event]: value });
  const setQuestion = (index, changes) => change(quiz.questions.map((q, i) => i === index ? { ...q, ...changes } : q));
  const addQuestion = () => change([...quiz.questions, { prompt: '', image_url: '', choices: ['', '', '', ''], correctIndex: 0, explanation: '' }]);
  const updateChoice = (questionIndex, choiceIndex, text) => {
    const q = quiz.questions[questionIndex];
    setQuestion(questionIndex, { choices: q.choices.map((choice, i) => i === choiceIndex ? text : choice) });
  };
  const uploadImage = async (index, file) => {
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (file_url) setQuestion(index, { image_url: file_url });
    } catch (error) {
      window.alert(error?.message || t('Quiz image upload failed', 'Quiz image upload failed'));
    }
  };

  const defaults = { correct: 'chime', incorrect: 'boing', complete: 'fanfare', select: 'pop' };
  const soundEvents = [['correct', 'Correct answer sound'], ['incorrect', 'Incorrect answer sound'], ['complete', 'Game completed sound'], ['select', 'Answer selection sound']];
  return <div className="space-y-3 border border-white/10 bg-black/30 p-3">
    <div className="space-y-2 border-b border-white/10 pb-3">
      <p className="text-xs font-medium text-white">{t('Sound effects', 'Sound effects')}</p>
      <p className="text-[11px] text-white/50">{t('Choose and preview a sound for each game moment.', 'Choose and preview a sound for each game moment.')}</p>
      {soundEvents.map(([event, label]) => <div key={event} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <label className="min-w-0 text-xs text-white/75">{t(label, label)}<select value={quiz.sounds[event] || defaults[event]} onChange={e => updateSound(event, e.target.value)} className="mt-1 h-8 w-full border border-white/15 bg-neutral-900 px-2 text-xs text-white">{QUIZ_SOUND_OPTIONS.map(option => <option key={option.value} value={option.value}>{t(option.label, option.label)}</option>)}</select></label>
        <button type="button" onClick={() => playQuizSound(quiz.sounds[event] || defaults[event])} className="mt-5 border border-white/20 px-2 py-1.5 text-xs text-white">{t('Preview', 'Preview')}</button>
      </div>)}
    </div>
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-white/70">{t('Quiz questions', 'Quiz questions')} · {quiz.questions.length}</p>
      <button type="button" onClick={addQuestion} className="flex items-center gap-1 border border-white/20 px-2 py-1 text-xs hover:bg-white/10"><Plus size={13}/>{t('Add question', 'Add question')}</button>
    </div>
    {quiz.questions.map((q, index) => (
      <div key={index} className="space-y-2 border border-white/15 bg-neutral-950 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">{t('Question', 'Question')} {index + 1}</span>
          <button type="button" aria-label={t('Delete question', 'Delete question')} onClick={() => change(quiz.questions.filter((_, i) => i !== index))} className="text-white/50 hover:text-red-400"><Trash2 size={14}/></button>
        </div>
        <input className="w-full border border-white/15 bg-neutral-900 px-2 py-2 text-sm" value={q.prompt || ''} onChange={e => setQuestion(index, { prompt: e.target.value })} placeholder={t('Write your question', 'Write your question')} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1 border border-white/20 px-2 py-1 text-xs"><Upload size={12}/>{t('Question image', 'Question image')}<input type="file" accept="image/*" className="hidden" onChange={e => { uploadImage(index, e.target.files?.[0]); e.target.value = ''; }}/></label>
          {q.image_url && <><img src={q.image_url} alt="" className="h-10 w-14 object-cover"/><button type="button" className="text-xs text-white/60" onClick={() => setQuestion(index, { image_url: '' })}>{t('Remove image', 'Remove image')}</button></>}
        </div>
        {(Array.isArray(q.choices) ? q.choices : []).map((choice, choiceIndex) => (
          <div key={choiceIndex} className="flex items-center gap-2">
            <input type="radio" name={`quiz-correct-${index}`} checked={q.correctIndex === choiceIndex} onChange={() => setQuestion(index, { correctIndex: choiceIndex })} aria-label={t('Correct answer', 'Correct answer')} />
            <input className="min-w-0 flex-1 border border-white/15 bg-neutral-900 px-2 py-1.5 text-xs" value={choice} placeholder={`${t('Answer', 'Answer')} ${choiceIndex + 1}`} onChange={e => updateChoice(index, choiceIndex, e.target.value)} />
            {(q.choices || []).length > 2 && <button type="button" aria-label={t('Remove answer', 'Remove answer')} onClick={() => setQuestion(index, { choices: q.choices.filter((_, i) => i !== choiceIndex), correctIndex: q.correctIndex === choiceIndex ? 0 : q.correctIndex > choiceIndex ? q.correctIndex - 1 : q.correctIndex })}><Trash2 size={13}/></button>}
          </div>
        ))}
        <div className="flex justify-between gap-2">
          <span className="text-[11px] text-white/45">{t('Select the correct answer', 'Select the correct answer')}</span>
          {(q.choices || []).length < 6 && <button type="button" className="text-xs text-white/75" onClick={() => setQuestion(index, { choices: [...(q.choices || []), ''] })}>+ {t('Add answer', 'Add answer')}</button>}
        </div>
        <input className="w-full border border-white/15 bg-neutral-900 px-2 py-1.5 text-xs" value={q.explanation || ''} onChange={e => setQuestion(index, { explanation: e.target.value })} placeholder={t('Answer explanation (optional)', 'Answer explanation (optional)')} />
      </div>
    ))}
    {!quiz.questions.length && <p className="text-xs text-white/45">{t('Add a question to start your game', 'Add a question to start your game')}</p>}
  </div>;
}
