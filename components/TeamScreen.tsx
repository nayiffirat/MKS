import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { TeamMember, TeamRole } from '../types';
import { Plus, Trash2, Edit2, Shield, User as UserIcon, Lock, Mail, ChevronLeft, Save, X } from 'lucide-react';

export const TeamScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { teamMembers, addTeamMember, updateTeamMember, deleteTeamMember, userProfile, updateUserProfile } = useAppViewModel();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<TeamMember>>({
        fullName: '',
        username: '',
        password: '',
        role: 'SALES',
        notes: ''
    });

    const handleSave = async () => {
        if (!formData.fullName || !formData.username || !formData.password || !formData.role) return;

        if (editingId === 'admin') {
            updateUserProfile({
                ...userProfile,
                fullName: formData.fullName,
                adminUsername: formData.username,
                adminPassword: formData.password
            });
        } else if (editingId) {
            await updateTeamMember({ ...formData, id: editingId } as TeamMember);
        } else {
            await addTeamMember(formData as Omit<TeamMember, 'id' | 'createdAt'>);
        }

        setIsAdding(false);
        setEditingId(null);
        setFormData({ fullName: '', username: '', password: '', role: 'SALES', notes: '' });
    };

    const handleEdit = (member: TeamMember) => {
        setFormData(member);
        setEditingId(member.id);
        setIsAdding(true);
    };

    const handleEditAdmin = () => {
        setFormData({
            fullName: userProfile.fullName || 'Yönetici',
            username: userProfile.adminUsername || 'admin',
            password: userProfile.adminPassword || 'admin',
            role: 'MANAGER',
            notes: 'Ana yönetici hesabı'
        });
        setEditingId('admin');
        setIsAdding(true);
    };

    const roleLabels: Record<TeamRole, string> = {
        'SALES': 'Satış Elemanı',
        'ACCOUNTING': 'Muhasebe',
        'WAREHOUSE': 'Depo',
        'MANAGER': 'Yönetici'
    };

    return (
        <div className="p-4 max-w-4xl mx-auto pb-24">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-stone-900 rounded-xl text-stone-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Ekibim</h1>
                        <p className="text-stone-400 text-sm">Personel ve yetki yönetimi</p>
                    </div>
                </div>
                {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Yeni Personel</span>
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-stone-900 rounded-2xl p-6 mb-6 border border-stone-800 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-white">{editingId ? 'Personel Düzenle' : 'Yeni Personel Ekle'}</h2>
                        <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-stone-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-medium text-stone-400 mb-1">Ad Soyad</label>
                            <input 
                                type="text" 
                                value={formData.fullName} 
                                onChange={e => setFormData({...formData, fullName: e.target.value})}
                                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-stone-400 mb-1">Kullanıcı Adı</label>
                            <input 
                                type="text" 
                                value={formData.username} 
                                onChange={e => setFormData({...formData, username: e.target.value})}
                                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-stone-400 mb-1">Şifre</label>
                            <input 
                                type="text" 
                                value={formData.password} 
                                onChange={e => setFormData({...formData, password: e.target.value})}
                                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-stone-400 mb-1">Rol</label>
                            <select 
                                value={formData.role} 
                                onChange={e => setFormData({...formData, role: e.target.value as TeamRole})}
                                disabled={editingId === 'admin'}
                                className={`w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none ${editingId === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <option value="SALES">Satış Elemanı</option>
                                <option value="ACCOUNTING">Muhasebe</option>
                                <option value="WAREHOUSE">Depo</option>
                                <option value="MANAGER">Yönetici</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-stone-400 mb-1">Yönetici Notları (Sadece yöneticiler görebilir)</label>
                            <textarea 
                                value={formData.notes || ''} 
                                onChange={e => setFormData({...formData, notes: e.target.value})}
                                disabled={editingId === 'admin'}
                                className={`w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none min-h-[80px] ${editingId === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholder="Personel hakkında notlar..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button 
                            onClick={handleSave}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
                        >
                            <Save size={18} />
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Admin Card */}
                <div className="bg-gradient-to-br from-emerald-900/20 to-stone-900 rounded-2xl p-5 border border-emerald-500/30 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Shield size={80} />
                    </div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20">
                                {(userProfile.fullName || 'Y').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-white font-medium flex items-center gap-2">
                                    {userProfile.fullName || 'Yönetici'}
                                    <Shield size={14} className="text-emerald-500" />
                                </h3>
                                <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                                    Ana Yönetici
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleEditAdmin} className="p-1.5 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors">
                                <Edit2 size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2 mt-auto pt-4 border-t border-emerald-500/20 relative z-10">
                        <div className="flex items-center gap-2 text-sm text-stone-300">
                            <UserIcon size={14} className="text-emerald-500" />
                            <span>{userProfile.adminUsername || 'admin'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-stone-300">
                            <Lock size={14} className="text-emerald-500" />
                            <span>••••••••</span>
                        </div>
                    </div>
                </div>

                {teamMembers.map(member => (
                    <div key={member.id} className="bg-stone-900 rounded-2xl p-5 border border-stone-800 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold">
                                    {member.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">{member.fullName}</h3>
                                    <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                        {roleLabels[member.role]}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(member)} className="p-1.5 text-stone-400 hover:text-white bg-stone-800 rounded-lg transition-colors">
                                    <Edit2 size={14} />
                                </button>
                                <button onClick={() => deleteTeamMember(member.id)} className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2 mt-auto pt-4 border-t border-stone-800">
                            <div className="flex items-center gap-2 text-sm text-stone-400">
                                <UserIcon size={14} />
                                <span>{member.username}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-stone-400">
                                <Lock size={14} />
                                <span>••••••••</span>
                            </div>
                            {member.notes && (
                                <div className="mt-3 p-3 bg-stone-950 rounded-xl border border-stone-800">
                                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Yönetici Notu</div>
                                    <p className="text-xs text-stone-400 leading-relaxed">{member.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {teamMembers.length === 0 && !isAdding && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-stone-800 rounded-2xl">
                        <Shield className="mx-auto h-12 w-12 text-stone-600 mb-3" />
                        <h3 className="text-lg font-medium text-stone-300">Henüz personel eklenmemiş</h3>
                        <p className="text-stone-500 mt-1">Ekibinizi oluşturmak için yeni personel ekleyin.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
