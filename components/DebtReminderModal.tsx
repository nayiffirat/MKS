import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Farmer } from '../types';
import { dbService } from '../services/db';
import { generatePortalToken } from '../utils/crypto';
import { buildPublicPortalUrl } from '../utils/api';
import { useAppViewModel } from '../context/AppContext';
import { normalizeWaPhone, buildWaUrl } from '../utils/whatsappTemplates';
import { useBackHandler } from '../utils/navigationManager';
import { ModalCloseButton } from './ModalCloseButton';
import { 
    MessageCircle, 
    Send, 
    Search, 
    CheckSquare, 
    Square, 
    Copy, 
    Check, 
    Play, 
    SkipForward, 
    Sparkles, 
    CheckCircle2, 
    FileText, 
    Users,
    DollarSign
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface DebtReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    farmersWithDebt: (Farmer & { overallBalance?: number })[];
    allFarmers?: Farmer[];
    currency: 'TRY' | 'USD' | 'EUR';
    farmerLabel: string;
    engineerId: string;
    companyName?: string;
    onLogReminderSent?: (farmerId: string, note: string) => void;
}

type TemplateType = 'REMINDER' | 'URGENT' | 'ANNOUNCEMENT' | 'CUSTOM';

const TEMPLATES: Record<TemplateType, { title: string; text: string }> = {
    REMINDER: {
        title: '📋 Standart Borç Hatırlatma',
        text: `Sayın {ad_soyad},\n\nGüncel hesap bakiyeniz *{borc_miktari}* borç bakiyesi vermektedir.\n\nDetaylı hesap ekstrenizi ve ödemelerinizi size özel portalınızdan inceleyebilirsiniz:\n🔗 *Portal Linkiniz:*\n{portal_linki}\n\nHayırlı işler, bereketli kazançlar dileriz.`
    },
    URGENT: {
        title: '⏰ Acil Vade İkazı',
        text: `Sayın {ad_soyad},\n\nVadesi gelmiş/geçmiş olan *{borc_miktari}* tutarındaki bakiyenizin kapatılması önemle rica olunur.\n\nHesap detaylarınız ve ekstre için:\n🔗 {portal_linki}\n\nSorularınız için bizimle iletişime geçebilirsiniz.`
    },
    ANNOUNCEMENT: {
        title: '📢 Genel Bilgilendirme / Duyuru',
        text: `Sayın {ad_soyad},\n\nTarımsal danışmanlık, gübre ve ilaç ihtiyaçlarınız için hizmetinizdeyiz.\n\nTüm işlem ve ekstrelerinizi portalınızdan 7/24 takip edebilirsiniz:\n🔗 {portal_linki}\n\nİyi çalışmalar dileriz.`
    },
    CUSTOM: {
        title: '✍️ Özel Mesaj Taslağı',
        text: `Sayın {ad_soyad},\n\n`
    }
};

export const DebtReminderModal: React.FC<DebtReminderModalProps> = ({ 
    isOpen, 
    onClose, 
    farmersWithDebt, 
    allFarmers = [], 
    currency, 
    farmerLabel, 
    engineerId,
    companyName = 'MKS Mühendisim',
    onLogReminderSent
}) => {
    const [targetTab, setTargetTab] = useState<'DEBTORS' | 'ALL'>('DEBTORS');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activeTemplate, setActiveTemplate] = useState<TemplateType>('REMINDER');
    const [customText, setCustomText] = useState(TEMPLATES.REMINDER.text);
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

    // Queue Sequential Mode
    const [isQueueMode, setIsQueueMode] = useState(false);
    const [queueIndex, setQueueIndex] = useState(0);
    const [sentStatus, setSentStatus] = useState<Record<string, 'PENDING' | 'SENT' | 'SKIPPED'>>({});
    const tokenCacheRef = useRef<Record<string, string>>({});

    const getOrAssignPortalToken = (farmer: Farmer): string => {
        if (farmer.portalToken && farmer.portalToken.length >= 16) {
            return farmer.portalToken;
        }
        if (!tokenCacheRef.current[farmer.id]) {
            tokenCacheRef.current[farmer.id] = generatePortalToken();
        }
        return tokenCacheRef.current[farmer.id];
    };

    // Filter candidate list
    const candidates = useMemo(() => {
        let list: (Farmer & { overallBalance?: number })[] = [];
        if (targetTab === 'DEBTORS') {
            list = farmersWithDebt.filter(f => (f.overallBalance || 0) < 0);
        } else {
            // All farmers, attaching overallBalance if available
            const debtMap = new Map(farmersWithDebt.map(f => [f.id, f.overallBalance || 0]));
            list = (allFarmers.length > 0 ? allFarmers : farmersWithDebt).map(f => ({
                ...f,
                overallBalance: debtMap.get(f.id) || f.balance || 0
            }));
        }

        if (searchTerm.trim()) {
            const lower = searchTerm.toLocaleLowerCase('tr-TR');
            list = list.filter(f => 
                f.fullName.toLocaleLowerCase('tr-TR').includes(lower) || 
                (f.village || '').toLocaleLowerCase('tr-TR').includes(lower) ||
                (f.phoneNumber || '').includes(lower)
            );
        }

        // Sort by debt highest first
        return list.sort((a, b) => (a.overallBalance || 0) - (b.overallBalance || 0));
    }, [targetTab, farmersWithDebt, allFarmers, searchTerm]);

    // Select all by default when candidate list changes or tab changes
    useEffect(() => {
        if (isOpen) {
            setSelectedIds(candidates.map(c => c.id));
        }
    }, [targetTab, isOpen]);

    if (!isOpen) return null;

    const toggleSelectAll = () => {
        if (selectedIds.length === candidates.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(candidates.map(c => c.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleSelectTemplate = (type: TemplateType) => {
        setActiveTemplate(type);
        setCustomText(TEMPLATES[type].text);
    };

    const insertVariable = (variableTag: string) => {
        setCustomText(prev => prev + variableTag);
    };

    const generateMessage = (farmer: Farmer & { overallBalance?: number }) => {
        const debtAmount = Math.abs(farmer.overallBalance || 0);
        const formattedDebt = formatCurrency(debtAmount, currency);
        const token = getOrAssignPortalToken(farmer);
        const portalUrl = buildPublicPortalUrl(token);

        let text = customText;
        text = text.replace(/\{ad_soyad\}/g, farmer.fullName);
        text = text.replace(/\{borc_miktari\}/g, formattedDebt);
        text = text.replace(/\{portal_linki\}/g, portalUrl);
        text = text.replace(/\{koy\}/g, farmer.village || '');
        text = text.replace(/\{firma_adi\}/g, companyName);

        return text;
    };

    const selectedFarmers = candidates.filter(c => selectedIds.includes(c.id));

    const handleSingleSend = (farmer: Farmer & { overallBalance?: number }) => {
        const token = getOrAssignPortalToken(farmer);
        if (!farmer.portalToken || farmer.portalToken.length < 16) {
            farmer.portalToken = token;
            const { overallBalance: _ignored, ...cleanFarmer } = farmer;
            dbService.updateFarmer({ ...cleanFarmer, portalToken: token })
                .then(() => dbService.publishFarmerPortalShare(farmer.id, true))
                .catch(() => {});
        } else {
            dbService.publishFarmerPortalShare(farmer.id, true).catch(() => {});
        }

        const msg = generateMessage(farmer);
        const cleanPhone = (farmer.phoneNumber || '').replace(/[^0-9]/g, '');
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        
        setSentStatus(prev => ({ ...prev, [farmer.id]: 'SENT' }));
        if (onLogReminderSent) {
            onLogReminderSent(farmer.id, `WhatsApp borç hatırlatması gönderildi (${formatCurrency(Math.abs(farmer.overallBalance || 0), currency)})`);
        }
        window.open(waUrl, '_blank');
    };

    const startQueueMode = () => {
        if (selectedFarmers.length === 0) return;
        setIsQueueMode(true);
        setQueueIndex(0);
    };

    const currentQueueFarmer = selectedFarmers[queueIndex];

    const handleQueueSendAndNext = () => {
        if (!currentQueueFarmer) return;
        
        handleSingleSend(currentQueueFarmer);

        if (queueIndex < selectedFarmers.length - 1) {
            setQueueIndex(prev => prev + 1);
        } else {
            // Finished queue
            setIsQueueMode(false);
        }
    };

    const handleQueueSkip = () => {
        if (!currentQueueFarmer) return;
        setSentStatus(prev => ({ ...prev, [currentQueueFarmer.id]: 'SKIPPED' }));
        if (queueIndex < selectedFarmers.length - 1) {
            setQueueIndex(prev => prev + 1);
        } else {
            setIsQueueMode(false);
        }
    };

    const handleCopyText = (text: string, idKey: string) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(idKey);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleCopyAllPhones = () => {
        const phones = selectedFarmers.map(f => f.phoneNumber).filter(Boolean).join('\n');
        navigator.clipboard.writeText(phones);
        setCopiedIndex('ALL_PHONES');
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-950/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center border border-[#25D366]/20">
                            <MessageCircle size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                                Toplu WhatsApp Mesaj Merkezi
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    {selectedIds.length} Alıcı
                                </span>
                            </h2>
                            <p className="text-[10px] text-stone-400">Tek tıkla özelleştirilmiş WhatsApp mesajları ve ekstre linkleri gönderin</p>
                        </div>
                    </div>
                    <ModalCloseButton onClick={onClose} />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                    
                    {/* Mode Banner / Queue Execution Screen */}
                    {isQueueMode && currentQueueFarmer ? (
                        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                                    <Sparkles size={16} className="animate-pulse" />
                                    <span>Seri Gönderim Modu ({queueIndex + 1} / {selectedFarmers.length})</span>
                                </div>
                                <button 
                                    onClick={() => setIsQueueMode(false)}
                                    className="text-[10px] font-bold text-stone-400 hover:text-white bg-stone-800 px-2.5 py-1 rounded-lg"
                                >
                                    Sırayı Sonlandır
                                </button>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-stone-950 h-2 rounded-full overflow-hidden border border-white/5">
                                <div 
                                    className="bg-emerald-500 h-full transition-all duration-300"
                                    style={{ width: `${((queueIndex + 1) / selectedFarmers.length) * 100}%` }}
                                />
                            </div>

                            {/* Current Recipient Card */}
                            <div className="bg-stone-900 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-0.5">Sıradaki Kişi</span>
                                    <h3 className="text-base font-black text-white">{currentQueueFarmer.fullName}</h3>
                                    <p className="text-xs text-stone-400 font-mono">{currentQueueFarmer.village} • {currentQueueFarmer.phoneNumber}</p>
                                    {(currentQueueFarmer.overallBalance || 0) < 0 && (
                                        <p className="text-xs font-bold text-rose-400 mt-1 font-mono">
                                            Borç: {formatCurrency(Math.abs(currentQueueFarmer.overallBalance || 0), currency)}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleQueueSkip}
                                        className="px-3 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                        <SkipForward size={14} /> Atla
                                    </button>
                                    <button
                                        onClick={handleQueueSendAndNext}
                                        className="px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebd59] text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 active:scale-95"
                                    >
                                        <Send size={15} /> WhatsApp'ta Aç & Sıradakine Geç
                                    </button>
                                </div>
                            </div>

                            {/* Live Message Preview */}
                            <div className="bg-stone-950 p-3 rounded-xl border border-white/5 text-xs text-stone-300 whitespace-pre-wrap font-sans">
                                <p className="text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1">Gönderilecek Mesaj:</p>
                                {generateMessage(currentQueueFarmer)}
                            </div>
                        </div>
                    ) : null}

                    {/* Target Selector Tabs & Search */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 p-1 bg-stone-950 rounded-2xl border border-white/5">
                            <button
                                onClick={() => setTargetTab('DEBTORS')}
                                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                    targetTab === 'DEBTORS' 
                                        ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30 shadow-md' 
                                        : 'text-stone-400 hover:text-stone-200'
                                }`}
                            >
                                <DollarSign size={14} /> Sadece Borçlular ({farmersWithDebt.filter(f => (f.overallBalance || 0) < 0).length})
                            </button>
                            <button
                                onClick={() => setTargetTab('ALL')}
                                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                    targetTab === 'ALL' 
                                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-md' 
                                        : 'text-stone-400 hover:text-stone-200'
                                }`}
                            >
                                <Users size={14} /> Tüm Üreticiler ({allFarmers.length || farmersWithDebt.length})
                            </button>
                        </div>

                        {/* Search and Selection Actions Bar */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" size={15} />
                                <input 
                                    type="text" 
                                    placeholder="İsim, köy veya telefon ile ara..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-stone-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-stone-200 text-xs outline-none focus:border-emerald-500/50 transition-all"
                                />
                            </div>
                            <button
                                onClick={toggleSelectAll}
                                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border border-white/5"
                            >
                                {selectedIds.length === candidates.length ? (
                                    <><CheckSquare size={14} className="text-emerald-400" /> Tümünü Kaldır</>
                                ) : (
                                    <><Square size={14} /> Tümünü Seç</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Template Customizer */}
                    <div className="bg-stone-950/60 border border-white/5 rounded-2xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                <FileText size={12} /> Mesaj Şablonu Seçin
                            </label>
                            <span className="text-[10px] text-stone-500">
                                {customText.length} karakter
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {(Object.keys(TEMPLATES) as TemplateType[]).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleSelectTemplate(type)}
                                    className={`p-2 rounded-xl text-[10px] font-bold text-left transition-all border ${
                                        activeTemplate === type
                                            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm'
                                            : 'bg-stone-900 border-white/5 text-stone-400 hover:text-stone-200'
                                    }`}
                                >
                                    {TEMPLATES[type].title}
                                </button>
                            ))}
                        </div>

                        {/* Text Editor */}
                        <div className="space-y-2">
                            <textarea
                                value={customText}
                                onChange={e => {
                                    setCustomText(e.target.value);
                                    setActiveTemplate('CUSTOM');
                                }}
                                rows={4}
                                className="w-full bg-stone-900 border border-white/10 rounded-xl p-3 text-stone-200 text-xs outline-none focus:border-emerald-500/50 transition-all leading-relaxed custom-scrollbar resize-none font-sans"
                                placeholder="Mesaj metninizi yazın..."
                            />

                            {/* Variables Insertion Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[9px] font-bold text-stone-500 uppercase mr-1">Değişken Ekle:</span>
                                {[
                                    { tag: '{ad_soyad}', label: '👤 Müşteri Adı' },
                                    { tag: '{borc_miktari}', label: '💰 Borç Miktarı' },
                                    { tag: '{portal_linki}', label: '🔗 Portal Linki' },
                                    { tag: '{koy}', label: '🏡 Köy' },
                                ].map(v => (
                                    <button
                                        key={v.tag}
                                        type="button"
                                        onClick={() => insertVariable(v.tag)}
                                        className="text-[10px] font-mono bg-stone-800 hover:bg-emerald-950 hover:text-emerald-300 text-stone-300 px-2 py-0.5 rounded-lg border border-white/5 transition-all"
                                    >
                                        + {v.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recipient Selection List */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-stone-400 px-1">
                            <span className="font-bold">Alıcı Listesi ({candidates.length} Kişi)</span>
                            <button 
                                onClick={handleCopyAllPhones}
                                className="text-[10px] text-stone-400 hover:text-emerald-400 flex items-center gap-1 font-mono"
                            >
                                {copiedIndex === 'ALL_PHONES' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                Numaraları Kopyala
                            </button>
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                            {candidates.length === 0 ? (
                                <div className="text-center py-8 text-stone-500 text-xs bg-stone-950/40 rounded-2xl border border-white/5">
                                    Arama veya filtre kriterlerinize uygun üretici bulunamadı.
                                </div>
                            ) : (
                                candidates.map(farmer => {
                                    const isSelected = selectedIds.includes(farmer.id);
                                    const status = sentStatus[farmer.id] || 'PENDING';
                                    const debtVal = farmer.overallBalance || 0;

                                    return (
                                        <div 
                                            key={farmer.id}
                                            onClick={() => toggleSelectOne(farmer.id)}
                                            className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-stone-900 border-emerald-500/40 shadow-sm' 
                                                    : 'bg-stone-950/40 border-white/5 opacity-60 hover:opacity-100'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <button type="button" className="text-stone-400 hover:text-emerald-400">
                                                    {isSelected ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} />}
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-stone-200 text-xs">{farmer.fullName}</h4>
                                                        {status === 'SENT' && (
                                                            <span className="text-[8px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                                                                <CheckCircle2 size={9} /> Gönderildi
                                                            </span>
                                                        )}
                                                        {status === 'SKIPPED' && (
                                                            <span className="text-[8px] bg-stone-800 text-stone-400 font-bold px-1.5 py-0.2 rounded">
                                                                Atlandı
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-stone-500 font-mono">{farmer.village || 'Köy Belirtilmemiş'} • {farmer.phoneNumber}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {debtVal < 0 ? (
                                                    <div className="text-right">
                                                        <div className="text-xs font-black text-rose-400 font-mono">
                                                            {formatCurrency(Math.abs(debtVal), currency)}
                                                        </div>
                                                        <div className="text-[8px] text-stone-500 uppercase">Borç</div>
                                                    </div>
                                                ) : (
                                                    <div className="text-right">
                                                        <div className="text-xs font-bold text-emerald-400 font-mono">
                                                            {debtVal > 0 ? formatCurrency(debtVal, currency) : '0 ₺'}
                                                        </div>
                                                        <div className="text-[8px] text-stone-500 uppercase">Alacak</div>
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSingleSend(farmer);
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all flex items-center justify-center border border-[#25D366]/20 shrink-0"
                                                    title="Tekli WhatsApp Mesajı Gönder"
                                                >
                                                    <Send size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-white/10 bg-stone-950/90 flex items-center justify-between gap-3">
                    <div className="text-xs text-stone-400 font-medium">
                        Seçili: <span className="text-white font-bold">{selectedFarmers.length} Kişi</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all"
                        >
                            Kapat
                        </button>
                        <button
                            type="button"
                            disabled={selectedFarmers.length === 0}
                            onClick={startQueueMode}
                            className="px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebd59] disabled:bg-stone-800 disabled:text-stone-600 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 active:scale-95"
                        >
                            <Play size={14} /> Toplu Gönderimi Başlat ({selectedFarmers.length})
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
