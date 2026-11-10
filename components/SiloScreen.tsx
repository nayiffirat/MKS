import { createMultiPagePdf } from '../utils/pdfHelper';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbService } from '../services/db';
import { SiloTransaction } from '../types';
import { Plus, Trash2, ArrowLeft, TrendingUp, TrendingDown, Package, Edit2, Info, User, Download, Calendar, Wallet, ChevronRight, FileText, Paperclip, Search, X as XIcon, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { validateTcOrVkn } from '../utils/tcNoValidator';
import { formatCurrency } from '../utils/currency';
import { useAppViewModel } from '../context/AppContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { ConfirmationModal } from './ConfirmationModal';
import { storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const SiloScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { userProfile, activeTeamMember, hapticFeedback } = useAppViewModel();
    const isAdmin = activeTeamMember?.role !== 'SALES';
    
    // Pamuk, mısır, buğday, arpa, ayçiçeği, antepfıstığı, zeytin
    const PRODUCTS = ['Pamuk', 'Mısır', 'Buğday', 'Arpa', 'Ayçiçeği', 'Antepfıstığı', 'Zeytin'];
    
    const [transactions, setTransactions] = useState<SiloTransaction[]>([]);
    const [siloContacts, setSiloContacts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactTcNo, setContactTcNo] = useState('');
    const [contactAddress, setContactAddress] = useState('');
    const [contactType, setContactType] = useState<'BUYER'|'SELLER'|'BOTH'>('BUYER');

    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [txToDelete, setTxToDelete] = useState<string | null>(null);

    const [editingTx, setEditingTx] = useState<SiloTransaction | null>(null);
    const [type, setType] = useState<'BUY' | 'SELL' | 'PAYMENT_IN' | 'PAYMENT_OUT'>('BUY');
    const [product, setProduct] = useState(PRODUCTS[0]);
    const [person, setPerson] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [quantity, setQuantity] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    const [paymentMode, setPaymentMode] = useState<'CASH' | 'TERM'>('CASH');
    const [dueDate, setDueDate] = useState('');
    const [plateNumber, setPlateNumber] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [transportCost, setTransportCost] = useState('');
    const [isTransportIncluded, setIsTransportIncluded] = useState(false);
    const [transportPayer, setTransportPayer] = useState<'US'|'THEM'>('US');
    const [commissionRate, setCommissionRate] = useState('1');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BUYS' | 'SELLS' | 'SELLERS' | 'BUYERS' | 'STOCKS' | 'FINANCE'>('OVERVIEW');
    
    const [selectedProductDetails, setSelectedProductDetails] = useState<string | null>(null);
    const [selectedPersonDetails, setSelectedPersonDetails] = useState<string | null>(null);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_SEASON' | 'CUSTOM'>('ALL');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const tr = (text: string | undefined | null) => {
        if (!text) return '';
        return String(text)
            .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u').replace(/Ü/g, 'U')
            .replace(/ş/g, 's').replace(/Ş/g, 'S')
            .replace(/ı/g, 'i').replace(/İ/g, 'I')
            .replace(/ö/g, 'o').replace(/Ö/g, 'O')
            .replace(/ç/g, 'c').replace(/Ç/g, 'C');
    };

    useEffect(() => {
        loadData();
    }, []);
    
    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await dbService.getAllSiloTransactions();
            const activeData = data.filter(d => !d.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(activeData);
            
            const reqContacts = await (dbService as any).getSiloContacts();
            setSiloContacts(reqContacts);
        } catch (e) {
            console.error("Error loading silo data:", e);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSave = async () => {
        if (!isAdmin) return window.alert("Sadece yöneticiler silom işlemlerine müdahale edebilir.");
        if (!person || (!quantity && type !== 'PAYMENT_IN' && type !== 'PAYMENT_OUT') || !unitPrice) return;
        
        setIsLoading(true);
        try {
            const parsedQuantity = quantity.replace(',', '.');
            const parsedPrice = unitPrice.replace(',', '.');
            const parsedTransport = isTransportIncluded && transportCost ? transportCost.replace(',', '.') : undefined;
            
            const qtyNum = type === 'PAYMENT_IN' || type === 'PAYMENT_OUT' ? 0 : parseFloat(parsedQuantity);
            const priceNum = parseFloat(parsedPrice);
            if (isNaN(qtyNum) || isNaN(priceNum) || priceNum <= 0) {
                setIsLoading(false);
                return;
            }
            
            let totalAmt = type === 'PAYMENT_IN' || type === 'PAYMENT_OUT' ? priceNum : qtyNum * priceNum;
            let commRate: number | undefined = undefined;
            let commAmt: number | undefined = undefined;
            
            if (type === 'SELL') {
                const rate = parseFloat(commissionRate.replace(',', '.')) || 0;
                if (rate > 0) {
                    commRate = rate;
                    commAmt = totalAmt * (rate / 100);
                    totalAmt -= commAmt;
                }
            }

            if ((type === 'BUY' || type === 'SELL') && parsedTransport) {
                const transportNum = parseFloat(parsedTransport);
                if (!isNaN(transportNum)) {
                    if (transportPayer === 'US') {
                        if (type === 'SELL') totalAmt -= transportNum;
                        if (type === 'BUY') totalAmt += transportNum;
                    } else {
                        if (type === 'SELL') totalAmt += transportNum;
                        if (type === 'BUY') totalAmt -= transportNum;
                    }
                }
            }

            let finalDocUrl = editingTx?.documentUrl || undefined;
            if (documentFile) {
                const fileExt = documentFile.name.split('.').pop();
                const fileName = `silo_docs/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const fileRef = ref(storage, fileName);
                await uploadBytes(fileRef, documentFile);
                finalDocUrl = await getDownloadURL(fileRef);
            }
            
            if (editingTx) {
                const updated: SiloTransaction = {
                    ...editingTx,
                    type,
                    product: type === 'PAYMENT_IN' || type === 'PAYMENT_OUT' ? '-' : product,
                    person,
                    date: new Date(date).toISOString(),
                    quantity: qtyNum,
                    unitPrice: priceNum,
                    totalAmount: totalAmt,
                    commissionRate: commRate,
                    commissionAmount: commAmt,
                    paymentType: type === 'BUY' || type === 'SELL' ? paymentMode : undefined,
                    dueDate: (type === 'BUY' || type === 'SELL') && paymentMode === 'TERM' && dueDate ? new Date(dueDate).toISOString() : undefined,
                    plateNumber: (type === 'BUY' || type === 'SELL') && plateNumber.trim() ? plateNumber.trim() : undefined,
                    driverPhone: (type === 'BUY' || type === 'SELL') && driverPhone.trim() ? driverPhone.trim() : undefined,
                    transportCost: (type === 'BUY' || type === 'SELL') && parsedTransport ? parseFloat(parsedTransport) : undefined,
                    transportPayer: (type === 'BUY' || type === 'SELL') && parsedTransport ? transportPayer : undefined,
                    documentUrl: finalDocUrl,
                };
                await dbService.updateSiloTransaction(updated);
            } else {
                const newTx: SiloTransaction = {
                    id: String(Date.now()),
                    type,
                    product: type === 'PAYMENT_IN' || type === 'PAYMENT_OUT' ? '-' : product,
                    person,
                    date: new Date(date).toISOString(),
                    quantity: qtyNum,
                    unitPrice: priceNum,
                    totalAmount: totalAmt,
                    commissionRate: commRate,
                    commissionAmount: commAmt,
                    paymentType: type === 'BUY' || type === 'SELL' ? paymentMode : undefined,
                    dueDate: (type === 'BUY' || type === 'SELL') && paymentMode === 'TERM' && dueDate ? new Date(dueDate).toISOString() : undefined,
                    plateNumber: (type === 'BUY' || type === 'SELL') && plateNumber.trim() ? plateNumber.trim() : undefined,
                    driverPhone: (type === 'BUY' || type === 'SELL') && driverPhone.trim() ? driverPhone.trim() : undefined,
                    transportCost: (type === 'BUY' || type === 'SELL') && parsedTransport ? parseFloat(parsedTransport) : undefined,
                    transportPayer: (type === 'BUY' || type === 'SELL') && parsedTransport ? transportPayer : undefined,
                    createdById: activeTeamMember?.id,
                    documentUrl: finalDocUrl,
                };
                await dbService.addSiloTransaction(newTx);
            }
            
            const contactType = (type === 'BUY' || type === 'PAYMENT_OUT') ? 'SELLER' : 'BUYER';
            
            closeModal();
            loadData();
        } catch (e) {
            console.error("Save error:", e);
            window.alert("Kayıt sırasında bir hata oluştu.");
            setIsLoading(false);
        }
    };
    
    const handleContactSave = async () => {
        if (!isAdmin) return window.alert("Sadece yöneticiler silom işlemlerine müdahale edebilir.");
        if (!contactName.trim()) return;
        const tcCheck = validateTcOrVkn(contactTcNo);
        if (!tcCheck.isValid) {
            window.alert(tcCheck.message);
            return;
        }
        
        try {
            if (editingContactId) {
                const updatedContact = siloContacts.find(c => c.id === editingContactId);
                if (updatedContact) {
                    const oldName = updatedContact.name;
                    const finalName = contactName.trim();
                    const finalContact = {
                        ...updatedContact,
                        name: finalName,
                        phone: contactPhone.trim(),
                        tcNo: contactTcNo.trim(),
                        address: contactAddress.trim(),
                        type: contactType
                    };
                    await (dbService as any).updateSiloContact(finalContact);
                    
                    if (oldName !== finalName) {
                        const personTxs = transactions.filter(t => t.person === oldName);
                        for (const tx of personTxs) {
                            await dbService.updateSiloTransaction({ ...tx, person: finalName });
                        }
                    }
                }
            } else {
                const newContact: import('../types').SiloContact = {
                    id: String(Date.now()),
                    name: contactName.trim(),
                    phone: contactPhone.trim(),
                    tcNo: contactTcNo.trim(),
                    address: contactAddress.trim(),
                    type: contactType,
                    createdById: activeTeamMember?.id
                };
                await (dbService as any).addSiloContact(newContact);
            }
            closeContactModal();
            if (editingContactId && selectedPersonDetails) {
                 setSelectedPersonDetails(contactName.trim());
            }
            loadData();
        } catch (e) {
            console.error("Contact save error:", e);
        }
    };

    const handleDeleteContact = async (contactId: string) => {
        if (!isAdmin) return window.alert("Sadece yöneticiler işlemlere müdahale edebilir.");
        if (window.confirm("Bu kişiyi silmek istediğinizden emin misiniz? (İşlem geçmişi silinmez)")) {
             try {
                 await (dbService as any).deleteSiloContact(contactId);
                 closeContactModal();
                 setSelectedPersonDetails(null);
                 loadData();
             } catch (e) {
                 console.error("Contact delete error:", e);
             }
        }
    };

    const openEditContactModal = (contactNameString: string) => {
        const contact = siloContacts.find(c => c.name === contactNameString);
        if (contact) {
             setEditingContactId(contact.id);
             setContactName(contact.name);
             setContactPhone(contact.phone || '');
             setContactTcNo(contact.tcNo || '');
             setContactAddress(contact.address || '');
             setContactType(contact.type || 'BUYER');
             setIsContactModalOpen(true);
        }
    };

    const closeContactModal = () => {
        setIsContactModalOpen(false);
        setEditingContactId(null);
        setContactName('');
        setContactPhone('');
        setContactTcNo('');
        setContactAddress('');
        setContactType('BUYER');
    };

    const generateReportPDF = async () => {
        setIsGeneratingPDF(true);
        // Wait for state update and React render
        setTimeout(async () => {
            try {
                const doc = new jsPDF('p', 'mm', 'a4');
                const pages = document.querySelectorAll('.pdf-page-container');
                
                for (let i = 0; i < pages.length; i++) {
                    const el = pages[i] as HTMLElement;
                    const canvas = await html2canvas(el, { 
                        scale: 2, 
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff'
                    });
                    
                    const imgData = canvas.toDataURL('image/jpeg', 1.0);
                    if (i > 0) doc.addPage();
                    
                    doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                }
                
                doc.save(`Silo_Raporu_${new Date().toLocaleDateString('tr-TR')}.pdf`);
            } catch (error) {
                console.error('PDF Error:', error);
                alert('PDF oluşturulurken bir hata oluştu.');
            } finally {
                setIsGeneratingPDF(false);
            }
        }, 1500); // Wait for fonts and layout
    };

    const handleDelete = (id: string) => {
        if (!isAdmin) return window.alert("Sadece yöneticiler silom işlemlerine müdahale edebilir.");
        setTxToDelete(id);
        setIsConfirmDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!txToDelete) return;
        const tx = transactions.find(t => t.id === txToDelete);
        if (tx) {
            const updated = { ...tx, deletedAt: new Date().toISOString() };
            await dbService.updateSiloTransaction(updated);
            loadData();
        }
        setIsConfirmDeleteModalOpen(false);
        setTxToDelete(null);
    };
    
    const openNewModal = (txType: 'BUY' | 'SELL' | 'PAYMENT_IN' | 'PAYMENT_OUT', defaultPerson?: string) => {
        if (!isAdmin) return window.alert("Sadece yöneticiler silom işlemlerine müdahale edebilir.");
        setEditingTx(null);
        setType(txType);
        setProduct(PRODUCTS[0]);
        setPerson(defaultPerson || '');
        setQuantity('');
        setUnitPrice('');
        setDate(new Date().toISOString().split('T')[0]);
        setPaymentMode('CASH');
        setDueDate('');
        setPlateNumber('');
        setDriverPhone('');
        setTransportCost('');
        setIsTransportIncluded(false);
        setTransportPayer('US');
        setCommissionRate('1');
        setDocumentFile(null);
        setIsModalOpen(true);
    };
    
    const openEditModal = (tx: SiloTransaction) => {
        if (!isAdmin) return window.alert("Sadece yöneticiler silom işlemlerine müdahale edebilir.");
        setEditingTx(tx);
        setType(tx.type as any);
        setProduct(tx.product || PRODUCTS[0]);
        setPerson(tx.person);
        setQuantity(tx.quantity ? tx.quantity.toString() : '');
        setUnitPrice(tx.unitPrice ? tx.unitPrice.toString() : tx.totalAmount.toString());
        setPaymentMode(tx.paymentType || 'CASH');
        setPlateNumber(tx.plateNumber || '');
        setDriverPhone(tx.driverPhone || '');
        setTransportCost(tx.transportCost ? tx.transportCost.toString() : '');
        setIsTransportIncluded(!!tx.transportCost);
        setTransportPayer(tx.transportPayer || 'US');
        setCommissionRate(tx.commissionRate ? tx.commissionRate.toString() : '1');
        setDocumentFile(null);
        // Handle timezone issues manually to get local date
        const localDate = new Date(tx.date);
        setDate(`${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`);
        
        if (tx.dueDate) {
            const d = new Date(tx.dueDate);
            setDueDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        } else {
            setDueDate('');
        }
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTx(null);
        setDocumentFile(null);
    };
    
    const generatePDF = async (tx: SiloTransaction) => {
        hapticFeedback('medium');
        setIsLoading(true);
        try {
            const isBuy = tx.type === 'BUY';
            const isPay = tx.type === 'PAYMENT_IN' || tx.type === 'PAYMENT_OUT';
            
            const dateStr = new Date(tx.date).toLocaleDateString('tr-TR');
            let txTypeName = isBuy ? 'ÜRÜN ALIM KAYDI' : 'ÜRÜN SATIŞ KAYDI';
            let primaryColor = isBuy || tx.type === 'PAYMENT_OUT' ? '#0ea5e9' : '#f59e0b'; // Sky 500 : Amber 500
            
            if (tx.type === 'PAYMENT_IN') {
                txTypeName = 'TAHSİLAT FİŞİ';
                primaryColor = '#10b981'; // Emerald
            } else if (tx.type === 'PAYMENT_OUT') {
                txTypeName = 'TEDİYE FİŞİ';
                primaryColor = '#f43f5e'; // Rose
            }

            let finalTotal = tx.totalAmount;
            if (!isPay && tx.type === 'SELL' && tx.transportCost) {
                finalTotal -= tx.transportCost;
            }

            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            
            let itemsHtml = '';
            
            if (!isPay) {
                itemsHtml = `
                    <div style="margin-top: 30px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 12px; text-align: left; color: #475569;">AçıKlama</th>
                                    <th style="padding: 12px; text-align: right; color: #475569;">Miktar</th>
                                    <th style="padding: 12px; text-align: right; color: #475569;">Birim Fİyat</th>
                                    <th style="padding: 12px; text-align: right; color: #475569;">Tutar</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 14px 12px; font-weight: 600; color: #0f172a;">${tx.product.toUpperCase()}</td>
                                    <td style="padding: 14px 12px; text-align: right; color: #334155;">${tx.quantity?.toLocaleString('tr-TR')} KG</td>
                                    <td style="padding: 14px 12px; text-align: right; color: #334155;">${formatCurrency(tx.unitPrice, 'TRY')}</td>
                                    <td style="padding: 14px 12px; text-align: right; font-weight: 600; color: #0f172a;">${formatCurrency((tx.quantity || 0) * (tx.unitPrice || 0), 'TRY')}</td>
                                </tr>
                                ${tx.commissionAmount ? `
                                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
                                    <td style="padding: 10px 12px; color: #64748b;">Komisyon (${tx.commissionRate}%)</td>
                                    <td style="padding: 10px 12px; text-align: right; color: #94a3b8;" colspan="2">(Fiyattan Düşüldü)</td>
                                    <td style="padding: 10px 12px; text-align: right; color: #e11d48;">-${formatCurrency(tx.commissionAmount, 'TRY')}</td>
                                </tr>
                                ` : ''}
                                ${tx.transportCost ? `
                                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
                                    <td style="padding: 10px 12px; color: #64748b;">Nakliye Maliyeti</td>
                                    <td style="padding: 10px 12px; text-align: right; color: #94a3b8;" colspan="2">${(tx.transportPayer === 'US' && tx.type === 'SELL') || (tx.transportPayer === 'THEM' && tx.type === 'BUY') ? '(Düşüldü)' : '(Eklendi)'}</td>
                                    <td style="padding: 10px 12px; text-align: right; color: ${(tx.transportPayer === 'US' && tx.type === 'SELL') || (tx.transportPayer === 'THEM' && tx.type === 'BUY') ? '#e11d48' : '#10b981'};">${(tx.transportPayer === 'US' && tx.type === 'SELL') || (tx.transportPayer === 'THEM' && tx.type === 'BUY') ? '-' : '+'}${formatCurrency(tx.transportCost, 'TRY')}</td>
                                </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                itemsHtml = `
                    <div style="margin-top: 30px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 12px; text-align: left; color: #475569;">İşlem Türü</th>
                                    <th style="padding: 12px; text-align: left; color: #475569;">Açıklama</th>
                                    <th style="padding: 12px; text-align: right; color: #475569;">Tutar</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 14px 12px; font-weight: 600; color: #0f172a;">${txTypeName}</td>
                                    <td style="padding: 14px 12px; color: #334155;">${tx.person} CARİ HESABI</td>
                                    <td style="padding: 14px 12px; text-align: right; font-weight: 600; color: #0f172a;">${formatCurrency(tx.totalAmount, 'TRY')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;
            }

            container.innerHTML = `
                <div style="width: 800px; padding: 60px; background: white; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <div style="height: 12px; background-color: ${primaryColor}; position: absolute; top: 0; left: 0; right: 0;"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 20px;">
                        <div>
                            <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${tx.type === 'BUY' || tx.type === 'SELL' ? 'ÜRÜN İŞLEM FİŞİ' : 'FİNANSAL İŞLEM FİŞİ'}</h1>
                            <p style="margin: 8px 0 0; font-size: 14px; font-weight: 500; color: #64748b;">${userProfile?.companyName || 'Silo Yönetimi'}</p>
                        </div>
                        <div style="text-align: right;">
                            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: ${primaryColor};">${txTypeName}</h2>
                            <p style="margin: 6px 0 0; font-size: 14px; color: #475569; font-weight: 600;">Tarih: ${dateStr}</p>
                            <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">NO: #${tx.id.substring(tx.id.length - 8).toUpperCase()}</p>
                        </div>
                    </div>

                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; display: flex; justify-content: space-between;">
                        <div>
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">${isBuy || tx.type === 'PAYMENT_OUT' ? 'TEDARİKÇİ / SATICI:' : 'MÜŞTERİ / ALICI:'}</p>
                            <p style="margin: 8px 0 0; font-size: 20px; font-weight: 800; color: #0f172a;">${tx.person.toUpperCase()}</p>
                        </div>
                        ${!isPay && tx.plateNumber ? `
                        <div style="text-align: right; border-left: 2px dashed #cbd5e1; padding-left: 24px;">
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">ARAÇ / NAKLİYE:</p>
                            <p style="margin: 8px 0 0; font-size: 18px; font-weight: 700; color: #334155;">${tx.plateNumber.toUpperCase()}</p>
                            ${tx.driverPhone ? `<p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Şoför: ${tx.driverPhone}</p>` : ''}
                        </div>
                        ` : ''}
                    </div>

                    ${itemsHtml}

                    <div style="margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            ${!isPay ? `
                            <p style="margin: 0; font-size: 14px; color: #475569; font-weight: 600;">ÖDEME ŞEKLİ: <span style="font-weight: 800; color: #0f172a;">${tx.paymentType === 'TERM' ? 'VADELİ' : 'PEŞİN / KASA'}</span></p>
                            ${tx.paymentType === 'TERM' && tx.dueDate ? `
                                <p style="margin: 8px 0 0; font-size: 14px; font-weight: 800; color: #e11d48;">VADE TARİHİ: ${new Date(tx.dueDate).toLocaleDateString('tr-TR')}</p>
                            ` : ''}
                            ` : ''}
                        </div>
                        <div style="text-align: right; background-color: #f1f5f9; padding: 16px 32px; border-radius: 12px;">
                            <p style="margin: 0; font-size: 13px; font-weight: 700; color: #64748b;">GENEL TOPLAM</p>
                            <p style="margin: 8px 0 0; font-size: 32px; font-weight: 900; color: #0f172a; letter-spacing: -1px;">${formatCurrency(finalTotal, 'TRY')}</p>
                        </div>
                    </div>

                    <div style="margin-top: 80px; display: flex; justify-content: space-between; padding: 0 40px;">
                        <div style="text-align: center;">
                            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #475569;">TESLİM EDEN</p>
                            <div style="margin-top: 60px; width: 200px; border-bottom: 1px solid #94a3b8;"></div>
                            <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">İmza</p>
                        </div>
                        <div style="text-align: center;">
                            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #475569;">TESLİM ALAN</p>
                            <div style="margin-top: 60px; width: 200px; border-bottom: 1px solid #94a3b8;"></div>
                            <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">İmza</p>
                        </div>
                    </div>

                    <div style="margin-top: 80px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
                        Bu belge MKS Tarım Bilgi Sistemi tarafından dijital olarak üretilmiştir.
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            
            const elementToCapture = container.firstElementChild as HTMLElement;
            const canvas = await html2canvas(elementToCapture, {
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });
            
            document.body.removeChild(container);
            
            const pdf = createMultiPagePdf(canvas);
            
            const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
            const safeName = tx.person
                .replace(/[ĞğÜüŞşİıÖöÇç]/g, match => charMap[match])
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');

            pdf.save(`Silo_${safeName}_${tx.id.substring(tx.id.length-6)}.pdf`);
        } catch (error) {
            console.error('PDF error:', error);
            alert('PDF oluşturulurken bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    const generatePersonStatementPDF = async (personName: string, personTxs: SiloTransaction[], balance: number, statInfo: any) => {
        hapticFeedback('medium');
        setIsLoading(true);
        try {
            const dateStr = new Date().toLocaleDateString('tr-TR');
            let primaryColor = '#0ea5e9';
            
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            
            let rowsHtml = '';
            
            let runningBalance = 0;
            const chronTxs = [...personTxs].reverse();
            
            chronTxs.forEach(tx => {
                let operation = '';
                let balanceChange = 0;
                
                if (tx.type === 'BUY') {
                    balanceChange = -tx.totalAmount;
                    operation = `ALIM (${tx.product.substring(0, 8)})`;
                } else if (tx.type === 'SELL') {
                    balanceChange = tx.totalAmount;
                    operation = `SATIŞ (${tx.product.substring(0, 8)})`;
                } else if (tx.type === 'PAYMENT_OUT') {
                    balanceChange = tx.totalAmount;
                    operation = 'ÖDEME YAPILDI';
                } else if (tx.type === 'PAYMENT_IN') {
                    balanceChange = -tx.totalAmount;
                    operation = 'TAHSİLAT ALINDI';
                }
                runningBalance += balanceChange;
                
                rowsHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px; color: #334155;">${new Date(tx.date).toLocaleDateString('tr-TR')}</td>
                        <td style="padding: 12px; font-weight: 600; color: #0f172a;">${operation}</td>
                        <td style="padding: 12px; text-align: right; color: #334155;">${tx.quantity ? tx.quantity.toLocaleString('tr-TR') + ' KG' : '-'}</td>
                        <td style="padding: 12px; text-align: right; color: #e11d48;">${balanceChange < 0 ? formatCurrency(Math.abs(balanceChange), 'TRY') : '-'}</td>
                        <td style="padding: 12px; text-align: right; color: #10b981;">${balanceChange > 0 ? formatCurrency(Math.abs(balanceChange), 'TRY') : '-'}</td>
                        <td style="padding: 12px; text-align: right; font-weight: 700; color: ${runningBalance >= 0 ? '#10b981' : '#e11d48'};">${formatCurrency(Math.abs(runningBalance), 'TRY')} ${runningBalance > 0 ? '(A)' : runningBalance < 0 ? '(B)' : ''}</td>
                    </tr>
                `;
            });

            container.innerHTML = `
                <div style="width: 900px; padding: 60px; background: white; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <div style="height: 12px; background-color: ${primaryColor}; position: absolute; top: 0; left: 0; right: 0;"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; margin-top: 20px;">
                        <div>
                            <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">CARİ HESAP EKSTRESİ</h1>
                            <p style="margin: 8px 0 0; font-size: 14px; font-weight: 500; color: #64748b;">${userProfile?.companyName || 'Silo Yönetimi'}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 6px 0 0; font-size: 14px; color: #475569; font-weight: 600;">Oluşturulma: ${dateStr}</p>
                        </div>
                    </div>

                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; display: flex; justify-content: space-between; margin-bottom: 30px;">
                        <div>
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">CARİ / MÜŞTERİ:</p>
                            <p style="margin: 8px 0 0; font-size: 20px; font-weight: 800; color: #0f172a;">${personName.toUpperCase()}</p>
                            ${statInfo?.phone ? `<p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Telefon: ${statInfo.phone}</p>` : ''}
                            ${statInfo?.address ? `<p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Adres: ${statInfo.address}</p>` : ''}
                        </div>
                        <div style="text-align: right; border-left: 2px dashed #cbd5e1; padding-left: 24px;">
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">GÜNCEL BAKİYE:</p>
                            <p style="margin: 8px 0 0; font-size: 24px; font-weight: 900; color: ${balance > 0 ? '#10b981' : balance < 0 ? '#e11d48' : '#0f172a'};">
                                ${formatCurrency(Math.abs(balance), 'TRY')}
                            </p>
                            <p style="margin: 4px 0 0; font-size: 13px; font-weight: 700; color: ${balance > 0 ? '#10b981' : balance < 0 ? '#e11d48' : '#64748b'};">${balance > 0 ? 'ALACAKLIYIZ' : balance < 0 ? 'BORÇLUYUZ' : 'NÖTR'}</p>
                        </div>
                    </div>

                    <div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                                    <th style="padding: 12px; text-align: left; color: #475569;">Tarih</th>
                                    <th style="padding: 12px; text-align: left; color: #475569;">İşlem</th>
                                    <th style="padding: 12px; text-align: right; color: #475569;">Miktar</th>
                                    <th style="padding: 12px; text-align: right; color: #475569;">Borç</th>
                                    <th style="padding: 12px; text-align: right; color: #475569;">Alacak</th>
                                    <th style="padding: 12px; text-align: right; color: #475569;">Bakiye</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500;">
                        Bu belge MKS Tarım Bilgi Sistemi tarafından dijital olarak üretilmiştir.
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            
            const elementToCapture = container.firstElementChild as HTMLElement;
            const canvas = await html2canvas(elementToCapture, {
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });
            
            document.body.removeChild(container);
            
            const pdf = createMultiPagePdf(canvas);
            
            const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
            const safeName = personName
                .replace(/[ĞğÜüŞşİıÖöÇç]/g, match => charMap[match])
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');

            pdf.save(`Cari_Ekstre_${safeName}.pdf`);
        } catch (error) {
            console.error('PDF error:', error);
            alert('PDF oluşturulurken bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadDocument = async (url: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            let ext = url.split('?')[0].split('.').pop();
            a.download = `Silo_Belge_MKS_${Date.now()}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            // Fallback
            window.open(url, '_blank');
        }
    };

    const productStats = useMemo(() => {
        const stats: Record<string, { inKg: number, outKg: number, buyCost: number, sellRev: number, profit: number }> = {};
        PRODUCTS.forEach(p => stats[p] = { inKg: 0, outKg: 0, buyCost: 0, sellRev: 0, profit: 0 });
        
        transactions.forEach(t => {
            if (!stats[t.product]) return; // Fallback for old/deleted product names just in case
            
            if (t.type === 'BUY') {
                stats[t.product].inKg += t.quantity || 0;
                let actualCost = t.totalAmount;
                if (t.transportCost && t.transportPayer === 'THEM') {
                    actualCost += t.transportCost;
                }
                stats[t.product].buyCost += actualCost;
            } else if (t.type === 'SELL') {
                stats[t.product].outKg += t.quantity || 0;
                let actualRev = t.totalAmount;
                if (t.transportCost && t.transportPayer === 'THEM') {
                    actualRev -= t.transportCost;
                }
                stats[t.product].sellRev += actualRev;
            }
        });
        
        PRODUCTS.forEach(p => {
             const s = stats[p];
             // Average cost per kg for the items sold
             const avgBuyCost = s.inKg > 0 ? (s.buyCost / s.inKg) : 0;
             const costOfSoldItems = s.outKg * avgBuyCost;
             s.profit = s.sellRev - costOfSoldItems;
        });
        
        return stats;
    }, [transactions]);
    
    const contactStats = useMemo(() => {
        const stats: Record<string, { type: 'BUYER'|'SELLER'|'BOTH', sellerAmount: number, sellerKg: number, buyerAmount: number, buyerKg: number, balance: number, phone?: string, address?: string }> = {};
        
        siloContacts.forEach(c => {
            if (!stats[c.name]) {
                stats[c.name] = { type: c.type, sellerAmount: 0, sellerKg: 0, buyerAmount: 0, buyerKg: 0, balance: 0, phone: c.phone, address: c.address };
            }
        });

        transactions.forEach(t => {
            // Determine type logic
            let personType: 'BUYER' | 'SELLER' | 'BOTH' = 'BUYER';
            if (t.type === 'BUY' || t.type === 'PAYMENT_OUT') personType = 'SELLER';
            
            if (!stats[t.person]) {
                stats[t.person] = { type: personType, sellerAmount: 0, sellerKg: 0, buyerAmount: 0, buyerKg: 0, balance: 0 };
            } else {
                if (stats[t.person].type !== personType && (stats[t.person].sellerAmount > 0 || stats[t.person].buyerAmount > 0)) {
                    stats[t.person].type = 'BOTH';
                }
            }
            
            if (t.type === 'BUY') {
                stats[t.person].sellerKg += t.quantity || 0;
                stats[t.person].sellerAmount += t.totalAmount;
                stats[t.person].balance -= t.totalAmount;
            } else if (t.type === 'SELL') {
                 stats[t.person].buyerKg += t.quantity || 0;
                 stats[t.person].buyerAmount += t.totalAmount;
                 stats[t.person].balance += t.totalAmount;
            } else if (t.type === 'PAYMENT_OUT') {
                 stats[t.person].balance += t.totalAmount;
            } else if (t.type === 'PAYMENT_IN') {
                 stats[t.person].balance -= t.totalAmount;
            }
        });
        
        return stats;
    }, [transactions, siloContacts]);
    
    const suggestions = Object.keys(contactStats);
    
    const filteredContactNames = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return Object.keys(contactStats);
        return Object.keys(contactStats).filter(name => name.toLowerCase().includes(query));
    }, [contactStats, searchQuery]);

    // UI Filtering logic
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            let matchSearch = true;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                matchSearch = Boolean(
                    (tx.person && tx.person.toLowerCase().includes(q)) || 
                    (tx.product && tx.product.toLowerCase().includes(q)) || 
                    (tx.plateNumber && tx.plateNumber.toLowerCase().includes(q))
                );
            }
            let matchDate = true;
            if (dateFilter !== 'ALL') {
                const txDate = new Date(tx.date);
                const now = new Date();
                if (dateFilter === 'THIS_MONTH') {
                    matchDate = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
                } else if (dateFilter === 'LAST_MONTH') {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    matchDate = txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
                } else if (dateFilter === 'THIS_SEASON') {
                    const currentMonth = now.getMonth();
                    const startYear = currentMonth < 8 ? now.getFullYear() - 1 : now.getFullYear();
                    const startSeason = new Date(startYear, 8, 1); // Sept 1st of season start year
                    matchDate = txDate >= startSeason;
                } else if (dateFilter === 'CUSTOM' && customStartDate && customEndDate) {
                    matchDate = txDate >= new Date(customStartDate) && txDate <= new Date(customEndDate);
                }
            }
            return matchSearch && matchDate;
        });
    }, [transactions, searchQuery, dateFilter, customStartDate, customEndDate]);

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 mb-4 mt-2 px-2">
                <div className="flex items-center space-x-3">
                     <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-800 transition-colors text-stone-400">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-stone-100 tracking-tight">SİLOM</h1>
                    </div>
                </div>
                {isAdmin && (
                    <div className="grid grid-cols-4 gap-2">
                        <button onClick={generateReportPDF} className="w-full py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-[10px] sm:text-xs font-bold hover:bg-purple-500/20 transition-all flex items-center justify-center">
                            <FileText size={14} className="mr-1.5 hidden sm:block" />
                            <span className="truncate">Rapor</span>
                        </button>
                        <button onClick={() => setIsContactModalOpen(true)} className="w-full py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] sm:text-xs font-bold hover:bg-blue-500/20 transition-all flex items-center justify-center">
                            <User size={14} className="mr-1.5 hidden sm:block" />
                            <span className="truncate">Kişi Ekle</span>
                        </button>
                        <button onClick={() => openNewModal('BUY')} className="w-full py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] sm:text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center">
                            <TrendingDown size={14} className="mr-1.5 hidden sm:block" />
                            <span className="truncate">Alım</span>
                        </button>
                        <button onClick={() => openNewModal('SELL')} className="w-full py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] sm:text-xs font-bold hover:bg-amber-500/20 transition-all flex items-center justify-center">
                            <TrendingUp size={14} className="mr-1.5 hidden sm:block" />
                            <span className="truncate">Satış</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="flex overflow-x-auto no-scrollbar gap-2 px-2 border-b border-white/5 pb-2">
                {[
                    { id: 'OVERVIEW', label: 'Genel Durum' },
                    { id: 'BUYS', label: 'Alışlar' },
                    { id: 'SELLS', label: 'Satışlar' },
                    { id: 'SELLERS', label: 'Çiftçi' },
                    { id: 'BUYERS', label: 'Arsa' },
                    { id: 'STOCKS', label: 'Stok Durumu' },
                    { id: 'FINANCE', label: 'Finansal Durum' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-stone-800 text-white' : 'text-stone-500 hover:bg-stone-900'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'OVERVIEW' && (() => {
                const upcomingPayments = transactions.filter(t => t.type === 'BUY' && t.paymentType === 'TERM' && t.dueDate && new Date(t.dueDate).getTime() >= new Date().getTime() - 86400000).sort((a,b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
                
                return (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-2">
                             {PRODUCTS.filter(p => productStats[p].inKg > 0 || productStats[p].outKg > 0).map(p => {
                                 const stat = productStats[p];
                                 const currentStock = stat.inKg - stat.outKg;
                                 
                                 return (
                                     <div key={p} 
                                          onClick={() => setSelectedProductDetails(p)}
                                          className="bg-stone-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col justify-between cursor-pointer hover:bg-stone-900/80 hover:border-white/10 hover:scale-[1.02] transition-all group">
                                         <div className="flex justify-between items-start mb-3">
                                             <h2 className="text-sm font-bold text-stone-200 group-hover:text-white transition-colors">{p}</h2>
                                             <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-stone-400 border border-white/5">
                                                 <Package size={14} />
                                             </div>
                                         </div>
                                         
                                         <div className="space-y-2 mt-auto">
                                             <div>
                                                 <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Mevcut Stok</p>
                                                 <p className="text-lg font-black font-mono text-white">{currentStock.toLocaleString('tr-TR')} kg</p>
                                             </div>
                                             <div className={`pt-2 border-t border-white/5 flex flex-col`}>
                                                 <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Öngörülen Kar Zarar</p>
                                                 <p className={`text-sm font-black font-mono ${stat.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                     {stat.profit >= 0 ? '+' : ''}{formatCurrency(stat.profit, userProfile?.currency || 'TRY')}
                                                 </p>
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })}
                             
                             {PRODUCTS.filter(p => productStats[p].inKg > 0 || productStats[p].outKg > 0).length === 0 && !isLoading && (
                                 <div className="col-span-2 md:col-span-4 bg-stone-900 border border-white/5 rounded-2xl p-6 text-center">
                                     <Info size={24} className="mx-auto text-stone-500 mb-3" />
                                     <p className="text-sm text-stone-400">Henüz hiçbir ürün için alım satım işleminiz yok.</p>
                                 </div>
                             )}
                        </div>

                        {upcomingPayments.length > 0 && (
                            <div className="px-2 mt-6">
                                <h2 className="text-xs font-black text-rose-400 uppercase tracking-widest mb-3 pl-1 flex items-center"><Calendar size={12} className="mr-1.5" /> Yaklaşan Ödemeler</h2>
                                <div className="space-y-2">
                                    {upcomingPayments.slice(0, 3).map(tx => (
                                        <div key={tx.id} className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-3 flex justify-between items-center cursor-pointer hover:bg-rose-500/10 transition-colors" onClick={() => setSelectedPersonDetails(tx.person)}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                                                    <Wallet size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-stone-200">{tx.person}</p>
                                                    <p className="text-[10px] text-stone-400">Son Tarih: <span className="font-bold text-rose-400">{new Date(tx.dueDate!).toLocaleDateString('tr-TR')}</span></p>
                                                </div>
                                            </div>
                                            <p className="text-sm font-black font-mono text-rose-400">{formatCurrency(tx.totalAmount, userProfile?.currency || 'TRY')}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                );
            })()}

            {/* TRANSACTIONS LIST (BUYS OR SELLS OR OVERVIEW RECENT) */}
            {(activeTab === 'OVERVIEW' || activeTab === 'BUYS' || activeTab === 'SELLS') && (
                <div className="px-2 mt-4">
                    <h2 className="text-xs font-black text-stone-500 uppercase tracking-widest mb-4 pl-1">
                        {activeTab === 'OVERVIEW' ? 'Son İşlemler' : (activeTab === 'BUYS' ? 'Tüm Alışlar' : 'Tüm Satışlar')}
                    </h2>

                    <div className="flex gap-2 mb-4 px-1 items-center">
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Kişi, plaka veya ürüne göre ara..." 
                                className="w-full bg-stone-900 border border-white/5 rounded-xl px-8 py-2 md:py-2.5 text-xs text-white focus:border-stone-500 outline-none transition-colors"
                            />
                            <Search className="absolute left-3 top-2.5 text-stone-500" size={14} />
                        </div>
                        <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className="bg-stone-900 border border-white/5 rounded-xl px-3 py-2 md:py-2.5 text-xs text-stone-300 focus:border-stone-500 outline-none transition-colors appearance-none shrink-0 cursor-pointer">
                            <option value="ALL">Tüm Zamanlar</option>
                            <option value="THIS_MONTH">Bu Ay</option>
                            <option value="LAST_MONTH">Geçen Ay</option>
                            <option value="THIS_SEASON">Bu Sezon</option>
                            <option value="CUSTOM">Özel Aralık</option>
                        </select>
                    </div>
                    {dateFilter === 'CUSTOM' && (
                        <div className="flex gap-2 mb-4 px-1">
                            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-stone-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white [color-scheme:dark]" />
                            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-stone-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white [color-scheme:dark]" />
                        </div>
                    )}
                    
                    {isLoading ? (
                        <div className="text-center py-10 opacity-50"><p className="text-sm">Yükleniyor...</p></div>
                    ) : filteredTransactions.filter(tx => activeTab === 'OVERVIEW' || (activeTab === 'BUYS' && tx.type === 'BUY') || (activeTab === 'SELLS' && tx.type === 'SELL')).length === 0 ? (
                        <div className="text-center py-10 opacity-50"><p className="text-sm">Kayıt bulunamadı.</p></div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTransactions
                                .filter(tx => activeTab === 'OVERVIEW' || (activeTab === 'BUYS' && tx.type === 'BUY') || (activeTab === 'SELLS' && tx.type === 'SELL'))
                                .slice(0, activeTab === 'OVERVIEW' ? 15 : undefined)
                                .map(tx => (
                                <div key={tx.id} className="bg-stone-900/50 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            tx.type === 'BUY' || tx.type === 'PAYMENT_OUT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        }`}>
                                            {tx.type === 'BUY' ? <TrendingDown size={18} /> : 
                                             tx.type === 'SELL' ? <TrendingUp size={18} /> : 
                                             tx.type === 'PAYMENT_OUT' ? <Wallet size={18} /> :
                                             <Wallet size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-bold text-stone-100 truncate">
                                                    {tx.type === 'PAYMENT_IN' || tx.type === 'PAYMENT_OUT' ? 'Ödeme' : tx.product} 
                                                    <span className="text-[10px] text-stone-500 font-medium ml-1">
                                                        ({tx.type === 'BUY' ? 'Alım' : tx.type === 'SELL' ? 'Satış' : tx.type === 'PAYMENT_IN' ? 'Tahsilat' : 'Ödeme Yapıldı'})
                                                    </span>
                                                </p>
                                                <span className="text-[10px] text-stone-500 font-medium sm:hidden">{new Date(tx.date).toLocaleDateString('tr-TR')}</span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                                                    {tx.type === 'BUY' || tx.type === 'PAYMENT_IN' ? 'Kimden:' : 'Kime:'}
                                                </span>
                                                <span className="text-xs font-bold text-stone-200 bg-stone-800/80 px-2 py-0.5 rounded-md truncate border border-white/5">
                                                    {tx.person}
                                                </span>
                                            </div>
                                            {tx.plateNumber && (
                                                <p className="text-[10px] text-stone-500 font-mono mt-0.5 uppercase">PLAKA: {tx.plateNumber}{tx.driverPhone ? ` | TEL: ${tx.driverPhone}` : ''}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end w-full sm:flex-1 gap-4">
                                        <div className="flex gap-4">
                                            <div className="text-left sm:text-right hidden sm:block">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Tarih</p>
                                                <p className="text-xs font-bold text-stone-400 mt-0.5">{new Date(tx.date).toLocaleDateString('tr-TR')}</p>
                                            </div>
                                            <div className="text-left sm:text-right">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Miktar</p>
                                                <p className="text-sm font-black font-mono text-stone-300">{tx.quantity.toLocaleString('tr-TR')} kg</p>
                                            </div>
                                            <div className="text-right hidden sm:block">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">B. Fiyatı</p>
                                                <p className="text-sm font-black font-mono text-stone-400">{formatCurrency(tx.unitPrice, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                            {tx.commissionAmount ? (
                                                <div className="text-right hidden md:block">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Komisyon</p>
                                                    <p className="text-sm font-black font-mono text-rose-400">-{formatCurrency(tx.commissionAmount, userProfile?.currency || 'TRY')}</p>
                                                </div>
                                            ) : null}
                                            {tx.transportCost ? (
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Nakliye</p>
                                                    <p className={`text-sm font-black font-mono ${(tx.transportPayer === 'US' && tx.type === 'SELL') || (tx.transportPayer === 'THEM' && tx.type === 'BUY') ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                        {(tx.transportPayer === 'US' && tx.type === 'SELL') || (tx.transportPayer === 'THEM' && tx.type === 'BUY') ? '-' : '+'}{formatCurrency(tx.transportCost, userProfile?.currency || 'TRY')}
                                                    </p>
                                                </div>
                                            ) : null}
                                            <div className="text-right">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Toplam</p>
                                                <p className={`text-base font-black font-mono ${tx.type === 'BUY' || tx.type === 'PAYMENT_OUT' ? 'text-stone-300' : 'text-amber-400'}`}>
                                                    {formatCurrency(tx.totalAmount, userProfile?.currency || 'TRY')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 sm:ml-4">
                                            {tx.documentUrl && (
                                                <button onClick={() => handleDownloadDocument(tx.documentUrl!)} className="p-1.5 text-stone-500 hover:text-emerald-400 bg-stone-800 hover:bg-emerald-500/10 transition-colors rounded-lg flex items-center justify-center">
                                                    <Download size={14} />
                                                </button>
                                            )}
                                            <button onClick={() => generatePDF(tx)} className="p-1.5 text-blue-500/80 hover:text-blue-400 hover:bg-blue-500/10 bg-stone-800 rounded-lg"><FileText size={14} /></button>
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => openEditModal(tx)} className="p-1.5 text-stone-500 hover:text-stone-300 bg-stone-800 rounded-lg"><Edit2 size={14} /></button>
                                                    <button onClick={() => handleDelete(tx.id)} className="p-1.5 text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 bg-stone-800 rounded-lg"><Trash2 size={14} /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* BUYERS & SELLERS LIST */}
            {(activeTab === 'BUYERS' || activeTab === 'SELLERS') && (
                <div className="px-2 mt-4 space-y-3">
                    <div className="relative mb-4 px-1">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Kişi adına göre ara..." 
                            className="w-full bg-stone-900 border border-white/5 rounded-xl px-8 py-2 md:py-2.5 text-xs text-white focus:border-stone-500 outline-none transition-colors"
                        />
                        <Search className="absolute left-3 top-2.5 text-stone-500" size={14} />
                    </div>
                
                    {filteredContactNames.filter(name => {
                        const stat = contactStats[name];
                        return activeTab === 'BUYERS' ? (stat.type === 'BUYER' || stat.type === 'BOTH')
                                                      : (stat.type === 'SELLER' || stat.type === 'BOTH');
                    }).length === 0 ? (
                        <div className="text-center py-10 opacity-50"><p className="text-sm">Kayıt bulunamadı.</p></div>
                    ) : (
                        filteredContactNames.filter(name => {
                            const stat = contactStats[name];
                            return activeTab === 'BUYERS' ? (stat.type === 'BUYER' || stat.type === 'BOTH')
                                                          : (stat.type === 'SELLER' || stat.type === 'BOTH');
                        }).map(name => {
                            const stat = contactStats[name];
                            return (
                                <div key={name} 
                                     onClick={() => setSelectedPersonDetails(name)}
                                     className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-stone-900/80 hover:border-white/10 hover:scale-[1.02] transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-stone-800 flex flex-col items-center justify-center text-stone-400 border border-white/5">
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-stone-100 group-hover:text-white transition-colors">{name}</p>
                                            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{activeTab === 'BUYERS' ? 'Arsa' : 'Çiftçi'}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-4 text-right">
                                        <div className="hidden sm:block">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Toplam Miktar</p>
                                            <p className="text-sm font-black font-mono text-stone-300">{(activeTab === 'BUYERS' ? stat.buyerKg : stat.sellerKg).toLocaleString('tr-TR')} kg</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Mevcut Bakiye</p>
                                            <p className={`text-base font-black font-mono ${stat.balance > 0 ? 'text-emerald-400' : stat.balance < 0 ? 'text-rose-400' : 'text-stone-400'}`}>
                                                {formatCurrency(Math.abs(stat.balance), userProfile?.currency || 'TRY')}
                                                <span className="text-[9px] ml-1 opacity-70">{stat.balance > 0 ? '(Alacaklıyız)' : stat.balance < 0 ? '(Borçluyuz)' : ''}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* STOCKS */}
            {activeTab === 'STOCKS' && (
                <div className="px-2 mt-4 space-y-3 pb-8">
                    {PRODUCTS.filter(p => productStats[p].inKg > 0 || productStats[p].outKg > 0).length === 0 ? (
                        <div className="text-center py-10 opacity-50"><p className="text-sm">Stokta ürün bulunmuyor.</p></div>
                    ) : (
                        PRODUCTS.filter(p => productStats[p].inKg > 0 || productStats[p].outKg > 0).map(p => {
                            const stat = productStats[p];
                            const currentStock = Math.max(0, stat.inKg - stat.outKg);
                            const avgBuyPrice = stat.inKg > 0 ? (stat.buyCost / stat.inKg) : 0;
                            const estimatedStockValue = currentStock * avgBuyPrice;
                            
                            return (
                                <div key={p} 
                                     onClick={() => setSelectedProductDetails(p)}
                                     className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-stone-900/80 hover:border-white/10 hover:scale-[1.01] transition-all">
                                     <div className="flex items-center gap-3">
                                         <div className="w-12 h-12 rounded-xl bg-stone-800 flex items-center justify-center text-stone-400 border border-white/5 shrink-0">
                                             <Package size={20} />
                                         </div>
                                         <div>
                                             <p className="text-sm font-bold text-stone-100">{p}</p>
                                             <span className="text-xs text-emerald-400 font-mono font-bold tracking-tight">Stok: {currentStock.toLocaleString('tr-TR')} kg</span>
                                         </div>
                                     </div>
                                     
                                     <div className="grid grid-cols-2 sm:flex sm:gap-6 gap-y-3 w-full sm:w-auto shrink-0 whitespace-nowrap">
                                         <div className="text-left sm:text-right">
                                             <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Ort. Alış</p>
                                             <p className="text-sm font-black font-mono text-stone-400">{formatCurrency(avgBuyPrice, userProfile?.currency || 'TRY')}</p>
                                         </div>
                                         <div className="text-left sm:text-right">
                                             <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Stok Maliyeti</p>
                                             <p className="text-sm font-black font-mono text-stone-400">{formatCurrency(estimatedStockValue, userProfile?.currency || 'TRY')}</p>
                                         </div>
                                         <div className="text-left sm:text-right">
                                             <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Satılan</p>
                                             <p className="text-sm font-black font-mono text-stone-400">{stat.outKg.toLocaleString('tr-TR')} kg</p>
                                         </div>
                                         <div className="text-left sm:text-right">
                                             <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Gerçekleşen Kar</p>
                                             <p className={`text-sm font-black font-mono ${stat.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                 {stat.profit >= 0 ? '+' : ''}{formatCurrency(stat.profit, userProfile?.currency || 'TRY')}
                                             </p>
                                         </div>
                                     </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* FINANCE */}
            {activeTab === 'FINANCE' && (() => {
                const totalIn = Object.values(productStats).reduce((sum, s) => sum + s.buyCost, 0);
                const totalOut = Object.values(productStats).reduce((sum, s) => sum + s.sellRev, 0);
                
                const totalTransport = transactions.filter(t => t.transportPayer === 'US').reduce((sum, t) => sum + (t.transportCost || 0), 0);
                const totalCommission = transactions.reduce((sum, t) => sum + (t.commissionAmount || 0), 0);
                
                const totalProfit = Object.values(productStats).reduce((sum, s) => sum + s.profit, 0);
                
                let currentStockValue = 0;
                Object.values(productStats).forEach(s => {
                    const currentStock = Math.max(0, s.inKg - s.outKg);
                    const avgBuyPrice = s.inKg > 0 ? (s.buyCost / s.inKg) : 0;
                    currentStockValue += (currentStock * avgBuyPrice);
                });
                
                return (
                    <div className="px-2 mt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-stone-900 border border-white/5 rounded-2xl p-4">
                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-1">Toplam Alış Maliyeti</p>
                                <p className="text-xl font-black font-mono text-rose-400">{formatCurrency(totalIn, userProfile?.currency || 'TRY')}</p>
                            </div>
                            <div className="bg-stone-900 border border-white/5 rounded-2xl p-4">
                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-1">Toplam Satış Geliri</p>
                                <p className="text-xl font-black font-mono text-emerald-400">{formatCurrency(totalOut, userProfile?.currency || 'TRY')}</p>
                            </div>
                            <div className="bg-stone-900 border border-white/5 rounded-2xl p-4">
                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-1">Mevcut Stok Maliyeti</p>
                                <p className="text-xl font-black font-mono text-stone-300">{formatCurrency(currentStockValue, userProfile?.currency || 'TRY')}</p>
                            </div>
                            <div className="bg-stone-900 border border-white/5 rounded-2xl p-4">
                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-1">Ödenen Nakliye</p>
                                <p className="text-xl font-black font-mono text-amber-500">{formatCurrency(totalTransport, userProfile?.currency || 'TRY')}</p>
                            </div>
                            <div className="bg-stone-900 border border-white/5 rounded-2xl p-4">
                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-1">Kesilen Komisyon</p>
                                <p className="text-xl font-black font-mono text-indigo-400">{formatCurrency(totalCommission, userProfile?.currency || 'TRY')}</p>
                            </div>
                            <div className={`bg-stone-900 border ${totalProfit >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'} rounded-2xl p-4`}>
                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-1">Gerçekleşen NET Kar/Zarar</p>
                                <p className={`text-xl font-black font-mono ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit, userProfile?.currency || 'TRY')}
                                </p>
                            </div>
                        </div>
                        
                        <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-5 mb-4">
                             <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Finansal Özet</h3>
                             <p className="text-sm text-stone-400 leading-relaxed">
                                 Şu ana kadar siloya giren ürünler için toplam <strong className="text-rose-400 font-mono">{formatCurrency(totalIn, userProfile?.currency || 'TRY')}</strong> ödeme yapılmış (veya borçlanılmış), 
                                 satılan ürünlerden ise <strong className="text-emerald-400 font-mono">{formatCurrency(totalOut, userProfile?.currency || 'TRY')}</strong> gelir elde edilmiştir. 
                                 <br /><br />
                                 Şu anda elinizdeki stoğun maliyet değeri <strong className="text-stone-300 font-mono">{formatCurrency(currentStockValue, userProfile?.currency || 'TRY')}</strong>'dir. 
                                 <br /><br />
                                 Satış ve alımlardan doğan toplam nakliye gideri <strong className="text-amber-500 font-mono">{formatCurrency(totalTransport, userProfile?.currency || 'TRY')}</strong> ve aracılara ödenen toplam komisyon <strong className="text-indigo-400 font-mono">{formatCurrency(totalCommission, userProfile?.currency || 'TRY')}</strong> olarak hesaplanmıştır.
                                 <br /><br />
                                 Tüm maliyetler, nakliye ve komisyon giderleri düşüldükten sonra elde ettiğiniz NET kar/zarar durumu ise <strong className={`${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-mono`}>{totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit, userProfile?.currency || 'TRY')}</strong> olarak hesaplanmıştır.
                             </p>
                        </div>

                        <h3 className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 pl-1">Ürün Bazlı Finansal Durum</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
                            {PRODUCTS.filter(p => productStats[p].inKg > 0 || productStats[p].outKg > 0).map(p => {
                                const stat = productStats[p];
                                const currentStock = Math.max(0, stat.inKg - stat.outKg);
                                const avgBuyPrice = stat.inKg > 0 ? (stat.buyCost / stat.inKg) : 0;
                                const estimatedStockValue = currentStock * avgBuyPrice;
                                
                                return (
                                    <div key={p} className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center text-stone-400 border border-white/5">
                                                <Package size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-stone-100">{p}</p>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${stat.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    Kar: {formatCurrency(stat.profit, userProfile?.currency || 'TRY')}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3 bg-stone-950/50 p-3 rounded-xl border border-white/5">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Toplam Alış Maliyeti</p>
                                                <p className="text-sm font-black font-mono text-rose-400">{formatCurrency(stat.buyCost, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Toplam Satış Geliri</p>
                                                <p className="text-sm font-black font-mono text-emerald-400">{formatCurrency(stat.sellRev, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Stok Maliyeti</p>
                                                <p className="text-sm font-black font-mono text-stone-300">{formatCurrency(estimatedStockValue, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5">Ort. Alış Fiyatı</p>
                                                <p className="text-sm font-black font-mono text-stone-400">{formatCurrency(avgBuyPrice, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-stone-900 border border-white/5 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-950">
                            <h2 className="text-lg font-bold text-stone-100">{editingTx ? 'İşlemi Düzenle' : (type === 'BUY' ? 'Yeni Alım Kaydı' : 'Yeni Satış Kaydı')}</h2>
                            <button onClick={closeModal} className="text-stone-500 hover:text-stone-300 transition-colors p-1"><Trash2 size={20} className="opacity-0 hidden" /> <X size={20} /></button>
                        </div>
                        
                        <div className="p-5 overflow-y-auto space-y-4">
                             <div>
                                 <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">İşlem Türü</label>
                                 <div className="grid grid-cols-2 gap-2 mb-2">
                                     <button type="button" onClick={() => setType('BUY')} className={`p-3 rounded-xl border font-bold text-sm transition-all ${type === 'BUY' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-stone-950 border-stone-800 text-stone-500 hover:bg-stone-900'}`}>ALIM</button>
                                     <button type="button" onClick={() => setType('SELL')} className={`p-3 rounded-xl border font-bold text-sm transition-all ${type === 'SELL' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-stone-950 border-stone-800 text-stone-500 hover:bg-stone-900'}`}>SATIŞ</button>
                                 </div>
                                 <div className="grid grid-cols-2 gap-2">
                                     <button type="button" onClick={() => setType('PAYMENT_OUT')} className={`p-3 rounded-xl border font-bold text-xs transition-all ${type === 'PAYMENT_OUT' ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-stone-950 border-stone-800 text-stone-500 hover:bg-stone-900'}`}><Wallet size={14} className="inline mr-1 mb-0.5" /> ÖDEME YAP</button>
                                     <button type="button" onClick={() => setType('PAYMENT_IN')} className={`p-3 rounded-xl border font-bold text-xs transition-all ${type === 'PAYMENT_IN' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-stone-950 border-stone-800 text-stone-500 hover:bg-stone-900'}`}><Wallet size={14} className="inline mr-1 mb-0.5" /> ÖDEME AL (TAHSİLAT) </button>
                                 </div>
                             </div>

                             {type !== 'PAYMENT_IN' && type !== 'PAYMENT_OUT' && (
                                 <div>
                                     <div className="flex justify-between items-center mb-1.5">
                                         <label className="text-xs font-black text-stone-500 uppercase tracking-widest block">Ürün</label>
                                         <span className={`text-[10px] font-bold ${((productStats[product]?.inKg || 0) - (productStats[product]?.outKg || 0)) > 0 ? 'text-emerald-400' : 'text-stone-500'}`}>
                                             Stok: {((productStats[product]?.inKg || 0) - (productStats[product]?.outKg || 0)).toLocaleString('tr-TR')} kg
                                         </span>
                                     </div>
                                     <select value={product} onChange={e => setProduct(e.target.value)} className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white font-bold appearance-none outline-none focus:border-emerald-500 transition-colors">
                                         {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                                     </select>
                                 </div>
                             )}

                             <div>
                                 <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">
                                    {type === 'BUY' ? 'Çiftçi (Kimden Alındı?)' : type === 'SELL' ? 'Arsa (Kime Satıldı?)' : type === 'PAYMENT_IN' ? 'Kişi/Firma (Kimden Alındı?)' : 'Kişi/Firma (Kime Ödendi?)'}
                                 </label>
                                 <div className="relative">
                                     <input 
                                         type="text" 
                                         value={person} 
                                         onChange={e => { setPerson(e.target.value); setShowSuggestions(true); }}
                                         onFocus={() => setShowSuggestions(true)}
                                         onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                         placeholder="Yeni yazın veya seçin..." 
                                         className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500 outline-none transition-colors relative z-20" 
                                     />
                                     {showSuggestions && suggestions.filter(s => s.toLowerCase().includes(person.toLowerCase())).length > 0 && (
                                         <div className="absolute z-30 w-full mt-2 bg-stone-800 border border-white/10 rounded-xl max-h-40 overflow-y-auto shadow-2xl">
                                             {suggestions.filter(s => s.toLowerCase().includes(person.toLowerCase())).map(s => (
                                                 <div 
                                                     key={s} 
                                                     className="px-4 py-3 hover:bg-stone-700 cursor-pointer text-stone-200 text-sm font-bold flex items-center"
                                                     onMouseDown={() => { setPerson(s); setShowSuggestions(false); }}
                                                 >
                                                     <User size={14} className="mr-2 text-stone-400" />
                                                     {s}
                                                 </div>
                                             ))}
                                         </div>
                                     )}
                                 </div>
                             </div>

                             {type !== 'PAYMENT_IN' && type !== 'PAYMENT_OUT' ? (
                                 <div className="grid grid-cols-2 gap-3">
                                     <div>
                                         <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Miktar (KG)</label>
                                         <input type="text" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white font-mono focus:border-emerald-500 outline-none transition-colors" />
                                     </div>
                                     <div>
                                         <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Birim Fiyatı (₺)</label>
                                         <input type="text" inputMode="decimal" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white font-mono focus:border-emerald-500 outline-none transition-colors" />
                                     </div>
                                 </div>
                             ) : (
                                 <div>
                                     <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Tutar (₺)</label>
                                     <input type="text" inputMode="decimal" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white font-mono focus:border-emerald-500 outline-none transition-colors" />
                                 </div>
                             )}

                             <div className="grid grid-cols-2 gap-3">
                                 <div>
                                     <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Tarih</label>
                                     <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500 outline-none transition-colors [color-scheme:dark]" />
                                 </div>

                                 {(type === 'BUY' || type === 'SELL') && (
                                     <div>
                                         <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Ödeme Türü</label>
                                         <select value={paymentMode} onChange={e => setPaymentMode(e.target.value as any)} className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white font-bold appearance-none outline-none focus:border-emerald-500 transition-colors">
                                             <option value="CASH">Peşin</option>
                                             <option value="TERM">Vadeli</option>
                                         </select>
                                     </div>
                                 )}
                             </div>
                             
                             {(type === 'BUY' || type === 'SELL') && (
                                 <>
                                     <div className="grid grid-cols-2 gap-3">
                                         <div>
                                             <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Araç Plakası</label>
                                             <input type="text" value={plateNumber} onChange={e => setPlateNumber(e.target.value.toUpperCase())} placeholder="Örn: 34 ABC 123" className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500 outline-none transition-colors uppercase" />
                                         </div>
                                         <div>
                                             <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Şoför Tel</label>
                                             <input type="tel" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="05..." className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500 outline-none transition-colors" />
                                         </div>
                                     </div>
                                     <div>
                                         <div className="flex items-center justify-between mb-1.5">
                                             <label className="text-xs font-black text-stone-500 uppercase tracking-widest block">Nakliye Maliyeti (₺)</label>
                                             <div className="flex gap-1.5">
                                                 <button type="button" onClick={() => setIsTransportIncluded(!isTransportIncluded)} className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded transition-colors ${isTransportIncluded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-stone-800 text-stone-400'}`}>
                                                     {isTransportIncluded ? 'Dahil' : 'Dahil Değil'}
                                                 </button>
                                                 {isTransportIncluded && (
                                                     <button type="button" onClick={() => setTransportPayer(p => p === 'US' ? 'THEM' : 'US')} className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded transition-colors ${transportPayer === 'US' ? 'bg-sky-500/20 text-sky-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                                         {transportPayer === 'US' ? 'Bizden' : 'Karşıdan'}
                                                     </button>
                                                 )}
                                             </div>
                                         </div>
                                         <input type="text" inputMode="decimal" value={transportCost} onChange={e => setTransportCost(e.target.value)} disabled={!isTransportIncluded} placeholder={isTransportIncluded ? "0.00" : "Dahil değil"} className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white font-mono focus:border-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
                                     </div>
                                 </>
                             )}

                             {type === 'SELL' && (
                                 <div>
                                     <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Komisyon (%)</label>
                                     <input type="text" inputMode="decimal" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} placeholder="1.0" className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3.5 text-white font-mono focus:border-emerald-500 outline-none transition-colors" />
                                 </div>
                             )}
                             
                             {(type === 'BUY' || type === 'SELL') && paymentMode === 'TERM' && (
                                 <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                     <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block text-rose-400">Son Ödeme Tarihi (Vade)</label>
                                     <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3.5 text-white outline-none transition-colors [color-scheme:dark]" />
                                 </div>
                             )}

                             <div>
                                 <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Belge / Kantar Fişi (İsteğe Bağlı)</label>
                                 <div className="flex gap-2">
                                     <input type="file" onChange={(e) => {
                                         if (e.target.files && e.target.files[0]) {
                                             setDocumentFile(e.target.files[0]);
                                         }
                                     }} className="hidden" id="document-upload" accept="image/*,.pdf" />
                                     <input type="file" capture="environment" onChange={(e) => {
                                         if (e.target.files && e.target.files[0]) {
                                             setDocumentFile(e.target.files[0]);
                                         }
                                     }} className="hidden" id="document-capture" accept="image/*" />
                                     
                                     <label htmlFor="document-upload" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-stone-950 border border-stone-800 hover:bg-stone-900 text-stone-300 rounded-xl cursor-pointer transition-colors text-xs sm:text-sm font-bold">
                                         <Paperclip size={16} className="text-stone-500" /> 
                                         Galeri / Dosya
                                     </label>
                                     <label htmlFor="document-capture" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-stone-950 border border-stone-800 hover:bg-stone-900 text-stone-300 rounded-xl cursor-pointer transition-colors text-xs sm:text-sm font-bold">
                                         <Camera size={16} className="text-stone-500" /> 
                                         Kamera
                                     </label>
                                 </div>
                                 {(documentFile || editingTx?.documentUrl) && (
                                     <div className="mt-2 text-xs text-stone-400 bg-stone-900 border border-white/5 p-2 rounded-lg flex items-center justify-between">
                                         <span className="truncate pr-2">{documentFile ? documentFile.name : 'Mevcut belge kayıtlı'}</span>
                                         <div className="flex items-center gap-2 shrink-0">
                                             {!documentFile && editingTx?.documentUrl && <a href={editingTx.documentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Görüntüle</a>}
                                             {documentFile && <button type="button" onClick={() => setDocumentFile(null)} className="p-1 text-stone-500 hover:text-rose-400 bg-stone-800 hover:bg-rose-500/10 rounded-md transition-colors"><XIcon size={14}/></button>}
                                         </div>
                                     </div>
                                 )}
                             </div>
                             
                             {type !== 'PAYMENT_IN' && type !== 'PAYMENT_OUT' && (
                                 <div className="pt-4 border-t border-white/5">
                                     <div className="flex justify-between items-center bg-stone-950 p-4 rounded-xl border border-stone-800">
                                         <span className="text-xs font-bold text-stone-400">Toplam Tutar</span>
                                         <span className="text-xl font-black text-white font-mono">
                                             {formatCurrency(((parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0)), userProfile?.currency || 'TRY')}
                                         </span>
                                     </div>
                                 </div>
                             )}
                        </div>

                        <div className="p-4 bg-stone-950 border-t border-white/5">
                             <button onClick={handleSave} disabled={!person || (!quantity && type !== 'PAYMENT_IN' && type !== 'PAYMENT_OUT') || !unitPrice} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-black rounded-xl transition-colors">
                                 KAYDET
                             </button>
                        </div>
                    </div>
                </div>
            )}
            {/* PERSON DETAILS MODAL */}
            {selectedPersonDetails && (() => {
                const personTxs = transactions.filter(t => t.person === selectedPersonDetails).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                let balance = 0; // Negative means we owe them, Positive means they owe us
                let totalBoughtKg = 0;
                let totalSoldKg = 0;
                
                personTxs.forEach(t => {
                    if (t.type === 'BUY') {
                        balance -= t.totalAmount;
                        totalBoughtKg += t.quantity || 0;
                    }
                    if (t.type === 'SELL') {
                        balance += t.totalAmount;
                        totalSoldKg += t.quantity || 0;
                    }
                    if (t.type === 'PAYMENT_OUT') {
                        balance += t.totalAmount;
                    }
                    if (t.type === 'PAYMENT_IN') {
                        balance -= t.totalAmount;
                    }
                });

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-stone-900 border border-white/5 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-stone-950">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-stone-400">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">{selectedPersonDetails}</h2>
                                        <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-1">Cari Detayı</p>
                                        {(contactStats[selectedPersonDetails]?.phone || contactStats[selectedPersonDetails]?.address) && (
                                            <div className="flex gap-3 text-xs text-stone-400">
                                                {contactStats[selectedPersonDetails]?.phone && (<span>📞 {contactStats[selectedPersonDetails].phone}</span>)}
                                                {contactStats[selectedPersonDetails]?.address && (<span>📍 {contactStats[selectedPersonDetails].address}</span>)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {siloContacts.find(c => c.name === selectedPersonDetails) && (
                                        <>
                                            <button onClick={() => openEditContactModal(selectedPersonDetails)} className="text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10 transition-colors p-2 bg-stone-800 rounded-full" title="Kişiyi Düzenle">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => {
                                                const contact = siloContacts.find(c => c.name === selectedPersonDetails);
                                                if (contact) handleDeleteContact(contact.id);
                                            }} className="text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors p-2 bg-stone-800 rounded-full" title="Kişiyi Sil">
                                                <Trash2 size={18} />
                                            </button>
                                        </>
                                    )}
                                    <button onClick={() => generatePersonStatementPDF(selectedPersonDetails, personTxs, balance, contactStats[selectedPersonDetails])} className="text-blue-500/80 hover:text-blue-400 hover:bg-blue-500/10 transition-colors p-2 bg-stone-800 rounded-full" title="PDF Ekstre İndir">
                                        <Download size={18} />
                                    </button>
                                    <button onClick={() => setSelectedPersonDetails(null)} className="text-stone-500 hover:text-stone-300 transition-colors p-2 bg-stone-800 rounded-full"><X size={18} /></button>
                                </div>
                            </div>
                            
                            <div className="px-4 py-4 grid grid-cols-2 gap-3 bg-stone-950/50 border-b border-white/5">
                                <div className="bg-stone-900 p-3.5 rounded-2xl border border-white/5 col-span-2 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-0.5">Güncel Bakiye</p>
                                        <p className={`text-2xl font-black font-mono ${balance > 0 ? 'text-emerald-400' : balance < 0 ? 'text-rose-400' : 'text-stone-300'}`}>
                                            {formatCurrency(Math.abs(balance), userProfile?.currency || 'TRY')}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${balance > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : balance < 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-stone-800 text-stone-400 border border-white/10'}`}>
                                        {balance > 0 ? 'ALACAKLIYIZ' : balance < 0 ? 'BORÇLUYUZ' : 'NÖTR'}
                                    </span>
                                </div>
                                <div className="bg-stone-900 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1">Toplam Alınan</p>
                                    <p className="text-base font-black font-mono text-stone-300">{totalBoughtKg.toLocaleString('tr-TR')} kg</p>
                                </div>
                                <div className="bg-stone-900 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1">Toplam Satılan</p>
                                    <p className="text-base font-black font-mono text-stone-300">{totalSoldKg.toLocaleString('tr-TR')} kg</p>
                                </div>
                            </div>

                            <div className="px-4 py-3 border-b border-white/5 bg-stone-900 grid grid-cols-2 gap-2">
                                <button onClick={() => { setSelectedPersonDetails(null); openNewModal('BUY', selectedPersonDetails); }} className="py-2.5 px-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 flex items-center justify-center transition-colors"><TrendingDown size={14} className="mr-1.5"/> Alım Yap</button>
                                <button onClick={() => { setSelectedPersonDetails(null); openNewModal('SELL', selectedPersonDetails); }} className="py-2.5 px-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500/20 flex items-center justify-center transition-colors"><TrendingUp size={14} className="mr-1.5"/> Satış Yap</button>
                                <button onClick={() => { setSelectedPersonDetails(null); openNewModal('PAYMENT_OUT', selectedPersonDetails); }} className="py-2.5 px-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold hover:bg-rose-500/20 flex items-center justify-center transition-colors"><Wallet size={14} className="mr-1.5"/> Ödeme Yap</button>
                                <button onClick={() => { setSelectedPersonDetails(null); openNewModal('PAYMENT_IN', selectedPersonDetails); }} className="py-2.5 px-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold hover:bg-blue-500/20 flex items-center justify-center transition-colors"><Wallet size={14} className="mr-1.5"/> Tahsilat Al</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {personTxs.length === 0 ? (
                                    <div className="text-center py-10 text-stone-500 text-sm">İşlem kaydı bulunmuyor.</div>
                                ) : (
                                    personTxs.map(tx => (
                                        <div key={tx.id} className="bg-stone-950 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                    tx.type === 'BUY' || tx.type === 'PAYMENT_OUT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                }`}>
                                                    {tx.type === 'BUY' ? <TrendingDown size={18} /> : 
                                                     tx.type === 'SELL' ? <TrendingUp size={18} /> : 
                                                     tx.type === 'PAYMENT_OUT' ? <Wallet size={18} /> :
                                                     <Wallet size={18} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-stone-100 truncate">
                                                        {tx.type === 'PAYMENT_IN' || tx.type === 'PAYMENT_OUT' ? 'Ödeme' : tx.product} 
                                                        <span className="text-[10px] text-stone-500 font-medium ml-1">
                                                            ({tx.type === 'BUY' ? 'Alım' : tx.type === 'SELL' ? 'Satış' : tx.type === 'PAYMENT_IN' ? 'Tahsilat' : 'Ödeme Yapıldı'})
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-stone-400">{new Date(tx.date).toLocaleDateString('tr-TR')}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between sm:justify-end w-full sm:flex-1 gap-4">
                                                <div className="flex gap-4">
                                                    {(tx.type === 'BUY' || tx.type === 'SELL') && (
                                                        <div className="text-left sm:text-right">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Miktar</p>
                                                            <p className="text-sm font-black font-mono text-stone-300">{tx.quantity?.toLocaleString('tr-TR')} kg</p>
                                                        </div>
                                                    )}
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Tutar</p>
                                                        <p className={`text-base font-black font-mono ${tx.type === 'BUY' || tx.type === 'PAYMENT_OUT' ? 'text-stone-300' : 'text-amber-400'}`}>
                                                            {formatCurrency(tx.totalAmount, userProfile?.currency || 'TRY')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 ml-2">
                                                    {tx.documentUrl && (
                                                        <button onClick={() => handleDownloadDocument(tx.documentUrl!)} className="p-1.5 text-stone-500 hover:text-emerald-400 bg-stone-800 hover:bg-emerald-500/10 transition-colors rounded-lg flex items-center justify-center shrink-0">
                                                            <Download size={14} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => generatePDF(tx)} className="p-1.5 text-blue-500/80 hover:text-blue-400 hover:bg-blue-500/10 bg-stone-800 rounded-lg shrink-0"><FileText size={14} /></button>
                                                    {isAdmin && (
                                                        <>
                                                            <button onClick={() => { setSelectedPersonDetails(null); openEditModal(tx); }} className="p-1.5 text-stone-500 hover:text-stone-300 bg-stone-800 rounded-lg shrink-0"><Edit2 size={14} /></button>
                                                            <button onClick={() => { setSelectedPersonDetails(null); handleDelete(tx.id); }} className="p-1.5 text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 bg-stone-800 rounded-lg shrink-0"><Trash2 size={14} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* PRODUCT DETAILS MODAL */}
            {selectedProductDetails && (() => {
                const productTxs = transactions.filter(t => t.product === selectedProductDetails && (t.type === 'BUY' || t.type === 'SELL')).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const stat = productStats[selectedProductDetails];
                
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-stone-900 border border-white/5 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-stone-950">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-stone-400">
                                        <Package size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">{selectedProductDetails}</h2>
                                        <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Stok Hareketleri</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedProductDetails(null)} className="text-stone-500 hover:text-stone-300 transition-colors p-2 bg-stone-800 rounded-full"><X size={18} /></button>
                            </div>
                            
                            <div className="p-4 grid grid-cols-4 gap-3 bg-stone-950/50">
                                <div className="bg-stone-900 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1">Mevcut Stok</p>
                                    <p className="text-lg font-black font-mono text-emerald-400">{(stat.inKg - stat.outKg).toLocaleString('tr-TR')} kg</p>
                                </div>
                                <div className="bg-stone-900 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1">Toplam Giren</p>
                                    <p className="text-sm font-black font-mono text-stone-300">{stat.inKg.toLocaleString('tr-TR')} kg</p>
                                </div>
                                <div className="bg-stone-900 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1">Toplam Çıkan</p>
                                    <p className="text-sm font-black font-mono text-stone-300">{stat.outKg.toLocaleString('tr-TR')} kg</p>
                                </div>
                                <div className="bg-stone-900 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1">Ort. Alış</p>
                                    <p className="text-sm font-black font-mono text-stone-300">{formatCurrency(stat.inKg > 0 ? stat.buyCost / stat.inKg : 0, userProfile?.currency || 'TRY')}</p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {productTxs.length === 0 ? (
                                    <div className="text-center py-10 text-stone-500 text-sm">Hareket bulunmuyor.</div>
                                ) : (
                                    productTxs.map(tx => (
                                        <div key={tx.id} className="bg-stone-950 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                    {tx.type === 'BUY' ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-bold text-stone-100 truncate">{tx.type === 'BUY' ? 'Alım' : 'Satış'}</p>
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                                                            {tx.type === 'BUY' ? 'Kimden:' : 'Kime:'}
                                                        </span>
                                                        <span className="text-xs font-bold text-stone-200 bg-stone-800/80 px-2 py-0.5 rounded-md truncate border border-white/5">
                                                            {tx.person}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between sm:justify-end w-full sm:flex-1 gap-4">
                                                <div className="flex gap-4">
                                                    <div className="text-left sm:text-right hidden sm:block">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Tarih</p>
                                                        <p className="text-xs font-bold text-stone-400 mt-0.5">{new Date(tx.date).toLocaleDateString('tr-TR')}</p>
                                                    </div>
                                                    <div className="text-left sm:text-right">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Miktar</p>
                                                        <p className="text-sm font-black font-mono text-stone-300">{tx.quantity?.toLocaleString('tr-TR')} kg</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-500">Birim Fiyat</p>
                                                        <p className="text-sm font-black font-mono text-stone-400">{formatCurrency(tx.unitPrice, userProfile?.currency || 'TRY')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 ml-2">
                                                    {tx.documentUrl && (
                                                        <button onClick={() => handleDownloadDocument(tx.documentUrl!)} className="p-1.5 text-stone-500 hover:text-emerald-400 bg-stone-800 hover:bg-emerald-500/10 transition-colors rounded-lg flex items-center justify-center shrink-0">
                                                            <Download size={14} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => generatePDF(tx)} className="p-1.5 text-blue-500/80 hover:text-blue-400 hover:bg-blue-500/10 bg-stone-800 rounded-lg shrink-0"><FileText size={14} /></button>
                                                    {isAdmin && (
                                                        <>
                                                            <button onClick={() => { setSelectedProductDetails(null); openEditModal(tx); }} className="p-1.5 text-stone-500 hover:text-stone-300 bg-stone-800 rounded-lg shrink-0"><Edit2 size={14} /></button>
                                                            <button onClick={() => { setSelectedProductDetails(null); handleDelete(tx.id); }} className="p-1.5 text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 bg-stone-800 rounded-lg shrink-0"><Trash2 size={14} /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )
            })()}
            
            {/* CONTACT ADD MODAL */}
            {isContactModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-stone-900 border border-white/5 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-950">
                            <h2 className="text-lg font-bold text-stone-100">{editingContactId ? 'Kişiyi Düzenle' : 'Kişi Ekle'}</h2>
                            <button onClick={closeContactModal} className="text-stone-500 hover:text-stone-300 transition-colors p-1"><X size={20} /></button>
                        </div>
                        
                        <div className="p-5 overflow-y-auto space-y-4">
                            <div>
                                <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Adı Soyadı</label>
                                <input 
                                    type="text" 
                                    value={contactName} 
                                    onChange={e => setContactName(e.target.value)} 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                                    placeholder="Örn: Hasan Yılmaz"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs font-black text-stone-500 uppercase tracking-widest block">T.C. Kimlik Numarası</label>
                                    {contactTcNo.trim().length > 0 && (
                                        <span className={`text-[10px] font-bold font-mono ${validateTcOrVkn(contactTcNo).isValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {contactTcNo.trim().length}/11 Hane
                                        </span>
                                    )}
                                </div>
                                <input 
                                    type="text" 
                                    maxLength={11}
                                    value={contactTcNo} 
                                    onChange={e => setContactTcNo(e.target.value.replace(/[^0-9]/g, ''))} 
                                    className={`w-full bg-stone-950 border ${contactTcNo.trim().length > 0 ? (validateTcOrVkn(contactTcNo).isValid ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20 focus:border-emerald-500 ring-2 ring-emerald-500/20' : 'border-rose-500 text-rose-300 bg-rose-950/40 focus:border-rose-500 ring-2 ring-rose-500/20') : 'border-stone-800 text-white focus:border-blue-500'} rounded-xl px-4 py-3 outline-none transition-all font-mono`}
                                    placeholder="11 haneli T.C. Kimlik No"
                                />
                                {contactTcNo.trim().length > 0 && (
                                    <p className={`text-[10px] font-bold ${validateTcOrVkn(contactTcNo).isValid ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30' : 'text-rose-400 bg-rose-950/50 border-rose-500/30'} mt-1.5 flex items-center gap-1.5 border p-2 rounded-xl`}>
                                        {validateTcOrVkn(contactTcNo).isValid ? <CheckCircle2 size={12} className="shrink-0 text-emerald-400" /> : <AlertTriangle size={12} className="shrink-0 text-rose-400" />}
                                        <span>{validateTcOrVkn(contactTcNo).message}</span>
                                    </p>
                                )}
                            </div>
                            
                            <div>
                                <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Telefon Numarası</label>
                                <input 
                                    type="tel" 
                                    value={contactPhone} 
                                    onChange={e => setContactPhone(e.target.value)} 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors font-mono"
                                    placeholder="5XX XXX XX XX"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Adres / Köy</label>
                                <textarea 
                                    value={contactAddress} 
                                    onChange={e => setContactAddress(e.target.value)} 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors min-h-[80px]"
                                    placeholder="Açık adres veya köy adı..."
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Kişi Tipi</label>
                                <select 
                                    value={contactType} 
                                    onChange={e => setContactType(e.target.value as any)} 
                                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-colors"
                                >
                                    <option value="BUYER">Sadece Arsa (Müşteri)</option>
                                    <option value="SELLER">Sadece Çiftçi (Üretici)</option>
                                    <option value="BOTH">Hem Arsa Hem Çiftçi</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-white/5 bg-stone-950/50 flex gap-3">
                            <button onClick={closeContactModal} className="flex-1 py-3 text-sm font-bold text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-all">İptal</button>
                            <button 
                                onClick={handleContactSave}
                                disabled={!contactName.trim() || !validateTcOrVkn(contactTcNo).isValid} 
                                className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                            >{editingContactId ? 'Güncelle' : 'Kaydet'}</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal 
                isOpen={isConfirmDeleteModalOpen}
                onClose={() => {
                    setIsConfirmDeleteModalOpen(false);
                    setTxToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="İşlemi Sil"
                message="Bu işlemi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
                confirmText="Evet, Sil"
                cancelText="Vazgeç"
                variant="danger"
            />
            
            {/* PDF Generation Overlay Loading */}
            {isGeneratingPDF && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-white text-lg font-bold">PDF Raporu Hazırlanıyor...</p>
                    <p className="text-stone-400 text-sm mt-2">Lütfen bekleyin, bu işlem birkaç saniye sürebilir.</p>
                </div>
            )}

            {/* Hidden PDF Templates */}
            {isGeneratingPDF && (
                <div className="fixed left-[-9999px] top-0 pointer-events-none bg-white">
                    <style dangerouslySetInnerHTML={{ __html: `
                        .pdf-page-container {
                            width: 794px;
                            height: 1123px;
                            background: white;
                            color: black;
                            padding: 40px;
                            box-sizing: border-box;
                            position: relative;
                        }
                    `}} />
                    
                    {/* PAGE 1: FINANCIAL OVERVIEW */}
                    <div className="pdf-page-container flex flex-col">
                        <div className="border-b-2 border-stone-200 pb-6 mb-8 flex justify-between items-end">
                            <div>
                                <h1 className="text-3xl font-black text-stone-900 tracking-tight">Finansal Durum Raporu</h1>
                                <p className="text-stone-500 mt-2">Oluşturulma Tarihi: {new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR')}</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-bold text-stone-800">Silo Yönetim Sistemi</h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Toplam Alım Hacmi</p>
                                <p className="text-3xl font-black text-emerald-600">{formatCurrency(transactions.filter(t => t.type === 'BUY').reduce((acc, t) => acc + (t.totalAmount || 0), 0))}</p>
                            </div>
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Toplam Satış Hacmi</p>
                                <p className="text-3xl font-black text-blue-600">{formatCurrency(transactions.filter(t => t.type === 'SELL').reduce((acc, t) => acc + (t.totalAmount || 0), 0))}</p>
                            </div>
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Kasaya Giren Nakit (Tahsilat)</p>
                                <p className="text-3xl font-black text-green-600">{formatCurrency(transactions.filter(t => t.type === 'PAYMENT_IN').reduce((acc, t) => acc + (t.totalAmount || 0), 0))}</p>
                            </div>
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Kasadan Çıkan Nakit (Ödeme)</p>
                                <p className="text-3xl font-black text-rose-600">{formatCurrency(transactions.filter(t => t.type === 'PAYMENT_OUT').reduce((acc, t) => acc + (t.totalAmount || 0), 0))}</p>
                            </div>
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Ödenen Nakliye Ücretleri</p>
                                <p className="text-3xl font-black text-amber-600">{formatCurrency(transactions.filter(t => t.transportPayer === 'US').reduce((acc, t) => acc + (t.transportCost || 0), 0))}</p>
                            </div>
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Kesilen Komisyonlar</p>
                                <p className="text-3xl font-black text-indigo-600">{formatCurrency(transactions.reduce((acc, t) => acc + (t.commissionAmount || 0), 0))}</p>
                            </div>
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 col-span-2">
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">Gerçekleşen NET Kar / Zarar</p>
                                <p className="text-3xl font-black text-stone-900">
                                    {(() => {
                                        let profit = 0;
                                        PRODUCTS.forEach(p => {
                                            const inTx = transactions.filter(t => t.product === p && t.type === 'BUY');
                                            const outTx = transactions.filter(t => t.product === p && t.type === 'SELL');
                                            const inKg = inTx.reduce((sum, t) => sum + (t.quantity || 0), 0);
                                            const outKg = outTx.reduce((sum, t) => sum + (t.quantity || 0), 0);
                                            
                                            let buyCost = 0;
                                            inTx.forEach(t => {
                                                let actualCost = t.totalAmount;
                                                if (t.transportCost && t.transportPayer === 'THEM') actualCost += t.transportCost;
                                                buyCost += actualCost;
                                            });
                                            
                                            let sellRev = 0;
                                            outTx.forEach(t => {
                                                let actualRev = t.totalAmount;
                                                if (t.transportCost && t.transportPayer === 'THEM') actualRev -= t.transportCost;
                                                sellRev += actualRev;
                                            });
                                            
                                            const avgBuyCost = inKg > 0 ? (buyCost / inKg) : 0;
                                            profit += sellRev - (outKg * avgBuyCost);
                                        });
                                        const netProfit = profit;
                                        return <span className={netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}</span>;
                                    })()}
                                </p>
                            </div>
                        </div>
                        
                        <div className="mt-8">
                            <h2 className="text-xl font-black text-stone-900 mb-6 border-b border-stone-200 pb-2">Ürün Stok Durumu</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {PRODUCTS.map(prod => {
                                    const inQty = transactions.filter(t => t.type === 'BUY' && t.product === prod).reduce((acc, t) => acc + (t.quantity || 0), 0);
                                    const outQty = transactions.filter(t => t.type === 'SELL' && t.product === prod).reduce((acc, t) => acc + (t.quantity || 0), 0);
                                    const currentStock = inQty - outQty;
                                    
                                    if (inQty === 0 && outQty === 0) return null;
                                    
                                    return (
                                        <div key={prod} className="flex justify-between items-center p-4 border border-stone-200 rounded-xl">
                                            <span className="font-bold text-stone-800">{prod}</span>
                                            <span className="font-black text-stone-900">{currentStock.toLocaleString('tr-TR')} kg</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <div className="mt-auto pt-8 text-center text-stone-400 text-sm border-t border-stone-100">
                            Sayfa 1 - Finansal Özet
                        </div>
                    </div>

                    {/* ALIMLAR PAGES */}
                    {Array.from({ length: Math.ceil(transactions.filter(t => t.type === 'BUY').length / 5) }).map((_, pageIndex) => {
                        const pageBuys = transactions.filter(t => t.type === 'BUY').slice(pageIndex * 5, pageIndex * 5 + 5);
                        return (
                            <div key={`buys-page-${pageIndex}`} className="pdf-page-container flex flex-col">
                                <div className="border-b-2 border-stone-200 pb-6 mb-8 flex justify-between items-end">
                                    <div>
                                        <h1 className="text-3xl font-black text-emerald-700 tracking-tight">Alım İşlemleri</h1>
                                        <p className="text-stone-500 mt-2">Detaylı Alım Kayıtları (Sayfa {pageIndex + 1})</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-6 flex-1">
                                    {pageBuys.map((buy, idx) => (
                                        <div key={buy.id} className="border border-stone-200 rounded-2xl p-6 bg-stone-50">
                                            <div className="flex justify-between items-start mb-4 border-b border-stone-200 pb-4">
                                                <div>
                                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">{new Date(buy.date).toLocaleDateString('tr-TR')}</p>
                                                    <h3 className="text-lg font-black text-stone-900">{buy.person}</h3>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-black text-emerald-600">{formatCurrency(buy.totalAmount || 0)}</p>
                                                    <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{buy.paymentType === 'CASH' ? 'Peşin Ödeme' : 'Vadeli Alım'}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Ürün</p>
                                                    <p className="font-bold text-stone-800">{buy.product}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Miktar</p>
                                                    <p className="font-bold text-stone-800">{buy.quantity?.toLocaleString('tr-TR')} kg</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Birim Fiyat</p>
                                                    <p className="font-bold text-stone-800">{formatCurrency(buy.unitPrice || 0)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Plaka</p>
                                                    <p className="font-bold text-stone-800">{buy.plateNumber || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-auto pt-8 text-center text-stone-400 text-sm border-t border-stone-100">
                                    Alımlar Bölümü - Sayfa {pageIndex + 1}
                                </div>
                            </div>
                        );
                    })}

                    {/* SATIŞLAR PAGES */}
                    {Array.from({ length: Math.ceil(transactions.filter(t => t.type === 'SELL').length / 5) }).map((_, pageIndex) => {
                        const pageSells = transactions.filter(t => t.type === 'SELL').slice(pageIndex * 5, pageIndex * 5 + 5);
                        return (
                            <div key={`sells-page-${pageIndex}`} className="pdf-page-container flex flex-col">
                                <div className="border-b-2 border-stone-200 pb-6 mb-8 flex justify-between items-end">
                                    <div>
                                        <h1 className="text-3xl font-black text-blue-700 tracking-tight">Satış İşlemleri</h1>
                                        <p className="text-stone-500 mt-2">Detaylı Satış Kayıtları (Sayfa {pageIndex + 1})</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-6 flex-1">
                                    {pageSells.map((sell, idx) => (
                                        <div key={sell.id} className="border border-stone-200 rounded-2xl p-6 bg-stone-50">
                                            <div className="flex justify-between items-start mb-4 border-b border-stone-200 pb-4">
                                                <div>
                                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">{new Date(sell.date).toLocaleDateString('tr-TR')}</p>
                                                    <h3 className="text-lg font-black text-stone-900">{sell.person}</h3>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-black text-blue-600">{formatCurrency(sell.totalAmount || 0)}</p>
                                                    <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{sell.paymentType === 'CASH' ? 'Peşin Satış' : 'Vadeli Satış'}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Ürün</p>
                                                    <p className="font-bold text-stone-800">{sell.product}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Miktar</p>
                                                    <p className="font-bold text-stone-800">{sell.quantity?.toLocaleString('tr-TR')} kg</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Birim Fiyat</p>
                                                    <p className="font-bold text-stone-800">{formatCurrency(sell.unitPrice || 0)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Plaka</p>
                                                    <p className="font-bold text-stone-800">{sell.plateNumber || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-auto pt-8 text-center text-stone-400 text-sm border-t border-stone-100">
                                    Satışlar Bölümü - Sayfa {pageIndex + 1}
                                </div>
                            </div>
                        );
                    })}

                </div>
            )}
        </div>
    );
};

const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
