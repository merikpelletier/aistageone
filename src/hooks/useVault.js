import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useVault() {
  const [userEmail, setUserEmail] = useState(null);
  const [savedUrls, setSavedUrls] = useState(new Set());

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        if (u?.email) {
          setUserEmail(u.email);
          base44.entities.VaultAsset.filter({ user_email: u.email }, '-created_date', 100)
            .then(assets => setSavedUrls(new Set(assets.map(a => a.url))))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const saveToVault = async (url, mediaType = 'image', dossierId = '', category = 'reference') => {
    if (!userEmail) { base44.auth.redirectToLogin(window.location.href); return; }
    if (savedUrls.has(url)) return;
    setSavedUrls(prev => new Set([...prev, url]));
    await base44.entities.VaultAsset.create({
      user_email: userEmail,
      url,
      media_type: mediaType,
      asset_category: category,
      source_dossier_id: dossierId,
    });
  };

  return { userEmail, savedUrls, saveToVault };
}