import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { Pesticide, PesticideCategory } from '../types';
import { Search, FlaskConical, Droplet } from 'lucide-react';

export const Pesticides: React.FC = () => {
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    dbService.getPesticides().then(setPesticides);
  }, []);

  const filteredPesticides = pesticides.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-stone-800 mb-6">İlaç Kütüphanesi</h2>
        
        <div className="bg-white p-2 rounded-xl border border-stone-200 shadow-sm mb-6 flex items-center">
            <Search className="text-stone-400 ml-2" />
            <input 
                className="w-full p-2 outline-none text-stone-700 ml-2"
                placeholder="İlaç adı veya etken madde ara..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPesticides.map(p => (
                <div key={p.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                             <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <FlaskConical size={20} />
                             </div>
                             <span className="text-xs font-bold px-2 py-1 bg-stone-100 text-stone-600 rounded-md">
                                {p.category}
                             </span>
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-stone-800">{p.name}</h3>
                    <p className="text-sm text-stone-500 mb-3">{p.activeIngredient}</p>
                    
                    <div className="bg-stone-50 p-3 rounded-lg flex items-center text-sm font-medium text-stone-700">
                        <Droplet size={16} className="mr-2 text-blue-400"/>
                        Dozaj: {p.defaultDosage}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};