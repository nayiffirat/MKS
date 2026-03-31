import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Lock, User as UserIcon, Loader2, AlertCircle, LogOut } from 'lucide-react';

export const TeamLoginScreen: React.FC = () => {
    const { teamMembers, setActiveTeamMember, userProfile } = useAppViewModel();
    const { logout } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // Check if it's the main admin bypass
            const adminUser = userProfile.adminUsername || 'admin';
            const adminPass = userProfile.adminPassword || 'admin';
            
            if (username === adminUser && password === adminPass) {
                // Create a temporary admin member for the session if they just want to manage
                setActiveTeamMember({
                    id: 'admin-bypass',
                    fullName: userProfile.fullName || 'Yönetici',
                    username: adminUser,
                    password: '',
                    role: 'MANAGER',
                    createdAt: new Date().toISOString()
                }, true);
                return;
            }

            const member = teamMembers.find(m => m.username === username && m.password === password);
            if (member) {
                setActiveTeamMember(member, true);
            } else {
                setError('Kullanıcı adı veya şifre hatalı.');
            }
        } catch (err) {
            setError('Bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-6 relative overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-[340px] relative z-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-stone-100 tracking-tight mb-1">{userProfile.companyName || 'Firma'} Girişi</h1>
                    <span className="font-bold text-emerald-500 uppercase tracking-[0.2em] text-[9px]">Personel Girişi</span>
                </div>

                <div className="bg-stone-900/40 backdrop-blur-2xl rounded-[2.2rem] p-6 border border-white/5 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative group">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                            <input 
                                type="text" 
                                required 
                                value={username} 
                                onChange={e => setUsername(e.target.value)} 
                                placeholder="Kullanıcı Adı" 
                                className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700" 
                            />
                        </div>
                        
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                            <input 
                                type="password" 
                                required 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                placeholder="Şifre" 
                                className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700" 
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center mt-2"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Giriş Yap'}
                        </button>
                    </form>

                    {error && (
                        <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[9px] text-center font-bold flex items-center justify-center gap-2 animate-in slide-in-from-bottom-1">
                            <AlertCircle size={10} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={logout}
                    className="mt-6 mx-auto flex items-center gap-2 text-stone-500 hover:text-stone-300 text-xs font-medium transition-colors"
                >
                    <LogOut size={14} />
                    <span>Farklı Bir Hesapla Giriş Yap</span>
                </button>
            </div>
        </div>
    );
};
