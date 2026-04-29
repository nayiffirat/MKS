
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth, googleProvider } from '../services/firebase';
import { linkWithPopup, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { WeatherWidget } from './WeatherComponents';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, PieChart, Pie, Cell 
} from 'recharts';
import { Users, FileText, Sprout, Plus, X, Calendar, ChevronRight, Droplet, ArrowRight, Zap, MapPin, Send, Loader2, CalendarCheck, Clock, Mic, Bell, CalendarClock, TrendingUp, AlertCircle, Bug, Package, Route, FlaskConical, Star, Truck, Search, DollarSign, Trash2, Wallet, ScanSearch, Calculator, Map, Newspaper, Save, RefreshCw, Camera } from 'lucide-react';
import { ViewState, Pesticide, PesticideCategory, SupplierPurchase } from '../types';
import { dbService } from '../services/db';
import { formatCurrency, getCurrencySuffix } from '../utils/currency';

interface DashboardProps {
  onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { addFarmer, userProfile, reminders, stats, prescriptions, inventory, suppliers, farmers, addSupplierPurchase, addSupplierPayment, showToast, hapticFeedback, activeTeamMember, t, language, unreadCount, news } = useAppViewModel();
  const [selectedNews, setSelectedNews] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const isGoogleUser = useMemo(() => {
    return currentUser?.providerData?.some(p => p.providerId === 'google.com');
  }, [currentUser]);

  const isSales = activeTeamMember?.role === 'SALES';
  const canCreatePrescription = !isSales;
  const canCreateFarmer = !isSales;
  const farmerLabel = t('label.farmer');
  const farmerPluralLabel = t('label.farmers');
  const prescriptionLabel = t('label.prescription');
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [purchaseItems, setPurchaseItems] = useState<{ pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number }[]>([]);
  const [receiptNo, setReceiptNo] = useState('');
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [searchPestTerm, setSearchPestTerm] = useState('');
  const [isNewPesticide, setIsNewPesticide] = useState(false);
  const [paymentType, setPaymentType] = useState<'TERM' | 'CASH'>('TERM');

  useEffect(() => {
      const fetchPesticides = async () => {
          const data = await dbService.getPesticides();
          setPesticides(data);
      };
      fetchPesticides();
  }, []);
  
  const totalSupplierDebt = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + (s.balance < 0 ? Math.abs(s.balance) : 0), 0);
  }, [suppliers]);

  // Get first pending reminder
  const nextReminder = reminders.find(r => !r.isCompleted);

  const filteredPesticides = useMemo(() => {
      if (!searchPestTerm) return [];
      return pesticides.filter(p => 
          p.name.toLocaleLowerCase('tr-TR').includes(searchPestTerm.toLocaleLowerCase('tr-TR')) || 
          p.activeIngredient.toLocaleLowerCase('tr-TR').includes(searchPestTerm.toLocaleLowerCase('tr-TR'))
      ).slice(0, 20);
  }, [pesticides, searchPestTerm]);

  const handleAddPurchaseItem = (p: Pesticide | { name: string, isNew: boolean }) => {
      const newItem = {
          pesticideId: 'isNew' in p ? `new-${crypto.randomUUID()}` : p.id,
          pesticideName: p.name,
          quantity: 1,
          unit: 'Adet',
          buyingPrice: 0
      };
      setPurchaseItems([...purchaseItems, newItem]);
      setSearchPestTerm('');
      setIsNewPesticide(false);
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedSupplierId || purchaseItems.length === 0) return;

      const totalAmount = purchaseItems.reduce((sum, item) => sum + (item.quantity * item.buyingPrice), 0);
      const date = new Date().toISOString();
      
      await addSupplierPurchase({
          supplierId: selectedSupplierId,
          date,
          receiptNo,
          items: purchaseItems,
          totalAmount
      });

      // If it's a cash purchase, automatically add a payment
      if (paymentType === 'CASH') {
          await addSupplierPayment({
              supplierId: selectedSupplierId,
              amount: totalAmount,
              date,
              method: 'CASH',
              note: receiptNo ? `Hızlı Peşin Alım - Fiş No: ${receiptNo}` : 'Hızlı Peşin Alım Ödemesi',
              createdById: activeTeamMember?.id
          });
      }

      showToast(paymentType === 'CASH' ? 'Peşin alım ve ödeme kaydedildi' : t('dashboard.purchase_success'), 'success');
      hapticFeedback('success');
      setIsPurchaseModalOpen(false);
      setPurchaseItems([]);
      setSelectedSupplierId('');
      setReceiptNo('');
      setPaymentType('TERM');
  };

  // Daily Sales Chart Data
  const dailyChartData = useMemo(() => {
    // Last 7 days
    const days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const salesMap: Record<string, number> = {};
    prescriptions.forEach(p => {
        const date = p.date.split('T')[0];
        if (days.includes(date)) {
            salesMap[date] = (salesMap[date] || 0) + (p.totalAmount || 0);
        }
    });

    return days.map(date => ({
        date: new Date(date).toLocaleDateString(language === 'tr' ? 'tr-TR' : language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' }),
        amount: salesMap[date] || 0,
        fullDate: date
    }));
  }, [prescriptions, language]);

  const getFirstName = (fullName: string) => {
      if (!fullName) return t('dashboard.hello').replace(',', '');
      return fullName.split(' ')[0];
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

  return (
    <div className="p-3 space-y-3 pb-24 animate-in fade-in duration-500">
      
      {/* --- SUPER COMPACT HEADER --- */}
      <header className="flex items-stretch gap-2 mb-3 mt-1 h-24">
        {/* Left Side: Greeting Card */}
        <div className="flex-1 relative bg-stone-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 overflow-hidden flex flex-col justify-center shadow-md group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            
            <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-full border border-white/10 backdrop-blur-md mb-1 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest">
                        {new Date().toLocaleDateString(language === 'tr' ? 'tr-TR' : language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <h2 className="text-[10px] font-medium text-stone-500 tracking-tight">{t('dashboard.hello')}</h2>
                        <h1 className="text-lg font-black text-stone-100 truncate tracking-tight">
                            {getFirstName(userProfile.fullName)}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => onNavigate('NOTIFICATIONS')}
                            className="relative flex items-center gap-2 px-4 py-2.5 bg-stone-800/50 backdrop-blur-xl border border-white/10 rounded-full text-stone-300 shadow-lg active:scale-90 transition-all hover:bg-stone-700 hover:text-white group"
                        >
                            <div className="relative">
                                <Bell size={18} className="group-hover:rotate-12 transition-transform" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-500 text-white text-[7px] flex items-center justify-center rounded-full border border-stone-950 font-black animate-in zoom-in duration-300">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Bildirimler</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </header>

      {/* --- TASKS SECTION (NEXT JOB & TOMORROW) --- */}
      <div className="grid grid-cols-2 gap-2">
          {/* Next Job Card */}
          <button 
            onClick={() => onNavigate('REMINDERS')}
            className="col-span-1 p-3 bg-stone-900/60 border border-white/10 rounded-2xl flex flex-col justify-center group active:scale-[0.98] transition-all hover:bg-stone-900 min-h-[70px] shadow-md"
          >
            <div className="flex items-center space-x-1.5 mb-1.5">
                <div className="p-1.5 bg-amber-500/20 rounded-lg shrink-0">
                    <CalendarCheck className="text-amber-500" size={12} />
                </div>
                <h4 className="text-stone-500 font-black text-[8px] uppercase tracking-widest">{t('dashboard.today')}</h4>
            </div>
            <p className="text-stone-200 text-[10px] truncate w-full leading-tight font-bold">
                {nextReminder ? nextReminder.title : t('dashboard.no_plan')}
            </p>
          </button>

          {/* MKS Haber Card */}
          <button 
            onClick={() => onNavigate('NEWS')}
            className="col-span-1 p-3 bg-stone-900/60 border border-white/10 rounded-2xl flex flex-col justify-center group active:scale-[0.98] transition-all hover:bg-stone-900 min-h-[70px] relative overflow-hidden shadow-md"
          >
             <div className="flex items-center space-x-1.5 mb-1.5 relative z-10">
                <div className="p-1.5 bg-blue-500/20 rounded-lg shrink-0">
                    <Newspaper className="text-blue-500" size={12} />
                </div>
                <h4 className="text-stone-500 font-black text-[8px] uppercase tracking-widest">MKS Haber</h4>
            </div>
            <div className="relative z-10">
                {news && news.length > 0 ? (
                    <p className="text-stone-200 text-[10px] truncate w-full leading-tight font-bold">
                        {news[0].title}
                    </p>
                ) : (
                    <p className="text-stone-600 text-[10px] font-bold">Haber yok</p>
                )}
            </div>
          </button>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-3">
          <WeatherWidget />
      </div>

      {/* DEBTS & RECEIVABLES WIDGET */}
      <div className="grid grid-cols-2 gap-2">
          {/* Combined Financial Card */}
          <div 
            onClick={() => onNavigate('STATISTICS')}
            className="col-span-2 bg-stone-900/60 border border-white/10 rounded-2xl p-3 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform group shadow-md flex flex-col justify-between gap-3"
          >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Truck size={12} className="text-rose-500" />
                        <h3 className="text-[8px] font-black text-stone-500 uppercase tracking-widest">{t('dashboard.my_debts')}</h3>
                    </div>
                    <span className="text-[10px] font-black text-rose-400 font-mono">
                        {formatCurrency(Math.round(totalSupplierDebt), userProfile?.currency || 'TRY')}
                    </span>
                </div>
                <div className="h-px bg-white/5 w-full"></div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <DollarSign size={12} className="text-emerald-500" />
                        <h3 className="text-[8px] font-black text-stone-500 uppercase tracking-widest">{t('dashboard.my_receivables')}</h3>
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 font-mono">
                        {formatCurrency(Math.round(stats.totalDebt), userProfile?.currency || 'TRY')}
                    </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[7px] font-bold text-stone-600 uppercase tracking-tighter">
                  <span>Finansal Özet</span>
                  <ChevronRight size={10} />
              </div>
          </div>
      </div>

      {/* REGIONAL ALERTS */}
      {stats.regionalAlerts.length > 0 && (
          <div className="bg-rose-900/20 border border-rose-500/20 rounded-xl p-2 animate-pulse">
              <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertCircle size={12} className="text-rose-500" />
                  <h4 className="text-[8px] font-black text-rose-500 uppercase tracking-widest">{t('dashboard.regional_risk')}</h4>
              </div>
              <div className="space-y-1">
                  {stats.regionalAlerts.map((alert, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/10">
                          <div className="flex items-center gap-1.5">
                              <Bug size={10} className="text-rose-400" />
                              <span className="text-[9px] font-bold text-rose-100">{alert.village}: {alert.type}</span>
                          </div>
                          <span className="text-[7px] font-black bg-rose-500 text-white px-1 py-0.5 rounded-full uppercase">{t('dashboard.critical')}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div>
        <h3 className="font-black text-stone-600 text-[8px] mb-2 flex items-center uppercase tracking-widest pl-1">
             {t('dashboard.quick_actions')}
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
            <button 
                onClick={() => onNavigate('FARMERS')}
                className="group flex items-center gap-2.5 p-2.5 bg-emerald-900/10 backdrop-blur-sm rounded-2xl border border-emerald-500/20 active:scale-95 transition-all shadow-md"
            >
                <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg shadow-emerald-900/30">
                    <Users size={16}/>
                </div>
                <div className="text-left">
                    <span className="block font-black text-[9px] text-emerald-100 uppercase tracking-wider">{t('dashboard.accounts')}</span>
                    <span className="text-[7px] text-emerald-500/70 font-bold uppercase">{farmerLabel} {t('dashboard.accounts').toLowerCase()}</span>
                </div>
            </button>

            {canCreatePrescription ? (
                <button 
                    onClick={() => onNavigate('PRESCRIPTION_NEW')}
                    className="group flex items-center gap-2.5 p-2.5 bg-stone-900/60 backdrop-blur-sm rounded-2xl border border-white/10 active:scale-95 transition-all shadow-md"
                >
                    <div className="bg-blue-600/20 text-blue-400 p-2 rounded-xl border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <FileText size={16}/>
                    </div>
                    <div className="text-left">
                        <span className="block font-black text-[9px] text-stone-200 uppercase tracking-wider">{prescriptionLabel.toUpperCase()}</span>
                        <span className="text-[7px] text-stone-600 font-bold uppercase">{t('dashboard.new_record')}</span>
                    </div>
                </button>
            ) : (
                <button 
                    onClick={() => onNavigate('PRESCRIPTION_LIST')}
                    className="group flex items-center gap-2.5 p-2.5 bg-stone-900/60 backdrop-blur-sm rounded-2xl border border-white/10 active:scale-95 transition-all shadow-md"
                >
                    <div className="bg-blue-600/20 text-blue-400 p-2 rounded-xl border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <FileText size={16}/>
                    </div>
                    <div className="text-left">
                        <span className="block font-black text-[9px] text-stone-200 uppercase tracking-wider">{prescriptionLabel.toUpperCase()}</span>
                        <span className="text-[7px] text-stone-600 font-bold uppercase">{t('dashboard.list')}</span>
                    </div>
                </button>
            )}
        </div>

        <div className="grid grid-cols-2 gap-2">
            <button 
                onClick={() => setIsPurchaseModalOpen(true)}
                className="group flex items-center gap-2.5 p-2.5 bg-stone-900/60 backdrop-blur-sm rounded-2xl border border-white/10 active:scale-95 transition-all shadow-md"
            >
                <div className="bg-amber-600/20 text-amber-400 p-2 rounded-xl border border-amber-500/20 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Truck size={16}/>
                </div>
                <div className="text-left">
                    <span className="block font-black text-[9px] text-stone-200 uppercase tracking-wider">{t('dashboard.purchase')}</span>
                    <span className="text-[7px] text-stone-600 font-bold uppercase">{t('dashboard.supplier_purchase')}</span>
                </div>
            </button>

            <button 
                onClick={() => onNavigate('INVENTORY')}
                className="group flex items-center gap-2.5 p-2.5 bg-stone-900/60 backdrop-blur-sm rounded-2xl border border-white/10 active:scale-95 transition-all shadow-md"
            >
                <div className="bg-purple-600/20 text-purple-400 p-2 rounded-xl border border-purple-500/20 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Package size={16}/>
                </div>
                <div className="text-left">
                    <span className="block font-black text-[9px] text-stone-200 uppercase tracking-wider">{t('dashboard.my_warehouse')}</span>
                    <span className="text-[7px] text-stone-600 font-bold uppercase">{t('dashboard.stock_status')}</span>
                </div>
            </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
            <button 
                onClick={() => onNavigate('FINDEKS')}
                className="col-span-3 group flex items-center justify-center gap-3 p-5 bg-amber-500/10 backdrop-blur-sm rounded-[32px] border border-amber-500/30 active:scale-95 transition-all shadow-xl shadow-amber-900/10"
            >
                <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
                    <ScanSearch size={24}/>
                </div>
                <div className="text-left">
                    <span className="block font-black text-sm text-amber-500 uppercase tracking-[0.2em]">FINDEKS ANALİZ</span>
                    <span className="text-[10px] text-amber-600 font-bold uppercase opacity-70">Çiftçi Risk & Potansiyel Raporu</span>
                </div>
            </button>
            <ActionButton onClick={() => onNavigate('CALCULATOR')} icon={Calculator} label={t('dashboard.calculate')} color="emerald" />
            <ActionButton onClick={() => onNavigate('VISIT_NEW')} icon={Calendar} label={t('dashboard.visit')} color="blue" />
            <ActionButton onClick={() => onNavigate('PLANTS')} icon={Sprout} label="Bitkiler" color="purple" />
        </div>
      </div>

      {/* DAILY SALES CHART */}
      <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-emerald-500/10 rounded-lg">
                      <TrendingUp size={12} className="text-emerald-500" />
                  </div>
                  <h3 className="text-[8px] font-black text-stone-400 uppercase tracking-widest">{t('dashboard.sales_performance')}</h3>
              </div>
              <button 
                onClick={() => onNavigate('STATISTICS')}
                className="text-[7px] font-black text-stone-600 uppercase tracking-widest hover:text-emerald-500 transition-colors"
              >
                  {t('dashboard.detail')} <ChevronRight size={8} className="inline" />
              </button>
          </div>
          
          <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChartData}>
                      <defs>
                          <linearGradient id="dashSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} opacity={0.5} />
                      <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#525252', fontSize: 8, fontWeight: 700 }} 
                      />
                      <YAxis hide />
                      <Tooltip 
                          contentStyle={{ backgroundColor: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '9px' }}
                          itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                          formatter={(value: number) => [formatCurrency(value, userProfile?.currency || 'TRY'), t('dashboard.sales_performance')]}
                          labelStyle={{ color: '#737373', marginBottom: '2px' }}
                      />
                      <Area 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#dashSales)" 
                      />
                  </AreaChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* CROP DISTRIBUTION (ARAZI) */}
      <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-emerald-500/10 rounded-lg">
                      <Sprout size={12} className="text-emerald-500" />
                  </div>
                  <h3 className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Arazi Dağılımı</h3>
              </div>
              <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {stats.totalArea} da Toplam
              </span>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="h-24 w-24 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={stats.cropDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={45}
                              paddingAngle={2}
                              dataKey="area"
                              nameKey="crop"
                          >
                              {stats.cropDistribution.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                              ))}
                          </Pie>
                      </PieChart>
                  </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {stats.cropDistribution.slice(0, 4).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                          <div className="min-w-0">
                              <p className="text-[8px] font-bold text-stone-300 truncate">{item.crop}</p>
                              <p className="text-[7px] text-stone-500 font-mono">{item.area} da</p>
                          </div>
                      </div>
                  ))}
                  {stats.cropDistribution.length > 4 && (
                      <div className="col-span-2 pt-1 border-t border-white/5">
                          <button 
                            onClick={() => onNavigate('STATISTICS')}
                            className="text-[7px] font-black text-stone-600 uppercase tracking-widest hover:text-emerald-500 transition-colors"
                          >
                              Tümünü Gör <ChevronRight size={8} className="inline" />
                          </button>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* QUICK PURCHASE MODAL */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end justify-center animate-in fade-in duration-300">
          <div className="bg-stone-900 rounded-t-[2.5rem] w-full max-w-lg shadow-2xl relative animate-in slide-in-from-bottom duration-500 border-t border-white/10 p-6 pb-24 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center mb-5">
                <div className="w-10 h-1 bg-stone-800 rounded-full mb-4"></div>
                <div className="w-full flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-bold text-stone-100">{t('dashboard.quick_purchase')}</h2>
                        <p className="text-[9px] text-stone-600 font-black uppercase tracking-widest">{t('dashboard.supplier_stock_entry')}</p>
                    </div>
                    <button onClick={() => setIsPurchaseModalOpen(false)} className="p-2 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors"><X size={16} /></button>
                </div>
            </div>
            
            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              {/* Supplier Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[8px] font-black text-stone-600 ml-1 uppercase tracking-widest mb-1 block">{t('dashboard.select_supplier')}</label>
                    <div className="relative">
                        <select 
                          required 
                          value={selectedSupplierId} 
                          onChange={e => setSelectedSupplierId(e.target.value)}
                          className="w-full h-[48px] px-4 bg-stone-950 border border-stone-800 focus:border-emerald-500/30 rounded-xl outline-none font-bold transition-all text-white text-sm appearance-none"
                        >
                            <option value="">Tedarikçi Seçiniz...</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black text-stone-600 ml-1 uppercase tracking-widest block">{t('dashboard.receipt_no')} / Ödeme</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                value={receiptNo}
                                onChange={e => setReceiptNo(e.target.value)}
                                placeholder={t('dashboard.optional')} 
                                className="w-full h-[48px] px-4 bg-stone-950 border border-stone-800 focus:border-emerald-500/30 rounded-xl outline-none font-bold transition-all text-white placeholder-stone-800 text-sm"
                            />
                        </div>
                        <div className="flex bg-stone-950 border border-stone-800 rounded-xl p-1">
                            <button 
                                type="button"
                                onClick={() => setPaymentType('TERM')}
                                className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${paymentType === 'TERM' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-600 hover:text-stone-400'}`}
                            >
                                Vadeli
                            </button>
                            <button 
                                type="button"
                                onClick={() => setPaymentType('CASH')}
                                className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${paymentType === 'CASH' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-600 hover:text-stone-400'}`}
                            >
                                Peşin
                            </button>
                        </div>
                    </div>
                </div>
              </div>
              {suppliers.length === 0 && (
                  <p className="text-[10px] text-amber-500 mt-1 ml-1 font-medium">{t('dashboard.need_supplier')}</p>
              )}

              {/* Item Search */}
              <div className="relative">
                  <label className="text-[8px] font-black text-stone-600 ml-1 uppercase tracking-widest mb-1 block">{t('dashboard.add_product')}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-stone-700" size={14} />
                        <input 
                            type="text" 
                            value={searchPestTerm}
                            onChange={e => setSearchPestTerm(e.target.value)}
                            placeholder={t('dashboard.product_placeholder')} 
                            className="w-full p-3 pl-9 bg-stone-950 border border-stone-800 focus:border-emerald-500/30 rounded-xl outline-none font-bold transition-all text-white placeholder-stone-800 text-xs"
                        />
                    </div>
                  </div>

                  {searchPestTerm && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-stone-900 border border-stone-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                          {filteredPesticides.map(p => (
                              <button 
                                key={p.id}
                                type="button"
                                onClick={() => handleAddPurchaseItem(p)}
                                className="w-full text-left p-3 hover:bg-stone-800 border-b border-white/5 last:border-0 transition-colors"
                              >
                                  <div className="font-bold text-stone-200 text-xs">{p.name}</div>
                                  <div className="text-[9px] text-stone-500 uppercase tracking-wider">{p.category}</div>
                              </button>
                          ))}
                          <button 
                            type="button"
                            onClick={() => handleAddPurchaseItem({ name: searchPestTerm, isNew: true })}
                            className="w-full text-left p-3 hover:bg-emerald-900/20 border-t border-emerald-500/10 transition-colors flex items-center gap-2"
                          >
                              <Plus size={14} className="text-emerald-500" />
                              <span className="text-xs font-bold text-emerald-400">"{searchPestTerm}" {t('dashboard.add_new')}</span>
                          </button>
                      </div>
                  )}
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                  {purchaseItems.map((item, idx) => (
                      <div key={idx} className="bg-stone-950/50 border border-white/5 rounded-2xl p-3 space-y-3">
                          <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-stone-200 truncate pr-4">{item.pesticideName}</span>
                              <button 
                                type="button"
                                onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))}
                                className="text-stone-700 hover:text-rose-500 transition-colors"
                              >
                                  <Trash2 size={14} />
                              </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              <div>
                                  <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest mb-1 block">{t('dashboard.quantity')}</label>
                                  <input 
                                    type="number" 
                                    step="any"
                                    value={item.quantity}
                                    onChange={e => {
                                        const newItems = [...purchaseItems];
                                        const qty = parseFloat(e.target.value.replace(',', '.'));
                                        newItems[idx].quantity = isNaN(qty) ? 0 : qty;
                                        setPurchaseItems(newItems);
                                    }}
                                    className="w-full h-[34px] px-2 bg-stone-900 border border-stone-800 rounded-lg text-xs font-bold text-white outline-none"
                                  />
                              </div>
                              <div>
                                  <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest mb-1 block">{t('dashboard.unit')}</label>
                                  <div className="relative">
                                      <select 
                                        value={item.unit}
                                        onChange={e => {
                                            const newItems = [...purchaseItems];
                                            newItems[idx].unit = e.target.value;
                                            setPurchaseItems(newItems);
                                        }}
                                        className="w-full h-[34px] pl-2 pr-6 bg-stone-900 border border-stone-800 rounded-lg text-xs font-bold text-white outline-none appearance-none"
                                      >
                                          <option value="Adet">{t('dashboard.unit_piece')}</option>
                                          <option value="Litre">{t('dashboard.unit_liter')}</option>
                                          <option value="Kg">{t('dashboard.unit_kg')}</option>
                                          <option value="Kutu">{t('dashboard.unit_box')}</option>
                                      </select>
                                      <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                          <svg className="w-3 h-3 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                      </div>
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest mb-1 block">{t('dashboard.buying_price')}</label>
                                  <div className="relative">
                                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-700" size={10} />
                                      <input 
                                        type="number" 
                                        value={item.buyingPrice}
                                        onChange={e => {
                                            const newItems = [...purchaseItems];
                                            const price = parseFloat(e.target.value.replace(',', '.'));
                                            newItems[idx].buyingPrice = isNaN(price) ? 0 : price;
                                            setPurchaseItems(newItems);
                                        }}
                                        className="w-full h-[34px] pl-6 pr-2 bg-stone-900 border border-stone-800 rounded-lg text-xs font-bold text-white outline-none"
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
                  {purchaseItems.length === 0 && (
                      <div className="py-8 text-center border-2 border-dashed border-stone-800 rounded-2xl">
                          <Package size={24} className="text-stone-800 mx-auto mb-2 opacity-50" />
                          <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest">{t('dashboard.no_product_added')}</p>
                      </div>
                  )}
              </div>

              {/* Summary & Submit */}
              <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center mb-4 px-1">
                      <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{t('dashboard.total_amount')}</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                          {formatCurrency(purchaseItems.reduce((sum, item) => sum + (item.quantity * item.buyingPrice), 0), userProfile?.currency || 'TRY')}
                      </span>
                  </div>
                  <button 
                    type="submit" 
                    disabled={!selectedSupplierId || purchaseItems.length === 0}
                    className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 active:scale-[0.97] transition-all disabled:opacity-30 disabled:active:scale-100 border border-white/10"
                  >
                      {t('dashboard.save_purchase')}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* News Detail Modal */}
      {selectedNews && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
            <div className="relative h-48 sm:h-64 bg-stone-800 shrink-0">
              {selectedNews.imageUrl ? (
                <img 
                  src={selectedNews.imageUrl} 
                  alt={selectedNews.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-700">
                  <Newspaper size={64} />
                </div>
              )}
              <button 
                onClick={() => setSelectedNews(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X size={20} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-stone-900 to-transparent">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-blue-600 text-[8px] font-black text-white rounded uppercase tracking-widest">
                    {selectedNews.category || 'Haber'}
                  </span>
                  <span className="text-[10px] font-bold text-stone-400">
                    {new Date(selectedNews.date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white leading-tight">{selectedNews.title}</h2>
              </div>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="prose prose-invert max-w-none">
                <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedNews.content}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-white/5 bg-stone-900/80 shrink-0">
              <button 
                onClick={() => setSelectedNews(null)}
                className="w-full py-3 bg-stone-800 text-stone-300 rounded-xl font-bold text-sm hover:bg-stone-700 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ onClick, icon: Icon, label, color }: { onClick: () => void, icon: any, label: string, color: string }) => {
    const colorClasses: Record<string, string> = {
        emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10 hover:bg-emerald-500',
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/10 hover:bg-blue-500',
        amber: 'bg-amber-500/10 text-amber-500 border-amber-500/10 hover:bg-amber-500',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-500/10 hover:bg-purple-500'
    };

    return (
        <button 
            onClick={onClick}
            className="group flex flex-col items-center justify-center p-2.5 bg-stone-900 border border-white/5 rounded-2xl active:scale-95 transition-all shadow-md"
        >
            <div className={`p-2 rounded-xl group-hover:text-white transition-colors mb-1 ${colorClasses[color] || colorClasses.emerald}`}>
                <Icon size={18}/>
            </div>
            <span className="block font-black text-[8px] text-stone-400 uppercase tracking-tight group-hover:text-stone-200">{label}</span>
        </button>
    );
};
