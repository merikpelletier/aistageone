import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Bookmark, Check, Loader2, ShoppingBag, Upload, Sparkles, ImagePlus, Camera, Sun, Moon, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer