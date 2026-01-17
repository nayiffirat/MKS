import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { WeatherWidget } from './WeatherComponents';
import { Users, FileText, Sprout, Plus, X, MapPin, Calendar, Newspaper, ChevronRight } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { stats, addFarmer } = useAppViewModel();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFarmerName, setNewFarmerName] = useState('');
  const [newFarmerPhone, setNewFarmerPhone] = useState('');
  const [newFarmerVillage, setNewFarmerVillage] = useState('');

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await addFarmer({
      fullName: newFarmerName,
      phoneNumber: newFarmerPhone,
      village: newFarmerVillage,
      fieldSize: 0,
      crops: ''
    });
    setIsAddModalOpen(false);
    setNewFarmerName('');
    setNewFarmerPhone('');
    setNewFarmerVillage('');
  };

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto pb-24 relative min-h-[80vh]">
      <header className="mb-4 pt-4">
        <h1 className="text-3xl font-bold text-agri-900">Hoşgeldin Mühendis,</h1>
        <p className="text-stone-500 mt-1">Bugün tarlalar bereketli görünüyor.</p>
      </header>

      <WeatherWidget />

      <button 
        onClick={() => onNavigate('NEWS')}
        className="w-full bg-white p-4 rounded-xl border border-stone-200 shadow-sm hover:shadow-md hover:border-agri-300 transition-all flex items-center justify-between group"
      >
        <div className="flex items-center">
            <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg mr-3">
                <Newspaper size={20} />
            </div>
            <div className="text-left">
                <h3 className="font-bold text-stone-800 group-hover:text-agri-700">Güncel Tarımsal Haberler</h3>
                <p className="text-xs text-stone-500">Destekler, yönetmelikler ve duyurular</p>
            </div>
        </div>
        <ChevronRight className="text-stone-400 group-hover:text-agri-600" />
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div onClick={() => onNavigate('FARMERS')} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="p-4 bg-agri-100 text-agri-600 rounded-full"><Users size={24} /></div>
          <div><p className="text-stone-500 text-sm font-medium">Toplam Çiftçi</p><p className="text-3xl font-bold text-stone-800">{stats.totalFarmers}</p></div>
        </div>
        <div onClick={() => onNavigate('PRESCRIPTIONS')} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-full"><FileText size={24} /></div>
          <div><p className="text-stone-500 text-sm font-medium">Bugünkü Reçeteler</p><p className="text-3xl font-bold text-stone-800">{stats.todayPrescriptions}</p></div>
        </div>
        <div onClick={() => onNavigate('VISITS')} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center space-x-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="p-4 bg-orange-100 text-orange-600 rounded-full"><Calendar size={24} /></div>
          <div><p className="text-stone-500 text-sm font-medium">Son Ziyaretler</p><p className="text-3xl font-bold text-stone-800">{stats.pendingVisits}</p></div>
        </div>
      </div>

      <button onClick={() => setIsAddModalOpen(true)} className="fixed bottom-24 right-6 md:bottom-10 md:right-10 bg-agri-600 text-white p-4 rounded-full shadow-lg hover:bg-agri-700 transition-all transform hover:scale-105 z-40 flex items-center justify-center">
        <Plus size={28} />
      </button>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"><X size={24} /></button>
            <h2 className="text-xl font-bold text-agri-800 mb-6 flex items-center"><Sprout className="mr-2" size={24} /> Hızlı Çiftçi Ekle</h2>
            <form onSubmit={handleQuickAdd} className="space-y-4">
              <input required type="text" value={newFarmerName} onChange={e => setNewFarmerName(e.target.value)} className="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-agri-500 outline-none" placeholder="Ad Soyad" />
              <input required type="tel" value={newFarmerPhone} onChange={e => setNewFarmerPhone(e.target.value)} className="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-agri-500 outline-none" placeholder="Telefon" />
              <input required type="text" value={newFarmerVillage} onChange={e => setNewFarmerVillage(e.target.value)} className="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-agri-500 outline-none" placeholder="Köy/Konum" />
              <button type="submit" className="w-full bg-agri-600 text-white py-3.5 rounded-xl font-bold text-lg shadow-md hover:bg-agri-700 transition-colors">Kaydet</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};