import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function AdminQuiz() {
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['adminQuizQuestions'],
    queryFn: () => base44.entities.QuizQuestion.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QuizQuestion.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuizQuestions'] });
      setIsDialogOpen(false);
      setEditingQuestion(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuizQuestion.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuizQuestions'] });
      setIsDialogOpen(false);
      setEditingQuestion(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QuizQuestion.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuizQuestions'] });
    },
  });

  const handleSave = (formData) => {
    if (editingQuestion?.id) {
      updateMutation.mutate({ id: editingQuestion.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openDialog = (question = null) => {
    setEditingQuestion(question || {
      question: '',
      correct_answers: [''],
      wrong_answers: ['', '', ''],
      time_limit: 30,
      is_active: true
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-light text-white">Quiz Questions</h2>
        <Button onClick={() => openDialog()} className="bg-white text-black hover:bg-white/90">
          <Plus size={18} className="mr-2" />
          New Question
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div
              key={q.id}
              className="bg-neutral-900 border border-white/10 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-white font-light mb-2">{q.question}</h3>
                  <div className="flex items-center gap-4 text-xs text-white">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {q.time_limit}s
                    </span>
                    <span className={q.is_active ? 'text-green-500' : 'text-red-500'}>
                      {q.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDialog(q)}
                    className="border-white/10 text-white hover:bg-white/10"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(q.id)}
                    className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-green-500">✓ Correct: </span>
                  <span className="text-white">{q.correct_answers.join(', ')}</span>
                </div>
                <div>
                  <span className="text-red-500">✗ Wrong: </span>
                  <span className="text-white">{q.wrong_answers.join(', ')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <QuestionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        question={editingQuestion}
        onSave={handleSave}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function QuestionDialog({ isOpen, onClose, question, onSave, isSaving }) {
  const [formData, setFormData] = useState(question || {});

  React.useEffect(() => {
    setFormData(question || {});
  }, [question]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const updateCorrectAnswer = (index, value) => {
    const newAnswers = [...formData.correct_answers];
    newAnswers[index] = value;
    setFormData({ ...formData, correct_answers: newAnswers });
  };

  const addCorrectAnswer = () => {
    setFormData({
      ...formData,
      correct_answers: [...formData.correct_answers, '']
    });
  };

  const removeCorrectAnswer = (index) => {
    const newAnswers = formData.correct_answers.filter((_, i) => i !== index);
    setFormData({ ...formData, correct_answers: newAnswers });
  };

  const updateWrongAnswer = (index, value) => {
    const newAnswers = [...formData.wrong_answers];
    newAnswers[index] = value;
    setFormData({ ...formData, wrong_answers: newAnswers });
  };

  const addWrongAnswer = () => {
    setFormData({
      ...formData,
      wrong_answers: [...formData.wrong_answers, '']
    });
  };

  const removeWrongAnswer = (index) => {
    const newAnswers = formData.wrong_answers.filter((_, i) => i !== index);
    setFormData({ ...formData, wrong_answers: newAnswers });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {question?.id ? 'Edit Question' : 'New Question'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label className="text-white">Question</Label>
            <Textarea
              value={formData.question || ''}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="bg-black border-white/10 text-white mt-2"
              rows={3}
              required
            />
          </div>

          <div>
            <Label className="text-white mb-2 block">Correct Answers</Label>
            {formData.correct_answers?.map((answer, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  value={answer}
                  onChange={(e) => updateCorrectAnswer(index, e.target.value)}
                  className="bg-black border-green-500/30 text-white"
                  placeholder="Correct answer"
                  required
                />
                {formData.correct_answers.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeCorrectAnswer(index)}
                    className="border-red-500/30 text-red-500"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addCorrectAnswer}
              className="border-green-500/30 text-green-500 mt-2"
            >
              <Plus size={14} className="mr-2" />
              Add correct answer
            </Button>
          </div>

          <div>
            <Label className="text-white mb-2 block">Wrong Answers</Label>
            {formData.wrong_answers?.map((answer, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  value={answer}
                  onChange={(e) => updateWrongAnswer(index, e.target.value)}
                  className="bg-black border-red-500/30 text-white"
                  placeholder="Wrong answer"
                  required
                />
                {formData.wrong_answers.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeWrongAnswer(index)}
                    className="border-red-500/30 text-red-500"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addWrongAnswer}
              className="border-red-500/30 text-red-500 mt-2"
            >
              <Plus size={14} className="mr-2" />
              Add wrong answer
            </Button>
          </div>

          <div>
            <Label className="text-white">Time limit (seconds)</Label>
            <Input
              type="number"
              value={formData.time_limit || 30}
              onChange={(e) => setFormData({ ...formData, time_limit: parseInt(e.target.value) })}
              className="bg-black border-white/10 text-white mt-2"
              min={5}
              max={120}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_active !== false}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              className="data-[state=checked]:bg-green-600"
            />
            <Label className="text-white">Active question</Label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-white">
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-white text-black hover:bg-white/90">
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}