import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, MapPin, Satellite } from 'lucide-react';
import { COMMON_CROPS } from '../../constants';
import { validateTcOrVkn } from '../../utils/tcNoValidator';
import { generateUUID } from '../../utils/uuid';
import { useBackHandler } from '../../utils/navigationManager';
import { ModalCloseButton } from '../ModalCloseButton';
import { FieldPolygonDrawerModal } from './FieldPolygonDrawerModal';

export interface FarmerModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'ADD' | 'EDIT';
    isSaving: boolean;
    data: {
        id: string;
        fullName: string;
        phoneNumber: string;
        village: string;
        tcNo?: string;
        creditLimit?: number | string;
        riskScoreOverride?: '' | 'A' | 'B' | 'C' | 'D';
        fields: {
            id: string;
            name: string;
            size: string;
            crop: string;
            plantingDate?: string;
            currentStage?: string;
            polygonGeoJson?: string;
            polygonBbox?: [number, number, number, number];
            centroidLat?: number;
            centroidLng?: number;
            tkgmIl?: string;
            tkgmIlce?: string;
            tkgmMahalle?: string;
            tkgmAda?: string;
            tkgmParsel?: string;
        }[];
    };
    setData: (data: any) => void;
    onSave: (e: React.FormEvent) => void;
    onDelete?: () => void;
    farmerLabel: string;
}

export const FarmerModal: React.FC<FarmerModalProps> = React.memo(({
    isOpen,
    onClose,
    mode,
    isSaving,
    data,
    setData,
    onSave,
    onDelete,
    farmerLabel
}) => {
    const [drawingFieldId, setDrawingFieldId] = useState<string | null>(null);

    if (!isOpen) return null;

    const tcNoVal = (data.tcNo || '').trim();
    const tcValidation = validateTcOrVkn(data.tcNo);
    const hasTcInput = tcNoVal.length > 0;
    const isTcValid = tcValidation.isValid;

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val.length < 4) setData({ ...data, phoneNumber: '+90 ' });
        else if (!val.startsWith('+90')) setData({ ...data, phoneNumber: '+90 ' + val.replace(/^\+90\s*/, '') });
        else setData({ ...data, phoneNumber: val });
    };

    const addField = () => {
        setData({
            ...data,
            fields: [...(data.fields || []), { id: crypto.randomUUID() as string, name: '', size: '', crop: '' }]
        });
    };

    const removeField = (id: string) => {
        if (!data.fields || data.fields.length <= 1) return;
        setData({
            ...data,
            fields: data.fields.filter(f => f.id !== id)
        });
    };

    const updateField = (id: string, field: string, value: string) => {
        setData({
            ...data,
            fields: (data.fields || []).map(f => f.id === id ? { ...f, [field]: value } : f)
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-stone-900 rounded-3xl w-full max-w-md p-5 shadow-2xl relative border border-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 z-10"><X size={16} /></button>
            <div className="text-center mb-4 shrink-0"><h2 className="text-base font-bold text-stone-100">{mode === 'ADD' ? `Yeni ${farmerLabel} Ekle` : `${farmerLabel}yi Düzenle`}</h2></div>
            
            <form onSubmit={onSave} className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
              <div className="space-y-2.5">
                <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Ad Soyad</label><input required type="text" value={data.fullName} onChange={e => setData({...data, fullName: e.target.value})} className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" placeholder="İsim" /></div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">T.C. Kimlik Numarası</label>
                    {hasTcInput && (
                      <span className={`text-[9px] font-bold font-mono ${isTcValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tcNoVal.length}/11 Hane
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={11}
                    value={data.tcNo || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setData({ ...data, tcNo: val });
                    }}
                    className={`w-full p-2 bg-stone-950 border ${hasTcInput ? (isTcValid ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20 focus:border-emerald-500 ring-2 ring-emerald-500/20' : 'border-rose-500 text-rose-300 bg-rose-950/40 focus:border-rose-500 ring-2 ring-rose-500/20') : 'border-stone-800 text-white focus:border-emerald-500/50'} rounded-xl outline-none font-medium text-xs transition-all font-mono`}
                    placeholder="11 haneli T.C. Kimlik No"
                  />
                  {hasTcInput && (
                    <p className={`text-[10px] font-bold ${isTcValid ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30' : 'text-rose-400 bg-rose-950/50 border-rose-500/30'} mt-1.5 flex items-center gap-1.5 border p-2 rounded-lg`}>
                      {isTcValid ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <AlertTriangle size={12} className="shrink-0 text-rose-400" />}
                      <span>{tcValidation.message}</span>
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                    <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Telefon</label><input required type="tel" value={data.phoneNumber} onChange={handlePhoneChange} className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" /></div>
                    <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Köy</label><input required type="text" value={data.village} onChange={e => setData({...data, village: e.target.value})} className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" /></div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Tarlalar / Araziler</label>
                    <button type="button" onClick={addField} className="flex items-center gap-1 text-[9px] font-bold bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-900/50 transition-all">
                        <Plus size={12} /> Tarla Ekle
                    </button>
                </div>

                <div className="space-y-3">
                    {(data.fields || []).map((field) => (
                        <div key={field.id} className="p-3 bg-stone-950/50 border border-stone-800 rounded-2xl relative animate-in slide-in-from-top-2 duration-200">
                            {data.fields && data.fields.length > 1 && (
                                <button type="button" onClick={() => removeField(field.id)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-900/80 text-white rounded-full flex items-center justify-center border border-red-500/30 shadow-lg active:scale-90 transition-all">
                                    <X size={10} />
                                </button>
                            )}
                            <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-12">
                                    <input 
                                        type="text" 
                                        placeholder="Tarla Adı (Örn: Ev Arkası)" 
                                        value={field.name} 
                                        onChange={e => updateField(field.id, 'name', e.target.value)}
                                        className="w-full bg-transparent border-b border-stone-800 py-1 text-[11px] text-stone-200 outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                                <div className="col-span-5">
                                    <label className="text-[8px] font-bold text-stone-600 uppercase ml-1">Alan (da)</label>
                                    <input 
                                        required
                                        type="number" 
                                        value={field.size} 
                                        onChange={e => updateField(field.id, 'size', e.target.value)}
                                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg outline-none font-medium text-white text-[11px]" 
                                    />
                                </div>
                                <div className="col-span-7">
                                    <label className="text-[8px] font-bold text-stone-600 uppercase ml-1">Ürün</label>
                                    <input 
                                        required
                                        type="text" 
                                        list="crop-options"
                                        value={field.crop} 
                                        onChange={e => updateField(field.id, 'crop', e.target.value)}
                                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg outline-none font-medium text-white text-[11px]" 
                                        placeholder="Ürün Seçin veya Yazın"
                                    />
                                    <datalist id="crop-options">
                                        {COMMON_CROPS.map(crop => (
                                            <option key={crop} value={crop} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="col-span-6">
                                    <label className="text-[8px] font-bold text-stone-600 uppercase ml-1">Ekim Tarihi</label>
                                    <input 
                                        type="date" 
                                        value={field.plantingDate || ''} 
                                        onChange={e => updateField(field.id, 'plantingDate', e.target.value)}
                                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg outline-none font-medium text-white text-[11px]" 
                                    />
                                </div>
                                <div className="col-span-6">
                                    <label className="text-[8px] font-bold text-stone-600 uppercase ml-1">Mevcut Evre</label>
                                    <input 
                                        type="text" 
                                        value={field.currentStage || ''} 
                                        onChange={e => updateField(field.id, 'currentStage', e.target.value)}
                                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg outline-none font-medium text-white text-[11px]" 
                                        placeholder="Örn: Çimlenme"
                                    />
                                </div>
                                <div className="col-span-12 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setDrawingFieldId(field.id)}
                                        className={`w-full py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-all ${
                                            field.polygonGeoJson
                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
                                                : 'bg-stone-900 text-sky-300 border-sky-500/25 hover:bg-stone-800'
                                        }`}
                                    >
                                        {field.polygonGeoJson ? <Satellite size={13} /> : <MapPin size={13} />}
                                        <span>
                                            {field.polygonGeoJson
                                                ? `Parsel Sınırı Çizili (${field.size} daa) — Haritada Düzenle`
                                                : 'Haritada Parsel Sınırı Çiz (Otomatik Dekar & Uydu)'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                    <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider block mb-1">
                        Kredi / Açık Hesap Risk Limiti (TL)
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={data.creditLimit ?? ''}
                        onChange={e => setData({ ...data, creditLimit: e.target.value })}
                        placeholder="Örn: 250000 (Boş = Limitsiz)"
                        className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl outline-none font-mono text-white text-xs focus:border-emerald-500/50 transition-all"
                    />
                </div>
                <div>
                    <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider block mb-1">
                        Risk Notu (Otomatik / Manuel)
                    </label>
                    <select
                        value={data.riskScoreOverride || ''}
                        onChange={e => setData({ ...data, riskScoreOverride: (e.target.value || '') as any })}
                        className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl outline-none font-bold text-white text-xs focus:border-emerald-500/50 transition-all"
                    >
                        <option value="">Otomatik Hesapla (A-D)</option>
                        <option value="A">A — Çok Güvenilir (VIP)</option>
                        <option value="B">B — Düzenli Ödeyen</option>
                        <option value="C">C — Gecikmeli / İzlemede</option>
                        <option value="D">D — Yüksek Riskli / Kısıtlı</option>
                    </select>
                </div>
              </div>

              <div className="pt-2 shrink-0 flex gap-2">
                {mode === 'EDIT' && onDelete && (
                    <button 
                        type="button" 
                        onClick={() => {
                            onClose();
                            onDelete();
                        }}
                        className="px-4 bg-rose-900/20 text-rose-500 rounded-2xl font-bold text-xs border border-rose-500/20 hover:bg-rose-900/30 transition-all active:scale-95"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
                <button disabled={isSaving || (hasTcInput && !isTcValid)} type="submit" className={`flex-1 ${(hasTcInput && !isTcValid) ? 'bg-stone-800 text-stone-500 border-stone-700 cursor-not-allowed opacity-60' : 'bg-emerald-700 text-white border-emerald-500/20 shadow-xl shadow-emerald-900/20 active:scale-95'} py-3.5 rounded-2xl font-bold text-xs flex justify-center items-center transition-all border`}>
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : `${farmerLabel}yi Kaydet`}
                </button>
              </div>
            </form>
          </div>

          {drawingFieldId && (() => {
              const targetField = (data.fields || []).find(f => f.id === drawingFieldId);
              if (!targetField) return null;
              return (
                  <FieldPolygonDrawerModal
                      isOpen={true}
                      fieldName={targetField.name || 'Tarla'}
                      initialGeoJson={targetField.polygonGeoJson}
                      initialCenter={
                          targetField.centroidLat && targetField.centroidLng
                              ? { lat: targetField.centroidLat, lng: targetField.centroidLng }
                              : undefined
                      }
                      onClose={() => setDrawingFieldId(null)}
                      onSave={(payload) => {
                          setData({
                              ...data,
                              fields: (data.fields || []).map(f =>
                                  f.id === drawingFieldId
                                      ? {
                                            ...f,
                                            size: String(payload.dekar),
                                            name:
                                                f.name ||
                                                [payload.tkgmMahalle, payload.tkgmAda ? `Ada ${payload.tkgmAda}` : '', payload.tkgmParsel ? `Parsel ${payload.tkgmParsel}` : '']
                                                    .filter(Boolean)
                                                    .join(' ') ||
                                                f.name,
                                            polygonGeoJson: payload.polygonGeoJson,
                                            polygonBbox: payload.polygonBbox,
                                            centroidLat: payload.centroidLat,
                                            centroidLng: payload.centroidLng,
                                            tkgmIl: payload.tkgmIl || f.tkgmIl,
                                            tkgmIlce: payload.tkgmIlce || f.tkgmIlce,
                                            tkgmMahalle: payload.tkgmMahalle || f.tkgmMahalle,
                                            tkgmAda: payload.tkgmAda || f.tkgmAda,
                                            tkgmParsel: payload.tkgmParsel || f.tkgmParsel,
                                        }
                                      : f
                              ),
                          });
                          setDrawingFieldId(null);
                      }}
                  />
              );
          })()}
        </div>
    );
});

FarmerModal.displayName = 'FarmerModal';
