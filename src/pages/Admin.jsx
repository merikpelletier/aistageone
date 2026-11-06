import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  Film,
  Handshake,
  ImagePlus,
  Inbox,
  Library,
  LogOut,
  Menu,
  Megaphone,
  MessageSquare,
  MonitorCog,
  Palette,
  Presentation,
  Settings,
  ShoppingBag,
  Star,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import AdminModels from '@/components/admin/AdminModels';
import AdminPromptLibrary from '@/components/admin/AdminPromptLibrary';
import AdminPromptResolver from '@/components/admin/AdminPromptResolver';
import AdminAIPilots from '@/components/admin/AdminAIPilots';
import AdminFinance from '@/components/admin/AdminFinance';
import AdminVideoBilling from '@/components/admin/AdminVideoBilling';
import AdminPublicationEconomics from '@/components/admin/AdminPublicationEconomics';
import AdminOloInventory from '@/components/admin/AdminOloInventory';
import AdminPagesTools from '@/components/admin/AdminPagesTools';
import AdminDossiers from '@/components/admin/AdminDossiers';
import AdminSalons from '@/components/admin/AdminSalons';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminAIMembers from '@/components/admin/AdminAIMembers';
import AdminAIMemberMessages from '@/components/admin/AdminAIMemberMessages';
import AdminProducts from '@/components/admin/AdminProducts';
import AdminMerchantPromotions from '@/components/admin/AdminMerchantPromotions';
import AdminContent from '@/components/admin/AdminContent';
import AdminMessages from '@/components/admin/AdminMessages';
import AdminPromos from '@/components/admin/AdminPromos';
import AdminQuiz from '@/components/admin/AdminQuiz';
import AdminMemberships from '@/components/admin/AdminMemberships';
import AdminSubmissions from '@/components/admin/AdminSubmissions';
import AdminSponsors from '@/components/admin/AdminSponsors';
import AdminPromoMessages from '@/components/admin/AdminPromoMessages';
import AdminAgentConfig from '@/components/admin/AdminAgentConfig';
import AdminKnowledgeBase from '@/components/admin/AdminKnowledgeBase';
import AdminSketchTemplates from '@/components/admin/AdminSketchTemplates';
import AdminStyleReferences from '@/components/admin/AdminStyleReferences';
import AdminPitchDecks from '@/components/admin/AdminPitchDecks';
import AdminProductPlacements from '@/components/admin/AdminProductPlacements';
import Admin3DLibrary from '@/components/admin/Admin3DLibrary';
import AdminPrelaunch from '@/components/admin/AdminPrelaunch';
import AdminSetDesignerImages from '@/components/admin/AdminSetDesignerImages';
import AdminAnalytics from '@/components/admin/AdminAnalytics';

const groups = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    items: [
      ['analytics', 'Analytics', BarChart3, <AdminAnalytics />],
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: BookOpen,
    items: [
      ['dossiers', 'Dossiers', BookOpen, <AdminDossiers />],
      ['content', 'Content', FileText, <AdminContent />],
      ['submissions', 'Submissions', BookOpen, <AdminSubmissions />],
      ['sketch-templates', 'Sketches', Film, <AdminSketchTemplates />],
      ['pitch-decks', 'Pitch Decks', Presentation, <AdminPitchDecks />],
    ],
  },
  {
    id: 'members',
    label: 'Members',
    icon: Users,
    items: [
      ['users', 'Users', Users, <AdminUsers />],
      ['ai-members', 'AI Members', Bot, <AdminAIMembers />],
      ['ai-member-inbox', 'AI Inbox', Inbox, <AdminAIMemberMessages />],
      ['salons', 'Chat Rooms', MessageSquare, <AdminSalons />],
      ['messages', 'Messages', MessageSquare, <AdminMessages />],
      ['memberships', 'Memberships', Star, <AdminMemberships />],
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    icon: ShoppingBag,
    items: [
      ['products', 'Shop', ShoppingBag, <AdminProducts />],
      ['merchant-promotions', 'Merchant Promos', ShoppingBag, <AdminMerchantPromotions />],
      ['olo-inventory', 'OLOSHOP Inventory', Boxes, <AdminOloInventory />],
      ['product-placements', 'Product Placement', Megaphone, <AdminProductPlacements />],
      ['sponsors', 'Sponsors', Handshake, <AdminSponsors />],
      ['promo-messages', 'Promo Messages', Megaphone, <AdminPromoMessages />],
    ],
  },
  {
    id: 'studio-ai',
    label: 'Studio & AI',
    icon: MonitorCog,
    items: [
      ['pages-tools', 'Pages & Tools', MonitorCog, <AdminPagesTools />],
      ['set-designer-images', 'Set Designer Images', ImagePlus, <AdminSetDesignerImages />],
      ['style-references', 'Style References', Palette, <AdminStyleReferences />],
      ['ai-pilots', 'AI Pilots', Presentation, <AdminAIPilots />],
      ['prompt-library', 'Prompt Library', Library, <AdminPromptLibrary />],
      ['prompt-routing', 'Prompt Routing', Brain, <AdminPromptResolver />],
      ['ai-models', 'AI Models', Brain, <AdminModels />],
      ['studio-3d-library', '3D Library', Boxes, <Admin3DLibrary />],
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: WalletCards,
    items: [
      ['finance-transactions', 'Transactions', WalletCards, <AdminFinance section="transactions" />],
      ['finance-costs', 'AI Costs', WalletCards, <AdminFinance section="costs" />],
      ['video-billing', 'Video Billing', WalletCards, <AdminVideoBilling />],
      ['publication-economics', 'Publication Economics', BarChart3, <AdminPublicationEconomics />],
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    icon: Settings,
    items: [
      ['prelaunch', 'Pre-launch', Users, <AdminPrelaunch />],
      ['promos', 'Promos', Megaphone, <AdminPromos />],
      ['quiz', 'Quiz', Brain, <AdminQuiz />],
      ['agent', 'Agent', Bot, <AdminAgentConfig />],
      ['knowledge', 'Knowledge', Library, <AdminKnowledgeBase />],
    ],
  },
];

function Navigation({ activeTab, onSelect }) {
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(groups.map(group => [group.id, true]))
  );

  const toggleGroup = (groupId) => {
    setOpenGroups(current => ({ ...current, [groupId]: !current[groupId] }));
  };

  return (
    <nav className="h-full overflow-y-auto px-3 py-4">
      <div className="space-y-2">
        {groups.map(group => {
          const GroupIcon = group.icon;
          const isOpen = openGroups[group.id];
          const hasActiveItem = group.items.some(([value]) => value === activeTab);

          return (
            <div key={group.id} className="border border-white/10 bg-neutral-950">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left ${hasActiveItem ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <GroupIcon size={17} className="text-white/70 flex-shrink-0" />
                  <span className="text-white text-xs uppercase tracking-[0.16em] truncate">{group.label}</span>
                </span>
                {isOpen ? <ChevronDown size={15} className="text-white/45" /> : <ChevronRight size={15} className="text-white/45" />}
              </button>

              {isOpen && (
                <div className="border-t border-white/10 p-2 space-y-1">
                  {group.items.map(([value, label, Icon]) => {
                    const active = value === activeTab;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onSelect(value)}
                        className={`w-full min-h-11 flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${active ? 'bg-white text-black' : 'text-white/75 hover:text-white hover:bg-white/[0.06]'}`}
                      >
                        <Icon size={16} className="flex-shrink-0" />
                        <span className="text-sm truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin, logout } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const activeEntry = useMemo(() => {
    for (const group of groups) {
      const item = group.items.find(([value]) => value === activeTab);
      if (item) return { group: group.label, item };
    }
    return { group: 'Dashboard', item: groups[0].items[0] };
  }, [activeTab]);

  const selectTab = (value) => {
    setActiveTab(value);
    setMobileNavOpen(false);
  };

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

  const [, activeLabel, , activeContent] = activeEntry.item;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-3 md:px-5 sticky top-0 z-40 bg-black">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden w-10 h-10 flex items-center justify-center border border-white/15 hover:bg-white/5"
            aria-label="Open admin navigation"
          >
            <Menu size={20} />
          </button>
          <Link to={createPageUrl('Plus')} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white" aria-label="Back">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 truncate">{activeEntry.group}</div>
            <h1 className="text-base md:text-lg font-light tracking-wide truncate">{activeLabel}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <span className="hidden sm:block text-white/55 text-xs truncate max-w-48">{user?.email}</span>
          <button onClick={logout} className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white" aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden lg:block w-72 xl:w-80 border-r border-white/10 bg-neutral-950/70 flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]">
          <Navigation activeTab={activeTab} onSelect={selectTab} />
        </aside>

        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
          <div className="w-full max-w-[1800px] mx-auto">
            {activeContent}
          </div>
        </main>
      </div>

      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black">
          <div className="h-14 border-b border-white/10 flex items-center justify-between px-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">AI STAGE ONE</div>
              <div className="text-base font-light tracking-wide">Admin</div>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="w-11 h-11 flex items-center justify-center border border-white/15"
              aria-label="Close admin navigation"
            >
              <X size={20} />
            </button>
          </div>
          <div className="h-[calc(100vh-3.5rem)]">
            <Navigation activeTab={activeTab} onSelect={selectTab} />
          </div>
        </div>
      )}
    </div>
  );
}
