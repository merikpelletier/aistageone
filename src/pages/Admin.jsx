import AdminModels from '@/components/admin/AdminModels';
import AdminFinance from '@/components/admin/AdminFinance';
import AdminOloInventory from '@/components/admin/AdminOloInventory';
import AdminPagesTools from '@/components/admin/AdminPagesTools';
import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  MessageSquare,
  Users,
  ShoppingBag,
  FileText,
  Settings,
  LogOut,
  ArrowLeft,
  Megaphone,
  Brain,
  Tag,
  Library,
  Star,
  Handshake,
  Bot,
  Film,
  Palette,
  Presentation,
  Boxes,
  MonitorCog
} from 'lucide-react';

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
import AdminMembershipPricing from '@/components/admin/AdminMembershipPricing';
import AdminStoryThemes from '@/components/admin/AdminStoryThemes';
import AdminSketchTemplates from '@/components/admin/AdminSketchTemplates';
import AdminStyleReferences from '@/components/admin/AdminStyleReferences';
import AdminProductionKits from '@/components/admin/AdminProductionKits';
import AdminPitchDecks from '@/components/admin/AdminPitchDecks';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('dossiers');
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin, logout } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const handleLogin = () => {
    navigateToLogin();
  };

  const handleLogout = () => {
    logout();
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-white text-3xl font-extralight tracking-widest mb-2">
            ADMINISTRATION
          </h1>
          <p className="text-white text-sm mb-8">Admin access only</p>
          
          <Button
            onClick={handleLogin}
            className="bg-white text-black hover:bg-white/90 font-light tracking-widest"
          >
            LOG IN
          </Button>
          
          <Link
            to={createPageUrl('Plus')}
            className="block mt-8 text-white text-sm hover:text-white transition-colors"
          >
            Back
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Plus')} className="text-white hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-white text-xl font-extralight tracking-widest">ADMIN</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white text-sm">{user?.email}</span>
          <button onClick={handleLogout} className="text-white hover:text-white">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="w-full bg-neutral-900 border border-white/20 rounded-sm h-auto flex-wrap text-white">
          <TabsTrigger
            value="pages-tools"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <MonitorCog size={14} className="mr-2" />
            Pages & Tools
          </TabsTrigger>
          <TabsTrigger
            value="dossiers"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <BookOpen size={14} className="mr-2" />
            Dossiers
          </TabsTrigger>
          <TabsTrigger
            value="salons"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <MessageSquare size={14} className="mr-2" />
            Chat Rooms
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Users size={14} className="mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger
            value="products"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <ShoppingBag size={14} className="mr-2" />
            Shop
          </TabsTrigger>
          <TabsTrigger
            value="olo-inventory"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Boxes size={14} className="mr-2" />
            OLOSHOP Inventory
          </TabsTrigger>
          <TabsTrigger
            value="content"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <FileText size={14} className="mr-2" />
            Content
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Settings size={14} className="mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger
            value="promos"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Megaphone size={14} className="mr-2" />
            Promos
          </TabsTrigger>
          <TabsTrigger
            value="quiz"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Brain size={14} className="mr-2" />
            Quiz
          </TabsTrigger>
          <TabsTrigger
            value="placeholders"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Users size={14} className="mr-2" />
            Icons
          </TabsTrigger>
          <TabsTrigger
            value="labels"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Tag size={14} className="mr-2" />
            Labels
          </TabsTrigger>
          <TabsTrigger
            value="memberships"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Star size={14} className="mr-2" />
            Memberships
          </TabsTrigger>
          <TabsTrigger
            value="submissions"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <BookOpen size={14} className="mr-2" />
            Submissions
          </TabsTrigger>
          <TabsTrigger
            value="sponsors"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Handshake size={14} className="mr-2" />
            Sponsors
          </TabsTrigger>
          <TabsTrigger
            value="promo-messages"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Megaphone size={14} className="mr-2" />
            Promo Msgs
          </TabsTrigger>
          <TabsTrigger
            value="agent"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Bot size={14} className="mr-2" />
            Agent
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Library size={14} className="mr-2" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger
            value="character-types"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Users size={14} className="mr-2" />
            Char. Types
          </TabsTrigger>
          <TabsTrigger
            value="story-themes"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <BookOpen size={14} className="mr-2" />
            Story Themes
          </TabsTrigger>
          <TabsTrigger
            value="sketch-templates"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Film size={14} className="mr-2" />
            Sketches
          </TabsTrigger>
          <TabsTrigger
            value="style-references"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Palette size={14} className="mr-2" />
            Style Refs
          </TabsTrigger>
          <TabsTrigger
            value="production-kits"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Film size={14} className="mr-2" />
            Prod Kits
          </TabsTrigger>
          <TabsTrigger
            value="pitch-decks"
            className="flex-1 py-3 text-xs tracking-wide text-white hover:text-white data-[state=active]:bg-white data-[state=active]:text-black rounded-sm"
          >
            <Presentation size={14} className="mr-2" />
            Pitch Decks
          </TabsTrigger>

        <TabsTrigger value="finance-transactions" className="data-[state=active]:bg-white data-[state=active]:text-black">Transactions</TabsTrigger><TabsTrigger value="finance-costs" className="data-[state=active]:bg-white data-[state=active]:text-black">Coûts IA</TabsTrigger><TabsTrigger value="ai-models">Modèles IA</TabsTrigger></TabsList>

        <TabsContent value="pages-tools" className="mt-6">
          <AdminPagesTools />
        </TabsContent>
        <TabsContent value="dossiers" className="mt-6">
          <AdminDossiers />
        </TabsContent>
        <TabsContent value="salons" className="mt-6">
          <AdminSalons />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <AdminUsers />
        </TabsContent>
        <TabsContent value="products" className="mt-6">
          <AdminProducts />
        </TabsContent>
        <TabsContent value="olo-inventory" className="mt-6">
          <AdminOloInventory />
        </TabsContent>
        <TabsContent value="content" className="mt-6">
          <AdminContent />
        </TabsContent>
        <TabsContent value="messages" className="mt-6">
          <AdminMessages />
        </TabsContent>
        <TabsContent value="promos" className="mt-6">
          <AdminPromos />
        </TabsContent>
        <TabsContent value="quiz" className="mt-6">
          <AdminQuiz />
        </TabsContent>
        <TabsContent value="placeholders" className="mt-6">
          <AdminPlaceholders />
        </TabsContent>
        <TabsContent value="labels" className="mt-6">
          <AdminLabels />
        </TabsContent>
        <TabsContent value="memberships" className="mt-6">
          <AdminMemberships />
        </TabsContent>
        <TabsContent value="submissions" className="mt-6">
          <AdminSubmissions />
        </TabsContent>
        <TabsContent value="sponsors" className="mt-6">
          <AdminSponsors />
        </TabsContent>
        <TabsContent value="promo-messages" className="mt-6">
          <AdminPromoMessages />
        </TabsContent>
        <TabsContent value="agent" className="mt-6">
          <AdminAgentConfig />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-6">
          <AdminKnowledgeBase />
        </TabsContent>
        <TabsContent value="character-types" className="mt-6">
          <AdminCharacterTypes />
        </TabsContent>
        <TabsContent value="story-themes" className="mt-6">
          <AdminStoryThemes />
        </TabsContent>
        <TabsContent value="sketch-templates" className="mt-6">
          <AdminSketchTemplates />
        </TabsContent>
        <TabsContent value="style-references" className="mt-6">
          <AdminStyleReferences />
        </TabsContent>
        <TabsContent value="production-kits" className="mt-6">
          <AdminProductionKits />
        </TabsContent>
        <TabsContent value="pitch-decks" className="mt-6">
          <AdminPitchDecks />
        </TabsContent>
      <TabsContent value="finance-transactions" className="mt-6"><AdminFinance section="transactions" /></TabsContent><TabsContent value="finance-costs" className="mt-6"><AdminFinance section="costs" /></TabsContent><TabsContent value="ai-models" className="mt-6"><AdminModels /></TabsContent></Tabs>
    </div>
  );
}
