
import React, { useState, useRef } from 'react';
import { 
    ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
    Download, Users, Ruler, Sprout, MapPin, Loader2, ArrowUpRight, 
    FileText, X, Calendar, Activity, Zap, ClipboardCheck, 
    AlertTriangle, TrendingUp, History, Scale, BookOpen, 
    ChevronRight, PieChart as PieIcon, BarChart3, LineChart as LineIcon, Truck, DollarSign
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { dbService } from '../services/db';
import { useAppViewModel } from '../context/AppContext';
import { Prescription } from '../types';

    type StatTab = 'OVERVIEW' | 'LAND' | 'PESTICIDES' | 'VISITS' | 'CONSUMPTION' | 'SALES' | 'DEBTS' | 'RECEIVABLES';

    export const StatisticsScreen: React.FC = () => {
    const { stats, farmers, reminders, notifications, inventory, suppliers } = useAppViewModel();
    const [activeTab, setActiveTab] = useState<StatTab>('OVERVIEW');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const reportRef = useRef<HTMLDivElement>(null);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'];

    React.useEffect(() => {
        const loadPrescriptions = async () => {
            const data = await dbService.getAllPrescriptions();
            setPrescriptions(data);
        };
        loadPrescriptions();
    }, []);

    // Calculate Sales Data
    const salesData = React.useMemo(() => {
        const monthlySales: Record<string, number> = {};
        const productSales: Record<string, number> = {};
        let totalRevenue = 0;
        let totalCost = 0;

        // Buying price map for profit calculation
        const buyingPriceMap = inventory.reduce((acc, item) => {
            acc[item.pesticideId] = item.buyingPrice;
            return acc;
        }, {} as Record<string, number>);

        prescriptions.forEach(p => {
            // Only count processed ones for profit/loss consistency with Inventory screen
            if (!p.isInventoryProcessed) return;

            const date = new Date(p.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // Reçete toplam tutarı varsa kullan, yoksa kalemleri topla
            let prescriptionTotal = p.totalAmount || 0;
            
            // Eğer totalAmount yoksa ve items içinde totalPrice varsa onları topla (geriye dönük uyumluluk)
            if (!prescriptionTotal && p.items) {
                prescriptionTotal = p.items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
            }

            if (prescriptionTotal > 0) {
                monthlySales[monthKey] = (monthlySales[monthKey] || 0) + prescriptionTotal;
                totalRevenue += prescriptionTotal;
            }

            // Ürün bazlı satışlar ve maliyet
            p.items.forEach(item => {
                const qty = parseInt(item.quantity || '0');
                if (qty > 0) {
                    const cost = buyingPriceMap[item.pesticideId] || 0;
                    totalCost += qty * cost;

                    if (item.totalPrice && item.totalPrice > 0) {
                        productSales[item.pesticideName] = (productSales[item.pesticideName] || 0) + item.totalPrice;
                    }
                }
            });
        });

        const totalProfit = totalRevenue - totalCost;
        const margin = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

        const monthlyChartData = Object.entries(monthlySales)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const productChartData = Object.entries(productSales)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10 products

        return {
            totalRevenue,
            totalCost,
            totalProfit,
            margin,
            monthlyChartData,
            productChartData
        };
    }, [prescriptions, inventory]);

    const supplierDebtData = React.useMemo(() => {
        const debts = suppliers
            .filter((s: any) => s.balance < 0)
            .map((s: any) => ({
                name: s.name,
                debt: Math.abs(s.balance)
            }))
            .sort((a: any, b: any) => b.debt - a.debt);
        
        const totalSupplierDebt = debts.reduce((acc: number, curr: any) => acc + curr.debt, 0);
        
        return {
            debts,
            totalSupplierDebt
        };
    }, [suppliers]);

    const farmerReceivableData = React.useMemo(() => {
        const receivables = farmers
            .filter((f: any) => (f.balance || 0) < 0)
            .map((f: any) => ({
                name: f.fullName,
                amount: Math.abs(f.balance || 0)
            }))
            .sort((a: any, b: any) => b.amount - a.amount);
        
        const totalFarmerReceivables = receivables.reduce((acc: number, curr: any) => acc + curr.amount, 0);
        
        return {
            receivables,
            totalFarmerReceivables
        };
    }, [farmers]);

    const handleDownloadPDF = async () => {
        if (!reportRef.current) return;
        setIsGeneratingPdf(true);
        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                backgroundColor: '#0c0a09',
                logging: false,
                useCORS: true
            });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
            pdf.save(`MKS_Istatistik_Raporu_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) {
            console.error("PDF Generation Error:", e);
            alert("Rapor oluşturulurken bir hata oluştu.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Calculate Village Distribution
    const villageData = React.useMemo(() => {
        const distribution: Record<string, number> = {};
        farmers.forEach(f => {
            const village = f.village || 'Merkez';
            distribution[village] = (distribution[village] || 0) + 1;
        });
        return Object.entries(distribution)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [farmers]);

    // Calculate Task Completion Rate
    const taskStats = React.useMemo(() => {
        const total = reminders.length;
        const completed = reminders.filter(r => r.isCompleted).length;
        const pending = total - completed;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
            rate,
            total,
            completed,
            pending,
            data: [
                { name: 'Tamamlanan', value: completed, color: '#10b981' },
                { name: 'Bekleyen', value: pending, color: '#f59e0b' }
            ]
        };
    }, [reminders]);

    const averageFieldSize = React.useMemo(() => {
        return stats.totalFarmers > 0 ? (stats.totalArea / stats.totalFarmers).toFixed(1) : '0';
    }, [stats.totalArea, stats.totalFarmers]);

    const cropDiversity = stats.cropDistribution.length;

    // Calculate Pesticide Consumption (Count based)
    const consumptionData = React.useMemo(() => {
        const counts: Record<string, number> = {};
        prescriptions.forEach(p => {
            p.items.forEach(item => {
                const name = item.pesticideName;
                // Eğer quantity varsa onu sayıya çevirip ekle, yoksa 1 say
                let qty = 1;
                if (item.quantity) {
                    const match = item.quantity.match(/\d+/);
                    if (match) qty = parseInt(match[0]);
                }
                counts[name] = (counts[name] || 0) + qty;
            });
        });

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [prescriptions]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'OVERVIEW':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <QuickStatCard 
                                title="Toplam Üretici" 
                                value={stats.totalFarmers} 
                                icon={Users} 
                                color="blue" 
                                trend="+12%"
                            />
                            <QuickStatCard 
                                title="Toplam Arazi" 
                                value={`${stats.totalArea} da`} 
                                icon={Ruler} 
                                color="emerald" 
                                trend="+5.4%"
                            />
                            <QuickStatCard 
                                title="Aktif Görevler" 
                                value={stats.activeReminders} 
                                icon={ClipboardCheck} 
                                color="amber" 
                            />
                            <QuickStatCard 
                                title="Kritik Uyarılar" 
                                value={notifications.filter(n => n.type === 'WARNING').length} 
                                icon={AlertTriangle} 
                                color="red" 
                            />
                        </div>

                        {/* Detailed Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                                <Scale size={14} className="text-stone-500 mb-1" />
                                <p className="text-xs font-black text-stone-100">{averageFieldSize}</p>
                                <p className="text-[7px] font-bold text-stone-500 uppercase tracking-tighter">Ort. Arazi (da)</p>
                            </div>
                            <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                                <Sprout size={14} className="text-stone-500 mb-1" />
                                <p className="text-xs font-black text-stone-100">{cropDiversity}</p>
                                <p className="text-[7px] font-bold text-stone-500 uppercase tracking-tighter">Ürün Çeşitliliği</p>
                            </div>
                            <div className="bg-stone-900/40 border border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                                <TrendingUp size={14} className="text-stone-500 mb-1" />
                                <p className="text-xs font-black text-stone-100">%{taskStats.rate}</p>
                                <p className="text-[7px] font-bold text-stone-500 uppercase tracking-tighter">Görev Başarısı</p>
                            </div>
                        </div>

                        {/* Village Distribution Chart */}
                        <div className="bg-stone-900/60 border border-white/5 rounded-[2rem] p-5">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <MapPin size={16} className="text-stone-500" />
                                    <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest">Bölgesel Dağılım</h3>
                                </div>
                            </div>
                            <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={villageData.slice(0, 5)}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#737373', fontSize: 10, fontWeight: 700 }} 
                                        />
                                        <YAxis hide />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                            itemStyle={{ color: '#10b981' }}
                                        />
                                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Crop Distribution Summary */}
                        <div className="bg-stone-900/60 border border-white/5 rounded-[2rem] p-5">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Sprout size={16} className="text-stone-500" />
                                    <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest">Ürün Dağılımı</h3>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {stats.cropDistribution.slice(0, 4).map((item, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-stone-400">{item.crop}</span>
                                            <span className="text-emerald-500">{item.area} da</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-stone-950 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500 rounded-full" 
                                                style={{ width: `${(item.area / stats.totalArea) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {stats.cropDistribution.length > 4 && (
                                    <button 
                                        onClick={() => setActiveTab('LAND')}
                                        className="w-full text-center text-[9px] font-black text-stone-500 uppercase tracking-widest pt-2 hover:text-emerald-500 transition-colors"
                                    >
                                        Tümünü Gör
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'LAND':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-stone-900/60 border border-white/5 rounded-[2rem] p-5">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Sprout size={16} className="text-emerald-500" />
                                    <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest">Ürün Dağılımı (da)</h3>
                                </div>
                                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    {stats.totalArea} da Toplam
                                </span>
                            </div>
                            
                            <div className="h-64 w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.cropDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="area"
                                            nameKey="crop"
                                        >
                                            {stats.cropDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                                {stats.cropDistribution.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-stone-950/50 rounded-xl border border-white/5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-stone-300 truncate">{item.crop}</p>
                                            <p className="text-[9px] text-stone-500">{item.area} da</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'CONSUMPTION':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-stone-900/60 border border-white/5 rounded-[2rem] p-5">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Zap size={16} className="text-amber-500" />
                                    <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest">İlaç Sarfiyatı (Adet)</h3>
                                </div>
                                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                    {consumptionData.reduce((acc, curr) => acc + curr.value, 0)} Toplam Adet
                                </span>
                            </div>
                            
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={consumptionData.slice(0, 8)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis 
                                            dataKey="name" 
                                            type="category" 
                                            width={100}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#737373', fontSize: 9, fontWeight: 700 }}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        />
                                        <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="space-y-2 mt-4">
                                {consumptionData.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-stone-950/50 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-[10px] font-black text-amber-500 border border-amber-500/20">
                                                {idx + 1}
                                            </div>
                                            <span className="text-[10px] font-bold text-stone-300">{item.name}</span>
                                        </div>
                                        <span className="text-xs font-black text-amber-500">{item.value} Adet</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'SALES':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-stone-900 p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                                <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Toplam Gelir</h3>
                                <p className="text-xl font-black text-emerald-400 font-mono mt-1">
                                    {salesData.totalRevenue.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                </p>
                            </div>
                            <div className="bg-stone-900 p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
                                <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Toplam Maliyet</h3>
                                <p className="text-xl font-black text-red-400 font-mono mt-1">
                                    {salesData.totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                </p>
                            </div>
                            <div className="bg-stone-900 p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
                                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-all ${salesData.totalProfit >= 0 ? 'bg-blue-500/10 group-hover:bg-blue-500/20' : 'bg-rose-500/10 group-hover:bg-rose-500/20'}`}></div>
                                <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Net Kar / Zarar</h3>
                                <div className="flex items-baseline gap-2">
                                    <p className={`text-xl font-black font-mono mt-1 ${salesData.totalProfit >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                        {salesData.totalProfit.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                    </p>
                                    <span className={`text-[10px] font-bold ${salesData.margin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        %{salesData.margin.toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-stone-900 p-6 rounded-2xl border border-white/5 shadow-sm">
                                <h3 className="text-stone-100 font-bold mb-6 flex items-center text-sm uppercase tracking-wider">
                                    <Activity size={16} className="mr-2 text-emerald-500"/> Aylık Satış Grafiği
                                </h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={salesData.monthlyChartData}>
                                            <defs>
                                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.3} />
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="#666" 
                                                tick={{fill: '#666', fontSize: 10}} 
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis 
                                                stroke="#666" 
                                                tick={{fill: '#666', fontSize: 10}} 
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${value / 1000}k`}
                                            />
                                            <Tooltip 
                                                contentStyle={{backgroundColor: '#1c1917', borderColor: '#333', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'}}
                                                itemStyle={{color: '#10b981', fontWeight: 'bold', fontFamily: 'monospace'}}
                                                formatter={(value: number) => [value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }), 'Tutar']}
                                                labelStyle={{color: '#9ca3af', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold'}}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="amount" 
                                                stroke="#10b981" 
                                                strokeWidth={3}
                                                fillOpacity={1} 
                                                fill="url(#colorSales)" 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-stone-900 p-6 rounded-2xl border border-white/5 shadow-sm">
                                <h3 className="text-stone-100 font-bold mb-6 flex items-center text-sm uppercase tracking-wider">
                                    <PieIcon size={16} className="mr-2 text-blue-500"/> En Çok Gelir Getiren Ürünler
                                </h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={salesData.productChartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} opacity={0.3} />
                                            <XAxis type="number" hide />
                                            <YAxis 
                                                dataKey="name" 
                                                type="category" 
                                                width={100}
                                                tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 500}}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip 
                                                cursor={{fill: '#ffffff05'}}
                                                contentStyle={{backgroundColor: '#1c1917', borderColor: '#333', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'}}
                                                formatter={(value: number) => [value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }), 'Tutar']}
                                                itemStyle={{color: '#3b82f6', fontWeight: 'bold', fontFamily: 'monospace'}}
                                                labelStyle={{color: '#9ca3af', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold'}}
                                            />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                                {salesData.productChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'DEBTS':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
                        <div className="bg-stone-900 p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-all"></div>
                            <div className="relative z-10">
                                <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-1">Toplam Tedarikçi Borcu</h3>
                                <p className="text-3xl font-black text-rose-400 font-mono">
                                    {Math.round(supplierDebtData.totalSupplierDebt).toLocaleString('tr-TR')}
                                </p>
                                <p className="text-[10px] text-stone-500 mt-2 font-medium">Toplam {supplierDebtData.debts.length} tedarikçiye borç bulunmaktadır.</p>
                            </div>
                        </div>

                        <div className="bg-stone-900 rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-4 border-b border-white/5 bg-stone-950/30">
                                <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest">Tedarikçi Bazlı Borç Dağılımı</h3>
                            </div>
                            <div className="divide-y divide-white/5">
                                {supplierDebtData.debts.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <p className="text-stone-500 text-xs font-medium">Şu an kayıtlı bir borç bulunmamaktadır.</p>
                                    </div>
                                ) : (
                                    supplierDebtData.debts.map((s: any, i: number) => (
                                        <div key={i} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-rose-500 font-bold text-xs">
                                                    {i + 1}
                                                </div>
                                                <span className="text-xs font-bold text-stone-200">{s.name}</span>
                                            </div>
                                            <span className="text-sm font-black text-rose-400 font-mono">
                                                {Math.round(s.debt).toLocaleString('tr-TR')}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'RECEIVABLES':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
                        <div className="bg-stone-900 p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                            <div className="relative z-10">
                                <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-1">Toplam Üretici Alacağı</h3>
                                <p className="text-3xl font-black text-emerald-400 font-mono">
                                    {Math.round(farmerReceivableData.totalFarmerReceivables).toLocaleString('tr-TR')}
                                </p>
                                <p className="text-[10px] text-stone-500 mt-2 font-medium">Toplam {farmerReceivableData.receivables.length} üreticiden alacak bulunmaktadır.</p>
                            </div>
                        </div>

                        <div className="bg-stone-900 rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-4 border-b border-white/5 bg-stone-950/30">
                                <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest">Üretici Bazlı Alacak Dağılımı</h3>
                            </div>
                            <div className="divide-y divide-white/5">
                                {farmerReceivableData.receivables.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <p className="text-stone-500 text-xs font-medium">Şu an kayıtlı bir alacak bulunmamaktadır.</p>
                                    </div>
                                ) : (
                                    farmerReceivableData.receivables.map((f: any, i: number) => (
                                        <div key={i} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-emerald-500 font-bold text-xs">
                                                    {i + 1}
                                                </div>
                                                <span className="text-xs font-bold text-stone-200">{f.name}</span>
                                            </div>
                                            <span className="text-sm font-black text-emerald-400 font-mono">
                                                {Math.round(f.amount).toLocaleString('tr-TR')}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="p-3 space-y-4 pb-32 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <header className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-lg font-black text-stone-100 tracking-tight flex items-center gap-2">
                        <TrendingUp className="text-emerald-500" size={20} />
                        İSTATİSTİKLER
                    </h2>
                    <p className="text-stone-500 text-[9px] font-bold uppercase tracking-widest">Veri Analizi & Raporlama</p>
                </div>
                <button 
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPdf}
                    className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                </button>
            </header>

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-stone-900/50 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                <TabButton 
                    active={activeTab === 'OVERVIEW'} 
                    onClick={() => setActiveTab('OVERVIEW')} 
                    icon={PieIcon} 
                    label="Genel" 
                />
                <TabButton 
                    active={activeTab === 'LAND'} 
                    onClick={() => setActiveTab('LAND')} 
                    icon={Sprout} 
                    label="Arazi" 
                />
                <TabButton 
                    active={activeTab === 'CONSUMPTION'} 
                    onClick={() => setActiveTab('CONSUMPTION')} 
                    icon={Zap} 
                    label="Sarfiyat" 
                />
                <TabButton 
                    active={activeTab === 'SALES'} 
                    onClick={() => setActiveTab('SALES')} 
                    icon={TrendingUp} 
                    label="Satışlar" 
                />
                <TabButton 
                    active={activeTab === 'DEBTS'} 
                    onClick={() => setActiveTab('DEBTS')} 
                    icon={Truck} 
                    label="Borçlar" 
                />
                <TabButton 
                    active={activeTab === 'RECEIVABLES'} 
                    onClick={() => setActiveTab('RECEIVABLES')} 
                    icon={DollarSign} 
                    label="Alacaklar" 
                />
            </div>

            {renderTabContent()}

            {/* Hidden Report View for PDF Generation */}
            <div className="fixed left-[-9999px] top-0 w-[210mm] bg-stone-950 p-10 text-stone-200 font-sans" ref={reportRef}>
                <div className="border-b border-white/10 pb-6 mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black text-emerald-500 mb-2 tracking-tighter">MKS ANALİTİK RAPORU</h1>
                        <p className="text-stone-500 text-xs font-bold uppercase tracking-[0.3em]">Dijital Tarım Yönetim Sistemi</p>
                    </div>
                    <div className="text-right">
                        <p className="text-stone-400 text-[10px] font-bold uppercase">Rapor Tarihi</p>
                        <p className="text-stone-100 font-mono text-sm">{new Date().toLocaleDateString('tr-TR')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-10">
                    <ReportStatBox label="Toplam Üretici" value={stats.totalFarmers} />
                    <ReportStatBox label="Toplam Arazi" value={`${stats.totalArea} da`} />
                    <ReportStatBox label="Aktif Görevler" value={stats.activeReminders} />
                </div>

                <div className="space-y-10">
                    <section>
                        <h3 className="text-emerald-500 font-black text-xs uppercase tracking-widest mb-4 border-l-2 border-emerald-500 pl-3">Ürün Dağılım Analizi</h3>
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="text-stone-500 border-b border-white/5">
                                    <th className="py-3 font-bold uppercase tracking-wider">Ürün Adı</th>
                                    <th className="py-3 font-bold uppercase tracking-wider text-right">Alan (da)</th>
                                    <th className="py-3 font-bold uppercase tracking-wider text-right">Yüzde</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.cropDistribution.map((item, i) => (
                                    <tr key={i} className="border-b border-white/5 text-stone-300">
                                        <td className="py-3 font-bold">{item.crop}</td>
                                        <td className="py-3 text-right font-mono">{item.area}</td>
                                        <td className="py-3 text-right font-mono">%{((item.area / stats.totalArea) * 100).toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <section>
                        <h3 className="text-emerald-500 font-black text-xs uppercase tracking-widest mb-4 border-l-2 border-emerald-500 pl-3">Bölgesel Dağılım</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {villageData.map((v, i) => (
                                <div key={i} className="flex justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <span className="text-stone-300 font-bold">{v.name}</span>
                                    <span className="text-emerald-400 font-mono">{v.value} Üretici</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h3 className="text-emerald-500 font-black text-xs uppercase tracking-widest mb-4 border-l-2 border-emerald-500 pl-3">İlaç Sarfiyat Analizi (Adet)</h3>
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="text-stone-500 border-b border-white/5">
                                    <th className="py-3 font-bold uppercase tracking-wider">İlaç Adı</th>
                                    <th className="py-3 font-bold uppercase tracking-wider text-right">Adet</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consumptionData.map((item, i) => (
                                    <tr key={i} className="border-b border-white/5 text-stone-300">
                                        <td className="py-3 font-bold">{item.name}</td>
                                        <td className="py-3 text-right font-mono">{item.value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </div>

                <div className="mt-20 pt-10 border-t border-white/5 text-center">
                    <p className="text-[10px] text-stone-600 font-black uppercase tracking-[0.5em]">MKS DIGITAL AGRICULTURE • GÜVENLİ VERİ ANALİZİ</p>
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button 
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-300 ${
            active 
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
            : 'text-stone-500 hover:text-stone-300'
        }`}
    >
        <Icon size={14} />
        <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </button>
);

const QuickStatCard = ({ title, value, icon: Icon, color, trend }: any) => {
    const colorClasses: any = {
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        red: 'text-red-500 bg-red-500/10 border-red-500/20',
    };

    return (
        <div className={`p-4 rounded-[1.8rem] border flex flex-col justify-between min-h-[100px] relative overflow-hidden group ${colorClasses[color]}`}>
            <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                <Icon size={64} />
            </div>
            <div className="flex justify-between items-start relative z-10">
                <div className="p-1.5 bg-white/10 rounded-lg">
                    <Icon size={14} />
                </div>
                {trend && <span className="text-[8px] font-black px-1.5 py-0.5 bg-white/10 rounded-full">{trend}</span>}
            </div>
            <div className="relative z-10">
                <p className="text-lg font-black text-stone-100 leading-none mb-1">{value}</p>
                <p className="text-[8px] font-bold uppercase tracking-widest text-stone-500">{title}</p>
            </div>
        </div>
    );
};

const ReportStatBox = ({ label, value }: any) => (
    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
        <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest mb-2">{label}</p>
        <p className="text-2xl font-black text-stone-100">{value}</p>
    </div>
);
