import React from 'react';
import { ArrowLeft, Check, X, TrendingUp, Edit2, Trash2, User, Loader2, Share2, MessageCircle, Download } from 'lucide-react';
import { Farmer, Prescription, UserProfile, TeamMember, InventoryItem } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { RealisticStamp } from '../RealisticStamp';
import { ConfirmationModal } from '../ConfirmationModal';
import { PrescriptionProfitModal } from './PrescriptionProfitModal';

interface PrescriptionReceiptViewProps {
    detailPrescription: Prescription;
    selectedFarmer: Farmer | null;
    teamMembers: TeamMember[];
    userProfile: UserProfile;
    canEditPrescription: boolean;
    prescriptionLabel: string;
    processedLabel: string;
    unprocessedLabel: string;
    deleteConfirmMessage: string;
    receiptRef: React.RefObject<HTMLDivElement>;
    isProcessingPdf: boolean;
    isDeleteModalOpen: boolean;
    showProfitId: string | null;
    hideProfitAnalysis?: boolean;
    prescriptions: Prescription[];
    inventory: InventoryItem[];
    onBackToList: () => void;
    onToggleProcessed: (e: React.MouseEvent, p: Prescription) => void;
    onShowProfit: (id: string | null) => void;
    onEdit: (e: React.MouseEvent, p: Prescription) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    onPdfAction: (action: 'SHARE' | 'DOWNLOAD', p?: Prescription, f?: Farmer) => void;
    onWhatsAppText: (p: Prescription, f: Farmer) => void;
    onCloseDeleteModal: () => void;
    onConfirmDelete: () => void;
}

export const PrescriptionReceiptView: React.FC<PrescriptionReceiptViewProps> = React.memo(({
    detailPrescription,
    selectedFarmer,
    teamMembers,
    userProfile,
    canEditPrescription,
    prescriptionLabel,
    processedLabel,
    unprocessedLabel,
    deleteConfirmMessage,
    receiptRef,
    isProcessingPdf,
    isDeleteModalOpen,
    showProfitId,
    hideProfitAnalysis,
    prescriptions,
    inventory,
    onBackToList,
    onToggleProcessed,
    onShowProfit,
    onEdit,
    onDelete,
    onPdfAction,
    onWhatsAppText,
    onCloseDeleteModal,
    onConfirmDelete,
}) => {
    return (
        <div className="p-4 max-w-2xl mx-auto pb-24 animate-in slide-in-from-right duration-200 min-h-[80vh]">
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBackToList} className="text-stone-400 hover:text-stone-200 flex items-center px-2 py-1 rounded-lg hover:bg-stone-900 transition-colors">
                    <ArrowLeft size={20} className="mr-1" /> Listeye Dön
                </button>
                <div className="flex space-x-2">
                    <div className="flex items-center space-x-1 bg-stone-900 rounded-full border border-white/10 p-1">
                        <button 
                            type="button"
                            onClick={(e) => onToggleProcessed(e, detailPrescription)}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-2 ${
                                detailPrescription.isProcessed 
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                                : 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                            }`}
                        >
                            {detailPrescription.isProcessed ? <Check size={14} /> : <X size={14} />}
                            {detailPrescription.isProcessed ? processedLabel : unprocessedLabel}
                        </button>
                    </div>
                    {!hideProfitAnalysis && !userProfile?.hideCostAndProfit && (
                        <button 
                            onClick={() => onShowProfit(detailPrescription.id)} 
                            className="p-2 bg-stone-800 text-emerald-400 rounded-full border border-white/5 hover:bg-stone-700 transition-all"
                            title="Kar/Zarar Analizi"
                        >
                            <TrendingUp size={18} />
                        </button>
                    )}
                    {canEditPrescription && (
                        <button 
                            onClick={(e) => onEdit(e, detailPrescription)} 
                            className="p-2 bg-stone-800 text-stone-300 rounded-full border border-white/5 hover:bg-stone-700 hover:text-emerald-400 transition-all"
                            title="Düzenle"
                        >
                            <Edit2 size={18} />
                        </button>
                    )}
                    {canEditPrescription && (
                        <button 
                            onClick={(e) => onDelete(e, detailPrescription.id)}
                            className="p-2 bg-stone-800 text-stone-300 rounded-full border border-white/5 hover:bg-red-900/40 hover:text-red-400 transition-all"
                            title="Sil"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="relative mb-8 drop-shadow-[0_10px_20px_rgba(0,0,0,0.1)]">
                <div ref={receiptRef} className="bg-[#fdfdfc] px-8 pt-10 pb-6 rounded-t-xl text-left relative overflow-hidden text-stone-800">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

                    <div className={`absolute top-0 left-0 w-full h-1.5 ${detailPrescription.type === 'RETURN' ? 'bg-amber-500' : 'bg-stone-800'}`}></div>

                    <div className="flex justify-between mb-8 relative z-10">
                        <div>
                            <h3 className="font-bold text-2xl text-stone-900 tracking-tight">
                                {detailPrescription.type === 'RETURN' ? 'Zirai İade Faturası' : 'Zirai Satış Faturası'}
                            </h3>
                            <div className="mt-2 inline-flex items-center gap-1.5 bg-stone-900 text-white font-mono text-xs font-black px-3 py-1 rounded-md tracking-wider shadow-xs">
                                FATURA NO: {detailPrescription.prescriptionNo}
                            </div>
                            <p className="text-[10px] text-stone-500 font-bold mt-1.5 flex items-center">
                                <User size={10} className="mr-1" />
                                {detailPrescription.createdById ? (teamMembers.find(m => m.id === detailPrescription.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                            </p>
                            {(() => {
                                const fIds = detailPrescription.fieldIds || (detailPrescription.fieldId ? [detailPrescription.fieldId] : []);
                                if (fIds.length === 0) return null;
                                const fieldNames = fIds.map(id => selectedFarmer?.fields?.find(f => f.id === id)?.name).filter(Boolean);
                                if (fieldNames.length === 0) return null;
                                return (
                                    <p className="text-[10px] text-emerald-600 font-bold mt-1">
                                        {fieldNames.length > 1 ? 'Araziler: ' : 'Arazi: '}{fieldNames.join(', ')}
                                    </p>
                                );
                            })()}
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-emerald-700 text-xl">{selectedFarmer?.fullName}</p>
                            <p className="text-xs text-stone-500">{selectedFarmer?.village}</p>
                            <p className="text-[10px] text-stone-400 mt-1">{new Date(detailPrescription.date).toLocaleDateString('tr-TR', { dateStyle: 'long' })}</p>
                            {detailPrescription.priceType === 'TERM' && (
                                <div className="mt-2">
                                    <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                        Vade: {detailPrescription.dueDate ? new Date(detailPrescription.dueDate).toLocaleDateString('tr-TR') : 'Belirtilmedi'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="min-h-[250px] relative z-10">
                        {detailPrescription.totalAmount !== undefined && detailPrescription.totalAmount !== null && Math.abs(detailPrescription.totalAmount) > 0 ? (
                            <table className="w-full text-sm">
                                <thead className="bg-stone-200 text-stone-900 uppercase text-[10px] font-black tracking-wider border-b-2 border-stone-300">
                                    <tr>
                                        <th className="py-2.5 px-2 text-left w-[40%]">Ürün Adı</th>
                                        <th className="py-2.5 px-2 text-center w-[18%]">Adet</th>
                                        <th className="py-2.5 px-2 text-right w-[20%]">Birim Fiyat</th>
                                        <th className="py-2.5 px-2 text-right w-[22%]">Toplam</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                    {detailPrescription.items.map((item, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                                            <td className="py-3 px-2">
                                                <div className="font-black text-stone-900 text-sm">{item.pesticideName}</div>
                                                <div className="text-[10px] text-stone-500 font-mono mt-0.5">Doz: {item.dosage}</div>
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                <span className="inline-block bg-amber-100 text-amber-950 font-black font-mono text-sm px-2.5 py-1 rounded-md border border-amber-300/80 shadow-2xs">
                                                    {item.quantity ? item.quantity.toString().replace(/^-/, '') : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono font-bold text-stone-800 text-sm">
                                                {item.unitPrice ? formatCurrency(item.unitPrice, userProfile?.currency || 'TRY') : '-'}
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono font-black text-stone-950 text-base">
                                                {item.totalPrice ? formatCurrency(Math.abs(item.totalPrice), userProfile?.currency || 'TRY') : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    {detailPrescription.discountAmount && detailPrescription.discountAmount > 0 && (
                                        <tr>
                                            <td colSpan={4} className="pt-4 pb-2">
                                                <div className="border-t-2 border-dashed border-stone-300 pt-4 flex justify-between items-center text-stone-500">
                                                    <span className="font-bold uppercase text-[10px] tracking-widest">
                                                        Ara Toplam
                                                    </span>
                                                    <span className="font-black font-mono text-lg tracking-tight line-through">
                                                        {formatCurrency(Math.abs((detailPrescription.totalAmount || 0) + (detailPrescription.discountAmount || 0)), userProfile?.currency || 'TRY')}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {detailPrescription.discountAmount && detailPrescription.discountAmount > 0 && (
                                        <tr>
                                            <td colSpan={4} className="pb-4">
                                                <div className="flex justify-between items-center text-rose-500">
                                                    <span className="font-bold uppercase text-[10px] tracking-widest">
                                                        İskonto (İndirim)
                                                    </span>
                                                    <span className="font-black font-mono text-lg tracking-tight">
                                                        -{formatCurrency(Math.abs(detailPrescription.discountAmount || 0), userProfile?.currency || 'TRY')}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td colSpan={4} className={detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? "pt-2" : "pt-4"}>
                                            <div className={`${detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? 'border-t border-stone-200' : 'border-t-2 border-dashed border-stone-300'} pt-4 flex justify-between items-center`}>
                                                <span className={`font-bold uppercase text-[10px] tracking-widest ${detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                                                    {detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? 'İNDİRİMLİ TUTAR' : (detailPrescription.priceType === 'CASH' ? 'PEŞİN ' : 'VADELİ ') + (detailPrescription.type === 'RETURN' ? 'İADE TOPLAMI' : 'SATIŞ TOPLAMI')}
                                                </span>
                                                <span className={`font-black font-mono text-2xl tracking-tight ${detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? 'text-emerald-700' : 'text-emerald-600'}`}>
                                                    {formatCurrency(Math.abs(detailPrescription.totalAmount || 0), userProfile?.currency || 'TRY')}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="text-stone-400 uppercase text-[9px] font-black tracking-widest border-b-2 border-stone-200">
                                    <tr>
                                        <th className="pb-3 text-left">Ürün / İlaç Adı</th>
                                        <th className="pb-3 text-right">Uygulama Dozajı</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {detailPrescription.items.map((item, idx) => (
                                        <tr key={idx} className="group">
                                            <td className="py-4 font-bold text-stone-800">
                                                {item.pesticideName}
                                                {item.quantity && (
                                                    <span className="ml-2 text-stone-500 font-bold text-xs bg-stone-100 px-2 py-0.5 rounded-full">
                                                        {item.quantity.toString().replace(/^-/, '')} Adet
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 text-right font-mono font-bold text-emerald-600">{item.dosage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="mt-8 pt-4 flex justify-between items-end relative z-10 border-t border-stone-200">
                        <div className="text-[10px] text-stone-400/80 font-mono leading-relaxed">
                            Bu belge Mühendis Kayıt Sistemi<br/>
                            tarafından oluşturulmuştur.<br/>
                            <strong>v3.1.2</strong>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <RealisticStamp 
                                profile={userProfile} 
                                engineerName={detailPrescription.engineerName} 
                                size="sm"
                            />
                        </div>
                    </div>
                </div>
                <div className="w-full h-3 overflow-hidden block z-10 relative -mt-[1px]">
                    <svg viewBox="0 0 1200 30" preserveAspectRatio="none" className="w-full h-full block" style={{ fill: '#fdfdfc' }}>
                        <path d="M0,0 L0,15 L15,30 L30,15 L45,30 L60,15 L75,30 L90,15 L105,30 L120,15 L135,30 L150,15 L165,30 L180,15 L195,30 L210,15 L225,30 L240,15 L255,30 L270,15 L285,30 L300,15 L315,30 L330,15 L345,30 L360,15 L375,30 L390,15 L405,30 L420,15 L435,30 L450,15 L465,30 L480,15 L495,30 L510,15 L525,30 L540,15 L555,30 L570,15 L585,30 L600,15 L615,30 L630,15 L645,30 L660,15 L675,30 L690,15 L705,30 L720,15 L735,30 L750,15 L765,30 L780,15 L795,30 L810,15 L825,30 L840,15 L855,30 L870,15 L885,30 L900,15 L915,30 L930,15 L945,30 L960,15 L975,30 L990,15 L1005,30 L1020,15 L1035,30 L1050,15 L1065,30 L1080,15 L1095,30 L1110,15 L1125,30 L1140,15 L1155,30 L1170,15 L1185,30 L1200,15 L1200,0 Z"></path>
                    </svg>
                </div>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={() => onPdfAction('SHARE', detailPrescription, selectedFarmer || undefined)} 
                    disabled={isProcessingPdf}
                    className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                >
                    {isProcessingPdf ? <Loader2 size={20} className="mr-2 animate-spin"/> : <Share2 size={20} className="mr-2"/>}
                    WhatsApp PDF
                </button>
                
                <button 
                    onClick={() => selectedFarmer && onWhatsAppText(detailPrescription, selectedFarmer)}
                    className="flex-1 py-4 rounded-2xl bg-[#25D366] text-white font-black text-sm shadow-xl hover:bg-[#20bd5a] flex items-center justify-center active:scale-95 transition-all"
                >
                    <MessageCircle size={20} className="mr-2"/>
                    WP Özet
                </button>

                <button 
                    onClick={() => onPdfAction('DOWNLOAD', detailPrescription, selectedFarmer || undefined)} 
                    disabled={isProcessingPdf}
                    className="px-6 py-4 rounded-2xl bg-stone-800 text-stone-300 font-black text-sm border border-white/5 hover:bg-stone-700 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                >
                    {isProcessingPdf ? <Loader2 size={20} className="animate-spin"/> : <Download size={20} />}
                </button>
            </div>

            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={onCloseDeleteModal}
                onConfirm={onConfirmDelete}
                title={`${prescriptionLabel} Silinecek`}
                message={deleteConfirmMessage}
            />

            <PrescriptionProfitModal
                showProfitId={showProfitId}
                prescriptions={prescriptions}
                inventory={inventory}
                currency={userProfile?.currency}
                onClose={() => onShowProfit(null)}
            />
        </div>
    );
});

PrescriptionReceiptView.displayName = 'PrescriptionReceiptView';
