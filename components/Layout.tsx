
import React, { useState } from 'react';
import { Home, Users, BookOpen, FileText, ClipboardList, Menu, X, LogOut, Settings, ChevronRight, User, Bell, Phone, UserCircle, Plus, PieChart, Sprout, Newspaper, CalendarCheck } from 'lucide-react';
import { ViewState } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/db';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { unreadCount, userProfile, stats } = useAppViewModel();
  const { logout } = useAuth();

  const navGroups = [
    { title: "Genel", items: [{ id: 'DASHBOARD', icon: Home, label: 'Ana Sayfa' }, { id: 'NEWS', icon: Newspaper, label: 'Haberler' }, { id: 'REMINDERS', icon: CalendarCheck, label: 'Hatırlatıcılar', badge: stats.activeReminders }, { id: 'STATISTICS', icon: PieChart, label: 'İstatistikler' }] },
    { title: "Saha & Kayıt", items: [{ id: 'FARMERS', icon: Users, label: 'Çiftçiler' }, { id: 'PESTICIDES', icon: BookOpen, label: 'İlaçlar' }, { id: 'PRESCRIPTIONS', icon: FileText, label: 'Reçete Defteri' }, { id: 'VISITS', icon: ClipboardList, label: 'Ziyaretler' }] },
    { title: "Destek", items: [{ id: 'CONTACT', icon: Phone, label: 'Bize Ulaşın' }, { id: 'SETTINGS', icon: Settings, label: 'Ayarlar' }] }
  ];

  const handleNavClick = (view: ViewState) => { onNavigate(view); setIsMobileMenuOpen(false); };
  const handleLogout = async () => { try { await dbService.clearLocalUserData(); await logout(); } catch (error) { console.error("Logout failed", error); } };

  return (
    <div className="min-h-screen relative font-sans text-stone-200 bg-stone-950 flex flex-col">
      <div className="fixed inset-0 z-0 pointer-events-none"><div className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105 blur-[3px] opacity-40" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop")' }}></div><div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-900/95 to-black/90"></div></div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className={`fixed inset-y-0 right-0 w-[70%] max-w-[240px] bg-stone-900/95 backdrop-blur-xl text-stone-200 z-[60] transform transition-transform duration-300 ease-out shadow-2xl flex flex-col border-l border-white/5 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div onClick={() => handleNavClick('PROFILE')} className="p-4 bg-gradient-to-br from-emerald-950 to-stone-900 text-white relative border-b border-white/5 shrink-0 cursor-pointer pt-10">
             <div className="absolute top-2 left-2 p-2"><button onClick={(e) => {e.stopPropagation(); setIsMobileMenuOpen(false);}} className="bg-white/5 p-1.5 rounded-full text-white/70"><X size={16} /></button></div>
             <div className="flex items-center space-x-3 mt-1">
                 <div className="w-10 h-10 rounded-full bg-stone-800 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-base">{userProfile.fullName ? userProfile.fullName.charAt(0).toUpperCase() : <Plus size={18} />}</div>
                 <div className="flex-1 min-w-0"><h2 className="font-bold text-xs text-stone-100 truncate">{userProfile.fullName || 'Profil Oluştur'}</h2><p className="text-emerald-400 text-[9px] uppercase tracking-wider font-bold opacity-80 truncate">{userProfile.companyName || 'MKS'}</p></div>
             </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
            {navGroups.map((group, idx) => (
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
        <div className="p-3 bg-stone-900/50 border-t border-white/5 shrink-0"><button onClick={handleLogout} className="w-full py-2 rounded-xl border border-red-900/20 text-red-400 bg-red-900/5 text-xs font-bold flex items-center justify-center"><LogOut size={14} className="mr-2"/> Çıkış</button></div>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto md:p-4 transition-all duration-300 relative z-10 pb-28 pt-8">
             <div className="w-full flex justify-center py-1 opacity-30 mb-1"><div className="w-10 h-1 rounded-full bg-white/10"></div></div>
             {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950/90 backdrop-blur-xl border-t border-white/5 pt-1 px-4 shadow-2xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2px)' }}>
           <div className="flex justify-between items-center max-w-md mx-auto">
               <NavButton active={currentView === 'DASHBOARD'} onClick={() => onNavigate('DASHBOARD')} icon={Home} label="Ana Sayfa" />
               <NavButton active={currentView === 'FARMERS'} onClick={() => onNavigate('FARMERS')} icon={Users} label="Çiftçiler" />
               <NavButton active={currentView === 'NOTIFICATIONS'} onClick={() => onNavigate('NOTIFICATIONS')} icon={Bell} label="Bildirim" badge={unreadCount} />
               <NavButton active={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(true)} icon={Menu} label="Menü" />
           </div>
       </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label, badge }: { active: boolean, onClick: () => void, icon: any, label: string, badge?: number }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-1 rounded-xl w-14 transition-all active:scale-90 ${active ? 'text-emerald-400' : 'text-stone-500'}`}>
        <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-emerald-900/30 -translate-y-1' : ''}`}><Icon size={18} strokeWidth={active ? 2.5 : 2} />{badge !== undefined && badge > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-[7px] flex items-center justify-center rounded-full border-2 border-stone-950 font-bold">{badge > 9 ? '9' : badge}</span>}</div>
        <span className={`text-[8px] font-medium transition-all absolute bottom-0 ${active ? 'opacity-100' : 'opacity-0 scale-0'}`}>{label}</span>
    </button>
);
