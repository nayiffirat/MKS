
import React, { useState, useMemo, useEffect } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { WeatherWidget } from './WeatherComponents';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid 
} from 'recharts';
import { Users, FileText, Sprout, Plus, X, Calendar, Newspaper, ChevronRight, Droplet, ArrowRight, Zap, MapPin, Sparkles, Send, Loader2, Bot, BrainCircuit, CalendarCheck, Clock, Mic, Bell, CalendarClock, TrendingUp, AlertCircle, Bug, Package, Route, FlaskConical, Star, Truck, Search, DollarSign, Trash2 } from 'lucide-react';
import { ViewState, Pesticide, PesticideCategory, SupplierPurchase } from '../types';
import { GeminiService } from '../services/gemini';
import { dbService } from '../services/db';

interface DashboardProps {
  onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { addFarmer, userProfile, reminders, stats, prescriptions, inventory, suppliers, farmers, addSupplierPurchase, showToast, hapticFeedback } = useAppViewModel();
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [purchaseItems, setPurchaseItems] = useState<{ pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number }[]>([]);
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [searchPestTerm, setSearchPestTerm] = useState('');
  const [isNewPesticide, setIsNewPesticide] = useState(false);

  useEffect(() => {
      const fetchPesticides = async () => {
          const data = await dbService.getPesticides();
          setPesticides(data);
      };
      fetchPesticides();
  }, []);
  
  // Low stock items
  const lowStockItems = useMemo(() => {
    return inventory.filter(item => item.quantity <= (item.lowStockThreshold || 0));
  }, [inventory]);

  const totalSupplierDebt = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + (s.balance < 0 ? Math.abs(s.balance) : 0), 0);
  }, [suppliers]);

  // AI Widget State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Get first pending reminder
  const nextReminder = reminders.find(r => !r.isCompleted);

  const filteredPesticides = useMemo(() => {
      if (!searchPestTerm) return [];
      return pesticides.filter(p => 
          p.name.toLowerCase().includes(searchPestTerm.toLowerCase()) || 
          p.activeIngredient.toLowerCase().includes(searchPestTerm.toLowerCase())
      ).slice(0, 5);
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
      
      await addSupplierPurchase({
          supplierId: selectedSupplierId,
          date: new Date().toISOString(),
          items: purchaseItems,
          totalAmount
      });

      showToast('Mal alımı başarıyla kaydedildi', 'success');
      hapticFeedback('success');
      setIsPurchaseModalOpen(false);
      setPurchaseItems([]);
      setSelectedSupplierId('');
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
        date: new Date(date).toLocaleDateString('tr-TR', { weekday: 'short' }),
        amount: salesMap[date] || 0,
        fullDate: date
    }));
  }, [prescriptions]);

  const handleAiAsk = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!aiQuery.trim()) return;

      setIsAiLoading(true);
      setAiResponse(null); 
      
      try {
          const result = await GeminiService.askAgriBot(aiQuery);
          setAiResponse(result);
      } catch (error) {
          setAiResponse("Üzgünüm, şu an bağlantı kuramıyorum. Lütfen internetinizi kontrol edin.");
      } finally {
          setIsAiLoading(false);
      }
  };

  const getFirstName = (fullName: string) => {
      if (!fullName) return 'Mühendis';
      return fullName.split(' ')[0];
  };

  return (
    <div className="p-3 space-y-3 pb-24 animate-in fade-in duration-500">
      
      {/* --- SUPER COMPACT HEADER --- */}
      <header className="flex items-stretch gap-2 mb-3 mt-1 h-24">
        {/* Left Side: Greeting Card */}
        <div className="flex-[2] relative bg-stone-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 overflow-hidden flex flex-col justify-center shadow-md group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            
            <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-full border border-white/10 backdrop-blur-md mb-1 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest">
                        {new Date().toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                </div>
                
                <div className="space-y-0.5">
                    <h2 className="text-[10px] font-medium text-stone-500 tracking-tight">Merhaba,</h2>
                    <h1 className="text-lg font-black text-stone-100 truncate tracking-tight">
                        {getFirstName(userProfile.fullName)}
                    </h1>
                </div>
            </div>
        </div>

        {/* Right Side: AI Assistant Button */}
        <button 
            onClick={() => onNavigate('FIELD_ASSISTANT')}
            className="flex-1 relative flex flex-col items-center justify-center p-1.5 rounded-2xl bg-gradient-to-b from-stone-800 to-stone-950 border border-emerald-500/20 shadow-md active:scale-95 transition-all group overflow-hidden"
        >
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/40 mb-1 relative z-10 border border-emerald-400/20">
                <Mic className="text-white" size={18} />
            </div>
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Asistan</span>
        </button>
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
                <h4 className="text-stone-500 font-black text-[8px] uppercase tracking-widest">Bugün</h4>
            </div>
            <p className="text-stone-200 text-[10px] truncate w-full leading-tight font-bold">
                {nextReminder ? nextReminder.title : 'Plan yok.'}
            </p>
          </button>

          {/* Tomorrow's Plan Card */}
          <button 
            onClick={() => onNavigate('REMINDERS_TOMORROW')}
            className="col-span-1 p-3 bg-stone-900/60 border border-white/10 rounded-2xl flex flex-col justify-center group active:scale-[0.98] transition-all hover:bg-stone-900 min-h-[70px] relative overflow-hidden shadow-md"
          >
             <div className="flex items-center space-x-1.5 mb-1.5 relative z-10">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg shrink-0">
                    <CalendarClock className="text-emerald-500" size={12} />
                </div>
                <h4 className="text-stone-500 font-black text-[8px] uppercase tracking-widest">Yarın</h4>
            </div>
            <div className="relative z-10">
                {stats.tomorrowReminders > 0 ? (
                    <p className="text-emerald-400 text-xs font-black tracking-wide">
                        {stats.tomorrowReminders} Plan
                    </p>
                ) : (
                    <p className="text-stone-600 text-[10px] font-bold">Yok.</p>
                )}
            </div>
          </button>
      </div>

      <WeatherWidget />

      {/* DEBTS & RECEIVABLES WIDGET */}
      <div className="grid grid-cols-2 gap-2">
          <div 
            onClick={() => onNavigate('STATISTICS')}
            className="bg-stone-900/60 border border-white/10 rounded-2xl p-3 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform group shadow-md"
          >
              <div className="flex items-center gap-1.5 mb-2">
                  <div className="p-1.5 bg-rose-500/20 rounded-lg group-hover:bg-rose-500/30 transition-colors">
                      <Truck size={12} className="text-rose-500" />
                  </div>
                  <h3 className="text-[8px] font-black text-stone-500 uppercase tracking-widest">Borçlarım</h3>
              </div>
              <div className="flex items-end gap-0.5">
                  <span className="text-lg font-black text-rose-400 font-mono">
                      {Math.round(totalSupplierDebt).toLocaleString('tr-TR')}
                  </span>
                  <span className="text-[8px] text-stone-600 mb-0.5 font-black">TL</span>
              </div>
          </div>

          <div 
            onClick={() => onNavigate('FARMERS')}
            className="bg-stone-900/60 border border-white/10 rounded-2xl p-3 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform group shadow-md"
          >
              <div className="flex items-center gap-1.5 mb-2">
                  <div className="p-1.5 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                      <DollarSign size={12} className="text-emerald-500" />
                  </div>
                  <h3 className="text-[8px] font-black text-stone-500 uppercase tracking-widest">Alacaklarım</h3>
              </div>
              <div className="flex items-end gap-0.5">
                  <span className="text-lg font-black text-emerald-400 font-mono">
                      {Math.round(stats.totalDebt).toLocaleString('tr-TR')}
                  </span>
                  <span className="text-[8px] text-stone-600 mb-0.5 font-black">TL</span>
              </div>
          </div>
      </div>

      {/* REGIONAL ALERTS */}
      {stats.regionalAlerts.length > 0 && (
          <div className="bg-rose-900/20 border border-rose-500/20 rounded-xl p-2 animate-pulse">
              <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertCircle size={12} className="text-rose-500" />
                  <h4 className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Bölgesel Risk Uyarısı</h4>
              </div>
              <div className="space-y-1">
                  {stats.regionalAlerts.map((alert, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/10">
                          <div className="flex items-center gap-1.5">
                              <Bug size={10} className="text-rose-400" />
                              <span className="text-[9px] font-bold text-rose-100">{alert.village}: {alert.type}</span>
                          </div>
                          <span className="text-[7px] font-black bg-rose-500 text-white px-1 py-0.5 rounded-full uppercase">Kritik</span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* COMPACT AI WIDGET */}
      <div className="relative group z-20">
          <form 
            onSubmit={handleAiAsk}
            className={`flex items-center bg-stone-900 border transition-all duration-300 overflow-hidden ${
                aiResponse 
                ? 'rounded-t-xl rounded-b-none border-emerald-500/40 bg-stone-800' 
                : 'rounded-xl border-white/5 hover:border-emerald-500/20'
            }`}
          >
              <div className="pl-2 pr-1.5 text-emerald-500">
                  {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} className={aiQuery ? "text-emerald-400" : "text-stone-700"} />}
              </div>
              <input 
                  type="text" 
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="MKS'ye teknik bir soru sor..." 
                  className="flex-1 bg-transparent py-2 text-[10px] text-stone-200 placeholder-stone-700 outline-none font-medium"
              />
              <button 
                type="submit" 
                disabled={isAiLoading || !aiQuery.trim()}
                className="p-2 text-stone-600 hover:text-emerald-400 disabled:opacity-30 transition-colors"
              >
                  <Send size={12} />
              </button>
          </form>

          {aiResponse && (
              <div className="bg-stone-800/95 backdrop-blur-md border-x border-b border-emerald-500/40 rounded-b-xl p-2 shadow-xl animate-in slide-in-from-top-1 relative">
                  <button 
                    onClick={() => { setAiResponse(null); setAiQuery(''); }} 
                    className="absolute top-1.5 right-1.5 p-1 bg-stone-900/50 rounded-full text-stone-500 hover:text-white"
                  >
                      <X size={8} />
                  </button>
                  <div className="text-[10px] text-stone-300 leading-tight whitespace-pre-wrap pr-3">
                      {aiResponse}
                  </div>
              </div>
          )}
      </div>

      <div>
        <h3 className="font-black text-stone-600 text-[8px] mb-2 flex items-center uppercase tracking-widest pl-1">
             Hızlı İşlemler
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
            <button 
                onClick={() => setIsPurchaseModalOpen(true)}
                className="group flex items-center gap-2.5 p-3 bg-emerald-900/10 backdrop-blur-sm rounded-2xl border border-emerald-500/20 active:scale-95 transition-all shadow-md"
            >
                <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg shadow-emerald-900/30">
                    <Truck size={16}/>
                </div>
                <div className="text-left">
                    <span className="block font-black text-[9px] text-emerald-100 uppercase tracking-wider">ALIM YAP</span>
                    <span className="text-[7px] text-emerald-500/70 font-bold uppercase">Stok Girişi</span>
                </div>
            </button>

            <button 
                onClick={() => onNavigate('PRESCRIPTION_NEW')}
                className="group flex items-center gap-2.5 p-3 bg-stone-900/60 backdrop-blur-sm rounded-2xl border border-white/10 active:scale-95 transition-all shadow-md"
            >
                <div className="bg-blue-600/20 text-blue-400 p-2 rounded-xl border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <FileText size={16}/>
                </div>
                <div className="text-left">
                    <span className="block font-black text-[9px] text-stone-200 uppercase tracking-wider">REÇETE</span>
                    <span className="text-[7px] text-stone-600 font-bold uppercase">Yeni Kayıt</span>
                </div>
            </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
            <button 
                onClick={() => onNavigate('VISIT_NEW')}
                className="group flex items-center gap-2.5 p-3 bg-stone-900/60 backdrop-blur-sm rounded-2xl border border-white/10 active:scale-95 transition-all shadow-md"
            >
                <div className="bg-orange-600/20 text-orange-400 p-2 rounded-xl border border-orange-500/20 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <Calendar size={16}/>
                </div>
                <div className="text-left">
                    <span className="block font-black text-[9px] text-stone-200 uppercase tracking-wider">ZİYARET</span>
                    <span className="text-[7px] text-stone-600 font-bold uppercase">Saha Takibi</span>
                </div>
            </button>

            <button 
                onClick={() => onNavigate('INVENTORY')}
                className="group flex items-center gap-2.5 p-3 bg-stone-900/60 backdrop-blur-sm rounded-2xl border border-white/10 active:scale-95 transition-all shadow-md"
            >
                <div className="bg-purple-600/20 text-purple-400 p-2 rounded-xl border border-purple-500/20 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Package size={16}/>
                </div>
                <div className="text-left">
                    <span className="block font-black text-[9px] text-stone-200 uppercase tracking-wider">DEPOM</span>
                    <span className="text-[7px] text-stone-600 font-bold uppercase">Stok Durumu</span>
                </div>
            </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3">
            <ActionButton onClick={() => onNavigate('DISEASE_DIAGNOSIS')} icon={Sparkles} label="AI TEŞHİS" color="emerald" />
            <ActionButton onClick={() => onNavigate('MAP_VIEW')} icon={Route} label="ROTA" color="blue" />
            <ActionButton onClick={() => onNavigate('REMINDERS_NEW')} icon={Bell} label="PLAN" color="amber" />
            <ActionButton onClick={() => onNavigate('COMPATIBILITY_CHECK')} icon={FlaskConical} label="KARIŞIM" color="purple" />
        </div>
      </div>

      {/* DAILY SALES CHART */}
      <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-emerald-500/10 rounded-lg">
                      <TrendingUp size={12} className="text-emerald-500" />
                  </div>
                  <h3 className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Satış Performansı</h3>
              </div>
              <button 
                onClick={() => onNavigate('STATISTICS')}
                className="text-[7px] font-black text-stone-600 uppercase tracking-widest hover:text-emerald-500 transition-colors"
              >
                  Detay <ChevronRight size={8} className="inline" />
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
                          formatter={(value: number) => [`${value.toLocaleString('tr-TR')} TL`, 'Satış']}
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

      {/* QUICK PURCHASE MODAL */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end justify-center animate-in fade-in duration-300">
          <div className="bg-stone-900 rounded-t-[2.5rem] w-full max-w-lg shadow-2xl relative animate-in slide-in-from-bottom duration-500 border-t border-white/10 p-6 pb-24 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center mb-5">
                <div className="w-10 h-1 bg-stone-800 rounded-full mb-4"></div>
                <div className="w-full flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-bold text-stone-100">Hızlı Mal Alımı</h2>
                        <p className="text-[9px] text-stone-600 font-black uppercase tracking-widest">Tedarikçiden Stok Girişi</p>
                    </div>
                    <button onClick={() => setIsPurchaseModalOpen(false)} className="p-2 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors"><X size={16} /></button>
                </div>
            </div>
            
            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              {/* Supplier Selection */}
              <div>
                  <label className="text-[8px] font-black text-stone-600 ml-1 uppercase tracking-widest mb-1 block">Tedarikçi Seçin</label>
                  <select 
                    required 
                    value={selectedSupplierId} 
                    onChange={e => setSelectedSupplierId(e.target.value)}
                    className="w-full p-3 bg-stone-950 border border-stone-800 focus:border-emerald-500/30 rounded-xl outline-none font-bold transition-all text-white text-xs"
                  >
                      <option value="">Tedarikçi Seçiniz...</option>
                      {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                  {suppliers.length === 0 && (
                      <p className="text-[10px] text-amber-500 mt-1 ml-1 font-medium">Önce bir tedarikçi eklemelisiniz.</p>
                  )}
              </div>

              {/* Item Search */}
              <div className="relative">
                  <label className="text-[8px] font-black text-stone-600 ml-1 uppercase tracking-widest mb-1 block">Ürün Ekle</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-stone-700" size={14} />
                        <input 
                            type="text" 
                            value={searchPestTerm}
                            onChange={e => setSearchPestTerm(e.target.value)}
                            placeholder="Ürün adı veya etken madde..." 
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
                              <span className="text-xs font-bold text-emerald-400">"{searchPestTerm}" olarak yeni ekle</span>
                          </button>
                      </div>
                  )}
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
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
                                  <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest mb-1 block">Miktar</label>
                                  <input 
                                    type="number" 
                                    value={item.quantity}
                                    onChange={e => {
                                        const newItems = [...purchaseItems];
                                        newItems[idx].quantity = Number(e.target.value);
                                        setPurchaseItems(newItems);
                                    }}
                                    className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg text-xs font-bold text-white outline-none"
                                  />
                              </div>
                              <div>
                                  <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest mb-1 block">Birim</label>
                                  <select 
                                    value={item.unit}
                                    onChange={e => {
                                        const newItems = [...purchaseItems];
                                        newItems[idx].unit = e.target.value;
                                        setPurchaseItems(newItems);
                                    }}
                                    className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg text-xs font-bold text-white outline-none"
                                  >
                                      <option value="Adet">Adet</option>
                                      <option value="Litre">Litre</option>
                                      <option value="Kg">Kg</option>
                                      <option value="Kutu">Kutu</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest mb-1 block">Alış Fiyatı</label>
                                  <div className="relative">
                                      <DollarSign className="absolute left-2 top-2.5 text-stone-700" size={10} />
                                      <input 
                                        type="number" 
                                        value={item.buyingPrice}
                                        onChange={e => {
                                            const newItems = [...purchaseItems];
                                            newItems[idx].buyingPrice = Number(e.target.value);
                                            setPurchaseItems(newItems);
                                        }}
                                        className="w-full p-2 pl-6 bg-stone-900 border border-stone-800 rounded-lg text-xs font-bold text-white outline-none"
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
                  {purchaseItems.length === 0 && (
                      <div className="py-8 text-center border-2 border-dashed border-stone-800 rounded-2xl">
                          <Package size={24} className="text-stone-800 mx-auto mb-2 opacity-50" />
                          <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest">Henüz ürün eklenmedi</p>
                      </div>
                  )}
              </div>

              {/* Summary & Submit */}
              <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center mb-4 px-1">
                      <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Toplam Tutar</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                          {purchaseItems.reduce((sum, item) => sum + (item.quantity * item.buyingPrice), 0).toLocaleString('tr-TR')} TL
                      </span>
                  </div>
                  <button 
                    type="submit" 
                    disabled={!selectedSupplierId || purchaseItems.length === 0}
                    className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 active:scale-[0.97] transition-all disabled:opacity-30 disabled:active:scale-100 border border-white/10"
                  >
                      Alımı Kaydet
                  </button>
              </div>
            </form>
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
            className="group flex flex-col items-center justify-center p-3 bg-stone-900 border border-white/5 rounded-2xl active:scale-95 transition-all shadow-md"
        >
            <div className={`p-2 rounded-xl group-hover:text-white transition-colors mb-1 ${colorClasses[color] || colorClasses.emerald}`}>
                <Icon size={18}/>
            </div>
            <span className="block font-black text-[8px] text-stone-400 uppercase tracking-tight group-hover:text-stone-200">{label}</span>
        </button>
    );
};
