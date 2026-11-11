import React from 'react';
import {
    Edit2,
    Plus,
    Trash2,
    X,
    Loader2,
    Save,
    Download,
    FileText,
    Contact,
    Check,
    RefreshCw,
    ClipboardCheck,
    AlertTriangle,
    Hammer,
} from 'lucide-react';
import { Farmer, ManualDebt } from '../../types';
import { getCurrencySymbol } from '../../utils/currency';

export interface TempContactItem {
    id: string;
    fullName: string;
    phoneNumber: string;
    isAlreadyRegistered?: boolean;
}

export interface RepairMismatchItem {
    farmerId: string;
    farmerName: string;
    currentBalance: number;
    calculatedBalance: number;
    brokenPrescriptions: { id: string; expected: number; actual: number }[];
    brokenPayments?: { id: string; expected: number; actual: number }[];
    brokenMyPayments?: { id: string; expected: number; actual: number }[];
    brokenManualDebts?: { id: string; expected: number; actual: number }[];
}

interface FarmerManualDebtModalProps {
    isOpen: boolean;
    editingManualDebt: ManualDebt | null;
    debtDate: string;
    setDebtDate: (val: string) => void;
    debtAmount: string;
    setDebtAmount: (val: string) => void;
    debtNote: string;
    setDebtNote: (val: string) => void;
    isSavingDebt: boolean;
    currency?: string;
    onClose: () => void;
    onSave: () => void;
    onDelete: (id: string) => void;
}

export const FarmerManualDebtModal: React.FC<FarmerManualDebtModalProps> = React.memo(({
    isOpen,
    editingManualDebt,
    debtDate,
    setDebtDate,
    debtAmount,
    setDebtAmount,
    debtNote,
    setDebtNote,
    isSavingDebt,
    currency,
    onClose,
    onSave,
    onDelete,
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-stone-100 flex items-center">
                        {editingManualDebt ? <Edit2 className="mr-2 text-emerald-500" size={16}/> : <Plus className="mr-2 text-rose-500" size={16}/>} 
                        {editingManualDebt ? 'Borç Düzenle' : 'Borç Ekle'}
                    </h2>
                    <div className="flex items-center gap-2">
                        {editingManualDebt && (
                            <button onClick={() => onDelete(editingManualDebt.id)} className="text-stone-500 hover:text-rose-500 transition-colors p-1" title="Sil">
                                <Trash2 size={16}/>
                            </button>
                        )}
                        <button onClick={onClose} className="text-stone-500 hover:text-stone-300 p-1"><X size={18}/></button>
                    </div>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Tarih</label>
                        <input type="date" value={debtDate} onChange={(e) => setDebtDate(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-stone-100 text-sm focus:border-rose-500 outline-none transition-all" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Tutar ({getCurrencySymbol((currency as any) || 'TRY')})</label>
                        <input type="number" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-stone-100 text-sm focus:border-rose-500 outline-none transition-all" placeholder="0.00" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Açıklama / Ürün</label>
                        <textarea value={debtNote} onChange={(e) => setDebtNote(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-stone-100 text-sm focus:border-rose-500 outline-none transition-all h-24 resize-none" placeholder="Örn: Geçmiş borç, Gübre borcu vb." />
                    </div>
                    <button disabled={isSavingDebt || !debtAmount} onClick={onSave} className="w-full bg-rose-700 text-white py-3.5 rounded-xl font-bold text-xs shadow-lg disabled:opacity-50 flex items-center justify-center">
                        {isSavingDebt ? <Loader2 className="animate-spin mr-2" size={16}/> : <Save className="mr-2" size={16}/>} Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
});
FarmerManualDebtModal.displayName = 'FarmerManualDebtModal';

interface FarmerReportFilterModalProps {
    isOpen: boolean;
    selectedFarmer: Farmer | null;
    availableYears: number[];
    availableCrops: string[];
    reportStartDate: string;
    setReportStartDate: (val: string) => void;
    reportEndDate: string;
    setReportEndDate: (val: string) => void;
    reportType: 'SUMMARY' | 'DETAILED';
    setReportType: (val: 'SUMMARY' | 'DETAILED') => void;
    reportCrop: string;
    setReportCrop: (val: string) => void;
    reportFieldId: string;
    setReportFieldId: (val: string) => void;
    onClose: () => void;
    onViewReport: () => void;
}

export const FarmerReportFilterModal: React.FC<FarmerReportFilterModalProps> = React.memo(({
    isOpen,
    selectedFarmer,
    availableYears,
    availableCrops,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    reportType,
    setReportType,
    reportCrop,
    setReportCrop,
    reportFieldId,
    setReportFieldId,
    onClose,
    onViewReport,
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-stone-100 flex items-center"><Download className="mr-2 text-blue-500" size={16}/> Cari Rapor Oluştur</h2>
                    <button onClick={onClose} className="text-stone-500 hover:text-stone-300"><X size={18}/></button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1">
                        <button 
                            onClick={() => {
                                setReportStartDate('');
                                setReportEndDate('');
                            }}
                            className="px-3 py-1.5 bg-stone-800 hover:bg-emerald-600 text-stone-300 hover:text-white rounded-xl text-[10px] font-bold border border-white/5 whitespace-nowrap active:scale-95 transition-all"
                        >
                            Tüm Zamanlar
                        </button>
                        {availableYears.map(year => (
                            <button 
                                key={year}
                                onClick={() => {
                                    setReportStartDate(`${year}-01-01`);
                                    setReportEndDate(`${year}-12-31`);
                                }}
                                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-[10px] font-bold border border-white/5 whitespace-nowrap active:scale-95 transition-all"
                            >
                                {year} Yılı
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Başlangıç</label>
                            <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Bitiş</label>
                            <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Rapor Türü</label>
                            <select 
                                value={reportType} 
                                onChange={(e) => setReportType(e.target.value as 'SUMMARY' | 'DETAILED')}
                                className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500"
                            >
                                <option value="SUMMARY">Özet (Sadece Fatura)</option>
                                <option value="DETAILED">Detaylı (Ürün İçerikli)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Ürün Filtresi</label>
                            <select 
                                value={reportCrop} 
                                onChange={(e) => {
                                    setReportCrop(e.target.value);
                                    if (e.target.value !== 'ALL') setReportFieldId('ALL');
                                }}
                                className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500"
                            >
                                <option value="ALL">Tüm Ürünler</option>
                                {availableCrops.map(crop => (
                                    <option key={crop} value={crop}>{crop}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Tarla Filtresi</label>
                            <select 
                                value={reportFieldId} 
                                onChange={(e) => {
                                    setReportFieldId(e.target.value);
                                    if (e.target.value !== 'ALL') setReportCrop('ALL');
                                }}
                                className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500"
                            >
                                <option value="ALL">Tüm Tarlalar</option>
                                {selectedFarmer?.fields.map(field => (
                                    <option key={field.id} value={field.id}>{field.name} ({field.crop})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p className="text-[9px] text-stone-500 italic">Tarih seçmezseniz tüm zamanların raporu oluşturulur.</p>
                    <button onClick={onViewReport} className="w-full bg-blue-700 text-white py-3.5 rounded-xl font-bold text-xs shadow-lg flex items-center justify-center">
                        <FileText className="mr-2" size={16}/> Raporu Görüntüle
                    </button>
                </div>
            </div>
        </div>
    );
});
FarmerReportFilterModal.displayName = 'FarmerReportFilterModal';

interface FarmerContactImportModalProps {
    isOpen: boolean;
    importPreviewList: TempContactItem[];
    selectedImportIds: Set<string>;
    isImporting: boolean;
    onClose: () => void;
    onToggleSelect: (contact: TempContactItem) => void;
    onConfirmImport: () => void;
}

export const FarmerContactImportModal: React.FC<FarmerContactImportModalProps> = React.memo(({
    isOpen,
    importPreviewList,
    selectedImportIds,
    isImporting,
    onClose,
    onToggleSelect,
    onConfirmImport,
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 rounded-3xl w-full max-w-md flex flex-col max-h-[85vh] shadow-2xl border border-white/10">
                <div className="p-4 border-b border-white/5 shrink-0 flex justify-between items-center">
                    <h2 className="text-base font-bold text-stone-100 flex items-center"><Contact className="mr-2 text-emerald-500" size={18}/> Rehber Aktarımı</h2>
                    <button onClick={onClose} className="text-stone-500 hover:text-stone-300"><X size={18}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {importPreviewList.map(contact => (
                        <div key={contact.id} onClick={() => onToggleSelect(contact)} className={`flex items-center p-2.5 rounded-xl transition-colors border ${contact.isAlreadyRegistered ? 'opacity-40 bg-stone-950 border-transparent' : selectedImportIds.has(contact.id) ? 'bg-emerald-900/10 border-emerald-500/20' : 'hover:bg-white/5 border-transparent'}`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center mr-3 ${selectedImportIds.has(contact.id) ? 'bg-emerald-600 text-white' : 'border-2 border-stone-700'}`}>
                                {selectedImportIds.has(contact.id) && <Check size={10}/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-stone-200 text-xs truncate">{contact.fullName}</p>
                                <p className="text-[10px] text-stone-500 font-mono">{contact.phoneNumber}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-white/5 bg-stone-900/80">
                    <button disabled={selectedImportIds.size === 0 || isImporting} onClick={onConfirmImport} className="w-full bg-emerald-700 text-white py-3 rounded-xl font-bold text-xs shadow-lg disabled:opacity-50 flex items-center justify-center">
                        {isImporting ? <Loader2 className="animate-spin mr-2"/> : <Plus className="mr-2"/>} {selectedImportIds.size} Kişiyi Ekle
                    </button>
                </div>
            </div>
        </div>
    );
});
FarmerContactImportModal.displayName = 'FarmerContactImportModal';

interface FarmerBalanceRepairModalProps {
    isOpen: boolean;
    repairState: 'IDLE' | 'ANALYZING' | 'RESULT' | 'REPAIRING';
    repairMismatches: RepairMismatchItem[];
    selectedRepairs: Set<string>;
    setSelectedRepairs: (val: Set<string>) => void;
    onClose: () => void;
    onRepair: () => void;
}

export const FarmerBalanceRepairModal: React.FC<FarmerBalanceRepairModalProps> = React.memo(({
    isOpen,
    repairState,
    repairMismatches,
    selectedRepairs,
    setSelectedRepairs,
    onClose,
    onRepair,
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-[#1c1c1c] border border-stone-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col font-sans">
                <div className="p-6 border-b border-stone-800/50 flex items-center justify-between bg-stone-900/50">
                    <div>
                        <h3 className="text-xl font-bold text-stone-100 mb-1 flex items-center gap-2">
                            <RefreshCw size={20} className="text-red-500" />
                            Cari Onarım Uzmanı
                        </h3>
                        <p className="text-xs text-stone-400 font-medium">Satış fişlerindeki toplam hesap uyuşmazlıkları tespit edilip düzeltilir.</p>
                    </div>
                    {repairState !== 'ANALYZING' && repairState !== 'REPAIRING' && (
                        <button
                            onClick={onClose}
                            className="p-2 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl transition-colors shrink-0"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {repairState === 'ANALYZING' && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <RefreshCw size={40} className="text-red-500 animate-spin" />
                            <div className="text-center">
                                <div className="font-bold text-stone-200">Reçeteler Analiz Ediliyor</div>
                                <div className="text-xs text-stone-500 mt-1">Geçmiş işlemler taranıyor...</div>
                            </div>
                        </div>
                    )}

                    {repairState === 'RESULT' && (
                        <div className="space-y-4">
                            {repairMismatches.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-emerald-950/50 border border-emerald-500/20 flex items-center justify-center">
                                        <ClipboardCheck size={32} className="text-emerald-500" />
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-emerald-400 text-lg">Mükemmel!</div>
                                        <div className="text-stone-400 text-sm mt-1 mb-2">Tüm çiftçi bakiyeleri kusursuz eşleşiyor.</div>
                                    </div>
                                    <button 
                                        onClick={onClose}
                                        className="px-6 py-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl font-bold transition-all text-sm"
                                    >
                                        Kapat
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4">
                                        <div className="text-red-400 font-bold mb-2 flex items-center gap-2">
                                            <AlertTriangle size={18} />
                                            {repairMismatches.length} Çiftçide Uyuşmazlık Bulundu
                                        </div>
                                        <p className="text-xs text-stone-300">
                                            Satışların içindeki ürün fiyatları toplamı ile reçete genel toplamı uyuşmuyor. Toplamları yeniden hesaplayacağız.
                                        </p>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        {repairMismatches.map((mismatch, index) => {
                                            const isSelected = selectedRepairs.has(mismatch.farmerId);
                                            return (
                                                <div 
                                                    key={mismatch.farmerId + index}
                                                    onClick={() => {
                                                        const newSet = new Set(selectedRepairs);
                                                        if (isSelected) newSet.delete(mismatch.farmerId);
                                                        else newSet.add(mismatch.farmerId);
                                                        setSelectedRepairs(newSet);
                                                    }}
                                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected ? 'bg-red-950/10 border-red-500/30' : 'bg-stone-900 border-stone-800 hover:border-stone-700'}`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-stone-200 text-sm truncate">{mismatch.farmerName}</div>
                                                        <div className="text-[10px] text-stone-500 mt-1 space-y-0.5">
                                                            <div className="flex items-center justify-between">
                                                                <span>Kayıtlı: <span className="font-mono text-red-400 bg-red-400/10 px-1 rounded">{mismatch.currentBalance.toLocaleString('tr-TR')} ₺</span></span>
                                                                <span>Olması Gereken: <span className="font-mono text-emerald-400 bg-emerald-400/10 px-1 rounded">{mismatch.calculatedBalance.toLocaleString('tr-TR')} ₺</span></span>
                                                            </div>
                                                            {((mismatch.brokenPrescriptions?.length || 0) + (mismatch.brokenPayments?.length || 0) + (mismatch.brokenMyPayments?.length || 0) + (mismatch.brokenManualDebts?.length || 0)) > 0 && (
                                                                <div className="text-[9px] text-stone-500 mt-1 italic flex flex-wrap gap-1">
                                                                    {(mismatch.brokenPrescriptions?.length || 0) > 0 && <span>({mismatch.brokenPrescriptions?.length} reçete)</span>}
                                                                    {(mismatch.brokenPayments?.length || 0) > 0 && <span>({mismatch.brokenPayments?.length} ödeme)</span>}
                                                                    {(mismatch.brokenMyPayments?.length || 0) > 0 && <span>({mismatch.brokenMyPayments?.length} tahsilat)</span>}
                                                                    {(mismatch.brokenManualDebts?.length || 0) > 0 && <span>({mismatch.brokenManualDebts?.length} manuel borç)</span>}
                                                                    onarılacak.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-red-500 border-red-500 text-white' : 'border-stone-600'}`}>
                                                        {isSelected && <Check size={14} strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <button 
                                        onClick={onRepair}
                                        disabled={selectedRepairs.size === 0}
                                        className="w-full mt-4 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-sm transition-all shadow-lg shadow-red-900/20 min-h-[48px] disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={18} />
                                        Seçilenleri Onar ({selectedRepairs.size})
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {repairState === 'REPAIRING' && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <Hammer size={40} className="text-red-500 animate-bounce" />
                            <div className="text-center">
                                <div className="font-bold text-stone-200 text-lg">Onarılıyor...</div>
                                <div className="text-sm text-stone-400 mt-1">Cariler kusursuz hale getiriliyor. Lütfen bekleyin.</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
FarmerBalanceRepairModal.displayName = 'FarmerBalanceRepairModal';
