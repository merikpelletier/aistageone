import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, Clock3, Eye, Image as ImageIcon, Loader2, MapPin,
  MessageSquareText, Mic2, PanelLeft, Play, Save, Sparkles, Store, Type, Upload,
  User