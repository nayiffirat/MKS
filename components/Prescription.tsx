import { createMultiPagePdf, renderElementToCanvas } from '../utils/pdfHelper';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../services/db';
import { Farmer, Pesticide, Prescription, PrescriptionTemplate, PesticideCategory, VisitLog, AppNotification, PrescriptionItem, MinistryRecord, InventoryItem } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { safeStringify } from '../utils/json';
import { Check, Plus, Trash2, FileOutput, Share2, FileText, Calendar, MapPin, X, User, Loader2, Search, FlaskConical, MessageCircle, Edit2, AlertCircle, ArrowLeft, Printer, Package, Download, MessageSquare, RefreshCw, AlertTriangle, Camera, Barcode, TrendingUp, Star, Lightbulb, ChevronRight, CreditCard, Wallet, Landmark, Sprout, Wheat, Sparkles, Mic, ShieldCheck, Droplets, Pause, Play, Bookmark, Save } from 'lucide-react';
import { renderWhatsAppTemplate, normalizeWaPhone } from '../utils/whatsappTemplates';
import LazyBarcodeScanner from './LazyBarcodeScanner';
import { format } from 'date-fns';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';
import { ListSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { turkishMatchesAny, normalizeTurkish } from '../utils/search';
import { checkTankMixCompatibility, parseGS1Barcode, itemMatchesScan, scanKey } from '../utils/gs1Parser';
import type { GS1ParseResult } from '../utils/gs1Parser';
import { playScanBeep, playErrorBeep } from '../utils/hardwareBarcodeScanner';
import { saveMinistryRecords, nextDocumentNumber, loadMinistryRecords } from '../utils/ministryStore';
import { daysUntilExpiry, isExpiredDate, normalizeGtin, round2 } from '../utils/dateUtils';
import { generateUUID } from '../utils/uuid';
import { validateTcOrVkn } from '../utils/tcNoValidator';
import { useBackHandler } from '../utils/navigationManager';
import { PrescriptionProfitModal } from './prescription/PrescriptionProfitModal';
import { PrescriptionReceiptView } from './prescription/PrescriptionReceiptView';
import { CropSelectorStep } from './prescription/CropSelectorStep';
import { PrescriptionCollectionModal, PrescriptionReportRangeModal } from './prescription/PrescriptionCollectionModal';

const HELD_CART_KEY = 'mks_held_prescription_cart';
const HOLDER_TANKS = [400, 600, 1000, 2000];

const POPULAR_CROPS = [
  'Pamuk', 'Buğday', 'Mısır', 'Ayçiçeği', 'Domates', 'Biber', 'Patlıcan', 
  'Hıyar (Salatalık)', 'Karpuz', 'Kavun', 'Üzüm (Bağ)', 'Zeytin', 'Fındık', 
  'Arpa', 'Çeltik (Pirinç)', 'Patates', 'Soğan', 'Sarımsak', 'Şeker Pancarı', 
  'Yonca', 'Ceviz', 'Badem', 'Narenciye', 'Elma', 'Kiraz', 'Çilek', 
  'Kayısı', 'Şeftali', 'Antep Fıstığı', 'Nohut', 'Mercimek', 'Fasulye', 'Soya', 'Kanola'
];

// Sepet satırı: ürün + karekoddan gelen BKTS/GTS izlenebilirlik verisi (GTIN, Lot, SKT, Seri No).
type CartBatchAllocation = NonNullable<PrescriptionItem['batchAllocations']>[number];
interface CartItem {
    pesticide: Pesticide;
    dosage: string;
    quantity: string;
    unitPrice?: string;
    totalPrice?: number;
    buyingPrice?: number;
    gtin?: string;
    lotNumber?: string;
    expiryDate?: string;
    serialNumbers?: string[];
    batchAllocations?: CartBatchAllocation[];
    /** Serbest satışta SKT geçmiş ürün için kullanıcı onayı + gerekçe. */
    expiredSaleReason?: string;
}

interface ScanTrace {
    gtin?: string;
    lotNumber?: string;
    expiryDate?: string;
    serial?: string;
}

/** Aynı kutunun (GTIN + Seri) tekilliği için anahtar. */
const serialKey = (gtin: string | undefined, serial: string) => `${normalizeGtin(gtin || '')}|${serial.trim()}`;

const parseQty = (value?: string | number | null): number => {
    const n = parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
};

/** Barkod/GTIN/ham GS1 metninden 14 haneli GTIN üretir (B-05/B-29); sayısal değilse undefined. */
const toGtin14 = (code?: string | null): string | undefined => {
    const raw = String(code ?? '').trim();
    if (!raw) return undefined;
    let g = normalizeGtin(raw);
    if (!/^\d{14}$/.test(g) && raw.length > 14) {
        const legacy = parseGS1Barcode(raw);
        g = legacy.gtin ? normalizeGtin(legacy.gtin) : '';
    }
    return /^\d{14}$/.test(g) ? g : undefined;
};

/** Çok adımlı kaydın hangi adımlarının tamamlandığı (B-13 / AK-16: tekrar denemede tekrarlanmaz). */
interface SaveProgress {
    key: string;
    signature: string;
    steps: Set<string>;
    prescription?: Prescription;
    original?: Prescription;
}
const emptySaveProgress = (): SaveProgress => ({ key: '', signature: '', steps: new Set() });

interface PrescriptionFormProps {
    onBack: () => void;
    initialFarmerId?: string;
    initialPrescriptionId?: string;
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ onBack, initialFarmerId, initialPrescriptionId }) => {
    const { 
        userProfile, 
        refreshStats, 
        updateUserProfile,
        prescriptions: contextPrescriptions,
        togglePrescriptionStatus,
        softDeletePrescription,
        farmers: contextFarmers,
        inventory: contextInventory,
        plants: contextPlants,
        showToast,
        hapticFeedback,
        activeTeamMember,
        teamMembers,
        t,
        accounts,
        addTransaction,
        deleteTransaction,
        transactions,
        payments,
        manualDebts,
        myPayments,
        addPayment,
        updatePayment,
        deletePayment
    } = useAppViewModel();
    const isSales = activeTeamMember?.role === 'SALES';
    const hideCostAndProfit = Boolean(userProfile?.hideCostAndProfit || (isSales && userProfile?.hideBuyingPricesForStaff));

    const getFarmerNetDebt = (farmerId: string): number => {
        if (!farmerId) return 0;
        const prescDebt = contextPrescriptions
            .filter(p => !p.deletedAt && p.farmerId === farmerId && p.isProcessed !== false && p.priceType !== 'CASH')
            .reduce((acc, p) => {
                const amt = Number(p.totalAmount) || 0;
                const isRet = p.type === 'RETURN' || amt < 0;
                return acc + (isRet ? -Math.abs(amt) : Math.abs(amt));
            }, 0);
        const manDebt = (manualDebts || [])
            .filter(d => !d.deletedAt && d.farmerId === farmerId && !d.id.startsWith('turnover-'))
            .reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
        const paidCash = (payments || [])
            .filter(p => !p.deletedAt && p.farmerId === farmerId)
            .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const paidCheck = (myPayments || [])
            .filter(mp => !mp.deletedAt && mp.farmerId === farmerId && mp.status !== 'CANCELLED' && !mp.relatedId)
            .reduce((acc, mp) => acc + (Number(mp.amount) || 0), 0);
        return Math.round((prescDebt + manDebt - paidCash - paidCheck) * 100) / 100;
    };

    const formatSignedBalanceLabel = (netDebt: number) => {
        const cur = userProfile?.currency || 'TRY';
        if (Math.abs(netDebt) < 0.01) return `${formatCurrency(0, cur)} (Borç Yok)`;
        return netDebt > 0
            ? `${formatCurrency(netDebt, cur)} Borç`
            : `${formatCurrency(Math.abs(netDebt), cur)} Alacak`;
    };
    const farmerLabel = 'Çiftçi';
    const farmerPluralLabel = 'Çiftçiler';
    const prescriptionLabel = 'Fatura';

    const canEditPrescription = !isSales;
    const canCreatePrescription = canEditPrescription;
    const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'DETAIL'>(initialFarmerId ? 'FORM' : 'LIST');
    
    // Sub-navigation sync
    useEffect(() => {
        const handlePop = (e: PopStateEvent) => {
            const state = e.state;
            if (state?.view === 'PRESCRIPTIONS') {
                if (state.subView) {
                    setViewMode(state.subView);
                    if (state.step) {
                        setStep(state.step);
                    } else {
                        setStep(initialFarmerId ? 2 : 1);
                    }
                    if (state.subView === 'DETAIL' && state.detailId) {
                        const target = contextPrescriptions.find(p => p.id === state.detailId);
                        if (target) setDetailPrescription(target);
                    }
                } else {
                    setViewMode('LIST');
                    setDetailPrescription(null);
                    setEditingId(null);
                    setStep(1);
                }
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [contextPrescriptions, initialFarmerId]);

    const handleEditPayment = (payment: any) => {
        setEditingPayment(payment);
        setPaymentAmount(payment.amount.toString());
        setPaymentNote(payment.note || '');
        setSelectedAccountId(payment.accountId || '');
        setPaymentMethod(payment.method);
        setSelectedPaymentFarmerId(payment.farmerId);
        setPaymentDate(payment.dueDate || payment.date.split('T')[0]);
        setIsPaymentModalOpen(true);
    };

    const handleDeletePayment = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Ödeme Kaydı Silinecek',
            message: 'Bu ödeme kaydını silmek istediğinize emin misiniz?',
            onConfirm: async () => {
                await deletePayment(id);
                showToast('Ödeme kaydı silindi', 'success');
            }
        });
    };

    const handleSendReceiptButton = async (payment: any) => {
        hapticFeedback('medium');
        const farmer = farmerMap[payment.farmerId];
        const farmerName = farmer?.fullName || 'Sayın Müşterimiz';
        const dateStr = new Date(payment.date).toLocaleDateString('tr-TR');
        const amountNum = Number(payment.amount) || 0;
        const amountStr = formatCurrency(amountNum, userProfile?.currency || 'TRY');
        const paymentTypeStr = payment.method === 'CHECK' ? 'Çek' :
                            payment.method === 'CARD' ? 'Kredi Kartı / POS' :
                            payment.method === 'TEDYE' ? 'Tediye' : 'Nakit';
        const currentNetDebt = getFarmerNetDebt(payment.farmerId);
        const previousNetDebt = currentNetDebt + amountNum;
        const prevBalanceStr = formatSignedBalanceLabel(previousNetDebt);
        const remBalanceStr = formatSignedBalanceLabel(currentNetDebt);
                            
        setIsProcessingPdf(true);
        try {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.innerHTML = `
                <div id="receipt-print-${payment.id}" style="width: 420px; padding: 36px; background: white; color: #1c1917; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h2 style="margin: 0; font-size: 24px; font-weight: 900; color: #064e3b; text-transform: uppercase;">${userProfile?.companyName || 'ZİRAİ OTOMASYON'}</h2>
                        <p style="margin: 5px 0 0; font-size: 13px; font-weight: 700; color: #57534e; letter-spacing: 2px;">TAHSİLAT DEKONTU & MAKBUZU</p>
                    </div>
                    <div style="border-top: 2px dashed #d6d3d1; margin: 16px 0;"></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                        <span style="color: #78716c; font-weight: 600;">Tarih:</span>
                        <strong style="color: #292524;">${dateStr}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                        <span style="color: #78716c; font-weight: 600;">Müşteri:</span>
                        <strong style="color: #292524;">${farmerName}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                        <span style="color: #78716c; font-weight: 600;">Ödeme Yöntemi:</span>
                        <strong style="color: #292524;">${paymentTypeStr}</strong>
                    </div>
                    ${payment.dueDate ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                        <span style="color: #78716c; font-weight: 600;">Vade:</span>
                        <strong style="color: #292524;">${new Date(payment.dueDate).toLocaleDateString('tr-TR')}</strong>
                    </div>` : ''}
                    ${payment.note ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                        <span style="color: #78716c; font-weight: 600;">Açıklama:</span>
                        <strong style="color: #292524;">${payment.note}</strong>
                    </div>` : ''}
                    <div style="border-top: 2px dashed #d6d3d1; margin: 16px 0;"></div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
                            <span style="color: #64748b; font-weight: 700;">Önceki Bakiye:</span>
                            <strong style="color: #334155;">${prevBalanceStr}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px;">
                            <span style="color: #065f46; font-weight: 800;">Tahsil Edilen:</span>
                            <strong style="color: #059669; font-size: 18px;">${amountStr}</strong>
                        </div>
                        <div style="border-top: 1px solid #cbd5e1; margin: 8px 0;"></div>
                        <div style="display: flex; justify-content: space-between; font-size: 14px;">
                            <span style="color: #0f172a; font-weight: 900;">Güncel Kalan Bakiye:</span>
                            <strong style="color: ${currentNetDebt > 0 ? '#dc2626' : '#059669'}; font-size: 16px;">${remBalanceStr}</strong>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 24px; font-size: 11px; font-weight: 600; color: #78716c;">
                        Ödemeniz cari hesabınıza işlenmiştir. Bizi tercih ettiğiniz için teşekkür ederiz.
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            
            const elementToCapture = container.firstElementChild as HTMLElement;
            const canvas = await renderElementToCanvas(elementToCapture, {
                scale: 3, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });
            
            document.body.removeChild(container);
            
            const pdf = await createMultiPagePdf(canvas);
            const pdfBlob = pdf.output('blob');
            
            const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
            const safeName = farmerName
                .replace(/[ĞğÜüŞşİıÖöÇç]/g, match => charMap[match])
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            const fileName = `${safeName}_Tahsilat_Makbuzu.pdf`;
            
            const fallbackToWhatsApp = (phone?: string, text?: string) => {
                const encodedMessage = encodeURIComponent(text || '');
                const phoneParam = normalizeWaPhone(phone);
                const whatsappUrl = phoneParam 
                    ? `https://wa.me/${phoneParam}?text=${encodedMessage}` 
                    : `https://wa.me/?text=${encodedMessage}`;
                window.open(whatsappUrl, '_blank');
            };

            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            const message = renderWhatsAppTemplate(
                userProfile?.whatsappTemplates?.collectionReceipt,
                'collectionReceipt',
                {
                    isim: farmerName,
                    tarih: dateStr,
                    odeme_yontemi: paymentTypeStr,
                    eski_bakiye: prevBalanceStr,
                    odenen: amountStr,
                    kalan_bakiye: remBalanceStr,
                    bakiye: remBalanceStr,
                    firma: userProfile?.companyName || 'Zirai Otomasyon'
                }
            );
            const shareData = {
                files: [file],
                title: 'Tahsilat Makbuzu',
                text: message
            };
            
            if (navigator.canShare && navigator.canShare(shareData)) {
                try {
                    await navigator.share(shareData);
                } catch (shareError) {
                    // WA-07: kullanıcı paylaşımı iptal ettiyse WhatsApp'ı zorla açma.
                    if ((shareError as any)?.name === 'AbortError') return;
                    console.log('Share failed', shareError);
                    fallbackToWhatsApp(farmer?.phoneNumber, message);
                }
            } else {
                pdf.save(fileName);
                fallbackToWhatsApp(farmer?.phoneNumber, message);
            }
        } catch (e) {
            console.error('PDF Error:', e);
            showToast('Makbuz oluşturulamadı', 'error');
        } finally {
            setIsProcessingPdf(false);
        }
    };

    const changeViewMode = (mode: 'LIST' | 'FORM' | 'DETAIL', detailId?: string, replace = false) => {
        if (mode === viewMode) return;
        
        if (mode === 'LIST') {
            if (window.history.state?.subView) {
                window.history.back();
            } else {
                setViewMode('LIST');
                setDetailPrescription(null);
                setEditingId(null);
            }
        } else {
            const initialStep = (mode === 'FORM' && initialFarmerId) ? 2 : 1;
            const state = { ...window.history.state, subView: mode, detailId, step: initialStep };
            if (replace) {
                window.history.replaceState(state, '');
            } else {
                window.history.pushState(state, '');
            }
            setViewMode(mode);
            setStep(initialStep);
        }
    };

    // B-06: kamera sürekli modunda aynı kod kadrajda kaldıkça tekrar sayılmasın (3 sn bekleme).
    const lastCameraScanRef = useRef<{ key: string; ts: number }>({ key: '', ts: 0 });
    // Satılmış seri numaraları (BKTS defterinden, GTIN|Seri -> faturaId) ve bu oturumda kaydedilenler.
    const soldSerialsRef = useRef<Map<string, string>>(new Map());
    const sessionSerialsRef = useRef<Map<string, string>>(new Map());
    // Hızlı ardışık okumalarda bayat state yerine güncel sepeti görmek için ayna.
    const selectedItemsRef = useRef<CartItem[]>([]);

    const refreshSoldSerials = async () => {
        try {
            const recs = await loadMinistryRecords();
            const map = new Map<string, string>();
            [...recs]
                .filter(r => !r.deletedAt && r.serialNumber)
                .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
                .forEach(r => {
                    const k = serialKey(r.gtin, r.serialNumber!);
                    if (r.recordType === 'FARMER_SALE' || r.recordType === 'FREE_SALE') map.set(k, r.prescriptionId || r.documentNo || '?');
                    else if (r.recordType === 'RETURN') map.delete(k);
                });
            soldSerialsRef.current = map;
        } catch (e) {
            console.warn('[Prescription] Satılmış seri listesi okunamadı', e);
        }
    };

    /** Seri numarası sepette / oturumda / daha önceki bir satışta kullanıldıysa açıklama döner. */
    const getSerialConflict = (gtin: string | undefined, serial: string, items: CartItem[]): string | null => {
        const key = serialKey(gtin, serial);
        if (items.some(i => (i.serialNumbers || []).some(s => serialKey(i.gtin || gtin, s) === key))) {
            return 'Bu karekod zaten sepette okutuldu';
        }
        if (prescriptionType === 'RETURN') return null; // İadede satılmış kutunun geri alınması beklenir
        const isLiveOther = (presId?: string) => {
            if (!presId || presId === editingId || presId === draftPrescriptionIdRef.current) return false;
            const p = contextPrescriptions.find(x => x.id === presId);
            return !p || !p.deletedAt;
        };
        const sessionHit = sessionSerialsRef.current.get(key);
        if (sessionHit && isLiveOther(sessionHit)) return 'Bu karekod bu oturumda zaten satıldı';
        const soldHit = soldSerialsRef.current.get(key);
        if (soldHit && soldHit !== editingId && soldHit !== draftPrescriptionIdRef.current) {
            const p = contextPrescriptions.find(x => x.id === soldHit || x.prescriptionNo === soldHit);
            if (p && !p.deletedAt && p.id !== editingId) return `Bu karekod daha önce satılmış (${p.prescriptionNo})`;
        }
        return null;
    };

    const handleScan = (barcode: string, meta?: { format?: string }, source: 'camera' | 'hardware' = 'camera') => {
        const text = String(barcode || '').trim();
        if (!text) return;
        const parsed: GS1ParseResult = parseGS1Barcode(text, meta?.format);

        if (source === 'camera') {
            const key = `${scanKey(parsed)}|${parsed.serial || ''}|${parsed.batch || ''}`;
            const now = Date.now();
            if (lastCameraScanRef.current.key === key && now - lastCameraScanRef.current.ts < 3000) return;
            lastCameraScanRef.current = { key, ts: now };
        }

        // B-25: tek paylaşımlı AudioContext üzerinden hata sesi
        const fail = (msg: string) => {
            playErrorBeep();
            showToast(msg, 'error');
        };

        if (parsed.type === 'SSCC') {
            fail('Bu bir koli/palet (SSCC) kodu. Satış için ürün kutusundaki karekodu okutun.');
            return;
        }

        let lotNumber = parsed.batch?.trim() || undefined;
        let serial = parsed.serial?.trim() || undefined;
        // B-08: GS ayracı eksikse Lot/Seri sınırı belirsiz — kullanıcıya doğrulat
        if (parsed.ambiguous && (lotNumber || serial)) {
            const lotIn = window.prompt('Karekodda GS ayracı eksik; Lot ve Seri No sınırı kesin değil.\nLütfen LOT / PARTİ numarasını kutudan kontrol edip doğrulayın:', lotNumber || '');
            if (lotIn === null) { showToast('Okutma iptal edildi', 'info'); return; }
            const serialIn = window.prompt('Lütfen SERİ NUMARASINI kutudan kontrol edip doğrulayın:', serial || '');
            if (serialIn === null) { showToast('Okutma iptal edildi', 'info'); return; }
            lotNumber = lotIn.trim() || undefined;
            serial = serialIn.trim() || undefined;
        }

        // B-05/B-29: GTIN normalize (14 hane) ile depo ve kütüphanede ara
        const matches = contextInventory.filter(inv => !inv.deletedAt && itemMatchesScan(inv, parsed));
        const invItem: InventoryItem | undefined =
            (lotNumber ? matches.find(inv => inv.lotNumber === lotNumber || (inv.batches || []).some(b => b.lotNumber === lotNumber)) : undefined)
            || matches.find(inv => (Number(inv.quantity) || 0) > 0)
            || matches[0];

        let pesticide: Pesticide | undefined = invItem ? pesticides.find(pest => pest.id === invItem.pesticideId) : undefined;
        if (!pesticide && invItem) {
            pesticide = {
                id: invItem.pesticideId,
                name: invItem.pesticideName,
                activeIngredient: 'Bilinmiyor',
                defaultDosage: '100ml/100L',
                category: invItem.category,
                description: 'Depo ürünü'
            } as Pesticide;
        }
        if (!pesticide) {
            pesticide = pesticides.find(p => itemMatchesScan(p as { gtin?: string; barcode?: string }, parsed));
        }
        if (!pesticide) {
            fail('Barkod bulunamadı: ' + (parsed.gtin || text));
            return;
        }

        const gtin = parsed.gtin ? normalizeGtin(parsed.gtin) : toGtin14(invItem?.gtin || invItem?.barcode || (pesticide as any).barcode);
        const batch = invItem && lotNumber ? (invItem.batches || []).find(b => b.lotNumber === lotNumber) : undefined;
        const expiryDate = parsed.expiryDate
            || batch?.expiryDate
            || (invItem && (!lotNumber || invItem.lotNumber === lotNumber) ? invItem.expiryDate : undefined)
            || undefined;

        // SKT geçmiş: BKTS'de engelle, serbest satışta onay + gerekçe (B-15)
        let expiredReason: string | undefined;
        if (prescriptionType !== 'RETURN' && isExpiredDate(expiryDate)) {
            if (saleRegistryMode === 'BKTS') {
                fail(`⛔ SKT GEÇMİŞ (${expiryDate}): ${pesticide.name} BKTS kayıtlı satışta satılamaz.`);
                return;
            }
            playErrorBeep();
            const ok = window.confirm(`${pesticide.name} ürününün son kullanma tarihi geçmiş (${expiryDate}).\nKayıtsız serbest satışta yine de eklemek istiyor musunuz?`);
            if (!ok) return;
            const reason = window.prompt('SKT geçmiş ürün satış gerekçesi (zorunlu):', '');
            if (!reason || !reason.trim()) {
                showToast('Gerekçe girilmeden SKT geçmiş ürün eklenemez.', 'error');
                return;
            }
            expiredReason = reason.trim();
        }

        // B-06: aynı seri numaralı kutu ikinci kez satılamaz
        if (serial) {
            const conflict = getSerialConflict(gtin, serial, selectedItemsRef.current);
            if (conflict) {
                fail(`${conflict} (Seri: ${serial})`);
                return;
            }
        }

        addItem(pesticide, { gtin, lotNumber, expiryDate, serial }, expiredReason, invItem);
        // Donanım okuyucu kendi bip sesini zaten çalıyor; kamerada tek bip (B-25)
        if (source === 'camera') {
            playScanBeep();
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(50);
        }
        const daysLeft = daysUntilExpiry(expiryDate);
        const traceText = [lotNumber ? `Lot ${lotNumber}` : '', serial ? `Seri ${serial}` : '', daysLeft !== null && daysLeft <= 90 ? `SKT ${daysLeft} gün` : ''].filter(Boolean).join(' • ');
        showToast(`${pesticide.name} listeye eklendi${traceText ? ` (${traceText})` : ''}`, 'success');
    };

    const [isSavingPrescription, setIsSavingPrescription] = useState(false);
    const isSavingPrescriptionRef = useRef(false);

    const changeStep = (newStep: number) => {
        if (newStep === step) return;
        if (newStep > 1 && !selectedFarmer) {
            showToast("Lütfen önce bir müşteri seçiniz.", 'error');
            hapticFeedback('error');
            setStep(1);
            return;
        }
        if (newStep > 2 && (!selectedCrop || !selectedCrop.trim())) {
            showToast("Lütfen satışı yapılan mahsulü (ürünü) seçiniz.", 'error');
            hapticFeedback('error');
            setStep(2);
            return;
        }
        if (newStep > 3 && selectedItems.length === 0) {
            showToast("Lütfen en az bir ürün ekleyiniz.", 'error');
            hapticFeedback('error');
            setStep(3);
            return;
        }
        window.history.pushState({ ...window.history.state, step: newStep }, '');
        setStep(newStep);
    };
    
    const [farmerMap, setFarmerMap] = useState<Record<string, Farmer>>({});

    const [step, setStep] = useState(1);
    const [isScanning, setIsScanning] = useState(false);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [pesticides, setPesticides] = useState<Pesticide[]>([]);
    
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
    const [selectedPlantId, setSelectedPlantId] = useState('');
    const [selectedCrop, setSelectedCrop] = useState('');
    const [cropSearchTerm, setCropSearchTerm] = useState('');
    const [customCropInput, setCustomCropInput] = useState('');
    const [farmerSearchTerm, setFarmerSearchTerm] = useState('');
    const [pesticideSearchTerm, setPesticideSearchTerm] = useState('');
    const [prescriptionSearchTerm, setPrescriptionSearchTerm] = useState('');
    
    // Updated state to include quantity and price (+ BKTS/GTS izlenebilirlik: GTIN, Lot, SKT, Seri)
    const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
    selectedItemsRef.current = selectedItems;
    const [showPrices, setShowPrices] = useState(true);
    const [customPrescriptionNo, setCustomPrescriptionNo] = useState('');
    const [prescriptionPriceType, setPrescriptionPriceType] = useState<'CASH' | 'TERM'>('TERM');
    const [prescriptionAccountId, setPrescriptionAccountId] = useState<string>('');
    const [prescriptionDiscount, setPrescriptionDiscount] = useState<string>('');
    const [prescriptionDueDate, setPrescriptionDueDate] = useState('');
    const [isManualDueDate, setIsManualDueDate] = useState(false);
    const [prescriptionType, setPrescriptionType] = useState<'SALE' | 'RETURN'>('SALE');
    const [quarantineReturnEnabled, setQuarantineReturnEnabled] = useState(false);
    const [quarantineReturnReason, setQuarantineReturnReason] = useState('');

    // #12 Hazır Reçete Şablonları
    const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDisease, setNewTemplateDisease] = useState('');
    
    const currentPrescriptionLabel = prescriptionType === 'RETURN' ? 'İade Faturası' : 'Satış Faturası';
    
    // Recommendations State
    const [recommendedIds, setRecommendedIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('mks_crm_recommended_pesticides_' + userProfile?.id);
        return saved ? JSON.parse(saved) : [];
    });
    const [showRecommendations, setShowRecommendations] = useState(false);

    useEffect(() => {
        if (userProfile?.id) {
            localStorage.setItem('mks_crm_recommended_pesticides_' + userProfile?.id, safeStringify(recommendedIds));
        }
    }, [recommendedIds, userProfile?.id]);

    const toggleRecommendation = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setRecommendedIds(prev => 
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };
    
    // Detail View State
    const [detailPrescription, setDetailPrescription] = useState<Prescription | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [prescriptionToDelete, setPrescriptionToDelete] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showProfitId, setShowProfitId] = useState<string | null>(null);
    const [hasInitializedEdit, setHasInitializedEdit] = useState(false);
    const [hasInitializedFarmer, setHasInitializedFarmer] = useState(false);
    
    const [filterMode, setFilterMode] = useState<'ALL' | 'PROCESSED' | 'UNPROCESSED' | 'PAYMENTS'>('ALL');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'TEDYE'>('CASH');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNote, setPaymentNote] = useState('');
    const [isSavingPayment, setIsSavingPayment] = useState(false);
    const [selectedPaymentFarmerId, setSelectedPaymentFarmerId] = useState('');
    const [editingPayment, setEditingPayment] = useState<any>(null);
    
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const receiptRef = useRef<HTMLDivElement>(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportStartDate, setReportStartDate] = useState<string>(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [reportEndDate, setReportEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [reportTypeSelection, setReportTypeSelection] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (initialFarmerId && !hasInitializedFarmer && farmers.length > 0) {
            const preSelected = farmers.find(farm => farm.id === initialFarmerId);
            if (preSelected) {
                setSelectedFarmer(preSelected);
                setStep(2);
                setHasInitializedFarmer(true);
                // Ensure history state is correct for initial step 2
                if (window.history.state?.view === 'PRESCRIPTIONS' && !window.history.state.step) {
                    window.history.replaceState({ ...window.history.state, step: 2 }, '');
                }
            }
        }
    }, [initialFarmerId, farmers, hasInitializedFarmer]);

    useEffect(() => {
        if (initialPrescriptionId && !hasInitializedEdit && contextPrescriptions.length > 0 && pesticides.length > 0) {
            const p = contextPrescriptions.find(presc => presc.id === initialPrescriptionId);
            if (p) {
                handleEdit(null as any, p);
                setHasInitializedEdit(true);
            }
        }
    }, [initialPrescriptionId, contextPrescriptions, pesticides, hasInitializedEdit]);

    // Derive available crops for farmer and global catalog
    const farmerCrops = useMemo(() => {
        if (!selectedFarmer) return [];
        const set = new Set<string>();
        if (selectedFarmer.fields) {
            selectedFarmer.fields.forEach(f => {
                if (f.crop && f.crop.trim()) set.add(f.crop.trim());
            });
        }
        contextPrescriptions.forEach(p => {
            if (p.farmerId === selectedFarmer.id) {
                const c = (p.crop || p.cropName || contextPlants.find(pl => pl.id === p.plantId)?.name)?.trim();
                if (c) set.add(c);
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
    }, [selectedFarmer, contextPrescriptions, contextPlants]);

    const allAvailableCrops = useMemo<string[]>(() => {
        const set = new Set<string>();
        POPULAR_CROPS.forEach((c: string) => set.add(c));
        contextPlants.forEach(p => {
            if (p.name && p.name.trim()) set.add(p.name.trim());
        });
        farmerCrops.forEach((c: string) => set.add(c));
        return Array.from(set).sort((a: string, b: string) => a.localeCompare(b, 'tr'));
    }, [contextPlants, farmerCrops]);

    const filteredCropsList = useMemo<string[]>(() => {
        if (!cropSearchTerm.trim()) return allAvailableCrops;
        const term = cropSearchTerm.trim().toLowerCase();
        return allAvailableCrops.filter((c: string) => c.toLowerCase().includes(term));
    }, [allAvailableCrops, cropSearchTerm]);

    useEffect(() => {
        if (!selectedFarmer || prescriptionPriceType !== 'TERM' || isManualDueDate) {
            if (prescriptionPriceType !== 'TERM') {
                setPrescriptionDueDate('');
            }
            return;
        }

        // 1. Use selected plant or selected crop for calculation if available
        const plant = contextPlants.find(p => p.id === selectedPlantId || p.name.toLowerCase() === selectedCrop.toLowerCase());
        if (plant && plant.maturityDate) {
            const [month, day] = plant.maturityDate.split('-').map(Number);
            if (!isNaN(month) && !isNaN(day)) {
                const now = new Date();
                let year = now.getFullYear();
                
                const targetDate = new Date(year, month - 1, day);
                if (targetDate < now) {
                    const diffDays = (now.getTime() - targetDate.getTime()) / (1000 * 3600 * 24);
                    if (diffDays > 30) {
                        year += 1;
                    }
                }
                
                const calculatedDate = new Date(year, month - 1, day);
                setPrescriptionDueDate(format(calculatedDate, 'yyyy-MM-dd'));
                return;
            }
        }
        
        // 2. Check selectedCrop directly or field crop
        const cropLower = (selectedCrop || (selectedFarmer.fields?.find(f => f.id === selectedFieldId)?.crop) || '').toLocaleLowerCase('tr-TR');
        if (cropLower) {
            const currentYear = new Date().getFullYear();
            let targetMonth = 11; // Aralık (December)
            let targetDay = 31;

            if (cropLower.includes('arpa')) {
                targetMonth = 5; // Haziran (June)
                targetDay = 1;
            } else if (cropLower.includes('buğday') || cropLower.includes('bugday')) {
                targetMonth = 5; // Haziran
                targetDay = 15;
            } else if (cropLower.includes('pamuk')) {
                targetMonth = 10; // Kasım (November)
                targetDay = 1;
            } else if (cropLower.includes('mısır') || cropLower.includes('misir')) {
                targetMonth = 10; // Kasım
                targetDay = 15;
            } else if (cropLower.includes('ayçiçek') || cropLower.includes('aycicek')) {
                targetMonth = 8; // Eylül
                targetDay = 15;
            } else if (cropLower.includes('üzüm') || cropLower.includes('uzum')) {
                targetMonth = 9; // Ekim
                targetDay = 15;
            }

            const calculatedDate = new Date(currentYear, targetMonth, targetDay);
            setPrescriptionDueDate(format(calculatedDate, 'yyyy-MM-dd'));
            return;
        }

        setPrescriptionDueDate('');
    }, [selectedFieldId, selectedFarmer, prescriptionPriceType, selectedPlantId, selectedCrop, contextPlants]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fListRaw, pestList, tplList] = await Promise.all([
                dbService.getFarmers(),
                dbService.getPesticides(),
                dbService.getPrescriptionTemplates()
            ]);
            const fList = fListRaw.filter(f => !f.deletedAt);

            setFarmers(fList);
            setPesticides(pestList);
            setTemplates(tplList);

            const fMap: Record<string, Farmer> = {};
            fListRaw.forEach(f => { fMap[f.id] = f; });
            setFarmerMap(fMap);
            void refreshSoldSerials();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAsTemplate = async () => {
        if (!newTemplateName.trim()) {
            showToast('Lütfen şablon adı giriniz.', 'error');
            return;
        }
        if (selectedItems.length === 0) {
            showToast('Şablon kaydetmek için sepette en az 1 ürün olmalıdır.', 'error');
            return;
        }
        const tpl: PrescriptionTemplate = {
            id: crypto.randomUUID(),
            name: newTemplateName.trim(),
            targetCrop: selectedCrop.trim() || undefined,
            targetDisease: newTemplateDisease.trim() || undefined,
            items: selectedItems.map(i => ({
                pesticideId: i.pesticide.id,
                pesticideName: i.pesticide.name,
                dosage: i.dosage,
                quantity: i.quantity || '1',
                unitPrice: i.unitPrice ? parseFloat(i.unitPrice.replace(',', '.')) : undefined,
                totalPrice: i.totalPrice,
                buyingPrice: i.buyingPrice
            })),
            createdAt: new Date().toISOString()
        };
        await dbService.savePrescriptionTemplate(tpl);
        setTemplates(await dbService.getPrescriptionTemplates());
        setNewTemplateName('');
        setNewTemplateDisease('');
        setIsSaveTemplateOpen(false);
        showToast(`"${tpl.name}" reçete şablonu kaydedildi`, 'success');
        hapticFeedback('success');
    };

    const handleApplyTemplate = (tpl: PrescriptionTemplate) => {
        if (tpl.targetCrop && !selectedCrop) {
            setSelectedCrop(tpl.targetCrop);
        }
        const mapped = tpl.items.map(it => {
            const p = pesticides.find(pest => pest.id === it.pesticideId) || {
                id: it.pesticideId,
                name: it.pesticideName,
                activeIngredient: 'Bilinmiyor',
                defaultDosage: it.dosage || '100ml/100L',
                category: PesticideCategory.OTHER
            } as Pesticide;
            const invItem = contextInventory.find(inv => inv.pesticideId === it.pesticideId);
            const livePrice = invItem
                ? (prescriptionPriceType === 'CASH' && invItem.cashPrice ? invItem.cashPrice : invItem.sellingPrice)
                : (it.unitPrice || 0);
            const qtyNum = parseFloat(String(it.quantity || '1').replace(',', '.')) || 1;
            return {
                pesticide: p,
                dosage: it.dosage || p.defaultDosage || '100ml/100L',
                quantity: String(qtyNum),
                unitPrice: livePrice > 0 ? String(livePrice) : '',
                totalPrice: qtyNum * livePrice,
                buyingPrice: invItem?.buyingPrice ?? it.buyingPrice ?? 0
            };
        });
        setSelectedItems(mapped);
        setIsTemplateModalOpen(false);
        if (selectedFarmer && (tpl.targetCrop || selectedCrop)) {
            changeStep(4);
        } else if (selectedFarmer) {
            changeStep(2);
        }
        showToast(`"${tpl.name}" şablonu uygulandı (${mapped.length} kalem)`, 'success');
        hapticFeedback('medium');
    };

    const handleDeleteTemplate = async (id: string) => {
        await dbService.deletePrescriptionTemplate(id);
        setTemplates(await dbService.getPrescriptionTemplates());
        showToast('Şablon silindi', 'info');
    };

    useEffect(() => {
        if (contextFarmers && contextFarmers.length > 0) {
            const active = contextFarmers.filter(f => !f.deletedAt);
            setFarmers(active);
            setFarmerMap(prev => {
                const next = { ...prev };
                contextFarmers.forEach(f => { next[f.id] = f; });
                return next;
            });
        }
    }, [contextFarmers]);

    const handleBackFromForm = () => {
        if (step > 1 && !initialFarmerId) {
            window.history.back();
        } else if (initialFarmerId) {
            onBack(); 
        } else {
            changeViewMode('LIST');
            resetForm();
        }
    };

    const resetForm = (type: 'SALE' | 'RETURN' = 'SALE') => {
        setStep(1);
        setSelectedFarmer(null);
        setFarmerSearchTerm('');
        setPesticideSearchTerm('');
        setSelectedItems([]);
        setSelectedFieldId('');
        setSelectedFieldIds([]);
        setSelectedPlantId('');
        setSelectedCrop('');
        setCropSearchTerm('');
        setCustomCropInput('');
        setDetailPrescription(null);
        setIsProcessingPdf(false);
        setEditingId(null);
        setHasInitializedEdit(false);
        setHasInitializedFarmer(false);
        setShowPrices(true);
        setCustomPrescriptionNo('');
        setPrescriptionPriceType('TERM');
        setPrescriptionAccountId(accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id || '');
        setPrescriptionDiscount('');
        setPrescriptionDueDate('');
        setIsManualDueDate(false);
        setPrescriptionType(type);
        setQuarantineReturnEnabled(false);
        setQuarantineReturnReason('');
        setBReceteCode('');
        // B-13: yeni form için kimlik baştan üretilir; hata sonrası tekrar denemede aynısı kullanılır.
        draftPrescriptionIdRef.current = generateUUID();
        draftPrescriptionNoRef.current = null;
        saveProgressRef.current = emptySaveProgress();
    };

    /** Okutulan karekod verisini (GTIN/Lot/SKT/Seri) sepet satırına işler. */
    const applyTrace = (item: CartItem, trace?: ScanTrace, expiredSaleReason?: string): CartItem => {
        const next: CartItem = { ...item };
        if (expiredSaleReason) next.expiredSaleReason = expiredSaleReason;
        if (!trace) return next;
        if (trace.gtin && !next.gtin) next.gtin = trace.gtin;
        if (trace.lotNumber && !next.lotNumber) next.lotNumber = trace.lotNumber;
        if (trace.expiryDate && !next.expiryDate) next.expiryDate = trace.expiryDate;
        if (trace.serial) next.serialNumbers = [...(next.serialNumbers || []), trace.serial];
        if (trace.lotNumber) {
            const allocs = [...(next.batchAllocations || [])];
            const idx = allocs.findIndex(a => a.lotNumber === trace.lotNumber);
            if (idx >= 0) {
                const a = allocs[idx];
                allocs[idx] = {
                    ...a,
                    quantity: a.quantity + 1,
                    expiryDate: a.expiryDate || trace.expiryDate,
                    serialNumbers: trace.serial ? [...(a.serialNumbers || []), trace.serial] : a.serialNumbers
                };
            } else {
                allocs.push({
                    lotNumber: trace.lotNumber,
                    expiryDate: trace.expiryDate,
                    quantity: 1,
                    serialNumbers: trace.serial ? [trace.serial] : undefined
                });
            }
            next.batchAllocations = allocs;
        }
        return next;
    };

    const addItem = (pesticide: Pesticide, trace?: ScanTrace, expiredSaleReason?: string, matchedInventory?: InventoryItem) => {
        setSelectedItems(prevItems => {
            const existingItem = prevItems.find(i => i.pesticide.id === pesticide.id);
            if (existingItem) {
                // Aynı seri ikinci kez gelirse (hızlı çift okuma) sepeti değiştirme
                if (trace?.serial && (existingItem.serialNumbers || []).some(s => serialKey(existingItem.gtin || trace.gtin, s) === serialKey(trace.gtin, trace.serial!))) {
                    return prevItems;
                }
                // Increment quantity if already exists
                const currentQty = parseQty(existingItem.quantity) || 0;
                const newQty = currentQty + 1;
                const price = parseQty(existingItem.unitPrice || '0') || 0;
                
                return prevItems.map(i => 
                    i.pesticide.id === pesticide.id 
                        ? applyTrace({ ...i, quantity: newQty.toString(), totalPrice: round2(newQty * price) }, trace, expiredSaleReason)
                        : i
                );
            } else {
                // Find inventory item to get selling price
                const inventoryItem = matchedInventory || contextInventory.find(inv => !inv.deletedAt && inv.pesticideId === pesticide.id) || contextInventory.find(inv => inv.pesticideId === pesticide.id);
                let sellingPrice = '';
                let initialPrice = 0;
                let costPrice = 0;
                
                if (inventoryItem) {
                    if (prescriptionPriceType === 'CASH' && inventoryItem.cashPrice) {
                        sellingPrice = inventoryItem.cashPrice.toString();
                        initialPrice = inventoryItem.cashPrice;
                    } else {
                        sellingPrice = inventoryItem.sellingPrice.toString();
                        initialPrice = inventoryItem.sellingPrice;
                    }
                    costPrice = inventoryItem.buyingPrice || 0;
                }

                // Initialize quantity as '1'
                const initialQty = 1;
                
                return [...prevItems, applyTrace({ 
                    pesticide, 
                    dosage: pesticide.defaultDosage, 
                    quantity: initialQty.toString(), 
                    unitPrice: sellingPrice, 
                    totalPrice: initialQty * initialPrice,
                    buyingPrice: costPrice
                }, trace, expiredSaleReason)];
            }
        });
        setPesticideSearchTerm(''); // Seçimden sonra aramayı temizle
    };

    const removeItem = (id: string) => {
        setSelectedItems(prev => prev.filter(i => i.pesticide.id !== id));
    };

    /** Okutulmuş tek bir seriyi (kutuyu) satırdan çıkarır ve miktarı 1 azaltır. */
    const removeSerial = (id: string, serial: string) => {
        setSelectedItems(prev => prev.map(i => {
            if (i.pesticide.id !== id) return i;
            const serialNumbers = (i.serialNumbers || []).filter(s => s !== serial);
            const batchAllocations = (i.batchAllocations || [])
                .map(a => a.serialNumbers?.includes(serial)
                    ? { ...a, quantity: Math.max(0, a.quantity - 1), serialNumbers: a.serialNumbers.filter(s => s !== serial) }
                    : a)
                .filter(a => a.quantity > 0);
            const qty = Math.max(0, (parseQty(i.quantity) || 0) - 1);
            const price = parseQty(i.unitPrice || '0') || 0;
            return {
                ...i,
                serialNumbers,
                batchAllocations,
                lotNumber: batchAllocations.some(a => a.lotNumber === i.lotNumber) || batchAllocations.length === 0 ? i.lotNumber : batchAllocations[0].lotNumber,
                quantity: String(qty),
                totalPrice: round2(qty * price)
            };
        }));
    };

    const updateDosage = (id: string, newDosage: string) => {
        setSelectedItems(selectedItems.map(i => i.pesticide.id === id ? { ...i, dosage: newDosage } : i));
    };

    const updateQuantity = (id: string, newQuantity: string) => {
        setSelectedItems(selectedItems.map(i => {
            if (i.pesticide.id === id) {
                const qty = parseQty(newQuantity) || 0;
                const price = parseQty(i.unitPrice || '0') || 0;
                return { ...i, quantity: newQuantity, totalPrice: round2(qty * price) };
            }
            return i;
        }));
    };

    const updatePrice = (id: string, newPrice: string) => {
        setSelectedItems(selectedItems.map(i => {
            if (i.pesticide.id === id) {
                const qty = parseQty(i.quantity || '0') || 0;
                const price = parseQty(newPrice) || 0;
                return { ...i, unitPrice: newPrice, totalPrice: round2(qty * price) };
            }
            return i;
        }));
    };

    const handlePriceTypeChange = (newType: 'CASH' | 'TERM') => {
        setPrescriptionPriceType(newType);
        setSelectedItems(selectedItems.map(i => {
            const invItem = contextInventory.find(inv => inv.pesticideId === i.pesticide.id);
            let newPrice = i.unitPrice;
            if (invItem) {
                if (newType === 'CASH' && invItem.cashPrice) {
                    newPrice = invItem.cashPrice.toString();
                } else {
                    newPrice = invItem.sellingPrice.toString();
                }
            }
            const qty = parseFloat(i.quantity.replace(',', '.')) || 0;
            const price = parseFloat(String(newPrice || '0').replace(',', '.')) || 0;
            return { ...i, unitPrice: newPrice, totalPrice: qty * price };
        }));
    };

    // --- Hardware back button layers ---
    useBackHandler(viewMode === 'FORM' && !initialFarmerId && !initialPrescriptionId, () => {
        setViewMode('LIST');
        setEditingId(null);
        resetForm();
    }, 'prescription_form', 22);
    useBackHandler(!!detailPrescription, () => {
        setDetailPrescription(null);
        setViewMode('LIST');
    }, 'prescription_detail', 24);
    useBackHandler(isScanning, () => setIsScanning(false), 'prescription_scanner', 70);

    // --- USB / Wireless POS barcode gun (event from App.tsx, or pending code left before this screen mounted) ---
    const handleScanRef = useRef(handleScan);
    handleScanRef.current = handleScan;
    const [pendingPosBarcode, setPendingPosBarcode] = useState<string | null>(() => sessionStorage.getItem('mks_pending_pos_barcode'));
    useEffect(() => {
        const onPosScan = (e: Event) => {
            const raw = (e as CustomEvent).detail?.rawBarcode;
            if (raw) setPendingPosBarcode(String(raw));
        };
        window.addEventListener('mks-pos-barcode-scanned', onPosScan);
        return () => window.removeEventListener('mks-pos-barcode-scanned', onPosScan);
    }, []);
    useEffect(() => {
        if (!pendingPosBarcode || isLoading) return;
        sessionStorage.removeItem('mks_pending_pos_barcode');
        setPendingPosBarcode(null);
        if (viewMode !== 'FORM') changeViewMode('FORM');
        handleScanRef.current(pendingPosBarcode, undefined, 'hardware');
    }, [pendingPosBarcode, isLoading]);

    // --- Smart bar: tank mix, BKTS/GTS mode, hold cart, voice, holder tank ---
    const tankMix = useMemo(() => selectedItems.length >= 2
        ? checkTankMixCompatibility(selectedItems.map(i => ({ name: i.pesticide.name, category: i.pesticide.category, activeIngredient: i.pesticide.activeIngredient })))
        : null, [selectedItems]);
    const [saleRegistryMode, setSaleRegistryMode] = useState<'BKTS' | 'FREE'>('BKTS');
    // B-Reçete (opsiyonel) kodu — yalnız ministryConfig.bReceteEnabled açıkken gösterilir
    const [bReceteCode, setBReceteCode] = useState('');
    const bReceteEnabled = Boolean(userProfile?.ministryConfig?.bReceteEnabled);
    // B-13: form açılışında üretilen fatura kimliği/numarası ve adım adım kayıt ilerlemesi (idempotent tekrar deneme)
    const draftPrescriptionIdRef = useRef<string | null>(null);
    const draftPrescriptionNoRef = useRef<string | null>(null);
    const saveProgressRef = useRef<SaveProgress>(emptySaveProgress());
    useEffect(() => {
        if (viewMode === 'FORM' && !editingId && !draftPrescriptionIdRef.current) {
            draftPrescriptionIdRef.current = generateUUID();
        }
    }, [viewMode, editingId]);
    // Onay modali (ConfirmationModal) için Promise tabanlı soru
    const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null);
    const askConfirm = (title: string, message: string, variant: 'danger' | 'warning' | 'info' = 'warning') =>
        new Promise<boolean>(resolve => {
            confirmResolverRef.current?.(false);
            confirmResolverRef.current = resolve;
            setConfirmModal({
                isOpen: true,
                title,
                message,
                variant,
                onConfirm: () => {
                    const r = confirmResolverRef.current;
                    confirmResolverRef.current = null;
                    r?.(true);
                }
            });
        });
    const closeConfirmModal = () => {
        const r = confirmResolverRef.current;
        confirmResolverRef.current = null;
        r?.(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };
    const [hasHeldCart, setHasHeldCart] = useState(() => !!localStorage.getItem(HELD_CART_KEY));
    const [isListening, setIsListening] = useState(false);
    const [holderTankL, setHolderTankL] = useState(1000);

    // Swaps the current cart with the held one, so neither cart is ever lost.
    const toggleHeldCart = () => {
        let held: { farmerId?: string; crop?: string; items?: typeof selectedItems } | null = null;
        try { held = JSON.parse(localStorage.getItem(HELD_CART_KEY) || 'null'); } catch { held = null; }
        if (selectedItems.length > 0) {
            localStorage.setItem(HELD_CART_KEY, JSON.stringify({ farmerId: selectedFarmer?.id, crop: selectedCrop, items: selectedItems }));
        } else {
            localStorage.removeItem(HELD_CART_KEY);
        }
        setHasHeldCart(selectedItems.length > 0);
        setSelectedItems(held?.items || []);
        const heldFarmer = held?.farmerId ? farmers.find(f => f.id === held!.farmerId) || null : null;
        setSelectedFarmer(heldFarmer);
        setSelectedFieldId('');
        setSelectedCrop(held?.crop || '');
        hapticFeedback('medium');
        showToast(held?.items?.length ? 'Bekleyen müşteri sepeti çağrıldı' : 'Müşteri sepeti bekletmeye alındı', 'success');
    };

    const startVoiceCommand = () => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { showToast('Bu cihaz sesli komutu desteklemiyor', 'error'); return; }
        const rec = new SR();
        rec.lang = 'tr-TR';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onresult = (e: any) => {
            const spoken: string = e.results?.[0]?.[0]?.transcript || '';
            const said = normalizeTurkish(spoken);
            const byLongest = <T,>(list: T[], name: (x: T) => string) =>
                [...list].sort((a, b) => name(b).length - name(a).length).find(x => name(x) && said.includes(normalizeTurkish(name(x))));
            const farmer = byLongest(farmers, f => f.fullName || '');
            const product = byLongest(pesticides, p => p.name || '');
            if (farmer) { setSelectedFarmer(farmer); setSelectedFieldId(''); }
            if (product) addItem(product);
            if (!farmer && !product) setPesticideSearchTerm(spoken);
            showToast(farmer || product
                ? `Sesli komut: ${[farmer?.fullName, product?.name].filter(Boolean).join(' • ')}`
                : `Eşleşme yok: "${spoken}"`, farmer || product ? 'success' : 'info');
        };
        rec.onerror = () => showToast('Ses algılanamadı', 'error');
        rec.onend = () => setIsListening(false);
        setIsListening(true);
        rec.start();
    };

    // shortcut: assumes defaultDosage is "per 100 L water" (e.g. "50 ml/100L"); per-decare labels are skipped, upgrade when dosage gets a structured unit.
    const holderTankDoses = useMemo(() => selectedItems.flatMap(i => {
        const d = String(i.dosage || '');
        if (/\/\s*(da|dekar|ha)\b/i.test(d)) return [];
        const m = d.match(/(\d+(?:[.,]\d+)?)\s*(ml|cc|gr|g|kg|lt|l)\b/i);
        if (!m) return [];
        const amount = parseFloat(m[1].replace(',', '.')) * holderTankL / 100;
        return [{ name: i.pesticide.name, text: `${Number(amount.toFixed(1)).toLocaleString('tr-TR')} ${m[2].toLowerCase()}` }];
    }), [selectedItems, holderTankL]);
    const cartUnitCount = selectedItems.reduce((sum, i) => sum + (parseFloat(String(i.quantity || '0').replace(',', '.')) || 0), 0);
    // shortcut: 1 unit ≈ 1 kg/L package, upgrade when inventory stores package size.
    const cartEstimatedKg = selectedItems.reduce((sum, i) => {
        const unit = (contextInventory.find(inv => inv.pesticideId === i.pesticide.id)?.unit || '').toLowerCase();
        const qty = parseFloat(String(i.quantity || '0').replace(',', '.')) || 0;
        return sum + (/gr|gram/.test(unit) ? qty / 1000 : /ml/.test(unit) ? qty / 1000 : qty);
    }, 0);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setPrescriptionToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!prescriptionToDelete) return;
        await softDeletePrescription(prescriptionToDelete);
        await loadData();
        showToast(`${prescriptionLabel} ${t('toast.movedToTrash') || 'çöp kutusuna taşındı'}`, 'info');
        hapticFeedback('medium');
        if (viewMode === 'DETAIL') {
            changeViewMode('LIST');
            setDetailPrescription(null);
        }
        setPrescriptionToDelete(null);
    };

    const handleEdit = (e: React.MouseEvent | null, p: Prescription) => {
        if (e) e.stopPropagation();
        
        const farmer = farmerMap[p.farmerId];
        if (farmer) {
            setSelectedFarmer(farmer);
            setSelectedFieldId(p.fieldId || '');
            setSelectedFieldIds(p.fieldIds || (p.fieldId ? [p.fieldId] : []));
            setSelectedPlantId(p.plantId || '');
            const cropVal = p.crop || p.cropName || (contextPlants.find(pl => pl.id === p.plantId)?.name) || (p.fieldId ? farmer?.fields?.find(f => f.id === p.fieldId)?.crop : '') || '';
            setSelectedCrop(cropVal);
        }

        // Reconstruct Pesticide objects from stored items
        const reconstructedItems = p.items.map(item => {
            const libraryPesticide = pesticides.find(pest => pest.id === item.pesticideId);
            const basePesticide = libraryPesticide || {
                id: item.pesticideId,
                name: item.pesticideName,
                activeIngredient: 'Bilinmiyor',
                defaultDosage: item.dosage,
                category: PesticideCategory.OTHER,
                description: 'Kütüphaneden silinmiş ilaç'
            } as Pesticide;

            return { 
                pesticide: basePesticide, 
                dosage: item.dosage,
                quantity: item.quantity || '', // Map existing quantity or default to empty
                unitPrice: item.unitPrice ? item.unitPrice.toString() : '',
                totalPrice: item.totalPrice || 0,
                buyingPrice: item.buyingPrice,
                gtin: item.gtin,
                lotNumber: item.lotNumber,
                expiryDate: item.expiryDate,
                serialNumbers: item.serialNumbers || (item.serialNumber ? [item.serialNumber] : undefined),
                batchAllocations: item.batchAllocations,
                expiredSaleReason: (item as PrescriptionItem & { expiredSaleReason?: string }).expiredSaleReason
            } as CartItem;
        });

        // Eğer en az bir üründe fiyat varsa, fiyat modunu aç
        if (reconstructedItems.some(i => i.unitPrice)) {
            setShowPrices(true);
        } else {
            setShowPrices(false);
        }

        setCustomPrescriptionNo(p.prescriptionNo || '');
        setPrescriptionDiscount(p.discountAmount ? p.discountAmount.toString() : '');
        setPrescriptionPriceType(p.priceType || 'TERM');
        const existingTx = transactions.find(t => t.relatedId === p.id);
        setPrescriptionAccountId(p.accountId || existingTx?.accountId || accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id || '');
        setPrescriptionType(p.type || 'SALE');
        if (p.dueDate) {
            setPrescriptionDueDate(p.dueDate.split('T')[0]);
            setIsManualDueDate(true);
        } else {
            setPrescriptionDueDate('');
            setIsManualDueDate(false);
        }
        setSelectedItems(reconstructedItems);
        // Eski kayıtlarda mod yoktu: kayıtlı satış olarak işaretlenmemiş eski faturalar serbest satış kabul edilir
        setSaleRegistryMode(p.saleRegistryMode || 'FREE');
        setBReceteCode(p.bReceteCode || '');
        saveProgressRef.current = emptySaveProgress();
        setEditingId(p.id);
        changeViewMode('FORM');
        setStep(2); // Set step without pushing again since changeViewMode already pushed
        window.history.replaceState({ ...window.history.state, step: 2 }, '');
    };

    const handleViewDetail = (p: Prescription) => {
        setDetailPrescription(p);
        const farmer = farmerMap[p.farmerId];
        if (farmer) setSelectedFarmer(farmer);
        changeViewMode('DETAIL', p.id);
    };

    const toggleProcessed = async (e: React.MouseEvent, p: Prescription) => {
        e.stopPropagation();
        
        try {
            const updated = await togglePrescriptionStatus(p.id);
            showToast(p.isProcessed ? `${prescriptionLabel} işlenmedi olarak işaretlendi` : `${prescriptionLabel} işlendi olarak işaretlendi`, 'success');
            hapticFeedback('success');
            
            // If we are in detail view, update the detail state as well
            if (detailPrescription && detailPrescription.id === p.id && updated) {
                setDetailPrescription(updated);
            }
        } catch (error) {
            console.error("Toggle processed error:", error);
            showToast("Durum güncellenirken bir hata oluştu.", 'error');
            hapticFeedback('error');
        }
    };

    const handleStatusChange = async (e: React.MouseEvent, p: Prescription, newStatus: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'INVOICED') => {
        e.stopPropagation();
        
        setConfirmModal({
            isOpen: true,
            title: 'Durum Değiştirilecek',
            message: `Sipariş durumunu '${newStatus}' olarak değiştirmek istiyor musunuz?`,
            variant: 'info',
            onConfirm: async () => {
                try {
                    const updatedPrescription = { 
                        ...p, 
                        status: newStatus,
                        deliveredById: newStatus === 'DELIVERED' ? (activeTeamMember?.id || p.deliveredById) : p.deliveredById
                    };
                    await dbService.updatePrescription(updatedPrescription);
                    await refreshStats();
                    
                    // Update context by triggering a refresh or manual state update
                    // For now, updating local detail state
                    if (detailPrescription && detailPrescription.id === p.id) {
                        setDetailPrescription(updatedPrescription);
                    }
                    showToast(`Sipariş durumu güncellendi`, 'success');
                    hapticFeedback('success');
                } catch (error) {
                    console.error("Error updating status:", error);
                    showToast("İşlem sırasında bir hata oluştu", 'error');
                    hapticFeedback('error');
                }
            }
        });
    };

    /** Fatura kalemlerinden BKTS/GTS defter kayıtları üretir (her seri için 1 kayıt; serisiz miktar lot bazında). */
    const buildMinistryRecords = (p: Prescription, farmer: Farmer): MinistryRecord[] => {
        const isBkts = p.saleRegistryMode === 'BKTS';
        const recordType: MinistryRecord['recordType'] = p.type === 'RETURN' ? 'RETURN' : (isBkts ? 'FARMER_SALE' : 'FREE_SALE');
        const status: MinistryRecord['status'] = isBkts ? 'Dışa Aktarıma Hazır' : 'Kayıtsız Serbest Satış';
        const now = new Date().toISOString();
        const out: MinistryRecord[] = [];
        p.items.forEach((it, idx) => {
            const qty = Math.abs(parseQty(it.quantity)) || 0;
            if (!(qty > 0)) return;
            const unit = contextInventory.find(inv => !inv.deletedAt && inv.pesticideId === it.pesticideId)?.unit;
            const base = {
                system: 'BKTS' as const,
                recordType,
                date: p.date,
                documentNo: p.prescriptionNo,
                prescriptionId: p.id,
                bReceteCode: p.bReceteCode,
                farmerId: farmer.id,
                farmerName: farmer.fullName,
                farmerTcNo: p.farmerTcNo,
                pesticideId: it.pesticideId,
                productName: it.pesticideName,
                gtin: it.gtin || '',
                unit,
                status,
                lastUpdated: now
            };
            const serials = it.serialNumbers || [];
            serials.forEach(serial => {
                const alloc = it.batchAllocations?.find(a => a.serialNumbers?.includes(serial));
                out.push({
                    ...base,
                    id: `${p.id}:${idx}:S:${serial}`,
                    lotNumber: alloc?.lotNumber || it.lotNumber || '',
                    expiryDate: alloc?.expiryDate || it.expiryDate,
                    serialNumber: serial,
                    quantity: 1
                });
            });
            let remaining = round2(qty - serials.length);
            for (const a of it.batchAllocations || []) {
                if (remaining <= 0) break;
                const free = Math.max(0, a.quantity - (a.serialNumbers?.length || 0));
                if (free <= 0) continue;
                const q = round2(Math.min(free, remaining));
                out.push({ ...base, id: `${p.id}:${idx}:L:${a.lotNumber}`, lotNumber: a.lotNumber, expiryDate: a.expiryDate || it.expiryDate, quantity: q });
                remaining = round2(remaining - q);
            }
            if (remaining > 0) {
                out.push({ ...base, id: `${p.id}:${idx}:R`, lotNumber: it.lotNumber || '', expiryDate: it.expiryDate, quantity: remaining });
            }
        });
        return out;
    };

    /** Defter kayıtlarını kalıcı yazar; düzenlemede artık geçersiz kayıtları siler. Başarısızsa hata fırlatır (sahte başarı yok). */
    const writeMinistryLedger = async (p: Prescription, farmer: Farmer) => {
        const fresh = buildMinistryRecords(p, farmer);
        let stale: MinistryRecord[] = [];
        try {
            const existing = await loadMinistryRecords();
            const keep = new Set(fresh.map(r => r.id));
            const now = new Date().toISOString();
            stale = existing
                .filter(r => r.prescriptionId === p.id && !r.deletedAt && !keep.has(r.id))
                .map(r => ({ ...r, deletedAt: now, lastUpdated: now }));
        } catch (e) {
            console.warn('[Prescription] Mevcut defter kayıtları okunamadı', e);
        }
        const res = await saveMinistryRecords([...fresh, ...stale]);
        if (!res.ok) throw new Error(res.error || 'Kayıt deposuna yazılamadı');
        if (res.error) {
            showToast(`BKTS defter kaydı veritabanına yazılamadı, bu cihazda yerel yedeğe alındı (${res.error}).`, 'info');
        }
        stale.forEach(r => {
            if (!r.serialNumber) return;
            const k = serialKey(r.gtin, r.serialNumber);
            if (soldSerialsRef.current.get(k) === p.id) soldSerialsRef.current.delete(k);
        });
        fresh.forEach(r => {
            if (!r.serialNumber) return;
            const k = serialKey(r.gtin, r.serialNumber);
            if (r.recordType === 'RETURN') soldSerialsRef.current.delete(k);
            else soldSerialsRef.current.set(k, p.id);
        });
    };

    /** Kaydedilen satışın serilerini oturum listesine işler (defter yazımı başarısız olsa bile tekrar satışı engeller). */
    const registerSessionSerials = (p: Prescription) => {
        p.items.forEach(it => (it.serialNumbers || []).forEach(s => {
            const k = serialKey(it.gtin, s);
            if (p.type === 'RETURN') {
                sessionSerialsRef.current.delete(k);
                soldSerialsRef.current.delete(k);
            } else {
                sessionSerialsRef.current.set(k, p.id);
            }
        }));
    };

    const handleSave = async () => {
        if (isSavingPrescription || isSavingPrescriptionRef.current) return;
        if (!selectedFarmer) {
            showToast("Lütfen önce bir müşteri seçiniz.", 'error');
            setStep(1);
            return;
        }
        if (!selectedCrop || !selectedCrop.trim()) {
            showToast("Zorunlu alan: Lütfen satışı yapılan mahsulü seçiniz!", 'error');
            hapticFeedback('error');
            setStep(2);
            return;
        }
        if (selectedItems.length === 0) {
            showToast("Lütfen faturaya en az bir ürün ekleyiniz!", 'error');
            hapticFeedback('error');
            setStep(3);
            return;
        }

        isSavingPrescriptionRef.current = true;
        setIsSavingPrescription(true);

        let stage = 'doğrulama';
        try {
            const isBkts = saleRegistryMode === 'BKTS';
            const isReturn = prescriptionType === 'RETURN';
            const farmerFresh = farmerMap[selectedFarmer.id] || selectedFarmer;
            const liveInventory = contextInventory.filter(inv => !inv.deletedAt);

            // B-13: kimlik form açılışında üretildi; tekrar denemede aynı kimlik ve tamamlanan adımlar korunur
            if (!editingId && !draftPrescriptionIdRef.current) draftPrescriptionIdRef.current = generateUUID();
            const progressKey = editingId || draftPrescriptionIdRef.current!;
            if (saveProgressRef.current.key !== progressKey) {
                saveProgressRef.current = { ...emptySaveProgress(), key: progressKey };
            }
            const progress = saveProgressRef.current;
            const isRetry = progress.steps.size > 0;

            // 1) Miktar doğrulama (B-15): qty > 0 ve sonlu; okutulan seri sayısı miktarı aşamaz
            for (const i of selectedItems) {
                const q = parseQty(i.quantity);
                if (!(q > 0) || !Number.isFinite(q)) {
                    showToast(`"${i.pesticide.name}" için geçerli bir miktar giriniz (0'dan büyük olmalı).`, 'error');
                    hapticFeedback('error');
                    setStep(4);
                    return;
                }
                const serialCount = i.serialNumbers?.length || 0;
                if (serialCount > q) {
                    showToast(`"${i.pesticide.name}": ${serialCount} adet seri okutuldu ama miktar ${q}. Miktarı artırın veya fazla seriyi çıkarın.`, 'error');
                    hapticFeedback('error');
                    setStep(4);
                    return;
                }
            }

            // 2) BKTS/GTS kayıtlı satış: çiftçinin TCKN/VKN'si zorunlu ve geçerli olmalı (B-02)
            let farmerTcNo: string | undefined;
            if (isBkts) {
                const tc = validateTcOrVkn(farmerFresh.tcNo);
                if (tc.status === 'EMPTY' || !tc.isValid) {
                    showToast(
                        tc.status === 'EMPTY'
                            ? `BKTS kayıtlı satış için "${farmerFresh.fullName}" adlı çiftçinin T.C. Kimlik No / VKN bilgisi zorunludur. Çiftçi kartına ekleyin veya "Kayıtsız Serbest Satış" seçin.`
                            : `"${farmerFresh.fullName}" için kayıtlı T.C. Kimlik No / VKN geçersiz (${tc.message}). Çiftçi kartından düzeltin veya "Kayıtsız Serbest Satış" seçin.`,
                        'error'
                    );
                    hapticFeedback('error');
                    return;
                }
                farmerTcNo = String(farmerFresh.tcNo).trim();
            }

            // 3) Kalemler + izlenebilirlik verisi (GTIN / Lot / SKT / Seri / parti dağılımı)
            const items: (PrescriptionItem & { expiredSaleReason?: string })[] = [];
            const newExpiredReasons = new Map<string, string>();
            for (const i of selectedItems) {
                const candidates = liveInventory.filter(inv => inv.pesticideId === i.pesticide.id);
                const preferredLot = i.lotNumber || i.batchAllocations?.[0]?.lotNumber;
                const invMatch = (preferredLot ? candidates.find(inv => inv.lotNumber === preferredLot || (inv.batches || []).some(b => b.lotNumber === preferredLot)) : undefined) || candidates[0];
                const lotNumber = preferredLot || invMatch?.lotNumber || undefined;
                const expiryDate = i.expiryDate
                    || i.batchAllocations?.find(a => a.lotNumber === lotNumber)?.expiryDate
                    || invMatch?.batches?.find(b => b.lotNumber === lotNumber)?.expiryDate
                    || (invMatch && (!lotNumber || invMatch.lotNumber === lotNumber) ? invMatch.expiryDate : undefined)
                    || undefined;
                const gtin = toGtin14(i.gtin) || toGtin14(invMatch?.gtin) || toGtin14(invMatch?.barcode) || toGtin14((i.pesticide as any).barcode);

                let expiredSaleReason = i.expiredSaleReason;
                if (!isReturn) {
                    const expiredDate = [expiryDate, ...(i.batchAllocations || []).map(a => a.expiryDate)].find(d => isExpiredDate(d));
                    if (expiredDate) {
                        if (isBkts) {
                            playErrorBeep();
                            showToast(`⛔ "${i.pesticide.name}" ürününün SKT'si geçmiş (${expiredDate}). BKTS kayıtlı satışta satılamaz; ürünü sepetten çıkarın.`, 'error');
                            hapticFeedback('error');
                            setStep(4);
                            return;
                        }
                        if (!expiredSaleReason) {
                            const ok = await askConfirm('SKT Geçmiş Ürün', `"${i.pesticide.name}" ürününün son kullanma tarihi geçmiş (${expiredDate}). Kayıtsız serbest satışta yine de satmak istiyor musunuz?`, 'danger');
                            if (!ok) { setStep(4); return; }
                            const reason = window.prompt('SKT geçmiş ürün satış gerekçesi (zorunlu):', '');
                            if (!reason || !reason.trim()) {
                                showToast('Gerekçe girilmeden SKT geçmiş ürün satılamaz.', 'error');
                                return;
                            }
                            expiredSaleReason = reason.trim();
                            newExpiredReasons.set(i.pesticide.id, expiredSaleReason);
                        }
                    }
                }

                if (isBkts && (!gtin || !lotNumber)) {
                    showToast(`BKTS kayıtlı satış: "${i.pesticide.name}" için ${!gtin ? 'GTIN (ürün barkodu)' : 'Lot / Parti No'} eksik. Ürün karekodunu okutun, depo kartını tamamlayın veya "Kayıtsız Serbest Satış" seçin.`, 'error');
                    hapticFeedback('error');
                    setStep(3);
                    return;
                }

                const item: PrescriptionItem & { expiredSaleReason?: string } = {
                    pesticideId: i.pesticide.id,
                    pesticideName: i.pesticide.name,
                    dosage: i.dosage,
                    quantity: i.quantity ? i.quantity.replace(',', '.') : '', // Save standardized quantity
                    unitPrice: i.unitPrice ? parseQty(i.unitPrice) : undefined,
                    totalPrice: i.totalPrice,
                    buyingPrice: i.buyingPrice,
                    gtin,
                    lotNumber,
                    expiryDate,
                    quarantineReason: (prescriptionType === 'RETURN' && quarantineReturnEnabled)
                        ? (quarantineReturnReason.trim() || 'Müşteri İadesi Karantina')
                        : undefined
                };
                if (i.serialNumbers?.length) {
                    item.serialNumbers = [...i.serialNumbers];
                    if (i.serialNumbers.length === 1) item.serialNumber = i.serialNumbers[0];
                }
                if (i.batchAllocations?.length) item.batchAllocations = i.batchAllocations.map(a => ({ ...a }));
                if (expiredSaleReason) item.expiredSaleReason = expiredSaleReason;
                items.push(item);
            }
            if (newExpiredReasons.size > 0) {
                setSelectedItems(prev => prev.map(i => newExpiredReasons.has(i.pesticide.id) ? { ...i, expiredSaleReason: newExpiredReasons.get(i.pesticide.id) } : i));
            }

            // 4) Seri tekilliği (sepet içi + daha önce satılmış) — B-06
            if (!isReturn) {
                const seen = new Set<string>();
                for (const it of items) {
                    for (const s of it.serialNumbers || []) {
                        const k = serialKey(it.gtin, s);
                        const conflict = seen.has(k) ? 'Aynı seri sepette iki kez var' : getSerialConflict(it.gtin, s, []);
                        if (conflict) {
                            playErrorBeep();
                            showToast(`${it.pesticideName}: ${conflict} (Seri: ${s}).`, 'error');
                            setStep(4);
                            return;
                        }
                        seen.add(k);
                    }
                }
            }

            // 5) Stok yeterliliği (B-15 / AK-30): eksi stok için onay
            if (!isReturn && !progress.steps.has('inventory')) {
                const original = editingId ? (progress.original || contextPrescriptions.find(p => p.id === editingId)) : undefined;
                const needByPest = new Map<string, number>();
                items.forEach(it => needByPest.set(it.pesticideId, round2((needByPest.get(it.pesticideId) || 0) + (parseQty(it.quantity) || 0))));
                const shortages: string[] = [];
                needByPest.forEach((need, pid) => {
                    const stock = liveInventory.filter(inv => inv.pesticideId === pid).reduce((a, inv) => a + (Number(inv.quantity) || 0), 0);
                    const restored = original && original.isInventoryProcessed && original.type !== 'RETURN'
                        ? original.items.filter(it => it.pesticideId === pid).reduce((a, it) => a + Math.abs(parseQty(it.quantity) || 0), 0)
                        : 0;
                    const available = round2(stock + restored);
                    if (need > available) {
                        const name = items.find(it => it.pesticideId === pid)?.pesticideName || 'Ürün';
                        shortages.push(`${name} (stok ${available.toLocaleString('tr-TR')}, satış ${need.toLocaleString('tr-TR')})`);
                    }
                });
                if (shortages.length > 0) {
                    const ok = await askConfirm('Yetersiz Stok', `Stok yetersiz: ${shortages.join(' • ')}. Kaydederseniz stok eksiye düşecek. Yine de devam edilsin mi?`, 'warning');
                    if (!ok) { setStep(4); return; }
                }
            }

            const initialTotal = round2(items.reduce((acc, item) => acc + (item.totalPrice || 0), 0));
            const discountValue = Math.max(0, parseQty(prescriptionDiscount) || 0);
            const totalAmount = round2(Math.max(0, initialTotal - discountValue));
            const registryFields: Pick<Prescription, 'saleRegistryMode' | 'farmerTcNo' | 'bReceteCode'> = {
                saleRegistryMode,
                farmerTcNo: isBkts ? farmerTcNo : undefined,
                bReceteCode: isBkts && bReceteEnabled && bReceteCode.trim() ? bReceteCode.trim() : undefined
            };

            // Kısmi kayıttan sonra sepet değiştiyse yarım kalan adımlar yanlış veriyle tamamlanmasın
            const signature = JSON.stringify({ f: selectedFarmer.id, items, totalAmount, discountValue, type: prescriptionType, price: prescriptionPriceType, ...registryFields });
            if (isRetry && progress.signature && progress.signature !== signature) {
                showToast('Bu fatura kısmen kaydedildi. Sepeti değiştirmeden tekrar "Kaydet"e basın; değişiklik için kaydı listeden düzenleyin.', 'error');
                hapticFeedback('error');
                return;
            }
            progress.signature = signature;

            // Elle girilen numara başka faturada kullanılıyorsa uyar (AK-17)
            const manualNo = customPrescriptionNo.trim();
            if (manualNo && !isRetry) {
                const clash = contextPrescriptions.find(p => !p.deletedAt && p.prescriptionNo === manualNo && p.id !== progressKey);
                if (clash) {
                    const ok = await askConfirm('Fatura No Kullanımda', `"${manualNo}" numarası başka bir faturada kullanılıyor. Aynı numarayla kaydedilsin mi?`, 'warning');
                    if (!ok) return;
                }
            }
            
            if (editingId) {
                // Update existing
                stage = 'fatura güncelleme';
                const original = progress.original || contextPrescriptions.find(p => p.id === editingId);
                if (!original) {
                    showToast('Düzenlenen fatura bulunamadı (silinmiş veya henüz senkronlanmamış olabilir). Liste yenilendi, lütfen tekrar açın.', 'error');
                    hapticFeedback('error');
                    await loadData();
                    return;
                }
                progress.original = original;

                // If it was already processed, revert old inventory first
                if (original.isInventoryProcessed && !progress.steps.has('revert')) {
                    stage = 'eski stok iadesi';
                    await dbService.revertInventory(original);
                    progress.steps.add('revert');
                }

                const updatedPrescription: Prescription = {
                    ...original,
                    ...registryFields,
                    farmerId: selectedFarmer.id,
                    fieldId: selectedFieldIds.length === 1 ? selectedFieldIds[0] : (selectedFieldId || undefined),
                    fieldIds: selectedFieldIds,
                    plantId: selectedPlantId || undefined,
                    crop: selectedCrop.trim() || undefined,
                    cropName: selectedCrop.trim() || undefined,
                    engineerName: userProfile.fullName || original.engineerName,
                    prescriptionNo: manualNo || original.prescriptionNo,
                    items: items,
                    totalAmount: totalAmount > 0 ? (prescriptionType === 'RETURN' ? -totalAmount : totalAmount) : undefined,
                    discountAmount: discountValue > 0 ? discountValue : undefined,
                    priceType: prescriptionPriceType,
                    type: prescriptionType,
                    dueDate: prescriptionPriceType === 'TERM' && prescriptionDueDate ? new Date(prescriptionDueDate).toISOString() : undefined,
                    accountId: prescriptionPriceType === 'CASH' ? (prescriptionAccountId || accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id) : undefined,
                    isProcessed: original.isProcessed,
                    isInventoryProcessed: false // Reset this so it can be re-processed
                };

                if (!progress.steps.has('update')) {
                    stage = 'fatura güncelleme';
                    await dbService.updatePrescription(updatedPrescription);
                    progress.steps.add('update');
                    registerSessionSerials(updatedPrescription);
                }
                
                // Only process inventory if the prescription was already marked processed (or default true)
                if (original.isProcessed !== false && !progress.steps.has('inventory')) {
                    stage = 'stok düşümü';
                    await dbService.processInventory(updatedPrescription);
                    progress.steps.add('inventory');
                }

                const targetAccount = updatedPrescription.accountId ? accounts.find(a => a.id === updatedPrescription.accountId) : (accounts.find(a => a.type === 'CASH') || accounts[0]);
                const oldTx = transactions.find(t => t.relatedId === updatedPrescription.id);

                if (!progress.steps.has('transaction')) {
                stage = 'kasa hareketi';
                if (updatedPrescription.priceType === 'CASH' && targetAccount) {
                    if (oldTx) {
                        await dbService.updateTransaction({
                            ...oldTx,
                            accountId: targetAccount.id,
                            type: updatedPrescription.type === 'RETURN' ? 'EXPENSE' : 'INCOME',
                            amount: Math.abs(updatedPrescription.totalAmount || 0),
                            date: updatedPrescription.date,
                            description: updatedPrescription.type === 'RETURN' ? 'Peşin İade Kasadan Çıkış' : 'Peşin Satış Tahsilatı',
                            category: 'Satış/İade',
                            partyName: selectedFarmer?.fullName,
                            partyType: 'FARMER',
                            partyId: selectedFarmer?.id
                        });
                    } else {
                        await addTransaction({
                            accountId: targetAccount.id,
                            type: updatedPrescription.type === 'RETURN' ? 'EXPENSE' : 'INCOME',
                            amount: Math.abs(updatedPrescription.totalAmount || 0),
                            date: updatedPrescription.date,
                            description: updatedPrescription.type === 'RETURN' ? 'Peşin İade Kasadan Çıkış' : 'Peşin Satış Tahsilatı',
                            category: 'Satış/İade',
                            relatedId: updatedPrescription.id,
                            partyName: selectedFarmer?.fullName,
                            partyType: 'FARMER',
                            partyId: selectedFarmer?.id
                        });
                    }
                } else if (oldTx) {
                    await deleteTransaction(oldTx.id);
                }
                progress.steps.add('transaction');
                }

                // BKTS/GTS defter kaydı (B-02) — başarısızsa hata fırlatır, sahte başarı gösterilmez
                if (!progress.steps.has('ministry')) {
                    stage = 'ministry';
                    await writeMinistryLedger(updatedPrescription, farmerFresh);
                    progress.steps.add('ministry');
                }

                await refreshStats();

                const finalUpdated = { ...updatedPrescription, isInventoryProcessed: original.isProcessed !== false };
                setDetailPrescription(finalUpdated);
                changeViewMode('DETAIL', finalUpdated.id);
            } else {
                // Create new
                const targetAccId = prescriptionAccountId || accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id;
                let newPrescription = progress.prescription;
                if (!newPrescription) {
                    // B-14 / AK-17: yıl bazlı ardışık, çakışma denetimli fatura numarası
                    stage = 'fatura numarası';
                    let prescriptionNo = manualNo;
                    if (!prescriptionNo) {
                        prescriptionNo = draftPrescriptionNoRef.current || await nextDocumentNumber('REC', contextPrescriptions.map(p => p.prescriptionNo).filter(Boolean));
                        draftPrescriptionNoRef.current = prescriptionNo;
                    }
                    newPrescription = {
                        id: progressKey,
                        ...registryFields,
                        farmerId: selectedFarmer.id,
                        fieldId: selectedFieldIds.length === 1 ? selectedFieldIds[0] : (selectedFieldId || undefined),
                        fieldIds: selectedFieldIds,
                        plantId: selectedPlantId || undefined,
                        crop: selectedCrop.trim() || undefined,
                        cropName: selectedCrop.trim() || undefined,
                        date: new Date().toISOString(),
                        prescriptionNo,
                        engineerName: userProfile.fullName || 'Ziraat Mühendisi',
                        items: items,
                        isOfficial: true,
                        isProcessed: true,
                        isInventoryProcessed: false,
                        totalAmount: totalAmount > 0 ? (prescriptionType === 'RETURN' ? -totalAmount : totalAmount) : undefined,
                        discountAmount: discountValue > 0 ? discountValue : undefined,
                        priceType: prescriptionPriceType,
                        type: prescriptionType,
                        dueDate: prescriptionPriceType === 'TERM' && prescriptionDueDate ? new Date(prescriptionDueDate).toISOString() : undefined,
                        accountId: prescriptionPriceType === 'CASH' ? targetAccId : undefined,
                        status: undefined,
                        createdById: activeTeamMember?.id
                    };
                    progress.prescription = newPrescription;
                }

                if (!progress.steps.has('saved')) {
                    stage = 'fatura kaydı';
                    await dbService.addPrescription(newPrescription);
                    progress.steps.add('saved');
                    registerSessionSerials(newPrescription);
                }
                if (!progress.steps.has('inventory')) {
                    stage = 'stok düşümü';
                    await dbService.processInventory(newPrescription);
                    progress.steps.add('inventory');
                }

                if (newPrescription.priceType === 'CASH' && targetAccId && !progress.steps.has('transaction')) {
                    stage = 'kasa hareketi';
                    const existingTx = transactions.find(t => t.relatedId === newPrescription!.id);
                    if (!existingTx) {
                        await addTransaction({
                            accountId: targetAccId,
                            type: newPrescription.type === 'RETURN' ? 'EXPENSE' : 'INCOME',
                            amount: Math.abs(newPrescription.totalAmount || 0),
                            date: newPrescription.date,
                            description: newPrescription.type === 'RETURN' ? 'Peşin İade Kasadan Çıkış' : 'Peşin Satış Tahsilatı',
                            category: 'Satış/İade',
                            relatedId: newPrescription.id,
                            partyName: selectedFarmer?.fullName,
                            partyType: 'FARMER',
                            partyId: selectedFarmer?.id
                        });
                    }
                    progress.steps.add('transaction');
                }
                
                const currentTypeLabel = newPrescription.type === 'RETURN' ? 'İade Faturası' : 'Satış Faturası';
                
                // Create a visit log entry automatically
                if (!progress.steps.has('visit')) {
                    stage = 'ziyaret kaydı';
                    const newVisit: VisitLog = {
                        id: crypto.randomUUID(),
                        farmerId: selectedFarmer.id,
                        fieldId: selectedFieldIds.length > 0 ? selectedFieldIds[0] : (selectedFieldId || undefined),
                        date: new Date().toISOString(),
                        note: `${currentTypeLabel} işlendi (${newPrescription.prescriptionNo})`,
                        village: selectedFarmer.village
                    };
                    await dbService.addVisit(newVisit);
                    progress.steps.add('visit');
                }
                
                // Add a notification
                if (!progress.steps.has('notification')) {
                    stage = 'bildirim';
                    const newNotification: AppNotification = {
                        id: crypto.randomUUID(),
                        type: 'SUCCESS',
                        title: `${currentTypeLabel} ve Reçete Kaydı`,
                        message: `${selectedFarmer.fullName} için ${currentTypeLabel.toLowerCase()} işlendi ve ziyaret kaydı oluşturuldu.`,
                        date: new Date().toISOString(),
                        isRead: false
                    };
                    await dbService.addNotification(newNotification);
                    progress.steps.add('notification');
                }

                // BKTS/GTS defter kaydı (B-02) — başarısızsa hata fırlatır, sahte başarı gösterilmez
                if (!progress.steps.has('ministry')) {
                    stage = 'ministry';
                    await writeMinistryLedger(newPrescription, farmerFresh);
                    progress.steps.add('ministry');
                }
                
                const finalNew = { ...newPrescription, isInventoryProcessed: true };
                draftPrescriptionIdRef.current = null;
                draftPrescriptionNoRef.current = null;
                setDetailPrescription(finalNew);
                changeViewMode('DETAIL', finalNew.id, true);
            }

            saveProgressRef.current = emptySaveProgress();
            await loadData();
            await refreshStats();
            showToast(`${currentPrescriptionLabel} başarıyla kaydedildi${saleRegistryMode === 'BKTS' ? ' • BKTS defterine işlendi (Dışa Aktarıma Hazır)' : ''}`, 'success');
            hapticFeedback('success');
        } catch (error: any) {
            console.error("Save prescription error:", error);
            if (stage === 'ministry') {
                showToast(`Fatura kaydedildi ancak BKTS/GTS defter kaydı yazılamadı${error?.message ? ` (${error.message})` : ''}. Lütfen "Kaydet"e tekrar basın.`, 'error');
            } else {
                showToast(`Kayıt sırasında bir hata oluştu (${stage}). Bilgiler korunuyor; tekrar "Kaydet"e basarak kaldığı yerden devam edebilirsiniz.`, 'error');
            }
            hapticFeedback('error');
        } finally {
            isSavingPrescriptionRef.current = false;
            setIsSavingPrescription(false);
        }
    };

    const handleWhatsAppText = (targetPrescription: Prescription, targetFarmer: Farmer) => {
        const farmer = farmerMap[targetPrescription.farmerId];
        const typeLabel = targetPrescription.type === 'RETURN' ? 'İADE FATURASI' : 'ZİRAİ FATURA';
        let text = `*${typeLabel}*\n`;
        text += `Sayın *${targetFarmer.fullName}*,\n\n`;
        
        const fIds = targetPrescription.fieldIds || (targetPrescription.fieldId ? [targetPrescription.fieldId] : []);
        if (fIds.length > 0 && farmer?.fields) {
            const names = fIds.map(id => farmer.fields.find(f => f.id === id)?.name).filter(Boolean);
            if (names.length > 0) {
                text += `Araziler: ${names.join(', ')}\n`;
            }
        }

        text += `Tarih: ${new Date(targetPrescription.date).toLocaleDateString('tr-TR')}\n`;
        text += `Fatura No: ${targetPrescription.prescriptionNo}\n\n`;
        
        const hasPrices = targetPrescription.items.some(item => item.unitPrice && item.unitPrice > 0);
        const itemsSummaryLines = targetPrescription.items.map(item => {
            const qty = item.quantity ? item.quantity.toString().replace(/^-/, '').replace(',', '.') : '1';
            if (hasPrices) {
                const price = item.unitPrice || 0;
                const total = Math.abs(item.totalPrice || (parseFloat(qty) * price) || 0);
                return `- ${item.pesticideName}: ${qty} Adet x ${formatCurrency(price, userProfile?.currency || 'TRY')} = *${formatCurrency(total, userProfile?.currency || 'TRY')}*`;
            }
            return `- ${item.pesticideName}: *${item.dosage}*${item.quantity ? ` (${item.quantity} Adet)` : ''}`;
        }).join('\n');

        if (userProfile?.whatsappTemplates?.prescriptionShare?.trim()) {
            const customText = renderWhatsAppTemplate(
                userProfile.whatsappTemplates.prescriptionShare,
                'prescriptionShare',
                {
                    isim: targetFarmer.fullName,
                    tarih: new Date(targetPrescription.date).toLocaleDateString('tr-TR'),
                    fatura_no: targetPrescription.prescriptionNo,
                    mahsul: targetPrescription.crop || targetPrescription.cropName || 'Genel',
                    urunler: itemsSummaryLines,
                    bakiye: targetPrescription.totalAmount ? formatCurrency(Math.abs(targetPrescription.totalAmount), userProfile?.currency || 'TRY') : '-',
                    firma: userProfile?.companyName || targetPrescription.engineerName
                }
            );
            const waPhone = normalizeWaPhone(targetFarmer.phoneNumber);
            window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(customText)}`, '_blank');
            return;
        }

        if (hasPrices) {
            text += `*Ürün Listesi:*\n`;
            targetPrescription.items.forEach(item => {
                const qty = item.quantity ? item.quantity.toString().replace(/^-/, '').replace(',', '.') : '1';
                const price = item.unitPrice || 0;
                const total = Math.abs(item.totalPrice || (parseFloat(qty) * price) || 0);
                
                text += `- ${item.pesticideName}: ${qty} Adet x ${formatCurrency(price, userProfile?.currency || 'TRY')} = *${formatCurrency(total, userProfile?.currency || 'TRY')}*\n`;
            });
            
            if (targetPrescription.totalAmount) {
                if (targetPrescription.discountAmount && targetPrescription.discountAmount > 0) {
                    text += `\nAra Toplam: ${formatCurrency(targetPrescription.totalAmount + targetPrescription.discountAmount, userProfile?.currency || 'TRY')}\n`;
                    text += `İskonto (İndirim): -${formatCurrency(targetPrescription.discountAmount, userProfile?.currency || 'TRY')}\n`;
                }
                text += `\n*ÖDENECEK TUTAR: ${formatCurrency(targetPrescription.totalAmount, userProfile?.currency || 'TRY')}*\n`;
            }
        } else {
            text += `*Kullanılacak İlaçlar:*\n`;
            targetPrescription.items.forEach(item => {
                text += `- ${item.pesticideName}: *${item.dosage}*`;
                if (item.quantity) text += ` (${item.quantity} Adet)`;
                text += `\n`;
            });
        }
        
        text += `\nGeçmiş olsun.\n${targetPrescription.engineerName}`;
        
        const waPhone = normalizeWaPhone(targetFarmer.phoneNumber);
        const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handlePdfAction = async (action: 'SHARE' | 'DOWNLOAD', targetPrescription?: Prescription, targetFarmer?: Farmer) => {
        if (!receiptRef.current) return;
        setIsProcessingPdf(true);

        const currentPrescription = targetPrescription || detailPrescription;
        const currentFarmer = targetFarmer || selectedFarmer;

        if (!currentPrescription || !currentFarmer) return;

        try {
            // Mobile Optimization: Reduced Scale & JPEG
            const canvas = await renderElementToCanvas(receiptRef.current, {
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            const pdf = await createMultiPagePdf(canvas);
            
            const pdfBlob = pdf.output('blob');
            
            // Türkçe karakterleri tamamen ASCII'ye çevir (Android dosya sistemi uyumluluğu için)
            const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
            const safeName = currentFarmer.fullName
                .replace(/[ĞğÜüŞşİıÖöÇç]/g, match => charMap[match])
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            const pNo = currentPrescription.prescriptionNo;
            const fileName = `${safeName}_${currentPrescription.type === 'RETURN' ? 'Iade' : 'Satis'}_${pNo}.pdf`;

            if (action === 'DOWNLOAD') {
                pdf.save(fileName);
            } else {
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                const shareData = {
                    files: [file],
                    title: currentPrescription.type === 'RETURN' ? 'İade Faturası' : 'Zirai Satış Faturası',
                };
                try {
                    if (navigator.canShare && navigator.canShare(shareData)) {
                        await navigator.share(shareData);
                    } else {
                        throw new Error("Share API not supported");
                    }
                } catch (err) {
                    // WA-07: kullanıcı paylaşım sayfasını kapattıysa ayrıca indirme başlatma.
                    if ((err as any)?.name === 'AbortError') return;
                    console.warn("Share failed, fallback to download", err);
                    pdf.save(fileName);
                }
            }

        } catch (error) {
            console.error("PDF Action Error:", error);
            showToast("PDF işleminde bir hata oluştu.", "error");
        } finally {
            setIsProcessingPdf(false);
        }
    };

    const filteredFarmers = farmers.filter(f => 
        turkishMatchesAny([f.fullName, f.village, f.phoneNumber], farmerSearchTerm)
    );

    // B-16: SKT o günün sonuna kadar geçerlidir; yerel takvim gününe göre hesap (dün = -1 = geçmiş)
    const getExpiryDaysLeft = (expiryDate?: string): number | null => daysUntilExpiry(expiryDate);

    // #17 FEFO (First Expired, First Out): SKT 90 gün içindeki stokları en üste çıkar
    const filteredInventoryItems = useMemo(() => {
        const list = contextInventory.filter(inv =>
            !inv.deletedAt && turkishMatchesAny([inv.pesticideName, inv.barcode, inv.lotNumber, inv.gtin], pesticideSearchTerm)
        );
        return [...list].sort((a, b) => {
            const dA = getExpiryDaysLeft(a.expiryDate);
            const dB = getExpiryDaysLeft(b.expiryDate);
            const fefoA = dA !== null && dA >= 0 && dA <= 90 && a.quantity > 0;
            const fefoB = dB !== null && dB >= 0 && dB <= 90 && b.quantity > 0;
            if (fefoA && !fefoB) return -1;
            if (!fefoA && fefoB) return 1;
            if (fefoA && fefoB && dA !== null && dB !== null) return dA - dB;
            return a.pesticideName.localeCompare(b.pesticideName, 'tr');
        });
    }, [contextInventory, pesticideSearchTerm]);

    const filteredPrescriptions = contextPrescriptions.filter(p => {
        const farmer = farmerMap[p.farmerId];
        const matchesSearch = turkishMatchesAny([p.prescriptionNo, farmer?.fullName, p.crop, p.cropName], prescriptionSearchTerm);
            
        const matchesFilter = filterMode === 'ALL' || 
            (filterMode === 'PROCESSED' && p.isProcessed) ||
            (filterMode === 'UNPROCESSED' && !p.isProcessed) ||
            filterMode === 'PAYMENTS';
            
        return matchesSearch && matchesFilter;
    });

    const filteredPaymentsForList = filterMode === 'PAYMENTS' ? payments.filter(p => {
        if (!prescriptionSearchTerm) return true;
        const farmer = farmerMap[p.farmerId];
        return turkishMatchesAny([farmer?.fullName, p.crop, p.note], prescriptionSearchTerm);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

    const trToEn = (text: string) => {
        if (!text) return '';
        return text
            .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
            .replace(/Ü/g, 'U').replace(/ü/g, 'u')
            .replace(/Ş/g, 'S').replace(/ş/g, 's')
            .replace(/İ/g, 'I').replace(/ı/g, 'i')
            .replace(/Ö/g, 'O').replace(/ö/g, 'o')
            .replace(/Ç/g, 'C').replace(/ç/g, 'c');
    };

    const pdfCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const generatePrescriptionReportPDF = async () => {
        setIsGeneratingReport(true);
        setTimeout(async () => {
            try {
                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '0';
                container.style.width = '800px';
                container.style.backgroundColor = '#ffffff';
                container.style.padding = '40px';
                container.style.color = '#1c1917';
                container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

                const start = new Date(reportStartDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(reportEndDate);
                end.setHours(23, 59, 59, 999);

                const filtered = contextPrescriptions.filter(p => {
                    const date = new Date(p.date || Date.now());
                    return date >= start && date <= end;
                });

                let totalSales = 0;
                let totalReturns = 0;

                let htmlContent = `
                    <div style="margin-bottom: 30px;">
                        <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 8px 0; color: #3b82f6; text-transform: uppercase;">
                            ${userProfile?.companyName || "FATURA RAPORU"}
                        </h1>
                        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0; color: #1c1917;">
                            ${reportTypeSelection === 'SUMMARY' ? 'Fatura Listesi (Özet)' : 'Fatura Listesi (Detaylı)'}
                        </h2>
                        <p style="font-size: 13px; margin: 0; color: #78716c;">
                            Tarih Aralığı: ${format(start, 'dd.MM.yyyy')} - ${format(end, 'dd.MM.yyyy')} &nbsp;&bull;&nbsp; Oluşturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}
                        </p>
                    </div>
                `;

                if (reportTypeSelection === 'SUMMARY') {
                    htmlContent += `
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; margin-bottom: 40px;">
                            <thead>
                                <tr style="background-color: #3b82f6; color: white;">
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb; border-top-left-radius: 6px;">Tarih</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb;">Müşteri</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb;">Fatura No</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb;">Tür</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb;">Vade</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb; border-top-right-radius: 6px; text-align: right;">Tutar</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    if (filtered.length === 0) {
                        htmlContent += `<tr><td colspan="6" style="padding: 15px; text-align: center; color: #78716c;">Seçili tarihte kayıt yok.</td></tr>`;
                    } else {
                        filtered.forEach((p, i) => {
                            const farmer = contextFarmers.find(f => f.id === p.farmerId);
                            const netAmount = p.totalAmount || 0;
                            
                            if (p.type === 'RETURN') totalReturns += netAmount;
                            else totalSales += netAmount;

                            const bg = i % 2 === 0 ? '#fafaf9' : '#ffffff';
                            const typeColor = p.type === 'RETURN' ? '#ef4444' : '#10b981';
                            
                            htmlContent += `
                                <tr style="background-color: ${bg}; border-bottom: 1px solid #e7e5e4;">
                                    <td style="padding: 10px;">${format(new Date(p.date || Date.now()), 'dd.MM.yyyy')}</td>
                                    <td style="padding: 10px; font-weight: 600;">${farmer?.fullName || '-'}</td>
                                    <td style="padding: 10px; font-family: monospace;">${p.prescriptionNo || '-'}</td>
                                    <td style="padding: 10px; color: ${typeColor}; font-weight: bold;">${p.type === 'RETURN' ? 'İade' : 'Satış'}</td>
                                    <td style="padding: 10px;">${p.dueDate ? format(new Date(p.dueDate), 'dd.MM.yyyy') : '-'}</td>
                                    <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 12px; font-weight: 600;">${formatCurrency(netAmount, userProfile?.currency || 'TRY')}</td>
                                </tr>
                            `;
                        });
                    }
                    htmlContent += `</tbody></table>`;
                } else {
                    htmlContent += `
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; margin-bottom: 40px;">
                            <thead>
                                <tr style="background-color: #3b82f6; color: white;">
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb; border-top-left-radius: 6px; width: 40%;">Müşteri / Ürün Adı</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb; text-align: center;">Miktar</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb; text-align: right;">Birim Fiyat</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #2563eb; border-top-right-radius: 6px; text-align: right;">Tutar</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    if (filtered.length === 0) {
                        htmlContent += `<tr><td colspan="4" style="padding: 15px; text-align: center; color: #78716c;">Seçili tarihte kayıt yok.</td></tr>`;
                    } else {
                        filtered.forEach(p => {
                            const farmer = contextFarmers.find(f => f.id === p.farmerId);
                            const netAmount = p.totalAmount || 0;
                            
                            if (p.type === 'RETURN') totalReturns += netAmount;
                            else totalSales += netAmount;

                            const vDate = p.dueDate ? ` | Vade: ${format(new Date(p.dueDate), 'dd.MM.yyyy')}` : '';
                            const typeStr = p.type === 'RETURN' ? 'İade' : 'Satış';

                            htmlContent += `
                                <tr style="background-color: #f1f5f9; border-top: 2px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                                    <td colspan="3" style="padding: 10px; font-weight: bold; color: #0f172a;">
                                        ${format(new Date(p.date || Date.now()), 'dd.MM.yyyy')} | ${farmer?.fullName || '-'} | Fatura No: ${p.prescriptionNo || '-'} | Tür: ${typeStr}${vDate}
                                    </td>
                                    <td style="padding: 10px; text-align: right; font-weight: bold; font-family: monospace; font-size: 12px; color: #0f172a;">
                                        ${formatCurrency(netAmount, userProfile?.currency || 'TRY')}
                                    </td>
                                </tr>
                            `;

                            p.items.forEach(item => {
                                htmlContent += `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 8px 10px 8px 20px;">${item.pesticideName}</td>
                                        <td style="padding: 8px 10px; text-align: center;">${item.quantity || '-'}</td>
                                        <td style="padding: 8px 10px; text-align: right; font-family: monospace;">${item.unitPrice ? formatCurrency(item.unitPrice, userProfile?.currency || 'TRY') : '-'}</td>
                                        <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 600;">${item.totalPrice ? formatCurrency(item.totalPrice, userProfile?.currency || 'TRY') : '-'}</td>
                                    </tr>
                                `;
                            });

                            if (p.discountAmount && p.discountAmount > 0) {
                                htmlContent += `
                                    <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fef2f2;">
                                        <td style="padding: 8px 10px 8px 20px; font-weight: bold; color: #dc2626;">İskonto (İndirim)</td>
                                        <td style="padding: 8px 10px;"></td>
                                        <td style="padding: 8px 10px;"></td>
                                        <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: bold; color: #dc2626;">-${formatCurrency(p.discountAmount, userProfile?.currency || 'TRY')}</td>
                                    </tr>
                                `;
                            }
                        });
                    }
                    htmlContent += `</tbody></table>`;
                }

                htmlContent += `
                    <div style="page-break-inside: avoid; width: 300px; margin-left: auto;">
                        <h3 style="font-size: 14px; font-weight: 800; margin: 0 0 10px 0; color: #1c1917; text-transform: uppercase;">Özet</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <tbody>
                                <tr style="border-bottom: 1px solid #e7e5e4;">
                                    <td style="padding: 8px; color: #57534e;">Toplam Satış Tutarı</td>
                                    <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold;">${formatCurrency(totalSales, userProfile?.currency || 'TRY')}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #e7e5e4;">
                                    <td style="padding: 8px; color: #57534e;">Toplam İade Tutarı</td>
                                    <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold; color: #ef4444;">${formatCurrency(totalReturns, userProfile?.currency || 'TRY')}</td>
                                </tr>
                                <tr style="background-color: #10b981; color: white;">
                                    <td style="padding: 10px; border-bottom-left-radius: 6px; font-weight: bold;">NET TOPLAM</td>
                                    <td style="padding: 10px; border-bottom-right-radius: 6px; text-align: right; font-family: monospace; font-weight: bold; font-size: 14px;">${formatCurrency(totalSales - totalReturns, userProfile?.currency || 'TRY')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;

                container.innerHTML = htmlContent;
                document.body.appendChild(container);

                const canvas = await renderElementToCanvas(container, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false
                });

                document.body.removeChild(container);
                
                const pdf = await createMultiPagePdf(canvas);
                pdf.save(`Fatura_Raporu_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
                
                setIsGeneratingReport(false);
                setIsReportModalOpen(false);
                showToast("PDF başarıyla oluşturuldu.", "success");
            } catch (error: any) {
                console.error("Report PDF Error:", error?.message || error);
                setIsGeneratingReport(false);
                showToast("PDF oluşturulurken bir hata oluştu.", "error");
            }
        }, 100);
    };

    if (viewMode === 'LIST') {
        return (
            <div className="relative h-full min-h-[80vh]">
                <div className="p-4 max-w-3xl mx-auto pb-24">
                    <header className="mb-4 flex justify-between items-center sticky top-0 bg-stone-950/80 backdrop-blur z-20 py-2">
                        <div>
                            <h2 className="text-2xl font-bold text-stone-100">{t('prescription.title', { label: prescriptionLabel })}</h2>
                            <p className="text-sm text-stone-500">{t('prescription.subtitle', { label: prescriptionLabel.toLowerCase() })}</p>
                            {userProfile.lastSyncTime && (
                                <p className="text-[10px] text-emerald-500/80 mt-0.5 flex items-center">
                                    <Check size={10} className="mr-1" />
                                    {t('prescription.last_sync')}: {new Date(userProfile.lastSyncTime).toLocaleTimeString(userProfile.language === 'tr' ? 'tr-TR' : userProfile.language === 'ar' ? 'ar-SA' : 'en-US', {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            )}
                        </div>
                        <button 
                            onClick={() => setIsReportModalOpen(true)}
                            className="px-3 py-1.5 bg-stone-900 text-stone-400 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-800 transition-all active:scale-95 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                            title="Rapor Oluştur"
                        >
                            <FileText size={14} />
                            Rapor
                        </button>
                    </header>

                    <div className="bg-stone-900 rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-6 sticky top-20 z-10 backdrop-blur-md">
                        <Search className="text-stone-500 ml-3" size={18} />
                        <input 
                            type="text" 
                            placeholder={t('prescription.search_placeholder', { farmer: farmerLabel, label: prescriptionLabel.toLowerCase() })} 
                            className="w-full p-2.5 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-sm"
                            value={prescriptionSearchTerm}
                            onChange={e => setPrescriptionSearchTerm(e.target.value)}
                        />
                        {prescriptionSearchTerm && (
                            <button onClick={() => setPrescriptionSearchTerm('')} className="p-2 text-stone-500 hover:text-stone-300">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex p-1 bg-stone-900/80 backdrop-blur-xl rounded-2xl border border-white/5 mb-8 w-fit shadow-inner">
                        <button 
                            onClick={() => setFilterMode('ALL')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                filterMode === 'ALL' 
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 scale-[1.02]' 
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                        >
                            {t('prescription.filter_all')}
                        </button>
                        <button 
                            onClick={() => setFilterMode('UNPROCESSED')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                filterMode === 'UNPROCESSED' 
                                ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20 scale-[1.02]' 
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${filterMode === 'UNPROCESSED' ? 'bg-white animate-pulse' : 'bg-rose-500'}`}></div>
                            {t('prescription.filter_unprocessed')}
                        </button>
                        <button 
                            onClick={() => setFilterMode('PROCESSED')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                filterMode === 'PROCESSED' 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 scale-[1.02]' 
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${filterMode === 'PROCESSED' ? 'bg-white' : 'bg-blue-500'}`}></div>
                            {t('prescription.filter_processed')}
                        </button>
                        <button 
                            onClick={() => setFilterMode('PAYMENTS')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                filterMode === 'PAYMENTS' 
                                ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20 scale-[1.02]' 
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${filterMode === 'PAYMENTS' ? 'bg-white' : 'bg-amber-500'}`}></div>
                            Tahsilatlar
                        </button>
                    </div>

                    <div className="space-y-3">
                        {isLoading ? (
                            <ListSkeleton count={5} />
                        ) : filteredPrescriptions.length === 0 ? (
                            <EmptyState
                                icon={FileText}
                                title={prescriptionSearchTerm ? t('prescription.empty_search', { label: prescriptionLabel.toLowerCase() }) : t('prescription.empty_list', { label: prescriptionLabel.toLowerCase() })}
                                description={!prescriptionSearchTerm ? t('prescription.empty_hint', { label: prescriptionLabel.toLowerCase() }) : ''}
                                actionLabel={canCreatePrescription && !prescriptionSearchTerm ? `Yeni ${prescriptionLabel} Oluştur` : undefined}
                                onAction={canCreatePrescription && !prescriptionSearchTerm ? () => changeViewMode('FORM') : undefined}
                                actionIcon={Plus}
                            />
                        ) : filterMode === 'PAYMENTS' ? (
                            filteredPaymentsForList.map(p => {
                                const farmer = farmerMap[p.farmerId];
                                const dateObj = new Date(p.date);
                                const isCheckOrTedye = p.method === 'CHECK' || p.method === 'TEDYE';
                                return (
                                    <div 
                                        key={p.id}
                                        className="bg-stone-900/80 backdrop-blur-xl p-2.5 rounded-2xl shadow-xl border border-white/10 hover:border-emerald-500/30 transition-all relative overflow-hidden group active:scale-[0.98]"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold border shadow-inner shrink-0 bg-emerald-900/20 text-emerald-500 border-emerald-500/20">
                                                    <CreditCard size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h3 className="font-black text-stone-100 text-sm leading-tight truncate tracking-tight">{farmer?.fullName || 'Bilinmeyen Çiftçi'}</h3>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[8px] text-stone-400 font-bold flex items-center bg-stone-800/50 px-1.5 py-0.5 rounded">
                                                            <User size={8} className="mr-1" />
                                                            {p.createdById ? (teamMembers.find(m => m.id === p.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                                                        </span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all items-center">
                                                            <button onClick={(e) => { e.stopPropagation(); handleEditPayment(p); }} className="p-1 text-stone-500 hover:text-emerald-500">
                                                                <Edit2 size={12}/>
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeletePayment(p.id); }} className="p-1 text-stone-500 hover:text-rose-500 transition-all">
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleSendReceiptButton(p); }}
                                                            className="px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                                        >
                                                            MAKBUZ
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[9px] font-black font-mono px-1.5 py-0.5 rounded border shadow-sm bg-emerald-950/50 text-emerald-400 border-emerald-500/20`}>
                                                        {formatCurrency(p.amount, userProfile?.currency || 'TRY')}
                                                    </span>
                                                    <span className="text-[8px] font-black text-stone-400 flex items-center bg-stone-950/50 px-1.5 py-0.5 rounded border border-white/5 shadow-sm uppercase tracking-widest">
                                                        <Calendar size={8} className="mr-1" />
                                                        {dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">
                                                        {p.method === 'CASH' ? 'Nakit' : p.method === 'CARD' ? 'Kredi Kartı' : p.method === 'CHECK' ? 'Çek' : p.method === 'TEDYE' ? 'Tediye' : 'Diğer'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            filteredPrescriptions.map(p => {
                                const farmer = farmerMap[p.farmerId];
                                const dateObj = new Date(p.date);

                                return (
                                    <div 
                                        key={p.id} 
                                        onClick={() => handleViewDetail(p)}
                                        className="bg-stone-900/80 backdrop-blur-xl p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-sm sm:shadow-xl border border-white/10 hover:border-emerald-500/30 transition-all relative overflow-hidden group cursor-pointer active:scale-[0.98]"
                                    >
                                        <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                                            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold border shadow-inner shrink-0 ${p.type === 'RETURN' ? 'bg-amber-900/20 text-amber-500 border-amber-500/20' : 'bg-blue-900/20 text-blue-400 border-blue-500/20'}`}>
                                                    {p.type === 'RETURN' ? <ArrowLeft size={14} /> : <FileText size={14} />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                                        <h3 className="font-black text-stone-100 text-xs sm:text-sm leading-tight truncate tracking-tight">{farmer?.fullName || t('prescription.unknown_farmer', { farmer: farmerLabel })}</h3>
                                                        {p.type === 'RETURN' && (
                                                            <span className="text-[6.5px] sm:text-[7px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30">İADE</span>
                                                        )}
                                                        {p.priceType === 'CASH' && (
                                                            <span className="text-[6.5px] sm:text-[7px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/30">PEŞİN</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                                                        <p className="text-[7.5px] sm:text-[8px] text-stone-500 font-black uppercase tracking-widest">{p.prescriptionNo}</p>
                                                        <span className="text-[7.5px] sm:text-[8px] text-stone-400 font-bold flex items-center bg-stone-800/50 px-1.5 py-0.5 rounded">
                                                            <User size={8} className="mr-1" />
                                                            {p.createdById ? (teamMembers.find(m => m.id === p.createdById)?.fullName || t('prescription.manager')) : t('prescription.manager')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                                <div className="flex items-center gap-1 sm:gap-1.5">
                                                    {!hideCostAndProfit && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setShowProfitId(p.id); }}
                                                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 transition-all active:scale-90"
                                                            title="Kar/Zarar Analizi"
                                                        >
                                                            <TrendingUp size={12} />
                                                        </button>
                                                    )}
                                                    {p.totalAmount !== undefined && p.totalAmount !== null && Math.abs(p.totalAmount) > 0 && (
                                                        <span className={`text-[8.5px] sm:text-[9px] font-black font-mono px-1.5 py-0.5 rounded border shadow-sm ${p.type === 'RETURN' ? 'bg-amber-950/50 text-amber-400 border-amber-500/20' : 'bg-emerald-950/50 text-emerald-400 border-emerald-500/20'}`}>
                                                            {p.type === 'RETURN' ? '-' : ''}{formatCurrency(Math.abs(p.totalAmount), userProfile?.currency || 'TRY')}
                                                        </span>
                                                    )}
                                                    <span className="text-[7.5px] sm:text-[8px] font-black text-stone-400 flex items-center bg-stone-950/50 px-1.5 py-0.5 rounded border border-white/5 shadow-sm uppercase tracking-widest">
                                                        <Calendar size={8} className="mr-1" />
                                                        {dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <button 
                                                        type="button"
                                                        onClick={(e) => toggleProcessed(e, p)}
                                                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all border-2 active:scale-90 relative z-30 shadow-lg ${
                                                            p.isProcessed 
                                                            ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                                                            : 'bg-rose-600/10 border-rose-500/30 text-rose-400'
                                                        }`}
                                                    >
                                                        {p.isProcessed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                                                    </button>
                                            </div>
                                        </div>
                                        <div className="pl-9 sm:pl-11 mt-0.5">
                                            <div className="flex flex-wrap gap-1">
                                                {p.items.slice(0, 3).map((item, idx) => (
                                                    <span key={idx} className="text-[6.5px] sm:text-[7px] font-black uppercase tracking-wider bg-stone-950/50 text-stone-500 px-1.5 py-0.5 rounded border border-white/5">
                                                        {item.pesticideName} {item.quantity && `(x${item.quantity.toString().replace(/^-/, '')})`}
                                                    </span>
                                                ))}
                                                {p.items.length > 3 && (
                                                    <span className="text-[6.5px] sm:text-[7px] font-black uppercase tracking-wider bg-stone-950/50 text-stone-600 px-1.5 py-0.5 rounded border border-white/5">
                                                        +{p.items.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {canCreatePrescription && (
                    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-2.5">
                        {isFabOpen && (
                            <div 
                                className="fixed inset-0 bg-black/45 backdrop-blur-xs z-[-1]"
                                onClick={() => setIsFabOpen(false)}
                            />
                        )}

                        {isFabOpen && (
                            <div className="flex flex-col items-end gap-2 mb-1 animate-in fade-in slide-in-from-bottom-3 duration-200">
                                <button 
                                    onClick={() => {
                                        setIsFabOpen(false);
                                        setIsPaymentModalOpen(true);
                                        setSelectedPaymentFarmerId('');
                                        setPaymentAmount('');
                                        setPaymentNote('');
                                        setPaymentDate(new Date().toISOString().split('T')[0]);
                                        setPaymentMethod('CASH');
                                        setEditingPayment(null);
                                    }}
                                    className="bg-emerald-950 text-emerald-100 hover:bg-emerald-900 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-xs border border-emerald-500/30 backdrop-blur-md active:scale-95 transition-all"
                                >
                                    <CreditCard size={15} className="text-emerald-400" />
                                    <span>Tahsilat Faturası</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setIsFabOpen(false);
                                        resetForm('RETURN');
                                        changeViewMode('FORM');
                                    }}
                                    className="bg-amber-500 text-stone-950 hover:bg-amber-400 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 font-extrabold text-xs border border-amber-300 backdrop-blur-md active:scale-95 transition-all"
                                >
                                    <ArrowLeft size={15} />
                                    <span>İade Faturası</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setIsFabOpen(false);
                                        resetForm('SALE');
                                        changeViewMode('FORM');
                                    }}
                                    className="bg-emerald-500 text-stone-950 hover:bg-emerald-400 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 font-black text-xs border border-emerald-300 backdrop-blur-md active:scale-95 transition-all"
                                >
                                    <Plus size={16} strokeWidth={2.5} />
                                    <span>Satış Faturası</span>
                                </button>
                            </div>
                        )}

                        <button 
                            type="button"
                            onClick={() => setIsFabOpen(!isFabOpen)}
                            aria-label="Yeni Fatura ve İşlem Menüsü"
                            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90 ${
                                isFabOpen 
                                    ? 'bg-stone-800 text-stone-200 rotate-45 border border-white/20' 
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-500/40 ring-4 ring-emerald-500/20'
                            }`}
                        >
                            <Plus size={26} strokeWidth={2.5} />
                        </button>
                    </div>
                )}

                <PrescriptionProfitModal
                    showProfitId={showProfitId}
                    prescriptions={contextPrescriptions}
                    inventory={contextInventory}
                    currency={userProfile?.currency}
                    onClose={() => setShowProfitId(null)}
                />

                <ConfirmationModal 
                    isOpen={isDeleteModalOpen}
                    onClose={() => { setIsDeleteModalOpen(false); setPrescriptionToDelete(null); }}
                    onConfirm={confirmDelete}
                    title={`${prescriptionLabel} Silinecek`}
                    message={t('prescription.delete_confirm', { label: prescriptionLabel.toLowerCase() }) || `Bu ${prescriptionLabel.toLowerCase()}yi silmek istediğinize emin misiniz?`}
                />

                <PrescriptionReportRangeModal
                    isOpen={isReportModalOpen}
                    reportTypeSelection={reportTypeSelection}
                    setReportTypeSelection={setReportTypeSelection}
                    reportStartDate={reportStartDate}
                    setReportStartDate={setReportStartDate}
                    reportEndDate={reportEndDate}
                    setReportEndDate={setReportEndDate}
                    isGeneratingReport={isGeneratingReport}
                    onClose={() => setIsReportModalOpen(false)}
                    onGenerate={generatePrescriptionReportPDF}
                />

                <PrescriptionCollectionModal
                    isOpen={isPaymentModalOpen}
                    farmers={contextFarmers}
                    accounts={accounts}
                    currency={userProfile?.currency}
                    selectedPaymentFarmerId={selectedPaymentFarmerId}
                    setSelectedPaymentFarmerId={setSelectedPaymentFarmerId}
                    paymentAmount={paymentAmount}
                    setPaymentAmount={setPaymentAmount}
                    selectedAccountId={selectedAccountId}
                    setSelectedAccountId={setSelectedAccountId}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    paymentDate={paymentDate}
                    setPaymentDate={setPaymentDate}
                    paymentNote={paymentNote}
                    setPaymentNote={setPaymentNote}
                    isSavingPayment={isSavingPayment}
                    setIsSavingPayment={setIsSavingPayment}
                    editingPayment={editingPayment}
                    activeTeamMemberId={activeTeamMember?.id}
                    updatePayment={updatePayment}
                    addPayment={addPayment}
                    showToast={showToast}
                    hapticFeedback={hapticFeedback}
                    onClose={() => {
                        setIsPaymentModalOpen(false);
                        setEditingPayment(null);
                        setPaymentAmount('');
                    }}
                    onSavedReset={() => {
                        setIsPaymentModalOpen(false);
                        setPaymentAmount('');
                        setPaymentNote('');
                        setSelectedPaymentFarmerId('');
                        setEditingPayment(null);
                    }}
                />
            </div>
        );
    }

    if (viewMode === 'DETAIL' && detailPrescription) {
        return (
            <PrescriptionReceiptView
                detailPrescription={detailPrescription}
                selectedFarmer={selectedFarmer}
                teamMembers={teamMembers}
                userProfile={userProfile}
                canEditPrescription={canEditPrescription}
                prescriptionLabel={prescriptionLabel}
                processedLabel={t('prescription.processed')}
                unprocessedLabel={t('prescription.unprocessed')}
                deleteConfirmMessage={t('prescription.delete_confirm', { label: prescriptionLabel.toLowerCase() }) || `Bu ${prescriptionLabel.toLowerCase()}yi silmek istediğinize emin misiniz?`}
                receiptRef={receiptRef}
                isProcessingPdf={isProcessingPdf}
                isDeleteModalOpen={isDeleteModalOpen}
                showProfitId={showProfitId}
                hideProfitAnalysis={hideCostAndProfit}
                prescriptions={contextPrescriptions}
                inventory={contextInventory}
                onBackToList={() => { setDetailPrescription(null); changeViewMode('LIST'); }}
                onToggleProcessed={toggleProcessed}
                onShowProfit={setShowProfitId}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPdfAction={handlePdfAction}
                onWhatsAppText={handleWhatsAppText}
                onCloseDeleteModal={() => { setIsDeleteModalOpen(false); setPrescriptionToDelete(null); }}
                onConfirmDelete={confirmDelete}
            />
        );
    }

    return (
        <div className="p-2.5 sm:p-4 max-w-3xl mx-auto pb-28 sm:pb-24 animate-in slide-in-from-right duration-200">
            <div className="flex items-center mb-3 sm:mb-6">
                 <button onClick={handleBackFromForm} className="mr-2 sm:mr-4 text-stone-400 hover:text-stone-200 flex items-center text-xs sm:text-sm font-bold">
                    <X size={16} className="mr-1" /> İptal
                 </button>
                 <div className="flex-1 h-1.5 sm:h-2 bg-stone-800 rounded-full overflow-hidden mx-2 sm:mx-4">
                     <div className={`h-full bg-emerald-600 transition-all duration-300 ${step === 1 ? 'w-1/5' : (step === 2 ? 'w-2/5' : (step === 3 ? 'w-3/5' : (step === 4 ? 'w-4/5' : 'w-full')))}`}></div>
                 </div>
                 <span className="font-black text-emerald-500 text-xs sm:text-sm whitespace-nowrap">Adım {step}/5</span>
            </div>

            {/* Smart bar: BKTS/GTS mode, hold cart, voice, tank mix & holder tank summary */}
            <div className="mb-4 sm:mb-5 space-y-1.5 sm:space-y-2">
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                    <div className="flex bg-stone-900 border border-white/5 rounded-full p-0.5 text-[10px] sm:text-[11px] font-black">
                        <button
                            onClick={() => setSaleRegistryMode('BKTS')}
                            aria-pressed={saleRegistryMode === 'BKTS'}
                            className={`px-2.5 sm:px-3 py-1 min-h-[30px] sm:min-h-[36px] rounded-full transition-colors ${saleRegistryMode === 'BKTS' ? 'bg-emerald-600 text-stone-950' : 'text-stone-400 hover:text-stone-200'}`}
                        >BKTS/GTS Kayıtlı Satış</button>
                        <button
                            onClick={() => setSaleRegistryMode('FREE')}
                            aria-pressed={saleRegistryMode === 'FREE'}
                            className={`px-2.5 sm:px-3 py-1 min-h-[30px] sm:min-h-[36px] rounded-full transition-colors ${saleRegistryMode === 'FREE' ? 'bg-stone-700 text-stone-100' : 'text-stone-400 hover:text-stone-200'}`}
                        >Kayıtsız Serbest Satış</button>
                    </div>
                    {saleRegistryMode === 'BKTS' && (
                        <button
                            onClick={() => (window as any).mks_open_ministry?.('satis')}
                            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-[11px] font-black hover:bg-emerald-500/20 transition-colors"
                        ><ShieldCheck size={12} /> BKTS Defteri</button>
                    )}
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={() => setIsTemplateModalOpen(true)}
                        title="Hazır Reçete Şablonları (#12)"
                        className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[9px] sm:text-[10px] font-black hover:bg-indigo-500/20 transition-colors"
                    >
                        <Bookmark size={11} /> Şablonlar {templates.length > 0 ? `(${templates.length})` : ''}
                    </button>
                    {selectedItems.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsSaveTemplateOpen(true)}
                            title="Mevcut Reçeteyi Şablon Olarak Kaydet (#12)"
                            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[9px] sm:text-[10px] font-black hover:bg-emerald-500/20 transition-colors"
                        >
                            <Save size={11} /> Şablon Kaydet
                        </button>
                    )}
                    <button
                        onClick={toggleHeldCart}
                        disabled={selectedItems.length === 0 && !hasHeldCart}
                        title="Müşteri Beklet / Çağır"
                        className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] font-black transition-colors disabled:opacity-40 ${hasHeldCart ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-stone-900 border-white/5 text-stone-300 hover:bg-stone-800'}`}
                    >
                        {hasHeldCart && selectedItems.length === 0 ? <Play size={11} /> : <Pause size={11} />}
                        {hasHeldCart && selectedItems.length === 0 ? 'Müşteri Çağır' : hasHeldCart ? 'Beklet ⇄ Çağır' : 'Müşteri Beklet'}
                    </button>
                    <button
                        onClick={startVoiceCommand}
                        disabled={isListening}
                        title="Sesli Komut (çiftçi veya ürün adı söyleyin)"
                        aria-label="Sesli Komut"
                        className={`p-1.5 sm:p-2 rounded-full border transition-colors ${isListening ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse' : 'bg-stone-900 border-white/5 text-stone-300 hover:bg-stone-800'}`}
                    ><Mic size={13} /></button>
                </div>

                {/* BKTS/GTS kayıtlı satış ön koşulları: çiftçi TCKN/VKN + opsiyonel B-Reçete kodu (B-02) */}
                {saleRegistryMode === 'BKTS' ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 space-y-2">
                        {selectedFarmer ? (() => {
                            const fr = farmerMap[selectedFarmer.id] || selectedFarmer;
                            const tc = validateTcOrVkn(fr.tcNo);
                            const ok = tc.isValid && tc.status !== 'EMPTY';
                            return (
                                <div className={`flex items-start gap-2 text-[11px] leading-snug ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {ok ? <ShieldCheck size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                                    <span>
                                        {ok
                                            ? <>Çiftçi {tc.status === 'VALID_VKN' ? 'VKN' : 'TCKN'} doğrulandı: <b className="font-mono">{String(fr.tcNo).trim()}</b></>
                                            : tc.status === 'EMPTY'
                                                ? <>BKTS kayıtlı satış için <b>{fr.fullName}</b> adlı çiftçinin T.C. Kimlik No / VKN bilgisi gerekli. Çiftçi kartına ekleyin veya <b>Kayıtsız Serbest Satış</b> seçin.</>
                                                : <>Çiftçinin T.C. Kimlik No / VKN geçersiz ({tc.message}). Çiftçi kartından düzeltin.</>}
                                    </span>
                                </div>
                            );
                        })() : (
                            <p className="text-[11px] text-stone-400">BKTS kayıtlı satış: çiftçinin TCKN/VKN'si doğrulanır, karekoddaki GTIN • Lot • SKT • Seri No faturaya ve BKTS defterine işlenir.</p>
                        )}
                        {bReceteEnabled && (
                            <label className="flex items-center gap-2 bg-stone-900 border border-white/10 rounded-lg px-2.5 min-h-[44px] focus-within:border-emerald-500/50">
                                <FileText size={14} className="text-emerald-400 shrink-0" />
                                <span className="text-[11px] font-black text-stone-400 uppercase whitespace-nowrap">B-Reçete Kodu</span>
                                <input
                                    type="text"
                                    value={bReceteCode}
                                    onChange={e => setBReceteCode(e.target.value)}
                                    placeholder="Opsiyonel"
                                    autoComplete="off"
                                    className="flex-1 min-w-0 bg-transparent outline-none text-sm text-stone-100 font-mono placeholder:text-stone-600"
                                />
                            </label>
                        )}
                    </div>
                ) : (
                    <p className="text-[11px] text-stone-400 px-1">Kayıtsız serbest satış: kayıt defterde <b className="text-stone-300">"Kayıtsız Serbest Satış"</b> olarak tutulur ve Bakanlık dışa aktarımına dahil edilmez.</p>
                )}

                {tankMix && (tankMix.warnings.length > 0 ? (
                    <div className={`rounded-xl border p-2.5 text-xs ${tankMix.compatible ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'}`}>
                        <div className="flex items-center gap-1.5 font-black mb-1">
                            <AlertTriangle size={14} /> {tankMix.compatible ? 'Tank Karışımı Dikkat' : 'Tank Karışımı Uyumsuz!'}
                        </div>
                        {tankMix.warnings.map((w, i) => (
                            <p key={i} className="leading-snug opacity-90"><b>{w.title}</b> ({w.items.join(' + ')}): {w.message}</p>
                        ))}
                    </div>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black">
                        <Check size={12} /> Tank Karışımı Uyumlu
                    </span>
                ))}

                {selectedItems.length > 0 && (
                    <div className="bg-stone-900/70 border border-white/5 rounded-xl p-2.5 text-[11px] text-stone-300">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <span><b className="text-stone-100">{selectedItems.length}</b> kalem • <b className="text-stone-100">{cartUnitCount.toLocaleString('tr-TR')}</b> adet • ~<b className="text-stone-100">{cartEstimatedKg.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</b> kg</span>
                            <div className="flex items-center gap-1 ml-auto">
                                <Droplets size={12} className="text-sky-400" />
                                {HOLDER_TANKS.map(l => (
                                    <button
                                        key={l}
                                        onClick={() => setHolderTankL(l)}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${holderTankL === l ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-stone-500 hover:text-stone-300'}`}
                                    >{l}L</button>
                                ))}
                            </div>
                        </div>
                        {holderTankDoses.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {holderTankDoses.map((d, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded-md bg-sky-500/5 border border-sky-500/10 text-sky-200 text-[10px]">{d.name}: <b>{d.text}</b></span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {step === 1 && (
                <div className="pb-24">
                    <div className="flex items-center justify-center mb-3 sm:mb-4">
                        <h2 className="text-base sm:text-xl font-black text-stone-100 text-center tracking-tight">
                            {editingId ? `${currentPrescriptionLabel} Düzenle: ${farmerLabel}` : `${currentPrescriptionLabel} Oluştur: ${farmerLabel} Seçimi`}
                        </h2>
                    </div>
                    
                    <div className="bg-stone-900 rounded-xl sm:rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-3 sm:mb-4">
                        <Search className="text-stone-500 ml-2.5 sm:ml-3 shrink-0" size={16} />
                        <input 
                            type="text" 
                            placeholder={`${farmerLabel} adı veya köy ile ara...`} 
                            className="w-full p-2 sm:p-2.5 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-xs sm:text-sm"
                            value={farmerSearchTerm}
                            onChange={e => setFarmerSearchTerm(e.target.value)}
                        />
                        {farmerSearchTerm && (
                            <button onClick={() => setFarmerSearchTerm('')} className="p-1.5 text-stone-500 hover:text-stone-300">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                        <div className="space-y-1.5 sm:space-y-2">
                            <label className="text-[9px] sm:text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1 text-center block w-full">{farmerLabel} Listesi</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 max-h-[450px] overflow-y-auto pr-1 no-scrollbar">
                                {filteredFarmers.map(f => (
                                    <button 
                                        key={f.id} 
                                        onClick={() => { setSelectedFarmer(f); setSelectedFieldId(''); changeStep(2); }}
                                        className={`w-full text-left p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border flex justify-between items-center group transition-all ${
                                            selectedFarmer?.id === f.id
                                            ? 'bg-emerald-900/20 border-emerald-500 shadow-lg shadow-emerald-900/10'
                                            : 'bg-stone-900 border-white/5 hover:border-emerald-500/50 hover:bg-stone-800/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors shrink-0 ${selectedFarmer?.id === f.id ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 group-hover:bg-emerald-900/30 group-hover:text-emerald-500'}`}>
                                                <User size={16} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="font-bold text-stone-100 block text-xs sm:text-sm group-hover:text-emerald-400 truncate">{f.fullName}</span>
                                                <span className="text-[9px] sm:text-[10px] text-stone-500 flex items-center mt-0.5 truncate"><MapPin size={9} className="mr-1 shrink-0"/> {f.village}</span>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className={`shrink-0 ml-1 ${selectedFarmer?.id === f.id ? 'text-emerald-500' : 'text-stone-700'}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <CropSelectorStep
                    selectedFarmer={selectedFarmer}
                    selectedCrop={selectedCrop}
                    setSelectedCrop={setSelectedCrop}
                    cropSearchTerm={cropSearchTerm}
                    setCropSearchTerm={setCropSearchTerm}
                    farmerCrops={farmerCrops}
                    filteredCropsList={filteredCropsList}
                    contextPlants={contextPlants}
                    setSelectedPlantId={setSelectedPlantId}
                    hapticFeedback={hapticFeedback}
                    onChangeStep={changeStep}
                />
            )}

            {step === 3 && (
                <div className="pb-28 sm:pb-24">
                    <h2 className="text-base sm:text-xl font-black mb-3 sm:mb-4 text-stone-100 text-center tracking-tight">
                        {editingId ? `${currentPrescriptionLabel} Düzenle: İlaçlar` : 'İlaç Seç'}
                    </h2>

                    <div className="mb-3 sm:mb-4 flex gap-2">
                        <button
                            onClick={() => setIsScanning(true)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black rounded-xl p-2.5 sm:p-3 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all group"
                        >
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-950 group-hover:scale-110 transition-transform">
                                <Barcode size={18} />
                            </div>
                            <span className="text-xs sm:text-sm">Kamerayla Hızlı Ekle (POS)</span>
                        </button>
                    </div>
                    
                    <div className="bg-stone-900 rounded-xl sm:rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-3 sm:mb-4">
                        <Search className="text-stone-500 ml-2.5 sm:ml-3 shrink-0" size={16} />
                        <input 
                            type="text" 
                            placeholder="İlaç adı veya etken madde ara..." 
                            className="w-full p-2 sm:p-2.5 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-xs sm:text-sm"
                            value={pesticideSearchTerm}
                            onChange={e => setPesticideSearchTerm(e.target.value)}
                        />
                        <button 
                            onClick={() => setShowRecommendations(true)}
                            className={`p-2 rounded-lg sm:rounded-xl ml-1 transition-colors relative mr-1 hover:scale-105 active:scale-95 ${recommendedIds.length > 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
                            title="Ürün Tavsiyeleri"
                        >
                            <Lightbulb size={16} />
                            {recommendedIds.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-stone-900"></span>
                            )}
                        </button>
                        <button 
                            onClick={() => setIsScanning(true)}
                            className="p-2 bg-stone-800 text-stone-300 rounded-lg sm:rounded-xl mr-1 hover:bg-stone-700 transition-colors"
                            title="Barkod Okut"
                        >
                            <Barcode size={16} />
                        </button>
                        {pesticideSearchTerm && (
                            <button onClick={() => setPesticideSearchTerm('')} className="p-1.5 text-stone-500 hover:text-stone-300">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="mb-4 sm:mb-8">
                        <label className="text-[9px] sm:text-xs font-bold text-stone-500 mb-2 sm:mb-3 block uppercase tracking-widest">Depodan Seç</label>
                        <div className="grid grid-cols-1 gap-1.5 sm:gap-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                            {filteredInventoryItems.length > 0 ? (
                                filteredInventoryItems.map(inv => {
                                    const p = pesticides.find(pest => pest.id === inv.pesticideId) || {
                                        id: inv.pesticideId,
                                        name: inv.pesticideName,
                                        activeIngredient: 'Bilinmiyor',
                                        defaultDosage: '100ml/100L',
                                        category: inv.category,
                                        description: 'Depo ürünü'
                                    } as Pesticide;
                                    
                                    const isSelected = selectedItems.some(i => i.pesticide.id === p.id);
                                    return (
                                        <div 
                                            key={inv.id}
                                            className={`w-full text-left p-2 sm:p-2.5 rounded-xl border transition-all flex justify-between items-center ${
                                                isSelected 
                                                ? 'bg-stone-800/50 border-emerald-900/30' 
                                                : 'bg-stone-900 border-white/5 hover:border-emerald-500/30 hover:bg-stone-800'
                                            }`}
                                        >
                                            <div 
                                                className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 cursor-pointer"
                                                onClick={() => !isSelected && addItem(p)}
                                            >
                                                <div className="p-1.5 sm:p-2 bg-stone-800 rounded-lg text-stone-400 group-hover:text-emerald-400 shrink-0">
                                                    <Package size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                                        <span className={`font-bold block text-xs sm:text-sm truncate ${isSelected ? 'text-stone-500' : 'text-stone-200'}`}>{inv.pesticideName}</span>
                                                        {(() => {
                                                            const dLeft = getExpiryDaysLeft(inv.expiryDate);
                                                            if (dLeft === null) return null;
                                                            if (dLeft < 0) {
                                                                return (
                                                                    <span className="text-[7.5px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                                                        ⛔ SKT GEÇMİŞ
                                                                    </span>
                                                                );
                                                            }
                                                            if (dLeft <= 90) {
                                                                return (
                                                                    <span className="text-[7.5px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                                        ⏳ FEFO: {dLeft === 0 ? 'Bugün' : `${dLeft}g`}
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        {inv.lotNumber && (
                                                            <span className="text-[7.5px] sm:text-[9px] font-mono text-stone-400 bg-stone-800 px-1 py-0.5 rounded">
                                                                Lot: {inv.lotNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[8.5px] sm:text-[10px] text-stone-500 font-mono block truncate">Stok: {inv.quantity} {inv.unit} | Fiyat: {formatCurrency(inv.sellingPrice, userProfile?.currency || 'TRY')}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                                <button
                                                    onClick={(e) => toggleRecommendation(p.id, e)}
                                                    className={`p-1.5 sm:p-2 rounded-lg transition-colors active:scale-90 ${recommendedIds.includes(p.id) ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' : 'text-stone-600 hover:text-amber-400 hover:bg-stone-700/50'}`}
                                                    title={recommendedIds.includes(p.id) ? "Tavsiyelerden Çıkar" : "Tavsiyelere Ekle"}
                                                >
                                                    <Star size={15} fill={recommendedIds.includes(p.id) ? "currentColor" : "none"} />
                                                </button>
                                                <button
                                                    onClick={() => !isSelected && addItem(p)}
                                                    disabled={isSelected}
                                                    className={`p-1.5 sm:p-2 rounded-lg transition-colors min-w-[34px] sm:min-w-[44px] flex items-center justify-center ${isSelected ? 'text-emerald-500 bg-emerald-500/10 opacity-50 cursor-not-allowed' : 'text-stone-200 bg-stone-800 hover:bg-emerald-600'}`}
                                                >
                                                    {isSelected ? <Check size={15} /> : <Plus size={15} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-6 text-stone-600 border border-dashed border-stone-800 rounded-xl">
                                    <p className="text-xs">Depoda uygun ilaç bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 w-full p-2.5 sm:p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-[var(--mks-canvas-bg)] via-[var(--mks-canvas-bg)] to-transparent pb-4 sm:pb-6">
                        <div className="max-w-3xl mx-auto">
                             {selectedItems.length > 0 && (
                                 <div className="mb-2 sm:mb-4 flex items-center gap-1.5 sm:gap-2 animate-in slide-in-from-bottom-4 duration-300">
                                     <div className="flex-1 min-w-0 bg-stone-900/90 backdrop-blur-md border border-white/5 rounded-xl p-1 sm:p-1.5 overflow-x-auto no-scrollbar flex items-center gap-1.5">
                                         <span className="text-[9.5px] sm:text-[11px] font-black text-stone-500 uppercase tracking-widest ml-1 shrink-0">Seçilen:</span>
                                         {selectedItems.map((item) => (
                                             <div key={item.pesticide.id} className="bg-emerald-500/10 text-emerald-300 text-[9.5px] sm:text-[11px] font-bold pl-2 rounded-lg border border-emerald-500/20 whitespace-nowrap flex items-center gap-1 min-h-[32px] sm:min-h-[44px] shrink-0">
                                                 <span className="max-w-[100px] sm:max-w-[140px] truncate">{item.pesticide.name}</span>
                                                 <span className="text-stone-400 font-mono">×{item.quantity || '0'}</span>
                                                 <button
                                                     onClick={() => removeItem(item.pesticide.id)}
                                                     aria-label={`${item.pesticide.name} ürününü çıkar`}
                                                     title="Sepetten çıkar"
                                                     className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-0.5"
                                                 ><X size={12} /></button>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}
                             <button 
                                disabled={selectedItems.length === 0}
                                onClick={() => changeStep(4)}
                                className="w-full bg-emerald-600 text-white py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-lg shadow-lg shadow-emerald-900/40 disabled:opacity-50 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center border border-emerald-500/20"
                             >
                                İlaç Detaylarını Gir <Check size={18} className="ml-1.5" />
                             </button>
                        </div>
                    </div>

                    {showRecommendations && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
                            <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm" onClick={() => setShowRecommendations(false)}></div>
                            <div className="bg-stone-900 border border-stone-800 w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                                <div className="p-4 border-b border-stone-800 bg-amber-500/5 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2 text-amber-500">
                                        <Lightbulb size={20} />
                                        <h3 className="font-bold text-stone-100">Ürün Tavsiyeleri & Notlar</h3>
                                    </div>
                                    <button onClick={() => setShowRecommendations(false)} className="text-stone-400 hover:text-white p-1 rounded-full"><X size={20}/></button>
                                </div>
                                <div className="p-4 overflow-y-auto flex-1 space-y-2 no-scrollbar">
                                    {recommendedIds.length === 0 ? (
                                        <div className="text-center py-10 opacity-50 px-4">
                                            <Star size={32} className="mx-auto mb-4 text-stone-500" />
                                            <p className="text-sm text-stone-400 font-medium">Henüz notlarına eklediğin bir ürün yok.</p>
                                            <p className="text-xs text-stone-500 mt-2">Depodan seçerken yıldız (⭐) butonuna basarak unutmamak için ürün ekleyebilirsin.</p>
                                        </div>
                                    ) : (
                                        recommendedIds.map(rid => {
                                           const pInfo = pesticides.find(p => p.id === rid); 
                                           if (!pInfo) return null;
                                           const invItem = contextInventory.find(inv => inv.pesticideId === rid);
                                           const isSelected = selectedItems.some(i => i.pesticide.id === rid);

                                            return (
                                                <div key={rid} className="w-full text-left p-3 rounded-xl bg-stone-800/30 border border-stone-800 flex justify-between items-center group">
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <span className="font-bold text-stone-200 block text-sm truncate">{pInfo.name}</span>
                                                        {invItem ? (
                                                            <span className="text-[10px] text-emerald-500 font-mono block truncate">Stokta Var: {invItem.quantity} {invItem.unit}</span>
                                                        ) : (
                                                            <span className="text-[10px] text-rose-500 font-mono block truncate">Depoda Yok</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button 
                                                            onClick={() => toggleRecommendation(rid)}
                                                            className="p-2 text-stone-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                            title="Notlardan Sil"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        {invItem && (
                                                            <button
                                                                onClick={() => {
                                                                    if (!isSelected) {
                                                                        addItem(pInfo);
                                                                    } else {
                                                                        removeItem(pInfo.id);
                                                                    }
                                                                }}
                                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isSelected ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                                                            >
                                                                {isSelected ? 'Çıkar' : 'Ekle'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {step === 4 && (
                <div>
                     <h2 className="text-base sm:text-xl font-black mb-3 sm:mb-4 text-stone-100 text-center tracking-tight">
                        İlaç Detayları
                    </h2>
                    <div className="space-y-2.5 sm:space-y-3 pb-36 sm:pb-40">
                        {/* Horizontal Controls Row */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            {/* Invoice No */}
                            <div className="flex-1 flex items-center space-x-1 bg-stone-900 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-xl border border-white/5 shadow-inner min-w-0">
                                <span className="text-[7.5px] sm:text-[8px] text-stone-500 font-black uppercase tracking-tighter whitespace-nowrap">NO:</span>
                                <input 
                                    type="text" 
                                    value={customPrescriptionNo}
                                    onChange={(e) => setCustomPrescriptionNo(e.target.value)}
                                    placeholder="OTO"
                                    className="bg-transparent border-none text-[9.5px] sm:text-[10px] text-stone-100 w-full focus:ring-0 p-0 placeholder:text-stone-700 outline-none font-black truncate"
                                />
                            </div>

                            {/* Payment Type Toggle */}
                            <div className="flex-1 flex items-center bg-stone-900 rounded-xl border border-white/5 p-0.5">
                                <button
                                    onClick={() => handlePriceTypeChange('CASH')}
                                    className={`flex-1 py-1 sm:py-1.5 text-[7.5px] sm:text-[8px] font-black rounded-lg transition-all ${prescriptionPriceType === 'CASH' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-500'}`}
                                >
                                    PEŞİN
                                </button>
                                <button
                                    onClick={() => handlePriceTypeChange('TERM')}
                                    className={`flex-1 py-1 sm:py-1.5 text-[7.5px] sm:text-[8px] font-black rounded-lg transition-all ${prescriptionPriceType === 'TERM' ? 'bg-stone-700 text-white shadow-lg' : 'text-stone-500'}`}
                                >
                                    VADE
                                </button>
                            </div>
                            
                             {/* Account Selection for CASH or Due Date for TERM */}
                            {prescriptionPriceType === 'CASH' ? (
                                <div className="flex-1 flex items-center space-x-1 bg-stone-900 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-xl border border-emerald-500/30 shadow-inner min-w-0">
                                    <Landmark size={10} className="text-emerald-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[6.5px] sm:text-[7px] font-black text-emerald-400 uppercase tracking-tighter leading-none mb-0.5">HESAP / KASA</p>
                                        <select
                                            value={prescriptionAccountId || (accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id || '')}
                                            onChange={(e) => setPrescriptionAccountId(e.target.value)}
                                            className="bg-transparent border-none text-[8.5px] sm:text-[9px] text-stone-100 font-black w-full focus:ring-0 p-0 outline-none cursor-pointer truncate"
                                        >
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id} className="bg-stone-900 text-stone-100">
                                                    {acc.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: userProfile?.currency || 'TRY' }).format(acc.balance)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center space-x-1 bg-stone-900 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-xl border border-white/5 shadow-inner transition-all duration-300 min-w-0">
                                    <Calendar size={10} className="text-amber-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[6.5px] sm:text-[7px] font-black text-stone-500 uppercase tracking-tighter leading-none mb-0.5">VADE</p>
                                        <div className="text-[8.5px] sm:text-[9px] text-stone-200 font-black truncate relative">
                                            <input
                                                type="date"
                                                value={prescriptionDueDate}
                                                onChange={(e) => {
                                                    setPrescriptionDueDate(e.target.value);
                                                    setIsManualDueDate(true);
                                                }}
                                                className="bg-transparent border-none text-[8.5px] sm:text-[9px] text-stone-200 font-black w-full focus:ring-0 p-0 outline-none relative z-10"
                                                style={{ colorScheme: 'dark' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* #28 Kredi Limiti Aşım Uyarısı */}
                        {prescriptionType === 'SALE' && prescriptionPriceType === 'TERM' && selectedFarmer?.creditLimit && selectedFarmer.creditLimit > 0 && (() => {
                            const curDebt = Math.max(0, getFarmerNetDebt(selectedFarmer.id));
                            const draftSum = Math.max(0, selectedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0) - (parseFloat(prescriptionDiscount.replace(',', '.')) || 0));
                            const afterDebt = curDebt + draftSum;
                            if (afterDebt <= selectedFarmer.creditLimit) return null;
                            const overBy = afterDebt - selectedFarmer.creditLimit;
                            return (
                                <div className="rounded-xl sm:rounded-2xl border border-rose-500/40 bg-rose-500/10 p-2.5 sm:p-3.5 text-xs text-rose-200 shadow-md">
                                    <div className="flex items-center gap-1.5 font-black text-rose-300 text-xs sm:text-sm mb-1">
                                        <AlertTriangle size={14} /> KREDİ LİMİTİ AŞIM UYARISI!
                                    </div>
                                    <p className="leading-relaxed text-[11px] sm:text-xs">
                                        <b>{selectedFarmer.fullName}</b> için tanımlı kredi limiti <b>{formatCurrency(selectedFarmer.creditLimit, userProfile?.currency || 'TRY')}</b>.
                                        Mevcut borç (<b>{formatCurrency(curDebt, userProfile?.currency || 'TRY')}</b>) ve bu vadeli satış (<b>{formatCurrency(draftSum, userProfile?.currency || 'TRY')}</b>) ile toplam risk <b>{formatCurrency(afterDebt, userProfile?.currency || 'TRY')}</b> olacak (Limit aşımı: <b className="text-rose-300">+{formatCurrency(overBy, userProfile?.currency || 'TRY')}</b>).
                                    </p>
                                </div>
                            );
                        })()}

                        {/* #23 İade Ürünlerini Karantina Stoğuna Ayırma */}
                        {prescriptionType === 'RETURN' && (
                            <div className="rounded-xl sm:rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2.5 sm:p-3.5 space-y-2">
                                <label className="flex items-center justify-between cursor-pointer gap-2">
                                    <div>
                                        <span className="text-[11px] sm:text-xs font-black text-amber-300 block">⚠️ İade Ürünleri Karantina Stoğuna Ayır (#23)</span>
                                        <span className="text-[9px] sm:text-[10px] text-stone-300 block mt-0.5">Açık ambalaj veya SKT yakın iadeleri karantinada bekletir.</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={quarantineReturnEnabled}
                                        onChange={e => setQuarantineReturnEnabled(e.target.checked)}
                                        className="w-4 h-4 sm:w-5 sm:h-5 accent-amber-500 rounded cursor-pointer shrink-0"
                                    />
                                </label>
                                {quarantineReturnEnabled && (
                                    <input
                                        type="text"
                                        value={quarantineReturnReason}
                                        onChange={e => setQuarantineReturnReason(e.target.value)}
                                        placeholder="Karantina nedeni..."
                                        className="w-full bg-stone-950 border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs text-stone-100 outline-none focus:border-amber-400"
                                    />
                                )}
                            </div>
                        )}

                        {selectedItems.map((item, idx) => (
                            <div key={idx} className="bg-stone-900/80 backdrop-blur-sm p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-md sm:shadow-xl border border-white/5 relative overflow-hidden group animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                                
                                <div className="flex items-start justify-between gap-2.5 sm:gap-4 relative z-10">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-2 sm:mb-3">
                                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            <h4 className="font-black text-stone-100 text-xs sm:text-sm tracking-tight truncate">{item.pesticide.name}</h4>
                                        </div>

                                        {/* İzlenebilirlik (GTIN / Lot / SKT / Seri) + stok uyarısı */}
                                        {(() => {
                                            const liveInv = contextInventory.filter(inv => !inv.deletedAt && inv.pesticideId === item.pesticide.id);
                                            const stock = round2(liveInv.reduce((a, inv) => a + (Number(inv.quantity) || 0), 0));
                                            const qty = parseQty(item.quantity);
                                            const fallbackInv = liveInv.find(inv => !item.lotNumber || inv.lotNumber === item.lotNumber) || liveInv[0];
                                            const lot = item.lotNumber || fallbackInv?.lotNumber;
                                            const exp = item.expiryDate || (fallbackInv && (!item.lotNumber || fallbackInv.lotNumber === item.lotNumber) ? fallbackInv.expiryDate : undefined);
                                            const gtin = toGtin14(item.gtin) || toGtin14(fallbackInv?.gtin) || toGtin14(fallbackInv?.barcode);
                                            const dLeft = daysUntilExpiry(exp);
                                            const qtyInvalid = item.quantity !== '' && !(qty > 0);
                                            const stockShort = prescriptionType !== 'RETURN' && qty > 0 && qty > stock;
                                            const bktsMissing = saleRegistryMode === 'BKTS' && (!gtin || !lot);
                                            if (!gtin && !lot && !exp && !item.serialNumbers?.length && !qtyInvalid && !stockShort && !bktsMissing) return null;
                                            return (
                                                <div className="mb-2 -mt-1 flex flex-wrap items-center gap-1">
                                                    {gtin && <span className="text-[9.5px] sm:text-[11px] font-mono text-stone-300 bg-stone-800 px-1 py-0.5 rounded">GTIN {gtin}</span>}
                                                    {lot && <span className="text-[9.5px] sm:text-[11px] font-mono text-stone-300 bg-stone-800 px-1 py-0.5 rounded">Lot {lot}</span>}
                                                    {exp && (
                                                        <span className={`text-[9.5px] sm:text-[11px] font-black px-1 py-0.5 rounded border ${dLeft !== null && dLeft < 0 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : dLeft !== null && dLeft <= 90 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-stone-800 text-stone-300 border-white/5'}`}>
                                                            {dLeft !== null && dLeft < 0 ? `⛔ SKT GEÇMİŞ ${exp}` : dLeft === 0 ? `SKT bugün` : `SKT ${exp}`}
                                                        </span>
                                                    )}
                                                    {item.expiredSaleReason && <span className="text-[10px] text-amber-300">Gerekçe: {item.expiredSaleReason}</span>}
                                                    {qtyInvalid && <span className="text-[10px] font-black text-rose-300">Miktar 0'dan büyük olmalı</span>}
                                                    {stockShort && <span className="text-[10px] font-black text-amber-300">⚠ Stok yetersiz ({stock})</span>}
                                                    {bktsMissing && <span className="text-[10px] font-black text-rose-300">BKTS için barkod okutun</span>}
                                                    {(item.serialNumbers || []).map(s => (
                                                        <span key={s} className="inline-flex items-center text-[9.5px] sm:text-[11px] font-mono text-sky-200 bg-sky-500/10 border border-sky-500/20 rounded-md pl-1.5">
                                                            Seri {s}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSerial(item.pesticide.id, s)}
                                                                aria-label={`Seri ${s} çıkar`}
                                                                className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-rose-400"
                                                            ><X size={12} /></button>
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[8px] sm:text-[9px] font-black text-stone-500 uppercase tracking-widest pl-1">ADET / MİKTAR</label>
                                                    {(() => {
                                                        const invPack = contextInventory.find(inv => inv.pesticideId === item.pesticide.id);
                                                        if (!invPack?.packSize || invPack.packSize <= 1) return null;
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const cur = parseFloat((item.quantity || '0').replace(',', '.')) || 0;
                                                                    updateQuantity(item.pesticide.id, String(cur + (invPack.packSize || 1)));
                                                                }}
                                                                className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                                                            >
                                                                +{invPack.packSize}
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="bg-stone-950 border border-white/5 rounded-xl overflow-hidden focus-within:border-emerald-500/40 transition-all">
                                                    <input 
                                                        type="text" 
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantity(item.pesticide.id, e.target.value)}
                                                        className="w-full p-2 sm:p-2.5 bg-transparent font-black outline-none text-stone-200 text-xs sm:text-sm text-center"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[8px] sm:text-[9px] font-black text-stone-500 uppercase tracking-widest pl-1">BİRİM FİYAT</label>
                                                <div className="bg-stone-950 border border-white/5 rounded-xl overflow-hidden focus-within:border-amber-500/40 transition-all">
                                                    <input 
                                                        type="text" 
                                                        value={item.unitPrice || ''}
                                                        onChange={(e) => updatePrice(item.pesticide.id, e.target.value)}
                                                        className="w-full p-2 sm:p-2.5 bg-transparent font-black outline-none text-stone-200 text-xs sm:text-sm text-center"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end justify-between h-[85px] sm:h-[100px] shrink-0">
                                        <button 
                                            onClick={() => removeItem(item.pesticide.id)} 
                                            aria-label={`${item.pesticide.name} ürününü çıkar`}
                                            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg sm:rounded-xl transition-all active:scale-95 shadow-sm"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                        <div className="text-right">
                                            <p className="text-[7.5px] sm:text-[8px] font-black text-stone-500 uppercase tracking-widest leading-none mb-0.5">ARA TOPLAM</p>
                                            <span className="text-xs sm:text-base font-black text-emerald-400 font-mono tracking-tighter block leading-none">
                                                {formatCurrency(item.totalPrice || 0, userProfile?.currency || 'TRY')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {selectedItems.length === 0 && (
                            <div className="text-center py-10 border-2 border-dashed border-stone-800 rounded-2xl text-stone-600 bg-stone-900/20">
                                <FlaskConical size={28} className="mx-auto mb-2 opacity-20" />
                                <p className="text-xs">Hiç ilaç seçilmedi.</p>
                            </div>
                        )}
                    </div>

                    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 w-full p-2.5 sm:p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-[var(--mks-canvas-bg)] via-[var(--mks-canvas-bg)] to-transparent pb-4 sm:pb-6">
                        <div className="max-w-3xl mx-auto">
                             <button 
                                disabled={selectedItems.length === 0}
                                onClick={() => changeStep(5)}
                                className="w-full bg-emerald-600 text-white py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-lg shadow-lg shadow-emerald-900/40 disabled:opacity-50 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center border border-emerald-500/20"
                             >
                                Devam Et <Check size={18} className="ml-1.5" />
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 5 && (
                <div className="pb-28 sm:pb-24">
                    <h2 className="text-base sm:text-xl font-black mb-3 sm:mb-6 text-stone-100 text-center tracking-tight">Önizleme ve Onay</h2>
                    {prescriptionType === 'SALE' && prescriptionPriceType === 'TERM' && selectedFarmer?.creditLimit && selectedFarmer.creditLimit > 0 && (() => {
                        const curDebt = Math.max(0, getFarmerNetDebt(selectedFarmer.id));
                        const draftSum = Math.max(0, selectedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0) - (parseFloat(prescriptionDiscount.replace(',', '.')) || 0));
                        const afterDebt = curDebt + draftSum;
                        if (afterDebt <= selectedFarmer.creditLimit) return null;
                        return (
                            <div className="mb-3 sm:mb-4 rounded-xl sm:rounded-2xl border border-rose-500/40 bg-rose-500/10 p-2.5 sm:p-3.5 text-xs text-rose-200 flex items-start gap-2">
                                <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-black text-rose-300 block text-xs">Kredi Limiti Aşılıyor!</span>
                                    <span className="text-[11px]">Limit: {formatCurrency(selectedFarmer.creditLimit, userProfile?.currency || 'TRY')} • Risk: <b>{formatCurrency(afterDebt, userProfile?.currency || 'TRY')}</b></span>
                                </div>
                            </div>
                        );
                    })()}
                    {prescriptionType === 'RETURN' && quarantineReturnEnabled && (
                        <div className="mb-3 sm:mb-4 rounded-xl sm:rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2.5 sm:p-3 text-xs text-amber-200 font-bold">
                            ⚠️ İade edilen ürünler <b>Karantina Stoğuna</b> ayrılacak ({quarantineReturnReason.trim() || 'Müşteri İadesi'}).
                        </div>
                    )}
                    <div className={`mb-3 sm:mb-4 rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 text-xs font-bold flex items-start gap-2 ${saleRegistryMode === 'BKTS' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-stone-900 text-stone-300'}`}>
                        {saleRegistryMode === 'BKTS' ? <ShieldCheck size={15} className="shrink-0 text-emerald-400" /> : <AlertCircle size={15} className="shrink-0 text-stone-400" />}
                        <span className="text-[11px] sm:text-xs">
                            {saleRegistryMode === 'BKTS'
                                ? <>BKTS/GTS Kayıtlı Satış — Bakanlık defterine aktarıma hazır.{bReceteEnabled && bReceteCode.trim() ? <> B-Reçete: <b className="font-mono">{bReceteCode.trim()}</b></> : null}</>
                                : <>Kayıtsız Serbest Satış — defterde kayıtlı tutulur, Bakanlığa aktarılmaz.</>}
                        </span>
                    </div>
                    <div className="bg-stone-900 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-white/5 mb-4 sm:mb-6">
                         <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                             <div>
                                 <p className="text-xs text-stone-500">{farmerLabel}</p>
                                 <p className="font-bold text-sm sm:text-lg text-stone-200">{selectedFarmer?.fullName}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-xs text-stone-500">Tarih</p>
                                 <p className="font-medium text-xs sm:text-sm text-stone-300">{new Date().toLocaleDateString()}</p>
                             </div>
                         </div>
                         {selectedCrop && (
                             <div className="mb-3 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                                 <div className="flex items-center gap-1.5">
                                     <Sprout size={14} className="text-emerald-400" />
                                     <span className="text-[11px] text-stone-400 font-medium">Mahsul:</span>
                                     <span className="text-[11px] font-black text-emerald-400">{selectedCrop}</span>
                                 </div>
                                 <span className="text-[9px] font-bold text-emerald-500/80 bg-emerald-500/20 px-1.5 py-0.5 rounded-md">Ürün Bazlı</span>
                             </div>
                         )}
                         <div className="space-y-1.5">
                             {selectedItems.map((item, idx) => (
                                 <div key={idx} className="flex justify-between py-1.5 border-b border-white/5 last:border-0 items-center">
                                     <div className="min-w-0 flex-1 pr-2">
                                         <span className="font-bold text-xs sm:text-sm text-stone-300 block truncate">{item.pesticide.name}</span>
                                         {item.quantity && <span className="text-[10px] text-stone-400 font-bold bg-stone-950 px-1.5 py-0.5 rounded inline-block mt-0.5">{item.quantity.toString().replace(/^-/, '')} Adet</span>}
                                         {(item.lotNumber || (item.serialNumbers?.length || 0) > 0) && (
                                             <span className="text-[9.5px] text-stone-500 font-mono block mt-0.5">
                                                 {[item.lotNumber ? `Lot ${item.lotNumber}` : '', item.expiryDate ? `SKT ${item.expiryDate}` : '', item.serialNumbers?.length ? `${item.serialNumbers.length} seri` : ''].filter(Boolean).join(' • ')}
                                             </span>
                                         )}
                                     </div>
                                     <div className="text-right shrink-0">
                                         <span className="font-bold text-xs text-stone-300 block">{item.dosage}</span>
                                         <div className="flex flex-col items-end mt-0.5">
                                             {item.totalPrice && item.totalPrice > 0 ? (
                                                 <span className="text-xs sm:text-sm text-emerald-400 font-mono font-bold block">
                                                     {formatCurrency(item.totalPrice, userProfile?.currency || 'TRY')}
                                                 </span>
                                             ) : null}
                                         </div>
                                     </div>
                                 </div>
                             ))}
                             
                             {/* Toplam Tutar Gösterimi */}
                             {selectedItems.some(i => i.totalPrice && i.totalPrice > 0) && (() => {
                                 const initialTotal = selectedItems.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
                                 const discountValue = parseFloat(prescriptionDiscount.replace(',', '.')) || 0;
                                 const finalTotal = Math.max(0, initialTotal - discountValue);

                                 return (
                                     <div className="pt-3 border-t border-white/10 mt-3 space-y-2.5">
                                         <div className="flex justify-between items-center">
                                             <div>
                                                 <span className="font-bold text-xs sm:text-sm text-stone-300 block">TOPLAM TUTAR</span>
                                                 <span className={`text-[9px] font-black px-2 py-0.5 rounded-full mt-0.5 inline-block ${prescriptionPriceType === 'CASH' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-stone-800 text-stone-500'}`}>
                                                     {prescriptionPriceType === 'CASH' ? 'PEŞİN ' : 'VADELİ '} {prescriptionType === 'RETURN' ? 'İADE' : 'SATIŞ'}
                                                 </span>
                                             </div>
                                             <span className={`font-bold font-mono ${discountValue > 0 ? 'text-stone-500 text-xs sm:text-sm line-through' : 'text-emerald-400 text-base sm:text-lg'}`}>
                                                 {formatCurrency(initialTotal, userProfile?.currency || 'TRY')}
                                             </span>
                                         </div>
                                         
                                         <div className="flex justify-between items-center bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                                             <span className="text-[9px] sm:text-[10px] font-bold text-stone-500 uppercase tracking-widest">İskonto</span>
                                             <input 
                                                type="number"
                                                value={prescriptionDiscount}
                                                onChange={(e) => setPrescriptionDiscount(e.target.value)}
                                                className="w-24 sm:w-28 bg-stone-900 border border-stone-800 rounded-lg p-1.5 text-right font-mono font-bold text-rose-400 outline-none focus:border-rose-500 transition-colors text-xs"
                                                placeholder="0.00"
                                             />
                                         </div>

                                         {discountValue > 0 && (
                                            <div className="flex justify-between items-center pt-1">
                                                 <span className="font-black text-emerald-400 block text-sm sm:text-base tracking-tight">İNDİRİMLİ TUTAR</span>
                                                 <span className="font-black text-emerald-400 text-lg sm:text-2xl font-mono">
                                                     {formatCurrency(finalTotal, userProfile?.currency || 'TRY')}
                                                 </span>
                                            </div>
                                         )}
                                     </div>
                                 );
                             })()}
                         </div>
                    </div>
                    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 w-full p-2.5 sm:p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-[var(--mks-canvas-bg)] via-[var(--mks-canvas-bg)] to-transparent pb-4 sm:pb-6">
                        <div className="max-w-3xl mx-auto">
                            <button 
                                onClick={handleSave}
                                disabled={isSavingPrescription}
                                className="w-full bg-emerald-600 disabled:opacity-50 disabled:grayscale text-white py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:bg-emerald-700 flex items-center justify-center transition-all border border-emerald-500/20 active:scale-95"
                            >
                                {isSavingPrescription ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={24} /> Kaydediliyor...
                                    </>
                                ) : (
                                    <>
                                        <FileOutput className="mr-2" /> {editingId ? `${currentPrescriptionLabel} Güncelle` : `${currentPrescriptionLabel} Oluştur`}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isScanning && (
                <LazyBarcodeScanner 
                    onScan={(text: string, meta?: { format?: string }) => handleScan(text, meta, 'camera')} 
                    onClose={() => setIsScanning(false)} 
                    continuous={true}
                />
            )}

            <PrescriptionProfitModal
                showProfitId={showProfitId}
                prescriptions={contextPrescriptions}
                inventory={contextInventory}
                currency={userProfile?.currency}
                onClose={() => setShowProfitId(null)}
            />

            <PrescriptionCollectionModal
                isOpen={isPaymentModalOpen}
                farmers={contextFarmers}
                accounts={accounts}
                currency={userProfile?.currency}
                selectedPaymentFarmerId={selectedPaymentFarmerId}
                setSelectedPaymentFarmerId={setSelectedPaymentFarmerId}
                paymentAmount={paymentAmount}
                setPaymentAmount={setPaymentAmount}
                selectedAccountId={selectedAccountId}
                setSelectedAccountId={setSelectedAccountId}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                paymentDate={paymentDate}
                setPaymentDate={setPaymentDate}
                paymentNote={paymentNote}
                setPaymentNote={setPaymentNote}
                isSavingPayment={isSavingPayment}
                setIsSavingPayment={setIsSavingPayment}
                editingPayment={editingPayment}
                activeTeamMemberId={activeTeamMember?.id}
                updatePayment={updatePayment}
                addPayment={addPayment}
                showToast={showToast}
                hapticFeedback={hapticFeedback}
                onClose={() => {
                    setIsPaymentModalOpen(false);
                    setEditingPayment(null);
                    setPaymentAmount('');
                }}
                onSavedReset={() => {
                    setIsPaymentModalOpen(false);
                    setPaymentAmount('');
                    setPaymentNote('');
                    setSelectedPaymentFarmerId('');
                    setEditingPayment(null);
                }}
            />

            {/* #12 Hazır Reçete Şablonları Modalı */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm">
                    <div className="bg-stone-900 border border-stone-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
                        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-indigo-500/10">
                            <div className="flex items-center gap-2 text-indigo-300">
                                <Bookmark size={18} />
                                <h3 className="font-black text-sm text-stone-100">Hazır Reçete Şablonları</h3>
                            </div>
                            <button onClick={() => setIsTemplateModalOpen(false)} className="p-1.5 text-stone-400 hover:text-white rounded-full"><X size={18} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                            {templates.length === 0 ? (
                                <div className="text-center py-10 text-stone-400 text-xs">
                                    <Bookmark size={28} className="mx-auto mb-2 text-stone-600" />
                                    Henüz kayıtlı reçete şablonu yok.<br />
                                    Sepete ilaç ekledikten sonra üst çubuktaki <b>"Şablon Kaydet"</b> butonuyla şablon oluşturabilirsiniz.
                                </div>
                            ) : (
                                templates.map(tpl => (
                                    <div key={tpl.id} className="p-3.5 rounded-2xl bg-stone-950/80 border border-white/10 flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-sm text-stone-100">{tpl.name}</span>
                                                {tpl.targetCrop && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{tpl.targetCrop}</span>
                                                )}
                                                {tpl.targetDisease && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">{tpl.targetDisease}</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-stone-400 mt-1 truncate">
                                                {tpl.items.map(it => `${it.pesticideName} (${it.dosage})`).join(' • ')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTemplate(tpl.id)}
                                                className="p-2 rounded-xl text-stone-500 hover:text-rose-400 hover:bg-rose-500/10"
                                                title="Şablonu Sil"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyTemplate(tpl)}
                                                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black"
                                            >
                                                Uygula
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* #12 Şablon Olarak Kaydet Modalı */}
            {isSaveTemplateOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm">
                    <div className="bg-stone-900 border border-stone-800 w-full max-w-md rounded-3xl shadow-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-base text-stone-100 flex items-center gap-2">
                                <Save size={18} className="text-emerald-400" /> Reçeteyi Şablon Olarak Kaydet
                            </h3>
                            <button onClick={() => setIsSaveTemplateOpen(false)} className="text-stone-400 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase block mb-1">Şablon Adı *</label>
                                <input
                                    type="text"
                                    value={newTemplateName}
                                    onChange={e => setNewTemplateName(e.target.value)}
                                    placeholder="Örn: Pamuk Yaprak Biti + Yaprak Gübresi Paketi"
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-100 outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase block mb-1">Hedef Hastalık / Zararlı / Dönem (Opsiyonel)</label>
                                <input
                                    type="text"
                                    value={newTemplateDisease}
                                    onChange={e => setNewTemplateDisease(e.target.value)}
                                    placeholder="Örn: Tuta Absoluta / Çiçeklenme Dönemi"
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-100 outline-none focus:border-emerald-500"
                                />
                            </div>
                            <p className="text-[11px] text-stone-400">
                                Sepetteki <b>{selectedItems.length} kalem</b> ilaç ve dozajları{selectedCrop ? ` (${selectedCrop})` : ''} şablona kaydedilecek.
                            </p>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setIsSaveTemplateOpen(false)}
                                className="flex-1 py-2.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold"
                            >
                                Vazgeç
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAsTemplate}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black"
                            >
                                Şablonu Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={closeConfirmModal}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
            />
        </div>
    );
};
