import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function DossierCoverActions({ dossierId }) {
  const [showComments, setShowComments] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [currentCommentPage, setCurrentCommentPage] = useState(0);

  const handleRating = async (value, e) => {
    e?.stopPropagation();
    setRating(value);
    setSubmitting(true);
    try {
      await base44.functions.invoke('addDossierRating', { dossierId, rating: value });
      await fetchRating();
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
    setSubmitting(false);
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getDossierComments', { dossierId });
      setComments(res.data?.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
    setLoading(false);
  };

  const handleCommentSubmit = async (e) => {
    e?.stopPropagation();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await base44.functions.invoke('addDossierComment', { dossierId, comment });
      setComment('');
      await fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
    setSubmitting(false);
  };

  const fetchRating = async () => {
    try {
      const res = await base44.functions.invoke('getDossierRating', { dossierId });
      setAvgRating(res.data?.avg || 0);
      setRatingCount(res.data?.count || 0);
    } catch (error) {
      console.error('Error fetching rating:', error);
    }
  };

  const handleShowComments = async (e) => {
    e.stopPropagation();
    if (!showComments) {
      await fetchComments();
      setCurrentCommentPage(0);
    }
    setShowComments(!showComments);
  };

  const commentsPerPage = 3;
  const displayedComments = comments.slice(currentCommentPage * commentsPerPage, (currentCommentPage + 1) * commentsPerPage);
  const hasNextPage = (currentCommentPage + 1) * commentsPerPage < comments.length;
  const hasPrevPage = currentCommentPage > 0;

  React.useEffect(() => {
    fetchRating();
  }, [dossierId]);

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-40 pointer-events-auto flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
      {/* Stars — vertical column */}
      <div className="flex flex-col gap-1 bg-black/60 backdrop-blur-sm rounded-2xl px-2 py-3 items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={(e) => handleRating(star, e)}
            className="p-0.5 hover:scale-110 transition-transform"
            disabled={submitting}
          >
            <Star
              size={18}
              className={star <= (hoverRating || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-white'}
            />
          </button>
        ))}
      </div>

      {/* Comment Button */}
      <button
        onClick={handleShowComments}
        className="bg-black/60 backdrop-blur-sm rounded-full p-2.5 hover:bg-black/80 transition-colors relative"
      >
        <MessageCircle size={18} className="text-white" />
        {comments.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
            {comments.length}
          </span>
        )}
      </button>

      {/* Avg rating */}
      {ratingCount > 0 && (
        <div className="bg-black/60 backdrop-blur-sm rounded-xl px-2 py-1.5 flex flex-col items-center gap-0.5">
          <Star size={14} className="fill-yellow-400 text-yellow-400" />
          <span className="text-white text-xs font-light">{avgRating}</span>
        </div>
      )}

      {/* Comments Panel */}
      {showComments && (
        <div className="absolute -top-96 left-1/2 -translate-x-1/2 bg-black/95 backdrop-blur-sm rounded-lg p-5 w-80 max-h-96 z-50 pointer-events-auto flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-light text-lg">Comments ({comments.length})</h3>
            <button
              onClick={() => setShowComments(false)}
              className="text-white hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Comments List with Navigation */}
          {comments.length === 0 ? (
            <div className="text-white text-base text-center py-12 flex-1 flex items-center justify-center">No comments yet</div>
          ) : (
            <>
              <div className="flex-1 mb-4 flex flex-col overflow-y-auto">
                {loading ? (
                  <div className="text-white text-base text-center py-4">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {displayedComments.map((c) => (
                      <div key={c.id} className="bg-white/15 rounded p-3 border border-white/10">
                        <div className="text-white/80 font-medium text-sm">{c.user_name}</div>
                        <div className="text-white/90 text-sm mt-2 leading-relaxed">{c.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Navigation */}
              {comments.length > commentsPerPage && (
                <div className="flex justify-between items-center mb-3 px-1">
                  <button
                    onClick={() => setCurrentCommentPage(Math.max(0, currentCommentPage - 1))}
                    disabled={!hasPrevPage}
                    className="disabled:opacity-30 text-white hover:text-white transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-white text-sm">{currentCommentPage + 1} / {Math.ceil(comments.length / commentsPerPage)}</span>
                  <button
                    onClick={() => setCurrentCommentPage(currentCommentPage + 1)}
                    disabled={!hasNextPage}
                    className="disabled:opacity-30 text-white hover:text-white transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Comment Form */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Your comment..."
            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/50 text-sm resize-none mb-3"
            rows="2"
          />
          
          <Button
            onClick={(e) => handleCommentSubmit(e)}
            disabled={!comment.trim() || submitting}
            className="w-full bg-white text-black hover:bg-white/90 font-light text-sm py-2"
          >
            {submitting ? 'Posting...' : 'Post'}
          </Button>
        </div>
      )}
    </div>
  );
}