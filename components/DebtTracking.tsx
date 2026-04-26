
import React, { useState, useMemo } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Search, ChevronRight, MessageCircle, AlertCircle, Filter, Calendar, User, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Clock, Search as SearchIcon, Phone, FileText, Plus, X, Trash2, History, Send } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { Farmer, CollectionLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const DebtTracking: React.FC = () => {
  const { farmers, prescriptions, stats, userProfile, t, farmerLabel, collectionLogs, addCollectionLog, deleteCollectionLog, plants } = useAppViewModel();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'OVERDUE' | 'HIGH_DEBT'>('ALL');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // New log form state
  const [newLog, setNewLog] = useState<Partial<CollectionLog>>({
    type: 'PHONE_CALL',
    status: 'REMINDED',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // Calculate detailed debt info for each farmer using context balances
  const farmerDebtDetails = useMemo(() => {
    return farmers
      .filter(f => (f.balance || 0) < 0) // Only farmers who owe money
      .map(farmer => {
        const farmerPrescriptions = prescriptions.filter(p => p.farmerId === farmer.id && !p.deletedAt);

        // Find overdue prescriptions - match AppContext logic for debt qualification
        const overduePrescriptions = farmerPrescriptions.filter(p => {
          if (p.priceType === 'CASH' || !p.dueDate) return false;
          const dueDate = new Date(p.dueDate);
          const now = new Date();
          return dueDate < now;
        });

        return {
          farmer,
          totalDebt: Math.abs(farmer.balance || 0),
          balance: farmer.balance || 0,
          hasOverdue: overduePrescriptions.length > 0,
          overdueCount: overduePrescriptions.length,
          latestPrescription: farmerPrescriptions[0], // Already sorted by date
        };
      })
      .sort((a, b) => a.farmer.fullName.localeCompare(b.farmer.fullName, 'tr-TR'));
  }, [farmers, prescriptions]);

  const filteredFarmers = useMemo(() => {
    let result = farmerDebtDetails.filter(d => 
      d.farmer.fullName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) ||
      d.farmer.phoneNumber.includes(searchTerm)
    );

    if (filterType === 'OVERDUE') {
      result = result.filter(d => d.hasOverdue);
    } else if (filterType === 'HIGH_DEBT') {
      result = result.sort((a, b) => a.balance - b.balance); // Most negative first
    }

    return result;
  }, [farmerDebtDetails, searchTerm, filterType]);

  const overdueSummaryCount = useMemo(() => {
    return farmerDebtDetails.filter(d => d.hasOverdue).length;
  }, [farmerDebtDetails]);

  const handleSendReminder = (e: React.MouseEvent, farmer: Farmer, amount: number) => {
    e.stopPropagation();
    const message = `Sayın ${farmer.fullName}, bakiyenizde ${formatCurrency(amount, userProfile?.currency || 'TRY')} borç gözükmektedir. Ödeme durumunuzu kontrol etmenizi rica ederiz. İyi günler dileriz.`;
    const whatsappUrl = `https://wa.me/${farmer.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleOpenLog = (farmerId: string) => {
    setSelectedFarmerId(farmerId);
    setIsLogModalOpen(true);
  };

  const selectedFarmer = useMemo(() => 
    farmers.find(f => f.id === selectedFarmerId),
  [farmers, selectedFarmerId]);

  const selectedFarmerLogs = useMemo(() => 
    collectionLogs.filter(l => l.farmerId === selectedFarmerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [collectionLogs, selectedFarmerId]);

  const handleAddLog = async () => {
    if (!selectedFarmerId || !newLog.type || !newLog.status || !newLog.date) return;

    await addCollectionLog({
      farmerId: selectedFarmerId,
      date: newLog.date,
      type: newLog.type as any,
      status: newLog.status as any,
      note: newLog.note,
      nextCallDate: newLog.nextCallDate
    });

    setNewLog({
      type: 'PHONE_CALL',
      status: 'REMINDED',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-stone-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingDown size={40} className="text-rose-500" />
          </div>
          <p className="text-[10px] font-black text-rose-500/70 uppercase tracking-widest mb-1">Toplam Alacak</p>
          <p className="text-xl font-black text-white font-mono">{formatCurrency(stats.totalDebt || 0, userProfile?.currency || 'TRY')}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[9px] font-bold text-stone-500 uppercase">{farmerDebtDetails.length} {farmerLabel}</span>
          </div>
        </div>

        <div className="bg-stone-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Clock size={40} className="text-amber-500" />
          </div>
          <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest mb-1">Gecikmiş</p>
          <p className="text-xl font-black text-white font-mono">{overdueSummaryCount}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className={`w-1.5 h-1.5 rounded-full ${overdueSummaryCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-stone-700'}`} />
            <span className="text-[9px] font-bold text-stone-500 uppercase">Vadesi Geçen</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="text-stone-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
          </div>
          <input
            type="text"
            placeholder={`${farmerLabel} ara...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-12 pr-4 py-4 bg-stone-900/50 border border-white/5 rounded-2xl text-stone-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder:text-stone-600 font-medium"
          />
        </div>

        <div className="flex gap-2 p-1 bg-stone-900/50 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterType('ALL')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filterType === 'ALL' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Hepsi
          </button>
          <button
            onClick={() => setFilterType('OVERDUE')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filterType === 'OVERDUE' ? 'bg-amber-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Gecikenler
          </button>
          <button
            onClick={() => setFilterType('HIGH_DEBT')}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filterType === 'HIGH_DEBT' ? 'bg-rose-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Yüksek Borç
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredFarmers.length > 0 ? (
          filteredFarmers.map((detail) => (
            <div 
              key={detail.farmer.id}
              onClick={() => handleOpenLog(detail.farmer.id)}
              className="group bg-stone-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-4 hover:bg-stone-800/60 transition-all active:scale-[0.98] border-l-4 border-l-rose-500/50 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-stone-800 border border-white/5 flex items-center justify-center text-stone-500">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-stone-100">{detail.farmer.fullName}</h3>
                    <p className="text-[10px] text-stone-500 font-medium">{detail.farmer.phoneNumber}</p>
                    <div className="flex gap-2 mt-1">
                      {detail.hasOverdue && (
                        <span className="flex items-center gap-1 text-[8px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          <AlertCircle size={8} /> Vadesi Geçmiş
                        </span>
                      )}
                      <span className="text-[8px] font-black text-stone-500 bg-stone-800/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        {detail.farmer.village}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-stone-600 uppercase tracking-widest mb-0.5">Kalan Borç</p>
                  <p className="text-base font-black text-rose-500 font-mono">
                    {formatCurrency(Math.abs(detail.balance), userProfile?.currency || 'TRY')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                <button
                  onClick={(e) => handleSendReminder(e, detail.farmer, Math.abs(detail.balance))}
                  className="flex items-center justify-center gap-2 py-3 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-2xl transition-all group/btn"
                >
                  <MessageCircle size={16} className="group-hover/btn:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">WP Hatırlat</span>
                </button>
                <div className="flex items-center justify-center gap-2 py-3 bg-stone-800/50 rounded-2xl">
                   <div className="text-right flex flex-col items-end">
                      <p className="text-[8px] font-bold text-stone-500 uppercase">Son İşlem</p>
                      <div className="flex flex-col items-end">
                        <p className="text-[9px] font-mono text-stone-300 leading-none">
                          {detail.latestPrescription ? new Date(detail.latestPrescription.date).toLocaleDateString('tr-TR') : '-'}
                        </p>
                        {detail.latestPrescription?.plantId && (
                          <p className="text-[7px] font-black text-amber-500 uppercase tracking-tighter mt-0.5 leading-none bg-amber-500/10 px-1 rounded">
                            {plants.find(p => p.id === detail.latestPrescription?.plantId)?.name}
                          </p>
                        )}
                      </div>
                   </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-stone-900/40 border border-white/5 rounded-[2rem] p-12 text-center">
            <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-600">
              <Filter size={32} />
            </div>
            <h3 className="text-stone-400 font-bold mb-1">Borçlu Bulunamadı</h3>
            <p className="text-stone-600 text-xs lowercase">arama kriterlerinize uygun sonuç yok.</p>
          </div>
        )}
      </div>
      {/* Contact Log Modal */}
      <AnimatePresence>
        {isLogModalOpen && selectedFarmer && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogModalOpen(false)}
              className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-2xl bg-stone-900 border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 bg-stone-900/50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-stone-800 border border-white/5 flex items-center justify-center text-rose-500">
                    <History size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{selectedFarmer.fullName}</h3>
                    <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">İrtibat Geçmişi</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsLogModalOpen(false)}
                  className="p-2 bg-stone-800 rounded-xl text-stone-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                {/* New Log Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">Yeni Kayıt Ekle</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-600 uppercase ml-1">Tarih</label>
                      <input 
                        type="date"
                        value={newLog.date}
                        onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                        className="w-full bg-stone-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-600 uppercase ml-1">İrtibat Tipi</label>
                      <select 
                        value={newLog.type}
                        onChange={(e) => setNewLog({ ...newLog, type: e.target.value as any })}
                        className="w-full bg-stone-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                      >
                        <option value="PHONE_CALL">📞 Telefon Araması</option>
                        <option value="WP_MESSAGE">💬 WhatsApp Mesajı</option>
                        <option value="IN_PERSON">🤝 Yüz Yüze Görüşme</option>
                        <option value="OTHER">📁 Diğer</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-600 uppercase ml-1">Durum</label>
                      <select 
                        value={newLog.status}
                        onChange={(e) => setNewLog({ ...newLog, status: e.target.value as any })}
                        className="w-full bg-stone-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                      >
                        <option value="REMINDED">Hatırlatıldı</option>
                        <option value="PROMISED_TO_PAY">Ödeme Sözü Alındı</option>
                        <option value="PAID">Ödeme Yapıldı</option>
                        <option value="UNREACHABLE">Ulaşılamadı</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-600 uppercase ml-1">Sonraki Arama</label>
                      <input 
                        type="date"
                        value={newLog.nextCallDate || ''}
                        onChange={(e) => setNewLog({ ...newLog, nextCallDate: e.target.value })}
                        className="w-full bg-stone-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-stone-600 uppercase ml-1">Notlar</label>
                    <textarea 
                      value={newLog.note}
                      onChange={(e) => setNewLog({ ...newLog, note: e.target.value })}
                      placeholder="Görüşme detaylarını buraya kaydedin..."
                      className="w-full bg-stone-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all min-h-[100px] resize-none"
                    />
                  </div>

                  <button
                    onClick={handleAddLog}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-emerald-500/20"
                  >
                    <Plus size={18} />
                    Kaydet
                  </button>
                </div>

                {/* History Section */}
                <div className="space-y-4 pt-6">
                  <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">Geçmiş Görüşmeler ({selectedFarmerLogs.length})</h4>
                  <div className="space-y-3">
                    {selectedFarmerLogs.length > 0 ? (
                      selectedFarmerLogs.map((log) => (
                        <div 
                          key={log.id}
                          className="bg-stone-800/30 border border-white/5 rounded-2xl p-4 relative group/item"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              {log.type === 'PHONE_CALL' && <Phone size={14} className="text-blue-500" />}
                              {log.type === 'WP_MESSAGE' && <MessageCircle size={14} className="text-emerald-500" />}
                              {log.type === 'IN_PERSON' && <User size={14} className="text-amber-500" />}
                              {log.type === 'OTHER' && <FileText size={14} className="text-stone-500" />}
                              <span className="text-[10px] font-black text-stone-300 uppercase tracking-wider">
                                {log.type === 'PHONE_CALL' ? 'ARAMA' : 
                                 log.type === 'WP_MESSAGE' ? 'MESAJ' : 
                                 log.type === 'IN_PERSON' ? 'GÖRÜŞME' : 'DİĞER'}
                              </span>
                            </div>
                            <button 
                              onClick={() => deleteCollectionLog(log.id)}
                              className="opacity-0 group-hover/item:opacity-100 p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-xs text-stone-200 mt-1 font-medium">{log.note || 'Not girilmedi'}</p>
                              {log.nextCallDate && (
                                <p className="text-[10px] text-amber-500 font-bold mt-2 flex items-center gap-1.5 uppercase tracking-tighter">
                                  <Clock size={10} /> Sonraki: {new Date(log.nextCallDate).toLocaleDateString('tr-TR')}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                log.status === 'REMINDED' ? 'bg-blue-500/10 text-blue-500' :
                                log.status === 'PROMISED_TO_PAY' ? 'bg-amber-500/10 text-amber-500' :
                                log.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' :
                                'bg-stone-500/10 text-stone-500'
                              }`}>
                                {log.status === 'REMINDED' ? 'Hatırlatıldı' : 
                                 log.status === 'PROMISED_TO_PAY' ? 'Söz Alındı' : 
                                 log.status === 'PAID' ? 'Ödendi' : 'Ulaşılamadı'}
                              </span>
                              <p className="text-[9px] font-mono text-stone-600 mt-1">{new Date(log.date).toLocaleDateString('tr-TR')}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 bg-stone-800/20 border border-dashed border-white/5 rounded-2xl">
                        <p className="text-xs text-stone-600 font-medium">Henüz bir görüşme kaydı bulunmuyor.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
