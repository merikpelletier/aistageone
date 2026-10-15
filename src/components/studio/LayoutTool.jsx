import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Image as ImageIcon, LayoutTemplate, Loader2, Save, Sparkles, Store, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import AtelierAssetPicker from '@/components/atelier/AtelierAssetPicker';
import Catalog from '@/pages/Catalog';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions