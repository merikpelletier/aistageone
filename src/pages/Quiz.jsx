import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Trophy, RotateCcw } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Quiz() {
  const [gameState, setGameState] = useState('start'); // start, playing, finished
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [shuffledAnswers, setShuffledAnswers] = useState([]);
  const [errors, setErrors] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const { data: questions = [] } = useQuery({
    queryKey: ['quizQuestions'],
    queryFn: () => base44.entities.QuizQuestion.filter({ is_active: true }),
  });

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const startGame = () => {
    const shuffled = shuffleArray(questions);
    setShuffledQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setErrors(0);
    setScore(0);
    setGameState('playing');
    loadQuestion(shuffled[0]);
  };

  const loadQuestion = (question) => {
    if (!question) return;
    const allAnswers = [...question.correct_answers, ...question.wrong_answers];
    setShuffledAnswers(shuffleArray(allAnswers));
    setTimeLeft(question.time_limit || 30);
    setSelectedAnswer(null);
  };

  useEffect(() => {
    if (gameState !== 'playing' || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const handleTimeout = () => {
    setErrors((prev) => prev + 1);
    if (errors + 1 >= 5) {
      setGameState('finished');
    } else {
      setTimeout(() => nextQuestion(), 1000);
    }
  };

  const handleAnswer = (answer) => {
    if (selectedAnswer) return;
    
    setSelectedAnswer(answer);
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    const isCorrect = currentQuestion.correct_answers.includes(answer);

    if (isCorrect) {
      setScore((prev) => prev + 1);
    } else {
      setErrors((prev) => prev + 1);
    }

    setTimeout(() => {
      if (!isCorrect && errors + 1 >= 5) {
        setGameState('finished');
      } else {
        nextQuestion();
      }
    }, 1500);
  };

  const nextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= shuffledQuestions.length) {
      setGameState('finished');
    } else {
      setCurrentQuestionIndex(nextIndex);
      loadQuestion(shuffledQuestions[nextIndex]);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 pb-20">
        <div className="text-center">
          <p className="text-white text-sm">No questions available</p>
        </div>
      </div>
    );
  }

  if (gameState === 'start') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <h1 className="text-white text-4xl font-extralight tracking-widest mb-6">
            QUIZ
          </h1>
          <p className="text-white text-sm mb-8">
            Test your knowledge<br />
            Maximum 5 errors allowed
          </p>
          <Button
            onClick={startGame}
            className="bg-white text-black hover:bg-white/90 font-light tracking-widest px-8 py-6 text-lg"
          >
            START
          </Button>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const percentage = Math.round((score / shuffledQuestions.length) * 100);
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <Trophy className="w-16 h-16 text-white mx-auto mb-6" />
          <h2 className="text-white text-3xl font-extralight tracking-widest mb-4">
            FINISHED
          </h2>
          <div className="mb-8">
            <p className="text-white text-5xl font-light mb-2">{score}</p>
            <p className="text-white text-sm">
              out of {shuffledQuestions.length} questions
            </p>
            <p className="text-white text-lg mt-2">{percentage}%</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={startGame}
              className="bg-white text-black hover:bg-white/90 font-light tracking-widest px-6"
            >
              <RotateCcw size={18} className="mr-2" />
              REPLAY
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const isCorrectAnswer = selectedAnswer && currentQuestion.correct_answers.includes(selectedAnswer);
  const isWrongAnswer = selectedAnswer && !currentQuestion.correct_answers.includes(selectedAnswer);

  return (
    <div className="min-h-screen bg-black p-6 pb-20">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="text-white text-sm">
              Question {currentQuestionIndex + 1} of {shuffledQuestions.length}
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <X
                  key={i}
                  size={20}
                  className={i < errors ? 'text-red-600' : 'text-white/10'}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-white" />
            <span className={`text-white font-light text-lg ${timeLeft <= 5 ? 'text-red-500' : ''}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="text-white text-2xl font-light mb-8 leading-relaxed">
              {currentQuestion.question}
            </h2>

            {/* Answers */}
            <div className="space-y-3">
              {shuffledAnswers.map((answer, index) => {
                const isSelected = selectedAnswer === answer;
                const isCorrect = currentQuestion.correct_answers.includes(answer);
                const showResult = selectedAnswer !== null;

                return (
                  <motion.button
                    key={index}
                    onClick={() => handleAnswer(answer)}
                    disabled={selectedAnswer !== null}
                    className={`w-full p-4 border rounded-lg text-left transition-all ${
                      showResult && isCorrect
                        ? 'bg-green-950 border-green-600 text-white'
                        : showResult && isSelected
                        ? 'bg-red-950 border-red-600 text-white'
                        : isSelected
                        ? 'bg-white/10 border-white text-white'
                        : 'bg-neutral-900 border-white/10 text-white/90 hover:bg-white/5'
                    } disabled:cursor-not-allowed`}
                    whileHover={!selectedAnswer ? { scale: 1.02 } : {}}
                    whileTap={!selectedAnswer ? { scale: 0.98 } : {}}
                  >
                    {answer}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Score */}
        <div className="mt-8 text-center">
          <span className="text-white text-sm">Score: </span>
          <span className="text-white font-light text-lg">{score}</span>
        </div>
      </div>
    </div>
  );
}