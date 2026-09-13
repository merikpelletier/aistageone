import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function AgeGate({ onAccess }) {
  const [step, setStep] = useState(1);
  const [birthDate, setBirthDate] = useState({ day: '', month: '', year: '' });
  const [consents, setConsents] = useState({
    adult: false,
    gayContent: false,
    consenting: false
  });
  const [error, setError] = useState('');

  const validateAge = () => {
    const { day, month, year } = birthDate;
    if (!day || !month || !year) {
      setError('Veuillez entrer votre date de naissance complète');
      return false;
    }
    
    const birthDateObj = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    
    const isOldEnough = age > 18 || (age === 18 && monthDiff >= 0);
    
    if (!isOldEnough) {
      setError('Vous devez avoir 18 ans ou plus pour accéder à ce site');
      return false;
    }
    
    return true;
  };

  const handleAgeSubmit = () => {
    if (validateAge()) {
      setStep(2);
      setError('');
    }
  };

  const handleConsentsSubmit = () => {
    if (!consents.adult || !consents.gayContent || !consents.consenting) {
      setError('Vous devez accepter toutes les conditions pour continuer');
      return;
    }
    onAccess();
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md px-6"
          >
            <div className="text-center mb-12">
              <h1 className="text-white text-4xl font-extralight tracking-widest mb-2">
                LE COCHON
              </h1>
              <h2 className="text-white text-4xl font-extralight tracking-widest">
                SAVANT
              </h2>
            </div>

            <div className="space-y-8">
              <p className="text-white text-center text-sm tracking-wide">
                Confirmez votre date de naissance
              </p>
              
              <div className="flex gap-4 justify-center">
                <Input
                  type="text"
                  placeholder="JJ"
                  maxLength={2}
                  value={birthDate.day}
                  onChange={(e) => setBirthDate({ ...birthDate, day: e.target.value.replace(/\D/g, '') })}
                  className="w-16 bg-transparent border-white/30 text-white text-center placeholder:text-white"
                />
                <Input
                  type="text"
                  placeholder="MM"
                  maxLength={2}
                  value={birthDate.month}
                  onChange={(e) => setBirthDate({ ...birthDate, month: e.target.value.replace(/\D/g, '') })}
                  className="w-16 bg-transparent border-white/30 text-white text-center placeholder:text-white"
                />
                <Input
                  type="text"
                  placeholder="AAAA"
                  maxLength={4}
                  value={birthDate.year}
                  onChange={(e) => setBirthDate({ ...birthDate, year: e.target.value.replace(/\D/g, '') })}
                  className="w-24 bg-transparent border-white/30 text-white text-center placeholder:text-white"
                />
              </div>

              {error && (
                <p className="text-red-500 text-center text-sm">{error}</p>
              )}

              <Button
                onClick={handleAgeSubmit}
                className="w-full bg-white text-black hover:bg-white/90 font-light tracking-widest"
              >
                CONTINUER
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md px-6"
          >
            <div className="text-center mb-12">
              <h1 className="text-white text-3xl font-extralight tracking-widest mb-4">
                CONSENTEMENT
              </h1>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <Checkbox
                  id="adult"
                  checked={consents.adult}
                  onCheckedChange={(checked) => setConsents({ ...consents, adult: checked })}
                  className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-black mt-1"
                />
                <Label htmlFor="adult" className="text-white/80 text-sm font-light leading-relaxed cursor-pointer">
                  Je confirme avoir 18 ans ou plus et être un homme adulte.
                </Label>
              </div>

              <div className="flex items-start space-x-4">
                <Checkbox
                  id="gayContent"
                  checked={consents.gayContent}
                  onCheckedChange={(checked) => setConsents({ ...consents, gayContent: checked })}
                  className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-black mt-1"
                />
                <Label htmlFor="gayContent" className="text-white/80 text-sm font-light leading-relaxed cursor-pointer">
                  Je comprends que cette plateforme propose du contenu à orientation gay réservé aux adultes.
                </Label>
              </div>

              <div className="flex items-start space-x-4">
                <Checkbox
                  id="consenting"
                  checked={consents.consenting}
                  onCheckedChange={(checked) => setConsents({ ...consents, consenting: checked })}
                  className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-black mt-1"
                />
                <Label htmlFor="consenting" className="text-white/80 text-sm font-light leading-relaxed cursor-pointer">
                  Je reconnais entrer dans un espace réservé aux adultes consentants.
                </Label>
              </div>

              {error && (
                <p className="text-red-500 text-center text-sm">{error}</p>
              )}

              <Button
                onClick={handleConsentsSubmit}
                className="w-full bg-white text-black hover:bg-white/90 font-light tracking-widest mt-8"
              >
                ENTRER
              </Button>

              <button
                onClick={() => setStep(1)}
                className="w-full text-white text-sm hover:text-white transition-colors"
              >
                Retour
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}