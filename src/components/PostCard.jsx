import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Trash2, Edit2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PostCard({ post, user, onEdit, onDelete }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ['postComments', post.id],
    queryFn: async () => {
      const allComments = await base44.entities.PostComment.list();
      return allComments.filter(c => c.post_id === post.id);
    },
  });

  // Fetch likes
  const { data: likes = [] } = useQuery({
    queryKey: ['postLikes', post.id],
    queryFn: async () => {
      const allLikes = await base44.entities.PostLike.list();
      return allLikes.filter(l => l.post_id === post.id);
    },
  });

  // Check if current user liked
  React.useEffect(() => {
    if (user) {
      setLiked(likes.some(l => l.user_email === user.email));
    }
  }, [likes, user]);

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (content) =>
      base44.entities.PostComment.create({
        post_id: post.id,
        author_email: user.email,
        author_name: user.full_name,
        content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postComments'] });
      setCommentText('');
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      const existingLike = likes.find(l => l.user_email === user.email);
      if (existingLike) {
        await base44.entities.PostLike.delete(existingLike.id);
      } else {
        await base44.entities.PostLike.create({
          post_id: post.id,
          user_email: user.email,
          user_name: user.full_name,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postLikes'] });
    },
  });

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addCommentMutation.mutate(commentText);
  };

  const isOwner = post.member_email === user.email;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-neutral-950 border border-white/10 rounded-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-white font-light text-lg tracking-wide">{post.title}</h3>
          <p className="text-white text-xs mt-1">{post.member_name}</p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="text-white hover:text-white transition-colors"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={onDelete}
              className="text-red-500/70 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Images Gallery */}
      {post.images && post.images.length > 0 && (
        <div className="grid grid-cols-2 gap-1">
          {post.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`post-${idx}`}
              className="w-full h-32 object-cover"
            />
          ))}
        </div>
      )}

      {/* Description */}
      <div className="p-4 border-b border-white/10">
        <p className="text-white text-sm leading-relaxed">{post.description}</p>
      </div>

      {/* Links */}
      {post.links && post.links.length > 0 && (
        <div className="p-4 border-b border-white/10 space-y-2">
          {post.links.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-red-500 hover:text-red-600 text-sm underline transition-colors"
            >
              {link.text}
            </a>
          ))}
        </div>
      )}

      {/* Engagement */}
      <div className="p-4 flex items-center gap-6 border-b border-white/10">
        <button
          onClick={() => toggleLikeMutation.mutate()}
          className={`flex items-center gap-2 transition-colors ${
            liked ? 'text-red-500' : 'text-white hover:text-white'
          }`}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          <span className="text-xs">{likes.length}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-white hover:text-white transition-colors"
        >
          <MessageCircle size={18} />
          <span className="text-xs">{comments.length}</span>
        </button>
      </div>

      {/* Comments Section - Auto-expanded */}
      {(showComments || comments.length > 0) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="border-t border-white/10 p-4 space-y-4"
        >
          {/* Comment Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              placeholder="Add a comment..."
              className="flex-1 bg-neutral-800 border border-white/20 text-white text-xs px-3 py-2 rounded-sm placeholder:text-white focus:outline-none focus:border-white/40"
            />
            <button
              onClick={handleAddComment}
              disabled={addCommentMutation.isPending || !commentText.trim()}
              className="bg-red-600 text-white px-3 py-2 rounded-sm hover:bg-red-700 transition-colors text-xs disabled:opacity-50"
            >
              Post
            </button>
          </div>

          {/* Comments List */}
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-neutral-900 rounded-sm p-3">
                <p className="text-white/80 text-xs font-light">
                  <span className="font-semibold">{comment.author_name}</span>
                </p>
                <p className="text-white text-xs mt-1">{comment.content}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}