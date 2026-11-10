
import React, { useState, useMemo } from 'react';
import { Database, Download, Upload, Type, User, ChevronRight, ChevronLeft, Briefcase, UserRound, Sun, Moon, Settings, RefreshCw, Globe, Paintbrush, Sparkles, Key, Check, Copy, LogOut, Loader2, Trash2, AlertTriangle, Lock, Eye, EyeOff, CheckCircle2, FileText, X, ShieldCheck } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { db as firestore, auth, googleProvider } from '../services/firebase';
import { signInWithPopup, linkWithPopup, signInWithRedirect, linkWithRedirect, getRedirectResult, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UIScale, Language } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { dbService } from '../services/db';

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

import { generateYearEndReportPDF } from '../utils/yearEndReportGenerator';

export const SettingsScreen: React.FC<SettingsProps> = ({ onNavigate }) => {
  const { currentUser, logout } = useAuth();
  const { 
    uiScale, 
    setUiScale, 
    userProfile, 
    updateUserProfile, 
    performManualTurnover, 
    language, 
    setLanguage, 
    t, 
    showToast, 
    hapticFeedback,
    farmers,
    inventory,
    prescriptions,
    payments,
    manualDebts,
    myPayments,
    suppliers,
    supplierPurchases,
    accounts,
    expenses
  } = useAppViewModel();
  const [isTurnoverModalOpen, setIsTurnoverModalOpen] = useState(false);
  const [isRebuildModalOpen, setIsRebuildModalOpen] = useState(false);
  const [turnoverCompletedYear, setTurnoverCompletedYear] = useState<number | null>(null);
  const [isGeneratingTurnoverPdf, setIsGeneratingTurnoverPdf] = useState(false);
  const [isYearEndDocsModalOpen, setIsYearEndDocsModalOpen] = useState(false);
  const [downloadingYearPdf, setDownloadingYearPdf] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Devir Şifre & Tek Seferlik Devir Durumları
  const [turnoverPassword, setTurnoverPassword] = useState('');
  const [showTurnoverPassword, setShowTurnoverPassword] = useState(false);
  const [isVerifyingTurnoverPassword, setIsVerifyingTurnoverPassword] = useState(false);
  const [turnoverError, setTurnoverError] = useState<string | null>(null);
  const [isAlreadyTurnedOverModalOpen, setIsAlreadyTurnedOverModalOpen] = useState(false);

  const handleInitiateTurnover = async () => {
    const currentYear = new Date().getFullYear();
    try {
      const logs = await dbService.getTurnoverLogs();
      const finLog = logs.find(l => l.year === currentYear && l.type === 'FINANCIAL');
      if (finLog) {
        setIsAlreadyTurnedOverModalOpen(true);
        return;
      }
      setTurnoverPassword('');
      setTurnoverError(null);
      setIsTurnoverModalOpen(true);
    } catch (e) {
      console.error("Turnover log check error:", e);
      setTurnoverPassword('');
      setTurnoverError(null);
      setIsTurnoverModalOpen(true);
    }
  };

  const handleConfirmTurnover = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!turnoverPassword) {
      setTurnoverError('Lütfen şifrenizi giriniz.');
      return;
    }

    if (!currentUser) {
      setTurnoverError('Kullanıcı oturumu bulunamadı.');
      return;
    }

    setIsVerifyingTurnoverPassword(true);
    setTurnoverError(null);
    hapticFeedback('medium');

    try {
      let isPasswordCorrect = false;

      // 1. Firebase Auth şifre doğrulaması
      if (currentUser.email) {
        try {
          const credential = EmailAuthProvider.credential(currentUser.email, turnoverPassword);
          await reauthenticateWithCredential(currentUser, credential);
          isPasswordCorrect = true;
        } catch (authErr) {
          console.warn("Turnover re-authentication error:", authErr);
        }
      }

      // 2. Firestore kaydı kontrolü
      if (!isPasswordCorrect) {
        try {
          const userRef = doc(firestore, "MKS", "g892bEaJyGfEq1Fa67yb", "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const storedPass = userSnap.data()?.password;
            if (storedPass && storedPass === turnoverPassword.trim()) {
              isPasswordCorrect = true;
            }
          }
        } catch (err) {
          console.warn("Turnover Firestore password check error:", err);
        }
      }

      if (!isPasswordCorrect) {
        setTurnoverError('Girdiğiniz şifre hatalı! Lütfen şifrenizi doğru girdiğinizden emin olun.');
        setIsVerifyingTurnoverPassword(false);
        hapticFeedback('error');
        return;
      }

      // Şifre doğru -> Devir İşlemini Gerçekleştir
      setIsTurnoverModalOpen(false);
      setTurnoverPassword('');
      const res = await performManualTurnover();
      setIsVerifyingTurnoverPassword(false);

      if (res?.success) {
        setTurnoverCompletedYear(res.year);
      }
    } catch (err: any) {
      console.error("Turnover confirm error:", err);
      setTurnoverError("Devir işlemi sırasında bir hata oluştu.");
      setIsVerifyingTurnoverPassword(false);
    }
  };

  const availableDocYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const years = new Set<number>([currentY]);
    for (let y = currentY; y >= currentY - 5; y--) years.add(y);
    prescriptions.forEach(p => {
      if (p.date) {
        const y = new Date(p.date).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [prescriptions]);

  // Verilerimi Sil Modal & Şifre durumları
  const [isDeleteDataModalOpen, setIsDeleteDataModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAllData = async () => {
    if (!deletePassword) {
      setDeleteError('Lütfen şifrenizi girin.');
      return;
    }

    if (!currentUser) {
      setDeleteError('Kullanıcı oturumu bulunamadı.');
      return;
    }

    setIsDeletingData(true);
    setDeleteError(null);
    hapticFeedback('medium');

    try {
      let isPasswordCorrect = false;

      // 1. Firebase Auth şifre doğrulaması dene
      if (currentUser.email) {
        try {
          const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
          await reauthenticateWithCredential(currentUser, credential);
          isPasswordCorrect = true;
        } catch (authErr: any) {
          console.warn("Re-authentication error:", authErr);
        }
      }

      // 2. Eğer re-auth başarısız olduysa veya kayıtlı şifre Firestore belgesinde ise kontrol et
      if (!isPasswordCorrect) {
        try {
          const userRef = doc(firestore, "MKS", "g892bEaJyGfEq1Fa67yb", "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const storedPass = userSnap.data()?.password;
            if (storedPass && storedPass === deletePassword.trim()) {
              isPasswordCorrect = true;
            }
          }
        } catch (err) {
          console.warn("Firestore password check error:", err);
        }
      }

      if (!isPasswordCorrect) {
        setDeleteError('Girdiğiniz şifre hatalı! Lütfen şifrenizi doğru girdiğinizden emin olun.');
        setIsDeletingData(false);
        hapticFeedback('error');
        return;
      }

      // Şifre doğru -> Tüm kullanıcı verilerini buluttan ve yerelden tamamen sil!
      showToast('Tüm verileriniz kalıcı olarak siliniyor...', 'info');
      await dbService.deleteAllUserData(currentUser.uid);

      showToast('Tüm verileriniz başarıyla silindi. Hesabınız sıfırlandı.', 'success');
      hapticFeedback('success');

      setIsDeleteDataModalOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error("Delete data error:", error);
      setDeleteError('Veriler silinirken bir hata oluştu: ' + (error?.message || 'Bilinmeyen hata'));
      setIsDeletingData(false);
      hapticFeedback('error');
    }
  };

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

  
  const handleExportData = async () => {
    try {
      const data = await dbService.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mks_yedek_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Veriler başarıyla dışa aktarıldı', 'success');
      hapticFeedback('success');
    } catch (error) {
      showToast('Dışa aktarma hatası', 'error');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonData = event.target?.result as string;
        if (jsonData) {
            await dbService.importData(jsonData);
            showToast('Veriler başarıyla içe aktarıldı. Lütfen uygulamayı yenileyin.', 'success');
            hapticFeedback('success');
            setTimeout(() => window.location.reload(), 2000);
        }
      } catch (error) {
        showToast('İçe aktarma hatası. Geçersiz dosya.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const renderDataSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setActiveSection(null)} className="p-2 bg-stone-900 rounded-xl text-stone-400 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Veri Yönetimi</h2>
          <p className="text-sm text-stone-400">Verilerinizi yedekleyin ve geri yükleyin</p>
        </div>
      </div>

      <div className="bg-stone-900 rounded-3xl p-6 border border-white/5 space-y-6">
        <div>
            <h3 className="text-lg font-bold text-white mb-2">Verileri Dışa Aktar</h3>
            <p className="text-sm text-stone-400 mb-4">Tüm uygulama verilerinizi (Çiftçiler, İşlemler, vb.) bir JSON dosyası olarak indirerek yedekleyebilirsiniz.</p>
            <button onClick={handleExportData} className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-4 rounded-xl font-bold hover:bg-emerald-500/30 transition-all flex justify-center items-center gap-2">
                <Download size={20} />
                Yedeği İndir
            </button>
        </div>
        <div className="h-px bg-white/5" />
        <div>
            <h3 className="text-lg font-bold text-white mb-2">Verileri İçe Aktar</h3>
            <p className="text-sm text-stone-400 mb-4">Daha önce aldığınız bir yedeği yükleyerek verilerinizi geri getirin. (Mevcut verilerinizin üzerine yazılacaktır!)</p>
            <label className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 p-4 rounded-xl font-bold hover:bg-blue-500/30 transition-all flex justify-center items-center gap-2 cursor-pointer">
                <Upload size={20} />
                Yedeği Yükle
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
            </label>
        </div>
      </div>
    </div>
  );

  const renderGeneralSection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader(t('nav.group.general'), t('settings.language.desc'), Settings, "bg-blue-900/30 text-blue-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 space-y-6">
        <div>
          <h4 className="text-xs font-bold text-stone-400 mb-3 uppercase tracking-wider">Görünüm Modu</h4>
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-stone-950/40 rounded-2xl border border-stone-800">
            <button
              type="button"
              onClick={() => updateUserProfile({ ...userProfile, colorMode: 'DARK', theme: userProfile.theme === 'LIGHT' ? 'APPLE' : (userProfile.theme || 'APPLE') })}
              className={`py-3.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                (userProfile.colorMode || 'DARK') === 'DARK' && userProfile.theme !== 'LIGHT'
                  ? 'bg-stone-800 text-white shadow-lg border border-white/10'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              <Moon size={16} className="text-amber-400" />
              <div className="flex flex-col items-start text-left">
                <span className="leading-tight">Karanlık Mod</span>
                <span className="text-[8px] text-emerald-400 font-extrabold uppercase tracking-widest opacity-90">Varsayılan</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => updateUserProfile({ ...userProfile, colorMode: 'LIGHT', theme: 'LIGHT' })}
              className={`py-3.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                userProfile.colorMode === 'LIGHT' || userProfile.theme === 'LIGHT'
                  ? 'bg-amber-500 text-stone-950 font-black shadow-lg'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              <Sun size={16} className="text-amber-950 fill-amber-950" />
              <div className="flex flex-col items-start text-left">
                <span className="leading-tight">Aydınlık Mod</span>
                <span className="text-[8px] opacity-80 uppercase tracking-widest">Işık Tema</span>
              </div>
            </button>
          </div>
        </div>

        <div>
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
    </div>
  );

    const renderThemeSection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader("Tema", "Arayüz tasarım stili seçin", Paintbrush, "bg-rose-900/30 text-rose-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5">
        <div className="flex flex-col gap-2">
            {(['DEFAULT', 'TECHNICAL', 'ORGANIC', 'MINIMAL', 'BARBIE', 'APPLE'] as const).map((themeOption) => {
                const isActive = (userProfile.theme || 'APPLE') === themeOption || (themeOption === 'APPLE' && userProfile.theme === 'DEFAULT');
                if (themeOption === 'DEFAULT') return null; // Hide the old 'DEFAULT' option since APPLE is the new default

                let label = themeOption === 'TECHNICAL' ? 'Mühendis Defteri (Teknik)' : 
                            themeOption === 'ORGANIC' ? 'Toprak ve Canlılık (Doğal)' : 
                            themeOption === 'MINIMAL' ? 'Stark (Keskin Minimal)' :
                            themeOption === 'APPLE' ? 'Apple (iOS/macOS) - Standart' :
                            'Barbie Land (Pembe & Eğlenceli)';

                return (
                    <button
                        key={themeOption}
                        onClick={() => updateUserProfile({ ...userProfile, theme: themeOption })}
                        className={`w-full py-4 px-4 rounded-xl font-bold text-sm text-left transition-all duration-300 border flex items-center justify-between ${
                            isActive 
                            ? (themeOption === 'BARBIE' ? 'bg-pink-500 border-white/40 text-white shadow-lg' : themeOption === 'APPLE' ? 'bg-[#0A84FF] border-white/40 text-white shadow-lg' : 'bg-stone-800 border-white/20 text-white shadow-lg')
                            : 'bg-stone-950/40 border-stone-800/50 hover:bg-stone-900 text-stone-400 hover:text-stone-300 border-dashed'
                        }`}
                    >
                        <span>{label}</span>
                        {isActive && <div className={`w-2 h-2 rounded-full ${themeOption === 'BARBIE' || themeOption === 'APPLE' ? 'bg-white' : 'bg-emerald-500'}`} />}
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
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-5 sm:p-6 shadow-sm border border-white/5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Devret (Turnover) Button */}
          <button 
            onClick={handleInitiateTurnover}
            className="w-full flex flex-col justify-between p-4 bg-purple-950/30 rounded-2xl border border-purple-500/40 hover:border-purple-400 hover:bg-purple-950/50 transition-all group shadow-sm text-left h-full min-h-[115px]"
          >
              <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl group-hover:bg-purple-500 group-hover:text-white transition-colors">
                      <RefreshCw size={20} />
                  </div>
                  <ChevronRight size={18} className="text-purple-500/60 group-hover:text-purple-300 transition-colors" />
              </div>
              <div>
                  <h4 className="text-xs sm:text-sm font-black text-purple-200 group-hover:text-white transition-colors">{t('settings.turnover')}</h4>
                  <p className="text-[10px] text-purple-300/70 font-semibold leading-tight mt-1">Şifreli & tek seferlik sene devir işlemi</p>
              </div>
          </button>

          {/* Yıl Sonu Dokümanları (Year-End Documents) Button */}
          <button 
            onClick={() => setIsYearEndDocsModalOpen(true)}
            className="w-full flex flex-col justify-between p-4 bg-emerald-950/30 rounded-2xl border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/50 transition-all group shadow-sm text-left h-full min-h-[115px]"
          >
              <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl group-hover:bg-emerald-500 group-hover:text-stone-950 transition-colors">
                      <FileText size={20} />
                  </div>
                  <ChevronRight size={18} className="text-emerald-500/60 group-hover:text-emerald-300 transition-colors" />
              </div>
              <div>
                  <h4 className="text-xs sm:text-sm font-black text-emerald-200 group-hover:text-white transition-colors">Yıl Sonu Dokümanları</h4>
                  <p className="text-[10px] text-emerald-300/70 font-semibold leading-tight mt-1">Devir raporları ve resmi bilançolar</p>
              </div>
          </button>

          {/* Stokları / Depoyu Onar Button */}
          <button 
            onClick={() => setIsRebuildModalOpen(true)}
            className="w-full flex flex-col justify-between p-4 bg-orange-950/20 rounded-2xl border border-orange-900/40 hover:border-orange-500/50 hover:bg-orange-950/40 transition-all group shadow-sm text-left h-full min-h-[115px]"
          >
              <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2.5 bg-orange-500/20 text-orange-400 rounded-xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      <RefreshCw size={20} />
                  </div>
                  <ChevronRight size={18} className="text-orange-500/60 group-hover:text-orange-300 transition-colors" />
              </div>
              <div>
                  <h4 className="text-xs sm:text-sm font-black text-orange-200 group-hover:text-white transition-colors">Stokları Onar</h4>
                  <p className="text-[10px] text-orange-300/70 font-semibold leading-tight mt-1">Depo stok durumunu senkronize edin</p>
              </div>
          </button>

          {/* Verilerimi Sil (Delete My Data) Button */}
          <button 
            onClick={() => {
              setDeletePassword('');
              setDeleteError(null);
              setIsDeleteDataModalOpen(true);
            }}
            className="w-full flex flex-col justify-between p-4 bg-rose-950/20 rounded-2xl border border-rose-900/40 hover:border-rose-500/50 hover:bg-rose-950/40 transition-all group shadow-sm text-left h-full min-h-[115px]"
          >
              <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition-colors">
                      <Trash2 size={20} />
                  </div>
                  <ChevronRight size={18} className="text-rose-500/60 group-hover:text-rose-300 transition-colors" />
              </div>
              <div>
                  <h4 className="text-xs sm:text-sm font-black text-rose-200 group-hover:text-white transition-colors">Verilerimi Sil</h4>
                  <p className="text-[10px] text-rose-300/70 font-semibold leading-tight mt-1">Hesap verilerini kalıcı sıfırlayın</p>
              </div>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!activeSection && renderMainMenu()}
      {activeSection === 'GENERAL' && renderGeneralSection()}
      {activeSection === 'THEME' && renderThemeSection()}
      {activeSection === 'CURRENCY' && renderCurrencySection()}
      {activeSection === 'LANGUAGE' && renderLanguageSection()}
      {activeSection === 'SYSTEM' && renderSystemSection()}
      {activeSection === 'DATA' && renderDataSection()}

      {/* Devir İşlemi Şifreli Onay Modalı */}
      {isTurnoverModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-purple-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-500" />

            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                  <RefreshCw size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">{new Date().getFullYear()} Yılı Devir İşlemi</h3>
                  <p className="text-[10px] text-purple-300 font-bold uppercase">Şifreli Güvenlik Doğrulaması</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsTurnoverModalOpen(false);
                  setTurnoverPassword('');
                  setTurnoverError(null);
                }}
                className="p-2 text-stone-400 hover:text-white bg-stone-800/80 hover:bg-stone-800 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmTurnover} className="space-y-4">
              <div className="p-3 bg-purple-950/40 border border-purple-500/20 rounded-2xl text-xs text-purple-200 leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-purple-300">
                  <AlertTriangle size={15} className="text-purple-400 flex-shrink-0" />
                  Tek Seferlik Devir İşlemi Onayı
                </p>
                <p className="text-[11px] text-purple-200/80">
                  {new Date().getFullYear()} yılı için devir işlemi cari bakiyeleri ve depo stok durumunu devreder. Devir işlemi her yıl için yalnızca <strong>1 defa</strong> gerçekleştirilebilir. Devri onaylamak için lütfen şifrenizi girin.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">
                  Hesap Şifrenizi Giriniz:
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showTurnoverPassword ? "text" : "password"}
                    value={turnoverPassword}
                    onChange={(e) => {
                      setTurnoverPassword(e.target.value);
                      if (turnoverError) setTurnoverError(null);
                    }}
                    placeholder="Şifreniz"
                    className="w-full pl-10 pr-10 py-3 bg-stone-950/80 border border-stone-800 rounded-2xl text-white text-xs font-medium outline-none focus:border-purple-500 transition-colors"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowTurnoverPassword(!showTurnoverPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
                  >
                    {showTurnoverPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {turnoverError && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/30 rounded-xl text-[11px] text-rose-300 font-medium flex items-center gap-2">
                  <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
                  <span>{turnoverError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsTurnoverModalOpen(false);
                    setTurnoverPassword('');
                    setTurnoverError(null);
                  }}
                  className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingTurnoverPassword || !turnoverPassword}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-950/50 transition-all flex items-center justify-center gap-2"
                >
                  {isVerifyingTurnoverPassword ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Doğrulanıyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Devri Onayla
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aynı Yıl İçinde Zaten Devir Yapıldı Bilgilendirme Modalı */}
      {isAlreadyTurnedOverModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-purple-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center space-y-4">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-500" />

            <div className="w-16 h-16 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck size={36} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                {new Date().getFullYear()} Yılı Devri Zaten Yapıldı!
              </h3>
              <p className="text-xs text-stone-300 font-medium leading-relaxed mt-2">
                Aynı yıl içinde devir işlemi yalnızca <strong>1 defa</strong> gerçekleştirilebilir. {new Date().getFullYear()} yılına ait sene sonu devir kaydı sistemde mevcuttur.
              </p>
            </div>

            <div className="p-3 bg-purple-950/40 border border-purple-500/20 rounded-2xl text-left text-[11px] text-purple-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <FileText size={14} className="text-purple-400" />
                Hazırlanan Devir Raporuna Erişin:
              </p>
              <p className="text-[10px] text-purple-200/80">
                Oluşturulan tüm devir bilançolarını, ürün kârlılıklarını ve cari bakiyeleri <strong>"Yıl Sonu Dokümanları"</strong> bölümünden istediğiniz zaman PDF olarak indirebilirsiniz.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  setIsAlreadyTurnedOverModalOpen(false);
                  setIsYearEndDocsModalOpen(true);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
              >
                <FileText size={18} />
                Yıl Sonu Dokümanlarını Görüntüle & İndir
              </button>

              <button
                onClick={() => setIsAlreadyTurnedOverModalOpen(false)}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Devir Tamamlandı & PDF İndirme Modalı */}
      {turnoverCompletedYear !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-emerald-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center space-y-4">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                {turnoverCompletedYear} Yılı Devri Tamamlandı!
              </h3>
              <p className="text-xs text-stone-300 font-medium leading-relaxed mt-2">
                Eksiksiz sene sonu bilançonuz, ürün kârlılıklarınız, çiftçi ve tedarikçi borçlarınız, stok değerlemeniz ve ortaklık kâr-zarar raporunuz hazırlandı.
              </p>
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-2xl text-left text-[11px] text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <FileText size={14} className="text-emerald-400" />
                Rapor İçeriği (Tam Kapsamlı):
              </p>
              <ul className="list-disc list-inside text-[10px] text-emerald-200/80 space-y-0.5">
                <li>Satılan ürün kârlılık ve ciro dökümü</li>
                <li>Çiftçi (cari) borç ve alacak bakiyeleri</li>
                <li>Depo stok miktarları ve varlık değerlemesi</li>
                <li>Tedarikçi (bayi) borç durumu</li>
                <li>Kasalar, banka hesapları, çek ve senetler</li>
                <li>Ortaklık kâr / zarar paylaşım analizi</li>
              </ul>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={async () => {
                  setIsGeneratingTurnoverPdf(true);
                  try {
                    await generateYearEndReportPDF({
                      targetYear: turnoverCompletedYear,
                      farmers,
                      inventory,
                      prescriptions,
                      payments,
                      manualDebts,
                      myPayments,
                      suppliers,
                      supplierPurchases,
                      accounts,
                      expenses,
                      userProfile
                    });
                    showToast("Yıl sonu devir raporu PDF olarak indirildi.", "success");
                  } catch (e) {
                    console.error("Turnover PDF download error:", e);
                    showToast("PDF oluşturulurken hata oluştu.", "error");
                  } finally {
                    setIsGeneratingTurnoverPdf(false);
                  }
                }}
                disabled={isGeneratingTurnoverPdf}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-95 disabled:opacity-50"
              >
                {isGeneratingTurnoverPdf ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    PDF Raporu Hazırlanıyor...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    {turnoverCompletedYear} Yılı Devir Raporunu (PDF) İndir
                  </>
                )}
              </button>

              <button
                onClick={() => setTurnoverCompletedYear(null)}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yıl Sonu Dokümanları Arşivi Modalı */}
      {isYearEndDocsModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-emerald-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 mt-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">Yıl Sonu Dokümanları & Devir Raporları</h3>
                  <p className="text-[10px] text-stone-400 font-medium">Sene sonu resmi bilançoları ve devir belgeleri arşivi</p>
                </div>
              </div>
              <button 
                onClick={() => setIsYearEndDocsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-white bg-stone-800/80 hover:bg-stone-800 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 no-scrollbar">
              {availableDocYears.map(year => {
                const isDownloadingThis = downloadingYearPdf === year;
                return (
                  <div key={year} className="p-4 bg-stone-950/70 border border-white/10 rounded-2xl space-y-3 hover:border-emerald-500/40 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-xs rounded-xl">
                          {year} YILI
                        </span>
                        <span className="text-xs font-bold text-stone-200">Devir & Bilanço Raporu</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400/90 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-400" /> Kurumsal PDF
                      </span>
                    </div>

                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      {year} yılına ait ürün bazlı net kârlılık, çiftçi (cari) borç/alacak bakiyeleri, depo stoğu ve varlık değerlemesi, kasa-banka durumları ve ortaklık pay analiz raporu.
                    </p>

                    <button
                      onClick={async () => {
                        setDownloadingYearPdf(year);
                        try {
                          await generateYearEndReportPDF({
                            targetYear: year,
                            farmers,
                            inventory,
                            prescriptions,
                            payments,
                            manualDebts,
                            myPayments,
                            suppliers,
                            supplierPurchases,
                            accounts,
                            expenses,
                            userProfile
                          });
                          showToast(`${year} yılı devir raporu PDF olarak indirildi.`, 'success');
                        } catch (e) {
                          console.error("Year doc download error:", e);
                          showToast("Rapor oluşturulurken hata oluştu.", 'error');
                        } finally {
                          setDownloadingYearPdf(null);
                        }
                      }}
                      disabled={isDownloadingThis}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 shadow-md shadow-emerald-950/50"
                    >
                      {isDownloadingThis ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {year} Yılı Raporu Hazırlanıyor...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          {year} Yılı Devir Raporunu (PDF) İndir
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-white/10 mt-2">
              <button
                onClick={() => setIsYearEndDocsModalOpen(false)}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-xs transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isRebuildModalOpen}
        onClose={() => setIsRebuildModalOpen(false)}
        onConfirm={async () => {
            try {
               await dbService.rebuildInventoryBalances();
               showToast("Stoklar başarıyla yeniden hesaplandı. Sistem yenileniyor...", "success");
               setTimeout(() => {
                   window.location.reload();
               }, 1500);
            } catch (e) {
               showToast("Hata oluştu.", "error");
            }
            setIsRebuildModalOpen(false);
        }}
        title="Stokları Yeniden Hesapla"
        message="Bu işlem tüm geçmiş alım ve satımlarınızı tarayarak mevcut stok miktarlarınızı baştan hesaplar. Stok miktarındaki uyuşmazlıkları gidermek için kullanılır. Onaylıyor musunuz?"
        confirmText="Evet, Onar"
        variant="warning"
      />

      {/* Verilerimi Sil Şifreli Onay Modalı */}
      {isDeleteDataModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-rose-500/30 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            {/* Üst Vurgu Çizgisi */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-600 via-red-500 to-amber-500" />

            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-rose-950/80 text-rose-400 border border-rose-500/30 rounded-2xl flex-shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">Verilerimi Sil</h3>
                <p className="text-xs font-bold text-rose-400/80 uppercase tracking-wider mt-0.5">Kalıcı Hesap Sıfırlama</p>
              </div>
            </div>

            <div className="bg-rose-950/30 border border-rose-900/50 p-4 rounded-2xl mb-5 text-xs text-rose-200 leading-relaxed">
              <p className="font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
                Bu işlem geri alınamaz!
              </p>
              <p className="opacity-90">
                Müşteri kayıtlarınız, reçeteleriniz, stoklarınız, borç/alacak takibiniz ve tüm işlem geçmişiniz hem cihazınızdan hem de sunucudan kalıcı olarak silinecek, hesabınız sıfır veri haline gelecektir.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-bold rounded-xl mb-4 flex items-center gap-2 animate-in fade-in">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">
                Silme İşlemini Onaylamak İçin Şifrenizi Girin
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
                  <Lock size={18} />
                </div>
                <input
                  type={showDeletePassword ? "text" : "password"}
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    if (deleteError) setDeleteError(null);
                  }}
                  placeholder="Hesap şifreniz"
                  disabled={isDeletingData}
                  className="w-full bg-stone-950 border border-stone-800 text-white pl-10 pr-12 py-3.5 rounded-2xl text-sm font-medium outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isDeletingData) {
                      handleDeleteAllData();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                >
                  {showDeletePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingData) {
                    setIsDeleteDataModalOpen(false);
                    setDeletePassword('');
                    setDeleteError(null);
                  }
                }}
                disabled={isDeletingData}
                className="flex-1 py-3.5 px-4 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-300 text-xs font-bold rounded-2xl transition-all"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteAllData}
                disabled={isDeletingData || !deletePassword}
                className="flex-1 py-3.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-stone-800 disabled:text-stone-600 text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50"
              >
                {isDeletingData ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Siliniyor...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Verilerimi Kalıcı Sil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
