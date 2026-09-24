import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Download, Copy, CheckCircle2 } from 'lucide-react';

export default function CartExport() {
  const [cart, setCart] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem('aistage_giftshop_cart') || '[]');
    setCart(stored);
  }, []);

  const exportToText = () => {
    let text = '=== COMMANDE ===\n\n';
    
    cart.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name}\n`;
      text += `   Prix: ${item.price}\n`;
      text += `   Quantité: ${item.quantity}\n`;
      
      if (item.options && Object.keys(item.options).length > 0) {
        text += '   Options:\n';
        Object.entries(item.options).forEach(([key, val]) => {
          text += `   - ${key}: ${val}\n`;
        });
      }
      text += '\n';
    });

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    text += `\nTotal: ${totalItems} article(s)`;
    
    return text;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportToText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsFile = () => {
    const text = exportToText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commande-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-black pb-20 pt-8 flex items-center justify-center">
        <p className="text-white">Panier vide</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 pt-8">
      <div className="px-6 mb-8">
        <h1 className="text-white text-3xl font-extralight tracking-widest">EXPORT COMMANDE</h1>
        <div className="w-12 h-0.5 bg-red-600 mt-4" />
      </div>

      <div className="px-6 space-y-4">
        <div className="bg-neutral-950 border border-white/10 rounded-sm p-6">
          <pre className="text-white text-sm whitespace-pre-wrap font-mono">
            {exportToText()}
          </pre>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={copyToClipboard}
            className="flex-1 bg-white text-black hover:bg-white/90 font-light tracking-wide"
          >
            {copied ? (
              <>
                <CheckCircle2 size={16} className="mr-2" />
                Copié !
              </>
            ) : (
              <>
                <Copy size={16} className="mr-2" />
                Copier
              </>
            )}
          </Button>
          <Button
            onClick={downloadAsFile}
            variant="outline"
            className="flex-1 border-white/20 text-white"
          >
            <Download size={16} className="mr-2" />
            Télécharger
          </Button>
        </div>
      </div>
    </div>
  );
}