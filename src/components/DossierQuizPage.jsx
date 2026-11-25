import React, { useState } from 'react';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { parseDossierQuiz } from '@/components/DossierQuizEditor';
import { playQuizSound } from '@/components/DossierQuizSounds';

export default function DossierQuizPage({ page, external = false }) {
  const t = useStudioTranslation();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const quiz = parseDossierQuiz(page?.content);
  const soundDefaults = { correct: 'chime', incorrect: 'boing', complete: 'fanfare', select: 'pop' };
  const sound = event => playQuizSound(quiz.sounds[event] || soundDefaults[event]);
  const questions = quiz.questions.filter(q => q.prompt?.trim() && Array.isArray(q.choices) && q.choices.length >= 2 && q.choices.every(choice => String(choice).trim()) && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.choices.length);
  const question = questions[index];
  const advance = () => {
    if (selected === question.correctIndex) setScore(value => value + 1);
    if (index + 1 === questions.length) { sound('complete'); setFinished(true); }
    else { setIndex(value => value + 1); setSelected(null); }
  };
  const restart = () => { setIndex(0); setSelected(null); setScore(0); setFinished(false); };
  return <div className={`absolute inset-0 overflow-y-auto bg-neutral-950 px-4 text-white pointer-events-auto ${external ? 'flex flex-col py-20' : 'py-12'}`} onTouchStart={e => e.stopPropagation()}>
    <div className={`mx-auto w-full max-w-2xl space-y-5 ${external ? 'my-auto shrink-0' : ''}`}>
      {page?.title && <h2 className="text-2xl font-light md:text-3xl">{page.title}</h2>}
      {!questions.length ? <p className="text-white/60">{t('No questions available yet', 'No questions available yet')}</p> : finished ? (
        <div className="space-y-5 border border-white/15 p-6 text-center">
          <h3 className="text-xl">{t('Game completed', 'Game completed')}</h3>
          <p className="text-3xl font-light">{score} / {questions.length}</p>
          <p className="text-sm text-white/70">{t('Your score', 'Your score')}</p>
          <button type="button" onClick={() => { sound('select'); restart(); }} className="bg-white px-5 py-2 text-sm text-black">{t('Play again', 'Play again')}</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-white/50">{t('Question', 'Question')} {index + 1} / {questions.length}</p>
          <h3 className="text-xl font-medium">{question.prompt}</h3>
          {question.image_url && <img src={question.image_url} alt="" className="max-h-64 w-full object-contain"/>}
          <div className="grid gap-2">
            {question.choices.map((choice, i) => <button key={i} type="button" onClick={() => { setSelected(i); sound(i === question.correctIndex ? 'correct' : 'incorrect'); }} className={`w-full border px-4 py-3 text-left text-sm transition-colors ${selected === i ? 'border-white bg-white/15' : 'border-white/20 hover:bg-white/10'}`}>{choice}</button>)}
          </div>
          {selected !== null && <p className="text-sm text-white/75">{selected === question.correctIndex ? t('Correct answer!', 'Correct answer!') : t('Try the next question', 'Try the next question')}{question.explanation ? ` — ${question.explanation}` : ''}</p>}
          <button type="button" disabled={selected === null} onClick={advance} className="bg-white px-5 py-2 text-sm text-black disabled:opacity-40">{index + 1 === questions.length ? t('See score', 'See score') : t('Next question', 'Next question')}</button>
        </div>
      )}
    </div>
  </div>;
}
