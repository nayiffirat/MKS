import React, { useState } from 'react';
import { Farmer } from '../types';
import { X, MessageCircle, Send, Search } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface DebtReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    farmersWithDebt: (Farmer & { overallBalance?: number })[];
    currency: 'TRY' | 'USD' | 'EUR';
    farmerLabel: string;
    engineerId: string;
}

export const DebtReminderModal: React.FC<DebtReminderModalProps> = ({ isOpen, onClose, farmersWithDebt, currency, farmerLabel, engineerId }) => {
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    // Filter farmers who have debt (overallBalance < 0)
    const debtors = farmersWithDebt
        .filter(f => (f.overallBalance || 0) < 0)
        .filter(f => f.fullName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) || f.village.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')))
        .sort((a, b) => (a.overallBalance || 0) - (b.overallBalance || 0)); // Sort by highest debt (most negative)

    const handleRemind = (farmer: Farmer & { overallBalance?: number }) => {
        const debtAmount = Math.abs(farmer.overallBalance || 0);
        const formattedDebt = formatCurrency(debtAmount, currency);
        
        const baseUrl = window.location.origin + window.location.pathname;
        const portalPath = baseUrl.endsWith('/') ? baseUrl + 'portal.html' : baseUrl.replace(/\/[^\/]*$/, '/portal.html');
        const url = new URL(portalPath);
        url.searchParams.set('portalId', farmer.id);
        url.searchParams.set('engineerId', engineerId);
        const portalUrl = url.toString();
        
        let text = `Sayın *${farmer.fullName}*,\n\n`;
        text += `Güncel hesap bakiyeniz *${formattedDebt}* borç bakiyesi vermektedir.\n\n`;
        text += `Detaylı hesap ekstrenizi, aldığınız ürünleri ve ödemelerinizi size özel ${farmerLabel.toLowerCase()} portalınızdan inceleyebilirsiniz:\n\n`;
        text += `🔗 *Portal Linkiniz:*\n${portalUrl}\n\n`;
        text += `İyi çalışmalar dileriz.`;
        
        const waUrl = `https://wa.me/${farmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 rounded-3xl w-full max-w-lg shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-950/50">
                    <h2 className="text-sm font-bold text-stone-100 flex items-center">
                        <MessageCircle className="mr-2 text-emerald-500" size={18}/> 
                        Toplu Borç Hatırlatma
                    </h2>
                    <button onClick={onClose} className="text-stone-500 hover:text-stone-300 p-1 bg-stone-800 rounded-full"><X size={16}/></button>
                </div>
                
                <div className="p-4 border-b border-white/5 bg-stone-900">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={14} />
                        <input 
                            type="text" 
                            placeholder={`${farmerLabel} ara...`}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-stone-950 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-stone-200 text-xs outline-none focus:border-emerald-500/50 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {debtors.length === 0 ? (
                        <div className="text-center py-10 text-stone-500 text-xs">
                            Borçlu {farmerLabel.toLowerCase()} bulunamadı.
                        </div>
                    ) : (
                        debtors.map(farmer => (
                            <div key={farmer.id} className="bg-stone-950/50 p-3 rounded-xl border border-white/5 flex items-center justify-between hover:bg-stone-900 transition-colors">
                                <div>
                                    <h3 className="font-bold text-stone-200 text-xs">{farmer.fullName}</h3>
                                    <p className="text-[10px] text-stone-500">{farmer.village} • {farmer.phoneNumber}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-xs font-black text-rose-500">
                                            {formatCurrency(Math.abs(farmer.overallBalance || 0), currency)}
                                        </div>
                                        <div className="text-[8px] text-stone-500 uppercase tracking-wider">Borç</div>
                                    </div>
                                    <button 
                                        onClick={() => handleRemind(farmer)}
                                        className="w-8 h-8 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all flex items-center justify-center border border-[#25D366]/20"
                                        title="WhatsApp'tan Hatırlat"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
