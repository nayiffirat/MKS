import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sprout, 
  Plus, 
  Search, 
  ChevronLeft, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  Calendar,
  Layers
} from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { Plant } from '../types';

const CATEGORIES = [
  { id: 'TALA', name: 'Tarla Bitkileri', icon: '🌾' },
  { id: 'SEBZE', name: 'Sebzeler', icon: '🥦' },
  { id: 'MEYVE', name: 'Meyveler', icon: '🍎' },
  { id: 'ENDUSTRY', name: 'Endüstri Bitkileri', icon: '🏭' },
  { id: 'SERA', name: 'Sera Bitkileri', icon: '🏠' },
];

export const Plants: React.FC<{ onNavigate: (view: any) => void }> = ({ onNavigate }) => {
  const { plants, addPlant, updatePlant, deletePlant, showToast } = useAppViewModel();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [formData, setFormData] = useState<Omit<Plant, 'id'>>({
    name: '',
    category: 'TALA',
    maturityDate: '10-31',
    defaultDosage: ''
  });

  const filteredPlants = useMemo(() => {
    return plants.filter((p: Plant) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [plants, searchTerm, selectedCategory]);

  const handleOpenModal = (plant?: Plant) => {
    setIsDeleting(false);
    setIsDatePickerOpen(false);
    if (plant) {
      setEditingPlant(plant);
      setFormData({ 
          name: plant.name,
          category: plant.category || 'TALA',
          maturityDate: plant.maturityDate || '10-31',
          defaultDosage: plant.defaultDosage || ''
      });
    } else {
      setEditingPlant(null);
      setFormData({
        name: '',
        category: 'TALA',
        maturityDate: '10-31',
        defaultDosage: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlant) {
        await updatePlant({ ...formData, id: editingPlant.id });
        showToast('Bitki başarıyla güncellendi', 'success');
      } else {
        await addPlant(formData);
        showToast('Yeni bitki başarıyla eklendi', 'success');
      }
      setIsModalOpen(false);
    } catch (error) {
      showToast('Bir hata oluştu', 'error');
    }
  };

  const handleDelete = async () => {
    if (!editingPlant) return;
    try {
      await deletePlant(editingPlant.id);
      showToast('Bitki silindi', 'success');
      setIsModalOpen(false);
      setIsDeleting(false);
    } catch (error) {
      showToast('Silme işlemi başarısız', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 pb-24">
      {/* Header */}
      <div className="bg-stone-900/50 border-b border-white/5 pt-12 pb-6 px-4 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('DASHBOARD')}
              className="p-2 bg-stone-800 rounded-xl text-stone-400 active:scale-90 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight uppercase">Bitki Yönetimi</h1>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-none">Ürün ve Saha Kayıtları</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-900/40 border border-emerald-500/20"
          >
            <Plus size={20} />
          </motion.button>
        </div>

        {/* Filter Tabs */}
        <div className="max-w-xl mx-auto mt-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scroll-hide">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedCategory === 'ALL' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'bg-stone-900 text-stone-500 border border-white/5'
              }`}
            >
              Tümü
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedCategory === cat.id 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                    : 'bg-stone-900 text-stone-500 border border-white/5'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-4">
        {/* Search */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center text-stone-500 group-focus-within:text-emerald-500 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Bitki ara..."
            className="w-full bg-stone-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-bold outline-none focus:border-emerald-500/30 transition-all placeholder:text-stone-700"
          />
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredPlants.length > 0 ? (
            filteredPlants.map((plant: Plant, idx: number) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={plant.id}
                className="bg-stone-900/40 border border-white/5 rounded-2xl p-4 group relative overflow-hidden"
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/10">
                      <Sprout size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">{plant.name}</h3>
                        <span className="text-[8px] font-black bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded uppercase">
                          {CATEGORIES.find(c => c.id === plant.category)?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleOpenModal(plant)}
                    className="p-2 text-stone-600 hover:text-white transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                   <div className="bg-stone-950/50 rounded-xl p-2 border border-white/5 flex items-center gap-2">
                      <Calendar size={12} className="text-amber-500" />
                      <div className="min-w-0">
                         <span className="block text-[7px] font-black text-stone-600 uppercase tracking-widest leading-none">Vade Tarihi</span>
                         <span className="text-[10px] font-bold text-stone-300">{plant.maturityDate || '-'}</span>
                      </div>
                   </div>
                   <div className="bg-stone-950/50 rounded-xl p-2 border border-white/5 flex items-center gap-2">
                      <Layers size={12} className="text-emerald-500" />
                      <div className="min-w-0">
                         <span className="block text-[7px] font-black text-stone-600 uppercase tracking-widest leading-none">Dozaj</span>
                         <span className="text-[10px] font-bold text-stone-300 truncate">{plant.defaultDosage || '-'}</span>
                      </div>
                   </div>
                </div>

                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -z-10 group-hover:bg-emerald-500/10 transition-colors rounded-full"></div>
              </motion.div>
            ))
          ) : (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center mb-4 border border-white/5">
                <Sprout size={32} className="text-stone-700" />
              </div>
              <h3 className="text-stone-400 font-bold mb-1">Bitki bulunamadı</h3>
              <p className="text-[10px] text-stone-600 uppercase font-black tracking-widest">Arama kritiğini değiştirin veya yeni ekleyin</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal View */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-xl bg-stone-900 rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden flex flex-col max-h-[95vh] border-t border-white/10"
            >
              <div className="p-6 overflow-y-auto custom-scrollbar pt-12">
                 <div className="flex justify-between items-center mb-8">
                   <div>
                     <h2 className="text-xl font-black text-white uppercase tracking-tight">
                        {editingPlant ? 'Bitkiyi Düzenle' : 'Yeni Bitki Ekle'}
                     </h2>
                     <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Detaylı Bilgi Girişi</p>
                   </div>
                   <button 
                     onClick={() => setIsModalOpen(false)}
                     className="p-2 bg-stone-800 rounded-full text-stone-500"
                   >
                     <X size={20} />
                   </button>
                 </div>

                 <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest ml-1">Bitki Adı</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
                        placeholder="Örn: Pamuk, Domates"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest ml-1">Kategori</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                          className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-emerald-500/50 appearance-none"
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest ml-1">Vade Tarihi</label>
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(true)}
                        className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-left flex items-center justify-between group active:scale-[0.98] transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/10">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white uppercase tracking-tight">
                              {formData.maturityDate ? `${formData.maturityDate.split('-')[1]} ${new Date(2000, parseInt(formData.maturityDate.split('-')[0]) - 1).toLocaleString('tr-TR', { month: 'long' })}` : 'Tarih Seçin'}
                            </p>
                            <p className="text-[8px] font-black text-stone-600 uppercase tracking-widest leading-none mt-1">Hasat / Ödeme Günü</p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center text-stone-700 group-hover:text-amber-500 transition-colors">
                           <Edit2 size={14} />
                        </div>
                      </button>
                    </div>

                    <AnimatePresence>
                      {isDatePickerOpen && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDatePickerOpen(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                          />
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-sm bg-stone-900 rounded-[2rem] border border-white/10 p-6 overflow-hidden"
                          >
                            <div className="text-center mb-6">
                              <h3 className="text-lg font-black text-white uppercase tracking-tight">Vade Tarihi Seçin</h3>
                              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">Hasat veya Ödeme Zamanı</p>
                            </div>

                            <div className="space-y-6">
                              {/* Month Selector */}
                              <div className="flex items-center gap-2 overflow-x-auto pb-2 scroll-hide">
                                {Array.from({ length: 12 }, (_, i) => {
                                  const monthVal = String(i + 1).padStart(2, '0');
                                  const isSelected = (formData.maturityDate?.split('-')[0] || '10') === monthVal;
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => {
                                        const day = formData.maturityDate?.split('-')[1] || '01';
                                        setFormData({...formData, maturityDate: `${monthVal}-${day}`});
                                      }}
                                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                                        isSelected 
                                          ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-lg shadow-amber-900/20' 
                                          : 'bg-stone-800 text-stone-500 border-white/5'
                                      }`}
                                    >
                                      {new Date(2000, i).toLocaleString('tr-TR', { month: 'short' })}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Day Grid */}
                              <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: 31 }, (_, i) => {
                                  const dayVal = String(i + 1).padStart(2, '0');
                                  const isSelected = (formData.maturityDate?.split('-')[1] || '01') === dayVal;
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => {
                                        const month = formData.maturityDate?.split('-')[0] || '10';
                                        setFormData({...formData, maturityDate: `${month}-${dayVal}`});
                                      }}
                                      className={`aspect-square flex items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
                                        isSelected 
                                          ? 'bg-emerald-600 text-white shadow-lg' 
                                          : 'bg-stone-800 text-stone-600 hover:text-stone-400 border border-white/5'
                                      }`}
                                    >
                                      {i + 1}
                                    </button>
                                  );
                                })}
                              </div>

                              <button
                                type="button"
                                onClick={() => setIsDatePickerOpen(false)}
                                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-900/40 active:scale-95 transition-all mt-4"
                              >
                                SEÇİMİ TAMAMLA
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-stone-600 uppercase tracking-widest ml-1">Önerilen Dozaj/Verim</label>
                      <input
                        type="text"
                        value={formData.defaultDosage || ''}
                        onChange={(e) => setFormData({...formData, defaultDosage: e.target.value})}
                        className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-emerald-500/50 transition-all"
                        placeholder="Örn: 20-30 kg/da"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      {editingPlant && (
                        <>
                          {isDeleting ? (
                            <div className="flex-1 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setIsDeleting(false)}
                                className="flex-1 bg-stone-800 text-stone-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] active:scale-95 transition-all"
                              >
                                İPTAL
                              </button>
                              <button
                                type="button"
                                onClick={handleDelete}
                                className="flex-1 bg-rose-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[9px] active:scale-95 transition-all shadow-lg shadow-rose-900/40"
                              >
                                EMİNİM, SİL
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsDeleting(true)}
                              className="flex-1 bg-stone-800/50 text-rose-500/50 border border-white/5 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                              <Trash2 size={14} />
                              SİL
                            </button>
                          )}
                        </>
                      )}
                      {!isDeleting && (
                        <button
                          type="submit"
                          className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-emerald-900/40 border border-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Save size={14} />
                          {editingPlant ? 'Güncelle' : 'Bitkiyi Kaydet'}
                        </button>
                      )}
                    </div>
                 </form>
                 <div className="h-20" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
