import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, Shield, Calendar, Search, Save, Loader2, Edit3, X, Trash2, KeyRound } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { UserProfile } from '../types';

interface AdminPanelProps {
    onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
    const { getAllUsers, updateUserSubscription, deleteUser, sendPasswordReset, showToast, hapticFeedback } = useAppViewModel();
    const [users, setUsers] = useState<(UserProfile & { uid: string, email?: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<(UserProfile & { uid: string, email?: string }) | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const data = await getAllUsers();
            setUsers(data);
        } catch (error) {
            showToast('Kullanıcılar yüklenirken hata oluştu.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editingUser) return;
        setIsSaving(true);
        hapticFeedback('medium');
        try {
            await updateUserSubscription(editingUser.uid, {
                fullName: editingUser.fullName,
                phoneNumber: editingUser.phoneNumber,
                companyName: editingUser.companyName,
                title: editingUser.title,
                role: editingUser.role,
                subscriptionStatus: editingUser.subscriptionStatus,
                subscriptionEndsAt: editingUser.subscriptionEndsAt
            });
            showToast('Kullanıcı güncellendi.', 'success');
            hapticFeedback('success');
            setEditingUser(null);
            loadUsers();
        } catch (error) {
            showToast('Güncelleme başarısız oldu.', 'error');
            hapticFeedback('error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async (uid: string) => {
        if (window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve kullanıcının sisteme erişimini kalıcı olarak kapatır.')) {
            try {
                await deleteUser(uid);
                showToast('Kullanıcı başarıyla silindi.', 'success');
                setEditingUser(null);
                loadUsers();
            } catch (error) {
                showToast('Kullanıcı silinirken hata oluştu.', 'error');
            }
        }
    };

    const handlePasswordReset = async (email?: string) => {
        if (!email) {
            showToast('Kullanıcının e-posta adresi bulunamadı.', 'error');
            return;
        }
        if (window.confirm(`${email} adresine şifre sıfırlama bağlantısı gönderilecek. Onaylıyor musunuz?`)) {
            try {
                await sendPasswordReset(email);
                showToast('Şifre sıfırlama e-postası gönderildi.', 'success');
            } catch (error) {
                showToast('Şifre sıfırlama e-postası gönderilemedi.', 'error');
            }
        }
    };

    const extendSubscription = (months: number) => {
        if (!editingUser) return;
        const currentEnd = new Date(editingUser.subscriptionEndsAt || Date.now());
        const newEnd = new Date(currentEnd.setMonth(currentEnd.getMonth() + months));
        setEditingUser({
            ...editingUser,
            subscriptionEndsAt: newEnd.toISOString(),
            subscriptionStatus: 'active'
        });
    };

    const filteredUsers = users.filter(u => 
        u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 space-y-4 pb-24 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6">
                <button 
                    onClick={onBack}
                    className="p-2 bg-stone-900 border border-white/10 rounded-xl text-stone-400 hover:text-white transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black text-stone-100">Yönetim Paneli</h1>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Sistem ve Kullanıcı Kontrolü</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                <input 
                    type="text"
                    placeholder="Kullanıcı Ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
            </div>

            {/* Users List */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                    <Loader2 size={32} className="animate-spin mb-4 text-emerald-500" />
                    <p className="font-bold">Kullanıcılar Yükleniyor...</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredUsers.map(user => {
                        const isExpired = new Date(user.subscriptionEndsAt || 0) < new Date();
                        return (
                            <div key={user.uid} className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{user.fullName || 'İsimsiz Kullanıcı'}</h3>
                                        <p className="text-xs text-stone-500">{user.uid}</p>
                                    </div>
                                    <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                                        user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-stone-800 text-stone-400'
                                    }`}>
                                        {user.role === 'admin' ? 'ADMİN' : 'KULLANICI'}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${
                                            isExpired ? 'bg-red-500' : user.subscriptionStatus === 'trial' ? 'bg-yellow-500' : 'bg-emerald-500'
                                        }`} />
                                        <span className={isExpired ? 'text-red-400' : 'text-stone-300'}>
                                            {isExpired ? 'Süresi Doldu' : user.subscriptionStatus === 'trial' ? 'Deneme Sürümü' : 'Aktif'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-stone-400">
                                        <Calendar size={14} />
                                        <span>{new Date(user.subscriptionEndsAt || 0).toLocaleDateString('tr-TR')}</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setEditingUser(user)}
                                    className="w-full py-2.5 mt-2 bg-stone-800 text-stone-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-700 transition-colors"
                                >
                                    <Edit3 size={16} />
                                    Düzenle
                                </button>
                            </div>
                        );
                    })}
                    {filteredUsers.length === 0 && (
                        <div className="text-center py-12 text-stone-500 font-bold">
                            Kullanıcı bulunamadı.
                        </div>
                    )}
                </div>
            )}

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-md rounded-3xl border border-white/10 p-6 space-y-6 animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-white">Kullanıcı Düzenle</h2>
                            <button onClick={() => setEditingUser(null)} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Kullanıcı Bilgileri</label>
                                <input 
                                    type="text" 
                                    value={editingUser.fullName || ''}
                                    onChange={(e) => setEditingUser({...editingUser, fullName: e.target.value})}
                                    placeholder="Ad Soyad"
                                    className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                />
                                <input 
                                    type="text" 
                                    value={editingUser.phoneNumber || ''}
                                    onChange={(e) => setEditingUser({...editingUser, phoneNumber: e.target.value})}
                                    placeholder="Telefon"
                                    className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                />
                                <input 
                                    type="text" 
                                    value={editingUser.companyName || ''}
                                    onChange={(e) => setEditingUser({...editingUser, companyName: e.target.value})}
                                    placeholder="Firma Adı"
                                    className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                />
                                <input 
                                    type="text" 
                                    value={editingUser.title || ''}
                                    onChange={(e) => setEditingUser({...editingUser, title: e.target.value})}
                                    placeholder="Ünvan"
                                    className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="pt-2 border-t border-white/10">
                                <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-widest">Kullanıcı Rolü</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setEditingUser({...editingUser, role: 'user'})}
                                        className={`py-3 rounded-xl font-bold text-sm border ${editingUser.role === 'user' ? 'bg-stone-800 border-stone-500 text-white' : 'bg-stone-900 border-white/10 text-stone-500'}`}
                                    >
                                        Kullanıcı
                                    </button>
                                    <button 
                                        onClick={() => setEditingUser({...editingUser, role: 'admin'})}
                                        className={`py-3 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 ${editingUser.role === 'admin' ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'bg-stone-900 border-white/10 text-stone-500'}`}
                                    >
                                        <Shield size={16} /> Admin
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-widest">Abonelik Durumu</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button 
                                        onClick={() => setEditingUser({...editingUser, subscriptionStatus: 'trial'})}
                                        className={`py-2 rounded-xl font-bold text-xs border ${editingUser.subscriptionStatus === 'trial' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-500' : 'bg-stone-900 border-white/10 text-stone-500'}`}
                                    >
                                        Deneme
                                    </button>
                                    <button 
                                        onClick={() => setEditingUser({...editingUser, subscriptionStatus: 'active'})}
                                        className={`py-2 rounded-xl font-bold text-xs border ${editingUser.subscriptionStatus === 'active' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-500' : 'bg-stone-900 border-white/10 text-stone-500'}`}
                                    >
                                        Aktif
                                    </button>
                                    <button 
                                        onClick={() => setEditingUser({...editingUser, subscriptionStatus: 'expired'})}
                                        className={`py-2 rounded-xl font-bold text-xs border ${editingUser.subscriptionStatus === 'expired' ? 'bg-red-900/30 border-red-500 text-red-500' : 'bg-stone-900 border-white/10 text-stone-500'}`}
                                    >
                                        Süresi Doldu
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-widest">Bitiş Tarihi</label>
                                <input 
                                    type="datetime-local" 
                                    value={editingUser.subscriptionEndsAt ? new Date(editingUser.subscriptionEndsAt).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => setEditingUser({...editingUser, subscriptionEndsAt: new Date(e.target.value).toISOString()})}
                                    className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                />
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <button onClick={() => extendSubscription(1)} className="py-2 bg-stone-800 rounded-lg text-xs font-bold text-stone-300 hover:bg-stone-700">+1 Ay</button>
                                    <button onClick={() => extendSubscription(6)} className="py-2 bg-stone-800 rounded-lg text-xs font-bold text-stone-300 hover:bg-stone-700">+6 Ay</button>
                                    <button onClick={() => extendSubscription(12)} className="py-2 bg-stone-800 rounded-lg text-xs font-bold text-stone-300 hover:bg-stone-700">+1 Yıl</button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                            </button>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => handlePasswordReset(editingUser.email)}
                                    className="w-full py-3 bg-stone-800 text-stone-300 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stone-700 transition-colors"
                                >
                                    <KeyRound size={16} />
                                    Şifre Sıfırla
                                </button>
                                <button 
                                    onClick={() => handleDeleteUser(editingUser.uid)}
                                    className="w-full py-3 bg-red-900/20 text-red-500 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-900/40 transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Kullanıcıyı Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
