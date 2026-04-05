
import React from 'react';
import { Type, User, ChevronRight, Briefcase, UserRound, Sun, Settings, RefreshCw, Globe } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { UIScale, Language } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { useState } from 'react';

interface SettingsProps {
    onNavigate: (view: any) => void;
}

export const SettingsScreen: React.FC<SettingsProps> = ({ onNavigate }) => {
  const { uiScale, setUiScale, userProfile, updateUserProfile, performManualTurnover, language, setLanguage, t } = useAppViewModel();
  const [isTurnoverModalOpen, setIsTurnoverModalOpen] = useState(false);

  const handleScaleChange = (scale: UIScale) => {
    setUiScale(scale);
  };

  return (
    <div className="pb-32 animate-in fade-in duration-300 px-4">
      
      {/* Profile Settings Section */}
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 mb-6 mt-4">
          <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-emerald-900/30 text-emerald-400 rounded-xl">
                  <User size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">{t('settings.account')}</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{t('settings.personal')}</p>
              </div>
          </div>

          <div 
            onClick={() => onNavigate('PROFILE')}
            className="flex items-center justify-between bg-stone-950/40 p-4 rounded-2xl border border-stone-800 cursor-pointer hover:border-emerald-500/50 hover:bg-stone-900 transition-all group"
          >
              <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center border-2 border-emerald-500/20 text-emerald-500 group-hover:border-emerald-500 transition-colors">
                      <span className="text-lg font-bold">{userProfile.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'U'}</span>
                  </div>
                  <div className="min-w-0">
                      <h4 className="font-bold text-stone-200 group-hover:text-emerald-400 transition-colors truncate">
                          {userProfile.fullName || t('settings.profile.create')}
                      </h4>
                      <p className="text-[10px] text-stone-500 font-bold uppercase truncate">
                          {userProfile.title || t('settings.profile.edit')}
                      </p>
                  </div>
              </div>
              <ChevronRight size={20} className="text-stone-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
      </div>

      {/* Accessibility / UI Size Settings */}
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 mb-6">
          <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-blue-900/30 text-blue-400 rounded-xl">
                  <Type size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">{t('nav.group.general')}</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{t('settings.language.desc')}</p>
              </div>
          </div>
          
          <div className="flex p-1 bg-stone-950/40 rounded-2xl border border-stone-800 mb-6">
              {(['SMALL', 'MEDIUM', 'LARGE'] as const).map((scaleOption) => {
                  const isActive = uiScale === scaleOption;
                  let label = scaleOption === 'SMALL' ? t('settings.scale.small') : 
                              scaleOption === 'MEDIUM' ? t('settings.scale.medium') : 
                              t('settings.scale.large');

                  return (
                      <button
                          key={scaleOption}
                          onClick={() => handleScaleChange(scaleOption)}
                          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                              isActive 
                              ? 'bg-blue-600 text-white shadow-lg' 
                              : 'text-stone-600 hover:text-stone-300'
                          }`}
                      >
                          {label}
                      </button>
                  );
              })}
          </div>

          <div className="flex items-center justify-between p-4 bg-stone-950/40 rounded-2xl border border-stone-800 mb-6">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg">
                      <Sun size={18} />
                  </div>
                  <div>
                      <h4 className="text-xs font-bold text-stone-200">{t('settings.contrast')}</h4>
                      <p className="text-[9px] text-stone-600 font-bold uppercase">{t('settings.contrast.desc')}</p>
                  </div>
              </div>
              <button 
                onClick={() => updateUserProfile({ ...userProfile, highContrastMode: !userProfile.highContrastMode })}
                className={`w-12 h-6 rounded-full relative transition-all duration-300 ${userProfile.highContrastMode ? 'bg-emerald-500' : 'bg-stone-800'}`}
              >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${userProfile.highContrastMode ? 'left-7' : 'left-1'}`}></div>
              </button>
          </div>

          {/* Voice Selection */}
          <div className="flex items-center space-x-3 mb-4 mt-6">
              <div className="p-2.5 bg-emerald-900/30 text-emerald-400 rounded-xl">
                  <UserRound size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">{t('settings.voice')}</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{t('settings.voice.desc')}</p>
              </div>
          </div>
          <div className="flex p-1 bg-stone-950/40 rounded-2xl border border-stone-800">
              <button
                  onClick={() => updateUserProfile({ ...userProfile, assistantVoice: 'male' })}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                      userProfile.assistantVoice === 'male' || !userProfile.assistantVoice
                      ? 'bg-emerald-600 text-white shadow-lg' 
                      : 'text-stone-600 hover:text-stone-300'
                  }`}
              >
                  {t('settings.voice.male')}
              </button>
              <button
                  onClick={() => updateUserProfile({ ...userProfile, assistantVoice: 'female' })}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                      userProfile.assistantVoice === 'female'
                      ? 'bg-emerald-600 text-white shadow-lg' 
                      : 'text-stone-600 hover:text-stone-300'
                  }`}
              >
                  {t('settings.voice.female')}
              </button>
          </div>

          {/* Currency Selection */}
          <div className="flex items-center space-x-3 mb-4 mt-6">
              <div className="p-2.5 bg-amber-900/30 text-amber-400 rounded-xl">
                  <Briefcase size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">{t('settings.currency')}</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{t('settings.currency.desc')}</p>
              </div>
          </div>
          <div className="flex p-1 bg-stone-950/40 rounded-2xl border border-stone-800">
              {(['TRY', 'USD', 'EUR'] as const).map((currencyOption) => {
                  const isActive = (userProfile.currency || 'TRY') === currencyOption;
                  let label = currencyOption === 'TRY' ? t('settings.currency.try') : currencyOption === 'USD' ? t('settings.currency.usd') : t('settings.currency.eur');

                  return (
                      <button
                          key={currencyOption}
                          onClick={() => updateUserProfile({ ...userProfile, currency: currencyOption })}
                          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                              isActive 
                              ? 'bg-amber-600 text-white shadow-lg' 
                              : 'text-stone-600 hover:text-stone-300'
                          }`}
                      >
                          {label}
                      </button>
                  );
              })}
          </div>

          {/* Language Settings */}
          <div className="flex items-center space-x-3 mb-4 mt-6">
              <div className="p-2.5 bg-purple-900/30 text-purple-400 rounded-xl">
                  <Globe size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">{t('settings.language')}</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{t('settings.language.desc')}</p>
              </div>
          </div>
          <div className="flex p-1 bg-stone-950/40 rounded-2xl border border-stone-800">
              {(['tr', 'en', 'ar'] as Language[]).map((langOption) => {
                  const isActive = language === langOption;
                  let label = langOption === 'tr' ? 'Türkçe' : langOption === 'en' ? 'English' : 'العربية';

                  return (
                      <button
                          key={langOption}
                          onClick={() => setLanguage(langOption)}
                          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                              isActive 
                              ? 'bg-purple-600 text-white shadow-lg' 
                              : 'text-stone-600 hover:text-stone-300'
                          }`}
                      >
                          {label}
                      </button>
                  );
              })}
          </div>
      </div>

      {/* System Operations */}
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 mb-6">
          <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-purple-900/30 text-purple-400 rounded-xl">
                  <RefreshCw size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">{t('settings.system')}</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{t('settings.system.desc')}</p>
              </div>
          </div>
          
          <button 
            onClick={() => setIsTurnoverModalOpen(true)}
            className="w-full flex items-center justify-between p-4 bg-stone-950/40 rounded-2xl border border-stone-800 hover:border-purple-500/50 hover:bg-stone-900 transition-all group"
          >
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-colors">
                      <RefreshCw size={18} />
                  </div>
                  <div className="text-left">
                      <h4 className="text-xs font-bold text-stone-200 group-hover:text-purple-400 transition-colors">{t('settings.turnover')}</h4>
                      <p className="text-[9px] text-stone-600 font-bold uppercase">{t('settings.turnover.desc')}</p>
                  </div>
              </div>
              <ChevronRight size={18} className="text-stone-700 group-hover:text-purple-400 transition-colors" />
          </button>
      </div>

      {/* App Info Footer */}
      <div className="text-center py-8">
          <div className="w-12 h-12 bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-900/30 shadow-inner">
              <span className="font-black text-sm">MKS</span>
          </div>
          <h2 className="font-black text-xs text-stone-500 uppercase tracking-[0.2em]">Mühendis Kayıt Sistemi</h2>
          <p className="text-[10px] text-stone-700 mt-1 font-bold">PREMIUM v2.5.1</p>
          <p className="text-[9px] text-stone-800 mt-6 uppercase tracking-widest">© 2026 Nayif Fırat</p>
      </div>

      <ConfirmationModal
        isOpen={isTurnoverModalOpen}
        onClose={() => setIsTurnoverModalOpen(false)}
        onConfirm={performManualTurnover}
        title={t('settings.turnover')}
        message={t('settings.turnover.confirm')}
        variant="warning"
      />
    </div>
  );
};
