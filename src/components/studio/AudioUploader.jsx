import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, Volume2, Loader2, FileAudio, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function AudioUploader({ onUploadComplete, onClose }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const togglePlayback = () => {
    if (!previewUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file: selectedFile });
      onUploadComplete(result.file_url);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsPlaying(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-yellow-400 rounded-3xl p-8 max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-black text-xl font-bold">Upload Audio</h3>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
            <X size={20} className="text-black" />
          </button>
        </div>

        {/* Drop Zone */}
        {!selectedFile ? (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="bg-black rounded-2xl p-12 mb-6 text-center cursor-pointer hover:bg-black/90 transition-colors"
            onClick={() => document.getElementById('audio-input').click()}
          >
            <input
              id="audio-input"
              type="file"
              accept="audio/*"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
            />
            <div className="w-20 h-20 bg-yellow-400/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload size={40} className="text-yellow-400" />
            </div>
            <p className="text-white font-semibold mb-2">Drop audio file here</p>
            <p className="text-white text-sm">or click to browse</p>
            <p className="text-white text-xs mt-4">MP3, WAV, M4A, OGG, AAC</p>
          </div>
        ) : (
          <div className="bg-black rounded-2xl p-6 mb-6">
            {/* File Info */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-yellow-400/20 rounded-xl flex items-center justify-center">
                <FileAudio size={24} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{selectedFile.name}</p>
                <p className="text-white text-sm">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>

            {/* Audio Player */}
            <audio
              ref={audioRef}
              src={previewUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlayback}
                className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <Pause size={20} className="text-black" />
                ) : (
                  <Play size={20} className="text-black" />
                )}
              </button>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 w-0" />
              </div>
              <button
                onClick={handleReset}
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Upload Button */}
        {selectedFile && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-black hover:bg-black/90 text-yellow-400 font-bold py-4 rounded-2xl"
          >
            {isUploading ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={20} className="mr-2" />
                Upload Audio
              </>
            )}
          </Button>
        )}
      </motion.div>
    </div>
  );
}