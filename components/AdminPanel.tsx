import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, Shield, Calendar, Search, Save, Loader2, Edit3, X, Trash2, KeyRound, ChevronRight, Mail, Clock, LogIn, Newspaper, Plus, Image as ImageIcon, FileText, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { UserProfile, News } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { ListSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

interface AdminPanelProps {
    onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
    const { getAllUsers, updateUserSubscription, deleteUser, sendPasswordReset, showToast, hapticFeedback, news, addNews, updateNews, deleteNews, refreshNews } = useAppViewModel();
    const [activeTab, setActiveTab] = useState<'USERS' | 'NEWS'>('USERS');
    const [users, setUsers] = useState<(UserProfile & { uid: string, email?: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<(UserProfile & { uid: string, email?: string }) | null>(null);
    const [editingNews, setEditingNews] = useState<Partial<News> | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncNews = async () => {
        setIsSyncing(true);
        hapticFeedback('medium');
        try {
            await refreshNews();
            showToast('Haberler senkronize edildi.', 'success');
            hapticFeedback('success');
        } catch (error) {
            showToast('Senkronizasyon başarısız oldu.', 'error');
            hapticFeedback('error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                showToast('Görsel boyutu 1MB\'dan küçük olmalıdır.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                if (editingNews) {
                    setEditingNews({ ...editingNews, imageUrl: reader.result as string });
                }
            };
            reader.readAsDataURL(file);
        }
    };
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
                email: editingUser.email,
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
        setConfirmModal({
            isOpen: true,
            title: 'Kullanıcı Silinecek',
            message: 'Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve kullanıcının sisteme erişimini kalıcı olarak kapatır.',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await deleteUser(uid);
                    showToast('Kullanıcı başarıyla silindi.', 'success');
                    setEditingUser(null);
                    loadUsers();
                } catch (error) {
                    showToast('Kullanıcı silinirken hata oluştu.', 'error');
                }
            }
        });
    };

    const handlePasswordReset = async (email?: string) => {
        if (!email) {
            showToast('Kullanıcının e-posta adresi bulunamadı.', 'error');
            return;
        }
        setConfirmModal({
            isOpen: true,
            title: 'Şifre Sıfırlama',
            message: `${email} adresine şifre sıfırlama bağlantısı gönderilecek. Onaylıyor musunuz?`,
            variant: 'info',
            onConfirm: async () => {
                try {
                    await sendPasswordReset(email);
                    showToast('Şifre sıfırlama e-postası gönderildi.', 'success');
                } catch (error) {
                    showToast('Şifre sıfırlama e-postası gönderilemedi.', 'error');
                }
            }
        });
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

    const handleSaveNews = async () => {
        if (!editingNews || !editingNews.title || !editingNews.content) {
            showToast('Lütfen başlık ve içerik girin.', 'error');
            return;
        }
        setIsSaving(true);
        hapticFeedback('medium');
        try {
            if (editingNews.id) {
                await updateNews(editingNews as News);
                showToast('Haber güncellendi.', 'success');
            } else {
                await addNews({
                    title: editingNews.title,
                    content: editingNews.content,
                    imageUrl: editingNews.imageUrl || '',
                    category: editingNews.category || 'Haber',
                    date: new Date().toISOString()
                });
                showToast('Haber yayınlandı.', 'success');
            }
            setEditingNews(null);
        } catch (error) {
            showToast('Haber kaydedilirken hata oluştu.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteNews = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Haber Silinecek',
            message: 'Bu haberi silmek istediğinize emin misiniz?',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await deleteNews(id);
                    showToast('Haber silindi.', 'success');
                } catch (error) {
                    showToast('Haber silinirken hata oluştu.', 'error');
                }
            }
        });
    };

    const filteredUsers = users.filter(u => 
        u.fullName?.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) || 
        u.email?.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))
    );

    const filteredNews = news.filter(n => 
        n.title.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) || 
        n.content.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))
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

            {/* Tabs */}
            <div className="flex bg-stone-900/50 p-1 rounded-2xl border border-white/5">
                <button 
                    onClick={() => setActiveTab('USERS')}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'USERS' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                >
                    <Users size={14} /> Kullanıcılar
                </button>
                <button 
                    onClick={() => setActiveTab('NEWS')}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'NEWS' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                >
                    <Newspaper size={14} /> Haberler
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                <input 
                    type="text"
                    placeholder={activeTab === 'USERS' ? "Kullanıcı Ara..." : "Haber Ara..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-stone-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-stone-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
            </div>

            {activeTab === 'NEWS' && (
                <div className="flex gap-2">
                    <button 
                        onClick={() => setEditingNews({ title: '', content: '', category: 'Haber', imageUrl: '' })}
                        className="flex-1 py-4 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600/20 transition-all active:scale-[0.98]"
                    >
                        <Plus size={20} /> Yeni Haber Oluştur
                    </button>
                    <button 
                        onClick={handleSyncNews}
                        disabled={isSyncing}
                        className="px-6 py-4 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                        Senkronize Et
                    </button>
                </div>
            )}

            {/* Content */}
            {activeTab === 'USERS' ? (
                isLoading ? (
                    <div className="space-y-3">
                        <ListSkeleton count={5} />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title="Kullanıcı bulunamadı"
                        description={searchTerm ? "Arama kriterlerinize uygun kullanıcı bulunamadı." : "Sistemde henüz kayıtlı kullanıcı yok."}
                    />
                ) : (
                    <div className="space-y-3">
                        {filteredUsers.map(user => {
                            const isExpired = new Date(user.subscriptionEndsAt || 0) < new Date();
                            return (
                                <div key={user.uid} 
                                    onClick={() => setEditingUser(user)}
                                    className="bg-stone-900/50 hover:bg-stone-800/80 border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-800 to-stone-900 border border-white/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-lg font-black text-stone-300">
                                            {user.fullName ? user.fullName.charAt(0).toUpperCase() : '?'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-white text-base truncate">{user.fullName || 'İsimsiz Kullanıcı'}</h3>
                                            {user.role === 'admin' && (
                                                <Shield size={12} className="text-purple-400 flex-shrink-0" />
                                            )}
                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded border bg-orange-500/10 border-orange-500/30 text-orange-400">
                                                BAYİ
                                            </span>
                                        </div>
                                        <p className="text-xs text-stone-400 truncate">{user.email || user.uid}</p>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                        <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                                            isExpired ? 'bg-red-500/10 text-red-400' : user.subscriptionStatus === 'trial' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-emerald-500/10 text-emerald-400'
                                        }`}>
                                            {isExpired ? 'SÜRESİ DOLDU' : user.subscriptionStatus === 'trial' ? 'DENEME' : 'AKTİF'}
                                        </div>
                                        <ChevronRight size={16} className="text-stone-600 group-hover:text-stone-300 transition-colors" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                <div className="space-y-3">
                    {filteredNews.length === 0 ? (
                        <EmptyState
                            icon={Newspaper}
                            title="Haber bulunamadı"
                            description={searchTerm ? "Arama kriterlerinize uygun haber bulunamadı." : "Henüz hiç haber yayınlanmamış."}
                        />
                    ) : (
                        filteredNews.map(item => (
                            <div key={item.id} 
                                className="bg-stone-900/50 border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-all"
                            >
                                <div className="flex gap-4 p-4">
                                    <div className="w-20 h-20 rounded-xl bg-stone-800 shrink-0 overflow-hidden border border-white/5">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-stone-700">
                                                <Newspaper size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black rounded uppercase tracking-widest border border-blue-500/20">
                                                {item.category || 'Haber'}
                                            </span>
                                            <span className="text-[9px] font-bold text-stone-500">
                                                {new Date(item.date).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-white text-sm truncate mb-1">{item.title}</h3>
                                        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{item.content}</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            onClick={() => setEditingNews(item)}
                                            className="p-2 bg-stone-800 text-stone-400 hover:text-white rounded-lg transition-colors"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteNews(item.id)}
                                            className="p-2 bg-stone-800 text-stone-400 hover:text-rose-400 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* User Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-md rounded-3xl border border-white/10 p-6 space-y-6 animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-white">Kullanıcı Düzenle</h2>
                            <button onClick={() => setEditingUser(null)} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                            {/* Read-only Info Cards */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-stone-950/50 border border-white/5 rounded-2xl p-3 flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 text-stone-500 mb-1">
                                        <Clock size={12} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Kayıt Tarihi</span>
                                    </div>
                                    <span className="text-xs font-medium text-stone-300">
                                        {editingUser.createdAt ? new Date(editingUser.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                                    </span>
                                </div>
                                <div className="bg-stone-950/50 border border-white/5 rounded-2xl p-3 flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 text-stone-500 mb-1">
                                        <LogIn size={12} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Son Giriş</span>
                                    </div>
                                    <span className="text-xs font-medium text-stone-300">
                                        {editingUser.lastLoginAt ? new Date(editingUser.lastLoginAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Giriş & İletişim Bilgileri</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                                    <input 
                                        type="email" 
                                        value={editingUser.email || ''}
                                        onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                                        placeholder="E-posta Adresi"
                                        className="w-full bg-stone-950 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
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
                            </div>

                            <div className="space-y-3 pt-2">
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Kurumsal Bilgiler</label>
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

            {/* News Edit Modal */}
            {editingNews && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-md rounded-3xl border border-white/10 p-6 space-y-6 animate-in slide-in-from-bottom-8">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-white">{editingNews.id ? 'Haberi Düzenle' : 'Yeni Haber'}</h2>
                            <button onClick={() => setEditingNews(null)} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Haber Başlığı</label>
                                <div className="relative">
                                    <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                                    <input 
                                        type="text" 
                                        value={editingNews.title || ''}
                                        onChange={(e) => setEditingNews({...editingNews, title: e.target.value})}
                                        placeholder="Haber Başlığı"
                                        className="w-full bg-stone-950 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Haber Görseli</label>
                                <div className="space-y-3">
                                    {editingNews.imageUrl && (
                                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-stone-950">
                                            <img 
                                                src={editingNews.imageUrl} 
                                                alt="Haber Görseli" 
                                                className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                            <button 
                                                onClick={() => setEditingNews({...editingNews, imageUrl: ''})}
                                                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center justify-center gap-2 py-3 bg-stone-800 border border-white/10 rounded-xl text-stone-300 hover:bg-stone-700 transition-colors text-xs font-bold"
                                        >
                                            <ImageIcon size={16} />
                                            Galeriden Seç
                                        </button>
                                        <div className="relative">
                                            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                                            <input 
                                                type="text" 
                                                value={editingNews.imageUrl?.startsWith('data:') ? '' : (editingNews.imageUrl || '')}
                                                onChange={(e) => setEditingNews({...editingNews, imageUrl: e.target.value})}
                                                placeholder="URL Yapıştır..."
                                                className="w-full h-full bg-stone-950 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-[10px] text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <p className="text-[10px] text-stone-600 italic">Öneri: 16:9 oranında ve 1MB altı görseller kullanın.</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Kategori</label>
                                <select 
                                    value={editingNews.category || 'Haber'}
                                    onChange={(e) => setEditingNews({...editingNews, category: e.target.value})}
                                    className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="Haber">Kurumsal Haber</option>
                                    <option value="Reklam">Reklam</option>
                                    <option value="Duyuru">Duyuru</option>
                                    <option value="Kampanya">Kampanya</option>
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest">Haber İçeriği</label>
                                <textarea 
                                    value={editingNews.content || ''}
                                    onChange={(e) => setEditingNews({...editingNews, content: e.target.value})}
                                    placeholder="Haber detaylarını buraya yazın..."
                                    rows={6}
                                    className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveNews}
                            disabled={isSaving}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-600/20"
                        >
                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            {isSaving ? 'Kaydediliyor...' : editingNews.id ? 'Güncelle' : 'Yayınla'}
                        </button>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
            />
        </div>
    );
};
