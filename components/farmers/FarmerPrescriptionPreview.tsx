import React from 'react';
import { ChevronLeft, Edit2, Trash2, Loader2, Share2, MessageCircle, Download } from 'lucide-react';
import { Farmer, Prescription, UserProfile } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { RealisticStamp } from '../RealisticStamp';
import { ConfirmationModal } from '../ConfirmationModal';

interface FarmerPrescriptionPreviewProps {
    selectedFarmer: Farmer;
    selectedPrescription: Prescription;
    receiptRef: React.RefObject<HTMLDivElement>;
    userProfile: UserProfile;
    prescriptionLabel: string;
    isProcessingPdf: boolean;
    isDeleteModalOpen: boolean;
    deleteConfirmMessage: string;
    onBack: () => void;
    onEditPrescription: (prescriptionId: string) => void;
    onRequestDelete: (prescriptionId: string) => void;
    onCloseDeleteModal: () => void;
    onConfirmDelete: () => void;
    onPdfAction: (action: 'SHARE' | 'DOWNLOAD') => void;
    onWhatsAppText: () => void;
}

export const FarmerPrescriptionPreview: React.FC<FarmerPrescriptionPreviewProps> = React.memo(({
    selectedFarmer,
    selectedPrescription,
    receiptRef,
    userProfile,
    prescriptionLabel,
    isProcessingPdf,
    isDeleteModalOpen,
    deleteConfirmMessage,
    onBack,
    onEditPrescription,
    onRequestDelete,
    onCloseDeleteModal,
    onConfirmDelete,
    onPdfAction,
    onWhatsAppText,
}) => {
    return (
        <div className="pb-24 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-950/90 backdrop-blur z-20 py-3 border-b border-white/5">
                <button onClick={onBack} className="flex items-center text-stone-400 hover:text-stone-200 font-medium px-2 py-1 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-xs">
                    <ChevronLeft className="mr-1" size={18}/> Cariye Dön
                </button>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => onEditPrescription(selectedPrescription.id)}
                        className="flex items-center px-3 py-1.5 bg-stone-800 text-stone-300 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-700 transition-all active:scale-95"
                    >
                        <Edit2 size={14} className="mr-1.5" />
                        <span className="text-[10px] font-black uppercase tracking-wide">Düzenle</span>
                    </button>
                    <button 
                        onClick={() => onRequestDelete(selectedPrescription.id)}
                        className="flex items-center px-3 py-1.5 bg-stone-800 text-stone-300 rounded-xl border border-white/5 hover:text-rose-400 hover:bg-stone-700 transition-all active:scale-95"
                    >
                        <Trash2 size={14} className="mr-1.5" />
                        <span className="text-[10px] font-black uppercase tracking-wide">Sil</span>
                    </button>
                </div>
            </div>
            <div ref={receiptRef} className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm mx-auto relative overflow-hidden text-stone-900 mb-6 border border-stone-300 mt-2">
                <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600"></div>
                <div className="flex justify-between items-start mb-6 pt-2">
                    <div>
                        <h3 className="font-black text-lg text-stone-900 tracking-tight">
                            {selectedPrescription.totalAmount && selectedPrescription.totalAmount < 0 ? 'İADE MAKBUZU' : 'ZİRAİ FATURA'}
                        </h3>
                        <div className="mt-1.5 inline-block bg-stone-900 text-white font-mono text-xs font-black px-2.5 py-1 rounded-md tracking-wider">
                            FATURA NO: {selectedPrescription.prescriptionNo}
                        </div>
                        {(() => {
                            const fIds = selectedPrescription.fieldIds || (selectedPrescription.fieldId ? [selectedPrescription.fieldId] : []);
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
                        <p className="font-bold text-emerald-700 text-sm">{selectedFarmer.fullName}</p>
                        <p className="text-[9px] text-stone-500">{new Date(selectedPrescription.date).toLocaleDateString('tr-TR')}</p>
                    </div>
                </div>
                
                <div className="min-h-[200px]">
                    {selectedPrescription.totalAmount && selectedPrescription.totalAmount !== 0 ? (
                        <table className="w-full text-xs">
                            <thead className="bg-stone-200 text-stone-900 uppercase text-[9px] font-black tracking-wider border-b border-stone-300">
                                <tr>
                                    <th className="p-2 text-left w-[40%]">Ürün Adı</th>
                                    <th className="p-2 text-center w-[18%]">Adet</th>
                                    <th className="p-2 text-right w-[20%]">Birim Fiyat</th>
                                    <th className="p-2 text-right w-[22%]">Toplam</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                                {selectedPrescription.items.map((item, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                                        <td className="p-2">
                                            <div className="font-bold text-stone-900 text-xs">{item.pesticideName}</div>
                                            <div className="text-[9px] text-stone-500 font-mono mt-0.5">Doz: {item.dosage}</div>
                                        </td>
                                        <td className="p-2 text-center">
                                            <span className="inline-block bg-amber-100 text-amber-950 font-black font-mono text-xs px-2 py-0.5 rounded border border-amber-300/80">
                                                {item.quantity ? item.quantity.toString().replace(/^-/, '') : '-'}
                                            </span>
                                        </td>
                                        <td className="p-2 text-right font-mono font-bold text-stone-800">
                                            {item.unitPrice ? formatCurrency(item.unitPrice, userProfile?.currency || 'TRY') : '-'}
                                        </td>
                                        <td className="p-2 text-right font-mono font-black text-stone-950">
                                            {item.totalPrice ? formatCurrency(Math.abs(item.totalPrice), userProfile?.currency || 'TRY') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-stone-50/50 border-t border-stone-200">
                                    <td colSpan={3} className="p-2 text-right font-bold text-stone-500 uppercase text-[9px] tracking-widest pt-3">
                                        {selectedPrescription.discountAmount && selectedPrescription.discountAmount > 0 ? 'Ara Toplam' : (selectedPrescription.totalAmount < 0 ? 'İade Toplamı' : `${prescriptionLabel} Toplamı`)}
                                    </td>
                                    <td className={`p-2 text-right font-black font-mono text-sm pt-3 ${selectedPrescription.discountAmount && selectedPrescription.discountAmount > 0 ? 'text-stone-500 line-through' : 'text-emerald-600'}`}>
                                        {formatCurrency(Math.abs((selectedPrescription.totalAmount || 0) + (selectedPrescription.discountAmount || 0)), userProfile?.currency || 'TRY')}
                                    </td>
                                </tr>
                                {selectedPrescription.discountAmount && selectedPrescription.discountAmount > 0 && (
                                    <>
                                        <tr className="bg-stone-50/50">
                                            <td colSpan={3} className="p-2 text-right font-bold text-rose-500 uppercase text-[9px] tracking-widest pt-1">
                                                İskonto (İndirim)
                                            </td>
                                            <td className="p-2 text-right font-black text-rose-500 font-mono text-sm pt-1">
                                                -{formatCurrency(selectedPrescription.discountAmount, userProfile?.currency || 'TRY')}
                                            </td>
                                        </tr>
                                        <tr className="bg-stone-100 border-t border-stone-200">
                                            <td colSpan={3} className="p-2 text-right font-bold text-emerald-700 uppercase text-[10px] tracking-widest pt-2 pb-2">
                                                İndirimli Tutar
                                            </td>
                                            <td className="p-2 text-right font-black text-emerald-700 font-mono text-lg pt-2 pb-2">
                                                {formatCurrency(Math.abs(selectedPrescription.totalAmount || 0), userProfile?.currency || 'TRY')}
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tfoot>
                        </table>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-stone-50 text-stone-500 uppercase text-[8px] font-black tracking-widest">
                                <tr>
                                    <th className="p-2 text-left rounded-l-lg">Ürün / İlaç Adı</th>
                                    <th className="p-2 text-right rounded-r-lg">Uygulama Dozajı</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {selectedPrescription.items.map((item, idx) => (
                                    <tr key={idx} className="group">
                                        <td className="p-2 font-bold text-stone-800">
                                            {item.pesticideName}
                                            {item.quantity && (
                                                <span className="ml-1 text-stone-500 font-bold text-[9px] bg-stone-100 px-1.5 py-0.5 rounded-full">
                                                    {item.quantity.toString().replace(/^-/, '')} Adet
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2 text-right font-mono font-bold text-emerald-600">{item.dosage}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="mt-8 pt-4 border-t border-stone-200 flex justify-between items-end">
                    <div className="text-[7px] text-stone-400 leading-relaxed">
                        Bu belge Mühendis Kayıt Sistemi<br/>
                        tarafından oluşturulmuştur.<br/>
                        <strong>MKS v3.1.2</strong>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <RealisticStamp profile={userProfile} engineerName={selectedPrescription.engineerName} size="xs" />
                    </div>
                </div>
            </div>
            
            <div className="max-w-sm mx-auto flex gap-2 mt-4">
                <button 
                    onClick={() => onPdfAction('SHARE')} 
                    disabled={isProcessingPdf} 
                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                >
                    {isProcessingPdf ? <Loader2 size={16} className="animate-spin mr-2"/> : <Share2 size={16} className="mr-2"/>} 
                    WhatsApp PDF
                </button>
                
                <button 
                    onClick={onWhatsAppText}
                    className="flex-1 py-3 rounded-xl bg-[#25D366] text-white font-bold shadow-xl hover:bg-[#20bd5a] active:scale-95 transition-all flex items-center justify-center text-xs"
                >
                    <MessageCircle size={16} className="mr-2"/> 
                    WP Özet
                </button>

                <button 
                    onClick={() => onPdfAction('DOWNLOAD')} 
                    disabled={isProcessingPdf} 
                    className="px-4 py-3 rounded-xl bg-stone-800 text-stone-200 font-bold border border-white/10 hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                >
                    {isProcessingPdf ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} 
                </button>
            </div>

            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={onCloseDeleteModal}
                onConfirm={onConfirmDelete}
                title={`${prescriptionLabel} Silinecek`}
                message={deleteConfirmMessage}
            />
        </div>
    );
});

FarmerPrescriptionPreview.displayName = 'FarmerPrescriptionPreview';
