
import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Reminder } from '../types';
import { 
    Calendar, Plus, X, Trash2, CheckCircle2, Circle, 
    ArrowLeft, Bell, Repeat, Users, Search,
    ChevronDown, AlertCircle, Sparkles, Check, Edit2, Clock, CalendarClock, PlayCircle, MapPin, AlignLeft
} from 'lucide-react';

interface RemindersScreenProps {
    onBack: () => void;
    initialAddMode?: boolean;
    initialFilter?: 'ALL' | 'PENDING' | 'COMPLETED' | 'TOMORROW';
}

export const RemindersScreen: React.FC<RemindersScreenProps> = ({ onBack, initialAddMode, initialFilter }) => {
    const { reminders, addReminder, toggleReminder, deleteReminder, editReminder, farmers } = useAppViewModel();
    const [isAddModalOpen, setIsAddModalOpen] = useState(initialAddMode || false);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'TOMORROW'>(initialFilter || 'PENDING');

    // Detail View State
    const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newPriority, setNewPriority] = useState<Reminder['priority']>('MEDIUM');
    const [newRecurrence, setNewRecurrence] = useState<Reminder['recurrence']>('NONE');
    const [selectedFarmerIds, setSelectedFarmerIds] = useState<string[]>([]);
    
    // Farmer search inside modal
    const [farmerSearch, setFarmerSearch] = useState('');

    const TASK_PRESETS = [
        "Arazi Kontrolü", "İlaçlama", "Gübreleme", "Sulama", 
        "Çiftçi Ziyareti", "Telefon Araması", "Hasat Takibi", "Numune Alımı"
    ];

    const resetForm = () => {
        setEditingId(null);
        setNewTitle('');
        setNewDesc('');
        setNewDate(new Date().toISOString().split('T')[0]);
        setNewPriority('MEDIUM');
        setNewRecurrence('NONE');
        setSelectedFarmerIds([]);
        setFarmerSearch('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;

        try {
            if (editingId) {
                // Update existing reminder
                await editReminder(editingId, {
                    title: newTitle,
                    description: newDesc,
                    date: newDate,
                    priority: newPriority,
                    recurrence: newRecurrence,
                    farmerIds: selectedFarmerIds.length > 0 ? selectedFarmerIds : undefined
                });
            } else {
                // Create new reminder
                await addReminder({
                    title: newTitle,
                    description: newDesc,
                    date: newDate,
                    isCompleted: false,
                    priority: newPriority,
                    farmerIds: selectedFarmerIds.length > 0 ? selectedFarmerIds : undefined,
                    recurrence: newRecurrence
                });
            }
            setIsAddModalOpen(false);
            resetForm();
        } catch (error) {
            console.error("Reminder save error:", error);
            alert("Kayıt sırasında bir hata oluştu.");
        }
    };

    const handleEditClick = (reminder: Reminder) => {
        setEditingId(reminder.id);
        setNewTitle(reminder.title);
        setNewDesc(reminder.description || '');
        setNewDate(reminder.date);
        setNewPriority(reminder.priority);
        setNewRecurrence(reminder.recurrence);
        setSelectedFarmerIds(reminder.farmerIds || []);
        
        // Close detail view if open
        setSelectedReminder(null);
        // Open edit modal
        setIsAddModalOpen(true);
    };

    const toggleFarmerSelection = (id: string) => {
        setSelectedFarmerIds(prev => 
            prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
        );
    };

    const filteredReminders = reminders.filter(r => {
        if (filter === 'ALL') return true;
        if (filter === 'PENDING') return !r.isCompleted;
        if (filter === 'COMPLETED') return r.isCompleted;
        if (filter === 'TOMORROW') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            return r.date === tomorrowStr && !r.isCompleted;
        }
        return true;
    });

    const getPriorityColor = (p: Reminder['priority']) => {
        switch(p) {
            case 'HIGH': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            case 'MEDIUM': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'LOW': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        }
    };

    const isOverdue = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(dateStr) < today;
    };

    const getRecurrenceLabel = (r: Reminder['recurrence']) => {
        switch(r) {
            case 'DAILY': return 'Günlük';
            case 'WEEKLY': return 'Haftalık';
            case 'MONTHLY': return 'Aylık';
            default: return 'Tek Sefer';
        }
    };

    const getLinkedFarmers = (ids?: string[]) => {
        if (!ids || ids.length === 0) return [];
        return farmers.filter(f => ids.includes(f.id));
    };

    return (
        <div className="pb-32 animate-in fade-in duration-300 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-5 px-4 pt-2 sticky top-0 bg-stone-950/90 backdrop-blur-md z-20 py-3 border-b border-white/5">
                 <button onClick={onBack} className="group flex items-center text-stone-400 hover:text-stone-200 transition-all p-1">
                    <div className="p-1.5 bg-stone-900 rounded-lg mr-2.5 border border-white/5 group-active:scale-90 transition-transform">
                        <ArrowLeft size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-stone-100 tracking-tight">Zirai Takvim</h2>
                 </button>
                 <button 
                    onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                    className="p-2 bg-emerald-600 text-white rounded-xl shadow-[0_5px_15px_rgba(16,185,129,0.3)] active:scale-95 transition-all border border-emerald-500/30"
                 >
                    <Plus size={20} />
                 </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 mb-6">
                <div className="flex p-1 bg-stone-900/60 backdrop-blur-xl rounded-2xl border border-white/5 shadow-inner">
                    {(['PENDING', 'TOMORROW', 'COMPLETED', 'ALL'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all duration-300 flex items-center justify-center ${
                                filter === f 
                                ? 'bg-stone-100 text-stone-950 shadow-lg shadow-white/5 scale-[1.02]' 
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                        >
                            {f === 'TOMORROW' && <CalendarClock size={12} className="mr-1.5" />}
                            {f === 'PENDING' ? 'YAPILACAK' : f === 'COMPLETED' ? 'BİTEN' : f === 'TOMORROW' ? 'YARIN' : 'HEPSİ'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Reminders List */}
            <div className="px-4 space-y-3.5">
                {filteredReminders.length === 0 ? (
                    <div className="text-center py-24 bg-stone-900/20 rounded-[3rem] border border-dashed border-stone-800/50 mx-1">
                        <div className="w-16 h-16 bg-stone-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                            <Bell size={32} className="text-stone-700" />
                        </div>
                        <p className="text-stone-500 text-sm font-bold tracking-tight">
                            {filter === 'TOMORROW' ? 'Yarın için planlanmış bir görev yok.' : 'Henüz bir görev bulunmuyor.'}
                        </p>
                    </div>
                ) : (
                    filteredReminders.map(item => (
                        <div 
                            key={item.id}
                            className={`p-4 rounded-[2rem] border transition-all duration-500 relative overflow-hidden group ${
                                item.isCompleted 
                                ? 'bg-stone-950/40 border-stone-900 grayscale opacity-60' 
                                : 'bg-stone-900/80 backdrop-blur border-white/10 hover:border-emerald-500/30 shadow-xl'
                            }`}
                        >
                            <div className="flex items-start justify-between relative z-10">
                                <div className="shrink-0 pt-0.5">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleReminder(item.id); }}
                                        className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all active:scale-90 ${item.isCompleted ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-500' : 'bg-stone-800 border-white/10 text-stone-500 hover:border-emerald-500/50 shadow-inner'}`}
                                    >
                                        {item.isCompleted ? <Check size={20} strokeWidth={3} /> : <Circle size={20} />}
                                    </button>
                                </div>
                                
                                <div className="flex-1 ml-4 mr-2 min-w-0 cursor-pointer" onClick={() => setSelectedReminder(item)}>
                                    <div className="flex items-center gap-2 mb-1">
                                         <h4 className={`font-black text-stone-100 text-sm leading-tight truncate tracking-tight ${item.isCompleted ? 'line-through opacity-50' : ''}`}>
                                            {item.title}
                                         </h4>
                                         {!item.isCompleted && (
                                             <span className={`text-[8px] px-1.5 py-0.5 rounded-lg border font-black uppercase tracking-widest ${getPriorityColor(item.priority)}`}>
                                                {item.priority === 'HIGH' ? 'ACİL' : item.priority === 'MEDIUM' ? 'ORTA' : 'DÜŞÜK'}
                                             </span>
                                         )}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${!item.isCompleted && isOverdue(item.date) ? 'text-rose-400' : 'text-stone-500'}`}>
                                            <Calendar size={11} className="mr-1.5" />
                                            {new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                        </div>
                                        
                                        {item.recurrence !== 'NONE' && (
                                            <div className="flex items-center text-[10px] font-black text-blue-400/70 uppercase tracking-widest">
                                                <Repeat size={11} className="mr-1.5" />
                                                {getRecurrenceLabel(item.recurrence)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                    {/* Action Buttons */}
                                    {!item.isCompleted ? (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleReminder(item.id); }}
                                            className="flex items-center px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-xl border border-emerald-500/30 transition-all active:scale-95 shadow-sm group/btn"
                                        >
                                            <CheckCircle2 size={14} className="mr-2" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">BİTİR</span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center px-3 py-1.5 bg-stone-900 rounded-xl border border-white/5">
                                            <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">BİTTİ</span>
                                        </div>
                                    )}

                                    <div className="flex items-center space-x-2">
                                        {!item.isCompleted && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                                                className="p-2.5 text-stone-500 hover:text-stone-200 transition-all active:scale-90 bg-stone-800/50 rounded-xl hover:bg-stone-800 border border-white/5"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); if(confirm('Bu görevi silmek istediğinize emin misiniz?')) deleteReminder(item.id); }}
                                            className="p-2.5 text-stone-500 hover:text-rose-400 transition-all active:scale-90 bg-stone-800/50 rounded-xl hover:bg-rose-950/20 hover:border-rose-500/30 border border-white/5"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* DETAIL MODAL */}
            {selectedReminder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-stone-900 rounded-[2rem] w-full max-w-sm relative shadow-2xl border border-white/10 overflow-hidden flex flex-col">
                        <div className={`h-2 w-full ${selectedReminder.isCompleted ? 'bg-stone-600' : (selectedReminder.priority === 'HIGH' ? 'bg-rose-500' : selectedReminder.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500')}`}></div>
                        
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white leading-tight mb-1">{selectedReminder.title}</h3>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-black uppercase tracking-widest ${selectedReminder.isCompleted ? 'text-stone-400 border-stone-700 bg-stone-800' : getPriorityColor(selectedReminder.priority)}`}>
                                        {selectedReminder.isCompleted ? 'Tamamlandı' : (selectedReminder.priority === 'HIGH' ? 'Acil Öncelik' : selectedReminder.priority === 'MEDIUM' ? 'Orta Öncelik' : 'Düşük Öncelik')}
                                    </span>
                                </div>
                                <button onClick={() => setSelectedReminder(null)} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white"><X size={18}/></button>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div className="bg-stone-950/50 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center text-stone-400 text-xs font-bold mb-1">
                                        <Calendar size={14} className="mr-2 text-emerald-500"/> Tarih
                                    </div>
                                    <p className="text-stone-200 text-sm font-medium pl-6">
                                        {new Date(selectedReminder.date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>

                                {selectedReminder.description && (
                                    <div className="bg-stone-950/50 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center text-stone-400 text-xs font-bold mb-1">
                                            <AlignLeft size={14} className="mr-2 text-blue-400"/> Açıklama
                                        </div>
                                        <p className="text-stone-300 text-xs leading-relaxed pl-6 whitespace-pre-wrap">
                                            {selectedReminder.description}
                                        </p>
                                    </div>
                                )}

                                {selectedReminder.farmerIds && selectedReminder.farmerIds.length > 0 && (
                                    <div className="bg-stone-950/50 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center text-stone-400 text-xs font-bold mb-2">
                                            <Users size={14} className="mr-2 text-amber-500"/> İlgili Çiftçiler
                                        </div>
                                        <div className="pl-6 space-y-1.5">
                                            {getLinkedFarmers(selectedReminder.farmerIds).map(f => (
                                                <div key={f.id} className="flex items-center justify-between text-xs text-stone-300">
                                                    <span>{f.fullName}</span>
                                                    <span className="text-[9px] text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded flex items-center">
                                                        <MapPin size={8} className="mr-1"/> {f.village}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => { toggleReminder(selectedReminder.id); setSelectedReminder(null); }}
                                    className={`col-span-2 py-3 rounded-xl font-bold text-xs flex items-center justify-center shadow-lg active:scale-95 transition-all ${selectedReminder.isCompleted ? 'bg-stone-800 text-stone-300 border border-white/5' : 'bg-emerald-600 text-white'}`}
                                >
                                    {selectedReminder.isCompleted ? <Circle size={16} className="mr-2"/> : <CheckCircle2 size={16} className="mr-2"/>}
                                    {selectedReminder.isCompleted ? 'Tamamlanmadı Olarak İşaretle' : 'Görevi Tamamla'}
                                </button>
                                
                                <button 
                                    onClick={() => handleEditClick(selectedReminder)}
                                    className="py-3 rounded-xl bg-stone-800 text-stone-300 font-bold text-xs flex items-center justify-center border border-white/5 hover:bg-stone-700 active:scale-95 transition-all"
                                >
                                    <Edit2 size={14} className="mr-2"/> Düzenle
                                </button>
                                <button 
                                    onClick={() => { if(confirm('Silmek istediğinize emin misiniz?')) { deleteReminder(selectedReminder.id); setSelectedReminder(null); } }}
                                    className="py-3 rounded-xl bg-rose-900/20 text-rose-400 font-bold text-xs flex items-center justify-center border border-rose-500/20 hover:bg-rose-900/40 active:scale-95 transition-all"
                                >
                                    <Trash2 size={14} className="mr-2"/> Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD/EDIT MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-stone-950 z-[200] flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="flex flex-col h-full relative">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center px-4 py-3 border-b border-white/5 shrink-0 bg-stone-900/80 backdrop-blur-xl">
                            <div>
                                <h3 className="text-base font-bold text-stone-100 tracking-tight">
                                    {editingId ? 'Görevi Düzenle' : 'Yeni Saha Planı'}
                                </h3>
                                <p className="text-[8px] text-stone-500 font-black uppercase tracking-[0.2em] mt-0.5">MKS Akıllı Ajanda</p>
                            </div>
                            <button 
                                onClick={() => setIsAddModalOpen(false)} 
                                className="p-2 bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-all active:scale-90"
                            >
                                <X size={18}/>
                            </button>
                        </div>

                        {/* Scrollable Form Content */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-4 py-5 space-y-5 no-scrollbar pb-48">
                            
                            {/* Title & Presets */}
                            <div className="space-y-2">
                                <label className="flex items-center text-[9px] font-black text-stone-500 uppercase tracking-widest ml-1">
                                    <Sparkles size={10} className="mr-1.5 text-emerald-500" /> Görev Başlığı
                                </label>
                                <input 
                                    required
                                    type="text" 
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    className="w-full bg-stone-900 border border-white/5 rounded-xl p-3 text-stone-100 outline-none focus:border-emerald-500/40 transition-all placeholder-stone-800 text-sm font-bold"
                                    placeholder="Örn: Mısır Tarlası İlaçlama"
                                />
                                {/* Quick Task Chips */}
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {TASK_PRESETS.map(preset => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setNewTitle(preset)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-95 ${
                                                newTitle === preset 
                                                ? 'bg-emerald-600 text-white border-emerald-500'
                                                : 'bg-stone-900/60 text-stone-500 border-white/5 hover:bg-stone-800 hover:text-stone-300'
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Date & Recurrence Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="group space-y-2">
                                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-1 block">Tarih Seçimi</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">
                                            <Calendar size={18} />
                                        </div>
                                        <input 
                                            required
                                            type="date" 
                                            value={newDate}
                                            onChange={e => setNewDate(e.target.value)}
                                            className="w-full bg-stone-950/50 border border-stone-800 rounded-2xl h-14 pl-12 pr-4 text-sm font-bold text-stone-200 outline-none focus:border-emerald-500/50 focus:bg-stone-900 transition-all appearance-none shadow-sm uppercase tracking-wide"
                                        />
                                    </div>
                                </div>
                                <div className="group space-y-2">
                                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-1 block">Tekrar Düzeni</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none">
                                            <Repeat size={18} />
                                        </div>
                                        <select 
                                            value={newRecurrence}
                                            onChange={e => setNewRecurrence(e.target.value as any)}
                                            className="w-full bg-stone-950/50 border border-stone-800 rounded-2xl h-14 pl-12 pr-10 text-sm font-bold text-stone-200 outline-none focus:border-emerald-500/50 focus:bg-stone-900 transition-all appearance-none shadow-sm"
                                        >
                                            <option value="NONE">Tek Sefer</option>
                                            <option value="DAILY">Her Gün</option>
                                            <option value="WEEKLY">Haftalık</option>
                                            <option value="MONTHLY">Aylık</option>
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Priority Selection */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-1 block">Önem Derecesi</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['LOW', 'MEDIUM', 'HIGH'] as const).map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setNewPriority(p)}
                                            className={`py-3 rounded-xl text-[9px] font-black border transition-all duration-300 active:scale-95 flex flex-col items-center justify-center gap-1.5 ${
                                                newPriority === p 
                                                ? (p === 'HIGH' ? 'bg-rose-600 text-white border-rose-500 shadow-lg' : p === 'MEDIUM' ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-lg' : 'bg-emerald-600 text-white border-emerald-500 shadow-lg')
                                                : 'bg-stone-900/50 text-stone-600 border-white/5 hover:bg-stone-900'
                                            }`}
                                        >
                                            {p === 'HIGH' && <AlertCircle size={12} />}
                                            <span>{p === 'HIGH' ? 'ACİL' : p === 'MEDIUM' ? 'ORTA' : 'DÜŞÜK'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Linked Farmers */}
                            <div className="bg-stone-900/40 p-3 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-3 px-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center">
                                        <Users size={12} className="mr-1.5 text-emerald-500" /> 
                                        Çiftçiler ({selectedFarmerIds.length})
                                    </label>
                                    {selectedFarmerIds.length > 0 && (
                                        <button type="button" onClick={() => setSelectedFarmerIds([])} className="text-[8px] font-black text-rose-500 uppercase">Temizle</button>
                                    )}
                                </div>
                                
                                <div className="relative mb-3">
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-600" />
                                    <input 
                                        type="text" 
                                        value={farmerSearch}
                                        onChange={e => setFarmerSearch(e.target.value)}
                                        placeholder="Ara..."
                                        className="w-full bg-stone-950 border border-stone-800 rounded-lg py-2 pl-8 pr-2 text-[10px] text-stone-200 outline-none focus:border-emerald-500/40 placeholder-stone-700"
                                    />
                                </div>

                                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 no-scrollbar">
                                    {farmers
                                        .filter(f => f.fullName.toLowerCase().includes(farmerSearch.toLowerCase()))
                                        .map(f => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => toggleFarmerSelection(f.id)}
                                            className={`w-full flex items-center justify-between p-2 rounded-lg transition-all duration-300 ${
                                                selectedFarmerIds.includes(f.id) 
                                                ? 'bg-emerald-600 text-white border-emerald-500' 
                                                : 'bg-stone-900/50 border border-stone-800 text-stone-500'
                                            }`}
                                        >
                                            <span className="text-[11px] font-bold">{f.fullName}</span>
                                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${selectedFarmerIds.includes(f.id) ? 'bg-white border-white' : 'border-stone-800'}`}>
                                                {selectedFarmerIds.includes(f.id) && <Check size={8} className="text-emerald-600" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Additional Description */}
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-1 block">Notlar</label>
                                <textarea 
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    className="w-full bg-stone-900 border border-white/5 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500/40 transition-all h-20 resize-none placeholder-stone-800 text-[12px] font-medium"
                                    placeholder="Görevin detaylarını buraya not edin..."
                                />
                            </div>
                        </form>

                        {/* Bottom Sticky Action Panel */}
                        <div className="mt-auto bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent pt-12 pb-10 px-4 z-50">
                            <button 
                                onClick={handleSave}
                                disabled={!newTitle.trim()}
                                className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-black shadow-[0_15px_30px_rgba(16,185,129,0.3)] hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center border border-emerald-400/20 text-xs uppercase tracking-widest disabled:opacity-50 disabled:grayscale"
                            >
                                <Check size={18} className="mr-2" /> {editingId ? 'Güncelle' : 'Görevi Kaydet'}
                            </button>
                            <div className="h-[calc(env(safe-area-inset-bottom)+50px)]"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
