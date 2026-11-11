import { createMultiPagePdf, renderElementToCanvas } from '../utils/pdfHelper';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Truck, Plus, Trash2, Edit2, ChevronRight, ChevronLeft, 
    Package, CreditCard, ArrowUpRight, ArrowDownRight, ArrowLeft, 
    Search, Phone, MapPin, Calendar, DollarSign, 
    AlertCircle, CheckCircle2, FlaskConical, Info, X, User, RefreshCcw,
    Receipt, Save, Barcode, Download, ArrowDownLeft, FileText, Wallet, AlertTriangle
} from 'lucide-react';
import BarcodeScanner from './LazyBarcodeScanner';
import { format } from 'date-fns';
import { useAppViewModel } from '../context/AppContext';
import { dbService } from '../services/db';
import { Supplier, SupplierPurchase, SupplierPayment, PesticideCategory, InventoryItem } from '../types';
import { formatCurrency, getCurrencySuffix } from '../utils/currency';
import { validateTcOrVkn } from '../utils/tcNoValidator';
import { ConfirmationModal } from './ConfirmationModal';
import { ListSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { turkishMatchesAny } from '../utils/search';
import { useBackHandler, useScrollLock } from '../utils/navigationManager';
import { parseGS1Barcode, findItemByScan, itemMatchesScan, canonicalBarcodeFromParsed, GS1ParseResult } from '../utils/gs1Parser';
import { playScanBeep, playErrorBeep } from '../utils/hardwareBarcodeScanner';
import { toTelHref } from '../utils/whatsappTemplates';
import { round2 } from '../utils/dateUtils';

const trToEn = (str: string) => {
    return str.replace(/Ğ/g, 'G')
        .replace(/Ü/g, 'U')
        .replace(/Ş/g, 'S')
        .replace(/İ/g, 'I')
        .replace(/Ö/g, 'O')
        .replace(/Ç/g, 'C')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
};

const pdfCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount) + ' TL';
};

export const Suppliers: React.FC<{ onBack: () => void; initialSupplierId?: string | null; }> = ({ onBack, initialSupplierId }) => {
    const { 
        suppliers, addSupplier, updateSupplier, 
        addSupplierPurchase, updateSupplierPurchase, softDeleteSupplierPurchase,
        addSupplierPayment, updateSupplierPayment, softDeleteSupplierPayment,
        softDeleteSupplier,
        inventory, addInventoryItem, showToast, hapticFeedback,
        prescriptions, supplierPurchases,
        accounts, userProfile,
        activeTeamMember,
        teamMembers,
        visits,
        isInitialized,
        myPayments
    } = useAppViewModel();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isLoading, setIsLoading] = useState(!isInitialized);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportOptions, setReportOptions] = useState({ supplierId: 'ALL', dateRange: 'ALL_TIME' });
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    // Register 1-step-at-a-time back stack & scroll lock for Suppliers
    const anySupplierModalOpen =
        isAddModalOpen || isEditModalOpen || isPurchaseModalOpen || isReturnModalOpen ||
        isSaleModalOpen || isPaymentModalOpen || isDebtModalOpen || isReportModalOpen;
    useScrollLock(anySupplierModalOpen);
    useBackHandler(isReportModalOpen, () => setIsReportModalOpen(false), 'supplier_report_modal', 70);
    useBackHandler(isPurchaseModalOpen, () => setIsPurchaseModalOpen(false), 'supplier_purchase_modal', 70);
    useBackHandler(isReturnModalOpen, () => setIsReturnModalOpen(false), 'supplier_return_modal', 70);
    useBackHandler(isSaleModalOpen, () => setIsSaleModalOpen(false), 'supplier_sale_modal', 70);
    useBackHandler(isPaymentModalOpen, () => setIsPaymentModalOpen(false), 'supplier_payment_modal', 70);
    useBackHandler(isDebtModalOpen, () => setIsDebtModalOpen(false), 'supplier_debt_modal', 70);
    useBackHandler(isEditModalOpen, () => setIsEditModalOpen(false), 'supplier_edit_modal', 70);
    useBackHandler(isAddModalOpen, () => setIsAddModalOpen(false), 'supplier_add_modal', 70);
    useBackHandler(!!selectedSupplier, () => setSelectedSupplier(null), 'supplier_detail_view', 55);
    
    useEffect(() => {
        if (isInitialized && initialSupplierId) {
            const supplier = suppliers.find(s => s.id === initialSupplierId);
            if (supplier) {
                setSelectedSupplier(supplier);
            }
        }
    }, [initialSupplierId, isInitialized, suppliers]);

    useEffect(() => {
        if (isInitialized) {
            setIsLoading(false);
        }
    }, [isInitialized]);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    // Form States
    const [newSupplier, setNewSupplier] = useState({ name: '', phoneNumber: '', tcNo: '', address: '' });
    const [newPayment, setNewPayment] = useState({ amount: '', method: 'CASH' as any, note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0, type: 'PAY' as 'PAY' | 'RECEIVE' });
    const [newPurchase, setNewPurchase] = useState<{
        items: { pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number, sellingPrice?: number }[],
        note: string,
        receiptNo: string,
        paymentType: 'TERM' | 'CASH'
    }>({ items: [], note: '', receiptNo: '', paymentType: 'TERM' });
    const [newReturn, setNewReturn] = useState<{
        items: { pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number, sellingPrice?: number }[],
        note: string,
        receiptNo: string
    }>({ items: [], note: '', receiptNo: '' });
    const [newSale, setNewSale] = useState<{
        items: { pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number, sellingPrice?: number }[],
        note: string,
        receiptNo: string
    }>({ items: [], note: '', receiptNo: '' });
    
    // New Pesticide Form (Inside Purchase)
    const [isAddingNewPesticide, setIsAddingNewPesticide] = useState(false);
    const [newPesticide, setNewPesticide] = useState({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });
    const [isSavingPurchase, setIsSavingPurchase] = useState(false);
    const isSavingPurchaseRef = useRef(false);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => 
            turkishMatchesAny([s.name, s.phoneNumber, s.tcNo, s.address], searchTerm)
        );
    }, [suppliers, searchTerm]);

    const handleAddSupplier = async () => {
        if (!newSupplier.name) return;
        const tcCheck = validateTcOrVkn(newSupplier.tcNo);
        if (!tcCheck.isValid) {
            showToast(tcCheck.message, 'error');
            return;
        }
        await addSupplier(newSupplier);
        setIsAddModalOpen(false);
        setNewSupplier({ name: '', phoneNumber: '', tcNo: '', address: '' });
        showToast('Tedarikçi başarıyla eklendi', 'success');
    };

    const handleUpdateSupplier = async () => {
        if (!editingSupplier || !editingSupplier.name) return;
        const tcCheck = validateTcOrVkn(editingSupplier.tcNo);
        if (!tcCheck.isValid) {
            showToast(tcCheck.message, 'error');
            return;
        }
        await updateSupplier(editingSupplier);
        setIsEditModalOpen(false);
        setEditingSupplier(null);
        showToast('Tedarikçi güncellendi', 'success');
    };

    const handleAddPurchase = async (manualSupplierId?: string) => {
        if (isSavingPurchase || isSavingPurchaseRef.current) return;
        const targetSupplierId = manualSupplierId || selectedSupplier?.id;
        if (!targetSupplierId || newPurchase.items.length === 0) return;
        
        isSavingPurchaseRef.current = true;
        setIsSavingPurchase(true);

        try {
            const totalAmount = round2(newPurchase.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0));
            const date = new Date().toISOString();
            
            await addSupplierPurchase({
                supplierId: targetSupplierId,
                date,
                type: 'PURCHASE',
                receiptNo: newPurchase.receiptNo,
                items: newPurchase.items,
                totalAmount,
                note: newPurchase.note,
                createdById: activeTeamMember?.id
            });

            // If it's a cash purchase, automatically add a payment
            if (newPurchase.paymentType === 'CASH') {
                const targetAccount = accounts.find(a => a.type === 'CASH') || accounts.find(a => a.name.includes('Nakit')) || accounts[0];
                await addSupplierPayment({
                    supplierId: targetSupplierId,
                    amount: totalAmount,
                    date,
                    method: 'CASH',
                    note: newPurchase.receiptNo ? `Peşin Alım - Fiş No: ${newPurchase.receiptNo}` : 'Peşin Alım Ödemesi',
                    createdById: activeTeamMember?.id,
                    accountId: targetAccount?.id
                });
            }
            
            setIsPurchaseModalOpen(false);
            setNewPurchase({ items: [], note: '', receiptNo: '', paymentType: 'TERM' });
            showToast(newPurchase.paymentType === 'CASH' ? 'Peşin alım ve ödeme kaydedildi' : 'Alım başarıyla kaydedildi ve depoya aktarıldı', 'success');
        } finally {
            isSavingPurchaseRef.current = false;
            setIsSavingPurchase(false);
        }
    };

    const generateSupplierReportPDF = async () => {
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

                let dateStr = 'Tüm Zamanlar';
                if (reportOptions.dateRange === 'THIS_MONTH') dateStr = 'Bu Ay';
                if (reportOptions.dateRange === 'LAST_MONTH') dateStr = 'Geçen Ay';
                if (reportOptions.dateRange === 'THIS_YEAR') dateStr = 'Bu Yıl';

                let htmlContent = `
                    <div style="margin-bottom: 30px;">
                        <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 8px 0; color: #10b981; text-transform: uppercase;">
                            ${userProfile?.companyName || "BAYİ"}
                        </h1>
                        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0; color: #1c1917;">Tedarikçi İşlem Raporu</h2>
                        <p style="font-size: 13px; margin: 0; color: #78716c;">
                            Tarih Aralığı: ${dateStr} &nbsp;&bull;&nbsp; Oluşturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}
                        </p>
                    </div>
                `;

                const allSupplierPayments = await dbService.getSupplierPayments();
                const suppliersToReport = reportOptions.supplierId === 'ALL' 
                    ? suppliers 
                    : suppliers.filter(s => s.id === reportOptions.supplierId);

                let start = new Date(0);
                let end = new Date();

                if (reportOptions.dateRange !== 'ALL_TIME') {
                    const now = new Date();
                    if (reportOptions.dateRange === 'THIS_MONTH') {
                        start = new Date(now.getFullYear(), now.getMonth(), 1);
                    } else if (reportOptions.dateRange === 'LAST_MONTH') {
                        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                    } else if (reportOptions.dateRange === 'THIS_YEAR') {
                        start = new Date(now.getFullYear(), 0, 1);
                    }
                }

                suppliersToReport.forEach((supplier, index) => {
                    const ledger: any[] = [];
                    
                    supplierPurchases.filter(p => !p.deletedAt && p.supplierId === supplier.id).forEach(p => {
                        const pDate = new Date(p.date);
                        if (pDate < start || pDate > end) return;

                        let txType = 'Alış Faturası';
                        if (p.type === 'SALE' || p.note?.includes('SATIŞ')) {
                            txType = 'Tedarikçiye Satış';
                        } else if (p.type === 'RETURN' || p.note?.includes('İADE')) {
                            txType = 'Alış İadesi';
                        }

                        ledger.push({
                            date: pDate,
                            type: txType,
                            docNo: p.receiptNo || '-',
                            amount: Math.abs(p.totalAmount || p.items.reduce((acc, i) => acc + (i.quantity * (i.buyingPrice || 0)), 0) || 0),
                            isDebtToUs: !(p.type === 'RETURN' || p.type === 'SALE' || (p.totalAmount && p.totalAmount < 0))
                        });
                    });

                    allSupplierPayments.filter(p => !p.deletedAt && p.supplierId === supplier.id).forEach(p => {
                        const pDate = new Date(p.date);
                        if (pDate < start || pDate > end) return;
                        const isReceive = p.type === 'RECEIVE';

                        ledger.push({
                            date: pDate,
                            type: isReceive ? 'Tedarikçiden Tahsilat' : 'Ödeme',
                            docNo: '-',
                            amount: Math.abs(Number(p.amount) || 0),
                            isDebtToUs: isReceive
                        });
                    });

                    myPayments.filter(p => !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId && p.supplierId === supplier.id).forEach(p => {
                        const pDate = new Date(p.issueDate);
                        if (pDate < start || pDate > end) return;

                        ledger.push({
                            date: pDate,
                            type: p.type === 'CHECK' ? 'Çek Ödemesi' : 'Senet Ödemesi',
                            docNo: '-',
                            amount: Math.abs(Number(p.amount) || 0),
                            isDebtToUs: false
                        });
                    });

                    ledger.sort((a, b) => a.date.getTime() - b.date.getTime());

                    htmlContent += `
                        <div style="margin-bottom: 30px; page-break-inside: avoid;">
                            <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 10px 0; color: #1c1917; padding-bottom: 5px; border-bottom: 2px solid #e7e5e4;">
                                ${index + 1}. Tedarikçi: ${supplier.name} <span style="color: #78716c; font-weight: 400; font-size: 13px; margin-left: 10px;">Tel: ${supplier.phoneNumber || '-'}</span>
                            </h3>
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                                <thead>
                                    <tr style="background-color: #8b5cf6; color: white;">
                                        <th style="padding: 8px 10px; border-bottom: 2px solid #7c3aed; border-top-left-radius: 6px;">Tarih</th>
                                        <th style="padding: 8px 10px; border-bottom: 2px solid #7c3aed;">İşlem Türü</th>
                                        <th style="padding: 8px 10px; border-bottom: 2px solid #7c3aed;">Belge No</th>
                                        <th style="padding: 8px 10px; border-bottom: 2px solid #7c3aed; text-align: right;">Firmaya Borçlandık</th>
                                        <th style="padding: 8px 10px; border-bottom: 2px solid #7c3aed; text-align: right;">Firmaya Ödedik</th>
                                        <th style="padding: 8px 10px; border-bottom: 2px solid #7c3aed; border-top-right-radius: 6px; text-align: right;">Bakiye</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    let currentBalance = 0;
                    
                    if (ledger.length === 0) {
                        htmlContent += `
                            <tr>
                                <td colspan="6" style="padding: 15px; text-align: center; color: #78716c; background-color: #fafaf9;">Belirtilen tarih aralığında işlem bulunmamaktadır.</td>
                            </tr>
                        `;
                    } else {
                        ledger.forEach((l, i) => {
                            if (l.isDebtToUs) currentBalance -= l.amount;
                            else currentBalance += l.amount;
                            
                            const bg = i % 2 === 0 ? '#fafaf9' : '#ffffff';
                            const balanceStr = formatCurrency(Math.abs(currentBalance), userProfile?.currency || 'TRY');
                            const statusStr = currentBalance < 0 ? '<span style="color:#ef4444;font-size:10px;margin-left:4px;">(Bize Borçlu)</span>' : '<span style="color:#10b981;font-size:10px;margin-left:4px;">(Hesap Alacaklı)</span>';
                            
                            htmlContent += `
                                <tr style="background-color: ${bg}; border-bottom: 1px solid #e7e5e4;">
                                    <td style="padding: 8px 10px; white-space: nowrap;">${format(l.date, 'dd.MM.yyyy')}</td>
                                    <td style="padding: 8px 10px;">${l.type}</td>
                                    <td style="padding: 8px 10px;">${l.docNo}</td>
                                    <td style="padding: 8px 10px; text-align: right; color: #ef4444; font-family: monospace;">${l.isDebtToUs ? formatCurrency(l.amount, userProfile?.currency || 'TRY') : '-'}</td>
                                    <td style="padding: 8px 10px; text-align: right; color: #10b981; font-family: monospace;">${!l.isDebtToUs ? formatCurrency(l.amount, userProfile?.currency || 'TRY') : '-'}</td>
                                    <td style="padding: 8px 10px; text-align: right; font-weight: bold; font-family: monospace;">${balanceStr} ${statusStr}</td>
                                </tr>
                            `;
                        });
                    }
                    
                    htmlContent += `
                                </tbody>
                            </table>
                        </div>
                    `;
                });

                container.innerHTML = htmlContent;
                document.body.appendChild(container);

                const canvas = await renderElementToCanvas(container, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false
                });

                document.body.removeChild(container);
                
                const pdf = await createMultiPagePdf(canvas);
                pdf.save(`Tedarikci_Raporu_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
                
                setIsGeneratingReport(false);
                setIsReportModalOpen(false);
            } catch(e) {
                console.error(e);
                setIsGeneratingReport(false);
                showToast('Rapor oluşturulurken hata!', 'error');
            }
        }, 100);
    };

    const handleAddReturn = async (manualSupplierId?: string) => {
        const targetSupplierId = manualSupplierId || selectedSupplier?.id;
        if (!targetSupplierId || newReturn.items.length === 0) return;
        
        const totalAmount = round2(newReturn.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0));
        
        await addSupplierPurchase({
            supplierId: targetSupplierId,
            date: new Date().toISOString(),
            type: 'RETURN',
            receiptNo: newReturn.receiptNo,
            items: newReturn.items,
            totalAmount: -Math.abs(totalAmount),
            note: newReturn.note ? `İADE: ${newReturn.note}` : 'İADE',
            createdById: activeTeamMember?.id
        });
        
        setIsReturnModalOpen(false);
        setNewReturn({ items: [], note: '', receiptNo: '' });
        showToast('İade başarıyla kaydedildi ve depodan düşüldü', 'success');
    };

    const handleAddSale = async (manualSupplierId?: string) => {
        const targetSupplierId = manualSupplierId || selectedSupplier?.id;
        if (!targetSupplierId || newSale.items.length === 0) return;
        
        const totalAmount = round2(newSale.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0));
        
        // Convert quantities to negative for sales
        const saleItems = newSale.items.map(item => ({
            ...item,
            quantity: -Math.abs(item.quantity)
        }));

        await addSupplierPurchase({
            supplierId: targetSupplierId,
            date: new Date().toISOString(),
            type: 'SALE',
            receiptNo: newSale.receiptNo,
            items: saleItems,
            totalAmount: -Math.abs(totalAmount),
            note: newSale.note ? `SATIŞ: ${newSale.note}` : 'SATIŞ',
            createdById: activeTeamMember?.id
        });
        
        setIsSaleModalOpen(false);
        setNewSale({ items: [], note: '', receiptNo: '' });
        showToast('Satış başarıyla kaydedildi ve depodan düşüldü', 'success');
    };

    const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);

    const [isSavingPayment, setIsSavingPayment] = useState(false);
    const isSavingPaymentRef = useRef(false);

    const handleAddPayment = async () => {
        if (isSavingPayment || isSavingPaymentRef.current) return;
        if (!selectedSupplier || !newPayment.amount) return;
        
        isSavingPaymentRef.current = true;
        setIsSavingPayment(true);

        try {
            const parseFloatSafe = (val: string | number) => parseFloat(String(val).replace(',', '.')) || 0;
            
            if (editingPayment) {
                await updateSupplierPayment({
                    ...editingPayment,
                    amount: parseFloatSafe(newPayment.amount),
                    method: newPayment.method,
                    dueDate: (newPayment.method === 'CHECK' || newPayment.method === 'PROMISSORY_NOTE') ? newPayment.dueDate : undefined,
                    note: newPayment.note,
                    accountId: newPayment.accountId || undefined
                });
                showToast('Ödeme güncellendi', 'success');
            } else {
                await addSupplierPayment({
                    supplierId: selectedSupplier.id,
                    amount: parseFloatSafe(newPayment.amount),
                    date: new Date().toISOString(),
                    method: newPayment.method,
                    dueDate: (newPayment.method === 'CHECK' || newPayment.method === 'PROMISSORY_NOTE') ? newPayment.dueDate : undefined,
                    note: newPayment.note,
                    accountId: newPayment.accountId || undefined,
                    createdById: activeTeamMember?.id,
                    installments: newPayment.method === 'CARD' ? newPayment.installments : undefined,
                    producerCardMonths: newPayment.method === 'CARD' ? newPayment.producerCardMonths : undefined,
                    type: newPayment.type
                });
                showToast('Ödeme kaydedildi', 'success');
            }
            
            setIsPaymentModalOpen(false);
            setEditingPayment(null);
            setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0, type: 'PAY' });
        } finally {
            isSavingPaymentRef.current = false;
            setIsSavingPayment(false);
        }
    };

    const handleEditPayment = (payment: SupplierPayment) => {
        setEditingPayment(payment);
        setNewPayment({
            amount: payment.amount.toString(),
            method: payment.method,
            note: payment.note || '',
            dueDate: payment.dueDate || new Date().toISOString().split('T')[0],
            accountId: payment.accountId || '',
            installments: payment.installments || 1,
            producerCardMonths: payment.producerCardMonths || 0,
            type: payment.type || 'PAY'
        });
        setIsPaymentModalOpen(true);
    };

    const handleAddNewPesticideToPurchase = () => {
        if (!newPesticide.name) return;
        
        const tempId = `new-${crypto.randomUUID()}`;
        const newItem = {
            pesticideId: tempId,
            pesticideName: newPesticide.name,
            quantity: 1,
            unit: newPesticide.unit,
            buyingPrice: 0,
            sellingPrice: 0
        };
        
        setNewPurchase(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        
        setIsAddingNewPesticide(false);
        setNewPesticide({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });
    };

    // Helper to get stats for a product (bought/sold)
    const getProductStats = (pesticideId: string) => {
        const item = inventory.find(i => i.pesticideId === pesticideId);
        const currentStock = item?.quantity || 0;
        
        let soldCount = 0;
        prescriptions.forEach(p => {
            p.items.forEach(i => {
                if (i.pesticideId === pesticideId) {
                    const qtyStr = i.quantity?.toString() || '0';
                    const parsedQty = parseFloat(qtyStr.replace(',', '.')) || 0;
                    if (!isNaN(parsedQty)) {
                        soldCount += parsedQty;
                    }
                }
            });
        });
        
        return {
            stock: currentStock,
            sold: soldCount,
            unit: item?.unit || 'Adet'
        };
    };

    const handleClosePayment = () => {
        setIsPaymentModalOpen(false);
        setEditingPayment(null);
        setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0, type: 'PAY' });
    };

    if (selectedSupplier) {
        return (
            <SupplierDetailView 
                supplier={selectedSupplier} 
                onBack={() => setSelectedSupplier(null)}
                onOpenPurchase={() => setIsPurchaseModalOpen(true)}
                onOpenPayment={(type: 'PAY' | 'RECEIVE' = 'PAY') => {
                    setEditingPayment(null);
                    setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0, type });
                    setIsPaymentModalOpen(true);
                }}
                onOpenDebt={() => setIsDebtModalOpen(true)}
                onOpenReturn={() => setIsReturnModalOpen(true)}
                onOpenSale={() => setIsSaleModalOpen(true)}
                getProductStats={getProductStats}
                isPurchaseModalOpen={isPurchaseModalOpen}
                setIsPurchaseModalOpen={setIsPurchaseModalOpen}
                handleAddPurchase={handleAddPurchase}
                newPurchase={newPurchase}
                setNewPurchase={setNewPurchase}
                inventory={inventory}
                isAddingNewPesticide={isAddingNewPesticide}
                setIsAddingNewPesticide={setIsAddingNewPesticide}
                newPesticide={newPesticide}
                setNewPesticide={setNewPesticide}
                handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                isPaymentModalOpen={isPaymentModalOpen}
                setIsPaymentModalOpen={setIsPaymentModalOpen}
                handleAddPayment={handleAddPayment}
                newPayment={newPayment}
                setNewPayment={setNewPayment}
                isDebtModalOpen={isDebtModalOpen}
                setIsDebtModalOpen={setIsDebtModalOpen}
                addSupplierPurchase={addSupplierPurchase}
                updateSupplierPurchase={updateSupplierPurchase}
                softDeleteSupplierPurchase={softDeleteSupplierPurchase}
                softDeleteSupplierPayment={softDeleteSupplierPayment}
                handleEditPayment={handleEditPayment}
                handleClosePayment={handleClosePayment}
                editingPayment={editingPayment}
                showToast={showToast}
                isReturnModalOpen={isReturnModalOpen}
                setIsReturnModalOpen={setIsReturnModalOpen}
                handleAddReturn={handleAddReturn}
                newReturn={newReturn}
                setNewReturn={setNewReturn}
                isSaleModalOpen={isSaleModalOpen}
                setIsSaleModalOpen={setIsSaleModalOpen}
                handleAddSale={handleAddSale}
                newSale={newSale}
                setNewSale={setNewSale}
                onEdit={(s: Supplier) => { setEditingSupplier(s); setIsEditModalOpen(true); }}
                accounts={accounts}
                softDeleteSupplier={softDeleteSupplier}
                myPayments={myPayments}
            />
        );
    }

    return (
        <div className="p-4 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-stone-900 rounded-xl text-stone-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black text-stone-100 tracking-tight">Tedarikçiler</h1>
                </div>
                <div className="flex justify-between items-stretch gap-1.5 sm:gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex-1 md:flex-none py-2.5 px-2 sm:px-4 bg-amber-600 text-white rounded-[1rem] shadow-lg shadow-amber-900/20 active:scale-95 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-[30%]"
                    >
                        <FileText size={18} />
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-center leading-tight">Raporla</span>
                    </button>
                    <button 
                        onClick={() => {
                            setSelectedSupplier(null);
                            setNewPurchase({ items: [], note: '', receiptNo: '', paymentType: 'TERM' });
                            setIsPurchaseModalOpen(true);
                        }}
                        className="flex-1 md:flex-none py-2.5 px-2 sm:px-4 bg-indigo-600 text-white rounded-[1rem] shadow-lg shadow-indigo-900/20 active:scale-95 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-[30%]"
                    >
                        <Package size={18} />
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-center leading-tight">Alım Yap</span>
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-1 md:flex-none py-2.5 px-2 sm:px-4 bg-emerald-600 text-white rounded-[1rem] shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-[30%]"
                    >
                        <Plus size={18} />
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-center leading-tight">Yeni Ekle</span>
                    </button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Tedarikçi ara..."
                    className="w-full bg-stone-900 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-stone-200 outline-none focus:border-emerald-500/50 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading ? (
                    <div className="col-span-1 md:col-span-2">
                        <ListSkeleton count={4} />
                    </div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="col-span-1 md:col-span-2">
                        <EmptyState
                            icon={Package}
                            title={searchTerm ? "Tedarikçi bulunamadı" : "Henüz tedarikçi eklenmemiş"}
                            description={!searchTerm ? "İlk tedarikçinizi ekleyerek alım ve ödeme takibine başlayın." : ""}
                            actionLabel={!searchTerm ? "Yeni Tedarikçi Ekle" : undefined}
                            onAction={!searchTerm ? () => setIsAddModalOpen(true) : undefined}
                            actionIcon={Plus}
                        />
                    </div>
                ) : filteredSuppliers.map(supplier => (
                    <div 
                        key={supplier.id}
                        onClick={() => setSelectedSupplier(supplier)}
                        className="bg-stone-900 border border-white/5 rounded-[1.8rem] p-5 hover:border-emerald-500/30 transition-all group cursor-pointer active:scale-[0.98] relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center text-emerald-500 border border-white/5">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-stone-100 text-base tracking-tight">{supplier.name}</h3>
                                    <div className="flex items-center gap-2 text-stone-500 text-[10px] font-bold uppercase tracking-widest mt-0.5 flex-wrap">
                                        <span className="flex items-center gap-1"><Phone size={10} />{supplier.phoneNumber || 'Telefon Yok'}</span>
                                        {supplier.tcNo && (
                                            <span className="text-stone-400 font-mono text-[10px] bg-stone-950/60 px-1.5 py-0.5 rounded border border-white/5">
                                                TC: {supplier.tcNo}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingSupplier(supplier); setIsEditModalOpen(true); }}
                                    className="p-2 bg-stone-800 text-stone-400 rounded-xl hover:text-emerald-400 transition-colors active:scale-90"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </div>
                        </div>

                        {toTelHref(supplier.phoneNumber) && (
                            <div className="flex gap-2">
                                <a href={toTelHref(supplier.phoneNumber)} onClick={e => e.stopPropagation()} aria-label={`${supplier.name} ara`} className="flex items-center gap-1.5 flex-1 justify-center min-h-[44px] py-2.5 bg-stone-900 border border-white/5 rounded-xl text-stone-300 font-bold text-[11px] hover:bg-stone-800 transition-colors">
                                    <Phone size={12} />
                                    Ara
                                </a>
                            </div>
                        )}
                    </div>
                ))}
            </div>


            {/* Report Modal */}
            {isReportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Rapor Al</h2>
                                <p className="text-stone-400 text-sm mt-1">Tedarikçi işlemlerini raporlayın</p>
                            </div>
                            <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Tedarikçi</label>
                                <select 
                                    className="w-full bg-stone-800 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-amber-500/50 transition-all appearance-none"
                                    value={reportOptions.supplierId}
                                    onChange={(e) => setReportOptions({ ...reportOptions, supplierId: e.target.value })}
                                >
                                    <option value="ALL">Tümü</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Zaman Aralığı</label>
                                <select 
                                    className="w-full bg-stone-800 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-amber-500/50 transition-all appearance-none"
                                    value={reportOptions.dateRange}
                                    onChange={(e) => setReportOptions({ ...reportOptions, dateRange: e.target.value })}
                                >
                                    <option value="ALL_TIME">Tüm Zamanlar</option>
                                    <option value="THIS_MONTH">Bu Ay</option>
                                    <option value="LAST_MONTH">Geçen Ay</option>
                                    <option value="THIS_YEAR">Bu Yıl</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setIsReportModalOpen(false)}
                                className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={generateSupplierReportPDF}
                                disabled={isGeneratingReport}
                                className="flex-1 py-4 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isGeneratingReport ? (
                                    <>
                                        <RefreshCcw size={18} className="animate-spin" />
                                        <span>Hazırlanıyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <FileText size={18} />
                                        <span>PDF İndir</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Supplier Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                            <Truck className="text-emerald-500" />
                            Yeni Tedarikçi
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Tedarikçi Adı</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="Örn: Akdeniz Tarım"
                                    value={newSupplier.name}
                                    onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 block">T.C. veya Vergi Kimlik No (VKN)</label>
                                    {newSupplier.tcNo && newSupplier.tcNo.trim().length > 0 && (
                                        <span className={`text-[10px] font-bold font-mono ${validateTcOrVkn(newSupplier.tcNo).isValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {newSupplier.tcNo.trim().length} Hane
                                        </span>
                                    )}
                                </div>
                                <input 
                                    type="text"
                                    maxLength={11}
                                    className={`w-full bg-stone-950 border ${newSupplier.tcNo && newSupplier.tcNo.trim().length > 0 ? (validateTcOrVkn(newSupplier.tcNo).isValid ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20 focus:border-emerald-500 ring-2 ring-emerald-500/20' : 'border-rose-500 text-rose-300 bg-rose-950/40 focus:border-rose-500 ring-2 ring-rose-500/20') : 'border-white/5 text-stone-100 focus:border-emerald-500/50'} rounded-2xl p-4 text-sm outline-none transition-all font-mono`}
                                    placeholder="11 haneli T.C. veya 10 haneli VKN"
                                    value={newSupplier.tcNo || ''}
                                    onChange={(e) => setNewSupplier({...newSupplier, tcNo: e.target.value.replace(/[^0-9]/g, '')})}
                                />
                                {newSupplier.tcNo && newSupplier.tcNo.trim().length > 0 && (
                                    <p className={`text-[10px] font-bold ${validateTcOrVkn(newSupplier.tcNo).isValid ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30' : 'text-rose-400 bg-rose-950/50 border-rose-500/30'} mt-1.5 flex items-center gap-1.5 border p-2 rounded-xl`}>
                                        {validateTcOrVkn(newSupplier.tcNo).isValid ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <AlertTriangle size={12} className="shrink-0 text-rose-400" />}
                                        <span>{validateTcOrVkn(newSupplier.tcNo).message}</span>
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Telefon</label>
                                <input 
                                    type="tel" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="05xx xxx xx xx"
                                    value={newSupplier.phoneNumber}
                                    onChange={(e) => setNewSupplier({...newSupplier, phoneNumber: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Adres</label>
                                <textarea 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all h-24 resize-none"
                                    placeholder="Tedarikçi adresi..."
                                    value={newSupplier.address}
                                    onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={handleAddSupplier}
                                disabled={!newSupplier.name || !validateTcOrVkn(newSupplier.tcNo).isValid}
                                className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all ${!validateTcOrVkn(newSupplier.tcNo).isValid ? 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-60' : 'bg-emerald-600 text-white active:scale-95 shadow-lg shadow-emerald-900/20'}`}
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Supplier Modal */}
            {isEditModalOpen && editingSupplier && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                            <Edit2 className="text-emerald-500" />
                            Tedarikçi Düzenle
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Tedarikçi Adı</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    value={editingSupplier.name}
                                    onChange={(e) => setEditingSupplier({...editingSupplier, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 block">T.C. veya Vergi Kimlik No (VKN)</label>
                                    {editingSupplier.tcNo && editingSupplier.tcNo.trim().length > 0 && (
                                        <span className={`text-[10px] font-bold font-mono ${validateTcOrVkn(editingSupplier.tcNo).isValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {editingSupplier.tcNo.trim().length} Hane
                                        </span>
                                    )}
                                </div>
                                <input 
                                    type="text"
                                    maxLength={11}
                                    className={`w-full bg-stone-950 border ${editingSupplier.tcNo && editingSupplier.tcNo.trim().length > 0 ? (validateTcOrVkn(editingSupplier.tcNo).isValid ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20 focus:border-emerald-500 ring-2 ring-emerald-500/20' : 'border-rose-500 text-rose-300 bg-rose-950/40 focus:border-rose-500 ring-2 ring-rose-500/20') : 'border-white/5 text-stone-100 focus:border-emerald-500/50'} rounded-2xl p-4 text-sm outline-none transition-all font-mono`}
                                    placeholder="11 haneli T.C. veya 10 haneli VKN"
                                    value={editingSupplier.tcNo || ''}
                                    onChange={(e) => setEditingSupplier({...editingSupplier, tcNo: e.target.value.replace(/[^0-9]/g, '')})}
                                />
                                {editingSupplier.tcNo && editingSupplier.tcNo.trim().length > 0 && (
                                    <p className={`text-[10px] font-bold ${validateTcOrVkn(editingSupplier.tcNo).isValid ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30' : 'text-rose-400 bg-rose-950/50 border-rose-500/30'} mt-1.5 flex items-center gap-1.5 border p-2 rounded-xl`}>
                                        {validateTcOrVkn(editingSupplier.tcNo).isValid ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <AlertTriangle size={12} className="shrink-0 text-rose-400" />}
                                        <span>{validateTcOrVkn(editingSupplier.tcNo).message}</span>
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Telefon</label>
                                <input 
                                    type="tel" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    value={editingSupplier.phoneNumber}
                                    onChange={(e) => setEditingSupplier({...editingSupplier, phoneNumber: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Adres</label>
                                <textarea 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all h-24 resize-none"
                                    value={editingSupplier.address}
                                    onChange={(e) => setEditingSupplier({...editingSupplier, address: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setIsEditModalOpen(false)}
                                className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={handleUpdateSupplier}
                                disabled={!editingSupplier.name || !validateTcOrVkn(editingSupplier.tcNo).isValid}
                                className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all ${!validateTcOrVkn(editingSupplier.tcNo).isValid ? 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-60' : 'bg-emerald-600 text-white active:scale-95 shadow-lg shadow-emerald-900/20'}`}
                            >
                                Güncelle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant="danger"
            />

            {isPurchaseModalOpen && !selectedSupplier && (
                <PurchaseModal 
                    supplier={null}
                    onClose={() => setIsPurchaseModalOpen(false)}
                    onSave={async (id: string) => {
                        await handleAddPurchase(id);
                    }}
                    newPurchase={newPurchase}
                    setNewPurchase={setNewPurchase}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    userProfile={userProfile}
                    showToast={showToast}
                />
            )}
        </div>
    );
};

const DebtModal = ({ supplier, onClose, onSave }: any) => {
    const { userProfile, teamMembers, hapticFeedback } = useAppViewModel();
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                    <AlertCircle className="text-amber-500" />
                    Borç Ekle
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Borç Tutarı ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                        <input 
                            type="number" 
                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-amber-500/50 transition-all font-mono"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Açıklama</label>
                        <textarea 
                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-amber-500/50 transition-all h-24 resize-none"
                            placeholder="Borç nedeni..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-8">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                    >
                        İptal
                    </button>
                    <button 
                        onClick={async () => {
                            if (isSaving) return;
                            setIsSaving(true);
                            try {
                                const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
                                await onSave(parsedAmount, note);
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                        disabled={isSaving || !amount}
                        className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-amber-900/20 disabled:opacity-50"
                    >
                        {isSaving ? 'Kaydediliyor...' : 'Borcu Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SupplierDetailView = ({ 
    supplier, onBack, onOpenPurchase, onOpenPayment, onOpenDebt, onOpenReturn, onOpenSale, getProductStats,
    isPurchaseModalOpen, setIsPurchaseModalOpen, handleAddPurchase, newPurchase, setNewPurchase, inventory,
    isAddingNewPesticide, setIsAddingNewPesticide, newPesticide, setNewPesticide, handleAddNewPesticideToPurchase,
    isPaymentModalOpen, setIsPaymentModalOpen, handleAddPayment, newPayment, setNewPayment, handleEditPayment, handleClosePayment, editingPayment,
    isDebtModalOpen, setIsDebtModalOpen, addSupplierPurchase, updateSupplierPurchase, softDeleteSupplierPurchase, softDeleteSupplierPayment, showToast,
    isReturnModalOpen, setIsReturnModalOpen, handleAddReturn, newReturn, setNewReturn,
    isSaleModalOpen, setIsSaleModalOpen, handleAddSale, newSale, setNewSale,
    onEdit, accounts, softDeleteSupplier, myPayments
}: any) => {
    const { userProfile, teamMembers, hapticFeedback } = useAppViewModel();
    const [activeTab, setActiveTab] = useState<'PURCHASES' | 'PAYMENTS'>('PURCHASES');
    const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
    const [payments, setPayments] = useState<SupplierPayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingPurchase, setEditingPurchase] = useState<SupplierPurchase | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportOptions, setReportOptions] = useState({
        type: 'SUMMARY' as 'SUMMARY' | 'DETAILED',
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    const totalAlinan = purchases.reduce((acc, p) => {
        const isSale = p.type === 'SALE' || p.note?.includes('SATIŞ');
        const isReturn = p.type === 'RETURN' || (p.note?.includes('İADE') && !isSale);
        if (isSale || isReturn) return acc;
        return acc + (p.totalAmount > 0 ? p.totalAmount : 0);
    }, 0);

    const totalOdenen = purchases.reduce((acc, p) => {
        const isSale = p.type === 'SALE' || p.note?.includes('SATIŞ');
        const isReturn = p.type === 'RETURN' || (p.note?.includes('İADE') && !isSale);
        if (isSale || isReturn || (p.totalAmount && p.totalAmount < 0)) {
            return acc + Math.abs(p.totalAmount || 0);
        }
        return acc;
    }, 0) + payments.reduce((acc: any, p: any) => {
        const amt = Number(p.amount) || 0;
        return acc + (p.type === 'RECEIVE' ? -amt : amt);
    }, 0);

    const kalanBakiye = totalAlinan - totalOdenen;

    const loadData = async () => {
        setIsLoading(true);
        const [purchList, payList] = await Promise.all([
            dbService.getSupplierPurchases(supplier.id),
            dbService.getSupplierPayments(supplier.id)
        ]);
        const activePurchases = purchList.filter(p => !p.deletedAt);
        const activePayments = payList.filter(p => !p.deletedAt);
        // Only include checks that are standalone (no relatedId linking them back to a SupplierPayment)
        const activeMyPayments = myPayments.filter((p: any) => p.supplierId === supplier.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId);
        
        setPurchases(activePurchases.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        
        // Combine regular payments and checks/notes
        const allPayments = [
            ...activePayments,
            ...activeMyPayments.map((p: any) => ({ ...p, type: 'MY_PAYMENT', date: p.issueDate }))
        ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setPayments(allPayments);
        setIsLoading(false);
    };

    const generateReport = () => {
        setTimeout(async () => {
            try {
                const currency = userProfile?.currency || 'TRY';
                
                // Filter transactions by date
                const start = new Date(reportOptions.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(reportOptions.endDate);
                end.setHours(23, 59, 59, 999);

                const filteredPurchases = purchases.filter(p => {
                    const date = new Date(p.date);
                    return date >= start && date <= end;
                });
                const filteredPayments = payments.filter((p: any) => {
                    const date = new Date(p.date);
                    return date >= start && date <= end;
                });

                const totalDebt = filteredPurchases.reduce((acc, p) => acc + (p.totalAmount > 0 ? p.totalAmount : 0), 0)
                    + filteredPayments.filter((p: any) => p.type === 'RECEIVE').reduce((acc: any, p: any) => acc + (Number(p.amount) || 0), 0);
                const totalCredit = filteredPurchases.reduce((acc, p) => acc + (p.totalAmount < 0 ? Math.abs(p.totalAmount) : 0), 0)
                    + filteredPayments.filter((p: any) => p.type !== 'RECEIVE').reduce((acc: any, p: any) => acc + (Number(p.amount) || 0), 0);
                const periodBalance = totalCredit - totalDebt;

                const allTransactions = [
                    ...filteredPurchases.map(p => {
                        const receiptBadge = p.receiptNo ? `<span style="background-color: #18181b; color: #ffffff; font-family: monospace; font-weight: 800; padding: 2px 7px; border-radius: 4px; font-size: 11px; display: inline-block; margin-bottom: 3px;">Fatura/Fiş No: ${p.receiptNo}</span>` : '';
                        const itemsStr = (p.items || []).map(i => `${i.pesticideName} <b style="background-color: #fef3c7; color: #78350f; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-family: monospace;">(${i.quantity} ${i.unit})</b>`).join(', ');
                        
                        let descHtml = '';
                        if (reportOptions.type === 'DETAILED') {
                            descHtml = `${receiptBadge ? receiptBadge + '<br/>' : ''}${itemsStr}${p.note ? ` <span style="color:#71717a;">(${p.note})</span>` : ''}`;
                        } else {
                            descHtml = receiptBadge || p.note || '-';
                        }

                        return {
                            date: new Date(p.date),
                            type: (p.type === 'SALE' || p.note?.includes('SATIŞ')) ? 'Tedarikçiye Satış' : ((p.type === 'RETURN' || p.note?.includes('İADE')) ? 'Ürün İadesi' : 'Ürün Alımı'),
                            desc: descHtml,
                            debt: p.totalAmount > 0 ? p.totalAmount : 0,
                            credit: p.totalAmount < 0 ? Math.abs(p.totalAmount) : 0
                        };
                    }),
                    ...filteredPayments.map((p: any) => {
                        let type = 'Ödeme';
                        let method = p.method || '';
                        if (p.type === 'CHECK') {
                            type = 'Çek';
                            method = 'Çek';
                        } else if (p.type === 'PROMISSORY') {
                            type = 'Senet';
                            method = 'Senet';
                        } else if (p.type === 'MY_PAYMENT') {
                            type = 'Ödeme';
                            method = p.type === 'CHECK' ? 'Müşteri Çeki' : (p.type === 'PROMISSORY_NOTE' ? 'Müşteri Senedi' : 'Cari Ödemesi');
                        }
                        
                        const isReceive = p.type === 'RECEIVE';
                        return {
                            date: new Date(p.date),
                            type: isReceive ? 'Tahsilat' : type,
                            desc: `${method}${p.note ? ` - ${p.note}` : ''}`,
                            debt: isReceive ? p.amount : 0,
                            credit: isReceive ? 0 : p.amount
                        };
                    })
                ].sort((a, b) => a.date.getTime() - b.date.getTime());


                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '0';
                container.style.width = '800px';
                container.style.backgroundColor = '#ffffff';
                container.style.padding = '40px';
                container.style.color = '#1c1917';
                container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

                let htmlContent = `
                    <div style="margin-bottom: 30px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                            <div>
                                <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 8px 0; color: #10b981; text-transform: uppercase;">
                                    ${userProfile?.companyName || "MKS SİSTEMİ"}
                                </h1>
                                <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0; color: #1c1917;">Tedarikçi Cari Hesap Ekstresi</h2>
                            </div>
                            <div style="text-align: right; color: #78716c; font-size: 11px;">
                                <p style="margin: 0 0 4px 0;"><strong>Tarih:</strong> ${format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
                                <p style="margin: 0;"><strong>Sorumlu:</strong> ${userProfile?.fullName || 'Sistem'}</p>
                            </div>
                        </div>

                        <div style="background-color: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; justify-content: space-between;">
                            <div>
                                <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 8px 0; color: #1c1917;">${supplier.name}</h3>
                                ${supplier.tcNo ? `<p style="margin: 0 0 4px 0; font-size: 12px; color: #57534e;"><strong>T.C. No:</strong> ${supplier.tcNo}</p>` : ''}
                                ${supplier.phoneNumber ? `<p style="margin: 0 0 4px 0; font-size: 12px; color: #57534e;"><strong>Tel:</strong> ${supplier.phoneNumber}</p>` : ''}
                                ${supplier.address ? `<p style="margin: 0; font-size: 12px; color: #57534e;"><strong>Adres:</strong> ${supplier.address}</p>` : ''}
                            </div>
                            <div style="text-align: right; font-size: 12px; color: #57534e;">
                                <p style="margin: 0 0 4px 0;"><strong>Rapor Aralığı:</strong> ${format(start, 'dd.MM.yyyy')} - ${format(end, 'dd.MM.yyyy')}</p>
                                <p style="margin: 0;"><strong>Rapor Türü:</strong> ${reportOptions.type === 'DETAILED' ? 'Detaylı Kırılımlı' : 'Genel Özet'}</p>
                            </div>
                        </div>

                        <div style="display: flex; gap: 16px; margin-bottom: 30px;">
                            <div style="flex: 1; padding: 16px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                                <div style="font-size: 10px; font-weight: 700; color: #dc2626; text-transform: uppercase; margin-bottom: 4px;">Dönem Alınan / Borç</div>
                                <div style="font-size: 18px; font-weight: 800; color: #b91c1c; font-family: monospace;">${formatCurrency(totalDebt, currency)}</div>
                            </div>
                            <div style="flex: 1; padding: 16px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px;">
                                <div style="font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase; margin-bottom: 4px;">Dönem Ödenen / İade / Satış</div>
                                <div style="font-size: 18px; font-weight: 800; color: #047857; font-family: monospace;">${formatCurrency(totalCredit, currency)}</div>
                            </div>
                            <div style="flex: 1; padding: 16px; background-color: ${periodBalance < 0 ? '#ecfdf5' : (periodBalance > 0 ? '#fef2f2' : '#f3f4f6')}; border: 1px solid ${periodBalance < 0 ? '#a7f3d0' : (periodBalance > 0 ? '#fecaca' : '#e5e7eb')}; border-radius: 8px;">
                                <div style="font-size: 10px; font-weight: 700; color: ${periodBalance < 0 ? '#059669' : (periodBalance > 0 ? '#dc2626' : '#4b5563')}; text-transform: uppercase; margin-bottom: 4px;">Dönem Bakiyesi</div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                                    <div style="font-size: 18px; font-weight: 800; color: ${periodBalance < 0 ? '#047857' : (periodBalance > 0 ? '#b91c1c' : '#374151')}; font-family: monospace;">
                                        ${formatCurrency(Math.abs(periodBalance), currency)}
                                    </div>
                                    <div style="font-size: 11px; font-weight: 700; color: ${periodBalance < 0 ? '#059669' : (periodBalance > 0 ? '#dc2626' : '#4b5563')};">
                                        ${periodBalance < 0 ? '(Alacaklı Geçiş)' : (periodBalance > 0 ? '(Borçlu Geçiş)' : '(Bakiye Yok)')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                            <thead>
                                <tr style="background-color: #1f2937; color: white;">
                                    <th style="padding: 10px; border-bottom: 2px solid #1f2937; border-top-left-radius: 6px;">Tarih</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #1f2937;">İşlem Türü</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #1f2937;">Açıklama</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #1f2937; text-align: right;">Borç (Alınan)</th>
                                    <th style="padding: 10px; border-bottom: 2px solid #1f2937; border-top-right-radius: 6px; text-align: right;">Alacak (Ödenen)</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                if (allTransactions.length === 0) {
                    htmlContent += `
                        <tr>
                            <td colspan="5" style="padding: 20px; text-align: center; color: #78716c; background-color: #fafaf9; border-bottom: 1px solid #e7e5e4;">
                                Belirtilen tarih aralığında işlem bulunmamaktadır.
                            </td>
                        </tr>
                    `;
                } else {
                    allTransactions.forEach((t, i) => {
                        const bg = i % 2 === 0 ? '#fafaf9' : '#ffffff';
                        htmlContent += `
                            <tr style="background-color: ${bg}; border-bottom: 1px solid #e7e5e4;">
                                <td style="padding: 10px; white-space: nowrap; color: #3f3f46;">${format(t.date, 'dd.MM.yyyy')}</td>
                                <td style="padding: 10px; font-weight: 600; color: #3f3f46;">${t.type}</td>
                                <td style="padding: 10px; color: #52525b;">${t.desc}</td>
                                <td style="padding: 10px; text-align: right; color: #dc2626; font-family: monospace; font-weight: 600;">${t.debt > 0 ? formatCurrency(t.debt, currency) : '-'}</td>
                                <td style="padding: 10px; text-align: right; color: #059669; font-family: monospace; font-weight: 600;">${t.credit > 0 ? formatCurrency(t.credit, currency) : '-'}</td>
                            </tr>
                        `;
                    });
                }

                htmlContent += `
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
                
                const doc = await createMultiPagePdf(canvas);
                doc.save(`${supplier.name.replace(/\s+/g, '_')}_Ekstre_${reportOptions.type}.pdf`);
                
                showToast('Rapor başarıyla oluşturuldu', 'success');
                setIsReportModalOpen(false);

            } catch(e) {
                console.error(e);
                showToast('Rapor oluşturulurken hata!', 'error');
            }
        }, 100);
    };

    React.useEffect(() => {
        loadData();
    }, [supplier]);

    const handleDeletePurchase = async (id: string) => {
        console.log('Tedarikçi alımı siliniyor:', id);
        setConfirmModal({
            isOpen: true,
            title: 'Alım Kaydı Silinecek',
            message: 'Bu alım kaydını silmek istediğinize emin misiniz? Stoklar geri alınacaktır.',
            onConfirm: async () => {
                try {
                    await softDeleteSupplierPurchase(id);
                    showToast('Alım kaydı çöp kutusuna taşındı', 'info');
                    await loadData();
                } catch (error) {
                    console.error('Alım silme hatası:', error);
                    showToast('Alım silinirken bir hata oluştu', 'error');
                }
            }
        });
    };

    const handleDeletePayment = async (id: string) => {
        console.log('Tedarikçi ödemesi siliniyor:', id);
        setConfirmModal({
            isOpen: true,
            title: 'Ödeme Kaydı Silinecek',
            message: 'Bu ödeme kaydını silmek istediğinize emin misiniz?',
            onConfirm: async () => {
                try {
                    await softDeleteSupplierPayment(id);
                    showToast('Ödeme kaydı çöp kutusuna taşındı', 'info');
                    await loadData();
                } catch (error) {
                    console.error('Ödeme silme hatası:', error);
                    showToast('Ödeme silinirken bir hata oluştu', 'error');
                }
            }
        });
    };

    const handleUpdatePurchase = async (manualId?: string) => {
        if (!editingPurchase) return;
        
        try {
            // If manualId is provided and different from current supplierId (though unlikely in edit)
            const updatedPurchase = {
                ...editingPurchase,
                supplierId: manualId || editingPurchase.supplierId
            };

            await updateSupplierPurchase(updatedPurchase);
            setEditingPurchase(null);
            showToast('Alım kaydı güncellendi', 'success');
            loadData();
        } catch (error) {
            console.error('Update purchase error:', error);
            showToast('Güncelleme sırasında bir hata oluştu', 'error');
        }
    };

    // Unique products purchased from this supplier
    const purchasedProducts = useMemo(() => {
        const productMap = new Map<string, { id: string, name: string, totalQty: number, returnedQty: number, soldQty: number, unit: string }>();
        purchases.forEach(p => {
            const isSale = p.type === 'SALE' || p.note?.includes('SATIŞ');
            const isReturn = p.type === 'RETURN' || (p.note?.includes('İADE') && !isSale);

            (p.items || []).forEach(item => {
                const qty = Math.abs(item.quantity || 0);
                const existing = productMap.get(item.pesticideId) || { 
                    id: item.pesticideId, 
                    name: item.pesticideName, 
                    totalQty: 0,
                    returnedQty: 0,
                    soldQty: 0,
                    unit: item.unit
                };

                if (isSale) {
                    existing.soldQty += qty;
                } else if (isReturn) {
                    existing.returnedQty += qty;
                } else {
                    existing.totalQty += qty;
                }

                productMap.set(item.pesticideId, existing);
            });
        });
        return Array.from(productMap.values());
    }, [purchases]);

    const generateReconciliationPdf = async () => {
        try {
            hapticFeedback('medium');
            showToast('Cari Mutabakat Mektubu hazırlanıyor...', 'info');
            const todayStr = new Date().toLocaleDateString('tr-TR');
            const absBal = Math.abs(kalanBakiye);
            const directionText =
                kalanBakiye > 0.01
                    ? 'ALACAKLI (Şirketimiz Borçlu)'
                    : kalanBakiye < -0.01
                        ? 'BORÇLU (Şirketimiz Alacaklı)'
                        : 'BAKİYE SIFIR (Mutabık)';
            const balFormatted = formatCurrency(absBal, userProfile?.currency || 'TRY');
            const escapeSuppHtml = (val: unknown) =>
                String(val ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            const companyTitle = escapeSuppHtml(userProfile?.companyName || userProfile?.stampTitle || 'ZİRAİ MÜHENDİSLİK & TARIM MARKET');
            const safeSuppName = escapeSuppHtml(supplier.name);
            const safeSuppTax = (supplier.vkn || supplier.tcNo) ? `VKN / TCKN: <strong>${escapeSuppHtml(supplier.vkn || supplier.tcNo)}</strong> • ` : '';
            const safeSuppPhone = escapeSuppHtml(supplier.phoneNumber || '-');
            const safeSuppAddr = supplier.address ? `<br/>Adres: ${escapeSuppHtml(supplier.address)}` : '';
            const safeUserFullName = escapeSuppHtml(userProfile?.fullName || 'Ziraat Mühendisi');
            const safeUserPhone = userProfile?.phoneNumber ? `• ${escapeSuppHtml(userProfile.phoneNumber)}` : '';
            const safeStampColor = /^#[0-9a-fA-F]{3,8}$/.test(userProfile?.stampColor || '') ? userProfile!.stampColor! : '#1d4ed8';
            const safeStampTitle = escapeSuppHtml((userProfile?.stampTitle || userProfile?.companyName || 'ZİRAİ MÜHENDİSLİK').toUpperCase());
            const safeStampSub = escapeSuppHtml(userProfile?.stampSubTitle || userProfile?.fullName || 'Yetkili Onayı');
            const safeStampTax = escapeSuppHtml(userProfile?.stampTaxInfo || 'Resmi Cari Mutabakat Onayı');

            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.innerHTML = `
                <div style="width: 794px; min-height: 1080px; padding: 56px 60px; background: #ffffff; color: #1c1917; font-family: 'Segoe UI', Roboto, Arial, sans-serif; box-sizing: border-box;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #064e3b; padding-bottom: 20px; margin-bottom: 28px;">
                        <div>
                            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #064e3b; text-transform: uppercase;">${companyTitle}</h1>
                            <p style="margin: 6px 0 0; font-size: 13px; color: #57534e; font-weight: 600;">${safeUserFullName} ${safeUserPhone}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 900; letter-spacing: 1px;">
                                CARİ HESAP MUTABAKAT MEKTUBU
                            </div>
                            <p style="margin: 8px 0 0; font-size: 12px; color: #57534e; font-weight: 700;">Tarih: ${escapeSuppHtml(todayStr)}</p>
                        </div>
                    </div>

                    <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 18px 22px; margin-bottom: 26px;">
                        <p style="margin: 0 0 6px; font-size: 11px; font-weight: 800; color: #78716c; text-transform: uppercase; letter-spacing: 1px;">SAYIN FİRMA / MUHATAP BİLGİLERİ</p>
                        <h2 style="margin: 0; font-size: 19px; font-weight: 900; color: #1c1917;">${safeSuppName}</h2>
                        <p style="margin: 6px 0 0; font-size: 13px; color: #44403c;">
                            ${safeSuppTax}
                            Telefon: <strong>${safeSuppPhone}</strong>
                            ${safeSuppAddr}
                        </p>
                    </div>

                    <p style="font-size: 14px; line-height: 1.75; color: #292524; margin-bottom: 24px;">
                        Sayın Yetkili,<br/>
                        Şirketimiz nezdindeki cari hesabınızın <strong>${escapeSuppHtml(todayStr)}</strong> tarihi itibarıyla yapılan kontroller sonucunda aşağıda detayları belirtilen bakiyeyi verdiği tespit edilmiştir. Türk Ticaret Kanunu'nun ilgili hükümleri uyarınca mutabık olup olmadığınızı aşağıda yer alan bölümü kaşeleyip imzalayarak tarafımıza bildirmenizi rica ederiz.
                    </p>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                        <thead>
                            <tr style="background: #064e3b; color: #ffffff;">
                                <th style="padding: 12px 16px; text-align: left; border-radius: 8px 0 0 0;">Mutabakat Tarihi</th>
                                <th style="padding: 12px 16px; text-align: right;">Toplam Alım</th>
                                <th style="padding: 12px 16px; text-align: right;">Toplam Ödeme</th>
                                <th style="padding: 12px 16px; text-align: right;">Net Cari Bakiye</th>
                                <th style="padding: 12px 16px; text-align: center; border-radius: 0 8px 0 0;">Bakiye Yönü (Sizin Açınızdan)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="background: #f5f5f4; font-weight: 700;">
                                <td style="padding: 14px 16px; border-bottom: 2px solid #d6d3d1;">${escapeSuppHtml(todayStr)}</td>
                                <td style="padding: 14px 16px; text-align: right; border-bottom: 2px solid #d6d3d1;">${escapeSuppHtml(formatCurrency(totalAlinan, userProfile?.currency || 'TRY'))}</td>
                                <td style="padding: 14px 16px; text-align: right; border-bottom: 2px solid #d6d3d1;">${escapeSuppHtml(formatCurrency(totalOdenen, userProfile?.currency || 'TRY'))}</td>
                                <td style="padding: 14px 16px; text-align: right; font-size: 16px; font-weight: 900; color: #064e3b; border-bottom: 2px solid #d6d3d1;">${escapeSuppHtml(balFormatted)}</td>
                                <td style="padding: 14px 16px; text-align: center; font-size: 12px; font-weight: 900; border-bottom: 2px solid #d6d3d1;">${escapeSuppHtml(directionText)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="border: 1px dashed #a8a29e; background: #fffbeb; border-radius: 10px; padding: 14px 18px; margin-bottom: 36px; font-size: 12px; color: #78350f;">
                        <strong>Not:</strong> İşbu mutabakat mektubuna tebliğ tarihinden itibaren 1 (bir) ay içerisinde yazılı itiraz edilmediği takdirde 6102 sayılı TTK m. 94 gereğince cari hesap bakiyesi kabul edilmiş sayılır. Varsa mutabakatsızlık durumunda cari hesap ekstrenizi tarafımıza iletmenizi rica ederiz.
                    </div>

                    <div style="display: flex; gap: 24px; margin-top: 20px;">
                        <div style="flex: 1; border: 2px solid #d6d3d1; border-radius: 14px; padding: 20px; min-height: 190px; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-size: 12px; font-weight: 900; color: #064e3b; text-transform: uppercase; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; margin-bottom: 10px;">
                                    GÖNDEREN FİRMA (KAŞE / İMZA)
                                </div>
                                <div style="font-size: 13px; font-weight: 800; color: #1c1917;">${companyTitle}</div>
                                <div style="font-size: 11px; color: #57534e; margin-top: 4px;">${escapeSuppHtml(userProfile?.fullName || '')}</div>
                            </div>
                            ${userProfile?.stampEnabled !== false ? `
                            <div style="align-self: center; border: 2px solid ${safeStampColor}; border-radius: 8px; padding: 8px 14px; transform: rotate(-2deg); color: ${safeStampColor}; text-align: center; margin-top: 12px;">
                                <div style="font-size: 10px; font-weight: 900; text-transform: uppercase;">${safeStampTitle}</div>
                                <div style="font-size: 9px; font-weight: 700;">${safeStampSub}</div>
                                <div style="font-size: 8px;">${safeStampTax}</div>
                            </div>` : '<div style="font-size: 11px; color: #a8a29e; text-align: center;">Kaşe / İmza</div>'}
                        </div>

                        <div style="flex: 1; border: 2px solid #d6d3d1; border-radius: 14px; padding: 20px; min-height: 190px; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-size: 12px; font-weight: 900; color: #1c1917; text-transform: uppercase; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; margin-bottom: 10px;">
                                    KARŞI FİRMA ONAYI (KAŞE / İMZA)
                                </div>
                                <div style="font-size: 13px; font-weight: 800; color: #1c1917; margin-bottom: 12px;">${safeSuppName}</div>
                                <div style="display: flex; gap: 18px; font-size: 12px; font-weight: 800; color: #292524; margin-top: 10px;">
                                    <span>☐ MUTABIKIZ</span>
                                    <span>☐ MUTABIK DEĞİLİZ</span>
                                </div>
                            </div>
                            <div style="font-size: 11px; color: #78716c; border-top: 1px dashed #d6d3d1; padding-top: 8px;">
                                Tarih / Yetkili Kaşe ve İmza:
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            const canvas = await renderElementToCanvas(container.firstElementChild as HTMLElement, {
                scale: 3,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
            });
            document.body.removeChild(container);
            const pdf = await createMultiPagePdf(canvas);
            const safeName = trToEn(supplier.name).replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${safeName}_Cari_Mutabakat_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
            showToast('Cari Mutabakat Mektubu (PDF) indirildi', 'success');
        } catch (err) {
            console.error('Supplier reconciliation PDF error:', err);
            showToast('Mutabakat PDF oluşturulamadı', 'error');
        }
    };

    return (
        <div className="p-4 space-y-6 animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-stone-900 rounded-xl text-stone-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black text-stone-100 tracking-tight">{supplier.name}</h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={generateReconciliationPdf}
                        className="px-3.5 py-2.5 bg-emerald-950/50 text-emerald-400 rounded-xl hover:bg-emerald-900/50 transition-colors border border-emerald-500/25 active:scale-95 flex items-center gap-1.5"
                        title="Resmi Cari Mutabakat Mektubu (PDF)"
                    >
                        <FileText size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Mutabakat</span>
                    </button>
                    <button 
                        onClick={() => setIsReportModalOpen(true)}
                        className="px-4 py-2.5 bg-stone-900 text-stone-400 rounded-xl hover:text-blue-400 transition-colors border border-white/5 active:scale-95"
                        title="Ekstre Al (PDF)"
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest">Ekstre</span>
                    </button>
                    <button 
                        onClick={() => onEdit(supplier)}
                        className="p-2.5 bg-stone-900 text-stone-400 rounded-xl hover:text-emerald-400 transition-colors border border-white/5 active:scale-95"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button 
                        onClick={async () => {
                            if (Math.abs(supplier.balance) > 0.01) {
                                showToast('Bakiyesi olan tedarikçi silinemez. Lütfen önce bakiyeyi sıfırlayın.', 'error');
                                return;
                            }
                            setConfirmModal({
                                isOpen: true,
                                title: 'Tedarikçi Silinecek',
                                message: 'Bu tedarikçiyi ve tüm kayıtlarını silmek istediğinize emin misiniz?',
                                onConfirm: async () => {
                                    await softDeleteSupplier(supplier.id);
                                    showToast('Tedarikçi silindi', 'info');
                                    onBack();
                                }
                            });
                        }}
                        className="p-2.5 bg-stone-900 text-stone-400 rounded-xl hover:text-rose-400 transition-colors border border-white/5 active:scale-95"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-stone-900 border border-white/5 p-3 sm:p-4 rounded-[1.5rem] flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-5 text-emerald-500">
                        <Package size={24} />
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-stone-500 font-black uppercase tracking-widest block mb-1">Toplam Alınan</span>
                    <div className="text-sm sm:text-lg lg:text-xl font-black text-stone-100 font-mono tracking-tight">
                        {formatCurrency(Math.round(totalAlinan), userProfile?.currency || 'TRY')}
                    </div>
                </div>
                <div className="bg-stone-900 border border-white/5 p-3 sm:p-4 rounded-[1.5rem] flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-5 text-blue-500">
                        <ArrowDownRight size={24} />
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-stone-500 font-black uppercase tracking-widest block mb-1">Ödenen/ İade/ Satış</span>
                    <div className="text-sm sm:text-lg lg:text-xl font-black text-stone-100 font-mono tracking-tight">
                        {formatCurrency(Math.round(totalOdenen), userProfile?.currency || 'TRY')}
                    </div>
                </div>
                <div className={`p-3 sm:p-4 rounded-[1.5rem] border flex flex-col justify-between relative overflow-hidden ${kalanBakiye < 0 ? 'bg-emerald-500/5 border-emerald-500/10' : (kalanBakiye > 0 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-stone-900 border-white/5')}`}>
                    <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-5">
                        <Wallet size={24} />
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-stone-500 font-black uppercase tracking-widest block mb-1">Kalan Bakiye</span>
                    <div className={`text-sm sm:text-lg lg:text-xl font-black font-mono tracking-tight ${kalanBakiye < 0 ? 'text-emerald-400' : (kalanBakiye > 0 ? 'text-rose-400' : 'text-stone-400')}`}>
                         {formatCurrency(Math.round(Math.abs(kalanBakiye)), userProfile?.currency || 'TRY')}
                    </div>
                    <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider opacity-60 absolute bottom-2 right-3 ${kalanBakiye < 0 ? 'text-emerald-500' : (kalanBakiye > 0 ? 'text-rose-500' : 'text-stone-500')}`}>
                        {kalanBakiye < 0 ? 'Alacaklı' : (kalanBakiye > 0 ? 'Ödenecek Borç' : 'Borç Yok')}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={onOpenReturn}
                    className="py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <RefreshCcw size={14} />
                    <span>İade Yap</span>
                </button>
                <button 
                    onClick={onOpenDebt}
                    className="py-3 bg-amber-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <AlertCircle size={14} />
                    <span>Borç Ekle</span>
                </button>
                <button 
                    onClick={() => onOpenPayment('RECEIVE')}
                    className="py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <ArrowDownLeft size={14} />
                    <span>Ödeme Al</span>
                </button>
                <button 
                    onClick={() => onOpenPayment('PAY')}
                    className="py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <CreditCard size={14} />
                    <span>Ödeme Yap</span>
                </button>
                <button 
                    onClick={onOpenPurchase}
                    className="py-3 bg-emerald-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <Package size={14} />
                    <span>Alış Yap</span>
                </button>
                <button 
                    onClick={onOpenSale}
                    className="py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <ArrowUpRight size={14} />
                    <span>Satış Yap</span>
                </button>
            </div>

            <div className="flex bg-stone-900/50 p-1 rounded-2xl border border-white/5">
                <button 
                    onClick={() => setActiveTab('PURCHASES')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PURCHASES' ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-500'}`}
                >
                    Alımlar
                </button>
                <button 
                    onClick={() => setActiveTab('PAYMENTS')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PAYMENTS' ? 'bg-stone-800 text-blue-400 shadow-sm' : 'text-stone-500'}`}
                >
                    Ödemeler
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {activeTab === 'PURCHASES' ? (
                        <>
                            <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] pl-1">Alınan Ürünler</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {purchasedProducts.map(product => {
                                    const stats = getProductStats(product.id);
                                    return (
                                        <div key={product.id} className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-stone-950 flex items-center justify-center text-emerald-500">
                                                    <FlaskConical size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-stone-200 text-sm">{product.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Toplam Alınan:</span>
                                                        <span className="text-[10px] font-black text-stone-300 font-mono">{product.totalQty} {product.unit}</span>
                                                        {product.returnedQty > 0 && (
                                                            <span className="text-[9px] font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/20">
                                                                İade: {product.returnedQty} {product.unit}
                                                            </span>
                                                        )}
                                                        {product.soldQty > 0 && (
                                                            <span className="text-[9px] font-bold text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                                                Tedarikçiye Satış: {product.soldQty} {product.unit}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Stok:</span>
                                                    <span className={`text-xs font-black font-mono ${stats.stock === 0 ? 'text-rose-500' : 'text-emerald-400'}`}>{stats.stock}</span>
                                                </div>
                                                <div className="flex items-center gap-2 justify-end mt-0.5">
                                                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Satılan:</span>
                                                    <span className="text-xs font-black text-blue-400 font-mono">{stats.sold}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {purchasedProducts.length === 0 && (
                                    <div className="py-12 text-center">
                                        <Package size={40} className="text-stone-800 mx-auto mb-3" />
                                        <p className="text-stone-600 text-xs font-medium">Henüz ürün alımı yapılmamış.</p>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] pl-1 mt-6">İşlem Geçmişi</h3>
                            <div className="space-y-3">
                                {isLoading ? (
                                    <ListSkeleton count={3} />
                                ) : purchases.length === 0 ? (
                                    <EmptyState
                                        icon={Package}
                                        title="Alım/İade kaydı yok"
                                        description="Bu tedarikçiden henüz bir alım veya iade işlemi yapılmamış."
                                    />
                                ) : purchases.map(purchase => (
                                    <div key={purchase.id} className="bg-stone-900/40 border border-white/5 rounded-2xl p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${purchase.type === 'SALE' || purchase.note?.includes('SATIŞ') ? 'bg-indigo-500/10 text-indigo-400' : ((purchase.type === 'RETURN' || purchase.note?.includes('İADE')) ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400')}`}>
                                                    {(purchase.type === 'SALE' || purchase.note?.includes('SATIŞ')) ? <ArrowUpRight size={14} /> : ((purchase.type === 'RETURN' || purchase.note?.includes('İADE')) ? <ArrowLeft size={14} /> : <ArrowDownRight size={14} />)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-stone-300 uppercase tracking-wider">
                                                        {(purchase.type === 'SALE' || purchase.note?.includes('SATIŞ')) ? 'Tedarikçiye Satış' : ((purchase.type === 'RETURN' || purchase.note?.includes('İADE')) ? 'Ürün İadesi' : 'Ürün Alımı')}
                                                    </span>
                                                    {purchase.receiptNo && (
                                                        <span className={`text-[8px] font-bold uppercase tracking-widest ${(purchase.type === 'SALE' || purchase.note?.includes('SATIŞ')) ? 'text-indigo-400' : ((purchase.type === 'RETURN' || purchase.note?.includes('İADE')) ? 'text-rose-400' : 'text-emerald-400')}`}>Fiş No: {purchase.receiptNo}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-stone-500 font-mono flex items-center gap-1">
                                                    {new Date(purchase.date).toLocaleDateString('tr-TR')}
                                                    <span className="flex items-center bg-stone-800/50 px-1 py-0.5 rounded ml-1">
                                                        <User size={8} className="mr-0.5" />
                                                        {purchase.createdById ? (teamMembers.find((m: any) => m.id === purchase.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                                                    </span>
                                                </span>
                                                <button 
                                                    onClick={() => setEditingPurchase(purchase)}
                                                    className="p-1.5 text-stone-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeletePurchase(purchase.id)}
                                                    className="p-2 text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-95"
                                                    title="Alımı Sil"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 mb-3">
                                            {purchase.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-[11px]">
                                                    <span className="text-stone-400">{item.pesticideName} ({Math.abs(item.quantity)} {item.unit})</span>
                                                    <span className="text-stone-500 font-mono">{formatCurrency(Math.abs(item.buyingPrice * item.quantity), userProfile?.currency || 'TRY')}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Toplam</span>
                                            <span className={`text-sm font-black font-mono ${(purchase.type === 'SALE' || purchase.note?.includes('SATIŞ')) ? 'text-indigo-400' : ((purchase.type === 'RETURN' || purchase.note?.includes('İADE')) ? 'text-rose-400' : 'text-emerald-400')}`}>
                                                {(purchase.type === 'SALE' || purchase.type === 'RETURN' || purchase.note?.includes('SATIŞ') || purchase.note?.includes('İADE') || purchase.totalAmount < 0) ? '+' : ''}{formatCurrency(Math.abs(purchase.totalAmount), userProfile?.currency || 'TRY')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            {isLoading ? (
                                <ListSkeleton count={3} />
                            ) : payments.length === 0 ? (
                                <EmptyState
                                    icon={CreditCard}
                                    title="Ödeme kaydı yok"
                                    description="Bu tedarikçiye henüz bir ödeme yapılmamış."
                                />
                            ) : payments.map(payment => (
                                <div key={payment.id} className="bg-stone-900/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${payment.type === 'RECEIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {payment.type === 'RECEIVE' ? <ArrowDownLeft size={18} /> : <CreditCard size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-stone-200 uppercase tracking-wider">{payment.type === 'RECEIVE' ? 'Ödeme Alındı' : 'Ödeme Yapıldı'}</span>
                                                <span className="text-[8px] font-bold text-stone-600 bg-stone-950 px-1.5 py-0.5 rounded uppercase tracking-widest">{payment.method}</span>
                                            </div>
                                            <div className="text-[9px] text-stone-500 font-mono mt-0.5 flex items-center gap-1">
                                                {new Date(payment.date).toLocaleDateString('tr-TR')}
                                                <span className="flex items-center bg-stone-800/50 px-1 py-0.5 rounded ml-1">
                                                    <User size={8} className="mr-0.5" />
                                                    {payment.createdById ? (teamMembers.find((m: any) => m.id === payment.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className={`text-sm font-black font-mono ${payment.type === 'RECEIVE' ? 'text-amber-400' : 'text-emerald-400'}`}>{payment.type === 'RECEIVE' ? '+' : '-'}{formatCurrency(payment.amount, userProfile?.currency || 'TRY')}</div>
                                            {payment.note && <div className="text-[8px] text-stone-600 italic truncate max-w-[100px]">{payment.note}</div>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleEditPayment(payment)}
                                                className="p-2.5 text-stone-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all active:scale-95 border border-transparent hover:border-emerald-500/20"
                                                title={payment.type === 'RECEIVE' ? 'Tahsilatı Düzenle' : 'Ödemeyi Düzenle'}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePayment(payment.id)}
                                                className="p-2.5 text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-95 border border-transparent hover:border-rose-500/20"
                                                title={payment.type === 'RECEIVE' ? 'Tahsilatı Sil' : 'Ödemeyi Sil'}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {payments.length === 0 && (
                                <div className="py-12 text-center">
                                    <CreditCard size={40} className="text-stone-800 mx-auto mb-3" />
                                    <p className="text-stone-600 text-xs font-medium">Henüz ödeme kaydı yok.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Purchase Modal */}
            {isPurchaseModalOpen && (
                <PurchaseModal 
                    supplier={supplier}
                    onClose={() => setIsPurchaseModalOpen(false)}
                    onSave={async (id: string) => {
                        await handleAddPurchase(id);
                        loadData();
                    }}
                    newPurchase={newPurchase}
                    setNewPurchase={setNewPurchase}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    userProfile={userProfile}
                    showToast={showToast}
                />
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <PaymentModal 
                    supplier={supplier}
                    onClose={handleClosePayment}
                    onSave={async () => {
                        await handleAddPayment();
                        loadData();
                    }}
                    newPayment={newPayment}
                    setNewPayment={setNewPayment}
                    accounts={accounts}
                    userProfile={userProfile}
                    isEdit={!!editingPayment}
                />
            )}

            {/* Debt Modal */}
            {isDebtModalOpen && (
                <DebtModal 
                    supplier={supplier}
                    onClose={() => setIsDebtModalOpen(false)}
                    onSave={async (amount: number, note: string) => {
                        await addSupplierPurchase({
                            supplierId: supplier.id,
                            date: new Date().toISOString(),
                            items: [],
                            totalAmount: amount,
                            note: note || 'Manuel borç ekleme'
                        });
                        setIsDebtModalOpen(false);
                        showToast('Borç eklendi', 'success');
                        loadData();
                    }}
                />
            )}

            {/* Edit Purchase Modal */}
            {isReturnModalOpen && (
                <PurchaseModal 
                    supplier={supplier}
                    onClose={() => setIsReturnModalOpen(false)}
                    onSave={async (id: string) => {
                        await handleAddReturn(id);
                        loadData();
                    }}
                    newPurchase={newReturn}
                    setNewPurchase={setNewReturn}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    isReturn={true}
                    showToast={showToast}
                />
            )}

            {isSaleModalOpen && (
                <PurchaseModal 
                    supplier={supplier}
                    onClose={() => setIsSaleModalOpen(false)}
                    onSave={async (id: string) => {
                        await handleAddSale(id);
                        loadData();
                    }}
                    newPurchase={newSale}
                    setNewPurchase={setNewSale}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    isSale={true}
                    showToast={showToast}
                />
            )}

            {isReportModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-stone-100 flex items-center gap-3">
                                <Download className="text-blue-500" />
                                Ekstre Seçenekleri
                            </h2>
                            <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-stone-800 rounded-full text-stone-500"><X size={16} /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-2 p-1 bg-stone-950 rounded-2xl border border-white/5">
                                <button 
                                    onClick={() => setReportOptions({...reportOptions, type: 'SUMMARY'})}
                                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportOptions.type === 'SUMMARY' ? 'bg-blue-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    Özet
                                </button>
                                <button 
                                    onClick={() => setReportOptions({...reportOptions, type: 'DETAILED'})}
                                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportOptions.type === 'DETAILED' ? 'bg-blue-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    Detaylı
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Başlangıç</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-3 text-xs text-stone-100 outline-none focus:border-blue-500/50 transition-all"
                                            value={reportOptions.startDate}
                                            onChange={(e) => setReportOptions({...reportOptions, startDate: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Bitiş</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-3 text-xs text-stone-100 outline-none focus:border-blue-500/50 transition-all"
                                            value={reportOptions.endDate}
                                            onChange={(e) => setReportOptions({...reportOptions, endDate: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {[new Date().getFullYear(), new Date().getFullYear() - 1].map(year => (
                                        <button 
                                            key={year}
                                            onClick={() => setReportOptions({
                                                ...reportOptions, 
                                                startDate: `${year}-01-01`,
                                                endDate: `${year}-12-31`
                                            })}
                                            className="px-3 py-1.5 bg-stone-800 border border-white/5 rounded-lg text-[10px] font-bold text-stone-400 hover:bg-stone-700 hover:text-white transition-all"
                                        >
                                            {year} Yılı
                                        </button>
                                    ))}
                                    <button 
                                        onClick={() => setReportOptions({
                                            ...reportOptions, 
                                            startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
                                            endDate: new Date().toISOString().split('T')[0]
                                        })}
                                        className="px-3 py-1.5 bg-stone-800 border border-white/5 rounded-lg text-[10px] font-bold text-stone-400 hover:bg-stone-700 hover:text-white transition-all"
                                    >
                                        Son 30 Gün
                                    </button>
                                    <button 
                                        onClick={() => setReportOptions({
                                            ...reportOptions, 
                                            startDate: '2020-01-01',
                                            endDate: new Date().toISOString().split('T')[0]
                                        })}
                                        className="px-3 py-1.5 bg-stone-800 border border-white/5 rounded-lg text-[10px] font-bold text-stone-400 hover:bg-stone-700 hover:text-white transition-all"
                                    >
                                        Tüm Zamanlar
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={generateReport}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                            >
                                <Download size={18} />
                                PDF Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {editingPurchase && (
                <PurchaseModal 
                    supplier={supplier}
                    onClose={() => setEditingPurchase(null)}
                    onSave={handleUpdatePurchase}
                    newPurchase={editingPurchase}
                    setNewPurchase={setEditingPurchase}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    isEdit={true}
                    isReturn={editingPurchase.totalAmount < 0}
                    showToast={showToast}
                />
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant="danger"
            />
        </div>
    );
};

const PurchaseModal = ({ 
    supplier, onClose, onSave, newPurchase, setNewPurchase, inventory, 
    isAddingNewPesticide, setIsAddingNewPesticide, newPesticide, setNewPesticide, handleAddNewPesticideToPurchase,
    isEdit = false, isReturn = false, isSale = false, showToast
}: any) => {
    const { userProfile, teamMembers, suppliers } = useAppViewModel();
    const [searchTerm, setSearchTerm] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [localSupplierId, setLocalSupplierId] = useState(supplier?.id || '');
    
    const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);
    // Scan waiting for a "new product" record (B-12: offer to add the product when it is not in the warehouse).
    const [pendingScan, setPendingScan] = useState<GS1ParseResult | null>(null);

    /** Lines are keyed by product + lot + SKT so two lots of one product stay separate (B-04). */
    const lineKey = (i: any) => `${i.pesticideId}|${String(i.lotNumber || '').trim().toLocaleUpperCase('tr-TR')}|${i.expiryDate || ''}`;

    /** Lot / SKT / GTIN / seri fields captured from a scan for a purchase line. */
    const scanFields = (scan?: GS1ParseResult | null) => {
        if (!scan) return {};
        const canonical = canonicalBarcodeFromParsed(scan);
        return {
            ...(scan.gtin ? { gtin: scan.gtin } : {}),
            ...(canonical ? { barcode: canonical } : {}),
            ...(scan.batch ? { lotNumber: scan.batch } : {}),
            ...(scan.expiryDate ? { expiryDate: scan.expiryDate } : {}),
            ...(scan.serial ? { serialNumber: scan.serial, serialNumbers: [scan.serial] } : {})
        };
    };

    /** Every serial already in the warehouse (batches + legacy field) or in this purchase. */
    const isSerialAlreadyRegistered = (serial: string): string | null => {
        const s = serial.trim();
        if (!s) return null;
        for (const inv of (inventory || []) as InventoryItem[]) {
            if (inv.deletedAt) continue;
            if (String(inv.serialNumber || '').trim() === s) return inv.pesticideName;
            for (const b of inv.batches || []) if ((b.serialNumbers || []).some(x => String(x).trim() === s)) return inv.pesticideName;
        }
        for (const line of newPurchase.items as any[]) {
            if (String(line.serialNumber || '').trim() === s || (line.serialNumbers || []).some((x: string) => String(x).trim() === s)) return `${line.pesticideName} (bu fiş)`;
        }
        return null;
    };
    
    const handleScan = (raw: string, format?: string) => {
        const parsed = parseGS1Barcode(raw, format);
        if (!parsed.valid) {
            playErrorBeep();
            showToast(`Barkod okunamadı: ${(parsed.errors || []).join(' • ') || 'geçersiz kod'}`, 'error');
            return;
        }
        // Purchases (stock-in) reject a box that was already received; returns/sales are stock-out.
        if (parsed.serial && !isReturn && !isSale) {
            const owner = isSerialAlreadyRegistered(parsed.serial);
            if (owner) {
                playErrorBeep();
                showToast(`Bu karekod zaten girilmiş: Seri ${parsed.serial} (${owner}).`, 'error');
                return;
            }
        }
        if (parsed.ambiguous) showToast('Karekodda GS ayırıcısı yok: Lot / Seri değerlerini kutudan kontrol edin.', 'info');
        if (parsed.expired) showToast(`Dikkat: Bu kutunun SKT'si geçmiş (${parsed.expiryDate}).`, 'error');

        // Already on this receipt (e.g. a brand-new product added earlier) → match the line first.
        const lineHit = (newPurchase.items as any[]).find(l => itemMatchesScan(l, parsed));
        const item = findItemByScan<InventoryItem>(inventory, parsed);
        if (item) {
            playScanBeep();
            handleAddItem(item, parsed);
        } else if (lineHit) {
            playScanBeep();
            handleAddItem({ pesticideId: lineHit.pesticideId, pesticideName: lineHit.pesticideName, unit: lineHit.unit, buyingPrice: lineHit.buyingPrice, sellingPrice: lineHit.sellingPrice } as InventoryItem, parsed);
        } else {
            playErrorBeep();
            setPendingScan(parsed);
            setNewPesticide({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });
            setIsAddingNewPesticide(true);
            showToast('Ürün depoda bulunamadı. Yeni ürün olarak ekleyebilirsiniz.', 'info');
        }
    };
    
    const filteredInventory = useMemo(() => {
        if (!searchTerm) return [];
        return inventory.filter((i: InventoryItem) => i.pesticideName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))).slice(0, 20);
    }, [inventory, searchTerm]);

    const handleAddNewPesticideToPurchaseLocal = () => {
        if (!newPesticide.name || !String(newPesticide.name).trim()) return;
        const scan = pendingScan;
        
        // Check if it already exists in inventory
        const existingItem = inventory.find((i: InventoryItem) => !i.deletedAt && i.pesticideName.toLocaleLowerCase('tr-TR').trim() === newPesticide.name.toLocaleLowerCase('tr-TR').trim());
        
        if (existingItem) {
            handleAddItem(existingItem, scan);
            setIsAddingNewPesticide(false);
            setPendingScan(null);
            setNewPesticide({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });
            return;
        }

        const tempId = `new-${crypto.randomUUID()}`;
        const newItem = {
            pesticideId: tempId,
            pesticideName: String(newPesticide.name).trim(),
            quantity: (isReturn || isSale) ? -1 : 1,
            unit: newPesticide.unit,
            buyingPrice: 0,
            sellingPrice: 0,
            // B-04/B-12: GTIN / Lot / SKT / Seri of the scanned box travel with the purchase line.
            ...scanFields(scan)
        };
        
        setNewPurchase({
            ...newPurchase,
            items: [...newPurchase.items, newItem]
        });
        
        setIsAddingNewPesticide(false);
        setPendingScan(null);
        setNewPesticide({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });
    };

    const handleAddItem = (item: InventoryItem, scan?: GS1ParseResult | null) => {
        const sign = (isReturn || isSale) ? -1 : 1;
        if (scan) {
            const fields: any = scanFields(scan);
            const key = lineKey({ pesticideId: item.pesticideId, lotNumber: fields.lotNumber, expiryDate: fields.expiryDate });
            const same = newPurchase.items.find((i: any) => lineKey(i) === key);
            if (same) {
                // Another box of the same lot: +1 and collect its serial.
                setNewPurchase({
                    ...newPurchase,
                    items: newPurchase.items.map((i: any) => lineKey(i) !== key ? i : {
                        ...i,
                        quantity: round2((Number(i.quantity) || 0) + sign),
                        ...(fields.gtin && !i.gtin ? { gtin: fields.gtin } : {}),
                        ...(fields.barcode && !i.barcode ? { barcode: fields.barcode } : {}),
                        ...(fields.serialNumber ? {
                            serialNumber: fields.serialNumber,
                            serialNumbers: Array.from(new Set([...(i.serialNumbers || (i.serialNumber ? [i.serialNumber] : [])), fields.serialNumber]))
                        } : {})
                    })
                });
                setSearchTerm('');
                return;
            }
            setNewPurchase({
                ...newPurchase,
                items: [...newPurchase.items, {
                    pesticideId: item.pesticideId,
                    pesticideName: item.pesticideName,
                    quantity: sign,
                    unit: item.unit,
                    buyingPrice: item.buyingPrice || 0,
                    sellingPrice: item.sellingPrice || 0,
                    ...(item.gtin ? { gtin: item.gtin } : {}),
                    ...(item.barcode ? { barcode: item.barcode } : {}),
                    ...fields
                }]
            });
            setSearchTerm('');
            return;
        }

        const exists = newPurchase.items.find((i: any) => i.pesticideId === item.pesticideId);
        if (exists) return;

        setNewPurchase({
            ...newPurchase,
            items: [...newPurchase.items, {
                pesticideId: item.pesticideId,
                pesticideName: item.pesticideName,
                quantity: sign,
                unit: item.unit,
                buyingPrice: item.buyingPrice || 0,
                sellingPrice: item.sellingPrice || 0
            }]
        });
        setSearchTerm('');
    };

    // Lines are addressed by index: one product may appear on several lines (different lots / SKT).
    const removeItem = (idx: number) => {
        setNewPurchase({
            ...newPurchase,
            items: newPurchase.items.filter((_: any, i: number) => i !== idx)
        });
    };

    const updateItem = (idx: number, field: string, value: any) => {
        let finalValue = value;
        if (field === 'quantity' && (isReturn || isSale)) {
            finalValue = -Math.abs(value);
        }
        setNewPurchase({
            ...newPurchase,
            items: newPurchase.items.map((it: any, i: number) => i === idx ? { ...it, [field]: finalValue } : it)
        });
    };

    const total = round2(newPurchase.items.reduce((acc: number, item: any) => acc + (item.buyingPrice * item.quantity), 0));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
            <div className="bg-stone-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300 my-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-stone-100 flex items-center gap-3">
                        {isReturn ? <RefreshCcw className="text-rose-500" /> : (isSale ? <ArrowUpRight className="text-indigo-500" /> : <Package className="text-emerald-500" />)}
                        {step === 1 ? 'Ürün Seçimi' : (isReturn ? 'İade Detayları' : (isSale ? 'Satış Detayları' : 'Alım Detayları'))}
                    </h2>
                    <div className="flex items-center gap-2">
                        {step === 2 && !isEdit && (
                            <button 
                                onClick={() => setStep(1)}
                                className="px-3 py-1.5 bg-stone-800 text-stone-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:text-white transition-colors flex items-center gap-1"
                            >
                                <ChevronLeft size={14} />
                                Geri
                            </button>
                        )}
                        <button type="button" onClick={onClose} aria-label="Kapat" data-mks-modal-close="true" className="w-11 h-11 flex items-center justify-center bg-stone-800 rounded-full text-stone-500 hover:text-stone-300"><X size={16} /></button>
                    </div>
                </div>

                {step === 1 ? (
                    <div className="space-y-5">
                        <div className="relative">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ürün Arayın veya Ekleyin</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                                    <input 
                                        type="text" 
                                        data-barcode-input="true"
                                        autoComplete="off"
                                        className="w-full min-h-[44px] bg-stone-950 border border-white/5 rounded-2xl py-3 pl-9 pr-4 text-xs text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-bold"
                                        placeholder="Ürün adı veya barkod / karekod (Enter)..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key !== 'Enter') return;
                                            e.preventDefault();
                                            const val = searchTerm.trim();
                                            if (!val) return;
                                            // Barcode / GS1 karekod typed or wedge-scanned into the field → treat as a scan.
                                            const looksLikeCode = /^[\d\s]{8,}$/.test(val) || /\u001D|^\(\d{2}\)|^\]|^01\d{14}|^https?:\/\//i.test(val);
                                            if (looksLikeCode || filteredInventory.length === 0) {
                                                handleScan(val);
                                                setSearchTerm('');
                                            } else if (filteredInventory.length === 1) {
                                                handleAddItem(filteredInventory[0]);
                                            }
                                        }}
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setIsScanning(true)}
                                    className="min-h-[44px] min-w-[44px] bg-stone-800 p-3 rounded-xl border border-white/5 text-stone-300 hover:bg-stone-700 transition-colors flex items-center justify-center"
                                    title="Barkod / Karekod Tara"
                                    aria-label="Barkod / Karekod Tara"
                                >
                                    <Barcode size={20} />
                                </button>
                            </div>
                            
                            {searchTerm && (
                                <div className="absolute z-20 w-full mt-2 bg-stone-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto font-sans">
                                    {filteredInventory.map((item: InventoryItem) => (
                                        <button 
                                            key={item.id}
                                            onClick={() => handleAddItem(item)}
                                            className="w-full p-4 text-left hover:bg-stone-700 flex items-center justify-between border-b border-white/5 last:border-0 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-stone-900 rounded-lg">
                                                    <FlaskConical size={14} className="text-emerald-500" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-stone-200">{item.pesticideName}</span>
                                                    <span className="text-[9px] text-stone-500 uppercase font-black tracking-widest">{item.category}</span>
                                                </div>
                                            </div>
                                            <Plus size={14} className="text-stone-400" />
                                        </button>
                                    ))}
                                    <button 
                                        onClick={() => setIsAddingNewPesticide(true)}
                                        className="w-full p-4 text-left hover:bg-emerald-900/40 flex items-center gap-3 text-emerald-400 border-t border-white/10 bg-emerald-500/10 transition-colors"
                                    >
                                        <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                                            <Plus size={14} />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-wider text-center flex-1">Listede Yok mu? Yeni Ürün Kaydı Aç</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="bg-stone-950/30 rounded-[2rem] p-4 border border-white/5 min-h-[250px]">
                            <h4 className="text-[10px] font-black text-stone-600 uppercase tracking-widest mb-4 ml-1 text-center">Seçilen Ürünler ({newPurchase.items.length})</h4>
                            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                {newPurchase.items.map((item: any, idx: number) => (
                                    <div key={`${item.pesticideId}-${idx}`} className="flex items-center justify-between p-3.5 bg-stone-900/50 rounded-[1.5rem] border border-white/5 group animate-in slide-in-from-right-2 duration-200">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-10 h-10 shrink-0 rounded-xl bg-stone-950 flex items-center justify-center text-emerald-500/30 border border-white/5">
                                                <FlaskConical size={18} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-bold text-stone-200 truncate">{item.pesticideName}</span>
                                                <span className="text-[11px] text-stone-500 font-black uppercase">
                                                    {Math.abs(Number(item.quantity) || 0)} {item.unit}
                                                    {item.lotNumber ? ` • Lot ${item.lotNumber}` : ''}
                                                    {item.expiryDate ? ` • SKT ${item.expiryDate}` : ''}
                                                    {(item.serialNumbers?.length || (item.serialNumber ? 1 : 0)) > 0 ? ` • ${item.serialNumbers?.length || 1} seri` : ''}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => removeItem(idx)} 
                                            aria-label="Listeden çıkar"
                                            className="min-h-[44px] min-w-[44px] p-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all flex items-center justify-center shrink-0"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                {newPurchase.items.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16 text-stone-600 opacity-50">
                                        <Package size={48} strokeWidth={1} className="mb-4" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Henüz ürün seçilmedi</span>
                                        <p className="text-[9px] text-stone-700">Ürün eklemek için arama alanını kullanın</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={onClose}
                                className="flex-1 py-4 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={() => setStep(2)}
                                disabled={newPurchase.items.length === 0}
                                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                            >
                                <span>Fiyat ve Adet Girin</span>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {!supplier && !isEdit && (
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 block">
                                        Tedarikçi Seçin
                                    </label>
                                    <div className="relative">
                                        <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                                        <select 
                                            className="w-full bg-stone-950 border border-white/5 rounded-2xl py-4 pl-11 pr-4 text-xs font-bold text-stone-100 outline-none focus:border-emerald-500/50 transition-all appearance-none"
                                            value={localSupplierId}
                                            onChange={(e) => setLocalSupplierId(e.target.value)}
                                        >
                                            <option value="">Seçiniz...</option>
                                            {suppliers.filter((s: Supplier) => !s.deletedAt).map((s: Supplier) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 rotate-90" />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 block">
                                    {isReturn ? 'İade Fiş No' : 'Fiş No'}
                                </label>
                                <div className="relative">
                                    <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                                    <input 
                                        type="text" 
                                        className="w-full bg-stone-950 border border-white/5 rounded-2xl py-4 pl-11 pr-4 text-xs font-bold text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono"
                                        placeholder="Fiş No"
                                        value={newPurchase.receiptNo || ''}
                                        onChange={(e) => setNewPurchase({...newPurchase, receiptNo: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 block">
                                    Ödeme Şekli
                                </label>
                                <div className="flex bg-stone-950 border border-white/5 rounded-2xl p-1.5 h-[50px]">
                                    <button 
                                        onClick={() => setNewPurchase({...newPurchase, paymentType: 'TERM'})}
                                        className={`flex-1 rounded-xl text-[10px] font-black uppercase transition-all ${newPurchase.paymentType === 'TERM' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-600 hover:text-stone-400'}`}
                                    >
                                        Vadeli
                                    </button>
                                    <button 
                                        onClick={() => setNewPurchase({...newPurchase, paymentType: 'CASH'})}
                                        className={`flex-1 rounded-xl text-[10px] font-black uppercase transition-all ${newPurchase.paymentType === 'CASH' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-600 hover:text-stone-400'}`}
                                    >
                                        Peşin
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                            {newPurchase.items.map((item: any, idx: number) => (
                                <div key={`${item.pesticideId}-${idx}`} className="bg-stone-950/40 border border-white/5 rounded-[2rem] p-5 space-y-5 hover:bg-stone-950/60 transition-all duration-300">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-stone-900 rounded-xl text-emerald-500">
                                                <FlaskConical size={16} />
                                            </div>
                                            <span className="text-sm font-black text-stone-100">{item.pesticideName}</span>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => removeItem(idx)} 
                                            className="min-h-[44px] min-w-[44px] p-2 text-stone-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all flex items-center justify-center"
                                            title="Listeden Çıkar"
                                            aria-label="Listeden Çıkar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest block text-center">Alış ({getCurrencySuffix(userProfile?.currency)})</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-stone-900 border border-white/5 rounded-xl p-3 text-[13px] font-black text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono text-center"
                                                value={item.buyingPrice || ''}
                                                onChange={(e) => updateItem(idx, 'buyingPrice', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest block text-center">Satış ({getCurrencySuffix(userProfile?.currency)})</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-stone-900 border border-white/5 rounded-xl p-3 text-[13px] font-black text-stone-100 outline-none focus:border-blue-500/50 transition-all font-mono text-center"
                                                value={item.sellingPrice || ''}
                                                onChange={(e) => updateItem(idx, 'sellingPrice', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest block text-center">Miktar ({item.unit})</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-stone-900 border border-white/5 rounded-xl p-3 text-[13px] font-black text-stone-100 outline-none focus:border-amber-500/50 transition-all font-mono text-center"
                                                value={Math.abs(item.quantity) || ''}
                                                onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                            />
                                        </div>
                                    </div>

                                    {/* B-04: Lot / SKT of the received batch (filled automatically from GS1 karekod scans) */}
                                    {!isSale && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-stone-600 uppercase tracking-widest block text-center">Lot / Parti</label>
                                                <input
                                                    type="text"
                                                    className="w-full min-h-[44px] bg-stone-900 border border-white/5 rounded-xl p-3 text-[13px] font-bold text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono text-center"
                                                    value={item.lotNumber || ''}
                                                    placeholder="—"
                                                    onChange={(e) => updateItem(idx, 'lotNumber', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-stone-600 uppercase tracking-widest block text-center">SKT</label>
                                                <input
                                                    type="date"
                                                    className="w-full min-h-[44px] bg-stone-900 border border-white/5 rounded-xl p-3 text-[13px] font-bold text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono text-center"
                                                    value={item.expiryDate || ''}
                                                    onChange={(e) => updateItem(idx, 'expiryDate', e.target.value)}
                                                />
                                            </div>
                                            {(item.gtin || item.serialNumbers?.length || item.serialNumber) && (
                                                <p className="col-span-2 text-[11px] font-mono text-stone-500 text-center break-all">
                                                    {item.gtin ? `GTIN ${item.gtin}` : ''}
                                                    {(item.serialNumbers?.length || item.serialNumber) ? ` • Seri: ${(item.serialNumbers || [item.serialNumber]).slice(0, 3).join(', ')}${(item.serialNumbers?.length || 0) > 3 ? ` +${item.serialNumbers.length - 3}` : ''}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-center px-2 pt-1">
                                        <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Ara Toplam</span>
                                        <span className="text-base font-black text-emerald-400 font-mono tracking-tighter">{formatCurrency(Math.abs(item.quantity) * item.buyingPrice, userProfile?.currency)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-stone-950/80 border border-white/5 rounded-[2rem] p-6 flex justify-between items-center mt-6 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-500">
                                <Package size={100} />
                            </div>
                            <div className="flex flex-col relative z-10">
                                <span className="text-[11px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1.5 block">Genel Toplam</span>
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1 bg-stone-900 rounded-lg text-stone-400 text-[10px] font-black uppercase border border-white/5">
                                        {newPurchase.items.length} Kalem / {newPurchase.items.reduce((acc: number, cur: any) => acc + Math.abs(cur.quantity), 0)} Ürün
                                    </div>
                                </div>
                            </div>
                            <div className="text-4xl font-black text-emerald-400 font-mono tracking-tight relative z-10">
                                {formatCurrency(total, userProfile?.currency)}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-2">
                            {!isEdit && (
                                <button 
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-5 bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <ChevronLeft size={18} />
                                    Listeye Dön
                                </button>
                            )}
                            <button 
                                onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                        await onSave(localSupplierId);
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                disabled={isSaving || newPurchase.items.length === 0 || (!supplier && !localSupplierId)}
                                className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.1em] active:scale-95 transition-all shadow-xl shadow-emerald-900/30 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {isSaving ? <RefreshCcw size={20} className="animate-spin" /> : <Save size={20} />}
                                {isEdit ? 'Güncelle' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isAddingNewPesticide && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-stone-100 flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 rounded-xl">
                                    <FlaskConical className="text-emerald-500" size={20} />
                                </div>
                                Yeni Ürün Kaydı
                            </h3>
                            <button type="button" onClick={() => { setIsAddingNewPesticide(false); setPendingScan(null); }} aria-label="Kapat" className="w-11 h-11 flex items-center justify-center bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors"><X size={18} /></button>
                        </div>
                        {pendingScan && (
                            <div className="mb-5 -mt-4 text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 break-all">
                                Okutulan kod depoda yok: {pendingScan.gtin ? `GTIN ${pendingScan.gtin}` : canonicalBarcodeFromParsed(pendingScan)}
                                {pendingScan.batch ? ` • Lot ${pendingScan.batch}` : ''}
                                {pendingScan.expiryDate ? ` • SKT ${pendingScan.expiryDate}` : ''}
                                {pendingScan.serial ? ` • Seri ${pendingScan.serial}` : ''}
                            </div>
                        )}
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-2 mb-2 block">Ürün Adı</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-5 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-bold"
                                    placeholder="Ürün adı (Örn: Gübre 10)"
                                    value={newPesticide.name}
                                    onChange={(e) => setNewPesticide({...newPesticide, name: e.target.value})}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-2 mb-2 block">Satış Birimi</label>
                                <select 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-5 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-bold appearance-none cursor-pointer"
                                    value={newPesticide.unit}
                                    onChange={(e) => setNewPesticide({...newPesticide, unit: e.target.value})}
                                >
                                    <option value="Adet">Adet</option>
                                    <option value="Litre">Litre</option>
                                    <option value="Kg">Kg</option>
                                    <option value="Gram">Gram</option>
                                    <option value="Paket">Paket</option>
                                    <option value="Kutu">Kutu</option>
                                    <option value="Çuval">Çuval</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-10">
                            <button 
                                type="button"
                                onClick={() => { setIsAddingNewPesticide(false); setPendingScan(null); }}
                                className="flex-1 min-h-[44px] py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:text-stone-300 transition-colors"
                            >
                                Vazgeç
                            </button>
                            <button 
                                type="button"
                                onClick={handleAddNewPesticideToPurchaseLocal}
                                className="flex-1 min-h-[44px] py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/40 active:scale-95 transition-all"
                            >
                                Listeye Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isScanning && (
                <div className="fixed inset-0 z-[150] bg-black">
                    <BarcodeScanner 
                        onScan={(code, meta) => {
                            handleScan(code, meta?.format);
                            setIsScanning(false);
                        }}
                        onClose={() => setIsScanning(false)}
                    />
                </div>
            )}
        </div>
    );
};

const PaymentModal = ({ supplier, onClose, onSave, newPayment, setNewPayment, accounts, userProfile, isEdit = false }: any) => {
    const [isSaving, setIsSaving] = useState(false);
    const isReceive = newPayment.type === 'RECEIVE';
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                    {isReceive ? <ArrowDownLeft className="text-emerald-500" /> : <CreditCard className={isEdit ? "text-emerald-500" : "text-blue-500"} />}
                    {isEdit ? 'Ödemeyi Düzenle' : (isReceive ? 'Ödeme Al' : 'Ödeme Yap')}
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ödeme Tutarı ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                        <input 
                            type="number"
                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-blue-500/50 transition-all font-mono"
                            placeholder="0.00"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Hesap Seçin</label>
                        <select 
                            className="w-full h-[54px] px-4 bg-stone-950 border border-white/5 rounded-2xl text-sm text-stone-100 outline-none focus:border-blue-500/50 transition-all"
                            value={newPayment.accountId}
                            onChange={(e) => setNewPayment({...newPayment, accountId: e.target.value})}
                        >
                            <option value="">Hesap Seçilmedi</option>
                            {accounts.map((acc: any) => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: userProfile?.currency || 'TRY' }).format(acc.balance)})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ödeme Yöntemi</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['CASH', 'CARD', 'CHECK', 'PROMISSORY_NOTE', 'OTHER'].map(method => (
                                <button 
                                    key={method}
                                    onClick={() => setNewPayment({...newPayment, method, installments: 1, producerCardMonths: 0})}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${newPayment.method === method ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                                >
                                    {method === 'CASH' ? 'Nakit' : method === 'CARD' ? 'Kart' : method === 'CHECK' ? 'Çek' : method === 'PROMISSORY_NOTE' ? 'Senet' : 'Diğer'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {newPayment.method === 'CARD' && (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Kart Tipi</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setNewPayment({...newPayment, producerCardMonths: 0})}
                                        className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${!newPayment.producerCardMonths ? 'bg-stone-100 border-stone-100 text-stone-900' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                                    >
                                        Normal Kart / Taksit
                                    </button>
                                    <button 
                                        onClick={() => setNewPayment({...newPayment, installments: 1, producerCardMonths: 1})}
                                        className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${newPayment.producerCardMonths > 0 ? 'bg-stone-100 border-stone-100 text-stone-900' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                                    >
                                        Üretici Kart
                                    </button>
                                </div>
                            </div>
                            
                            {newPayment.producerCardMonths > 0 ? (
                                <div>
                                    <label className="text-xs font-bold text-stone-400 ml-1 mb-1.5 block">Ödeme Vadesi (Ay)</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                        {[1, 2, 3, 4, 5, 6].map(m => (
                                            <button 
                                                key={m}
                                                onClick={() => setNewPayment({...newPayment, producerCardMonths: m})}
                                                className={`min-h-[40px] py-2 rounded-xl text-xs font-bold border transition-all ${newPayment.producerCardMonths === m ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-950 border-white/5 text-stone-400'}`}
                                            >
                                                {m} Ay
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs font-bold text-stone-400 ml-1 mb-1.5 block">Taksit Sayısı</label>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(t => (
                                            <button 
                                                key={t}
                                                onClick={() => setNewPayment({...newPayment, installments: t})}
                                                className={`min-h-[40px] py-2 rounded-xl text-xs font-bold border transition-all ${newPayment.installments === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-950 border-white/5 text-stone-400'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {(newPayment.method === 'CHECK' || newPayment.method === 'PROMISSORY_NOTE') && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Vade Tarihi</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                                <input 
                                    type="date" 
                                    className="w-full h-[54px] bg-stone-950 border border-white/5 rounded-2xl pl-12 pr-4 text-sm text-stone-100 outline-none focus:border-blue-500/50 transition-all"
                                    value={newPayment.dueDate}
                                    onChange={(e) => setNewPayment({...newPayment, dueDate: e.target.value})}
                                />
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Not</label>
                        <textarea 
                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-blue-500/50 transition-all h-24 resize-none"
                            placeholder="Ödeme notu..."
                            value={newPayment.note}
                            onChange={(e) => setNewPayment({...newPayment, note: e.target.value})}
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-8">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                    >
                        İptal
                    </button>
                    <button 
                        onClick={async () => {
                            if (isSaving) return;
                            setIsSaving(true);
                            try {
                                await onSave();
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                        disabled={isSaving}
                        className={`flex-1 py-4 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg disabled:opacity-50 ${isEdit ? 'bg-emerald-600 shadow-emerald-900/20' : 'bg-blue-600 shadow-blue-900/20'}`}
                    >
                        {isSaving ? 'Kaydediliyor...' : (isEdit ? 'Güncelle' : (isReceive ? 'Tahsilatı Kaydet' : 'Ödemeyi Kaydet'))}
                    </button>
                </div>
            </div>
        </div>
    );
};

