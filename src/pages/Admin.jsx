import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Boxes,
  Brain,
  FileText,
  Film,
  Handshake,
  ImagePlus,
  Library,
  LogOut,
  Megaphone,
  MessageSquare,
  MonitorCog,
  Palette,
  Presentation,
  Settings,
  ShoppingBag,
  Star,
  Tag,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminModels from '@/components/admin/AdminModels';
import AdminFinance from '@/components/admin/AdminFinance';
import AdminOloInventory from '@/components/admin/AdminOloInventory';
import AdminPagesTools from '@/components/admin/AdminPagesTools';
import AdminDossiers from '@/components/admin/AdminDossiers';
import AdminSalons from '@/components/admin/AdminSalons';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminProducts from '@/components/admin/AdminProducts';
import AdminContent from '@/components/admin/AdminContent';
import AdminMessages from '@/components/admin/AdminMessages';
import AdminPromos from '@/components/admin/AdminPromos';
import AdminQuiz from '@/components/admin/AdminQuiz';
import AdminPlaceholders from '@/components/admin/AdminPlaceholders';
import AdminLabels from '@/components/admin/AdminLabels';
import AdminMemberships from '@/components/admin/AdminMemberships';
import AdminSubmissions from '@/components/admin/AdminSubmissions';
import AdminSponsors from '@/components/admin/AdminSponsors';
import AdminPromoMessages from '@/components/admin/AdminPromoMessages';
import AdminAgentConfig from '@/components/admin/AdminAgentConfig';
import AdminKnowledgeBase from '@/components/admin/AdminKnowledgeBase';
import AdminCharacterTypes from '@/components/admin/AdminCharacterTypes';
import AdminStoryThemes from '@/components/admin/AdminStoryThemes';
import AdminSketchTemplates from '@/components/admin/AdminSketchTemplates';
import AdminStyleReferences from '@/components/admin/AdminStyleReferences';
import AdminProductionKits from '@/components/admin/AdminProductionKits';
import AdminPitchDecks from '@/components/admin/AdminPitchDecks';
import AdminProductPlacements from '@/components/admin/AdminProductPlacements';
import Admin3DLibrary from '@/components/admin/Admin3DLibrary';
import AdminPrelaunch from '@/components/admin/AdminPrelaunch';
import AdminSetDesignerImages from '@/components/admin/AdminSetDesignerImages';

const triggerClass = 'flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm';

const tabs = [
  ['prelaunch', 'Pre-launch', Users, <AdminPrelaunch />],
  ['pages-tools', 'Pages & Tools', MonitorCog, <AdminPagesTools />],
  ['set-designer-images', 'Set Designer Images', ImagePlus, <AdminSetDesignerImages />],
  ['dossiers', 'Dossiers', BookOpen, <AdminDossiers />],
  ['salons', 'Chat Rooms', MessageSquare, <AdminSalons />],
  ['users', 'Users', Users, <AdminUsers />],
  ['products', 'Shop', ShoppingBag, <AdminProducts />],
  ['olo-inventory', 'OLOSHOP Inventory', Boxes, <AdminOloInventory />],
  ['content', 'Content', FileText, <AdminContent />],
  ['messages', 'Messages', Settings, <AdminMessages />],
  ['promos', 'Promos', Megaphone, <AdminPromos />],
  ['quiz', 'Quiz', Brain, <AdminQuiz />],
  ['placeholders', 'Icons', Users, <AdminPlaceholders />],
  ['labels', 'Labels', Tag, <AdminLabels />],
  ['memberships', 'Memberships', Star, <AdminMemberships />],
  ['submissions', 'Submissions', BookOpen, <AdminSubmissions />],
  ['product-placements', 'Product Placement', Megaphone, <AdminProductPlacements />],
  ['sponsors', 'Sponsors', Handshake, <AdminSponsors />],
  ['promo-messages', 'Promo Msgs', Megaphone, <AdminPromoMessages />],
  ['agent', 'Agent', Bot, <AdminAgentConfig />],
  ['knowledge', 'Knowledge', Library, <AdminKnowledgeBase />],
  ['character-types', 'Char. Types', Users, <AdminCharacterTypes />],
  ['story-themes', 'Story Themes', BookOpen, <AdminStoryThemes />],
  ['sketch-templates', 'Sketches', Film, <AdminSketchTemplates />],
  ['style-references', 'Style Refs', Palette, <AdminStyleReferences />],
  ['production-kits', 'Prod Kits', Film, <AdminProductionKits />],
  ['pitch-decks', 'Pitch Decks', Presentation, <AdminPitchDecks />],
  ['finance-transactions', 'Transactions', Settings, <AdminFinance section="transactions" />],
  ['finance-costs', 'Coûts IA', Settings, <AdminFinance section="costs" />],
  ['ai-models', 'Modèles IA', Brain, <AdminModels />],
  ['studio-3d-library', '3D Library', Boxes, <Admin3DLibrary />],
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState('dossiers');
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin, logout } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-white text-3xl font-extralight tracking-widest mb-2">ADMINISTRATION</h1>
          <p className="text-white text-sm mb-8">Admin access only</p>
          <Button onClick={navigateToLogin} className="bg-white text-black hover:bg-white/90 font-light tracking-widest">LOG IN</Button>
          <Link to={createPageUrl('Plus')} className="block mt-8 text-white text-sm hover:text-white transition-colors">Back</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Plus')} className="text-white hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-white text-xl font-extralight tracking-widest">ADMIN</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white text-sm">{user?.email}</span>
          <button onClick={logout} className="text-white hover:text-white"><LogOut size={18} /></button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="w-full bg-neutral-900 border border-white/20 rounded-sm h-auto flex-wrap text-white">
          {tabs.map(([value, label, Icon]) => (
            <TabsTrigger key={value} value={value} className={triggerClass}>
              <Icon size={14} className="mr-2" />{label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(([value, , , content]) => (
          <TabsContent key={value} value={value} className="mt-6">{content}</TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
