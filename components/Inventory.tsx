import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, Plus, Package, DollarSign, TrendingUp, 
    Trash2, Edit2, Save, X, AlertCircle, Filter,
    ArrowUpRight, ArrowDownRight, BarChart3, PieChart, RefreshCw, Loader2, FlaskConical,
    History, User, Calendar, List, Download
} from 'lucide-react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dbService } from '../services/db';
import { InventoryItem, Pesticide, PesticideCategory } from '../types';
import { useAppViewModel } from '../context/AppContext';

export const InventoryScreen: React.FC = () => {
    const { 
        inventory, 
        addInventoryItem, 
        updateInventoryItem, 
        deleteInventoryItem, 
        refreshInventory,
        refreshStats,
        showToast,
        hapticFeedback,
        farmers,
        prescriptions,
        stats,
        userProfile,
        updateUserProfile
    } = useAppViewModel();
    
    const [pesticides, setPesticides] = useState<Pesticide[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS' | 'PROFIT_LOSS'>('LIST');
    
    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isListMenuOpen, setIsListMenuOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [selectedDetailItem, setSelectedDetailItem] = useState<InventoryItem | null>(null);
    
    // Form States
    const [searchPesticideTerm, setSearchPesticideTerm] = useState('');
    const [selectedPesticide, setSelectedPesticide] = useState<Pesticide | null>(null);
    const [formData, setFormData] = useState({
        quantity: '',
        unit: 'Adet',
        buyingPrice: '',
        sellingPrice: '',
        lowStockThreshold: ''
    });

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const pestData = await dbService.getPesticides();
            setPesticides(pestData);
            await refreshInventory();
            setLoading(false);
        };
        init();
    }, []);

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.pesticideName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [inventory, searchTerm, categoryFilter]);

    const filteredPesticides = useMemo(() => {
        if (!searchPesticideTerm) return [];
        return pesticides.filter(p => 
            p.name.toLowerCase().includes(searchPesticideTerm.toLowerCase()) || 
            p.activeIngredient.toLowerCase().includes(searchPesticideTerm.toLowerCase())
        ).slice(0, 10);
    }, [pesticides, searchPesticideTerm]);

    const handleAddItem = async () => {
        if (!selectedPesticide) return;
        
        let finalPesticideId = selectedPesticide.id;

        if (selectedPesticide.id.startsWith('new-')) {
            finalPesticideId = crypto.randomUUID();
            const newPest: Pesticide = {
                id: finalPesticideId,
                name: selectedPesticide.name,
                activeIngredient: 'Belirtilmedi',
                defaultDosage: '100ml/100L',
                category: selectedPesticide.category,
                description: 'Depo eklemesi ile otomatik eklendi.'
            };
            await dbService.addGlobalPesticide(newPest);
        }

        const newItem: InventoryItem = {
            id: crypto.randomUUID(),
            pesticideId: finalPesticideId,
            pesticideName: selectedPesticide.name,
            category: selectedPesticide.category,
            quantity: Number(formData.quantity) || 0,
            unit: formData.unit,
            buyingPrice: Number(formData.buyingPrice) || 0,
            sellingPrice: Number(formData.sellingPrice) || 0,
            lastUpdated: new Date().toISOString(),
            lowStockThreshold: Number(formData.lowStockThreshold) || 0
        };

        await addInventoryItem(newItem);
        showToast('Ürün depoya eklendi', 'success');
        hapticFeedback('success');
        closeModal();
    };

    const handleUpdateItem = async () => {
        if (!selectedItem) return;

        const updatedItem: InventoryItem = {
            ...selectedItem,
            quantity: Number(formData.quantity) || 0,
            unit: formData.unit,
            buyingPrice: Number(formData.buyingPrice) || 0,
            sellingPrice: Number(formData.sellingPrice) || 0,
            lastUpdated: new Date().toISOString(),
            lowStockThreshold: Number(formData.lowStockThreshold) || 0
        };

        await updateInventoryItem(updatedItem);
        showToast('Ürün bilgileri güncellendi', 'success');
        hapticFeedback('success');
        closeModal();
    };

    const syncOldPrescriptions = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            console.log("Starting sync...");
            const allPrescriptions = await dbService.getAllPrescriptions();
            console.log("Found prescriptions:", allPrescriptions.length);
            
            const toProcess = allPrescriptions.filter(p => p.isProcessed && !p.isInventoryProcessed);
            console.log("Prescriptions to process:", toProcess.length);
            
            if (toProcess.length === 0) {
                showToast("Senkronize edilecek yeni işlenmiş reçete bulunamadı.", 'info');
                return;
            }

            if (!confirm(`${toProcess.length} adet işlenmiş reçete depoya yansıtılacak. Devam edilsin mi?`)) {
                return;
            }

            for (const p of toProcess) {
                await dbService.processInventory(p);
            }

            await refreshInventory();
            await refreshStats();
            showToast(`${toProcess.length} reçete başarıyla senkronize edildi`, 'success');
            hapticFeedback('success');
        } catch (error) {
            console.error("Sync error:", error);
            showToast("Senkronizasyon sırasında bir hata oluştu.", 'error');
            hapticFeedback('error');
        } finally {
            setSyncing(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (confirm('Bu ürünü depodan silmek istediğinize emin misiniz?')) {
            try {
                await deleteInventoryItem(id);
                showToast('Ürün depodan silindi', 'success');
                hapticFeedback('medium');
            } catch (error) {
                console.error("Delete error:", error);
                showToast("Ürün silinirken bir hata oluştu.", 'error');
                hapticFeedback('error');
            }
        }
    };

    const openAddModal = () => {
        setFormData({ quantity: '', unit: 'Adet', buyingPrice: '', sellingPrice: '', lowStockThreshold: '5' });
        setSelectedPesticide(null);
        setSearchPesticideTerm('');
        setIsAddModalOpen(true);
    };

    const openEditModal = (item: InventoryItem) => {
        setSelectedItem(item);
        setFormData({
            quantity: item.quantity.toString(),
            unit: item.unit,
            buyingPrice: item.buyingPrice.toString(),
            sellingPrice: item.sellingPrice.toString(),
            lowStockThreshold: (item.lowStockThreshold || 0).toString()
        });
        setIsEditModalOpen(true);
    };

    const openDetailModal = (item: InventoryItem) => {
        setSelectedDetailItem(item);
        setIsDetailModalOpen(true);
        hapticFeedback('light');
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        setIsDetailModalOpen(false);
        setIsListMenuOpen(false);
        setSelectedItem(null);
        setSelectedDetailItem(null);
    };

    const generateInventoryPDF = (type: 'CUSTOMER' | 'INTERNAL' | 'FULL') => {
        const doc = new jsPDF();
        const dateStr = new Date().toLocaleDateString('tr-TR');
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const engineerName = userProfile.fullName || 'Ziraat Mühendisi';
        
        // Helper for Turkish characters (jsPDF default fonts don't support them well without custom fonts)
        const tr = (text: string) => {
            if (!text) return '';
            return text
                .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
                .replace(/ü/g, 'u').replace(/Ü/g, 'U')
                .replace(/ş/g, 's').replace(/Ş/g, 'S')
                .replace(/ı/g, 'i').replace(/İ/g, 'I')
                .replace(/ö/g, 'o').replace(/Ö/g, 'O')
                .replace(/ç/g, 'c').replace(/Ç/g, 'C');
        };

        // --- CORPORATE HEADER ---
        // Emerald Header Bar
        doc.setFillColor(16, 185, 129);
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(tr('MÜHENDİS KAYIT SİSTEMİ'), 14, 20);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(tr('Dijital Tarim ve Stok Yönetim Sistemi'), 14, 28);
        
        // Right side header info
        doc.setFontSize(9);
        doc.text(tr(`Tarih: ${dateStr} ${timeStr}`), 196, 15, { align: 'right' });
        doc.text(tr(`Rapor No: #INV-${Math.floor(Math.random() * 10000)}`), 196, 22, { align: 'right' });
        doc.text(tr(`Sorumlu: ${engineerName}`), 196, 29, { align: 'right' });

        // --- REPORT TITLE ---
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        
        let title = '';
        let head: string[][] = [];
        let body: any[] = [];
        
        const sortedInventory = [...filteredInventory].sort((a, b) => a.category.localeCompare(b.category));

        if (type === 'CUSTOMER') {
            title = 'MUSTERI FIYAT LISTESI';
            head = [[tr('Ürün Adı'), tr('Kategori'), tr('Birim'), tr('Satış Fiyatı')]];
            body = sortedInventory.map(item => [
                tr(item.pesticideName),
                tr(item.category),
                tr(item.unit),
                `${item.sellingPrice.toLocaleString('tr-TR')} TL`
            ]);
        } else if (type === 'INTERNAL') {
            title = 'IC STOK VE MALIYET LISTESI';
            head = [[tr('Ürün Adı'), tr('Kategori'), tr('Stok'), tr('Birim'), tr('Alış Fiyatı')]];
            body = sortedInventory.map(item => [
                tr(item.pesticideName),
                tr(item.category),
                item.quantity,
                tr(item.unit),
                `${item.buyingPrice.toLocaleString('tr-TR')} TL`
            ]);
        } else {
            title = 'TAM STOK VE FINANSAL RAPOR';
            head = [[tr('Ürün Adı'), tr('Kategori'), tr('Stok'), tr('Alış'), tr('Satış'), tr('Toplam Maliyet')]];
            body = sortedInventory.map(item => [
                tr(item.pesticideName),
                tr(item.category),
                `${item.quantity} ${tr(item.unit)}`,
                `${item.buyingPrice.toLocaleString('tr-TR')} TL`,
                `${item.sellingPrice.toLocaleString('tr-TR')} TL`,
                `${(item.quantity * item.buyingPrice).toLocaleString('tr-TR')} TL`
            ]);
        }

        doc.text(tr(title), 14, 55);
        
        // Horizontal line under title
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.5);
        doc.line(14, 58, 60, 58);

        // --- TABLE ---
        autoTable(doc, {
            startY: 65,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { 
                fillColor: [16, 185, 129], 
                textColor: 255,
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: { 
                fontSize: 9, 
                cellPadding: 4,
                font: 'helvetica',
                textColor: [60, 60, 60],
                lineColor: [230, 230, 230]
            },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [20, 20, 20] }
            },
            alternateRowStyles: { fillColor: [250, 252, 251] },
            margin: { left: 14, right: 14 }
        });

        // --- SUMMARY BOXES (For Internal and Full) ---
        if (type !== 'CUSTOMER') {
            const finalY = (doc as any).lastAutoTable.finalY + 15;
            const totalCost = sortedInventory.reduce((acc, i) => acc + (i.quantity * i.buyingPrice), 0);
            const totalRevenue = sortedInventory.reduce((acc, i) => acc + (i.quantity * i.sellingPrice), 0);
            
            // Summary Box Background
            doc.setFillColor(245, 247, 246);
            doc.roundedRect(14, finalY, 182, type === 'FULL' ? 35 : 20, 3, 3, 'F');
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 100, 100);
            doc.text(tr('FINANSAL OZET'), 20, finalY + 8);
            
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.text(tr(`Toplam Stok Maliyeti:`), 20, finalY + 16);
            doc.text(`${totalCost.toLocaleString('tr-TR')} TL`, 190, finalY + 16, { align: 'right' });
            
            if (type === 'FULL') {
                doc.text(tr(`Toplam Potansiyel Ciro:`), 20, finalY + 23);
                doc.text(`${totalRevenue.toLocaleString('tr-TR')} TL`, 190, finalY + 23, { align: 'right' });
                
                doc.setDrawColor(220, 220, 220);
                doc.line(20, finalY + 26, 190, finalY + 26);
                
                doc.setFontSize(12);
                doc.setTextColor(16, 185, 129);
                doc.text(tr(`Tahmini Net Kar:`), 20, finalY + 31);
                doc.text(`${(totalRevenue - totalCost).toLocaleString('tr-TR')} TL`, 190, finalY + 31, { align: 'right' });
            }
        }

        // --- FOOTER ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                tr(`Mühendis Kayıt Sistemi - Profesyonel Stok Yönetim Raporu | Sayfa ${i} / ${pageCount}`),
                105,
                285,
                { align: 'center' }
            );
            doc.text(
                tr('Bu belge dijital olarak olusturulmustur.'),
                105,
                290,
                { align: 'center' }
            );
        }

        doc.save(`MKS_Depo_Raporu_${type}_${dateStr.replace(/\./g, '_')}.pdf`);
        setIsListMenuOpen(false);
        showToast('Kurumsal PDF Raporu oluşturuldu', 'success');
    };

    // Sales History for Detail View
    const farmerMap = useMemo(() => {
        return farmers.reduce((acc, f) => {
            acc[f.id] = f.fullName;
            return acc;
        }, {} as Record<string, string>);
    }, [farmers]);

    const salesHistory = useMemo(() => {
        if (!selectedDetailItem) return [];
        
        const history: { farmerName: string; date: string; price: number; quantity: string }[] = [];
        
        prescriptions.forEach(p => {
            const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
            if (item) {
                history.push({
                    farmerName: farmerMap[p.farmerId] || 'Bilinmeyen Çiftçi',
                    date: p.date,
                    price: item.unitPrice || 0,
                    quantity: item.quantity || '0'
                });
            }
        });
        
        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [selectedDetailItem, prescriptions, farmerMap]);

    // Analysis Data
    const analysisData = useMemo(() => {
        const totalCost = inventory.reduce((acc, item) => acc + (item.quantity * item.buyingPrice), 0);
        const totalPotentialRevenue = inventory.reduce((acc, item) => acc + (item.quantity * item.sellingPrice), 0);
        const potentialProfit = totalPotentialRevenue - totalCost;
        const profitMargin = totalCost > 0 ? (potentialProfit / totalCost) * 100 : 0;

        const categoryDistribution = inventory.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + (item.quantity * item.buyingPrice);
            return acc;
        }, {} as Record<string, number>);

        const chartData = Object.entries(categoryDistribution).map(([name, value]) => ({ name, value }));

        return {
            totalCost,
            totalPotentialRevenue,
            potentialProfit,
            profitMargin,
            chartData
        };
    }, [inventory]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    const profitLossData = useMemo(() => {
        const processed = prescriptions.filter(p => p.isInventoryProcessed);
        
        let totalSoldCost = 0;
        let totalSoldRevenue = 0;

        const buyingPriceMap = inventory.reduce((acc, item) => {
            acc[item.pesticideId] = item.buyingPrice;
            return acc;
        }, {} as Record<string, number>);

        processed.forEach(p => {
            p.items.forEach(item => {
                const qty = parseInt(item.quantity || '0');
                if (qty > 0) {
                    const cost = buyingPriceMap[item.pesticideId] || 0;
                    const revenue = item.unitPrice || 0;
                    
                    totalSoldCost += qty * cost;
                    totalSoldRevenue += qty * revenue;
                }
            });
        });

        const totalProfit = totalSoldRevenue - totalSoldCost - stats.totalExpenses;
        const margin = totalSoldCost > 0 ? (totalProfit / (totalSoldCost + stats.totalExpenses)) * 100 : 0;

        return {
            totalSoldCost,
            totalSoldRevenue,
            totalProfit,
            margin,
            processedCount: processed.length,
            totalExpenses: stats.totalExpenses
        };
    }, [inventory, prescriptions, stats.totalExpenses]);

    return (
        <div className="p-4 pb-32 max-w-5xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-black text-stone-100 tracking-tight flex items-center gap-2">
                        <Package className="text-emerald-500" size={28} />
                        DEPOM
                    </h1>
                    <p className="text-stone-500 text-xs font-bold uppercase tracking-widest mt-1">Stok ve Maliyet Yönetimi</p>
                </div>
                <div className="flex gap-2 relative">
                    <div className="relative">
                        <button 
                            onClick={() => setIsListMenuOpen(!isListMenuOpen)}
                            className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-2 rounded-xl font-bold text-xs border border-white/5 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <List size={16} />
                            Listele
                        </button>
                        
                        {isListMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsListMenuOpen(false)}></div>
                                <div className="absolute top-full right-0 mt-2 w-56 bg-stone-900 border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-2 border-b border-white/5 bg-stone-950/50">
                                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest px-2">PDF Rapor Seçenekleri</span>
                                    </div>
                                    <button 
                                        onClick={() => generateInventoryPDF('CUSTOMER')}
                                        className="w-full text-left px-4 py-3 text-xs font-bold text-stone-300 hover:bg-stone-800 hover:text-emerald-400 flex items-center gap-3 transition-colors"
                                    >
                                        <User size={14} className="text-blue-400" />
                                        Müşteri Fiyat Listesi
                                    </button>
                                    <button 
                                        onClick={() => generateInventoryPDF('INTERNAL')}
                                        className="w-full text-left px-4 py-3 text-xs font-bold text-stone-300 hover:bg-stone-800 hover:text-emerald-400 flex items-center gap-3 transition-colors"
                                    >
                                        <Package size={14} className="text-amber-400" />
                                        İç Stok & Maliyet Listesi
                                    </button>
                                    <button 
                                        onClick={() => generateInventoryPDF('FULL')}
                                        className="w-full text-left px-4 py-3 text-xs font-bold text-stone-300 hover:bg-stone-800 hover:text-emerald-400 flex items-center gap-3 transition-colors"
                                    >
                                        <TrendingUp size={14} className="text-emerald-400" />
                                        Tam Finansal Rapor
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button 
                        onClick={syncOldPrescriptions}
                        disabled={syncing}
                        className={`bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-2 rounded-xl font-bold text-xs border border-white/5 active:scale-95 transition-all flex items-center gap-2 ${syncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="İşlenmiş reçeteleri stoktan düşer"
                    >
                        <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                        {syncing ? 'Senkronize Ediliyor...' : 'Senkronize Et'}
                    </button>
                    <button 
                        onClick={openAddModal}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Ürün Ekle
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-stone-900/50 p-1 rounded-xl border border-white/5 w-fit">
                <button 
                    onClick={() => setActiveTab('LIST')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'LIST' ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                >
                    <Package size={16} /> Stok Listesi
                </button>
                <button 
                    onClick={() => setActiveTab('ANALYSIS')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'ANALYSIS' ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                >
                    <BarChart3 size={16} /> Finansal Analiz
                </button>
                <button 
                    onClick={() => setActiveTab('PROFIT_LOSS')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'PROFIT_LOSS' ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                >
                    <TrendingUp size={16} /> Kar / Zarar
                </button>
            </div>

            {activeTab === 'LIST' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                    {/* Search & Filter */}
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 bg-stone-900 border border-white/5 rounded-xl flex items-center px-3 shadow-sm">
                            <Search className="text-stone-500" size={18} />
                            <input 
                                type="text"
                                placeholder="Ürün ara..."
                                className="w-full bg-transparent p-3 text-stone-200 outline-none text-sm font-medium placeholder-stone-600"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="bg-stone-900 border border-white/5 rounded-xl px-3 text-stone-400 text-sm font-medium outline-none"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="ALL">Tüm Kategoriler</option>
                            {Object.values(PesticideCategory).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Inventory List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => openDetailModal(item)}
                                    className={`bg-stone-900/80 backdrop-blur border rounded-xl p-2 shadow-sm transition-all group cursor-pointer active:scale-[0.98] ${
                                        item.quantity === 0 
                                        ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]' 
                                        : 'border-white/5 hover:border-emerald-500/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-stone-100 text-xs truncate tracking-tight">{item.pesticideName}</h3>
                                            <span className="text-[7px] font-bold text-stone-500 bg-stone-950/50 px-1 py-0.5 rounded border border-white/5 uppercase tracking-widest mt-0.5 inline-block">
                                                {item.category}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditModal(item);
                                                }} 
                                                className="p-1 bg-stone-800/60 text-stone-400 rounded-lg hover:text-emerald-400 hover:bg-stone-700 transition-all active:scale-90 border border-white/5"
                                                title="Düzenle"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item.id);
                                                }} 
                                                className="p-1 bg-stone-800/60 text-stone-400 rounded-lg hover:text-red-400 hover:bg-red-900/20 transition-all active:scale-90 border border-white/5"
                                                title="Sil"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                                        <div className="bg-stone-950/30 p-1.5 rounded-lg border border-white/5">
                                            <span className="text-[7px] text-stone-500 font-bold uppercase block mb-0.5 tracking-wider">Stok</span>
                                            <span className="text-emerald-400 font-black font-mono text-xs">
                                                {item.quantity} <span className="text-[7px] text-stone-600 font-bold font-sans uppercase">{item.unit}</span>
                                            </span>
                                        </div>
                                        <div className="bg-stone-950/30 p-1.5 rounded-lg border border-white/5">
                                            <span className="text-[7px] text-stone-500 font-bold uppercase block mb-0.5 tracking-wider">Alış</span>
                                            <span className="text-stone-300 font-black font-mono text-xs">
                                                {Math.round(item.buyingPrice).toLocaleString('tr-TR')} <span className="text-[7px] text-stone-600 font-bold font-sans uppercase">₺</span>
                                            </span>
                                        </div>
                                        <div className="bg-stone-950/30 p-1.5 rounded-lg border border-white/5">
                                            <span className="text-[7px] text-stone-500 font-bold uppercase block mb-0.5 tracking-wider">Satış</span>
                                            <span className="text-amber-400 font-black font-mono text-xs">
                                                {Math.round(item.sellingPrice).toLocaleString('tr-TR')} <span className="text-[7px] text-stone-600 font-bold font-sans uppercase">₺</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                                        <div className="text-[10px] text-stone-600 font-mono">
                                            Son Güncelleme: {new Date(item.lastUpdated).toLocaleDateString()}
                                        </div>
                                        <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                                            (item.sellingPrice - item.buyingPrice) > 0 
                                            ? 'text-emerald-400 bg-emerald-900/20' 
                                            : 'text-red-400 bg-red-900/20'
                                        }`}>
                                            Kar: {(item.sellingPrice - item.buyingPrice).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full text-center py-12 border-2 border-dashed border-stone-800 rounded-2xl text-stone-600">
                                <Package size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Deponuzda ürün bulunamadı.</p>
                                <button onClick={openAddModal} className="text-emerald-500 font-bold mt-2 hover:underline">Yeni Ürün Ekle</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'ANALYSIS' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-stone-900 p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">Toplam Stok Maliyeti</h3>
                            <p className="text-2xl font-black text-stone-200 font-mono">
                                {analysisData.totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                            </p>
                            <div className="mt-2 text-[10px] text-stone-500">Depodaki ürünlerin toplam alış değeri</div>
                        </div>

                        <div className="bg-stone-900 p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">Potansiyel Ciro</h3>
                            <p className="text-2xl font-black text-emerald-400 font-mono">
                                {analysisData.totalPotentialRevenue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                            </p>
                            <div className="mt-2 text-[10px] text-stone-500">Tüm stok satıldığında elde edilecek gelir</div>
                        </div>

                        <div className="bg-stone-900 p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">Tahmini Kar</h3>
                            <div className="flex items-end gap-2">
                                <p className={`text-2xl font-black font-mono ${analysisData.potentialProfit >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {analysisData.potentialProfit.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                </p>
                                <span className={`text-xs font-bold mb-1 ${analysisData.profitMargin >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    %{analysisData.profitMargin.toFixed(1)}
                                </span>
                            </div>
                            <div className="mt-2 text-[10px] text-stone-500">Beklenen net kar marjı</div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-stone-900 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-stone-200 font-bold mb-6 flex items-center gap-2 text-sm">
                                <PieChart size={16} className="text-emerald-500" />
                                Kategori Bazlı Maliyet Dağılımı
                            </h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={analysisData.chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {analysisData.chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                            formatter={(value: number) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                        />
                                    </RePieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                {analysisData.chartData.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                        <span className="text-[10px] text-stone-400 truncate flex-1">{item.name}</span>
                                        <span className="text-[10px] text-stone-300 font-mono">{((item.value / analysisData.totalCost) * 100).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-stone-900 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-stone-200 font-bold mb-6 flex items-center gap-2 text-sm">
                                <TrendingUp size={16} className="text-blue-500" />
                                En Yüksek Kar Marjlı Ürünler (Top 5)
                            </h3>
                            <div className="space-y-3">
                                {[...inventory]
                                    .sort((a, b) => (b.sellingPrice - b.buyingPrice) - (a.sellingPrice - a.buyingPrice))
                                    .slice(0, 5)
                                    .map((item, idx) => {
                                        const profit = item.sellingPrice - item.buyingPrice;
                                        const margin = item.buyingPrice > 0 ? (profit / item.buyingPrice) * 100 : 100;
                                        return (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-stone-950/50 rounded-xl border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-lg bg-stone-800 flex items-center justify-center text-[10px] font-bold text-stone-400">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-stone-300">{item.pesticideName}</div>
                                                        <div className="text-[10px] text-stone-500">{item.category}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-emerald-400 font-mono">
                                                        +{profit.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                                    </div>
                                                    <div className="text-[10px] text-stone-500 font-mono">
                                                        %{margin.toFixed(0)} Marj
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'PROFIT_LOSS' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-stone-900 border border-white/5 p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                                    <ArrowDownRight size={20} />
                                </div>
                                <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider">Satılan Ürün Maliyeti</span>
                            </div>
                            <div className="text-2xl font-black text-stone-100">{profitLossData.totalSoldCost.toLocaleString('tr-TR')} <span className="text-sm font-normal text-stone-500">TL</span></div>
                            <p className="text-[10px] text-stone-600 mt-2 font-medium">{profitLossData.processedCount} adet işlenmiş reçete baz alınmıştır.</p>
                        </div>

                        <div className="bg-stone-900 border border-white/5 p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <ArrowUpRight size={20} />
                                </div>
                                <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider">Satış Geliri</span>
                            </div>
                            <div className="text-2xl font-black text-stone-100">{profitLossData.totalSoldRevenue.toLocaleString('tr-TR')} <span className="text-sm font-normal text-stone-500">TL</span></div>
                            <p className="text-[10px] text-stone-600 mt-2 font-medium">Reçetelerdeki birim fiyatlar üzerinden hesaplanmıştır.</p>
                        </div>

                        <div className="bg-stone-900 border border-white/5 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 ${profitLossData.totalProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profitLossData.totalProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    <DollarSign size={20} />
                                </div>
                                <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider">Net Kar / Zarar</span>
                            </div>
                            <div className={`text-2xl font-black ${profitLossData.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {profitLossData.totalProfit.toLocaleString('tr-TR')} <span className="text-sm font-normal opacity-60">TL</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${profitLossData.totalProfit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    %{profitLossData.margin.toFixed(1)} Marj
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Info Card */}
                    <div className="bg-stone-900 border border-white/5 p-8 rounded-3xl shadow-sm">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-stone-100 tracking-tight">Finansal Özet</h3>
                                <p className="text-stone-500 text-xs font-bold uppercase tracking-widest">Gerçekleşen Satış Analizi</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                <span className="text-stone-400 font-medium">Toplam Satış Geliri</span>
                                <span className="text-stone-100 font-black">{profitLossData.totalSoldRevenue.toLocaleString('tr-TR')} TL</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                <span className="text-stone-400 font-medium">Toplam Ürün Maliyeti</span>
                                <span className="text-stone-100 font-black text-red-400">-{profitLossData.totalSoldCost.toLocaleString('tr-TR')} TL</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                <span className="text-stone-400 font-medium">İşletme Giderleri</span>
                                <span className="text-stone-100 font-black text-red-400">-{profitLossData.totalExpenses.toLocaleString('tr-TR')} TL</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-stone-100 font-black text-lg">Toplam Kar</span>
                                <span className={`text-2xl font-black ${profitLossData.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {profitLossData.totalProfit.toLocaleString('tr-TR')} TL
                                </span>
                            </div>
                        </div>

                        <div className="mt-10 p-4 bg-stone-950/50 rounded-2xl border border-white/5 flex items-start gap-3">
                            <AlertCircle className="text-amber-500 shrink-0" size={18} />
                            <p className="text-xs text-stone-500 leading-relaxed">
                                Bu veriler, "İşlenmiş" olarak işaretlenen ve stoktan düşülen reçetelerdeki ürünlerin, deponuzdaki güncel alış fiyatları ile reçetedeki satış fiyatları karşılaştırılarak hesaplanmıştır.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-950/50">
                            <h3 className="font-bold text-stone-100">
                                {isEditModalOpen ? 'Ürün Düzenle' : 'Depoya Ürün Ekle'}
                            </h3>
                            <button onClick={closeModal} className="text-stone-500 hover:text-stone-300">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {isAddModalOpen && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Ürün Seçimi</label>
                                    {!selectedPesticide ? (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 text-stone-500" size={16} />
                                            <input 
                                                type="text" 
                                                placeholder="İlaç adı ara..." 
                                                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-10 text-stone-200 text-sm outline-none focus:border-emerald-500/50"
                                                value={searchPesticideTerm}
                                                onChange={(e) => setSearchPesticideTerm(e.target.value)}
                                            />
                                            {searchPesticideTerm && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-stone-900 border border-stone-800 rounded-xl shadow-xl max-h-48 overflow-y-auto z-10">
                                                    {filteredPesticides.map(p => (
                                                        <button 
                                                            key={p.id}
                                                            onClick={() => {
                                                                setSelectedPesticide(p);
                                                                setSearchPesticideTerm('');
                                                            }}
                                                            className="w-full text-left p-3 hover:bg-stone-800 border-b border-white/5 last:border-0"
                                                        >
                                                            <div className="font-bold text-stone-200 text-sm">{p.name}</div>
                                                            <div className="text-[10px] text-stone-500">{p.category}</div>
                                                        </button>
                                                    ))}
                                                    {filteredPesticides.length === 0 && (
                                                        <div className="p-3 text-center text-xs text-stone-500">Sonuç bulunamadı</div>
                                                    )}
                                                    <button 
                                                        onClick={() => {
                                                            const newPest: Pesticide = {
                                                                id: `new-${crypto.randomUUID()}`,
                                                                name: searchPesticideTerm,
                                                                activeIngredient: 'Belirtilmedi',
                                                                defaultDosage: '100ml/100L',
                                                                category: PesticideCategory.OTHER,
                                                                description: 'Depo eklemesi ile otomatik eklendi.'
                                                            };
                                                            setSelectedPesticide(newPest);
                                                            setSearchPesticideTerm('');
                                                        }}
                                                        className="w-full text-left p-3 hover:bg-stone-800 border-t border-white/10 text-emerald-400 font-bold text-sm flex items-center"
                                                    >
                                                        <Plus size={14} className="mr-2" />
                                                        "{searchPesticideTerm}" olarak yeni ekle
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded-xl flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-emerald-400 text-sm">{selectedPesticide.name}</div>
                                                <div className="text-[10px] text-emerald-600/70">{selectedPesticide.category}</div>
                                            </div>
                                            <button onClick={() => setSelectedPesticide(null)} className="text-emerald-500 hover:text-emerald-300">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

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
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Alış Fiyatı (TL)</label>
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
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Satış Fiyatı (TL)</label>
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
                            </div>
                            
                            {/* Profit Preview */}
                            {(Number(formData.sellingPrice) > 0 && Number(formData.buyingPrice) > 0) && (
                                <div className="bg-stone-950 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                                    <span className="text-xs text-stone-500 font-bold">Birim Kar:</span>
                                    <span className={`text-sm font-black font-mono ${Number(formData.sellingPrice) - Number(formData.buyingPrice) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {(Number(formData.sellingPrice) - Number(formData.buyingPrice)).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/10 bg-stone-950/50 flex justify-end gap-3">
                            <button 
                                onClick={closeModal}
                                className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 font-bold text-sm transition-colors"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={isEditModalOpen ? handleUpdateItem : handleAddItem}
                                disabled={isAddModalOpen && !selectedPesticide}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isEditModalOpen ? 'Güncelle' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {isDetailModalOpen && selectedDetailItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-start bg-stone-950/50">
                            <div>
                                <h3 className="text-xl font-black text-stone-100 tracking-tight">{selectedDetailItem.pesticideName}</h3>
                                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">{selectedDetailItem.category}</p>
                            </div>
                            <button onClick={closeModal} className="p-2 bg-stone-800 text-stone-400 rounded-xl hover:text-stone-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            {/* Stock Info */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-stone-950/50 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Mevcut Stok</span>
                                    <span className="text-emerald-400 font-black text-xl">
                                        {selectedDetailItem.quantity} <span className="text-xs text-stone-600 font-sans">{selectedDetailItem.unit}</span>
                                    </span>
                                </div>
                                <div className="bg-stone-950/50 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Alış Fiyatı</span>
                                    <span className="text-stone-300 font-bold text-lg">
                                        {selectedDetailItem.buyingPrice.toLocaleString('tr-TR')} ₺
                                    </span>
                                </div>
                                <div className="bg-stone-950/50 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Satış Fiyatı</span>
                                    <span className="text-stone-300 font-bold text-lg">
                                        {selectedDetailItem.sellingPrice.toLocaleString('tr-TR')} ₺
                                    </span>
                                </div>
                            </div>

                            {/* Sales History */}
                            <div>
                                <h4 className="text-xs font-black text-stone-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <History size={14} className="text-blue-500" />
                                    Satış Geçmişi (Reçeteler)
                                </h4>
                                
                                <div className="space-y-2">
                                    {salesHistory.length > 0 ? (
                                        salesHistory.map((sale, idx) => (
                                            <div key={idx} className="bg-stone-950/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-stone-500">
                                                        <User size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-stone-200">{sale.farmerName}</div>
                                                        <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-0.5">
                                                            <Calendar size={10} />
                                                            {new Date(sale.date).toLocaleDateString('tr-TR')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-emerald-400 font-mono">
                                                        {sale.price.toLocaleString('tr-TR')} ₺
                                                    </div>
                                                    <div className="text-[10px] text-stone-600 font-bold">
                                                        Miktar: {sale.quantity}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 bg-stone-950/30 rounded-2xl border border-dashed border-stone-800">
                                            <p className="text-xs text-stone-600">Bu ürün henüz hiçbir reçetede satılmadı.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 bg-stone-950/50">
                            <button 
                                onClick={() => {
                                    closeModal();
                                    openEditModal(selectedDetailItem);
                                }}
                                className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Edit2 size={16} />
                                Stok Bilgilerini Düzenle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
