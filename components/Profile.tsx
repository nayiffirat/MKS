
import React, { useState, useEffect } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/db';
import { User, Save, Briefcase, Phone, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileProps {
    onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileProps> = ({ onBack }) => {
  const { userProfile, updateUserProfile, t } = useAppViewModel();
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState<UserProfile>(userProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if context updates externally
  useEffect(() => {
    // If phone is empty, default to +90
    let initialData = { ...userProfile };
    if (!initialData.phoneNumber) {
        initialData.phoneNumber = '+90 ';
    }
    setFormData(initialData);
  }, [userProfile]);

  const handleChange = (field: keyof UserProfile, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (error) setError(null);
  };

  const handlePhoneChange = (value: string) => {
      if (value.length < 4) {
          setFormData(prev => ({ ...prev, phoneNumber: '+90 ' }));
      } else if (!value.startsWith('+90')) {
          setFormData(prev => ({ ...prev, phoneNumber: '+90 ' + value.replace(/^\+90\s*/, '') }));
      } else {
          setFormData(prev => ({ ...prev, phoneNumber: value }));
      }
      if (error) setError(null);
  };

  const validatePhone = (phone: string) => {
      // Basic check: starts with +90 and has digits
      if (!phone || phone.trim() === '+90') return true; // Allow empty-ish
      const clean = phone.replace(/\D/g, '');
      // 90 5XX XXX XX XX -> ~12 digits
      return clean.length >= 12;
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (formData.phoneNumber && !validatePhone(formData.phoneNumber)) {
          setError(t('profile.error.phone'));
          return;
      }

      setIsSaving(true);
      setError(null);

      try {
          // Update Global State & Local Storage (includes Firebase Sync)
          await updateUserProfile(formData);

          setIsSaving(false);
          setShowSuccess(true);
          
          // Hide success message after 3 seconds
          setTimeout(() => setShowSuccess(false), 3000);
      } catch (err) {
          console.error("Failed to save profile:", err);
          setError(t('profile.error.save'));
          setIsSaving(false);
      }
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300 max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center mb-6 pt-2">
            <button onClick={onBack} className="mr-3 text-stone-400 hover:text-stone-200">
                <ArrowLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold text-stone-100">{t('profile.title')}</h2>
        </div>

        {/* Profile Card Preview */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-stone-900 rounded-3xl p-6 border border-white/5 mb-8 flex items-center space-x-5 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <User size={120} />
             </div>
             
             <div className="w-20 h-20 bg-stone-800 rounded-full flex items-center justify-center border-4 border-emerald-500/20 text-emerald-500 shadow-xl z-10">
                 <span className="text-2xl font-bold">{formData.fullName ? formData.fullName.charAt(0).toUpperCase() : 'U'}</span>
             </div>
             
             <div className="z-10">
                 <h3 className="text-xl font-bold text-white leading-tight flex items-center gap-2">
                    {formData.fullName || t('profile.unnamed')}
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-orange-500/10 border-orange-500/30 text-orange-400">
                        {t('login.dealer').toUpperCase()}
                    </span>
                 </h3>
                 <p className="text-emerald-400 text-sm font-medium">{formData.title || t('profile.noTitle')}</p>
                 <p className="text-stone-500 text-xs mt-1">{formData.companyName}</p>
             </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
            
            {/* Personal Info Section */}
            <div className="bg-stone-900/60 backdrop-blur rounded-2xl p-6 border border-white/5 shadow-sm">
                <h3 className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center">
                    <User size={14} className="mr-2" /> {t('profile.personalInfo')}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('profile.fullName')}</label>
                        <input 
                            type="text" 
                            value={formData.fullName}
                            onChange={(e) => handleChange('fullName', e.target.value)}
                            placeholder={t('profile.fullName.placeholder')}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('profile.phone')}</label>
                        <input 
                            type="tel" 
                            value={formData.phoneNumber}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="+90 5xxxxxxxxx"
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-stone-600"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">{t('profile.phone.desc')}</p>
                    </div>
                </div>
            </div>

            {/* Company Info Section */}
            <div className="bg-stone-900/60 backdrop-blur rounded-2xl p-6 border border-white/5 shadow-sm">
                <h3 className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center">
                    <Briefcase size={14} className="mr-2" /> {t('profile.corporateInfo')}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('profile.companyName')}</label>
                        <input 
                            type="text" 
                            value={formData.companyName}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                            placeholder={t('profile.companyName.placeholder')}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('profile.jobTitle')}</label>
                        <input 
                            type="text" 
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder={t('profile.jobTitle.placeholder')}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm font-medium flex items-center">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>
                    {error}
                </div>
            )}

            <button 
                type="submit" 
                disabled={isSaving}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center transition-all active:scale-[0.98] ${
                    isSaving 
                    ? 'bg-stone-800 text-stone-500 cursor-not-allowed' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/30'
                }`}
            >
                {isSaving ? (
                    <>
                        <Loader2 className="animate-spin mr-2" size={20} /> {t('profile.saving')}
                    </>
                ) : (
                    <>
                        <Save className="mr-2" size={20} /> {t('profile.save')}
                    </>
                )}
            </button>
        </form>

        {/* Success Toast */}
        {showSuccess && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-800/90 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur flex items-center animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
                <CheckCircle size={18} className="mr-2" />
                <span className="font-bold text-sm">{t('profile.success')}</span>
            </div>
        )}

    </div>
  );
};
