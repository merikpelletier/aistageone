import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Link2, Loader2, Plug, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', capabilities: ['Text', 'Image', 'Speech', 'Transcription'] },
  { id: 'google', name: 'Google', capabilities: ['Text', 'Image', 'Video', 'Audio'] },
  { id: 'anthropic', name: 'Anthropic', capabilities: ['Text', 'Vision'] },
  { id: 'xai', name: 'xAI', capabilities: ['Text', 'Vision', 'Image