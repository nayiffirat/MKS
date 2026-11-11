import React from 'react';
import { ChevronLeft, Loader2, Share2, MessageCircle, Download } from 'lucide-react';
import { Farmer, UserProfile } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { RealisticStamp } from '../RealisticStamp';

interface FarmerStatementReportViewProps {
    selectedFarmer: Farmer;
    reportRef: React.RefObject<HTMLDivElement>;
    reportStartDate: string;
    reportEndDate: string;
    reportType: 'SUMMARY' | 'DETAILED';
    reportFieldId: string;
    reportCrop: string;
    reportItems: any[];
    reportTotalDebt: number;
    reportTotalPaid: number;
    reportBalance: number;
    userProfile: UserProfile;
    isGeneratingReport: boolean;
    onBack: () => void;
    onPdfAction: (action: 'SHARE' | 'DOWNLOAD') => void;
    onWhatsAppText: () => void;
}

export const FarmerStatementReportView: React.FC<FarmerStatementReportViewProps> = React.memo(({
    selectedFarmer,
    reportRef,
    reportStartDate,
    reportEndDate,
    reportType,
    reportFieldId,
    reportCrop,
    reportItems,
    reportTotalDebt,
    reportTotalPaid,
    reportBalance,
    userProfile,
    isGeneratingReport,
    onBack,
    onPdfAction,
    onWhatsAppText,
}) => {
    return (
        <div className="pb-24 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-950/90 backdrop-blur z-20 py-3 border-b border-white/5">
                <button onClick={onBack} className="flex items-center text-stone-400 hover:text-stone-200 font-medium px-2 py-1 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-xs">
                    <ChevronLeft className="mr-1" size={18}/> Cari Hesaba Dön
                </button>
            </div>
            
            <div className="overflow-x-auto pb-4">
                <div className="relative mt-4 mb-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.1)] w-[210mm] mx-auto min-w-[210mm]">
                    <div ref={reportRef} className="bg-[#fdfdfc] px-8 pt-10 pb-6 rounded-t-xl text-left relative overflow-hidden text-stone-800">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

                        <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>

                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <div>
                                <h1 className="text-3xl font-black uppercase tracking-tight mb-1">Cari Hesap Raporu</h1>
                                <p className="text-xs font-bold text-stone-700 uppercase tracking-widest">{selectedFarmer.fullName}</p>
                                {selectedFarmer.tcNo && (
                                    <p className="text-[11px] font-mono font-bold text-stone-500 mt-0.5">T.C. No: {selectedFarmer.tcNo}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold mb-1 text-stone-600">
                                    Dönem: {reportStartDate ? new Date(reportStartDate).toLocaleDateString('tr-TR') : 'Başlangıç'} - {reportEndDate ? new Date(reportEndDate).toLocaleDateString('tr-TR') : 'Güncel'}
                                </p>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">
                                    Tür: {reportType === 'DETAILED' ? 'Detaylı (Ürün İçerikli)' : 'Özet (Fatura Bilgileri)'}
                                </p>
                                {reportFieldId !== 'ALL' && (
                                    <p className="text-xs font-bold text-blue-600 mt-2 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                        Filtre: {selectedFarmer.fields.find(f => f.id === reportFieldId)?.name} Tarlası
                                    </p>
                                )}
                                {reportCrop !== 'ALL' && (
                                    <p className="text-xs font-bold text-emerald-600 mt-2 bg-emerald-50 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 border border-emerald-200">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Ürün Bazlı Cari Rapor: {reportCrop}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="relative z-10">
                            <table className="w-full mb-10">
                                <thead className="bg-stone-200 text-stone-900 uppercase text-[10px] font-black tracking-wider border-b-2 border-stone-300">
                                    <tr className="text-left">
                                        <th className="py-2.5 px-2 w-[15%]">Tarih</th>
                                        <th className="py-2.5 px-2 w-[22%]">İşlem</th>
                                        <th className="py-2.5 px-2 w-[23%]">Açıklama / Fatura No</th>
                                        <th className="py-2.5 px-2 text-right w-[20%]">Borç</th>
                                        <th className="py-2.5 px-2 text-right w-[20%]">Alacak</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportItems.map((item, idx) => {
                                        const pNo = (item as any).prescriptionNo || (item as any).receiptNo;
                                        return (
                                        <React.Fragment key={idx}>
                                            <tr className={`border-b border-stone-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}`}>
                                                <td className="py-3 px-2 text-xs font-mono font-bold text-stone-800">{new Date(item.date).toLocaleDateString('tr-TR')}</td>
                                                <td className="py-3 px-2 text-xs font-black uppercase tracking-wide text-stone-900">{item.label}</td>
                                                <td className="py-3 px-2 text-xs text-stone-800 font-medium">
                                                    {pNo ? (
                                                        <div className="flex flex-col gap-0.5 items-start">
                                                            <span className="bg-stone-900 text-white font-mono text-[10px] font-black px-2 py-0.5 rounded shadow-2xs">
                                                                Fatura No: {pNo}
                                                            </span>
                                                            {(item as any).note && !(item as any).note.includes(pNo) && (
                                                                <span className="text-stone-600 text-[11px]">{(item as any).note}</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        (item as any).note || (item.type === 'CASH' ? `Tutar: ${formatCurrency(Math.abs((item as any).amount || (item as any).totalAmount), userProfile?.currency || 'TRY')}` : '-')
                                                    )}
                                                </td>
                                                <td className="py-3 px-2 text-sm text-right font-black font-mono text-rose-700">
                                                    {item.type === 'DEBT' && ((item as any).totalAmount !== undefined ? (item as any).totalAmount >= 0 : (item as any).amount >= 0) && item.label !== 'İade Makbuzu' ? formatCurrency((item as any).amount || (item as any).totalAmount, userProfile?.currency || 'TRY') : '-'}
                                                </td>
                                                <td className="py-3 px-2 text-sm text-right font-black font-mono text-emerald-700">
                                                    {item.type === 'PAYMENT' ? formatCurrency((item as any).amount, userProfile?.currency || 'TRY') : (item.type === 'DEBT' && (((item as any).totalAmount !== undefined ? (item as any).totalAmount < 0 : (item as any).amount < 0) || item.label === 'İade Makbuzu') ? formatCurrency(Math.abs((item as any).amount || (item as any).totalAmount), userProfile?.currency || 'TRY') : '-')}
                                                </td>
                                            </tr>
                                            {reportType === 'DETAILED' && (item as any).items && (
                                                <tr>
                                                    <td colSpan={5} className="bg-stone-100/70 p-0 border-b border-stone-200">
                                                        <div className="px-6 py-2.5 ml-6 border-l-4 border-amber-500">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-stone-300/80 text-stone-900 uppercase font-black tracking-wider text-[9px] border-b border-stone-300">
                                                                    <tr>
                                                                        <th className="text-left p-1.5 w-[45%]">Ürün Adı</th>
                                                                        <th className="text-center p-1.5 w-[20%]">Miktar / Adet</th>
                                                                        <th className="text-right p-1.5 w-[15%]">B. Fiyat</th>
                                                                        <th className="text-right p-1.5 w-[20%]">Toplam</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-stone-200">
                                                                    {(item as any).items.map((subItem: any, sIdx: number) => (
                                                                        <tr key={sIdx} className={sIdx % 2 === 0 ? 'bg-white/80' : 'bg-stone-50'}>
                                                                            <td className="py-2 px-1.5 font-bold text-stone-900 text-xs">{subItem.pesticideName}</td>
                                                                            <td className="py-2 px-1.5 text-center">
                                                                                <span className="inline-block bg-amber-100 text-amber-950 font-black font-mono text-xs px-2 py-0.5 rounded border border-amber-300">
                                                                                    {subItem.quantity} {subItem.unit || 'Adet'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 px-1.5 text-right font-mono font-bold text-stone-800">{formatCurrency(subItem.unitPrice || 0, userProfile?.currency || 'TRY')}</td>
                                                                            <td className="py-2 px-1.5 text-right font-black font-mono text-stone-950">{formatCurrency((subItem.quantity || 0) * (subItem.unitPrice || 0), userProfile?.currency || 'TRY')}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className="flex justify-end pt-4 border-t-2 border-dashed border-stone-300">
                                <div className="w-80 space-y-2">
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{reportCrop !== 'ALL' ? `${reportCrop} Toplam Alış` : 'Dönem Toplam Alış'}</span>
                                        <span className="text-sm font-bold font-mono text-rose-600">{formatCurrency(reportTotalDebt, userProfile?.currency || 'TRY')}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-stone-100/50 pb-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{reportCrop !== 'ALL' ? `${reportCrop} Toplam Ödeme` : 'Dönem Toplam Ödeme'}</span>
                                        <span className="text-sm font-bold font-mono text-emerald-600">{formatCurrency(reportTotalPaid, userProfile?.currency || 'TRY')}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-xs font-black text-stone-800 uppercase tracking-wider">{reportCrop !== 'ALL' ? `${reportCrop} Kalan Bakiye` : 'Devreden Bakiye'}</span>
                                        <span className={`text-xl font-black font-mono tracking-tight ${reportBalance < 0 ? 'text-rose-600' : reportBalance > 0 ? 'text-emerald-600' : 'text-stone-800'}`}>
                                            {formatCurrency(Math.abs(reportBalance), userProfile?.currency || 'TRY')} {reportBalance < 0 ? '(B)' : reportBalance > 0 ? '(A)' : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-stone-200 flex justify-between items-end">
                                <div className="text-[9px] text-stone-400/80 font-mono leading-relaxed">
                                    Bu belge Mühendis Kayıt Sistemi<br/>
                                    tarafından oluşturulmuştur.<br/>
                                    <strong>v3.1.2</strong>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <RealisticStamp profile={userProfile} size="sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full h-3 overflow-hidden block z-10 relative -mt-[1px]">
                        <svg viewBox="0 0 1200 30" preserveAspectRatio="none" className="w-full h-full block" style={{ fill: '#fdfdfc' }}>
                            <path d="M0,0 L0,15 L15,30 L30,15 L45,30 L60,15 L75,30 L90,15 L105,30 L120,15 L135,30 L150,15 L165,30 L180,15 L195,30 L210,15 L225,30 L240,15 L255,30 L270,15 L285,30 L300,15 L315,30 L330,15 L345,30 L360,15 L375,30 L390,15 L405,30 L420,15 L435,30 L450,15 L465,30 L480,15 L495,30 L510,15 L525,30 L540,15 L555,30 L570,15 L585,30 L600,15 L615,30 L630,15 L645,30 L660,15 L675,30 L690,15 L705,30 L720,15 L735,30 L750,15 L765,30 L780,15 L795,30 L810,15 L825,30 L840,15 L855,30 L870,15 L885,30 L900,15 L915,30 L930,15 L945,30 L960,15 L975,30 L990,15 L1005,30 L1020,15 L1035,30 L1050,15 L1065,30 L1080,15 L1095,30 L1110,15 L1125,30 L1140,15 L1155,30 L1170,15 L1185,30 L1200,15 L1200,0 Z"></path>
                        </svg>
                    </div>
                </div>
            </div>

            <div className="max-w-sm mx-auto flex gap-2 mt-4 px-4">
                <button 
                    onClick={() => onPdfAction('SHARE')} 
                    disabled={isGeneratingReport} 
                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-xl shadow-blue-900/30 hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                >
                    {isGeneratingReport ? <Loader2 size={16} className="animate-spin mr-2"/> : <Share2 size={16} className="mr-2"/>} 
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
                    disabled={isGeneratingReport} 
                    className="px-4 py-3 rounded-xl bg-stone-800 text-stone-200 font-bold border border-white/10 hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                >
                    {isGeneratingReport ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} 
                </button>
            </div>
        </div>
    );
});

FarmerStatementReportView.displayName = 'FarmerStatementReportView';
