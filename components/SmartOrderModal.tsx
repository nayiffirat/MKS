import React, { useMemo } from 'react';
import { ShoppingCart, Check, X, Share2, Clipboard, Download, Factory } from 'lucide-react';
import { InventoryItem, SupplierPurchase, Supplier } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, getCurrencySuffix } from '../utils/currency';

interface SmartOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventory: InventoryItem[];
    suppliers: Supplier[];
    supplierPurchases: SupplierPurchase[];
    showToast: (msg: string, type: 'success'|'error') => void;
}

export const SmartOrderModal: React.FC<SmartOrderModalProps> = ({ 
    isOpen, onClose, inventory, suppliers, supplierPurchases, showToast 
}) => {

    const generatedOrders = useMemo(() => {
        // Find items that need ordering
        const itemsToOrder = inventory.filter(item => 
            !item.deletedAt && 
            item.lowStockThreshold != null && 
            item.quantity <= item.lowStockThreshold
        );

        if (itemsToOrder.length === 0) return [];

        // Determine last supplier for each item
        const lastSupplierMap = new Map<string, string>(); // pesticideId -> supplierId
        
        // Sort purchases by date desc to find the most recent
        const sortedPurchases = [...supplierPurchases].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const purchase of sortedPurchases) {
            if (purchase.deletedAt || purchase.type === 'RETURN') continue;
            for (const pItem of purchase.items) {
                if (!lastSupplierMap.has(pItem.pesticideId)) {
                    lastSupplierMap.set(pItem.pesticideId, purchase.supplierId);
                }
            }
        }

        const ordersBySupplier = new Map<string, InventoryItem[]>();

        itemsToOrder.forEach(item => {
            const supplierId = lastSupplierMap.get(item.pesticideId) || 'UNKNOWN';
            if (!ordersBySupplier.has(supplierId)) {
                ordersBySupplier.set(supplierId, []);
            }
            ordersBySupplier.get(supplierId)!.push(item);
        });

        const result: { supplierId: string; supplierName: string; items: InventoryItem[] }[] = [];
        
        ordersBySupplier.forEach((items, supplierId) => {
            let sName = 'Bilinmeyen Tedarikçi (Önceki Alım Yok)';
            if (supplierId !== 'UNKNOWN') {
                const sup = suppliers.find(s => s.id === supplierId);
                if (sup) sName = sup.name;
            }
            result.push({ supplierId, supplierName: sName, items });
        });

        // sort alphabetically by supplier name
        return result.sort((a, b) => a.supplierName.localeCompare(b.supplierName));

    }, [inventory, suppliers, supplierPurchases, isOpen]);

    if (!isOpen) return null;

    const handleShareWhatsApp = (order: { supplierId: string; supplierName: string; items: InventoryItem[] }) => {
        const textLines = [
            `*${order.supplierName} - Sipariş Listesi*`,
            ``,
            ...order.items.map(i => {
                const targetQty = (i.lowStockThreshold || 0) * 2; // Just a suggestion, like double the threshold
                return `• ${i.pesticideName} (Depoda: ${i.quantity} ${i.unit}) - \n   Lütfen gönderiniz: ______ ${i.unit}`;
            }),
            ``,
            `İyi çalışmalar dileriz.`
        ];
        
        const text = textLines.join('\n');
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    const handleCopyAll = () => {
        const textLines: string[] = [];
        
        generatedOrders.forEach(order => {
            textLines.push(`--- ${order.supplierName} ---`);
            order.items.forEach(i => {
                textLines.push(`${i.pesticideName} (Depo: ${i.quantity} ${i.unit})`);
            });
            textLines.push('');
        });

        navigator.clipboard.writeText(textLines.join('\n')).then(() => {
            showToast('Tüm sipariş listesi kopyalandı', 'success');
        });
    };

    const handleDownloadPDF = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(16);

            doc.text("Akill Siparis Listesi", 14, 20);
            doc.setFontSize(10);
            doc.text(`Olusturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

            let startY = 35;

            generatedOrders.forEach(order => {
                doc.setFontSize(12);
                doc.text(`Tedarikçi: ${order.supplierName}`, 14, startY);
                
                const tableData = order.items.map(item => [
                    item.pesticideName,
                    item.category,
                    `${item.quantity} ${item.unit}`,
                    `${item.lowStockThreshold} ${item.unit}`,
                    '' // Boş sipariş miktarı alanı
                ]);

                autoTable(doc, {
                    startY: startY + 5,
                    head: [['Urun Adi', 'Kategori', 'Mevcut Stok', 'Kritik Seviye', 'Siparis Miktari']],
                    body: tableData,
                    styles: { fontSize: 9 },
                    headStyles: { fillColor: [16, 185, 129] },
                    margin: { left: 14, right: 14 }
                });

                startY = (doc as any).lastAutoTable.finalY + 15;
                if (startY > 270) {
                    doc.addPage();
                    startY = 20;
                }
            });

            doc.save(`siparis_listesi_${new Date().getTime()}.pdf`);
            showToast('PDF başarıyla indirildi', 'success');
        } catch (error) {
            console.error(error);
            showToast('PDF oluşturulurken hata oluştu', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-950">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 border border-emerald-500/30 shadow-inner">
                            <ShoppingCart size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight">Akıllı Sipariş Listesi</h2>
                            <p className="text-xs text-stone-400 font-medium">Kritik stok seviyesindeki ürünler ve tedarikçileri</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-stone-400 hover:text-white transition-colors p-2 bg-stone-900 hover:bg-stone-800 rounded-xl">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-stone-950">
                    {generatedOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-20 h-20 rounded-full bg-stone-900 flex items-center justify-center text-stone-700 mb-4 border border-stone-800">
                                <Check size={40} />
                            </div>
                            <h3 className="text-white font-bold text-lg mb-2">Tüm Stoklar Yeterli</h3>
                            <p className="text-stone-400 text-sm">Kritik seviyenin altına düşen ürün bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-wrap gap-2 mb-6">
                                <button
                                    onClick={handleCopyAll}
                                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors"
                                >
                                    <Clipboard size={14} /> Tümünü Kopyala
                                </button>
                                <button
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors"
                                >
                                    <Download size={14} /> PDF Olarak İndir
                                </button>
                            </div>

                            {generatedOrders.map((order, idx) => (
                                <div key={idx} className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
                                    <div className="bg-stone-800/50 p-4 border-b border-stone-800 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-stone-300">
                                                <Factory size={16} />
                                            </div>
                                            <h3 className="font-bold text-white tracking-tight">{order.supplierName}</h3>
                                        </div>
                                        {order.supplierId !== 'UNKNOWN' && (
                                            <button 
                                                onClick={() => handleShareWhatsApp(order)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-800/60 transition-colors"
                                            >
                                                <Share2 size={12} /> WhatsApp'tan Gönder
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-800">
                                                        <th className="font-semibold p-2">Ürün Adı</th>
                                                        <th className="font-semibold p-2">Mevcut Stok</th>
                                                        <th className="font-semibold p-2">Kritik Seviye</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items.map((item, itemIdx) => (
                                                        <tr key={itemIdx} className="border-b border-stone-800/50 last:border-0 hover:bg-stone-800/20 transition-colors group">
                                                            <td className="p-3 text-sm text-stone-100 font-medium group-hover:text-emerald-400 transition-colors">
                                                                {item.pesticideName}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="text-xs font-black text-red-400 bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                                                                    {item.quantity} {item.unit}
                                                                </span>
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="text-xs font-bold text-stone-400">
                                                                    {item.lowStockThreshold} {item.unit}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
