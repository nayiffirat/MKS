import React, { useEffect, useState } from 'react';
import { Farmer, Prescription, VisitLog, UserProfile, Payment, ManualDebt } from '../types';
import { dbService } from '../services/db';
import {
    Loader2,
    Phone,
    MapPin,
    FileText,
    Calendar,
    MessageCircle,
    ArrowLeft,
    User,
    Wheat,
    ChevronDown,
    ChevronUp,
    Wallet,
    Copy,
    Check,
    Camera,
    Send,
    Building2,
    CheckCircle2,
    Sprout,
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { toTelHref } from '../utils/whatsappTemplates';
import { MksBrandLogo } from './MksBrandLogo';
import { computeFarmerLedgerTotals, getIndependentFarmerMyPayments } from '../utils/ledger';

interface ProducerPortalProps {
    farmerId: string;
    engineerId?: string;
    portalToken?: string;
    onBack?: () => void;
}

/** Compresses a farmer-uploaded field photo to a safe <= 400KB JPEG Data URL for Firestore inquiry delivery */
async function compressPhotoForInquiry(file: File): Promise<string> {
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

    return new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
            const maxDim = 960;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w >= h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(rawDataUrl);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
    });
}

export const ProducerPortal: React.FC<ProducerPortalProps> = ({
    farmerId,
    engineerId,
    portalToken,
    onBack,
}) => {
    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [visits, setVisits] = useState<VisitLog[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [manualDebts, setManualDebts] = useState<ManualDebt[]>([]);
    const [engineerProfile, setEngineerProfile] = useState<
        (UserProfile & { bankAccounts?: { name: string; iban: string; accountHolder?: string }[] }) | null
    >(null);
    const [resolvedToken, setResolvedToken] = useState<string>(portalToken || '');
    const [resolvedEngineerId, setResolvedEngineerId] = useState<string>(engineerId || '');
    const [loading, setLoading] = useState(true);
    const [expandedPrescriptionId, setExpandedPrescriptionId] = useState<string | null>(null);
    const [copiedIban, setCopiedIban] = useState<string | null>(null);

    // #35 Mühendise Fotoğraf / Soru Gönder
    const [questionText, setQuestionText] = useState('');
    const [questionPhoto, setQuestionPhoto] = useState<string | null>(null);
    const [isSendingQuestion, setIsSendingQuestion] = useState(false);
    const [questionSentSuccess, setQuestionSentSuccess] = useState(false);

    // #38 Ödeme Yaptım Bildirimi
    const [paymentNoticeAmount, setPaymentNoticeAmount] = useState('');
    const [paymentNoticeIban, setPaymentNoticeIban] = useState('');
    const [paymentNoticeNote, setPaymentNoticeNote] = useState('');
    const [isSendingPaymentNotice, setIsSendingPaymentNotice] = useState(false);
    const [paymentNoticeSentSuccess, setPaymentNoticeSentSuccess] = useState(false);

    useEffect(() => {
        const loadPortalData = async () => {
            setLoading(true);
            try {
                if (portalToken || engineerId) {
                    const data = await dbService.getFarmerPortalData(
                        engineerId || '',
                        farmerId,
                        portalToken
                    );
                    if (data) {
                        setFarmer(data.farmer);
                        setPrescriptions(
                            data.prescriptions.sort(
                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                            )
                        );
                        setVisits(
                            data.visits.sort(
                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                            )
                        );
                        setPayments(data.payments || []);
                        setManualDebts(data.manualDebts || []);
                        if (data.profile) setEngineerProfile(data.profile as any);
                        if ((data as any).portalToken) setResolvedToken((data as any).portalToken);
                        if ((data as any).engineerId) setResolvedEngineerId((data as any).engineerId);
                    }
                } else {
                    const farmers = await dbService.getFarmers();
                    const targetFarmer = farmers.find((f) => f.id === farmerId && !f.deletedAt);

                    if (targetFarmer) {
                        setFarmer(targetFarmer);
                        setResolvedToken(targetFarmer.portalToken || 'local-preview');
                        setResolvedEngineerId(dbService.getCurrentUserId() || '');
                        const [pList, vList, payList, debtList, myPayList, accList] = await Promise.all([
                            dbService.getPrescriptionsByFarmer(farmerId),
                            dbService.getVisitsByFarmer(farmerId),
                            dbService.getPayments(),
                            dbService.getManualDebts(),
                            dbService.getMyPayments(),
                            dbService.getAccounts(),
                        ]);
                        const independentMyPays = getIndependentFarmerMyPayments(myPayList, farmerId);
                        setPrescriptions(
                            pList
                                .filter((p) => !p.deletedAt)
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        );
                        setVisits(
                            vList
                                .filter((v) => !v.deletedAt)
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        );
                        setPayments([
                            ...payList.filter((p) => p.farmerId === farmerId && !p.deletedAt),
                            ...independentMyPays,
                        ]);
                        setManualDebts(
                            debtList.filter(
                                (d) =>
                                    d.farmerId === farmerId &&
                                    !d.deletedAt &&
                                    !d.id.startsWith('turnover-')
                            )
                        );

                        try {
                            const uid = dbService.getCurrentUserId();
                            const profileStr =
                                (uid && localStorage.getItem(`mks_user_profile_${uid}`)) ||
                                localStorage.getItem('mks_user_profile');
                            const parsedProf = profileStr ? JSON.parse(profileStr) : {};
                            const bankAccounts = accList
                                .filter((a) => !a.deletedAt && a.type === 'BANK' && a.iban)
                                .map((a) => ({
                                    name: a.name,
                                    iban: a.iban!,
                                    accountHolder: a.accountHolder || parsedProf?.fullName,
                                }));
                            setEngineerProfile({ ...parsedProf, bankAccounts });
                        } catch {
                            // ignore
                        }
                    }
                }
            } catch (error) {
                console.error('Portal load error:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPortalData();
    }, [farmerId, engineerId, portalToken]);

    const { totalDebt, totalPaid, netDebt: currentBalance } = computeFarmerLedgerTotals({
        prescriptions,
        manualDebts,
        payments,
    });
    const currency = engineerProfile?.currency || 'TRY';
    const bankAccounts = engineerProfile?.bankAccounts || [];

    const handleCopyIban = (iban: string) => {
        navigator.clipboard?.writeText(iban).catch(() => {});
        setCopiedIban(iban);
        setPaymentNoticeIban(iban);
        setTimeout(() => setCopiedIban(null), 2500);
    };

    const handleSendQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!farmer || (!questionText.trim() && !questionPhoto)) return;
        setIsSendingQuestion(true);
        try {
            await dbService.submitPortalInquiry({
                portalToken: resolvedToken || portalToken || 'portal',
                engineerId: resolvedEngineerId || engineerId || '',
                farmerId: farmer.id,
                farmerName: farmer.fullName,
                type: 'QUESTION',
                message: questionText.trim() || 'Tarladan fotoğraf gönderildi.',
                photoBase64: questionPhoto || undefined,
            });
            setQuestionSentSuccess(true);
            setQuestionText('');
            setQuestionPhoto(null);
            setTimeout(() => setQuestionSentSuccess(false), 5000);
        } catch (err) {
            console.error('Soru gönderilemedi:', err);
            alert('Mesaj gönderilirken bağlantı hatası oluştu. Lütfen tekrar deneyin.');
        } finally {
            setIsSendingQuestion(false);
        }
    };

    const handleSendPaymentNotice = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(paymentNoticeAmount.replace(',', '.'));
        if (!farmer || isNaN(amt) || amt <= 0) return;
        setIsSendingPaymentNotice(true);
        try {
            await dbService.submitPortalInquiry({
                portalToken: resolvedToken || portalToken || 'portal',
                engineerId: resolvedEngineerId || engineerId || '',
                farmerId: farmer.id,
                farmerName: farmer.fullName,
                type: 'PAYMENT_NOTICE',
                paymentAmount: amt,
                claimedAmount: amt,
                ibanUsed: paymentNoticeIban || undefined,
                message:
                    paymentNoticeNote.trim() ||
                    `${formatCurrency(amt, currency)} tutarında havale/EFT ödeme bildirimi.`,
            });
            setPaymentNoticeSentSuccess(true);
            setPaymentNoticeAmount('');
            setPaymentNoticeNote('');
            setTimeout(() => setPaymentNoticeSentSuccess(false), 5000);
        } catch (err) {
            console.error('Ödeme bildirimi gönderilemedi:', err);
            alert('Ödeme bildirimi gönderilemedi. Lütfen internet bağlantınızı kontrol edin.');
        } finally {
            setIsSendingPaymentNotice(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-dvh bg-stone-950 flex flex-col items-center justify-center p-6">
                <Loader2 size={40} className="animate-spin text-emerald-500 mb-4" />
                <p className="text-stone-400 font-medium">Üretici Portalı Yükleniyor...</p>
            </div>
        );
    }

    if (!farmer) {
        return (
            <div className="min-h-dvh bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <User size={40} className="text-stone-600" />
                </div>
                <h2 className="text-xl font-bold text-stone-100 mb-2">Üretici Bulunamadı</h2>
                <p className="text-stone-500 text-sm mb-6 max-w-sm">
                    Portal bağlantısı eksik veya güncellenmiş olabilir. Lütfen danışman mühendisinizden yeni portal bağlantısı isteyin.
                </p>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-stone-800 text-stone-300 rounded-xl font-bold flex items-center gap-2"
                    >
                        <ArrowLeft size={18} /> Geri Dön
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-stone-950 text-stone-200 pb-24">
            {/* Header / Engineer Info */}
            <div className="bg-stone-900/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-4 sticky top-0 z-30">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-white border border-white/10"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <MksBrandLogo size="lg" rounded="2xl" className="border-emerald-500/30 shadow-lg" />
                        <div className="min-w-0">
                            <h1 className="text-base font-black text-stone-100 truncate">
                                {engineerProfile?.fullName || 'Ziraat Mühendisi'}
                            </h1>
                            <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-widest truncate">
                                {engineerProfile?.companyName || 'MKS Dijital Tarım Danışmanlığı'}
                            </p>
                        </div>
                    </div>
                    {toTelHref(engineerProfile?.phoneNumber) && (
                        <a
                            href={toTelHref(engineerProfile?.phoneNumber)}
                            aria-label="Mühendisi Ara"
                            className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
                        >
                            <Phone size={15} />
                            <span className="hidden sm:inline">Mühendisi Ara</span>
                        </a>
                    )}
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
                {/* Farmer Welcome & Balance Summary */}
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-700 via-emerald-800 to-stone-900 p-6 sm:p-8 border border-emerald-500/30 shadow-2xl">
                    <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                        <Wheat size={110} />
                    </div>
                    <div className="relative z-10">
                        <span className="text-emerald-200 text-[11px] font-black uppercase tracking-[0.25em] mb-1.5 block">
                            Kişisel Üretici Portalı
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black text-white">
                            {farmer.fullName}
                        </h2>
                        <div className="flex items-center text-emerald-100/80 text-xs font-semibold mt-1 mb-5">
                            <MapPin size={13} className="mr-1" /> {farmer.village || 'Kayıtlı Üretici'}
                        </div>

                        <div className="bg-stone-950/55 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/15 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-emerald-100/80 text-xs font-bold uppercase tracking-wider">
                                    Güncel Net Cari Bakiye
                                </span>
                                <Wallet size={16} className="text-emerald-300" />
                            </div>
                            <div className="text-3xl font-black font-mono text-white tracking-tight">
                                {formatCurrency(Math.abs(currentBalance), currency)}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-white/10">
                                <span className="font-bold text-emerald-200">
                                    {currentBalance > 0
                                        ? 'Ödenmesi Gereken Borç Bakiyesi'
                                        : currentBalance < 0
                                        ? 'Alacaklı Durumdasınız'
                                        : 'Cari Borcunuz Bulunmuyor'}
                                </span>
                                <span className="text-[11px] text-stone-300 font-mono">
                                    Alım: {formatCurrency(totalDebt, currency)} • Ödenen:{' '}
                                    {formatCurrency(totalPaid, currency)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* #34: Kayıtlı Tarlalar & Ekim Bilgileri */}
                {farmer.fields && farmer.fields.length > 0 && (
                    <section className="bg-stone-900/60 rounded-3xl p-5 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <Sprout size={15} /> Kayıtlı Tarlalarınız & Ürünler ({farmer.fields.length})
                            </h3>
                            <span className="text-xs font-mono font-bold text-stone-400">
                                Toplam:{' '}
                                {farmer.fields.reduce((acc, f) => acc + (Number(f.size) || 0), 0)} daa
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {farmer.fields.map((fld, idx) => (
                                <div
                                    key={fld.id || idx}
                                    className="bg-stone-950/70 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between gap-2"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-white truncate">
                                            {fld.name || `Tarla ${idx + 1}`}
                                        </p>
                                        <p className="text-[11px] text-emerald-400 font-bold truncate">
                                            {fld.crop || 'Ürün Belirtilmedi'}
                                        </p>
                                        {(fld.mahalle || fld.ada || fld.parsel) && (
                                            <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                                                {[
                                                    fld.mahalle,
                                                    fld.ada ? `Ada ${fld.ada}` : '',
                                                    fld.parsel ? `Parsel ${fld.parsel}` : '',
                                                ]
                                                    .filter(Boolean)
                                                    .join(' • ')}
                                            </p>
                                        )}
                                    </div>
                                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono font-black text-xs shrink-0">
                                        {fld.size} daa
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* #38: Banka IBAN Bilgileri ve "Ödeme Yaptım" Bildirimi */}
                <section className="bg-stone-900/60 rounded-3xl p-5 border border-white/10 space-y-4">
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-sky-400" />
                        <h3 className="text-xs font-black text-sky-400 uppercase tracking-widest">
                            Banka IBAN & Ödeme Bildirimi
                        </h3>
                    </div>

                    {bankAccounts.length > 0 && (
                        <div className="space-y-2">
                            {bankAccounts.map((acc, i) => (
                                <div
                                    key={i}
                                    className="bg-stone-950/80 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-white">{acc.name}</p>
                                        {acc.accountHolder && (
                                            <p className="text-[11px] text-stone-400">{acc.accountHolder}</p>
                                        )}
                                        <p className="text-xs font-mono text-sky-300 mt-1 break-all">
                                            {acc.iban}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyIban(acc.iban)}
                                        className="px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-black flex items-center gap-1.5 shrink-0"
                                    >
                                        {copiedIban === acc.iban ? (
                                            <>
                                                <Check size={13} /> Kopyalandı
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={13} /> IBAN Kopyala
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleSendPaymentNotice} className="space-y-2.5 pt-1">
                        <p className="text-[11px] text-stone-400">
                            Havale / EFT yaptığınızda aşağıdan tutarı yazıp mühendisinize tek dokunuşla bildirebilirsiniz:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                                type="number"
                                step="0.01"
                                min="1"
                                required
                                value={paymentNoticeAmount}
                                onChange={(e) => setPaymentNoticeAmount(e.target.value)}
                                placeholder="Gönderilen Tutar (TL)"
                                className="w-full bg-stone-950 border border-stone-800 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none"
                            />
                            <input
                                type="text"
                                value={paymentNoticeNote}
                                onChange={(e) => setPaymentNoticeNote(e.target.value)}
                                placeholder="Açıklama (Örn: Ziraat Bankası EFT)"
                                className="w-full bg-stone-950 border border-stone-800 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSendingPaymentNotice}
                            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                        >
                            {isSendingPaymentNotice ? (
                                <Loader2 size={15} className="animate-spin" />
                            ) : (
                                <CheckCircle2 size={15} />
                            )}
                            <span>Ödeme Yaptım Bildir</span>
                        </button>
                        {paymentNoticeSentSuccess && (
                            <p className="text-xs font-bold text-emerald-400 text-center pt-1">
                                Ödeme bildiriminiz danışman mühendisinize iletildi.
                            </p>
                        )}
                    </form>
                </section>

                {/* #35: Mühendise Tarladan Fotoğraf / Soru Gönder */}
                <section className="bg-stone-900/60 rounded-3xl p-5 border border-white/10 space-y-3">
                    <div className="flex items-center gap-2">
                        <Camera size={16} className="text-emerald-400" />
                        <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                            Mühendise Tarladan Fotoğraf / Soru Gönder
                        </h3>
                    </div>

                    <form onSubmit={handleSendQuestion} className="space-y-3">
                        <textarea
                            rows={3}
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="Yaprakta gördüğünüz belirtiyi, zararlıyı veya danışmak istediğiniz konuyu yazın..."
                            className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 rounded-2xl p-3.5 text-xs text-white outline-none resize-none"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-white/10 text-xs font-bold cursor-pointer flex items-center gap-2">
                                <Camera size={15} className="text-emerald-400" />
                                <span>{questionPhoto ? 'Fotoğraf Değiştir' : 'Bitki / Tarla Fotoğrafı Ekle'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const compressed = await compressPhotoForInquiry(file);
                                        setQuestionPhoto(compressed);
                                    }}
                                />
                            </label>

                            <button
                                type="submit"
                                disabled={isSendingQuestion || (!questionText.trim() && !questionPhoto)}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5"
                            >
                                {isSendingQuestion ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Send size={14} />
                                )}
                                <span>Mühendise Gönder</span>
                            </button>
                        </div>

                        {questionPhoto && (
                            <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-emerald-500/40">
                                <img src={questionPhoto} alt="Önizleme" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setQuestionPhoto(null)}
                                    className="absolute top-1 right-1 bg-black/75 text-white text-[11px] px-1.5 py-0.5 rounded-md"
                                >
                                    Sil
                                </button>
                            </div>
                        )}

                        {questionSentSuccess && (
                            <p className="text-xs font-bold text-emerald-400">
                                Sorunuz ve fotoğrafınız mühendisinize başarıyla iletildi!
                            </p>
                        )}
                    </form>
                </section>

                {/* Reçete ve Uygulama Arşivi (Maliyet/Alış Fiyatı Kesinlikle Gizli) */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-stone-400 font-black text-[11px] uppercase tracking-widest">
                            Reçete & Ürün Geçmişiniz
                        </h3>
                        <span className="text-[11px] text-stone-500 font-mono font-bold">
                            {prescriptions.length} Kayıt
                        </span>
                    </div>
                    <div className="space-y-2.5">
                        {prescriptions.length > 0 ? (
                            prescriptions.map((p) => {
                                const isExpanded = expandedPrescriptionId === p.id;
                                return (
                                    <div
                                        key={p.id}
                                        className="bg-stone-900/50 rounded-2xl border border-white/10 overflow-hidden"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedPrescriptionId(isExpanded ? null : p.id)
                                            }
                                            className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-900/80 transition-colors"
                                        >
                                            <div className="flex items-center gap-3.5">
                                                <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center text-emerald-400 border border-white/5">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-stone-100 text-sm">
                                                        {p.prescriptionNo}
                                                    </h4>
                                                    <div className="flex items-center text-[11px] text-stone-400 mt-0.5">
                                                        <Calendar size={11} className="mr-1" />
                                                        {new Date(p.date).toLocaleDateString('tr-TR', {
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric',
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {p.totalAmount !== undefined && (
                                                    <span className="font-mono font-black text-sm text-emerald-400">
                                                        {formatCurrency(p.totalAmount, currency)}
                                                    </span>
                                                )}
                                                {isExpanded ? (
                                                    <ChevronUp size={18} className="text-stone-400" />
                                                ) : (
                                                    <ChevronDown size={18} className="text-stone-400" />
                                                )}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-2 bg-stone-950/40">
                                                {(p.items || []).map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-stone-200">
                                                                {item.pesticideName}
                                                            </p>
                                                            <p className="text-[11px] text-stone-400">
                                                                Doz: {item.dosage || '-'}
                                                                {item.quantity ? ` • Adet: ${item.quantity}` : ''}
                                                            </p>
                                                        </div>
                                                        {item.totalPrice !== undefined && (
                                                            <span className="font-mono font-bold text-stone-200">
                                                                {formatCurrency(item.totalPrice, currency)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 bg-stone-900/30 rounded-3xl border border-dashed border-stone-800">
                                <p className="text-stone-500 text-xs">
                                    Henüz reçete veya ürün kaydınız bulunmuyor.
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Saha Ziyaret Notları */}
                <section className="space-y-3">
                    <h3 className="text-stone-400 font-black text-[11px] uppercase tracking-widest px-1">
                        Mühendis Saha Ziyaret Notları
                    </h3>
                    <div className="bg-stone-900/50 rounded-3xl p-5 border border-white/10 space-y-3">
                        {visits.length > 0 ? (
                            visits.slice(0, 5).map((v) => (
                                <div
                                    key={v.id}
                                    className="p-3.5 rounded-2xl bg-stone-950/60 border border-white/5 space-y-1.5"
                                >
                                    <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                                        <span className="flex items-center gap-1.5">
                                            <MessageCircle size={13} /> Saha Kontrol Notu
                                        </span>
                                        <span className="font-mono text-stone-400">
                                            {new Date(v.date).toLocaleDateString('tr-TR')}
                                        </span>
                                    </div>
                                    <p className="text-stone-200 text-xs leading-relaxed">
                                        {v.note || 'Arazi kontrolü tamamlandı.'}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-stone-500 text-xs text-center py-3 italic">
                                Mühendisiniz henüz özel bir saha notu eklemedi.
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
