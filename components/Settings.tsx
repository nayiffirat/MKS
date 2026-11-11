
import React, { useState, useMemo } from 'react';
import { Database, Download, Upload, Type, User, ChevronRight, ChevronLeft, Briefcase, UserRound, Sun, Moon, Settings, RefreshCw, Globe, Paintbrush, Sparkles, Key, Check, Copy, LogOut, Loader2, Trash2, AlertTriangle, Lock, Eye, EyeOff, CheckCircle2, FileText, X, ShieldCheck, MessageSquare, FileSpreadsheet, Shield, Bell } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { db as firestore, auth, googleProvider } from '../services/firebase';
import { signInWithPopup, linkWithPopup, signInWithRedirect, linkWithRedirect, getRedirectResult, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UIScale, Language, InventoryItem } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import PermissionsPanel from './PermissionsPanel';
import { dbService } from '../services/db';
import { verifySecret } from '../utils/crypto';
import { DEFAULT_WHATSAPP_TEMPLATES } from '../utils/whatsappTemplates';
import {
    encryptMksBackup,
    decryptMksBackup,
    parseDelimitedText,
    buildUtf8BomCsv,
    downloadTextFile,
    parseTurkishNumber,
    resolvePesticideCategory,
    ParsedDelimitedTable
} from '../utils/backupAndCsvTools';

interface SettingsProps {
    onNavigate: (view: any) => void;
}

const MenuItem = ({ icon: Icon, title, subtitle, color, onClick }: { icon: any, title: string, subtitle: string, color: string, onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between bg-stone-900/60 p-4 rounded-2xl border border-stone-800 cursor-pointer hover:border-emerald-500/40 hover:bg-stone-900 transition-colors group shadow-sm text-left min-h-[64px]"
    >
        <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={18} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1 text-left">
                <h4 className="font-semibold text-sm text-stone-200 group-hover:text-white transition-colors truncate">
                    {title}
                </h4>
                <p className="text-xs text-stone-400 mt-0.5 truncate">
                    {subtitle}
                </p>
            </div>
        </div>
        <ChevronRight size={18} className="text-stone-500 group-hover:text-white transition-colors shrink-0" />
    </button>
);

import { generateYearEndReportPDF } from '../utils/yearEndReportGenerator';
import { sendEncryptedBackupToTelegram, ensurePreUpdateSafetySnapshot, CURRENT_MKS_VERSION } from '../utils/subscriptionManager';
import { useBackHandler } from '../utils/navigationManager';
import { APP_VERSION_LABEL } from '../constants';

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
    expenses,
    refreshStats,
    refreshInventory,
    activeTeamMember
  } = useAppViewModel();
  const [isTurnoverModalOpen, setIsTurnoverModalOpen] = useState(false);
  const [isRebuildModalOpen, setIsRebuildModalOpen] = useState(false);
  const [turnoverCompletedYear, setTurnoverCompletedYear] = useState<number | null>(null);
  const [isGeneratingTurnoverPdf, setIsGeneratingTurnoverPdf] = useState(false);
  const [isYearEndDocsModalOpen, setIsYearEndDocsModalOpen] = useState(false);
  const [downloadingYearPdf, setDownloadingYearPdf] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSendingTelegramBackup, setIsSendingTelegramBackup] = useState(false);

  // #50 AES-256 Şifreli Yedekleme Durumları
  const [backupPassword, setBackupPassword] = useState('');
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [isEncryptingBackup, setIsEncryptingBackup] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [isDecryptingBackup, setIsDecryptingBackup] = useState(false);
  const [encryptedRestoreContent, setEncryptedRestoreContent] = useState<string | null>(null);
  const [encryptedRestoreFileName, setEncryptedRestoreFileName] = useState<string>('');

  // #48 Sütun Eşleştirmeli Excel/CSV İçe Aktarım Durumları
  const [csvTarget, setCsvTarget] = useState<'FARMERS' | 'INVENTORY'>('FARMERS');
  const [parsedCsv, setParsedCsv] = useState<ParsedDelimitedTable | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [farmerColMap, setFarmerColMap] = useState({
    fullName: 0,
    phoneNumber: -1,
    village: -1,
    tcNo: -1,
    creditLimit: -1,
    initialDebt: -1
  });
  const [inventoryColMap, setInventoryColMap] = useState({
    pesticideName: 0,
    category: -1,
    quantity: -1,
    unit: -1,
    buyingPrice: -1,
    sellingPrice: -1,
    cashPrice: -1,
    barcode: -1,
    lotNumber: -1,
    expiryDate: -1
  });

  // #33 Dinamik WhatsApp Mesaj Şablonları Durumları
  const [waTemplatesDraft, setWaTemplatesDraft] = useState({
    collectionReceipt: userProfile?.whatsappTemplates?.collectionReceipt || DEFAULT_WHATSAPP_TEMPLATES.collectionReceipt,
    debtReminder: userProfile?.whatsappTemplates?.debtReminder || DEFAULT_WHATSAPP_TEMPLATES.debtReminder,
    prescriptionShare: userProfile?.whatsappTemplates?.prescriptionShare || DEFAULT_WHATSAPP_TEMPLATES.prescriptionShare,
    announcement: userProfile?.whatsappTemplates?.announcement || DEFAULT_WHATSAPP_TEMPLATES.announcement
  });

  React.useEffect(() => {
    setWaTemplatesDraft({
      collectionReceipt: userProfile?.whatsappTemplates?.collectionReceipt || DEFAULT_WHATSAPP_TEMPLATES.collectionReceipt,
      debtReminder: userProfile?.whatsappTemplates?.debtReminder || DEFAULT_WHATSAPP_TEMPLATES.debtReminder,
      prescriptionShare: userProfile?.whatsappTemplates?.prescriptionShare || DEFAULT_WHATSAPP_TEMPLATES.prescriptionShare,
      announcement: userProfile?.whatsappTemplates?.announcement || DEFAULT_WHATSAPP_TEMPLATES.announcement
    });
  }, [userProfile?.whatsappTemplates]);

  // Register back handler so pressing back inside a Settings sub-section returns to Settings root
  useBackHandler(!!activeSection, () => setActiveSection(null), 'settings_sub_section', 55);

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

      // 2. Yönetici şifresi (hash) doğrulaması (Google / Telefon ile giriş yapan hesaplar için)
      if (!isPasswordCorrect && userProfile?.adminPassword) {
        isPasswordCorrect = await verifySecret(turnoverPassword.trim(), userProfile.adminPassword);
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

      // 2. Yönetici şifresi (hash) doğrulaması (Google / Telefon ile giriş yapan hesaplar için)
      if (!isPasswordCorrect && userProfile?.adminPassword) {
        isPasswordCorrect = await verifySecret(deletePassword.trim(), userProfile.adminPassword);
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
            if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
                return;
            }
            if (e.code === 'auth/popup-blocked') {
                showToast('Popup engellendi! Lütfen adres çubuğundan açılır pencerelere izin verin.', 'error');
                return;
            }
            console.error("Auth error:", e);
            showToast(translateFirebaseError(e.code) || 'Bağlantı kurulamadı. Tekrar deneyin.', 'error');
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

      <div className="space-y-2.5">
        <PermissionsPanel />

        <MenuItem 
          icon={Bell} 
          title="Bildirim izinleri ve uyarı kanalları" 
          subtitle="Ödeme, çek-senet-kart, aranacaklar, hava durumu ve güncelleme bildirimleri" 
          color="bg-emerald-900/30 text-emerald-400 border-emerald-500/20"
          onClick={() => onNavigate('NOTIFICATIONS')} 
        />

        <MenuItem 
          icon={FileText} 
          title="Görselli kullanım kılavuzu" 
          subtitle="Önem sırasına göre adım adım uygulama rehberi" 
          color="bg-sky-900/30 text-sky-400 border-sky-500/20"
          onClick={() => onNavigate('USER_GUIDE')} 
        />

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
          icon={Shield} 
          title="Gizlilik & Maliyet Maskeleme" 
          subtitle="Tezgah modu ve satış personeli kâr/alış gizleme" 
          color="bg-indigo-900/30 text-indigo-400 border-indigo-500/20"
          onClick={() => setActiveSection('PRIVACY')} 
        />

        <MenuItem 
          icon={MessageSquare} 
          title="WhatsApp Mesaj & Dekont Şablonları" 
          subtitle="Tahsilat makbuzu, borç hatırlatma ve duyuru metinleri" 
          color="bg-teal-900/30 text-teal-400 border-teal-500/20"
          onClick={() => setActiveSection('WHATSAPP_TEMPLATES')} 
        />

        <MenuItem 
          icon={Database} 
          title="Veri Aktarımı, Excel/CSV & Şifreli Yedek" 
          subtitle="Sütun eşleştirmeli CSV yükleme ve AES-256 .mksbackup" 
          color="bg-cyan-900/30 text-cyan-400 border-cyan-500/20"
          onClick={() => setActiveSection('DATA')} 
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
          <h2 className="font-semibold text-xs text-stone-400">Mühendis Kayıt Sistemi</h2>
          <p className="text-[11px] text-stone-500 mt-1 tabular-nums">{APP_VERSION_LABEL}</p>
          <p className="text-[11px] text-stone-500 mt-4">© 2026 Nayif Fırat</p>
      </div>
    </div>
  );

  const renderSectionHeader = (title: string, subtitle: string, icon: any, colorClass: string) => {
    const Icon = icon;
    return (
      <div className="flex items-center space-x-4 mb-6">
        <button 
          type="button"
          onClick={() => setActiveSection(null)}
          aria-label="Ayarlar ana menüsüne geri dön"
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-stone-900/80 rounded-full text-stone-400 hover:text-white transition-colors border border-stone-800"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl border border-white/5 ${colorClass}`}>
              <Icon size={20} />
          </div>
          <div>
              <h3 className="font-bold text-stone-100 text-xl tracking-tight">{title}</h3>
              <p className="text-[11px] text-stone-500 font-bold uppercase tracking-widest">{subtitle}</p>
          </div>
        </div>
      </div>
    );
  };

  
  // Düz JSON tam yedeği oluşturup indirir (manuel dışa aktarım ve geri yükleme öncesi güvenlik yedeği ortak kullanır)
  const downloadPlainBackup = async (fileName: string) => {
    const data = await dbService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportData = async () => {
    try {
      await downloadPlainBackup(`mks_yedek_${new Date().toISOString().split('T')[0]}.json`);
      showToast('Veriler başarıyla dışa aktarıldı', 'success');
      hapticFeedback('success');
    } catch (error) {
      showToast('Dışa aktarma hatası', 'error');
    }
  };

  // AK-05: Yedekten geri yükleme yıkıcıdır. Dosya seçimi yalnızca yedeği okuyup doğrular;
  // gerçek içe aktarım ancak onay penceresinde onaylandıktan ve otomatik güvenlik yedeği alındıktan sonra yapılır.
  const [pendingRestore, setPendingRestore] = useState<{ json: string; fileName: string; source: 'PLAIN' | 'ENCRYPTED' } | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  const handleConfirmRestore = async () => {
    const pending = pendingRestore;
    if (!pending) return;
    setPendingRestore(null);
    setIsRestoringBackup(true);
    try {
      // 1. Önce mevcut yerel verilerin otomatik güvenlik yedeğini indir
      try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        await downloadPlainBackup(`MKS_oncesi_yedek_${stamp}.json`);
        showToast('Mevcut verilerinizin güvenlik yedeği indirildi.', 'info');
      } catch (safetyErr) {
        console.error('Pre-restore safety export error:', safetyErr);
        showToast('Güvenlik yedeği alınamadığı için geri yükleme iptal edildi. Mevcut verileriniz korunuyor.', 'error');
        hapticFeedback('error');
        return;
      }

      // 2. Ardından yedeği içe aktar
      await dbService.importData(pending.json);
      showToast(
        pending.source === 'ENCRYPTED'
          ? 'Şifreli yedek doğrulandı ve tüm verileriniz geri yüklendi! Yenileniyor...'
          : 'Veriler başarıyla içe aktarıldı. Uygulama yenileniyor...',
        'success'
      );
      hapticFeedback('success');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Restore import error:', error);
      showToast(error?.message ? `İçe aktarma hatası: ${error.message}` : 'İçe aktarma hatası. Geçersiz dosya.', 'error');
      hapticFeedback('error');
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    if (activeTeamMember?.role === 'SALES') {
      showToast('Tam yedek geri yükleme işlemi yalnızca hesap sahibi / yönetici yetkisiyle yapılabilir.', 'error');
      inputEl.value = '';
      return;
    }
    const file = inputEl.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = event.target?.result as string;
        if (jsonData) {
            const parsedCheck = JSON.parse(jsonData);
            if (!parsedCheck || typeof parsedCheck !== 'object' || Array.isArray(parsedCheck)) {
              throw new Error('Geçersiz MKS yedek şeması');
            }
            // Yalnızca onay iste — burada hiçbir veri değiştirilmez
            setPendingRestore({ json: jsonData, fileName: file.name, source: 'PLAIN' });
        }
      } catch (error) {
        showToast('İçe aktarma hatası. Geçersiz dosya.', 'error');
      } finally {
        // Aynı dosyanın tekrar seçilebilmesi için girdiyi sıfırla
        inputEl.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExportEncryptedBackup = async () => {
    if (activeTeamMember?.role === 'SALES') {
      showToast('Tam yedek indirme işlemi yalnızca hesap sahibi / yönetici yetkisiyle yapılabilir.', 'error');
      return;
    }
    if (!backupPassword || backupPassword.trim().length < 8) {
      showToast('Lütfen en az 8 karakterli bir yedekleme parolası girin.', 'error');
      return;
    }
    setIsEncryptingBackup(true);
    try {
      const plainJson = await dbService.exportData();
      const encryptedEnvelope = await encryptMksBackup(plainJson, backupPassword);
      const dateStamp = new Date().toISOString().split('T')[0];
      downloadTextFile(encryptedEnvelope, `mks_sifreli_yedek_${dateStamp}.mksbackup`, 'application/octet-stream');
      showToast('AES-256 şifreli tam yedeğiniz (.mksbackup) indirildi.', 'success');
      hapticFeedback('success');
      setBackupPassword('');
    } catch (err: any) {
      showToast(err?.message || 'Şifreli yedek oluşturulamadı.', 'error');
    } finally {
      setIsEncryptingBackup(false);
    }
  };

  const handleEncryptedFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEncryptedRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEncryptedRestoreContent((ev.target?.result as string) || null);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleRestoreEncryptedBackup = async () => {
    if (!encryptedRestoreContent) {
      showToast('Lütfen önce bir .mksbackup şifreli yedek dosyası seçin.', 'error');
      return;
    }
    if (!restorePassword) {
      showToast('Lütfen yedeğin parolasını girin.', 'error');
      return;
    }
    if (activeTeamMember?.role === 'SALES') {
      showToast('Tam yedek geri yükleme işlemi yalnızca hesap sahibi / yönetici yetkisiyle yapılabilir.', 'error');
      return;
    }
    setIsDecryptingBackup(true);
    try {
      const decryptedJson = await decryptMksBackup(encryptedRestoreContent, restorePassword);
      const parsedCheck = JSON.parse(decryptedJson);
      if (!parsedCheck || typeof parsedCheck !== 'object' || Array.isArray(parsedCheck)) {
        throw new Error('Geçersiz MKS yedek şeması');
      }
      // Parola doğrulandı — veri değiştirmeden önce kullanıcı onayı iste (AK-05)
      setPendingRestore({ json: decryptedJson, fileName: encryptedRestoreFileName, source: 'ENCRYPTED' });
    } catch (err: any) {
      showToast(err?.message || 'Şifre çözme hatası.', 'error');
      hapticFeedback('error');
    } finally {
      setIsDecryptingBackup(false);
    }
  };

  const handleExportFarmersCsv = () => {
    const headers = ['Ad Soyad', 'Telefon', 'Köy / Mahalle', 'TCKN', 'Kredi Limiti', 'Güncel Cari Bakiye'];
    const rows = farmers.map(f => [
      f.fullName,
      f.phoneNumber || '',
      f.village || '',
      f.tcNo || '',
      f.creditLimit ?? '',
      Math.round((f.balance || 0) * 100) / 100
    ]);
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(csv, `MKS_Ciftci_Cari_Listesi_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
    showToast(`${farmers.length} kayıt Excel uyumlu CSV olarak indirildi.`, 'success');
  };

  const handleExportInventoryCsv = () => {
    const maskBuying = Boolean(
      userProfile?.hideCostAndProfit ||
      (userProfile?.hideBuyingPricesForStaff && activeTeamMember?.role === 'SALES')
    );
    const headers = maskBuying
      ? ['Ürün Adı', 'Kategori', 'Miktar', 'Birim', 'Vadeli Satış', 'Peşin Satış', 'Barkod', 'Lot No', 'SKT']
      : ['Ürün Adı', 'Kategori', 'Miktar', 'Birim', 'Vadeli Alış', 'Vadeli Satış', 'Peşin Satış', 'Barkod', 'Lot No', 'SKT'];
    const rows = inventory.map(i =>
      maskBuying
        ? [
            i.pesticideName,
            i.category,
            i.quantity,
            i.unit,
            i.sellingPrice,
            i.cashPrice ?? '',
            i.barcode || '',
            i.lotNumber || '',
            i.expiryDate || ''
          ]
        : [
            i.pesticideName,
            i.category,
            i.quantity,
            i.unit,
            i.buyingPrice,
            i.sellingPrice,
            i.cashPrice ?? '',
            i.barcode || '',
            i.lotNumber || '',
            i.expiryDate || ''
          ]
    );
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(csv, `MKS_Depo_Stok_Listesi_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
    showToast(`${inventory.length} stok kalemi Excel uyumlu CSV olarak indirildi.`, 'success');
  };

  const handleExportMovementsCsv = () => {
    const farmerMap = new Map<string, string>(farmers.map(f => [f.id, f.fullName]));
    const headers = ['Tarih', 'Tür', 'Belge / Not', 'Üretici', 'Ödeme / Fiyat Tipi', 'Tutar'];
    const rows: (string | number)[][] = [];
    prescriptions.forEach(p => {
      rows.push([
        new Date(p.date).toLocaleDateString('tr-TR'),
        p.type === 'RETURN' ? 'Satış İadesi' : 'Reçete / Satış',
        p.prescriptionNo || p.id,
        farmerMap.get(p.farmerId) || 'Bilinmeyen',
        p.priceType === 'CASH' ? 'Peşin' : 'Vadeli',
        p.totalAmount || 0
      ]);
    });
    payments.forEach(pay => {
      rows.push([
        new Date(pay.date).toLocaleDateString('tr-TR'),
        'Tahsilat',
        pay.note || '',
        farmerMap.get(pay.farmerId) || 'Bilinmeyen',
        pay.method || 'CASH',
        pay.amount || 0
      ]);
    });
    const csv = buildUtf8BomCsv(headers, rows);
    downloadTextFile(csv, `MKS_Recete_Tahsilat_Hareketleri_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
    showToast(`${rows.length} finansal hareket CSV olarak indirildi.`, 'success');
  };

  const autoGuessColumnIndex = (headers: string[], keywords: string[], fallback = -1): number => {
    for (let idx = 0; idx < headers.length; idx++) {
      const norm = headers[idx].toLocaleLowerCase('tr-TR').trim();
      if (keywords.some(kw => norm.includes(kw))) return idx;
    }
    return fallback;
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = (ev.target?.result as string) || '';
      const table = parseDelimitedText(raw);
      if (table.headers.length === 0 || table.rows.length === 0) {
        showToast('Dosyada geçerli başlık veya veri satırı bulunamadı.', 'error');
        setParsedCsv(null);
        return;
      }
      setParsedCsv(table);
      setFarmerColMap({
        fullName: autoGuessColumnIndex(table.headers, ['ad', 'isim', 'üretici', 'uretici', 'çiftçi', 'ciftci', 'müstahsil', 'mustahsil', 'müşteri', 'musteri', 'cari', 'name'], 0),
        phoneNumber: autoGuessColumnIndex(table.headers, ['tel', 'gsm', 'cep', 'phone']),
        village: autoGuessColumnIndex(table.headers, ['köy', 'koy', 'mahalle', 'bölge', 'bolge', 'adres']),
        tcNo: autoGuessColumnIndex(table.headers, ['tc', 'kimlik', 'vkn']),
        creditLimit: autoGuessColumnIndex(table.headers, ['limit', 'kredi']),
        initialDebt: autoGuessColumnIndex(table.headers, ['bakiye', 'borç', 'borc', 'devir', 'alacak'])
      });
      setInventoryColMap({
        pesticideName: autoGuessColumnIndex(table.headers, ['ürün', 'urun', 'ilaç', 'ilac', 'ad', 'isim', 'stok'], 0),
        category: autoGuessColumnIndex(table.headers, ['kategori', 'grup', 'tür', 'tur']),
        quantity: autoGuessColumnIndex(table.headers, ['miktar', 'adet', 'stok', 'mevcut']),
        unit: autoGuessColumnIndex(table.headers, ['birim', 'ölçü', 'olcu']),
        buyingPrice: autoGuessColumnIndex(table.headers, ['alış', 'alis', 'maliyet']),
        sellingPrice: autoGuessColumnIndex(table.headers, ['satış', 'satis', 'vadeli']),
        cashPrice: autoGuessColumnIndex(table.headers, ['peşin', 'pesin', 'nakit']),
        barcode: autoGuessColumnIndex(table.headers, ['barkod', 'gtin', 'ean']),
        lotNumber: autoGuessColumnIndex(table.headers, ['lot', 'parti', 'seri']),
        expiryDate: autoGuessColumnIndex(table.headers, ['skt', 'son kullanma', 'tarih'])
      });
      showToast(`${table.rows.length} satır algılandı. Sütun eşleştirmesini kontrol edip onaylayın.`, 'info');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleConfirmCsvImport = async () => {
    if (!parsedCsv || parsedCsv.rows.length === 0) return;
    setIsImportingCsv(true);
    try {
      if (csvTarget === 'FARMERS') {
        if (farmerColMap.fullName < 0) {
          showToast('Lütfen "Ad Soyad" sütununu eşleştirin.', 'error');
          setIsImportingCsv(false);
          return;
        }
        let importedCount = 0;
        let debtCount = 0;
        const nowIso = new Date().toISOString();
        for (const row of parsedCsv.rows) {
          const fullName = (row[farmerColMap.fullName] || '').trim();
          if (!fullName) continue;
          const farmerId = crypto.randomUUID();
          const phoneNumber = farmerColMap.phoneNumber >= 0 ? (row[farmerColMap.phoneNumber] || '').trim() : '';
          const village = farmerColMap.village >= 0 ? (row[farmerColMap.village] || '').trim() || 'Merkez' : 'Merkez';
          const tcNo = farmerColMap.tcNo >= 0 ? (row[farmerColMap.tcNo] || '').trim() : undefined;
          const creditLimitVal = farmerColMap.creditLimit >= 0 ? parseTurkishNumber(row[farmerColMap.creditLimit]) : 0;
          const rawInitialDebt = farmerColMap.initialDebt >= 0 ? parseTurkishNumber(row[farmerColMap.initialDebt]) : 0;

          await dbService.addFarmer({
            id: farmerId,
            fullName,
            phoneNumber,
            village,
            tcNo: tcNo || undefined,
            creditLimit: creditLimitVal > 0 ? creditLimitVal : undefined,
            fields: [],
            portalToken: crypto.randomUUID().replace(/-/g, ''),
            createdById: activeTeamMember?.id,
            lastUpdated: nowIso
          });
          importedCount++;

          const debtAbs = Math.abs(rawInitialDebt);
          if (debtAbs > 0) {
            await dbService.addManualDebt({
              id: crypto.randomUUID(),
              farmerId,
              amount: debtAbs,
              date: nowIso,
              note: 'Excel/CSV İçe Aktarım Açılış Bakiyesi',
              createdById: activeTeamMember?.id
            });
            debtCount++;
          }
        }
        await refreshStats();
        showToast(`${importedCount} çiftçi${debtCount > 0 ? ` ve ${debtCount} açılış bakiyesi` : ''} başarıyla aktarıldı!`, 'success');
        hapticFeedback('success');
        setParsedCsv(null);
        setCsvFileName('');
      } else {
        if (inventoryColMap.pesticideName < 0) {
          showToast('Lütfen "Ürün Adı" sütununu eşleştirin.', 'error');
          setIsImportingCsv(false);
          return;
        }
        let importedCount = 0;
        const nowIso = new Date().toISOString();
        for (const row of parsedCsv.rows) {
          const pesticideName = (row[inventoryColMap.pesticideName] || '').trim();
          if (!pesticideName) continue;
          const category = inventoryColMap.category >= 0 ? resolvePesticideCategory(row[inventoryColMap.category]) : resolvePesticideCategory('');
          const quantity = inventoryColMap.quantity >= 0 ? Math.max(0, parseTurkishNumber(row[inventoryColMap.quantity])) : 0;
          const unit = inventoryColMap.unit >= 0 ? (row[inventoryColMap.unit] || '').trim() || 'Adet' : 'Adet';
          const buyingPrice = inventoryColMap.buyingPrice >= 0 ? Math.max(0, parseTurkishNumber(row[inventoryColMap.buyingPrice])) : 0;
          const sellingPrice = inventoryColMap.sellingPrice >= 0 ? Math.max(0, parseTurkishNumber(row[inventoryColMap.sellingPrice])) : buyingPrice;
          const cashPriceVal = inventoryColMap.cashPrice >= 0 ? parseTurkishNumber(row[inventoryColMap.cashPrice]) : 0;
          const barcode = inventoryColMap.barcode >= 0 ? (row[inventoryColMap.barcode] || '').trim() : undefined;
          const lotNumber = inventoryColMap.lotNumber >= 0 ? (row[inventoryColMap.lotNumber] || '').trim() : undefined;
          const expiryDate = inventoryColMap.expiryDate >= 0 ? (row[inventoryColMap.expiryDate] || '').trim() : undefined;

          const itemId = crypto.randomUUID();
          const newItem: InventoryItem = {
            id: itemId,
            pesticideId: `custom-${itemId}`,
            pesticideName,
            category,
            quantity,
            unit,
            buyingPrice,
            sellingPrice,
            cashPrice: cashPriceVal > 0 ? cashPriceVal : undefined,
            barcode: barcode || undefined,
            lotNumber: lotNumber || undefined,
            expiryDate: expiryDate || undefined,
            lowStockThreshold: 5,
            lastUpdated: nowIso
          };
          await dbService.addInventoryItem(newItem);
          importedCount++;
        }
        await refreshInventory();
        await refreshStats();
        showToast(`${importedCount} depo stok kalemi başarıyla içe aktarıldı!`, 'success');
        hapticFeedback('success');
        setParsedCsv(null);
        setCsvFileName('');
      }
    } catch (err: any) {
      console.error('CSV import error:', err);
      showToast('CSV aktarımı sırasında hata oluştu: ' + (err?.message || ''), 'error');
    } finally {
      setIsImportingCsv(false);
    }
  };

  const renderPrivacySection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader(
        "Gizlilik & Maliyet Maskeleme",
        "Tezgah üstü müşteri yanı modu ve satış personeli yetki kısıtlaması",
        Shield,
        "bg-indigo-900/30 text-indigo-400"
      )}

      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 space-y-4">
        {/* Toggle 1: Tezgah / Müşteri Yanı Modu */}
        <div className="flex items-center justify-between gap-4 p-4 bg-stone-950/60 rounded-2xl border border-stone-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <EyeOff size={16} className="text-indigo-400 shrink-0" />
              <h4 className="text-xs sm:text-sm font-black text-stone-100">Tezgah Modu (Tüm Alış & Kâr Rakamlarını Gizle)</h4>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Açık olduğunda müşteri ekranınıza bakarken Depo, Reçete, Çiftçi Finans Analizi ve İstatistik ekranlarındaki tüm alış maliyetleri ve net kâr marjları otomatik maskelenir (<code className="text-indigo-300">••••••</code>).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!userProfile?.hideCostAndProfit}
            aria-label="Tezgah modu: tüm alış ve kâr rakamlarını gizle"
            onClick={() => {
              if (activeTeamMember?.role === 'SALES') {
                showToast('Gizlilik ayarları yalnızca işletme sahibi / yönetici tarafından değiştirilebilir.', 'error');
                return;
              }
              const nextVal = !userProfile?.hideCostAndProfit;
              updateUserProfile({
                ...userProfile,
                hideCostAndProfit: nextVal,
                hideCostInScreens: nextVal
              });
              showToast(nextVal ? 'Tezgah gizlilik modu etkinleştirildi.' : 'Tezgah gizlilik modu kapatıldı.', 'info');
            }}
            className="min-h-[44px] min-w-[44px] p-2.5 -m-2.5 flex items-center justify-center shrink-0"
          >
            <span className={`block w-14 h-7 rounded-full relative transition-all duration-300 ${userProfile?.hideCostAndProfit ? 'bg-indigo-500' : 'bg-stone-800'}`}>
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 ${userProfile?.hideCostAndProfit ? 'left-8' : 'left-1'}`} />
            </span>
          </button>
        </div>

        {/* Toggle 2: Satış Personeli Kısıtlaması */}
        <div className="flex items-center justify-between gap-4 p-4 bg-stone-950/60 rounded-2xl border border-stone-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-amber-400 shrink-0" />
              <h4 className="text-xs sm:text-sm font-black text-stone-100">Satış Personelinden Alış Fiyatı & Kârı Gizle</h4>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Ekip yönetiminde <strong>Satış (SALES)</strong> rolündeki personel oturum açtığında yalnızca satış fiyatlarını görebilir; alış fiyatları, kâr marjı ve Kar/Zarar rapor sekmesi gizlenir.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!userProfile?.hideBuyingPricesForStaff}
            aria-label="Satış personelinden alış fiyatı ve kârı gizle"
            onClick={() => {
              if (activeTeamMember?.role === 'SALES') {
                showToast('Personel yetki kısıtlaması yalnızca işletme sahibi / yönetici tarafından değiştirilebilir.', 'error');
                return;
              }
              const nextVal = !userProfile?.hideBuyingPricesForStaff;
              updateUserProfile({
                ...userProfile,
                hideBuyingPricesForStaff: nextVal
              });
              showToast(nextVal ? 'Satış personeli için maliyet gizleme açıldı.' : 'Satış personeli kısıtlaması kaldırıldı.', 'info');
            }}
            className="min-h-[44px] min-w-[44px] p-2.5 -m-2.5 flex items-center justify-center shrink-0"
          >
            <span className={`block w-14 h-7 rounded-full relative transition-all duration-300 ${userProfile?.hideBuyingPricesForStaff ? 'bg-emerald-500' : 'bg-stone-800'}`}>
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 ${userProfile?.hideBuyingPricesForStaff ? 'left-8' : 'left-1'}`} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderWhatsAppTemplatesSection = () => {
    const variableChips = [
      '{isim}', '{firma}', '{tarih}', '{bakiye}', '{eski_bakiye}',
      '{odenen}', '{kalan_bakiye}', '{odeme_yontemi}', '{link}',
      '{fatura_no}', '{urunler}', '{mahsul}', '{koy}'
    ];

    const templateFields: {
      key: keyof typeof DEFAULT_WHATSAPP_TEMPLATES;
      title: string;
      desc: string;
    }[] = [
      {
        key: 'collectionReceipt',
        title: '1. Tahsilat Dekontu Mesajı',
        desc: 'Önceki bakiye, ödenen tutar ve güncel kalan bakiyeyi içeren WhatsApp makbuz metni'
      },
      {
        key: 'debtReminder',
        title: '2. Cari Bakiye & Borç Hatırlatma Mesajı',
        desc: 'Üretici portal linki ve güncel cari bakiye hatırlatma metni'
      },
      {
        key: 'prescriptionShare',
        title: '3. Reçete & Satış Faturası Paylaşım Mesajı',
        desc: 'Reçete veya satış belgesi gönderilirken kullanılan şablon'
      },
      {
        key: 'announcement',
        title: '4. Köy & Mahsul Bazlı Toplu Duyuru Şablonu',
        desc: 'Don, ilaçlama uyarısı veya kampanya duyurularında varsayılan metin'
      }
    ];

    return (
      <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
        {renderSectionHeader(
          "WhatsApp Mesaj Şablonları",
          "Otomatik değişken destekli kurumsal mesaj ve tahsilat dekont metinleri",
          MessageSquare,
          "bg-teal-900/30 text-teal-400"
        )}

        <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-5 sm:p-6 shadow-sm border border-white/5 space-y-5">
          <div className="p-3.5 bg-stone-950/70 rounded-2xl border border-teal-500/20 space-y-2">
            <p className="text-[11px] font-black text-teal-400 uppercase tracking-widest">
              Kullanılabilir Dinamik Değişkenler (Tıklayıp Kopyalayabilirsiniz)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {variableChips.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(chip);
                    showToast(`${chip} panoya kopyalandı`, 'info');
                  }}
                  className="px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 font-mono text-[11px] font-bold transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {templateFields.map(tf => (
            <div key={tf.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-stone-200">{tf.title}</label>
                <button
                  type="button"
                  onClick={() =>
                    setWaTemplatesDraft(prev => ({
                      ...prev,
                      [tf.key]: DEFAULT_WHATSAPP_TEMPLATES[tf.key]
                    }))
                  }
                  className="text-[11px] font-bold text-stone-400 hover:text-teal-400 transition-colors"
                >
                  Varsayılana Dön
                </button>
              </div>
              <p className="text-[11px] text-stone-500">{tf.desc}</p>
              <textarea
                rows={4}
                value={waTemplatesDraft[tf.key]}
                onChange={(e) =>
                  setWaTemplatesDraft(prev => ({
                    ...prev,
                    [tf.key]: e.target.value
                  }))
                }
                className="w-full p-3 bg-stone-950/80 border border-stone-800 focus:border-teal-500 rounded-2xl text-xs text-stone-200 font-medium outline-none transition-colors leading-relaxed"
              />
            </div>
          ))}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                await updateUserProfile({
                  ...userProfile,
                  whatsappTemplates: { ...waTemplatesDraft }
                });
                showToast('WhatsApp şablonlarınız kaydedildi ve tüm cihazlarınızla eşitlendi.', 'success');
                hapticFeedback('success');
              }}
              className="flex-1 py-3.5 bg-teal-600 hover:bg-teal-500 text-stone-950 font-black text-xs rounded-2xl shadow-lg shadow-teal-950/40 transition-all flex items-center justify-center gap-2"
            >
              <Check size={16} />
              Şablonları Kaydet
            </button>
            <button
              type="button"
              onClick={async () => {
                setWaTemplatesDraft({ ...DEFAULT_WHATSAPP_TEMPLATES });
                await updateUserProfile({
                  ...userProfile,
                  whatsappTemplates: { ...DEFAULT_WHATSAPP_TEMPLATES }
                });
                showToast('Tüm şablonlar varsayılan metinlere sıfırlandı.', 'info');
              }}
              className="px-5 py-3.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-2xl transition-all"
            >
              Tümünü Sıfırla
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDataSection = () => (
    <div className="space-y-6 pb-32 px-4 mt-6 animate-in slide-in-from-right-8 duration-300">
      <div className="flex items-center gap-4 mb-2">
        <button type="button" aria-label="Ayarlar ana menüsüne geri dön" onClick={() => setActiveSection(null)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-stone-900 rounded-xl text-stone-400 hover:text-white border border-stone-800">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Veri Aktarımı, Excel/CSV & Şifreli Yedek</h2>
          <p className="text-xs text-stone-400">AES-256 kriptolu tam yedekleme ve sütun eşleştirmeli Excel/CSV sihirbazı</p>
        </div>
      </div>

      {/* #50 AES-256 Şifreli Tam Yedekleme (.mksbackup) */}
      <div className="bg-stone-900 rounded-3xl p-6 border border-cyan-500/20 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/15 text-cyan-400 rounded-xl border border-cyan-500/30">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-white">AES-256 Şifreli Tam Yedek (.mksbackup)</h3>
            <p className="text-[11px] text-stone-400">PBKDF2 (100.000 tur SHA-256) + AES-256-GCM askeri düzey kriptolama ile çevrimdışı güvenli arşiv</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Encrypt & Download */}
          <div className="p-4 bg-stone-950/70 rounded-2xl border border-white/5 space-y-3">
            <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider">1. Şifreli Yedek Oluştur & İndir</h4>
            <div className="relative">
              <input
                type={showBackupPassword ? 'text' : 'password'}
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Yedek parolası belirleyin (en az 4 krk.)"
                className="w-full pl-3.5 pr-10 py-2.5 bg-stone-900 border border-stone-800 focus:border-cyan-500 rounded-xl text-xs text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setShowBackupPassword(!showBackupPassword)}
                aria-label={showBackupPassword ? 'Parolayı gizle' : 'Parolayı göster'}
                className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-stone-500 hover:text-stone-300"
              >
                {showBackupPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="button"
              disabled={isEncryptingBackup}
              onClick={handleExportEncryptedBackup}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-stone-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40"
            >
              {isEncryptingBackup ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              AES-256 Şifreli Yedek İndir (.mksbackup)
            </button>
          </div>

          {/* Decrypt & Restore */}
          <div className="p-4 bg-stone-950/70 rounded-2xl border border-white/5 space-y-3">
            <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">2. Şifreli Yedeği Çöz & Geri Yükle</h4>
            <label className="w-full py-2.5 px-3 bg-stone-900 hover:bg-stone-800 border border-dashed border-stone-700 rounded-xl text-xs text-stone-300 font-bold flex items-center justify-center gap-2 cursor-pointer truncate">
              <Upload size={15} className="text-amber-400 shrink-0" />
              <span className="truncate">{encryptedRestoreFileName || '.mksbackup Dosyası Seçin'}</span>
              <input type="file" accept=".mksbackup,.json" onChange={handleEncryptedFileSelect} className="hidden" />
            </label>
            <div className="relative">
              <input
                type={showRestorePassword ? 'text' : 'password'}
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                placeholder="Yedeğin parolasını girin"
                className="w-full pl-3.5 pr-10 py-2.5 bg-stone-900 border border-stone-800 focus:border-amber-500 rounded-xl text-xs text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setShowRestorePassword(!showRestorePassword)}
                aria-label={showRestorePassword ? 'Parolayı gizle' : 'Parolayı göster'}
                className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-stone-500 hover:text-stone-300"
              >
                {showRestorePassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="button"
              disabled={isDecryptingBackup || isRestoringBackup || !encryptedRestoreContent}
              onClick={handleRestoreEncryptedBackup}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isDecryptingBackup ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
              Parolayı Doğrula ve Geri Yükle
            </button>
          </div>
        </div>
      </div>

      {/* #48 Excel / CSV Dışa & Sütun Eşleştirmeli İçe Aktarım Sihirbazı */}
      <div className="bg-stone-900 rounded-3xl p-6 border border-emerald-500/20 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/30">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Excel / CSV İçe & Dışa Aktarım Sihirbazı</h3>
            <p className="text-[11px] text-stone-400">Türkçe karakter destekli (UTF-8 BOM) Excel çıktıları ve akıllı sütun eşleştirme ile toplu veri yükleme</p>
          </div>
        </div>

        {/* 1-Click Excel CSV Exports */}
        <div>
          <h4 className="text-xs font-black text-stone-300 uppercase tracking-wider mb-2.5">Tek Tıkla Excel (.CSV) Çıktısı Al</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={handleExportFarmersCsv}
              className="p-3.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-2xl text-left transition-all group"
            >
              <p className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                <Download size={14} /> Çiftçi Cari Listesi
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">{farmers.length} kayıt • Bakiye & Limit dahil</p>
            </button>
            <button
              type="button"
              onClick={handleExportInventoryCsv}
              className="p-3.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-2xl text-left transition-all group"
            >
              <p className="text-xs font-black text-blue-400 flex items-center gap-1.5">
                <Download size={14} /> Depo Stok Listesi
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">{inventory.length} kalem • Barkod, Lot & SKT dahil</p>
            </button>
            <button
              type="button"
              onClick={handleExportMovementsCsv}
              className="p-3.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-2xl text-left transition-all group"
            >
              <p className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <Download size={14} /> Reçete & Tahsilatlar
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">{prescriptions.length + payments.length} finansal hareket</p>
            </button>
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Column-Mapping CSV Importer */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-xs font-black text-stone-200 uppercase tracking-wider">Sütun Eşleştirmeli Toplu CSV / Excel İçe Aktar</h4>
            <div className="flex p-1 bg-stone-950 rounded-xl border border-stone-800">
              <button
                type="button"
                onClick={() => setCsvTarget('FARMERS')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${csvTarget === 'FARMERS' ? 'bg-emerald-600 text-stone-950' : 'text-stone-400 hover:text-white'}`}
              >
                Çiftçi Listesi Yükle
              </button>
              <button
                type="button"
                onClick={() => setCsvTarget('INVENTORY')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${csvTarget === 'INVENTORY' ? 'bg-blue-600 text-white' : 'text-stone-400 hover:text-white'}`}
              >
                Depo Stok Yükle
              </button>
            </div>
          </div>

          <label className="w-full p-4 bg-stone-950/70 hover:bg-stone-950 border border-dashed border-emerald-500/40 rounded-2xl flex items-center justify-center gap-3 cursor-pointer transition-all">
            <Upload size={18} className="text-emerald-400 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-bold text-stone-200">
                {csvFileName ? `Seçilen Dosya: ${csvFileName}` : 'Excel\'den "CSV UTF-8" olarak kaydedilmiş dosyayı seçin (.csv, .tsv, .txt)'}
              </p>
              <p className="text-[11px] text-stone-500">Noktalı virgül (;), virgül (,) ve sekme (TAB) ayırıcıları otomatik algılanır</p>
            </div>
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleCsvFileUpload} className="hidden" />
          </label>

          {parsedCsv && (
            <div className="p-4 bg-stone-950/90 rounded-2xl border border-emerald-500/30 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400">
                  Algılanan: {parsedCsv.rows.length} Satır • {parsedCsv.headers.length} Sütun
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setParsedCsv(null);
                    setCsvFileName('');
                  }}
                  className="text-[11px] font-bold text-stone-400 hover:text-rose-400"
                >
                  Temizle
                </button>
              </div>

              {csvTarget === 'FARMERS' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {([
                    { key: 'fullName', label: 'Ad Soyad (Zorunlu *)' },
                    { key: 'phoneNumber', label: 'Telefon Numarası' },
                    { key: 'village', label: 'Köy / Mahalle' },
                    { key: 'tcNo', label: 'T.C. Kimlik No' },
                    { key: 'creditLimit', label: 'Kredi Limiti (TL)' },
                    { key: 'initialDebt', label: 'Açılış Borç Bakiyesi (TL)' }
                  ] as const).map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-400 block">{field.label}</label>
                      <select
                        value={farmerColMap[field.key]}
                        onChange={(e) => setFarmerColMap(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 outline-none"
                      >
                        <option value={-1}>-- Eşleştirme Yok --</option>
                        {parsedCsv.headers.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {([
                    { key: 'pesticideName', label: 'Ürün Adı (Zorunlu *)' },
                    { key: 'category', label: 'Kategori' },
                    { key: 'quantity', label: 'Mevcut Stok Miktarı' },
                    { key: 'unit', label: 'Birim (Adet/Litre/Kg)' },
                    { key: 'buyingPrice', label: 'Alış Fiyatı (TL)' },
                    { key: 'sellingPrice', label: 'Satış Fiyatı (TL)' },
                    { key: 'cashPrice', label: 'Peşin Satış Fiyatı (TL)' },
                    { key: 'barcode', label: 'Barkod / GTIN' },
                    { key: 'lotNumber', label: 'Lot / Parti No' },
                    { key: 'expiryDate', label: 'Son Kullanma Tarihi (YYYY-AA-GG)' }
                  ] as const).map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-400 block">{field.label}</label>
                      <select
                        value={inventoryColMap[field.key]}
                        onChange={(e) => setInventoryColMap(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 outline-none"
                      >
                        <option value={-1}>-- Eşleştirme Yok --</option>
                        {parsedCsv.headers.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* 5-Row Preview */}
              <div className="overflow-x-auto border border-white/5 rounded-xl">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-stone-900 text-stone-400">
                    <tr>
                      {parsedCsv.headers.map((h, idx) => (
                        <th key={idx} className="px-2.5 py-2 font-bold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-stone-300">
                    {parsedCsv.rows.slice(0, 5).map((r, rIdx) => (
                      <tr key={rIdx}>
                        {parsedCsv.headers.map((_, cIdx) => (
                          <td key={cIdx} className="px-2.5 py-1.5 whitespace-nowrap max-w-[160px] truncate">{r[cIdx] || '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                disabled={isImportingCsv}
                onClick={handleConfirmCsvImport}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-stone-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                {isImportingCsv ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {parsedCsv.rows.length} Satırı Şimdi İçe Aktar ({csvTarget === 'FARMERS' ? 'Çiftçi Carileri' : 'Depo Stok'})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cihaz Hafızasına Yerel Yedekleme & Otomatik Bulut Eşleme */}
      <div className="bg-stone-900 rounded-3xl p-6 border border-white/5 space-y-6">
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-emerald-300">Sıfır Veri Kaybı Zırhı: Yerel Hafıza + Bulut Eşleme ({CURRENT_MKS_VERSION})</h4>
              <p className="text-xs text-stone-400">İnternet yokken cihaz hafızasına anında kaydeder; internet geldiğinde bulutla otomatik eşler ve güncelleme öncesi mühürler.</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (currentUser) ensurePreUpdateSafetySnapshot(currentUser.uid);
              showToast('Cihaz hafızası güvenlik mühürü doğrulandı ve yenilendi!', 'success');
            }}
            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold shrink-0"
          >
            Şimdi Mühürle
          </button>
        </div>

        <div>
            <h3 className="text-lg font-bold text-white mb-2">Cihaz Hafızasına Yerel Yedekleme &amp; Bulut Eşleme</h3>
            <p className="text-sm text-stone-400 mb-4">Tüm uygulama verilerinizi (Çiftçi Cari, Depo Stok, BKTS/GTS, Reçeteler, Kasa) doğrudan kullandığınız cihazın hafızasına yedekleyebilir ve internet bağlantınız olduğunda bulutla anında eşleyebilirsiniz.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={handleExportData} className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-4 rounded-xl font-bold hover:bg-emerald-500/30 transition-all flex justify-center items-center gap-2">
                  <Download size={20} />
                  Cihaz Hafızasına Yedek Kaydet (.JSON)
              </button>
              <button
                disabled={isSendingTelegramBackup}
                onClick={async () => {
                  setIsSendingTelegramBackup(true);
                  try {
                    await dbService.flushSyncOutboxNow();
                    const rawJson = await dbService.exportData();
                    const parsed = JSON.parse(rawJson);
                    const res = await sendEncryptedBackupToTelegram(
                      parsed,
                      userProfile?.fullName || currentUser?.email || 'MKS Bayi'
                    );
                    showToast(res.message, res.ok ? 'success' : 'error');
                  } catch {
                    showToast('Yerel yedekleme sırasında bir hata oluştu.', 'error');
                  } finally {
                    setIsSendingTelegramBackup(false);
                  }
                }}
                className="w-full bg-sky-500/20 text-sky-300 border border-sky-500/30 p-4 rounded-xl font-bold hover:bg-sky-500/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
              >
                  {isSendingTelegramBackup ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                  Bulutla Eşle &amp; Cihaza Tam Yedek Al
              </button>
            </div>
        </div>
        <div className="h-px bg-white/5" />
        <div>
            <h3 className="text-lg font-bold text-white mb-2">Standart JSON Yedeği Yükle</h3>
            <p className="text-sm text-stone-400 mb-4">Daha önce aldığınız şifresiz .json yedeğini yükleyerek verilerinizi geri getirin.</p>
            <label className={`w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 p-4 rounded-xl font-bold hover:bg-blue-500/30 transition-all flex justify-center items-center gap-2 cursor-pointer ${isRestoringBackup ? 'opacity-50 pointer-events-none' : ''}`}>
                {isRestoringBackup ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                JSON Yedeği Yükle
                <input type="file" accept=".json" onChange={handleImportData} disabled={isRestoringBackup} className="hidden" />
            </label>
            <p className="text-[11px] text-stone-400 mt-2">Dosya seçmek verilerinizi değiştirmez; geri yüklemeden önce onayınız istenir ve mevcut verilerinizin güvenlik yedeği otomatik indirilir.</p>
        </div>
      </div>
    </div>
  );

  const renderGeneralSection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader(t('nav.group.general'), t('settings.language.desc'), Settings, "bg-blue-900/30 text-blue-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 space-y-6">
        {/* UI-42: Tema seçimi yalnızca "Tema (Görünüm)" bölümünde yapılır; buradaki ikinci "Hızlı Görünüm Modu" anahtarı kaldırıldı. */}
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
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => handleScaleChange(scaleOption)}
                          className={`flex-1 min-h-[44px] py-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all duration-300 ${
                              isActive 
                              ? 'bg-blue-600 text-white shadow-lg' 
                              : 'text-stone-400 hover:text-stone-300'
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
                      <p className="text-[11px] text-stone-400 font-bold uppercase">{t('settings.contrast.desc')}</p>
                  </div>
              </div>
              <button 
                type="button"
                role="switch"
                aria-checked={!!userProfile.highContrastMode}
                aria-label={t('settings.contrast')}
                onClick={() => updateUserProfile({ ...userProfile, highContrastMode: !userProfile.highContrastMode })}
                className="min-h-[44px] min-w-[44px] p-2.5 -m-2.5 flex items-center justify-center shrink-0"
              >
                  <span className={`block w-12 h-6 rounded-full relative transition-all duration-300 ${userProfile.highContrastMode ? 'bg-emerald-500' : 'bg-stone-800'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${userProfile.highContrastMode ? 'left-7' : 'left-1'}`}></span>
                  </span>
              </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderThemeSection = () => (
    <div className="pb-32 animate-in slide-in-from-right-8 duration-300 px-4 mt-6">
      {renderSectionHeader("Tasarım Modu Seçimi", "Seçtiğiniz tasarım modu tüm cihazlarınızda (Telefon, Web, Masaüstü) otomatik eşitlenir", Paintbrush, "bg-sky-900/30 text-sky-400")}
      
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5">
        {/* UI-43: Kısa başlık + açıklama alt satırı + mini renk önizlemesi; seçili durum temanın kendi vurgu rengiyle gösterilir */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Tasarım modu seçimi">
            {([
                { id: 'TECHNICAL', title: 'V8 Gece 3D Safir', subtitle: 'Kurulum varsayılanı • Obsidyen gece & neon safir', swatch: { canvas: '#030814', card: '#0d1c3c', accent: '#38bdf8' }, mode: 'DARK' as const },
                { id: 'GLASSY_V30', title: 'V30 Glassy Dashboard', subtitle: 'Apple visionOS dumanlı cam & 3D ikonlar', swatch: { canvas: '#26272c', card: '#3d3e43', accent: '#38bdf8' }, mode: 'DARK' as const },
                { id: 'APPLE', title: 'V22 Orman Studio', subtitle: 'Zümrüt, nane & mercan bento', swatch: { canvas: '#dfeae5', card: '#ffffff', accent: '#147a58' }, mode: 'LIGHT' as const },
                { id: 'LIGHT', title: 'V22 3D Safir Cam', subtitle: 'Elektrik safir & kristal cam', swatch: { canvas: '#e3eeff', card: '#f0f7ff', accent: '#0055ff' }, mode: 'LIGHT' as const },
                { id: 'ORGANIC', title: 'V26 Nova Mor Cam', subtitle: 'Royal indigo & lavanta cam', swatch: { canvas: '#eae4ff', card: '#f6f2ff', accent: '#6d28d9' }, mode: 'LIGHT' as const }
            ] as const).map((item, index) => {
                const current = userProfile.theme || 'TECHNICAL';
                const isActive = current === item.id || (item.id === 'TECHNICAL' && (current === 'DEFAULT' || (current as string) === 'MINIMAL'));

                return (
                    <button
                        key={item.id}
                        type="button"
                        aria-pressed={isActive}
                        aria-label={`${item.title} — ${item.subtitle}`}
                        onClick={() => updateUserProfile({ ...userProfile, theme: item.id as any, colorMode: item.mode })}
                        style={isActive ? { borderColor: 'var(--mks-accent-primary)', boxShadow: '0 0 0 2px var(--mks-accent-primary)' } : undefined}
                        className={`w-full min-h-[64px] py-3 px-3.5 rounded-2xl text-left transition-all duration-300 border flex items-center gap-3 ${
                            isActive
                            ? 'bg-stone-900 text-stone-100'
                            : 'bg-stone-950/50 border-stone-800 hover:bg-stone-900 text-stone-300'
                        }`}
                    >
                        {/* 48x28 mini önizleme: zemin + kart + vurgu */}
                        <span
                            aria-hidden="true"
                            className="relative shrink-0 w-12 h-7 rounded-md overflow-hidden border border-white/20 shadow-sm"
                            style={{ backgroundColor: item.swatch.canvas }}
                        >
                            <span className="absolute left-1 top-1 w-6 h-5 rounded-[3px]" style={{ backgroundColor: item.swatch.card }} />
                            <span className="absolute right-1 top-1 w-3 h-3 rounded-full" style={{ backgroundColor: item.swatch.accent }} />
                            <span className="absolute right-1 bottom-1 w-3 h-1 rounded-full" style={{ backgroundColor: item.swatch.accent, opacity: 0.6 }} />
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col">
                            <span className="text-sm font-bold leading-snug line-clamp-2">{index + 1}. {item.title}</span>
                            <span className="text-xs opacity-70 leading-snug line-clamp-2 mt-0.5">{item.subtitle}</span>
                        </span>
                        {isActive && (
                            <CheckCircle2 size={18} className="shrink-0" style={{ color: 'var(--mks-accent-primary)' }} aria-hidden="true" />
                        )}
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
                  <p className="text-[11px] text-purple-300/70 font-semibold leading-tight mt-1">Şifreli & tek seferlik sene devir işlemi</p>
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
                  <p className="text-[11px] text-emerald-300/70 font-semibold leading-tight mt-1">Devir raporları ve resmi bilançolar</p>
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
                  <p className="text-[11px] text-orange-300/70 font-semibold leading-tight mt-1">Depo stok durumunu senkronize edin</p>
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
                  <p className="text-[11px] text-rose-300/70 font-semibold leading-tight mt-1">Hesap verilerini kalıcı sıfırlayın</p>
              </div>
          </button>
        </div>
      </div>
    </div>
  );

  // UI-08/09: Donanım geri tuşu açık modalı kapatsın (alt bölüm işleyicisinden [55] daha yüksek öncelik)
  useBackHandler(isTurnoverModalOpen, () => {
    if (isVerifyingTurnoverPassword) return;
    setIsTurnoverModalOpen(false);
    setTurnoverPassword('');
    setTurnoverError(null);
  }, 'settings_turnover_modal', 70);
  useBackHandler(isAlreadyTurnedOverModalOpen, () => setIsAlreadyTurnedOverModalOpen(false), 'settings_already_turned_over_modal', 70);
  useBackHandler(turnoverCompletedYear !== null, () => setTurnoverCompletedYear(null), 'settings_turnover_done_modal', 70);
  useBackHandler(isYearEndDocsModalOpen, () => setIsYearEndDocsModalOpen(false), 'settings_year_end_docs_modal', 70);
  useBackHandler(isRebuildModalOpen, () => setIsRebuildModalOpen(false), 'settings_rebuild_modal', 70);
  useBackHandler(isDeleteDataModalOpen, () => {
    if (isDeletingData) return;
    setIsDeleteDataModalOpen(false);
    setDeletePassword('');
    setDeleteError(null);
  }, 'settings_delete_data_modal', 70);
  useBackHandler(pendingRestore !== null, () => setPendingRestore(null), 'settings_restore_confirm_modal', 75);

  return (
    <>
      {!activeSection && renderMainMenu()}
      {activeSection === 'GENERAL' && renderGeneralSection()}
      {activeSection === 'THEME' && renderThemeSection()}
      {activeSection === 'PRIVACY' && renderPrivacySection()}
      {activeSection === 'WHATSAPP_TEMPLATES' && renderWhatsAppTemplatesSection()}
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
                  <p className="text-[11px] text-purple-300 font-bold uppercase">Şifreli Güvenlik Doğrulaması</p>
                </div>
              </div>
              <button 
                type="button"
                aria-label="Devir penceresini kapat"
                onClick={() => {
                  setIsTurnoverModalOpen(false);
                  setTurnoverPassword('');
                  setTurnoverError(null);
                }}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-white bg-stone-800/80 hover:bg-stone-800 rounded-xl transition-colors"
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
                    aria-label={showTurnoverPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-stone-500 hover:text-stone-300 transition-colors"
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
              <p className="text-[11px] text-purple-200/80">
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
              <ul className="list-disc list-inside text-[11px] text-emerald-200/80 space-y-0.5">
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
          <div className="bg-stone-900 border border-emerald-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85dvh]">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 mt-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">Yıl Sonu Dokümanları & Devir Raporları</h3>
                  <p className="text-[11px] text-stone-400 font-medium">Sene sonu resmi bilançoları ve devir belgeleri arşivi</p>
                </div>
              </div>
              <button 
                type="button"
                aria-label="Yıl sonu dokümanları penceresini kapat"
                onClick={() => setIsYearEndDocsModalOpen(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-white bg-stone-800/80 hover:bg-stone-800 rounded-xl transition-colors"
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
                      <span className="text-[11px] font-bold text-emerald-400/90 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
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

      {/* AK-05: Yedekten geri yükleme onayı — onaylanınca önce otomatik güvenlik yedeği indirilir, sonra içe aktarılır */}
      <ConfirmationModal
        isOpen={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        onConfirm={handleConfirmRestore}
        title="Yedekten Geri Yükle"
        message={`Mevcut tüm yerel veriler yedektekiyle değiştirilecek${pendingRestore?.fileName ? ` („${pendingRestore.fileName}“)` : ''}. Devam ederseniz önce mevcut verilerinizin güvenlik yedeği (MKS_oncesi_yedek_….json) otomatik olarak indirilecek, ardından geri yükleme yapılacaktır. Onaylıyor musunuz?`}
        confirmText="Yedeği Al ve Geri Yükle"
        cancelText="Vazgeç"
        variant="danger"
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
              <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block">
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
                  aria-label={showDeletePassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-stone-500 hover:text-stone-300"
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
                className="flex-1 py-3.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-stone-800 disabled:text-stone-400 text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50"
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
