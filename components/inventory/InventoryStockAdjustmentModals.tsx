import React from 'react';
import { X, Save, Trash2, Sparkles, Loader2, Upload, Plus, Boxes, Truck } from 'lucide-react';
import { InventoryItem, Supplier } from '../../types';

interface InventoryQuickStockModalProps {
    isOpen: boolean;
    selectedDetailItem: InventoryItem | null;
    quickStockQuantity: string;
    setQuickStockQuantity: (val: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}

export const InventoryQuickStockModal: React.FC<InventoryQuickStockModalProps> = React.memo(({
    isOpen,
    selectedDetailItem,
    quickStockQuantity,
    setQuickStockQuantity,
    onClose,
    onConfirm,
}) => {
    if (!isOpen || !selectedDetailItem) return null;

    const packSize = Number(selectedDetailItem.packSize) || 0;
    const packLabel = selectedDetailItem.packUnitName || 'Koli';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-stone-900 w-full max-w-[310px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-950/50">
                    <h3 className="text-xs font-black text-stone-100 uppercase tracking-widest">Hızlı Stok Ekle</h3>
                    <button type="button" onClick={onClose} aria-label="Kapat" data-mks-modal-close="true" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-300 hover:bg-white/5">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">Ürün</p>
                        <p className="text-sm font-black text-emerald-400">{selectedDetailItem.pesticideName}</p>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block text-center">Eklenecek Miktar ({selectedDetailItem.unit})</label>
                        <input 
                            autoFocus
                            type="number" 
                            placeholder="0"
                            className="w-full bg-stone-950 border border-emerald-500/30 rounded-2xl p-4 text-center text-2xl font-black text-emerald-400 outline-none focus:border-emerald-500 shadow-inner"
                            value={quickStockQuantity}
                            onChange={(e) => setQuickStockQuantity(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
                        />
                        {packSize > 1 && (
                            <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                                {[1, 2, 5].map(mult => (
                                    <button
                                        key={mult}
                                        type="button"
                                        onClick={() => {
                                            const current = parseFloat(quickStockQuantity.replace(',', '.')) || 0;
                                            setQuickStockQuantity(String(current + mult * packSize));
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[10px] font-black flex items-center gap-1 transition-colors"
                                    >
                                        <Boxes size={11} /> +{mult} {packLabel} ({mult * packSize} {selectedDetailItem.unit})
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={onConfirm}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-stone-950 rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        DEPOYA EKLE
                    </button>
                </div>
            </div>
        </div>
    );
});
InventoryQuickStockModal.displayName = 'InventoryQuickStockModal';

interface InventoryEditAdjustmentModalProps {
    isOpen: boolean;
    selectedDetailItem: InventoryItem | null;
    editingAdjustmentIdx: number | null;
    editingAdjustmentAmount: string;
    setEditingAdjustmentAmount: (val: string) => void;
    onClose: () => void;
    onDelete: () => void;
    onUpdate: () => void;
}

export const InventoryEditAdjustmentModal: React.FC<InventoryEditAdjustmentModalProps> = React.memo(({
    isOpen,
    selectedDetailItem,
    editingAdjustmentIdx,
    editingAdjustmentAmount,
    setEditingAdjustmentAmount,
    onClose,
    onDelete,
    onUpdate,
}) => {
    if (!isOpen || !selectedDetailItem || editingAdjustmentIdx === null) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-stone-900 w-full max-w-[280px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-950/50">
                    <h3 className="text-xs font-black text-stone-100 uppercase tracking-widest">Hareketi Düzenle</h3>
                    <button type="button" onClick={onClose} aria-label="Kapat" data-mks-modal-close="true" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-300 hover:bg-white/5">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">Ürün / Hareket</p>
                        <p className="text-sm font-black text-amber-400">{selectedDetailItem.pesticideName}</p>
                        <p className="text-[10px] text-stone-500 mt-1 uppercase">{selectedDetailItem.adjustments?.[editingAdjustmentIdx]?.note || 'Manuel Stok Düzeltme'}</p>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block text-center">Miktar ({selectedDetailItem.unit})</label>
                        <input 
                            autoFocus
                            type="number" 
                            placeholder="0"
                            className="w-full bg-stone-950 border border-amber-500/30 rounded-2xl p-4 text-center text-2xl font-black text-amber-400 outline-none focus:border-amber-500 shadow-inner"
                            value={editingAdjustmentAmount}
                            onChange={(e) => setEditingAdjustmentAmount(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onUpdate()}
                        />
                        <p className="text-[9px] text-stone-600 text-center italic">Eksi (-) değerler stoktan düşer.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={onDelete}
                            className="py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} />
                            SİL
                        </button>
                        <button 
                            onClick={onUpdate}
                            className="py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-2xl font-bold text-xs shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={14} />
                            GÜNCELLE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
InventoryEditAdjustmentModal.displayName = 'InventoryEditAdjustmentModal';

export interface OcrInvoiceRow {
    name: string;
    quantity: string;
    unit: string;
    buyingPrice: string;
    discountPct?: string;
    vatPct?: string;
    lotNumber?: string;
    expiryDate?: string;
}

interface InventoryOcrInvoiceModalProps {
    isOpen: boolean;
    isOcrBusy: boolean;
    ocrRows: OcrInvoiceRow[];
    setOcrRows: React.Dispatch<React.SetStateAction<OcrInvoiceRow[]>>;
    suppliers?: Supplier[];
    ocrSupplierId?: string;
    setOcrSupplierId?: (val: string) => void;
    ocrInvoiceNo?: string;
    setOcrInvoiceNo?: (val: string) => void;
    isSaving: boolean;
    onClose: () => void;
    onPhotoSelect: (file?: File) => void;
    onAddRows: () => void;
}

export const InventoryOcrInvoiceModal: React.FC<InventoryOcrInvoiceModalProps> = React.memo(({
    isOpen,
    isOcrBusy,
    ocrRows,
    setOcrRows,
    suppliers = [],
    ocrSupplierId = '',
    setOcrSupplierId,
    ocrInvoiceNo = '',
    setOcrInvoiceNo,
    isSaving,
    onClose,
    onPhotoSelect,
    onAddRows,
}) => {
    if (!isOpen) return null;

    const parseNum = (v?: string) => {
        const n = parseFloat(String(v || '0').replace(',', '.'));
        return isNaN(n) ? 0 : n;
    };

    const getNetUnitCost = (r: OcrInvoiceRow) => {
        const gross = parseNum(r.buyingPrice);
        const disc = Math.min(100, Math.max(0, parseNum(r.discountPct)));
        const vat = Math.max(0, parseNum(r.vatPct));
        const afterDisc = gross * (1 - disc / 100);
        return Math.round((afterDisc * (1 + vat / 100) + Number.EPSILON) * 100) / 100;
    };

    const grandTotal = Math.round((ocrRows.reduce((acc, r) => acc + parseNum(r.quantity) * getNetUnitCost(r), 0) + Number.EPSILON) * 100) / 100;
    const invalidRowCount = ocrRows.filter(r => !String(r.name || '').trim() || !(parseNum(r.quantity) > 0)).length;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[88dvh] flex flex-col shadow-2xl">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black text-stone-100 flex items-center gap-2"><Sparkles size={18} className="text-amber-400" /> AI Tedarikçi Alış Faturası Tara</h3>
                        <p className="text-[11px] text-stone-400 mt-0.5">Ürün kalemleri, iskonto %, KDV %, Lot ve SKT otomatik okunur; dilerseniz tedarikçi carisine de işlenir.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Kapat" data-mks-modal-close="true" className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-100 hover:bg-white/5"><X size={18} /></button>
                </div>
                <div className="p-4 overflow-y-auto space-y-3">
                    <label className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-white/10 text-stone-400 text-xs font-bold cursor-pointer hover:border-amber-500/40 hover:text-amber-300 transition-colors ${isOcrBusy ? 'pointer-events-none opacity-60' : ''}`}>
                        {isOcrBusy ? <Loader2 size={22} className="animate-spin text-amber-400" /> : <Upload size={22} />}
                        {isOcrBusy ? 'Fatura kalemleri, iskonto, KDV ve SKT okunuyor...' : 'Fatura fotoğrafı yükle / kamerayla çek'}
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={e => { onPhotoSelect(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>

                    {ocrRows.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-950/70 p-3 rounded-2xl border border-white/5">
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase flex items-center gap-1 mb-1">
                                    <Truck size={11} className="text-emerald-400" /> Tedarikçi Cari (Opsiyonel)
                                </label>
                                <select
                                    value={ocrSupplierId}
                                    onChange={e => setOcrSupplierId?.(e.target.value)}
                                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-2 text-xs font-bold text-stone-200 outline-none focus:border-emerald-500/50"
                                >
                                    <option value="">-- Sadece Depoya Ekle (Cariye İşleme) --</option>
                                    {suppliers.filter(s => !s.deletedAt).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase block mb-1">Fatura / İrsaliye No</label>
                                <input
                                    value={ocrInvoiceNo}
                                    onChange={e => setOcrInvoiceNo?.(e.target.value)}
                                    placeholder="Örn: GIB202600001234"
                                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-2 text-xs font-mono text-stone-200 outline-none focus:border-emerald-500/50"
                                />
                            </div>
                        </div>
                    )}

                    {ocrRows.map((row, idx) => {
                        const netCost = getNetUnitCost(row);
                        return (
                            <div key={idx} className="bg-stone-950/60 border border-white/5 rounded-2xl p-2.5 space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <input value={row.name} onChange={e => setOcrRows(rs => rs.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                                        placeholder="Ürün adı"
                                        className="flex-1 min-w-0 bg-stone-900/70 border border-white/5 rounded-lg px-2 py-1.5 text-stone-100 text-xs font-bold outline-none" aria-label="Ürün adı" />
                                    <input value={row.quantity} inputMode="decimal" onChange={e => setOcrRows(rs => rs.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))}
                                        placeholder="Adet"
                                        className={`w-16 min-h-[36px] bg-stone-800 rounded-lg px-2 py-1.5 text-stone-100 text-xs font-mono text-right outline-none ${parseNum(row.quantity) > 0 ? '' : 'ring-1 ring-red-500/70'}`} aria-label="Miktar" aria-invalid={!(parseNum(row.quantity) > 0)} />
                                    <select value={row.unit} onChange={e => setOcrRows(rs => rs.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r))}
                                        className="bg-stone-800 rounded-lg px-1.5 py-1.5 text-[11px] text-stone-200 outline-none">
                                        <option value="Adet">Adet</option>
                                        <option value="Litre">Litre</option>
                                        <option value="Kg">Kg</option>
                                        <option value="Kutu">Kutu</option>
                                        <option value="Çuval">Çuval</option>
                                    </select>
                                    <button type="button" onClick={() => setOcrRows(rs => rs.filter((_, i) => i !== idx))} aria-label="Satırı sil" className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /></button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 items-center text-[10px]">
                                    <div>
                                        <span className="text-stone-500 block mb-0.5">Liste Fiyatı</span>
                                        <input value={row.buyingPrice} inputMode="decimal" onChange={e => setOcrRows(rs => rs.map((r, i) => i === idx ? { ...r, buyingPrice: e.target.value } : r))}
                                            className="w-full bg-stone-900 border border-white/5 rounded-lg px-2 py-1 text-stone-200 font-mono outline-none" />
                                    </div>
                                    <div>
                                        <span className="text-stone-500 block mb-0.5">İskonto %</span>
                                        <input value={row.discountPct || '0'} inputMode="decimal" onChange={e => setOcrRows(rs => rs.map((r, i) => i === idx ? { ...r, discountPct: e.target.value } : r))}
                                            className="w-full bg-stone-900 border border-white/5 rounded-lg px-2 py-1 text-amber-300 font-mono outline-none" />
                                    </div>
                                    <div>
                                        <span className="text-stone-500 block mb-0.5">KDV %</span>
                                        <input value={row.vatPct || '0'} inputMode="decimal" onChange={e => setOcrRows(rs => rs.map((r, i) => i === idx ? { ...r, vatPct: e.target.value } : r))}
                                            className="w-full bg-stone-900 border border-white/5 rounded-lg px-2 py-1 text-sky-300 font-mono outline-none" />
                                    </div>
                                    <div>
                                        <span className="text-stone-500 block mb-0.5">Lot No</span>
                                        <input value={row.lotNumber || ''} onChange={e => setOcrRows(rs => rs.map((r, i) => i === idx ? { ...r, lotNumber: e.target.value } : r))}
                                            placeholder="Opsiyonel"
                                            className="w-full bg-stone-900 border border-white/5 rounded-lg px-2 py-1 text-stone-300 font-mono outline-none" />
                                    </div>
                                    <div>
                                        <span className="text-stone-500 block mb-0.5">SKT</span>
                                        <input type="date" value={row.expiryDate || ''} onChange={e => setOcrRows(rs => rs.map((r, i) => i === idx ? { ...r, expiryDate: e.target.value } : r))}
                                            className="w-full bg-stone-900 border border-white/5 rounded-lg px-1.5 py-1 text-stone-300 font-mono outline-none" />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[10px]">
                                    <span className="text-stone-500">Net Birim Maliyet: <strong className="text-emerald-400 font-mono">{netCost.toFixed(2)} ₺</strong></span>
                                    <span className="text-stone-400 font-mono">Satır Toplam: <strong>{(parseNum(row.quantity) * netCost).toFixed(2)} ₺</strong></span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {ocrRows.length > 0 && (
                    <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-950/60 rounded-b-3xl">
                        <div className="text-xs text-stone-300 font-bold">
                            Genel Toplam: <span className="text-emerald-400 font-black font-mono text-sm">{grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                            {invalidRowCount > 0 && (
                                <span className="block text-[11px] text-red-400 mt-0.5">{invalidRowCount} satırda ürün adı / miktar geçersiz.</span>
                            )}
                        </div>
                        <button type="button" onClick={onAddRows} disabled={isSaving || invalidRowCount > 0}
                            className="w-full sm:w-auto min-h-[44px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {ocrSupplierId ? `${ocrRows.length} Ürünü Depoya + Cariye İşle` : `${ocrRows.length} Ürünü Depoya Ekle`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});
InventoryOcrInvoiceModal.displayName = 'InventoryOcrInvoiceModal';
