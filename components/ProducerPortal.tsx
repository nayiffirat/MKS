
import React, { useEffect, useState } from 'react';
import { Farmer, Prescription, VisitLog, UserProfile, Payment, ManualDebt } from '../types';
import { dbService } from '../services/db';
import { Loader2, Phone, MapPin, FileText, Calendar, MessageCircle, ArrowLeft, ExternalLink, User, Wheat, ChevronRight, Wallet, CreditCard, TrendingDown } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';

interface ProducerPortalProps {
    farmerId: string;
    engineerId?: string;
    onBack?: () => void;
}

export const ProducerPortal: React.FC<ProducerPortalProps> = ({ farmerId, engineerId, onBack }) => {
    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [visits, setVisits] = useState<VisitLog[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [manualDebts, setManualDebts] = useState<ManualDebt[]>([]);
    const [engineerProfile, setEngineerProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPortalData = async () => {
            setLoading(true);
            try {
                // 1. Eğer engineerId varsa Firestore'dan çek (Farmer kendi telefonundan bakıyor)
                if (engineerId) {
                    const data = await dbService.getFarmerPortalData(engineerId, farmerId);
                    if (data) {
                        setFarmer(data.farmer);
                        setPrescriptions(data.prescriptions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                        setVisits(data.visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                        setPayments(data.payments || []);
                        setManualDebts(data.manualDebts || []);
                        if (data.profile) setEngineerProfile(data.profile);
                    }
                } else {
                    // 2. Yoksa yerel DB'den çek (Mühendis kendi telefonundan bakıyor)
                    const farmers = await dbService.getFarmers();
                    const targetFarmer = farmers.find(f => f.id === farmerId && !f.deletedAt);
                    
                    if (targetFarmer) {
                        setFarmer(targetFarmer);
                        const [pList, vList, payList, debtList] = await Promise.all([
                            dbService.getPrescriptionsByFarmer(farmerId),
                            dbService.getVisitsByFarmer(farmerId),
                            dbService.getPayments(),
                            dbService.getManualDebts()
                        ]);
                        setPrescriptions(pList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                        setVisits(vList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                        setPayments(payList.filter(p => p.farmerId === farmerId));
                        setManualDebts(debtList.filter(d => d.farmerId === farmerId));
                        
                        // Try to get engineer profile
                        try {
                            const profileStr = localStorage.getItem('mks_user_profile');
                            if (profileStr) {
                                setEngineerProfile(JSON.parse(profileStr));
                            }
                        } catch (e) {
                            console.warn("localStorage access denied", e);
                        }
                    }
                }
            } catch (error) {
                console.error("Portal load error:", error);
            } finally {
                setLoading(false);
            }
        };

        loadPortalData();
    }, [farmerId, engineerId]);

    const totalPrescriptionDebt = prescriptions.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const totalManualDebt = manualDebts.reduce((acc, d) => acc + d.amount, 0);
    const totalDebt = totalPrescriptionDebt + totalManualDebt;
    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    const currentBalance = totalDebt - totalPaid;
    const currency = engineerProfile?.currency || 'TRY';

    if (loading) {
        return (
            <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6">
                <Loader2 size={40} className="animate-spin text-emerald-500 mb-4" />
                <p className="text-stone-400 font-medium">Portal Yükleniyor...</p>
            </div>
        );
    }

    if (!farmer) {
        return (
            <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <User size={40} className="text-stone-600" />
                </div>
                <h2 className="text-xl font-bold text-stone-100 mb-2">Üretici Bulunamadı</h2>
                <p className="text-stone-500 text-sm mb-4">
                    {!engineerId 
                        ? "Portal linki eksik veya hatalı kopyalanmış olabilir. Lütfen linkin tamamına tıkladığınızdan emin olun."
                        : "Lütfen bağlantıyı kontrol edin veya mühendisinizle iletişime geçin."}
                </p>
                <div className="bg-stone-900/50 p-4 rounded-2xl border border-white/5 max-w-xs mb-8">
                    <p className="text-[10px] text-stone-600 italic">
                        iOS/Safari kullanıyorsanız ve "security cookie" hatası alıyorsanız, lütfen Ayarlar &gt; Safari &gt; "Siteler Arası Takibi Engelle" seçeneğini kapatıp sayfayı yenileyin.
                    </p>
                </div>
                {onBack && (
                    <button onClick={onBack} className="px-6 py-3 bg-stone-800 text-stone-300 rounded-xl font-bold flex items-center gap-2">
                        <ArrowLeft size={18} /> Geri Dön
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-950 text-stone-200 pb-20">
            {/* Header / Engineer Info */}
            <div className="bg-stone-900/50 backdrop-blur-xl border-b border-white/5 p-6 sticky top-0 z-30">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-900/20">
                            {engineerProfile?.fullName?.charAt(0) || 'M'}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-stone-100">{engineerProfile?.fullName || 'Ziraat Mühendisi'}</h1>
                            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{engineerProfile?.companyName || 'MKS Dijital Tarım'}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {engineerProfile?.phoneNumber && (
                            <a href={`tel:${engineerProfile.phoneNumber}`} className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center text-emerald-400 border border-white/5 active:scale-90 transition-all">
                                <Phone size={18} />
                            </a>
                        )}
                        <button className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center text-stone-400 border border-white/5 active:scale-90 transition-all">
                            <ExternalLink size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-6 space-y-8">
                {/* Farmer Welcome */}
                <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 to-emerald-900 p-8 shadow-2xl shadow-emerald-900/20">
                    <div className="absolute top-0 right-0 p-8 opacity-10"><Wheat size={120} /></div>
                    <div className="relative z-10">
                        <span className="text-emerald-200 text-[10px] font-black uppercase tracking-[0.3em] mb-2 block">Üretici Portalı</span>
                        <h2 className="text-3xl font-black text-white mb-2">Hoş Geldiniz,<br/>{farmer.fullName}</h2>
                        <div className="flex items-center text-emerald-100/70 text-sm font-medium mb-6">
                            <MapPin size={14} className="mr-1.5" /> {farmer.village}
                        </div>
                        
                        {/* Financial Summary */}
                        <div className="bg-black/20 backdrop-blur-md rounded-2xl p-5 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-emerald-100/70 text-xs font-bold uppercase tracking-wider">Güncel Bakiye</span>
                                <Wallet size={16} className="text-emerald-300" />
                            </div>
                            <div className="text-3xl font-black text-white tracking-tight">
                                {formatCurrency(Math.abs(currentBalance), currency)}
                            </div>
                            <div className="text-emerald-200/70 text-xs font-medium mt-1">
                                {currentBalance > 0 ? 'Ödenmesi Gereken Tutar' : currentBalance < 0 ? 'Alacaklı Durumdasınız' : 'Borcunuz Bulunmuyor'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Prescriptions */}
                <section>
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-stone-400 font-black text-[10px] uppercase tracking-[0.2em]">Son İşlemleriniz</h3>
                        <span className="text-[10px] text-stone-600 font-bold">{prescriptions.length} Kayıt</span>
                    </div>
                    <div className="space-y-3">
                        {prescriptions.length > 0 ? (
                            prescriptions.slice(0, 3).map(p => (
                                <div key={p.id} className="bg-stone-900/40 rounded-3xl p-5 border border-white/5 flex items-center justify-between group hover:bg-stone-900/60 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center text-emerald-500 border border-white/5">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-stone-200 text-sm">{p.prescriptionNo}</h4>
                                            <div className="flex items-center text-[10px] text-stone-500 mt-1 font-medium">
                                                <Calendar size={10} className="mr-1" />
                                                {new Date(p.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-stone-500 group-hover:text-emerald-400 transition-colors">
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 bg-stone-900/20 rounded-3xl border border-dashed border-stone-800">
                                <p className="text-stone-600 text-xs">Henüz fatura kaydınız bulunmuyor.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Engineer Advice / Notes */}
                <section>
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-stone-400 font-black text-[10px] uppercase tracking-[0.2em]">Güncel Tavsiyeler</h3>
                    </div>
                    <div className="bg-stone-900/40 rounded-[2rem] p-6 border border-white/5">
                        {visits.length > 0 && visits[0].note ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                    <MessageCircle size={16} />
                                    <span className="text-xs font-bold">Son Reçete Notu</span>
                                </div>
                                <p className="text-stone-300 text-sm leading-relaxed italic">"{visits[0].note}"</p>
                                <div className="text-[10px] text-stone-600 font-bold text-right">
                                    {new Date(visits[0].date).toLocaleDateString('tr-TR')}
                                </div>
                            </div>
                        ) : (
                            <p className="text-stone-500 text-xs text-center py-4 italic">Mühendisiniz henüz özel bir not bırakmadı.</p>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
};
