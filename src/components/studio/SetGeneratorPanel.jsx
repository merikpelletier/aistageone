import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles, Camera, Download, Bookmark, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { base44 } from '@/api/base44Client';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import SaveToVaultModal from '@/components