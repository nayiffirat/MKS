
import React, { useState, useMemo } from 'react';
import { MapPin, Navigation, ArrowLeft, Search, Check, X, Map as MapIcon, Route, ExternalLink } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { Farmer } from '../types';

interface FarmerMapProps {
    onBack: () => void;
}

export const FarmerMap: React.FC<FarmerMapProps> = ({ onBack }) => {
    const { farmers } = useAppViewModel();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFarmerIds, setSelectedFarmerIds] = useState<Set<string>>(new Set());

    const filteredFarmers = useMemo(() => {
        return farmers.filter(f => 
            f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.village.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [farmers, searchTerm]);

    const toggleFarmer = (id: string) => {
        const newSet = new Set(selectedFarmerIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedFarmerIds(newSet);
    };

    const selectedFarmers = useMemo(() => {
        return farmers.filter(f => selectedFarmerIds.has(f.id));
    }, [farmers, selectedFarmerIds]);

    const generateRouteUrl = () => {
        if (selectedFarmers.length === 0) return '';
        
        // Google Maps Route URL format: https://www.google.com/maps/dir/Origin/Stop1/Stop2/...
        // If we don't have lat/lng, we use names and villages
        const stops = selectedFarmers.map(f => {
            if (f.latitude && f.longitude) {
                return `${f.latitude},${f.longitude}`;
            }
            return encodeURIComponent(`${f.fullName} ${f.village} Köyü`);
        });
        
        return `https://www.google.com/maps/dir/Current+Location/${stops.join('/')}`;
    };

    const handleOpenRoute = () => {
        const url = generateRouteUrl();
        if (url) {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="p-4 pb-32 max-w-2xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 bg-stone-900 border border-white/5 rounded-xl text-stone-400 hover:text-stone-200 transition-all active:scale-90">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black text-stone-100 tracking-tight flex items-center gap-2">
                        <Route className="text-blue-500" size={24} />
                        ROTA PLANLAYICI
                    </h1>
                    <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Akıllı Ziyaret Planlama</p>
                </div>
            </div>

            {/* Selection Area */}
            <div className="space-y-4">
                <div className="bg-stone-900 border border-white/5 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center bg-stone-950 rounded-xl border border-white/5 px-3 mb-4">
                        <Search size={16} className="text-stone-600" />
                        <input 
                            type="text" 
                            placeholder="Çiftçi veya köy ara..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent p-3 text-xs text-stone-200 outline-none placeholder-stone-700"
                        />
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                        {filteredFarmers.map(farmer => (
                            <div 
                                key={farmer.id} 
                                onClick={() => toggleFarmer(farmer.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                    selectedFarmerIds.has(farmer.id) 
                                    ? 'bg-blue-900/10 border-blue-500/30' 
                                    : 'bg-stone-950/50 border-white/5 hover:bg-stone-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                        selectedFarmerIds.has(farmer.id) ? 'bg-blue-600 text-white' : 'bg-stone-800 text-stone-500'
                                    }`}>
                                        {farmer.fullName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-stone-200">{farmer.fullName}</p>
                                        <p className="text-[9px] text-stone-500 flex items-center gap-1">
                                            <MapPin size={8} /> {farmer.village}
                                        </p>
                                    </div>
                                </div>
                                {selectedFarmerIds.has(farmer.id) && <Check size={14} className="text-blue-500" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selected List & Action */}
                {selectedFarmers.length > 0 && (
                    <div className="bg-stone-900 border border-blue-500/20 rounded-[2rem] p-6 shadow-xl animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-black text-stone-100 uppercase tracking-widest flex items-center gap-2">
                                <Navigation size={14} className="text-blue-500" />
                                Rota Özeti
                            </h3>
                            <button 
                                onClick={() => setSelectedFarmerIds(new Set())}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-400 transition-colors"
                            >
                                Temizle
                            </button>
                        </div>

                        <div className="space-y-3 mb-6">
                            {selectedFarmers.map((f, i) => (
                                <div key={f.id} className="flex items-center gap-3 relative">
                                    {i < selectedFarmers.length - 1 && (
                                        <div className="absolute left-2.5 top-5 bottom-0 w-0.5 bg-blue-500/20"></div>
                                    )}
                                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white z-10">
                                        {i + 1}
                                    </div>
                                    <span className="text-xs text-stone-300 font-medium">{f.fullName}</span>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={handleOpenRoute}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                        >
                            <ExternalLink size={18} />
                            Google Haritalar'da Aç
                        </button>
                        <p className="text-[9px] text-stone-500 text-center mt-3">
                            * Rota sıralaması seçim sırasına göredir.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
