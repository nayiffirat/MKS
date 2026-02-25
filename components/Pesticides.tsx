import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { Pesticide, PesticideCategory } from '../types';
import { Search, FlaskConical, Droplet, Info, Plus, X, Loader2, Save } from 'lucide-react';

export const Pesticides: React.FC = () => {
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPesticide, setNewPesticide] = useState<Partial<Pesticide>>({
      name: '',
      activeIngredient: '',
      defaultDosage: '',
      category: PesticideCategory.INSECTICIDE,
      description: ''
  });

  const loadPesticides = async () => {
      const list = await dbService.getPesticides();
      setPesticides(list);
  };

  useEffect(() => {
    loadPesticides();
  }, []);

  const handleAddPesticide = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPesticide.name || !newPesticide.activeIngredient) return;

      setIsSaving(true);
      try {
          const pesticideToAdd: Pesticide = {
              id: crypto.randomUUID(),
              name: newPesticide.name,
              activeIngredient: newPesticide.activeIngredient,
              defaultDosage: newPesticide.defaultDosage || '-',
              category: newPesticide.category as PesticideCategory,
              description: newPesticide.description
          };

          await dbService.addGlobalPesticide(pesticideToAdd);
          
          setIsAddModalOpen(false);
          setNewPesticide({
            name: '',
            activeIngredient: '',
            defaultDosage: '',
            category: PesticideCategory.INSECTICIDE,
            description: ''
          });
          
          await loadPesticides(); // Refresh list
      } catch (error) {
          console.error("Failed to add pesticide", error);
          alert("İlaç eklenirken bir hata oluştu.");
      } finally {
          setIsSaving(false);
      }
  };

  const filteredPesticides = pesticides.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto relative min-h-[80vh]">
        <h2 className="text-2xl font-bold text-stone-100 mb-6">İlaç Kütüphanesi</h2>
        
        <div className="bg-stone-900 p-2 rounded-xl border border-white/5 shadow-sm mb-6 flex items-center">
            <Search className="text-stone-500 ml-2" />
            <input 
                className="w-full p-2 outline-none text-stone-200 bg-transparent placeholder-stone-600 ml-2"
                placeholder="İlaç adı veya etken madde ara..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPesticides.map(p => (
                <div key={p.id} className="bg-stone-900/60 backdrop-blur p-5 rounded-2xl border border-white/5 shadow-sm hover:shadow-md transition-shadow hover:bg-stone-800/60 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                             <div className="p-2 bg-blue-900/30 text-blue-400 rounded-lg">
                                <FlaskConical size={20} />
                             </div>
                             <span className="text-xs font-bold px-2 py-1 bg-stone-800 text-stone-400 rounded-md border border-white/5">
                                {p.category}
                             </span>
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-stone-100">{p.name}</h3>
                    <p className="text-sm text-stone-500 mb-2 font-mono">{p.activeIngredient}</p>
                    
                    {p.description && (
                        <p className="text-sm text-stone-400 mb-4 leading-relaxed flex-1">
                            {p.description}
                        </p>
                    )}
                    
                    <div className="bg-stone-950 p-3 rounded-lg flex items-center text-sm font-medium text-stone-300 border border-white/5 mt-auto">
                        <Droplet size={16} className="mr-2 text-blue-500"/>
                        <span className="text-stone-500 mr-1">Dozaj:</span> {p.defaultDosage}
                    </div>
                </div>
            ))}
        </div>

        {/* FAB - ADD PESTICIDE */}
        <button 
            onClick={() => setIsAddModalOpen(true)}
            className="fixed bottom-32 right-6 md:bottom-10 md:right-10 bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 z-50 flex items-center justify-center"
        >
            <Plus size={28} />
        </button>

        {/* ADD MODAL */}
        {isAddModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-stone-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative border border-white/10 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                    <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 p-2 bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors">
                        <X size={20} />
                    </button>
                    
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-900/30 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                            <FlaskConical size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-stone-100">İlaç Ekle</h2>
                        <p className="text-sm text-stone-500">Global kütüphaneye yeni ilaç ekleyin</p>
                    </div>

                    <form onSubmit={handleAddPesticide} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-stone-500 ml-1 uppercase">İlaç Ticari Adı</label>
                            <input 
                                required 
                                type="text" 
                                value={newPesticide.name} 
                                onChange={e => setNewPesticide({...newPesticide, name: e.target.value})} 
                                className="w-full p-3.5 bg-stone-950 border border-stone-800 focus:border-emerald-500/50 rounded-xl outline-none font-medium transition-all text-white placeholder-stone-600" 
                                placeholder="Örn: Acme 150 SC" 
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-stone-500 ml-1 uppercase">Etken Madde</label>
                            <input 
                                required 
                                type="text" 
                                value={newPesticide.activeIngredient} 
                                onChange={e => setNewPesticide({...newPesticide, activeIngredient: e.target.value})} 
                                className="w-full p-3.5 bg-stone-950 border border-stone-800 focus:border-emerald-500/50 rounded-xl outline-none font-medium transition-all text-white placeholder-stone-600" 
                                placeholder="Örn: Indoxacarb" 
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-stone-500 ml-1 uppercase">Kategori</label>
                                <select 
                                    value={newPesticide.category}
                                    onChange={e => setNewPesticide({...newPesticide, category: e.target.value as PesticideCategory})}
                                    className="w-full p-3.5 bg-stone-950 border border-stone-800 focus:border-emerald-500/50 rounded-xl outline-none font-medium transition-all text-white"
                                >
                                    {Object.values(PesticideCategory).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-stone-500 ml-1 uppercase">Dozaj</label>
                                <input 
                                    type="text" 
                                    value={newPesticide.defaultDosage} 
                                    onChange={e => setNewPesticide({...newPesticide, defaultDosage: e.target.value})} 
                                    className="w-full p-3.5 bg-stone-950 border border-stone-800 focus:border-emerald-500/50 rounded-xl outline-none font-medium transition-all text-white placeholder-stone-600" 
                                    placeholder="Örn: 30 ml/da" 
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-stone-500 ml-1 uppercase">Açıklama</label>
                            <textarea 
                                value={newPesticide.description} 
                                onChange={e => setNewPesticide({...newPesticide, description: e.target.value})} 
                                className="w-full p-3.5 bg-stone-950 border border-stone-800 focus:border-emerald-500/50 rounded-xl outline-none font-medium transition-all text-white placeholder-stone-600 h-24 resize-none" 
                                placeholder="Kullanım alanları, zararlılar..." 
                            />
                        </div>

                        <div className="bg-amber-900/20 p-3 rounded-lg border border-amber-900/30 flex items-start space-x-2">
                             <Info size={16} className="text-amber-500 mt-0.5 shrink-0" />
                             <p className="text-xs text-amber-400/80 leading-relaxed">
                                 Eklediğiniz ilaç, sistemdeki <strong>tüm kullanıcıların</strong> kütüphanesine eklenecektir. Lütfen bilgilerin doğruluğundan emin olun.
                             </p>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="w-full bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-600 hover:shadow-emerald-900/40 active:scale-95 transition-all mt-2 flex items-center justify-center"
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : <><Save className="mr-2" size={20}/> Kütüphaneye Ekle</>}
                        </button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};