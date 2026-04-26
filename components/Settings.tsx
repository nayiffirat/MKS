
import React, { useState, useMemo } from 'react';
import { Type, User, ChevronRight, ChevronLeft, Briefcase, UserRound, Sun, Settings, RefreshCw, Globe, Paintbrush, Sparkles, Key, Check, Copy, LogOut, Loader2 } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, linkWithPopup, signInWithRedirect, linkWithRedirect, getRedirectResult } from 'firebase/auth';
import { UIScale, Language } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface SettingsProps {
    onNavigate: (view: any) => void;
}

const MenuItem = ({ icon: Icon, title, subtitle, color, onClick }: { icon: any, title: string, subtitle: string, color: string, onClick: () => void }) => (
    <div 
        onClick={onClick}
        className="flex items-center justify-between bg-stone-900/60 p-4 rounded-2xl border border-stone-800 cursor-pointer hover:border-emerald-500/50 hover:bg-stone-900 transition-all group shadow-sm backdrop-blur"
    >
        <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl border ${color}`}>
                <Icon size={20} />
            </div>
            <div className="min-w-[120px] text-left">
                <h4 className="font-bold text-stone-200 group-hover:text-white transition-colors truncate">
                    {title}
                </h4>
                <p className="text-[10px] text-stone-500 font-bold uppercase truncate">
                    {subtitle}
                </p>
            </div>
        </div>
        <ChevronRight size={20} className="text-stone-600 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
    </div>
);

export const SettingsScreen: React.FC<SettingsProps> = ({ onNavigate }) => {
  const { currentUser, logout } = useAuth();
  const { uiScale, setUiScale, userProfile, updateUserProfile, performManualTurnover, language, setLanguage, t, showToast, hapticFeedback } = useAppViewModel();
  const [isTurnoverModalOpen, setIsTurnoverModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const isGoogleUser = useMemo(() => {
    return currentUser?.providerData?.some(p => p.providerId === 'google.com');
  }, [currentUser]);

  // Handle Redirect Result on Mount for phones
  React.useEffect(() => {
    const checkRedirect = async () => {
        try {
            const result = await getRedirectResult(auth);
            if (result) {
                showToast('Google bağlantısı başarılı!', 'success');
                hapticFeedback('success');
            }
        } catch (error: any) {
            console.error("Settings redirect error:", error);
        }
    };
    checkRedirect();
  }, []);

  const handleGoogleAuth = async () => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    hapticFeedback('medium');

    try {
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        // Google'ın standart, desteklenen giriş yöntemi:
        try {
            if (!currentUser) await signInWithPopup(auth, googleProvider);
            else if (!isGoogleUser) await linkWithPopup(currentUser, googleProvider);
            else showToast('Zaten bağlı.', 'info');
            
            showToast('İşlem başarılı!', 'success');
            hapticFeedback('success');
        } catch (e: any) {
            const isIframe = window.self !== window.top;
            
            if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
                if (isIframe) {
                    showToast('Popup engellendi! Lütfen adres çubuğundan izin verin veya yeni sekmede açın.', 'error');
                } else {
                    showToast('Yönlendiriliyorsunuz...', 'info');
                    if (!currentUser) await signInWithRedirect(auth, googleProvider);
                    else if (!isGoogleUser) await linkWithRedirect(currentUser, googleProvider);
                }
            }
        }
    } catch (error: any) {
        console.error("Auth error:", error);
        showToast('Bağlantı kurulamadı. Tekrar deneyin.', 'error');
    } finally {
        setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
      try {
          await logout();
          showToast('Başarıyla çıkış yapıldı.', 'success');
          onNavigate('LOGIN');
      } catch (error) {
          showToast('Çıkış yapılırken hata oluştu.', 'error');
      }
  };

  const handleScaleChange = (scale: UIScale) => {
    setUiScale(scale);
  };

  const renderMainMenu = () => (
    <div className="pb-32 animate-in fade-in duration-300 px-4">
      <h2 className="text-2xl font-bold text-white mb-6 mt-4 px-2">{t('nav.settings')}</h2>

      <div className="space-y-3">
        <MenuItem 
          icon={User} 
          title={t('settings.account')} 
          subtitle={t('settings.personal')} 
          color="bg-emerald-900/30 text-emerald-400 border-emerald-500/20"
          onClick={() => onNavigate('PROFILE')} 
        />

        <MenuItem 
          icon={Sparkles} 
          title="Asistan Ayarları" 
          subtitle="Yapay Zeka, Ses ve Google Hesabı" 
          color="bg-purple-900/30 text-purple-400 border-purple-500/20"
          onClick={() => setActiveSection('AI_SETTINGS')} 
        />
        
        <MenuItem 
          icon={Settings} 
          title={t('nav.group.general')} 
          subtitle={t('settings.language.desc')} 
          color="bg-blue-900/30 text-blue-400 border-blue-500/20"
          onClick={() => setActiveSection('GENERAL')} 
        />

        <MenuItem 
          icon={Paintbrush} 
          title="Tema (Görünüm)" 
          subtitle="Arayüz tasarım stili" 
          color="bg-rose-900/30 text-rose-400 border-rose-500/20"
          onClick={() => setActiveSection('THEME')} 
        />

        <MenuItem 
          icon={Briefcase} 
          title={t('settings.currency')} 
          subtitle={t('settings.currency.desc')} 
          color="bg-amber-900/30 text-amber-400 border-amber-500/20"
          onClick={() => setActiveSection('CURRENCY')} 
        />

        <MenuItem 
          icon={Globe} 
          title={t('settings.language')} 
          subtitle={t('settings.language.desc')} 
          color="bg-purple-900/30 text-purple-400 border-purple-500/20"
          onClick={() => setActiveSection('LANGUAGE')} 
        />

        <MenuItem 
          icon={RefreshCw} 
          title={t('settings.system')} 
          subtitle={t('settings.system.desc')} 
          color="bg-stone-800 text-stone-400 border-stone-700"
          onClick={() => setActiveSection('SYSTEM')} 
        />
      </div>

      {/* App Info Footer */}
      <div className="text-center py-8 mt-4">
          <div className="w-12 h-12 bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-900/30 shadow-inner">
              <span className="font-black text-sm">MKS</span>
          </div>
          <h2 className="font-black text-xs text-stone-500 uppercase tracking-[0.2em]">Mühendis Kayıt Sistemi</h2>
          <p className="text-[10px] text-stone-700 mt-1 font-bold">PREMIUM v2.5.1</p>
          <p className="text-[9px] text-stone-800 mt-6 uppercase tracking-widest">© 2026 Nayif Fırat</p>
      </div>
    </div>
  );

  const renderSectionHeader = (title: string, subtitle: string, icon: any, colorClass: string) => {
    const Icon = icon;
    return (
      <div className="flex items-center space-x-4 mb-6">
        <button 
          onClick={() => setActiveSection(null)}
          className="p-2 bg-stone-900/80 rounded-full text-stone-400 hover:text-white transition-colors border border-stone-800"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl border border-white/5 ${colorClass}`}>
              <Icon size={20} />
          </div>
          <div>
              <h3 className="font-bold text-stone-100 text-xl tracking-tight">{title}</h3>
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{subtitle}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderGeneralSection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader(t('nav.group.general'), t('settings.language.desc'), Settings, "bg-blue-900/30 text-blue-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5">
        <h4 className="text-xs font-bold text-stone-400 mb-3 uppercase tracking-wider">Arayüz Boyutu</h4>
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

        <div className="flex items-center justify-between p-4 bg-stone-950/40 rounded-2xl border border-stone-800">
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
      </div>
    </div>
  );

    const renderThemeSection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader("Tema", "Arayüz tasarım stili seçin", Paintbrush, "bg-rose-900/30 text-rose-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5">
        <div className="flex flex-col gap-2">
            {(['DEFAULT', 'TECHNICAL', 'ORGANIC', 'MINIMAL', 'BARBIE'] as const).map((themeOption) => {
                const isActive = (userProfile.theme || 'DEFAULT') === themeOption;
                let label = themeOption === 'DEFAULT' ? 'Klasik (Standart)' : 
                            themeOption === 'TECHNICAL' ? 'Mühendis Defteri (Teknik)' : 
                            themeOption === 'ORGANIC' ? 'Toprak ve Canlılık (Doğal)' : 
                            themeOption === 'MINIMAL' ? 'Stark (Keskin Minimal)' :
                            'Barbie Land (Pembe & Eğlenceli)';

                return (
                    <button
                        key={themeOption}
                        onClick={() => updateUserProfile({ ...userProfile, theme: themeOption })}
                        className={`w-full py-4 px-4 rounded-xl font-bold text-sm text-left transition-all duration-300 border flex items-center justify-between ${
                            isActive 
                            ? (themeOption === 'BARBIE' ? 'bg-pink-500 border-white/40 text-white shadow-lg' : 'bg-stone-800 border-white/20 text-white shadow-lg')
                            : 'bg-stone-950/40 border-stone-800/50 hover:bg-stone-900 text-stone-400 hover:text-stone-300 border-dashed'
                        }`}
                    >
                        <span>{label}</span>
                        {isActive && <div className={`w-2 h-2 rounded-full ${themeOption === 'BARBIE' ? 'bg-white' : 'bg-emerald-500'}`} />}
                    </button>
                );
            })}
        </div>
      </div>
    </div>
  );


  const renderCurrencySection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader(t('settings.currency'), t('settings.currency.desc'), Briefcase, "bg-amber-900/30 text-amber-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5">
        <div className="flex flex-col gap-2">
            {(['TRY', 'USD', 'EUR'] as const).map((currencyOption) => {
                const isActive = (userProfile.currency || 'TRY') === currencyOption;
                let label = currencyOption === 'TRY' ? t('settings.currency.try') : currencyOption === 'USD' ? t('settings.currency.usd') : t('settings.currency.eur');

                return (
                    <button
                        key={currencyOption}
                        onClick={() => updateUserProfile({ ...userProfile, currency: currencyOption })}
                        className={`w-full py-4 px-4 rounded-xl font-bold text-sm text-left transition-all duration-300 border flex items-center justify-between ${
                            isActive 
                            ? 'bg-amber-600 border-white/20 text-white shadow-lg' 
                            : 'bg-stone-950/40 border-stone-800/50 hover:bg-stone-900 text-stone-400 hover:text-stone-300 border-dashed'
                        }`}
                    >
                        <span>{label}</span>
                        {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                    </button>
                );
            })}
        </div>
      </div>
    </div>
  );

  const renderLanguageSection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader(t('settings.language'), t('settings.language.desc'), Globe, "bg-purple-900/30 text-purple-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5">
        <div className="flex flex-col gap-2">
            {(['tr', 'en', 'ar'] as Language[]).map((langOption) => {
                const isActive = language === langOption;
                let label = langOption === 'tr' ? 'Türkçe' : langOption === 'en' ? 'English' : 'العربية';

                return (
                    <button
                        key={langOption}
                        onClick={() => setLanguage(langOption)}
                        className={`w-full py-4 px-4 rounded-xl font-bold text-sm text-left transition-all duration-300 border flex items-center justify-between ${
                            isActive 
                            ? 'bg-purple-600 border-white/20 text-white shadow-lg' 
                            : 'bg-stone-950/40 border-stone-800/50 hover:bg-stone-900 text-stone-400 hover:text-stone-300 border-dashed'
                        }`}
                    >
                        <span>{label}</span>
                        {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                    </button>
                );
            })}
        </div>
      </div>
    </div>
  );

  const renderSystemSection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader(t('settings.system'), t('settings.system.desc'), RefreshCw, "bg-stone-800 text-stone-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5">
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
    </div>
  );

  const renderAiSection = () => {
    return (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader("Asistan Ayarları", "Yapay Zeka ve Hesap", Sparkles, "bg-purple-900/30 text-purple-400")}
      
      <div className="space-y-4">
        {/* Google Account Integration */}
        <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 space-y-4">
            <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em]">Hesap Bağlantısı</h4>
            {currentUser && isGoogleUser ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-stone-950/40 p-4 rounded-2xl border border-stone-800">
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/30 shrink-0">
                            <img src={currentUser.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">{currentUser.displayName}</h4>
                            <p className="text-[10px] text-emerald-500 font-bold uppercase">Google ile Bağlı</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="w-full py-4 bg-stone-950/40 border border-rose-500/20 text-rose-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut size={16} />
                        Oturumu Kapat
                    </button>
                </div>
            ) : (
                <button 
                    onClick={handleGoogleAuth}
                    disabled={isAuthLoading}
                    className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    {isAuthLoading ? (
                        <Loader2 className="animate-spin" size={16} />
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            Google Hesabını Bağla
                        </>
                    )}
                </button>
            )}
        </div>

        {/* Voice Selection Section (Consolidated) */}
        <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5">
            <h4 className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em] mb-4">Asistan Sesi</h4>
            <div className="flex p-1 bg-stone-950/40 rounded-2xl border border-stone-800">
                <button
                    onClick={() => updateUserProfile({ ...userProfile, assistantVoice: 'male' })}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                        userProfile.assistantVoice === 'male' || !userProfile.assistantVoice
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'text-stone-600 hover:text-stone-300'
                    }`}
                >
                    {t('settings.voice.male')}
                </button>
                <button
                    onClick={() => updateUserProfile({ ...userProfile, assistantVoice: 'female' })}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                        userProfile.assistantVoice === 'female'
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'text-stone-600 hover:text-stone-300'
                    }`}
                >
                    {t('settings.voice.female')}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
  };

  return (
    <>
      {!activeSection && renderMainMenu()}
      {activeSection === 'AI_SETTINGS' && renderAiSection()}
      {activeSection === 'GENERAL' && renderGeneralSection()}
      {activeSection === 'THEME' && renderThemeSection()}
      {activeSection === 'CURRENCY' && renderCurrencySection()}
      {activeSection === 'LANGUAGE' && renderLanguageSection()}
      {activeSection === 'SYSTEM' && renderSystemSection()}

      <ConfirmationModal
        isOpen={isTurnoverModalOpen}
        onClose={() => setIsTurnoverModalOpen(false)}
        onConfirm={() => {
            performManualTurnover();
            setIsTurnoverModalOpen(false);
        }}
        title={t('settings.turnover')}
        message={t('settings.turnover.confirm')}
        variant="warning"
      />
    </>
  );
};
