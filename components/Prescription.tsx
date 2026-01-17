import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { Farmer, Pesticide, Prescription } from '../types';
import { ENGINEER_NAME_DEFAULT } from '../constants';
import { Check, Plus, Trash2, FileOutput, Share2 } from 'lucide-react';

interface PrescriptionFormProps {
    onBack: () => void;
    initialFarmerId?: string;
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ onBack, initialFarmerId }) => {
    const [step, setStep] = useState(1);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [pesticides, setPesticides] = useState<Pesticide[]>([]);
    
    // Form State
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedItems, setSelectedItems] = useState<{pesticide: Pesticide, dosage: string}[]>([]);
    const [isSaved, setIsSaved] = useState(false);
    const [savedPrescription, setSavedPrescription] = useState<Prescription | null>(null);

    useEffect(() => {
        const loadData = async () => {
            const f = await dbService.getFarmers();
            const p = await dbService.getPesticides();
            setFarmers(f);
            setPesticides(p);

            if (initialFarmerId) {
                const preSelected = f.find(farm => farm.id === initialFarmerId);
                if (preSelected) {
                    setSelectedFarmer(preSelected);
                    setStep(2);
                }
            }
        };
        loadData();
    }, [initialFarmerId]);

    const addItem = (pesticide: Pesticide) => {
        if (!selectedItems.find(i => i.pesticide.id === pesticide.id)) {
            setSelectedItems([...selectedItems, { pesticide, dosage: pesticide.defaultDosage }]);
        }
    };

    const removeItem = (id: string) => {
        setSelectedItems(selectedItems.filter(i => i.pesticide.id !== id));
    };

    const updateDosage = (id: string, newDosage: string) => {
        setSelectedItems(selectedItems.map(i => i.pesticide.id === id ? { ...i, dosage: newDosage } : i));
    };

    const handleSave = async () => {
        if (!selectedFarmer) return;
        
        const newPrescription: Prescription = {
            id: crypto.randomUUID(),
            farmerId: selectedFarmer.id,
            date: new Date().toISOString(),
            prescriptionNo: `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
            engineerName: ENGINEER_NAME_DEFAULT,
            items: selectedItems.map(i => ({
                pesticideId: i.pesticide.id,
                pesticideName: i.pesticide.name,
                dosage: i.dosage
            })),
            isOfficial: true
        };

        await dbService.addPrescription(newPrescription);
        setSavedPrescription(newPrescription);
        setIsSaved(true);
    };

    if (isSaved && savedPrescription) {
        return (
            <div className="p-6 max-w-2xl mx-auto text-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check size={40} />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 mb-2">Reçete Kaydedildi!</h2>
                <p className="text-stone-500 mb-8">Reçete No: {savedPrescription.prescriptionNo}</p>
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-stone-200 text-left mb-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-agri-600"></div>
                    <div className="flex justify-between mb-6">
                         <div>
                            <h3 className="font-bold text-lg">Ziraat Müh. Reçetesi</h3>
                            <p className="text-xs text-stone-400">{new Date(savedPrescription.date).toLocaleDateString()}</p>
                         </div>
                         <div className="text-right">
                             <p className="font-bold text-agri-700">{selectedFarmer?.fullName}</p>
                             <p className="text-xs text-stone-500">{selectedFarmer?.village}</p>
                         </div>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-stone-50 text-stone-600">
                            <tr>
                                <th className="p-2 text-left">İlaç Adı</th>
                                <th className="p-2 text-right">Dozaj</th>
                            </tr>
                        </thead>
                        <tbody>
                            {savedPrescription.items.map((item, idx) => (
                                <tr key={idx} className="border-b border-stone-100">
                                    <td className="p-2 font-medium">{item.pesticideName}</td>
                                    <td className="p-2 text-right">{item.dosage}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-8 pt-4 border-t border-dashed border-stone-300 flex justify-between items-end">
                        <div className="text-xs text-stone-400">
                            Bu belge dijital olarak oluşturulmuştur.<br/>Mühendis Kayıt Sistemi
                        </div>
                        <div className="text-center">
                            <div className="font-script text-xl text-blue-900">{savedPrescription.engineerName}</div>
                            <div className="text-[10px] text-stone-400 uppercase tracking-widest">İmza</div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-stone-300 font-bold text-stone-600 hover:bg-stone-50">Ana Menü</button>
                    <button onClick={() => window.open(`https://wa.me/${selectedFarmer?.phoneNumber}?text=Sayın üreticimiz, reçeteniz ektedir.`, '_blank')} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold shadow-md hover:bg-green-700 flex items-center justify-center">
                        <Share2 size={20} className="mr-2"/> WhatsApp ile Paylaş
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-3xl mx-auto pb-24">
            <div className="flex items-center mb-6">
                 <button onClick={onBack} className="mr-4 text-stone-400">İptal</button>
                 <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                     <div className={`h-full bg-agri-500 transition-all duration-300 ${step === 1 ? 'w-1/3' : (step === 2 ? 'w-2/3' : 'w-full')}`}></div>
                 </div>
                 <span className="ml-4 font-bold text-agri-700">Adım {step}/3</span>
            </div>

            {step === 1 && (
                <div className="animate-in slide-in-from-right">
                    <h2 className="text-2xl font-bold mb-4">Çiftçi Seçimi</h2>
                    <div className="space-y-2">
                        {farmers.map(f => (
                            <button 
                                key={f.id} 
                                onClick={() => { setSelectedFarmer(f); setStep(2); }}
                                className="w-full text-left p-4 rounded-xl bg-white border border-stone-200 shadow-sm hover:border-agri-400 flex justify-between items-center"
                            >
                                <span className="font-bold text-stone-800">{f.fullName}</span>
                                <span className="text-sm text-stone-500">{f.village}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="animate-in slide-in-from-right">
                    <h2 className="text-2xl font-bold mb-4">İlaç Ekle</h2>
                    
                    {/* Pesticide Selector */}
                    <div className="mb-6">
                        <label className="text-sm font-medium text-stone-500 mb-2 block">Kütüphaneden Seç</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {pesticides.map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => addItem(p)}
                                    className="flex-shrink-0 bg-white border border-stone-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-agri-50 hover:border-agri-300 transition-colors whitespace-nowrap"
                                >
                                    + {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Selected List */}
                    <div className="space-y-4">
                        {selectedItems.map((item, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-stone-200">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg">{item.pesticide.name}</h4>
                                    <button onClick={() => removeItem(item.pesticide.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                                </div>
                                <div>
                                    <label className="text-xs text-stone-400 uppercase font-bold">Dozaj</label>
                                    <input 
                                        type="text" 
                                        value={item.dosage}
                                        onChange={(e) => updateDosage(item.pesticide.id, e.target.value)}
                                        className="w-full mt-1 p-2 bg-stone-50 border border-stone-200 rounded-lg font-medium"
                                    />
                                </div>
                            </div>
                        ))}
                        {selectedItems.length === 0 && (
                            <div className="text-center py-10 border-2 border-dashed border-stone-200 rounded-xl text-stone-400">
                                Henüz ilaç eklenmedi.
                            </div>
                        )}
                    </div>

                    <div className="fixed bottom-0 left-0 w-full p-4 bg-white border-t border-stone-200 md:static md:bg-transparent md:border-0 md:p-0 md:mt-6">
                         <button 
                            disabled={selectedItems.length === 0}
                            onClick={() => setStep(3)}
                            className="w-full bg-agri-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 hover:bg-agri-700"
                         >
                            Devam Et
                         </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="animate-in slide-in-from-right">
                    <h2 className="text-2xl font-bold mb-6">Önizleme ve Onay</h2>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 mb-6">
                         <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
                             <div>
                                 <p className="text-sm text-stone-500">Çiftçi</p>
                                 <p className="font-bold text-lg">{selectedFarmer?.fullName}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-sm text-stone-500">Tarih</p>
                                 <p className="font-medium">{new Date().toLocaleDateString()}</p>
                             </div>
                         </div>
                         <div className="space-y-2">
                             {selectedItems.map((item, idx) => (
                                 <div key={idx} className="flex justify-between py-2">
                                     <span>{item.pesticide.name}</span>
                                     <span className="font-bold text-stone-700">{item.dosage}</span>
                                 </div>
                             ))}
                         </div>
                    </div>
                    <button 
                        onClick={handleSave}
                        className="w-full bg-agri-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-agri-700 flex items-center justify-center"
                    >
                        <FileOutput className="mr-2" /> Reçeteyi Oluştur
                    </button>
                </div>
            )}
        </div>
    );
};