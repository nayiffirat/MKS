
import React, { useState, useEffect } from 'react';
import { Home, Users, BookOpen, FileText, ClipboardList, Menu, X, LogOut, Settings, ChevronRight, User, Bell, Phone, UserCircle, Plus, PieChart, Sprout, CalendarCheck, ChevronLeft, Package, Truck, CreditCard, Receipt, Wallet, Bot, History as HistoryIcon, Printer, Shield, Clock, MessageCircle, Trash2 } from 'lucide-react';
import { ViewState } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/db';

import { QuickActions } from './QuickActions';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { unreadCount, userProfile, stats, isAdmin, subscriptionEndsAt, activeTeamMember, setActiveTeamMember, t, farmerLabel, farmerPluralLabel, prescriptionLabel } = useAppViewModel();
  const { logout } = useAuth();
  const isHighContrast = userProfile.highContrastMode;
  const isCompany = userProfile.accountType === 'COMPANY';
  
  const isSales = activeTeamMember?.role === 'SALES';
  const isDealer = userProfile.accountType === 'DEALER';
  
  const navGroups = [
    { title: t('nav.group.general') || "Genel", items: [{ id: 'DASHBOARD', icon: Home, label: t('nav.dashboard') }, { id: 'RECENT_TRANSACTIONS', icon: HistoryIcon, label: t('nav.recent') || 'Son İşlemler' }, { id: 'REPORTS', icon: Printer, label: t('nav.reports') }, { id: 'REMINDERS', icon: CalendarCheck, label: t('nav.reminders') || 'Hatırlatıcılar', badge: stats.activeReminders }, { id: 'KASA', icon: Wallet, label: t('nav.kasa') }, { id: 'EXPENSES', icon: Receipt, label: t('nav.expenses') || 'Giderler' }, { id: 'STATISTICS', icon: PieChart, label: t('nav.statistics') || 'İstatistikler' }] },
    { title: t('nav.group.field') || "Saha & Kayıt", items: [{ id: 'FARMERS', icon: Users, label: isCompany ? (t('nav.dealers') || 'Bayiler') : t('nav.farmers') }, { id: 'PESTICIDES', icon: BookOpen, label: t('nav.pesticides') || 'İlaçlar' }, { id: 'INVENTORY', icon: Package, label: t('nav.inventory') }, { id: 'SUPPLIERS', icon: Truck, label: t('nav.suppliers') }, { id: 'PAYMENTS', icon: CreditCard, label: t('nav.payments') || 'Ödemelerim' }, { id: 'PRESCRIPTIONS', icon: FileText, label: isCompany ? (t('nav.orders') || 'Siparişler') : t('nav.prescriptions') }, { id: 'VISITS', icon: ClipboardList, label: t('nav.visits') }] },
    { title: t('nav.group.support') || "Destek", items: [{ id: 'TRASH', icon: Trash2, label: t('nav.trash') || 'Çöp Kutusu' }, { id: 'CONTACT', icon: Phone, label: t('nav.contact') || 'Bize Ulaşın' }, { id: 'SETTINGS', icon: Settings, label: t('nav.settings') }] }
  ];

  if (isCompany) {
      const companyItems = [];
      if (activeTeamMember?.role === 'MANAGER') {
          companyItems.push({ id: 'TEAM', icon: Users, label: t('nav.team') || 'Ekibim' });
          companyItems.push({ id: 'PERFORMANCE', icon: PieChart, label: t('nav.performance') || 'Performans Takibi' });
      }
      // Sales reps can still see messages
      companyItems.push({ id: 'MESSAGES', icon: MessageCircle, label: t('nav.messages') || 'Firma İçi Mesajlaşma' });

      navGroups.splice(1, 0, {
          title: t('nav.group.company') || "Firma Yönetimi",
          items: companyItems
      });
  }

  if (isAdmin) {
    navGroups.push({
      title: t('nav.group.admin') || "Yönetim",
      items: [{ id: 'ADMIN_PANEL', icon: Shield, label: t('nav.admin') || 'Yönetim Paneli' }]
    });
  }

  // Filter navigation based on roles
  const filteredNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (isSales) {
        const hiddenForSales = ['RECENT_TRANSACTIONS', 'REPORTS', 'KASA', 'SUPPLIERS', 'PAYMENTS'];
        if (hiddenForSales.includes(item.id)) return false;
      }
      return true;
    })
  })).filter(group => group.items.length > 0);

  const handleNavClick = (view: ViewState) => { onNavigate(view); setIsMobileMenuOpen(false); };
  const handleLogout = async () => { 
    try { 
      await dbService.clearLocalUserData(); 
      setActiveTeamMember(null); // Clear team member session
      await logout(); 
    } catch (error) { 
      console.error("Logout failed", error); 
    } 
  };

  return (
    <div className={`min-h-screen relative font-sans text-stone-200 bg-stone-950 flex flex-col ${isHighContrast ? 'high-contrast' : ''}`}>
      <div className="fixed inset-0 z-0 pointer-events-none"><div className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105 blur-[3px] opacity-40" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop")' }}></div><div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-900/95 to-black/90"></div></div>

      {/* Global Back Button */}
      {currentView !== 'DASHBOARD' && (
        <button 
            onClick={() => window.history.back()} 
            className="fixed top-4 left-4 z-50 p-2.5 bg-stone-900/50 backdrop-blur-xl border border-white/10 rounded-full text-stone-300 shadow-xl active:scale-90 transition-all hover:bg-stone-800 hover:text-white group"
        >
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className={`fixed inset-y-0 right-0 w-[70%] max-w-[240px] bg-stone-900/95 backdrop-blur-xl text-stone-200 z-[60] transform transition-transform duration-300 ease-out shadow-2xl flex flex-col border-l border-white/5 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div onClick={() => handleNavClick('PROFILE')} className="p-4 bg-gradient-to-br from-emerald-950 to-stone-900 text-white relative border-b border-white/5 shrink-0 cursor-pointer pt-10">
             <div className="absolute top-2 left-2 p-2"><button onClick={(e) => {e.stopPropagation(); setIsMobileMenuOpen(false);}} className="bg-white/5 p-1.5 rounded-full text-white/70"><X size={16} /></button></div>
             <div className="flex items-center space-x-3 mt-1">
                 <div className="w-10 h-10 rounded-full bg-stone-800 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-base">{userProfile.fullName ? userProfile.fullName.charAt(0).toUpperCase() : <Plus size={18} />}</div>
                 <div className="flex-1 min-w-0"><h2 className="font-bold text-xs text-stone-100 truncate">{userProfile.fullName || t('settings.profile.create')}</h2><p className="text-emerald-400 text-[9px] uppercase tracking-wider font-bold opacity-80 truncate">{userProfile.companyName || 'MKS'}</p></div>
             </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
            {filteredNavGroups.map((group, idx) => (
                <div key={idx}><h3 className="px-2 text-[8px] font-bold text-stone-500 uppercase tracking-widest mb-1 opacity-70">{group.title}</h3>
                    <div className="space-y-0.5">
                        {group.items.map(item => (
                             <button key={item.id} onClick={() => handleNavClick(item.id as ViewState)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-300 ${currentView === item.id ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-stone-400 hover:bg-stone-800'}`}>
                                 <div className="flex items-center space-x-3"><item.icon size={14} /><span className={`text-[11px] ${currentView === item.id ? 'font-bold' : 'font-medium'}`}>{item.label}</span></div>
                                 {item.badge !== undefined && item.badge > 0 && <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                             </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
        
        {!isAdmin && (
            <div className="px-3 py-2 shrink-0">
                <SubscriptionTimer endsAt={subscriptionEndsAt} t={t} />
            </div>
        )}

        <div className="p-3 bg-stone-900/50 border-t border-white/5 shrink-0"><button onClick={handleLogout} className="w-full py-2 rounded-xl border border-red-900/20 text-red-400 bg-red-900/5 text-xs font-bold flex items-center justify-center"><LogOut size={14} className="mr-2"/> {t('nav.logout') || 'Çıkış'}</button></div>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto md:p-4 transition-all duration-300 relative pb-28 pt-8">
             <div className="w-full flex justify-center py-1 opacity-30 mb-1"><div className="w-10 h-1 rounded-full bg-white/10"></div></div>
             {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-2xl border-t border-white/10 pt-1 px-1 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' }}>
           <div className="flex justify-around items-center max-w-lg mx-auto h-12">
               <NavButton active={currentView === 'DASHBOARD'} onClick={() => onNavigate('DASHBOARD')} icon={Home} label={t('nav.dashboard') || "Ana Sayfa"} />
               <NavButton active={currentView === 'FARMERS'} onClick={() => onNavigate('FARMERS')} icon={Users} label={isCompany ? (t('nav.dealers') || 'Bayiler') : (t('nav.farmers') || 'Çiftçiler')} />
               <QuickActions />
               <NavButton active={currentView === 'NOTIFICATIONS'} onClick={() => onNavigate('NOTIFICATIONS')} icon={Bell} label={t('nav.notifications') || "Bildirim"} badge={unreadCount} />
               <NavButton active={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(true)} icon={Menu} label={t('nav.menu') || "Menü"} />
           </div>
       </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label, badge }: { active: boolean, onClick: () => void, icon: any, label: string, badge?: number }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center py-0.5 px-1 rounded-xl flex-1 h-full transition-all active:scale-95 ${active ? 'text-emerald-400' : 'text-stone-500'}`}>
        <div className={`relative p-1.5 rounded-lg transition-all ${active ? 'bg-emerald-500/10 -translate-y-0.5' : ''}`}>
            <Icon size={18} strokeWidth={active ? 2.5 : 2} />
            {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] flex items-center justify-center rounded-full border border-stone-950 font-black">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </div>
        <span className={`text-[8px] font-bold mt-0.5 transition-all ${active ? 'opacity-100' : 'opacity-60'}`}>
            {label}
        </span>
    </button>
);

const SubscriptionTimer = ({ endsAt, t }: { endsAt: string, t: (key: string) => string }) => {
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number }>({ days: 0, hours: 0, minutes: 0 });
    const [status, setStatus] = useState<'normal' | 'warning' | 'critical'>('normal');

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

                if (days <= 7) {
                    setStatus('critical');
                } else if (days <= 30) {
                    setStatus('warning');
                } else {
                    setStatus('normal');
                }
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0 });
                setStatus('critical');
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

        return () => clearInterval(timer);
    }, [endsAt]);

    const getColors = () => {
        switch (status) {
            case 'critical': return 'bg-red-500/10 border-red-500/20 text-red-400';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
            default: return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
        }
    };

    return (
        <div className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 ${getColors()} transition-colors duration-500`}>
            <div className="flex items-center space-x-1.5 opacity-80">
                <Clock size={12} />
                <span className="text-[10px] uppercase tracking-wider font-bold">{t('nav.subscription.remaining')}</span>
            </div>
            <div className="flex items-center space-x-2 font-mono text-sm font-bold">
                <div className="flex flex-col items-center"><span className="leading-none">{timeLeft.days}</span><span className="text-[8px] opacity-70">{t('nav.subscription.days')}</span></div>
                <span className="opacity-50 pb-2">:</span>
                <div className="flex flex-col items-center"><span className="leading-none">{timeLeft.hours}</span><span className="text-[8px] opacity-70">{t('nav.subscription.hours')}</span></div>
                <span className="opacity-50 pb-2">:</span>
                <div className="flex flex-col items-center"><span className="leading-none">{timeLeft.minutes}</span><span className="text-[8px] opacity-70">{t('nav.subscription.minutes')}</span></div>
            </div>
        </div>
    );
};
