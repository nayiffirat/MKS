import React, { useState, useEffect, useRef } from 'react';
import {
  Home, Users, BookOpen, FileText, ClipboardList, Menu, X, LogOut,
  Settings, Bell, Phone, Plus, PieChart, Sprout, CalendarCheck,
  ChevronLeft, Package, Truck, CreditCard, Receipt, Wallet,
  History as HistoryIcon, Printer, Shield, Clock, Trash2,
  TrendingDown, Map, Sparkles, LineChart, Sun, Moon, FlaskConical, Calculator,
  LayoutGrid, Bookmark, Cloud, QrCode, Download, MessageSquare, Crown, ShieldCheck
} from 'lucide-react';
import { ViewState } from '../types';
import { MksBrandLogo } from './MksBrandLogo';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { QuickActions } from './QuickActions';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import { useBackHandler } from '../utils/navigationManager';
import { PdfQuickAccessModal } from './PdfQuickAccessModal';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

// UI-31: Başlıklar menü/ray etiketleriyle aynı sözlüğü kullanır (bkz. translations.ts `nav.*`).
const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  DASHBOARD: { title: 'Ana Panel', subtitle: 'Finans, müstahsil, stok ve saha özeti' },
  FARMERS: { title: 'Müstahsiller', subtitle: 'Çiftçi kayıtları, arazi ve cari bakiye' },
  PRESCRIPTIONS: { title: 'Satış ve Reçeteler', subtitle: 'Faturalar, vadeli/peşin satışlar ve iadeler' },
  PRESCRIPTION_NEW: { title: 'Yeni Satış / Reçete', subtitle: 'Stoktan otomatik düşümlü satış kaydı' },
  PRESCRIPTION_LIST: { title: 'Satış Listesi', subtitle: 'Kesilen tüm reçete ve faturalar' },
  INVENTORY: { title: 'Depo ve Stok', subtitle: 'İlaç, gübre, parti ve maliyet takibi' },
  KASA: { title: 'Kasa ve Banka', subtitle: 'Nakit akışı, POS ve hesap mutabakatı' },
  PAYMENTS: { title: 'Tahsilat ve Çekler', subtitle: 'Ödemeler, çek, senet ve kart vadeleri' },
  SUPPLIERS: { title: 'Tedarikçiler', subtitle: 'Firma cari hesapları ve mal alım faturaları' },
  DEBT_TRACKING: { title: 'Alacak ve Risk Takibi', subtitle: 'Vadesi gelen alacaklar ve arama listesi' },
  SILO: { title: 'Silo ve Tüccar', subtitle: 'Hububat alım-satım, kantar ve tonaj takibi' },
  MAP: { title: 'Parsel ve Uydu Haritası', subtitle: 'TKGM ada/parsel sorgusu ve Sentinel-2 analizi' },
  AI_ASSISTANT: { title: 'Zirai Asistan', subtitle: 'Teşhis ve stok duyarlı reçete önerisi' },
  MKS_MUHENDISIM: { title: 'MKS Mühendisim', subtitle: 'Bitki besleme ve fenolojik evre rehberi' },
  SMART_STOCK: { title: 'Stok Tahmini', subtitle: 'Sezonsal ihtiyaç ve kritik stok analizi' },
  VISITS: { title: 'Tarla Ziyaretleri', subtitle: 'Saha gözlem ve teknik kontroller' },
  PESTICIDES: { title: 'İlaç Kütüphanesi', subtitle: 'Etken madde ve dozaj veri tabanı' },
  PLANTS: { title: 'Bitki Rehberi', subtitle: 'Hasat vadeleri ve ürün tanımları' },
  EXPENSES: { title: 'Giderler', subtitle: 'Masraf kayıtları ve kategori analizi' },
  STATISTICS: { title: 'İstatistikler', subtitle: 'Karlılık, ciro ve dağılım grafikleri' },
  REPORTS: { title: 'PDF Raporlar', subtitle: 'Ekstre ve dönem sonu çıktıları' },
  RECENT_TRANSACTIONS: { title: 'Son İşlemler', subtitle: 'Kronolojik işlem geçmişi' },
  REMINDERS: { title: 'Ajanda ve Görevler', subtitle: 'Saha ajandası ve tahsilat planı' },
  NOTIFICATIONS: { title: 'Bildirimler', subtitle: 'Vade, arama listesi, hava ve sürüm uyarıları' },
  CALCULATOR: { title: 'Dozaj Hesaplayıcı', subtitle: 'Dekar, tank ve karışım hesabı' },
  SETTINGS: { title: 'Ayarlar', subtitle: 'Tema, bildirim, yedekleme ve profil yönetimi' },
  PROFILE: { title: 'Kurumsal Profil', subtitle: 'Firma bilgileri ve dijital kaşe' },
  ADMIN_PANEL: { title: 'Yönetim Paneli', subtitle: 'Kullanıcı ve lisans yönetimi' },
  TRASH: { title: 'Çöp Kutusu', subtitle: 'Silinen kayıtları geri yükleme merkezi' },
  CONTACT: { title: 'Destek Hattı', subtitle: 'Teknik destek ve iletişim hattı' },
  NEWS: { title: 'Zirai Duyurular', subtitle: 'Sektörel gelişmeler ve güncellemeler' },
  USER_GUIDE: { title: 'Kullanım Kılavuzu', subtitle: 'Adım adım görselli uygulama rehberi' }
};

type LayoutTheme = 'GLASSY_V30' | 'APPLE' | 'LIGHT' | 'ORGANIC' | 'TECHNICAL';

/** Aktif temanın zemin rengi — tarayıcı/PWA durum çubuğu (`theme-color`) bununla eşlenir (UI-14/UI-40). */
const THEME_CANVAS_BG: Record<LayoutTheme, string> = {
  APPLE: '#dfeae5',
  LIGHT: '#e3eeff',
  ORGANIC: '#eae4ff',
  GLASSY_V30: '#26272c',
  TECHNICAL: '#030814'
};

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [hoveredRailId, setHoveredRailId] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (window as any).mks_open_pdf_modal = () => setIsPdfModalOpen(true);
    return () => {
      delete (window as any).mks_open_pdf_modal;
    };
  }, []);

  useBackHandler(isMobileMenuOpen, () => setIsMobileMenuOpen(false), 'mobile_menu', 65);

  const {
    unreadCount,
    userProfile,
    stats,
    isAdmin,
    subscriptionEndsAt,
    activeTeamMember,
    setActiveTeamMember,
    t
  } = useAppViewModel();
  const { logout } = useAuth();
  const isHighContrast = userProfile.highContrastMode;
  const isSales = activeTeamMember?.role === 'SALES';
  const rawTheme = userProfile.theme || 'TECHNICAL';
  const currentTheme: LayoutTheme =
    rawTheme === 'GLASSY_V30'
      ? 'GLASSY_V30'
      : rawTheme === 'MINIMAL' || rawTheme === 'TECHNICAL'
      ? 'TECHNICAL'
      : rawTheme === 'LIGHT'
      ? 'LIGHT'
      : rawTheme === 'ORGANIC'
      ? 'ORGANIC'
      : rawTheme === 'APPLE'
      ? 'APPLE'
      : 'TECHNICAL';

  // UI-14/UI-40: Tarayıcı/PWA durum çubuğu rengi aktif temayı izlesin (index.html ilk boyamada aynı eşlemeyi yapar).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_CANVAS_BG[currentTheme]);
  }, [currentTheme]);

  // UI-29: Yapışkan üst bar yüksekliği CSS değişkenine yazılır; ekranların kendi `sticky top-0` başlıkları bunun altına oturur.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof document === 'undefined') return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--mks-layout-header-h', `${el.offsetHeight}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', apply);
      return () => {
        window.removeEventListener('resize', apply);
        root.style.removeProperty('--mks-layout-header-h');
      };
    }
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--mks-layout-header-h');
    };
  }, []);

  // Çekmece açılınca odağı kapat butonuna taşı (klavye / ekran okuyucu)
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const timer = window.setTimeout(() => drawerCloseRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [isMobileMenuOpen]);

  // Vertical Pill Rail Items — Sticky across ALL screens on Web/Desktop (md..lg kompakt ikon rayı)
  const pillRailItems = [
    { id: 'DASHBOARD', icon: LayoutGrid, label: t('nav.dashboard') || 'Ana Panel' },
    { id: 'FARMERS', icon: Users, label: t('nav.farmers') || 'Müstahsiller' },
    { id: 'PRESCRIPTIONS', icon: FileText, label: t('nav.prescriptions') || 'Satış ve Reçeteler' },
    { id: 'INVENTORY', icon: Package, label: t('nav.inventory') || 'Depo ve Stok' },
    { id: 'MAP', icon: Map, label: 'Parsel ve Uydu Haritası' },
    { id: 'KASA', icon: Wallet, label: t('nav.kasa') || 'Kasa ve Banka' },
    { id: 'PAYMENTS', icon: CreditCard, label: t('nav.payments') || 'Tahsilat ve Çekler' },
    { id: 'SUPPLIERS', icon: Truck, label: t('nav.suppliers') || 'Tedarikçiler' },
    { id: 'SILO', icon: Sprout, label: 'Silo ve Tüccar' },
    { id: 'AI_ASSISTANT', icon: Sparkles, label: 'Zirai Asistan' },
    { id: 'STATISTICS', icon: PieChart, label: t('nav.statistics') || 'İstatistikler' },
    { id: 'SETTINGS', icon: Settings, label: t('nav.settings') || 'Ayarlar' }
  ];

  const navGroups = [
    {
      title: 'Komuta ve Finans',
      items: [
        { id: 'DASHBOARD', icon: Home, label: t('nav.dashboard') || 'Ana Panel' },
        { id: 'FARMERS', icon: Users, label: t('nav.farmers') || 'Müstahsiller' },
        { id: 'PRESCRIPTIONS', icon: FileText, label: t('nav.prescriptions') || 'Satış ve Reçeteler' },
        { id: 'DEBT_TRACKING', icon: TrendingDown, label: 'Alacak ve Risk Takibi' },
        { id: 'KASA', icon: Wallet, label: t('nav.kasa') || 'Kasa ve Banka' },
        { id: 'PAYMENTS', icon: CreditCard, label: t('nav.payments') || 'Tahsilat ve Çekler' },
        { id: 'EXPENSES', icon: Receipt, label: t('nav.expenses') || 'Giderler' }
      ]
    },
    {
      title: 'Depo ve Tedarik',
      items: [
        { id: 'INVENTORY', icon: Package, label: t('nav.inventory') || 'Depo ve Stok' },
        { id: 'SUPPLIERS', icon: Truck, label: t('nav.suppliers') || 'Tedarikçiler' },
        { id: 'SILO', icon: Sprout, label: 'Silo ve Tüccar' },
        { id: 'PESTICIDES', icon: BookOpen, label: t('nav.pesticides') || 'İlaç Kütüphanesi' }
      ]
    },
    {
      title: 'Saha ve Zirai Araçlar',
      items: [
        { id: 'MAP', icon: Map, label: 'Parsel ve Uydu Haritası' },
        { id: 'VISITS', icon: ClipboardList, label: t('nav.visits') || 'Tarla Ziyaretleri' },
        { id: 'AI_ASSISTANT', icon: Sparkles, label: 'Zirai Asistan' },
        { id: 'MKS_MUHENDISIM', icon: FlaskConical, label: 'MKS Mühendisim' },
        { id: 'CALCULATOR', icon: Calculator, label: t('nav.calculator') || 'Dozaj Hesaplayıcı' },
        { id: 'SMART_STOCK', icon: LineChart, label: 'Stok Tahmini' }
      ]
    },
    {
      title: 'Analiz ve Sistem',
      items: [
        { id: 'STATISTICS', icon: PieChart, label: t('nav.statistics') || 'İstatistikler' },
        { id: 'REPORTS', icon: Printer, label: t('nav.reports') || 'PDF Raporlar' },
        { id: 'RECENT_TRANSACTIONS', icon: HistoryIcon, label: t('nav.recent') || 'Son İşlemler' },
        { id: 'REMINDERS', icon: CalendarCheck, label: t('nav.reminders') || 'Ajanda ve Görevler', badge: stats.activeReminders },
        { id: 'NOTIFICATIONS', icon: Bell, label: t('nav.notifications') || 'Bildirimler', badge: unreadCount },
        { id: 'TRASH', icon: Trash2, label: t('nav.trash') || 'Çöp Kutusu' },
        { id: 'USER_GUIDE', icon: BookOpen, label: 'Kullanım Kılavuzu' },
        { id: 'CONTACT', icon: Phone, label: t('nav.contact') || 'Destek Hattı' },
        { id: 'SETTINGS', icon: Settings, label: t('nav.settings') || 'Ayarlar' }
      ]
    }
  ];

  if (isAdmin) {
    navGroups.push({
      title: t('nav.group.admin') || 'Yönetim',
      items: [{ id: 'ADMIN_PANEL', icon: Shield, label: t('nav.admin') || 'Yönetim Paneli' }]
    });
  }

  const filteredNavGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (isSales) {
          const hiddenForSales = ['RECENT_TRANSACTIONS', 'REPORTS', 'KASA', 'SUPPLIERS', 'PAYMENTS'];
          if (hiddenForSales.includes(item.id)) return false;
        }
        return true;
      })
    }))
    .filter(group => group.items.length > 0);

  const isViewActive = (id: string) =>
    currentView === id ||
    (id === 'PRESCRIPTIONS' &&
      ((currentView as string) === 'PRESCRIPTION_NEW' || (currentView as string) === 'PRESCRIPTION_LIST'));

  const handleNavClick = (view: ViewState) => {
    onNavigate(view);
    setIsMobileMenuOpen(false);
  };

  // AK-01: Yerel veri temizliği yalnızca AuthContext.logout içinde (önce senkron kuyruğu boşaltılır, sonra temizlenir).
  // Burada ayrıca clearLocalUserData() çağırmak bekleyen outbox kayıtlarını buluta gitmeden siliyordu.
  const handleLogout = async () => {
    try {
      setActiveTeamMember(null);
      await logout();
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const activeHeader = VIEW_TITLES[currentView] || {
    title: userProfile.companyName || 'MKS Kurumsal V30',
    subtitle: 'Mühendis & Bayi Yönetim Sistemi'
  };

  const themeBadgeLabel =
    currentTheme === 'GLASSY_V30'
      ? 'V30 GLASSY'
      : currentTheme === 'APPLE'
      ? 'V22 ORMAN'
      : currentTheme === 'LIGHT'
      ? 'V22 3D SAFİR'
      : currentTheme === 'ORGANIC'
      ? 'V26 NOVA'
      : 'V8 GECE';

  // UI-19: Kapalı çekmece klavye/ekran okuyucu odağından tamamen çıkarılır (React 18: inert öznitelik olarak string).
  const drawerInertProps = (isMobileMenuOpen ? {} : { inert: '' }) as React.HTMLAttributes<HTMLDivElement>;

  return (
    <div
      className={`min-h-dvh md:h-[calc(100dvh-var(--mks-titlebar-offset,0px))] md:max-h-[calc(100dvh-var(--mks-titlebar-offset,0px))] md:overflow-hidden relative font-sans flex flex-col p-1.5 sm:p-2.5 lg:p-3.5 ${
        isHighContrast ? 'high-contrast' : ''
      }`}
    >
      {/* ==================== OUTER FLOATING V22 WORKSPACE SHELL ==================== */}
      <div className="v22-workspace-shell flex-1 md:h-full md:min-h-0 flex rounded-[28px] sm:rounded-[32px] border relative overflow-visible md:overflow-hidden">
        {/* ==================== 1. FIXED DESKTOP & WEB LEFT SIDEBAR (Sabit, Hareketsiz, Etiketli) ==================== */}
        <aside
          aria-label="Ana gezinme"
          className="hidden md:flex flex-col items-stretch py-3 pl-3 pr-2 shrink-0 z-40 h-full min-h-0 select-none"
        >
          <div className="v22-pill-rail mks-rail-wide w-56 xl:w-60 h-full min-h-0 flex flex-col items-stretch justify-between py-3.5 px-3 relative overflow-hidden">
            {/* Top Brand Header (Fixed, No Jump/Scale on Hover) */}
            <button
              type="button"
              onClick={() => handleNavClick('DASHBOARD')}
              title="MKS Ana Panel"
              aria-label="MKS Ana Panel"
              className="w-full min-h-[48px] shrink-0 rounded-2xl flex items-center justify-start gap-3 px-1.5 py-1.5 pb-3 border-b border-white/10 transition-colors hover:bg-white/5"
            >
              <MksBrandLogo size="lg" rounded="2xl" className="border-emerald-400/30 shadow-md shrink-0" />
              <span className="flex flex-col min-w-0 text-left v22-keep-white">
                <span className="text-sm font-extrabold tracking-tight truncate">MKS Kurumsal</span>
                <span className="text-[11px] font-semibold opacity-80 truncate">
                  {userProfile.companyName || 'Mühendis Kayıt Sistemi'}
                </span>
              </span>
            </button>

            {/* Etiketli, gruplu kalıcı sol menü (yazılar her zaman görünür, altta kalmaz, kaydırma alanı korumalı) */}
            <nav
              aria-label="Tüm modüller"
              className="flex-1 min-h-0 flex flex-col gap-3 my-2 w-full overflow-y-auto overscroll-contain pr-0.5 py-1 pb-4"
            >
              {filteredNavGroups.map(group => (
                <div key={group.title} className="shrink-0">
                  <p className="v22-keep-white px-2.5 mb-1 text-[11px] font-bold uppercase tracking-wider opacity-70">
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map(item => {
                      const active = isViewActive(item.id);
                      const badge = (item as { badge?: number }).badge;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => handleNavClick(item.id as ViewState)}
                          aria-current={active ? 'page' : undefined}
                          className={`v22-keep-white w-full min-h-[38px] flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[13px] text-left transition-colors ${
                            active
                              ? 'bg-sky-500/25 border border-sky-400/40 font-bold text-white shadow-sm'
                              : 'font-semibold opacity-85 hover:opacity-100 hover:bg-white/10'
                          }`}
                        >
                          <item.icon size={16} className="shrink-0" />
                          <span className="flex-1 truncate leading-snug">{item.label}</span>
                          {badge !== undefined && badge > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#f39264] text-[#0b211d] text-[11px] font-black flex items-center justify-center tabular-nums">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Bottom Rail Controls: Fixed Footer (Üstteki yazılar asla bunun altına girmez) */}
            <div className="flex flex-col items-stretch gap-1.5 pt-2.5 border-t border-white/10 shrink-0 z-10">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                title="Tüm Modüller (30+ Ekran)"
                aria-label="Tüm modüller"
                aria-haspopup="dialog"
                aria-expanded={isMobileMenuOpen}
                className="v22-keep-white w-full min-h-[40px] px-2.5 justify-start gap-2.5 rounded-xl text-white/85 hover:text-white hover:bg-white/10 flex items-center transition-colors"
              >
                <Menu size={16} className="shrink-0" />
                <span className="text-[13px] font-semibold truncate">Hızlı Erişim Menüsü</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="Oturumu Kapat"
                aria-label={t('nav.logout') || 'Oturumu Kapat'}
                className="w-full min-h-[40px] px-2.5 justify-start gap-2.5 rounded-xl text-rose-300 hover:text-rose-200 hover:bg-rose-500/25 flex items-center transition-colors"
              >
                <LogOut size={16} className="shrink-0" />
                <span className="text-[13px] font-semibold truncate">{t('nav.logout') || 'Oturumu Kapat'}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ==================== 2. MAIN WORKSPACE COLUMN ==================== */}
        {/* UI-06/UI-24: Masaüstünde yalnız bu sütun kayar; sol bar sabit kalır */}
        <div className="flex-1 flex flex-col min-w-0 md:h-full md:min-h-0 md:overflow-y-auto overscroll-contain px-2.5 sm:px-5 lg:px-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-6">
          {/* Top Navigation Bar — UI-05/UI-29: yapışkan + üst güvenli alan (çentik/durum çubuğu) */}
          <header
            ref={headerRef}
            className="mks-sticky-header sticky top-0 z-30 -mx-2.5 sm:-mx-5 lg:-mx-6 px-2.5 sm:px-5 lg:px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2.5 sm:pb-3 mb-2 sm:mb-3 rounded-t-[26px] sm:rounded-t-[32px] md:rounded-tl-none flex items-center justify-between gap-2 sm:gap-3 min-w-0"
          >
            {/* Left: Back Button (Mobile + Desktop) + Clean Title */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              {currentView !== 'DASHBOARD' ? (
                <button
                  type="button"
                  onClick={() => {
                    if ((window as any).mks_smart_step_back) {
                      (window as any).mks_smart_step_back();
                    } else {
                      onNavigate('DASHBOARD');
                    }
                  }}
                  title="Önceki ekrana dön (ESC)"
                  aria-label="Önceki ekrana dön"
                  data-mks-screen-back="true"
                  className="v22-surface-pill min-h-[44px] min-w-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl sm:rounded-full shadow-sm active:scale-95 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold shrink-0"
                >
                  <ChevronLeft size={18} />
                  <span className="hidden sm:inline">Geri dön</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNavClick('PROFILE')}
                  aria-label="Kurumsal profil"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center md:hidden shrink-0 active:scale-95 transition-transform"
                >
                  <MksBrandLogo size="md" rounded="xl" className="border-emerald-500/30" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-[15px] sm:text-base font-semibold tracking-tight truncate">
                    {currentView === 'DASHBOARD'
                      ? userProfile.companyName || 'Ana Panel'
                      : activeHeader.title}
                  </h1>
                  <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold opacity-80 border border-current/15 shrink-0">
                    {themeBadgeLabel}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[color:var(--mks-muted)] font-medium truncate">
                  {activeHeader.subtitle}
                </p>
              </div>
            </div>

            {/* Center: Desktop Capsule Dock (xl+ kalıcı kenar çubuğu zaten tüm modülleri gösterdiği için 2xl+) */}
            {!(currentTheme === 'GLASSY_V30' && currentView === 'DASHBOARD') && (
              <div className="hidden 2xl:flex items-center cxr-capsule-dock px-2 py-1.5 gap-1 shrink-0">
                {[
                  { id: 'DASHBOARD', label: 'Ana Panel', icon: Home },
                  { id: 'FARMERS', label: 'Müstahsiller', icon: Users },
                  { id: 'PRESCRIPTIONS', label: 'Reçeteler', icon: FileText },
                  { id: 'INVENTORY', label: 'Depo', icon: Package },
                  { id: 'KASA', label: 'Kasa', icon: Wallet },
                  { id: 'STATISTICS', label: 'Analitik', icon: PieChart }
                ]
                  .filter(it => !(isSales && ['KASA'].includes(it.id)))
                  .map(tab => {
                    const active = isViewActive(tab.id);
                    return (
                      <button
                        type="button"
                        key={tab.id}
                        onClick={() => handleNavClick(tab.id as ViewState)}
                        aria-current={active ? 'page' : undefined}
                        className={`px-3.5 py-1.5 min-h-[36px] rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          active
                            ? currentTheme === 'LIGHT'
                              ? 'cxr-pill-active'
                              : 'v22-dark-pill shadow-sm'
                            : 'v22-dock-tab'
                        }`}
                      >
                        <tab.icon size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Right: Mobile keeps 3 clean 44px controls (BKTS, Bildirim, Menü); Desktop shows full bar */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleNavClick('USER_GUIDE')}
                title="Görselli Kullanım Kılavuzu"
                aria-label="Kullanım kılavuzu"
                className="hidden sm:flex v22-surface-pill min-h-[44px] min-w-[44px] px-3 py-2 rounded-full shadow-sm items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-colors"
              >
                <BookOpen size={16} className="text-sky-500" />
                <span className="hidden md:inline">Kılavuz</span>
              </button>

              <button
                type="button"
                onClick={() => (window as any).mks_open_ministry?.('malkabul')}
                title="Tarım Bakanlığı BKTS / GTS / Karekod"
                aria-label="BKTS / GTS karekod işlemleri"
                className="v22-surface-pill min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl sm:rounded-full shadow-sm flex items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-colors"
              >
                <QrCode size={17} className="text-emerald-500" />
                <span className="hidden sm:inline">BKTS / GTS</span>
              </button>

              <button
                type="button"
                onClick={() => (window as any).mks_open_edm?.('incoming')}
                title="EDM e-Fatura Deposu"
                aria-label="EDM e-Fatura deposu"
                className="hidden sm:flex v22-surface-pill min-h-[44px] min-w-[44px] px-3 py-2 rounded-full shadow-sm items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-colors"
              >
                <Receipt size={16} className="text-indigo-400" />
                <span className="hidden md:inline">EDM e-Fatura</span>
              </button>

              {/* Kalıcı PDF İndirilenler Butonu - Her zaman görünür ve dikkat çekici */}
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                title="İndirilen PDF Belgeleri, Faturalar ve Raporlar (Tarih Sırasıyla)"
                aria-label="İndirilen PDF Belgeleri"
                className="v22-surface-pill min-h-[44px] px-3 sm:px-3.5 py-2 rounded-xl sm:rounded-full shadow-md flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all cursor-pointer border border-rose-400/50"
              >
                <div className="w-5 h-5 rounded-md bg-white text-rose-600 flex items-center justify-center text-[10px] font-black shrink-0 shadow-xs">
                  PDF
                </div>
                <span className="font-extrabold text-white text-xs">PDF</span>
                <span className="hidden md:inline text-[11px] text-rose-100 font-semibold">İndirilenler</span>
              </button>

              <button
                type="button"
                onClick={() => (window as any).mks_open_web_portal?.('download')}
                title="Uygulamayı İndir ve Paketler"
                className="hidden xl:flex v22-surface-pill min-h-[44px] px-3 py-2 rounded-full shadow-sm items-center gap-1.5 text-xs font-semibold active:scale-95 transition-colors"
              >
                <Crown size={16} className="text-amber-500" />
                <span>Paketler</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('NOTIFICATIONS')}
                aria-label={unreadCount > 0 ? `Bildirimler (${unreadCount} okunmamış)` : 'Bildirimler'}
                className="v22-surface-pill relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl sm:rounded-full shadow-sm flex items-center justify-center active:scale-95 transition-colors"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#f39264] text-[#0b211d] text-[11px] font-bold flex items-center justify-center rounded-full border-2 border-white tabular-nums leading-none"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Tüm modüller"
                aria-haspopup="dialog"
                aria-expanded={isMobileMenuOpen}
                className="v22-dark-pill xl:hidden min-h-[44px] min-w-[44px] px-3 sm:px-3.5 py-2 rounded-xl sm:rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-colors"
              >
                <Menu size={17} />
                <span className="hidden sm:inline">Modüller</span>
              </button>
            </div>
          </header>

          {/* Device Notification Consent Banner (Phone + Desktop + Web) */}
          <NotificationPermissionBanner />

          {/* Main Screen Content */}
          <main className="flex-1 w-full max-w-[1440px] mx-auto min-w-0">
            {children}
          </main>
        </div>
      </div>

      {/* ==================== SLIDE-OVER COMMAND DRAWER (ALL 30+ MKS MODULES) ==================== */}
      {isMobileMenuOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 top-[var(--mks-titlebar-offset,0px)] bg-black/55 z-[130] backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tüm modüller"
        aria-hidden={!isMobileMenuOpen}
        {...drawerInertProps}
        className={`v22-drawer-panel fixed top-[var(--mks-titlebar-offset,0px)] bottom-0 right-0 h-[calc(100dvh-var(--mks-titlebar-offset,0px))] max-h-[calc(100dvh-var(--mks-titlebar-offset,0px))] w-[88%] max-w-[355px] z-[150] transform transition-[transform,visibility] duration-300 ease-out flex flex-col border-l pt-[max(0.75rem,env(safe-area-inset-top))] overflow-hidden ${
          isMobileMenuOpen ? 'translate-x-0 visible shadow-2xl' : 'translate-x-full invisible pointer-events-none'
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Kurumsal profili aç"
          onClick={() => handleNavClick('PROFILE')}
          onKeyDown={e => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNavClick('PROFILE');
            }
          }}
          className="v22-forest-card mx-3 mb-2 p-4 rounded-3xl relative shrink-0 cursor-pointer"
        >
          <button
            ref={drawerCloseRef}
            type="button"
            onClick={e => {
              e.stopPropagation();
              setIsMobileMenuOpen(false);
            }}
            aria-label={t('common.close') || 'Kapat'}
            data-mks-modal-close="true"
            className="v22-keep-white absolute top-2.5 right-2.5 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/15 rounded-full text-white hover:bg-white/25"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 pr-11">
            <MksBrandLogo size="lg" rounded="2xl" className="border-emerald-400/30 shadow-md shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="v22-keep-white font-extrabold text-sm text-white truncate">
                {userProfile.fullName || 'Ziraat Mühendisi'}
              </h2>
              <p className="v22-keep-white opacity-85 text-[11px] uppercase tracking-wider font-bold truncate mt-0.5">
                {userProfile.companyName || 'MKS Yönetim Sistemi'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-3 pb-6 space-y-4">
          {/* Quick Enterprise Actions in Drawer (2x2 Mobile Touch Grid) */}
          <div className="grid grid-cols-2 gap-2 px-1">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                (window as any).mks_open_ministry?.('malkabul');
              }}
              className="v22-drawer-item min-h-[46px] px-3 py-2 rounded-2xl flex items-center gap-2 text-left font-semibold text-xs"
            >
              <QrCode size={16} className="text-emerald-500 shrink-0" />
              <span className="truncate">BKTS / GTS</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                (window as any).mks_open_edm?.('incoming');
              }}
              className="v22-drawer-item min-h-[46px] px-3 py-2 rounded-2xl flex items-center gap-2 text-left font-semibold text-xs"
            >
              <Receipt size={16} className="text-indigo-400 shrink-0" />
              <span className="truncate">EDM e-Fatura</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                (window as any).mks_open_web_portal?.('download');
              }}
              className="v22-drawer-item min-h-[46px] px-3 py-2 rounded-2xl flex items-center gap-2 text-left font-semibold text-xs"
            >
              <Crown size={16} className="text-amber-500 shrink-0" />
              <span className="truncate">İndir / Paket</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                (window as any).mks_open_live_support?.('general');
              }}
              className="v22-drawer-item min-h-[46px] px-3 py-2 rounded-2xl flex items-center gap-2 text-left font-semibold text-xs"
            >
              <MessageSquare size={16} className="text-sky-500 shrink-0" />
              <span className="truncate">Canlı Destek</span>
            </button>
          </div>

          {filteredNavGroups.map((group, idx) => (
            <div key={idx}>
              <h3 className="px-2.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--mks-muted)] mb-1.5">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map(item => {
                  const isAct = currentView === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => handleNavClick(item.id as ViewState)}
                      aria-current={isAct ? 'page' : undefined}
                      className={`w-full min-h-[42px] flex items-center justify-between px-3.5 py-2 rounded-2xl transition-colors ${
                        isAct
                          ? currentTheme === 'LIGHT'
                            ? 'cxr-pill-active font-bold shadow-sm'
                            : 'v22-dark-pill font-bold shadow-sm'
                          : 'v22-drawer-item font-semibold'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <item.icon size={16} />
                        <span className="text-[13px]">{item.label}</span>
                      </div>
                      {(item as any).badge !== undefined && (item as any).badge > 0 && (
                        <span className="bg-[#f39264] text-[#0b211d] text-[11px] font-black px-2 py-0.5 rounded-full">
                          {(item as any).badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Fixed Drawer Footer — Never Overlaps Scrollable Nav Items */}
        <div className="shrink-0 border-t border-white/10 bg-[color:var(--mks-modal-bg)] pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 space-y-2 z-10">
          {!isAdmin && (
            <div>
              <SubscriptionTimer endsAt={subscriptionEndsAt} t={t} />
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[46px] py-2.5 rounded-2xl bg-rose-500/15 text-rose-500 font-extrabold text-xs flex items-center justify-center hover:bg-rose-500/25 transition-colors"
          >
            <LogOut size={15} className="mr-2" /> {t('nav.logout') || 'Oturumu Kapat'}
          </button>
        </div>
      </div>

      {/* ==================== MOBILE FLOATING CODEXR V22 CAPSULE DOCK ==================== */}
      {/* UI-24: Tek güvenli alan mekanizması — çift boşluk/inline stil yok */}
      <nav
        aria-label="Alt gezinme"
        className="md:hidden fixed left-2.5 right-2.5 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 cxr-capsule-dock px-2 py-1.5"
      >
        <div className="flex justify-around items-center max-w-md mx-auto min-h-[52px] gap-1">
          <MobileCapsuleTab
            active={currentView === 'DASHBOARD'}
            onClick={() => onNavigate('DASHBOARD')}
            icon={Home}
            label="Panel"
            isBlueCover={currentTheme === 'LIGHT'}
          />
          <MobileCapsuleTab
            active={currentView === 'FARMERS'}
            onClick={() => onNavigate('FARMERS')}
            icon={Users}
            label="Müstahsil"
            isBlueCover={currentTheme === 'LIGHT'}
          />
          <QuickActions />
          <MobileCapsuleTab
            active={isViewActive('PRESCRIPTIONS')}
            onClick={() => onNavigate('PRESCRIPTIONS')}
            icon={FileText}
            label="Satış"
            isBlueCover={currentTheme === 'LIGHT'}
          />
          <MobileCapsuleTab
            active={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(true)}
            icon={Menu}
            label="Menü"
            isBlueCover={currentTheme === 'LIGHT'}
          />
        </div>
      </nav>

      {/* PDF Hızlı Erişim ve Yazdırma Modalı */}
      <PdfQuickAccessModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} />
    </div>
  );
};

const MobileCapsuleTab = ({
  active,
  onClick,
  icon: Icon,
  label,
  isBlueCover
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  isBlueCover?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`flex flex-col items-center justify-center py-2 min-h-[48px] px-2 rounded-2xl flex-1 min-w-0 transition-all active:scale-95 ${
      active
        ? isBlueCover
          ? 'cxr-pill-active'
          : 'v22-dark-pill shadow-md'
        : 'v22-dock-tab'
    }`}
  >
    <Icon size={18} strokeWidth={active ? 2.4 : 2} />
    <span className="text-[11px] font-extrabold mt-1 leading-none truncate max-w-full">{label}</span>
  </button>
);

const SubscriptionTimer = ({ endsAt, t }: { endsAt: string; t: (key: string) => string }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number }>({
    days: 0,
    hours: 0,
    minutes: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endsAt).getTime();
      const now = new Date().getTime();
      const difference = end - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        setTimeLeft({ days, hours, minutes });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(timer);
  }, [endsAt]);

  // UI-32: "3g : 4s : 12d" yerine açık biçim → "3 gün 4 sa 12 dk"
  const dayLabel = t('subscription.days') || 'gün';
  const hourLabel = t('subscription.hours') || 'sa';
  const minuteLabel = t('subscription.minutes') || 'dk';
  const countdown = `${timeLeft.days} ${dayLabel} ${timeLeft.hours} ${hourLabel} ${timeLeft.minutes} ${minuteLabel}`;

  return (
    <div className="v22-drawer-item min-h-[44px] p-2.5 rounded-2xl flex items-center justify-between gap-2 px-4">
      <div className="flex items-center gap-1.5 text-emerald-500 min-w-0">
        <Clock size={14} className="shrink-0" />
        <span className="text-[11px] uppercase tracking-wider font-extrabold truncate">{t('nav.subscription.remaining')}</span>
      </div>
      <div className="font-mono text-xs font-extrabold whitespace-nowrap tabular-nums" aria-label={countdown}>
        {countdown}
      </div>
    </div>
  );
};
