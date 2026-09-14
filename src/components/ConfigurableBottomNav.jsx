import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clapperboard, Handshake, MessageCircle, MoreHorizontal, Settings, ShoppingCart, User, UsersRound, Wand2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const NAV_ITEMS = [
  { key: 'Index', labelKey: 'nav_magazine', label: 'Magazine', icon: Clapperboard },
  { key: 'Salons', labelKey: 'nav_salons', label: 'Salons', icon: MessageCircle },
  { key: 'Plus', labelKey: 'nav_plus', label: 'Plus', icon: MoreHorizontal },
  { key: 'Studio', label: 'Studio', icon: Wand2 },
  { key: 'MemberListing', label: 'Members', icon: UsersRound },
  { key: 'SponsorRequest', label: 'Sponsor', icon: Handshake },
  { key: 'MemberDashboard', label: 'Account', icon: User, account: true },
  { key: 'Admin', label: 'Admin', icon: Settings, adminOnly: true },
  { key: 'Cart', label: 'Cart', icon: ShoppingCart, cart: true },
];

export default function ConfigurableBottomNav({ settings = [] }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [labelOverrides, setLabelOverrides] = useState({});
  const isAdmin = user?.role === 'admin';
  const navSetting = settings.find((item) => item.surface_type === 'tool' && item.surface_key === 'bottom_navigation');
  const navBackground = navSetting?.look?.background_color || '#000000';
  const navText = navSetting?.look?.text_color || navSetting?.look?.foreground_color || '#ffffff';
  const navIcon = navSetting?.look?.icon_color || navSetting?.look?.foreground_color || '#ffffff';
  const navActive = navSetting?.look?.active_color || '#dc2626';
  const navBorder = navSetting?.look?.border_color || 'rgba(0,0,0,0.2)';

  useEffect(() => {
    const updateCartCount = () => {
      const cart = JSON.parse(sessionStorage.getItem('cochon_cart') || '[]');
      setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    };
    updateCartCount();
    const interval = setInterval(updateCartCount, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    base44.entities.AppLabel.list().then((labels) => {
      setLabelOverrides(Object.fromEntries(labels.map((item) => [item.key, item.value])));
    }).catch(() => {});
  }, []);

  const navItems = useMemo(() => NAV_ITEMS.map((item, defaultOrder) => {
    const setting = settings.find((candidate) => candidate.surface_type === 'page' && candidate.surface_key === item.key);
    return {
      ...item,
      label: setting?.label || labelOverrides[item.labelKey] || item.label,
      order: Number(setting?.configuration?.order ?? defaultOrder),
      visible: setting?.visible !== false && setting?.active !== false,
    };
  }).filter((item) => item.visible && (!item.adminOnly || isAdmin)).sort((a, b) => a.order - b.order), [isAdmin, labelOverrides, settings]);

  return <nav className="bottom-nav-safe fixed bottom-0 left-0 right-0 z-50 border-t shadow-lg" style={{ backgroundColor: navBackground, borderColor: navBorder }}>
    <div className="flex h-14 w-full items-center md:h-16">
      {navItems.map((item) => {
        const target = createPageUrl(item.key);
        const active = pathname === target || pathname === `/${item.key}`;
        const Icon = item.icon;
        const content = <>
          <div className="relative"><Icon size={20} style={{ color: navIcon }} />{item.cart && cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold leading-none text-white" style={{ backgroundColor: navActive }}>{cartCount}</span>}</div>
          <span className="hidden max-w-full truncate text-[10px] font-semibold tracking-wide md:block" style={{ color: navText }}>{item.account && !user ? 'LOG IN' : item.label}</span>
          {active && <motion.div layoutId="nav-indicator" className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ backgroundColor: navActive }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />}
        </>;
        const className = 'relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 md:h-16';
        if (item.account && !user) return <button key={item.key} onClick={() => base44.auth.redirectToLogin(window.location.href)} className={className}>{content}</button>;
        return <Link key={item.key} to={target} className={className}>{content}</Link>;
      })}
    </div>
  </nav>;
}
