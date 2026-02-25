
import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { WeatherWidget } from './WeatherComponents';
import { Users, FileText, Sprout, Plus, X, Calendar, Newspaper, ChevronRight, Droplet, ArrowRight, Zap, MapPin, Sparkles, Send, Loader2, Bot, BrainCircuit, CalendarCheck, Clock, Mic, Bell, CalendarClock } from 'lucide-react';
import { ViewState } from '../types';
import { GeminiService } from '../services/gemini';

interface DashboardProps {
  onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { addFarmer, userProfile, reminders, stats } = useAppViewModel();
  
  // Quick Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFarmerName, setNewFarmerName] = useState('');
  const [newFarmerPhone, setNewFarmerPhone] = useState('+90 ');
  const [newFarmerVillage, setNewFarmerVillage] = useState('');

  // AI Widget State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Get first pending reminder
  const nextReminder = reminders.find(r => !r.isCompleted);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val.length < 4) {
          setNewFarmerPhone('+90 ');
      } else if (!val.startsWith('+90')) {
          setNewFarmerPhone('+90 ' + val.replace(/^\+90\s*/, ''));
      } else {
          setNewFarmerPhone(val);
      }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmerName || !newFarmerPhone) return;
    await addFarmer({
      fullName: newFarmerName,
      phoneNumber: newFarmerPhone,
      village: newFarmerVillage || 'Merkez',
      fieldSize: 0,
      crops: ''
    });
    setIsAddModalOpen(false);
    setNewFarmerName('');
    setNewFarmerPhone('+90 ');
    setNewFarmerVillage('');
  };

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
      <header className="flex items-stretch gap-2 mb-3 mt-1 h-28">
        {/* Left Side: Greeting Card */}
        <div className="flex-[2] relative bg-stone-900 border border-white/10 rounded-[1.8rem] p-4 overflow-hidden flex flex-col justify-center shadow-md group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none transition-opacity duration-700 group-hover:opacity-50"></div>
            
            <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-full border border-white/5 backdrop-blur-md mb-1.5 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">
                        {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                </div>
                
                <div className="space-y-0.5">
                    <h2 className="text-sm font-medium text-stone-500 tracking-tight">Merhaba,</h2>
                    <h1 className="text-xl font-black text-stone-100 truncate tracking-tight drop-shadow-sm">
                        {getFirstName(userProfile.fullName)}
                    </h1>
                </div>
            </div>
        </div>

        {/* Right Side: AI Assistant Button */}
        <button 
            onClick={() => onNavigate('FIELD_ASSISTANT')}
            className="flex-1 relative flex flex-col items-center justify-center p-1.5 rounded-[1.8rem] bg-gradient-to-b from-stone-800 to-stone-950 border border-emerald-500/20 shadow-md active:scale-95 transition-all group overflow-hidden hover:border-emerald-500/40"
        >
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-full flex items-center justify-center shadow-lg shadow-emerald-900/40 mb-1.5 group-hover:scale-110 transition-transform duration-300 relative z-10 border border-emerald-400/20">
                <Mic className="text-white" size={18} />
                <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-ping opacity-20 duration-1000"></div>
            </div>
            
            <span className="text-[8px] font-black text-emerald-500/80 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">Asistan</span>
        </button>
      </header>

      {/* --- TASKS SECTION (NEXT JOB & TOMORROW) --- */}
      <div className="grid grid-cols-2 gap-2">
          {/* Next Job Card */}
          <button 
            onClick={() => onNavigate('REMINDERS')}
            className="col-span-1 p-2.5 bg-stone-900/60 border border-white/5 rounded-[1.3rem] flex flex-col justify-center group active:scale-[0.98] transition-all hover:bg-stone-900 min-h-[80px]"
          >
            <div className="flex items-center space-x-2 mb-1.5">
                <div className="p-1.5 bg-amber-500/10 rounded-lg shrink-0">
                    <CalendarCheck className="text-amber-500" size={14} />
                </div>
                <h4 className="text-stone-300 font-bold text-[10px] uppercase tracking-wide">Bugün</h4>
            </div>
            <p className="text-stone-500 text-[10px] truncate w-full leading-tight font-medium pl-1">
                {nextReminder ? nextReminder.title : 'Bugün boş.'}
            </p>
          </button>

          {/* Tomorrow's Plan Card */}
          <button 
            onClick={() => onNavigate('REMINDERS_TOMORROW')}
            className="col-span-1 p-2.5 bg-stone-900/60 border border-white/5 rounded-[1.3rem] flex flex-col justify-center group active:scale-[0.98] transition-all hover:bg-stone-900 min-h-[80px] relative overflow-hidden"
          >
             {stats.tomorrowReminders > 0 && (
                 <div className="absolute top-0 right-0 p-2 opacity-10">
                     <CalendarClock size={40} className="text-emerald-500" />
                 </div>
             )}
             <div className="flex items-center space-x-2 mb-1.5 relative z-10">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg shrink-0">
                    <CalendarClock className="text-emerald-500" size={14} />
                </div>
                <h4 className="text-stone-300 font-bold text-[10px] uppercase tracking-wide">Yarın</h4>
            </div>
            <div className="pl-1 relative z-10">
                {stats.tomorrowReminders > 0 ? (
                    <p className="text-emerald-400 text-[11px] font-black tracking-wide">
                        {stats.tomorrowReminders} Plan Var
                    </p>
                ) : (
                    <p className="text-stone-500 text-[10px] font-medium">Plan yok.</p>
                )}
            </div>
          </button>
      </div>

      <WeatherWidget />

      {/* COMPACT AI WIDGET */}
      <div className="relative group z-20">
          <form 
            onSubmit={handleAiAsk}
            className={`flex items-center bg-stone-900 border transition-all duration-300 overflow-hidden ${
                aiResponse 
                ? 'rounded-t-2xl rounded-b-none border-emerald-500/40 bg-stone-800' 
                : 'rounded-2xl border-white/5 hover:border-emerald-500/20'
            }`}
          >
              <div className="pl-3 pr-2 text-emerald-500">
                  {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} className={aiQuery ? "text-emerald-400" : "text-stone-700"} />}
              </div>
              <input 
                  type="text" 
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="MKS'ye teknik bir soru sor..." 
                  className="flex-1 bg-transparent py-2.5 text-[11px] text-stone-200 placeholder-stone-700 outline-none font-medium"
              />
              <button 
                type="submit" 
                disabled={isAiLoading || !aiQuery.trim()}
                className="p-2.5 text-stone-600 hover:text-emerald-400 disabled:opacity-30 transition-colors"
              >
                  <Send size={14} />
              </button>
          </form>

          {aiResponse && (
              <div className="bg-stone-800/95 backdrop-blur-md border-x border-b border-emerald-500/40 rounded-b-2xl p-3 shadow-xl animate-in slide-in-from-top-1 relative">
                  <button 
                    onClick={() => { setAiResponse(null); setAiQuery(''); }} 
                    className="absolute top-2 right-2 p-1 bg-stone-900/50 rounded-full text-stone-500 hover:text-white"
                  >
                      <X size={10} />
                  </button>
                  <div className="text-[11px] text-stone-300 leading-relaxed whitespace-pre-wrap pr-4">
                      {aiResponse}
                  </div>
              </div>
          )}
      </div>

      <div>
        <h3 className="font-black text-stone-700 text-[8px] mb-2 flex items-center uppercase tracking-[0.2em] pl-1">
             Hızlı İşlemler
        </h3>
        <div className="grid grid-cols-4 gap-2">
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="group flex flex-col items-center justify-center p-2 bg-emerald-900/10 backdrop-blur-sm rounded-2xl border border-emerald-500/10 active:scale-95 transition-all"
            >
                <div className="bg-emerald-600 text-white p-1.5 rounded-xl mb-1 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-900/20">
                    <Plus size={16}/>
                </div>
                <span className="font-black text-[7px] text-emerald-100 uppercase tracking-tight">ÇİFTÇİ</span>
            </button>

            <button 
                onClick={() => onNavigate('PRESCRIPTION_NEW')}
                className="group flex flex-col items-center justify-center p-2 bg-stone-900/30 backdrop-blur-sm rounded-2xl border border-white/5 active:scale-95 transition-all"
            >
                <div className="bg-blue-600/20 text-blue-400 p-1.5 rounded-xl mb-1 border border-blue-500/10 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <FileText size={16}/>
                </div>
                <span className="font-black text-[7px] text-stone-400 uppercase tracking-tight">REÇETE</span>
            </button>
            
            <button 
                onClick={() => onNavigate('VISIT_NEW')}
                className="group flex flex-col items-center justify-center p-2 bg-stone-900/30 backdrop-blur-sm rounded-2xl border border-white/5 active:scale-95 transition-all"
            >
                <div className="bg-orange-600/20 text-orange-400 p-1.5 rounded-xl mb-1 border border-orange-500/10 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <Calendar size={16}/>
                </div>
                <span className="font-black text-[7px] text-stone-400 uppercase tracking-tight">ZİYARET</span>
            </button>

            <button 
                onClick={() => onNavigate('REMINDERS_NEW')}
                className="group flex flex-col items-center justify-center p-2 bg-stone-900/30 backdrop-blur-sm rounded-2xl border border-white/5 active:scale-95 transition-all"
            >
                <div className="bg-amber-600/20 text-amber-400 p-1.5 rounded-xl mb-1 border border-amber-500/10 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Bell size={16}/>
                </div>
                <span className="font-black text-[7px] text-stone-400 uppercase tracking-tight">PLAN</span>
            </button>
        </div>
      </div>

      {/* QUICK ADD FARMER - BOTTOM SHEET STYLE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end justify-center animate-in fade-in duration-300">
          <div className="bg-stone-900 rounded-t-[2.5rem] w-full max-w-lg shadow-2xl relative animate-in slide-in-from-bottom duration-500 border-t border-white/10 p-6 pb-12">
            <div className="flex flex-col items-center mb-5">
                <div className="w-10 h-1 bg-stone-800 rounded-full mb-4"></div>
                <div className="w-full flex justify-between items-center">
                    <div>
                        <h2 className="text-base font-bold text-stone-100">Hızlı Çiftçi Ekle</h2>
                        <p className="text-[9px] text-stone-600 font-black uppercase tracking-widest">Yeni Üretici Kaydı</p>
                    </div>
                    <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-stone-800 rounded-full text-stone-500 hover:text-white"><X size={16} /></button>
                </div>
            </div>
            
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div>
                  <label className="text-[8px] font-black text-stone-600 ml-1 uppercase tracking-widest mb-1 block">Ad Soyad</label>
                  <input required type="text" value={newFarmerName} onChange={e => setNewFarmerName(e.target.value)} className="w-full p-3 bg-stone-950 border border-stone-800 focus:border-emerald-500/30 rounded-xl outline-none font-bold transition-all text-white placeholder-stone-800 text-xs" placeholder="Ahmet Yılmaz" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="text-[8px] font-black text-stone-600 ml-1 uppercase tracking-widest mb-1 block">Telefon</label>
                      <input required type="tel" value={newFarmerPhone} onChange={handlePhoneChange} className="w-full p-3 bg-stone-950 border border-stone-800 focus:border-emerald-500/30 rounded-xl outline-none font-bold transition-all text-white placeholder-stone-800 text-xs" placeholder="+90 5XX..." />
                  </div>
                  <div>
                      <label className="text-[8px] font-black text-stone-600 ml-1 uppercase tracking-widest mb-1 block">Köy</label>
                      <input required type="text" value={newFarmerVillage} onChange={e => setNewFarmerVillage(e.target.value)} className="w-full p-3 bg-stone-950 border border-stone-800 focus:border-emerald-500/30 rounded-xl outline-none font-bold transition-all text-white placeholder-stone-800 text-xs" placeholder="Örn: Harran" />
                  </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 active:scale-[0.97] transition-all mt-4 border border-white/5">Hızlı Kaydet</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
