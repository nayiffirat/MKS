import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { Farmer } from '../types';
import { Search, Phone, MessageCircle, MapPin, Wheat, FilePlus, ChevronRight } from 'lucide-react';

interface FarmersProps {
  onBack: () => void;
  onNavigateToPrescription: (farmerId: string) => void;
}

export const Farmers: React.FC<FarmersProps> = ({ onBack, onNavigateToPrescription }) => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);

  useEffect(() => {
    dbService.getFarmers().then(setFarmers);
  }, []);

  const filteredFarmers = farmers.filter(f => 
    f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.village.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedFarmer) {
     return (
        <div className="p-4 pb-24 max-w-3xl mx-auto animate-in slide-in-from-right duration-200">
            {/* Detail Header */}
            <button onClick={() => setSelectedFarmer(null)} className="mb-4 text-stone-500 font-medium flex items-center">
                ← Listeye Dön
            </button>
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 text-center mb-4">
                <div className="w-24 h-24 bg-agri-100 rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-agri-700 mb-4">
                    {selectedFarmer.fullName.charAt(0)}
                </div>
                <h2 className="text-2xl font-bold text-stone-800">{selectedFarmer.fullName}</h2>
                <p className="text-stone-500 flex items-center justify-center mt-1">
                    <MapPin size={16} className="mr-1"/> {selectedFarmer.village}
                </p>
                <div className="flex justify-center space-x-4 mt-6">
                    <a href={`tel:${selectedFarmer.phoneNumber}`} className="flex-1 bg-green-600 text-white py-2 rounded-xl flex items-center justify-center font-bold shadow-md hover:bg-green-700">
                        <Phone size={18} className="mr-2"/> Ara
                    </a>
                    <a href={`https://wa.me/${selectedFarmer.phoneNumber.replace(/\s/g,'')}`} className="flex-1 bg-green-500 text-white py-2 rounded-xl flex items-center justify-center font-bold shadow-md hover:bg-green-600">
                        <MessageCircle size={18} className="mr-2"/> WhatsApp
                    </a>
                </div>
            </div>

            {/* Farm Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-4">
                <h3 className="font-bold text-stone-800 mb-4 border-b pb-2">Tarla Bilgileri</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-stone-500">Alan (Dekar)</p>
                        <p className="text-lg font-bold">{selectedFarmer.fieldSize}</p>
                    </div>
                    <div>
                        <p className="text-sm text-stone-500">Ürünler</p>
                        <p className="text-lg font-bold flex items-center"><Wheat size={16} className="mr-1 text-orange-400"/> {selectedFarmer.crops || 'Belirtilmemiş'}</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <button 
                onClick={() => onNavigateToPrescription(selectedFarmer.id)}
                className="w-full bg-agri-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between font-bold hover:bg-agri-700 transition-colors"
            >
                <span className="flex items-center"><FilePlus className="mr-2"/> Yeni Reçete Yaz</span>
                <ChevronRight />
            </button>
        </div>
     );
  }

  return (
    <div className="p-4 pb-24 max-w-3xl mx-auto">
      <div className="sticky top-20 md:top-4 bg-earth-50 z-10 py-2">
        <h2 className="text-2xl font-bold text-stone-800 mb-4">Çiftçi Listesi</h2>
        <div className="relative">
            <Search className="absolute left-3 top-3.5 text-stone-400" size={20} />
            <input 
                type="text" 
                placeholder="İsim veya köye göre ara..." 
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-agri-500 outline-none shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="space-y-3 mt-4">
        {filteredFarmers.map(farmer => (
            <div 
                key={farmer.id} 
                onClick={() => setSelectedFarmer(farmer)}
                className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex items-center justify-between hover:border-agri-300 transition-all cursor-pointer"
            >
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-agri-50 text-agri-700 flex items-center justify-center font-bold text-lg">
                        {farmer.fullName.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-stone-800">{farmer.fullName}</h3>
                        <p className="text-sm text-stone-500 flex items-center"><MapPin size={12} className="mr-1"/> {farmer.village}</p>
                    </div>
                </div>
                <ChevronRight className="text-stone-300" />
            </div>
        ))}
        {filteredFarmers.length === 0 && (
            <div className="text-center py-10 text-stone-400">
                Kayıtlı çiftçi bulunamadı.
            </div>
        )}
      </div>
    </div>
  );
};