import React, { useState, useEffect, useCallback } from 'react';
import { X, Package, Plus, DollarSign, AlertCircle, Barcode, Camera, RefreshCw, QrCode, Calendar, Boxes } from 'lucide-react';
import { Pesticide, PesticideCategory } from '../../types';
import { formatCurrency, getCurrencySuffix } from '../../utils/currency';
import { PesticideOCRScanner } from '../PesticideOCRScanner';
import { parseGS1Barcode, canonicalBarcodeFromParsed, GS1ParseResult } from '../../utils/gs1Parser';
import { normalizeGtin } from '../../utils/dateUtils';

export interface InventoryFormDataState {
    quantity: string;
    unit: string;
    buyingPrice: string;
    cashBuyingPrice: string;
    sellingPrice: string;
    cashPrice: string;
    lowStockThreshold: string;
    barcode: string;
    category: PesticideCategory;
    gtin?: string;
    lotNumber?: string;
    expiryDate?: string;
    serialNumber?: string;
    packUnitName?: string;
    packSize?: string;
}

/** True when the scan carried GS1 application identifiers (2D karekod / GS1-128), not a plain barcode. */
export const isStructuredGS1Scan = (parsed: GS1ParseResult): boolean =>
    parsed.type === 'GS1_DATAMATRIX' || (!!parsed.gtin && !!(parsed.expiryDate || parsed.batch || parsed.serial));

/**
 * B-05 / B-22: applies one scan to the form.
 * - `barcode` always gets the canonical product code (GTIN/EAN), never the raw 2D GS1 string.
 * - Lot / SKT / Seri are RESET on every structured scan (no `|| prev.x`), so a box of another
 *   product never inherits the previous box's batch data. For a plain barcode that points to a
 *   different product than before, those fields are cleared too.
 */
export const applyScanToInventoryForm = (prev: InventoryFormDataState, parsed: GS1ParseResult, opts?: { typing?: boolean }): InventoryFormDataState => {
    const canonical = canonicalBarcodeFromParsed(parsed);
    if (isStructuredGS1Scan(parsed)) {
        return {
            ...prev,
            barcode: canonical,
            gtin: parsed.gtin || '',
            expiryDate: parsed.expiryDate || '',
            lotNumber: parsed.batch || '',
            serialNumber: parsed.serial || ''
        };
    }
    const newKey = normalizeGtin(parsed.gtin || canonical);
    const prevKey = normalizeGtin(prev.gtin || prev.barcode || '');
    const productChanged = !opts?.typing && !!prevKey && !!newKey && prevKey !== newKey;
    return {
        ...prev,
        barcode: canonical,
        gtin: parsed.gtin || (productChanged ? '' : prev.gtin || ''),
        ...(productChanged ? { expiryDate: '', lotNumber: '', serialNumber: '' } : {})
    };
};

/** Human readable issues of a scan (errors + ambiguity warnings) for the red notice. */
export const getScanIssues = (parsed: GS1ParseResult): { errors: string[]; warnings: string[] } => {
    const errors = [...(parsed.errors || [])];
    const warnings = [...(parsed.warnings || [])];
    if (!parsed.valid && errors.length === 0) errors.push('Barkod / karekod doğrulanamadı.');
    if (parsed.ambiguous && !warnings.some(w => /lot|seri/i.test(w))) {
        warnings.push('GS ayırıcısı yok: Lot / Seri sınırları kesin değil. Lütfen Lot ve Seri alanlarını kutudan kontrol edin.');
    }
    if (parsed.expired) warnings.push(`Bu kutunun SKT'si geçmiş (${parsed.expiryDate}).`);
    return { errors, warnings };
};

interface InventoryItemFormModalProps {
    isAddModalOpen: boolean;
    isEditModalOpen: boolean;
    productName: string;
    setProductName: (val: string) => void;
    selectedPesticide: Pesticide | null;
    setSelectedPesticide: (val: Pesticide | null) => void;
    pesticides: Pesticide[];
    filteredPesticides: Pesticide[];
    formData: InventoryFormDataState;
    setFormData: React.Dispatch<React.SetStateAction<InventoryFormDataState>>;
    currency?: string;
    isSaving: boolean;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    onOpenScanner: () => void;
    onClose: () => void;
    onSaveAdd: () => void;
    onSaveEdit: () => void;
    /** Last camera scan applied by the parent (so its errors / warnings are shown here too). */
    lastScan?: { parsed: GS1ParseResult; ts: number } | null;
}

export const InventoryItemFormModal: React.FC<InventoryItemFormModalProps> = React.memo(({
    isAddModalOpen,
    isEditModalOpen,
    productName,
    setProductName,
    selectedPesticide,
    setSelectedPesticide,
    pesticides,
    filteredPesticides,
    formData,
    setFormData,
    currency,
    isSaving,
    showToast,
    onOpenScanner,
    onClose,
    onSaveAdd,
    onSaveEdit,
    lastScan,
}) => {
    // B-23: every hook runs on every render — the early `return null` comes AFTER the hooks.
    const [gs1DecodedNotice, setGs1DecodedNotice] = useState<string | null>(null);
    const [scanIssues, setScanIssues] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });
    const [packMultiplierInput, setPackMultiplierInput] = useState<string>('1');
    // Raw text typed / wedge-scanned into the barcode field. `formData.barcode` only ever gets the canonical code.
    const [barcodeDraft, setBarcodeDraft] = useState<string>(formData.barcode || '');
    const isOpen = isAddModalOpen || isEditModalOpen;

    // Reset transient scan state whenever the modal is opened / closed.
    useEffect(() => {
        setGs1DecodedNotice(null);
        setScanIssues({ errors: [], warnings: [] });
        setPackMultiplierInput('1');
        setBarcodeDraft(formData.barcode || '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Keep the visible field in sync when the parent changes the barcode (camera scan, edit open…).
    useEffect(() => {
        setBarcodeDraft(prev => {
            const prevCanonical = prev ? canonicalBarcodeFromParsed(parseGS1Barcode(prev)) : '';
            return prevCanonical === (formData.barcode || '') ? prev : (formData.barcode || '');
        });
    }, [formData.barcode]);

    const showScanResult = useCallback((parsed: GS1ParseResult) => {
        setScanIssues(getScanIssues(parsed));
        if (isStructuredGS1Scan(parsed)) {
            setGs1DecodedNotice(
                `GS1 Çözümlendi: ${parsed.gtin ? `GTIN ${parsed.gtin}` : ''}${parsed.batch ? ` • Lot ${parsed.batch}` : ''}${parsed.expiryDate ? ` • SKT ${parsed.expiryDate}` : ''}${parsed.serial ? ` • Seri ${parsed.serial}` : ''}`
            );
        } else {
            setGs1DecodedNotice(null);
        }
    }, []);

    useEffect(() => {
        if (lastScan?.parsed) showScanResult(lastScan.parsed);
    }, [lastScan, showScanResult]);

    if (!isOpen) return null;

    const curr = (currency as any) || 'TRY';
    const currSuffix = getCurrencySuffix(curr);

    const handleBarcodeInputChange = (rawVal: string) => {
        setBarcodeDraft(rawVal);
        if (!rawVal.trim()) {
            setFormData(prev => ({ ...prev, barcode: '' }));
            setGs1DecodedNotice(null);
            setScanIssues({ errors: [], warnings: [] });
            return;
        }
        const parsed = parseGS1Barcode(rawVal);
        setFormData(prev => applyScanToInventoryForm(prev, parsed, { typing: true }));
        showScanResult(parsed);
    };

    const commitBarcodeDraft = () => {
        // Show the canonical code once typing / scanning is finished.
        if (barcodeDraft && formData.barcode && barcodeDraft !== formData.barcode) setBarcodeDraft(formData.barcode);
    };

    const handleSave = () => {
        if (scanIssues.errors.length > 0) {
            const ok = window.confirm(`Barkod / karekod hatalı:\n• ${scanIssues.errors.join('\n• ')}\n\nYine de bu barkodla kaydedilsin mi?`);
            if (!ok) return;
        }
        if (isEditModalOpen) onSaveEdit(); else onSaveAdd();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-stone-900 w-full max-w-md md:max-w-2xl lg:max-w-3xl max-h-[90dvh] flex flex-col rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-950/50 shrink-0">
                    <h3 className="font-bold text-stone-100">
                        {isEditModalOpen ? 'Ürün Düzenle' : 'Depoya Ürün Ekle'}
                    </h3>
                    <button type="button" onClick={onClose} aria-label="Kapat" data-mks-modal-close="true" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-300 hover:bg-white/5">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Ürün Adı</label>
                                <PesticideOCRScanner 
                                    onScanSuccess={(data) => {
                                        setProductName(data.productName);
                                        if (Object.values(PesticideCategory).includes(data.category as PesticideCategory)) {
                                            setFormData(prev => ({ ...prev, category: data.category as PesticideCategory }));
                                        }
                                        const existingPest = pesticides.find(p => p.name.toLocaleLowerCase('tr-TR') === data.productName.toLocaleLowerCase('tr-TR'));
                                        if (existingPest) {
                                            setSelectedPesticide(existingPest);
                                        }
                                    }}
                                    onError={(err) => showToast(err, 'error')}
                                />
                            </div>
                            <div className="relative">
                                <Package className="absolute left-3 top-3 text-stone-500" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Ürün adını giriniz..." 
                                    className={`w-full bg-stone-950 border rounded-xl p-3 pl-10 text-stone-200 text-sm outline-none transition-all ${selectedPesticide ? 'border-emerald-500/50' : 'border-stone-800 focus:border-emerald-500/50'}`}
                                    value={productName}
                                    onChange={(e) => {
                                        setProductName(e.target.value);
                                        if (selectedPesticide) setSelectedPesticide(null);
                                    }}
                                />
                                {(isAddModalOpen && selectedPesticide) && (
                                    <button 
                                        onClick={() => {
                                            setSelectedPesticide(null);
                                            setProductName('');
                                        }}
                                        className="absolute right-3 top-3 text-stone-500 hover:text-stone-300"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                                
                                {isAddModalOpen && filteredPesticides.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-stone-900 border border-stone-800 rounded-xl shadow-xl max-h-48 overflow-y-auto z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-2 border-b border-white/5 bg-stone-950/30">
                                            <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest px-1">Kayıtlı İlaçlardan Seç</span>
                                        </div>
                                        {filteredPesticides.map(p => (
                                            <button 
                                                key={p.id}
                                                onClick={() => {
                                                    setSelectedPesticide(p);
                                                    setProductName(p.name);
                                                    setFormData(prev => ({ ...prev, category: p.category }));
                                                }}
                                                className="w-full text-left p-3 hover:bg-stone-800 border-b border-white/5 last:border-0 flex justify-between items-center group"
                                            >
                                                <div>
                                                    <div className="font-bold text-stone-200 text-sm group-hover:text-emerald-400 transition-colors">{p.name}</div>
                                                    <div className="text-[10px] text-stone-500">{p.category}</div>
                                                </div>
                                                <Plus size={14} className="text-stone-700 group-hover:text-emerald-500" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 animate-in fade-in duration-300">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Kategori</label>
                            <select 
                                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500/50"
                                value={formData.category}
                                onChange={(e) => setFormData({...formData, category: e.target.value as PesticideCategory})}
                            >
                                {Object.values(PesticideCategory).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Stok Miktarı</label>
                            <input 
                                type="number" 
                                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                value={formData.quantity}
                                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Birim</label>
                            <select 
                                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500/50"
                                value={formData.unit}
                                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                            >
                                <option value="Adet">Adet</option>
                                <option value="Litre">Litre</option>
                                <option value="Kg">Kg</option>
                                <option value="Kutu">Kutu</option>
                                <option value="Çuval">Çuval</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Vadeli Alış ({currSuffix})</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 text-stone-600" size={14} />
                                <input 
                                    type="number" 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                    value={formData.buyingPrice}
                                    onChange={(e) => setFormData({...formData, buyingPrice: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Peşin Alış ({currSuffix})</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 text-stone-600" size={14} />
                                <input 
                                    type="number" 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                    value={formData.cashBuyingPrice}
                                    onChange={(e) => setFormData({...formData, cashBuyingPrice: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Vadeli Satış ({currSuffix})</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 text-stone-600" size={14} />
                                <input 
                                    type="number" 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                    value={formData.sellingPrice}
                                    onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Peşin Satış ({currSuffix})</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 text-stone-600" size={14} />
                                <input 
                                    type="number" 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                    value={formData.cashPrice}
                                    onChange={(e) => setFormData({...formData, cashPrice: e.target.value})}
                                    placeholder={formData.buyingPrice ? `${formData.buyingPrice} (V. Alış)` : "0.00"}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Kritik Stok Seviyesi</label>
                            <div className="relative">
                                <AlertCircle className="absolute left-3 top-3 text-stone-600" size={14} />
                                <input 
                                    type="number" 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                    value={formData.lowStockThreshold}
                                    onChange={(e) => setFormData({...formData, lowStockThreshold: e.target.value})}
                                    placeholder="5"
                                />
                            </div>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5">
                                <QrCode size={13} className="text-emerald-400" /> Barkod / BKTS 2D GS1 Karekod
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Barcode className="absolute left-3 top-3 text-stone-600" size={14} />
                                    <input 
                                        type="text" 
                                        data-barcode-input="true"
                                        inputMode="text"
                                        autoComplete="off"
                                        className={`w-full min-h-[44px] bg-stone-950 border rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono ${scanIssues.errors.length > 0 ? 'border-red-500/60' : 'border-stone-800'}`}
                                        value={barcodeDraft}
                                        onChange={(e) => handleBarcodeInputChange(e.target.value)}
                                        onBlur={commitBarcodeDraft}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitBarcodeDraft(); } }}
                                        placeholder="EAN-13 veya (01)GTIN(17)SKT(10)LOT tarayın"
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={onOpenScanner}
                                    className="bg-stone-800 min-h-[44px] min-w-[44px] p-3 rounded-xl border border-white/5 text-stone-300 hover:bg-stone-700 transition-colors flex items-center justify-center"
                                    title="Kamerayla Barkod / 2D Karekod Tara"
                                    aria-label="Kamerayla Barkod / 2D Karekod Tara"
                                >
                                    <Camera size={20} />
                                </button>
                            </div>
                            {formData.barcode && barcodeDraft !== formData.barcode && (
                                <div className="text-[11px] text-stone-400 font-mono">Kaydedilecek barkod: <span className="text-stone-200">{formData.barcode}</span></div>
                            )}
                            {gs1DecodedNotice && scanIssues.errors.length === 0 && (
                                <div className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                                    ✓ {gs1DecodedNotice}
                                </div>
                            )}
                            {scanIssues.errors.length > 0 && (
                                <div role="alert" className="text-[11px] font-bold text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1.5 space-y-0.5">
                                    <div className="flex items-center gap-1.5"><AlertCircle size={12} /> Barkod / karekod hatalı — kutudan kontrol edin:</div>
                                    <ul className="list-disc pl-5 font-medium">
                                        {scanIssues.errors.map((err, i) => <li key={`e${i}`}>{err}</li>)}
                                    </ul>
                                </div>
                            )}
                            {scanIssues.warnings.length > 0 && (
                                <div className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                                    <ul className="list-disc pl-5 font-medium">
                                        {scanIssues.warnings.map((w, i) => <li key={`w${i}`}>{w}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* GS1 Lot / SKT / Seri No (#16 & #17) */}
                    <div className="bg-stone-950/60 border border-white/5 rounded-2xl p-3 space-y-2.5">
                        <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar size={12} /> SKT & Parti (Lot) İzlenebilirliği
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Son Kullanma (SKT)</label>
                                <input
                                    type="date"
                                    value={formData.expiryDate || ''}
                                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-200 font-mono outline-none focus:border-emerald-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Lot / Parti No</label>
                                <input
                                    type="text"
                                    value={formData.lotNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                                    placeholder="Örn: TR26A04"
                                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-200 font-mono outline-none focus:border-emerald-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">GTIN (01)</label>
                                <input
                                    type="text"
                                    value={formData.gtin || ''}
                                    onChange={(e) => setFormData({ ...formData, gtin: e.target.value })}
                                    placeholder="14 haneli GTIN"
                                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-200 font-mono outline-none focus:border-emerald-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Seri No (21)</label>
                                <input
                                    type="text"
                                    value={formData.serialNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    placeholder="BKTS Tekil Seri"
                                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-200 font-mono outline-none focus:border-emerald-500/50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Çoklu Birim & Koli/Çuval Çevrimi (#21) */}
                    <div className="bg-stone-950/60 border border-white/5 rounded-2xl p-3 space-y-2.5">
                        <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Boxes size={12} /> Çoklu Birim (Koli / Çuval / Palet Çevrimi)
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Üst Paket Birimi</label>
                                <select
                                    value={formData.packUnitName || ''}
                                    onChange={(e) => setFormData({ ...formData, packUnitName: e.target.value })}
                                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-200 outline-none focus:border-sky-500/50"
                                >
                                    <option value="">Yok (Tekil)</option>
                                    <option value="Koli">Koli</option>
                                    <option value="Çuval">Çuval</option>
                                    <option value="Palet">Palet</option>
                                    <option value="Paket">Paket</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">1 {formData.packUnitName || 'Koli'} İçi ({formData.unit})</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.packSize || ''}
                                    onChange={(e) => setFormData({ ...formData, packSize: e.target.value })}
                                    placeholder="Örn: 12"
                                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-200 font-mono outline-none focus:border-sky-500/50"
                                />
                            </div>
                        </div>
                        {Number(formData.packSize) > 1 && (
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="number"
                                    min="1"
                                    value={packMultiplierInput}
                                    onChange={(e) => setPackMultiplierInput(e.target.value)}
                                    className="w-16 bg-stone-900 border border-sky-500/30 rounded-lg px-2 py-1 text-xs font-mono text-sky-300 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const mult = Math.max(1, parseFloat(packMultiplierInput) || 1);
                                        const pSize = Math.max(1, parseFloat(formData.packSize || '1') || 1);
                                        const cur = parseFloat(formData.quantity || '0') || 0;
                                        setFormData(prev => ({ ...prev, quantity: String(cur + mult * pSize) }));
                                    }}
                                    className="flex-1 py-1.5 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[11px] font-black transition-colors"
                                >
                                    +{packMultiplierInput || 1} {formData.packUnitName || 'Koli'} Stoğa Ekle (+{(parseFloat(packMultiplierInput || '1') || 1) * (parseFloat(formData.packSize || '1') || 1)} {formData.unit})
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {(Number(formData.sellingPrice) > 0 && Number(formData.buyingPrice) > 0) && (
                        <div className="bg-stone-950 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                            <span className="text-xs text-stone-500 font-bold">Birim Kar:</span>
                            <span className={`text-sm font-black font-mono ${Number(formData.sellingPrice) - Number(formData.buyingPrice) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(Number(formData.sellingPrice) - Number(formData.buyingPrice), curr)}
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/10 bg-stone-950/50 flex justify-end gap-3 shrink-0">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="min-h-[44px] px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 font-bold text-sm transition-colors"
                    >
                        İptal
                    </button>
                    <button 
                        type="button"
                        onClick={handleSave}
                        disabled={(isAddModalOpen && !productName.trim()) || isSaving}
                        className="min-h-[44px] px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                {isEditModalOpen ? 'Güncelleniyor...' : 'Kaydediliyor...'}
                            </>
                        ) : (
                            isEditModalOpen ? 'Güncelle' : 'Kaydet'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});

InventoryItemFormModal.displayName = 'InventoryItemFormModal';
