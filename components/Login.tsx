
import React, { useState, useEffect, useRef } from 'react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    User,
    updateProfile,
    setPersistence, 
    browserLocalPersistence 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { safeStringify } from '../utils/json';
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff, User as UserIcon, Sparkles, Phone, ChevronRight, MessageCircle, Globe } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { Language } from '../types';

export const LoginScreen: React.FC = () => {
    const { language, setLanguage, t } = useAppViewModel();
    // Modes
    const [viewMode, setViewMode] = useState<'LOGIN' | 'REGISTER' | 'RESET'>('LOGIN');

    // Email/Pass Inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // Profile Inputs
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('+90 ');
    const [companyName, setCompanyName] = useState('');
    const [title, setTitle] = useState('');

    // States
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        auth.useDeviceLanguage(); // Türkçe dil desteği
    }, []);

    const syncUserToFirestore = async (user: User, additionalData?: any) => {
        try {
            const userRef = doc(db, "MKS", "g892bEaJyGfEq1Fa67yb", "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email || '',
                    fullName: additionalData?.fullName || user.displayName || 'İsimsiz Kullanıcı',
                    phoneNumber: additionalData?.phoneNumber || user.phoneNumber || '',
                    companyName: additionalData?.companyName || '',
                    title: additionalData?.title || '',
                    role: additionalData?.role || 'user',
                    subscriptionStatus: additionalData?.subscriptionStatus || 'active',
                    subscriptionEndsAt: additionalData?.subscriptionEndsAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    photoURL: user.photoURL || ''
                });
            } else {
                await setDoc(userRef, { lastLogin: new Date().toISOString() }, { merge: true });
            }
        } catch (err) {
            console.error("Firestore sync error:", err);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setIsLoading(true);
        setError(null);
        
        try {
            // Set persistence to local by default for automatic login
            await setPersistence(auth, browserLocalPersistence);

            if (viewMode === 'REGISTER') {
                if (!fullName) {
                    setError("Ad Soyad zorunludur.");
                    setIsLoading(false);
                    return;
                }
                
                // Pre-populate localStorage to avoid race condition with App.tsx's getUserProfile
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 7);
                const tempProfile = {
                    fullName,
                    phoneNumber,
                    companyName,
                    title,
                    role: 'user',
                    subscriptionStatus: 'trial',
                    subscriptionEndsAt: endDate.toISOString()
                };
                localStorage.setItem('mks_user_profile', safeStringify(tempProfile));
                localStorage.setItem('mks_show_welcome', 'true');

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: fullName });
                await syncUserToFirestore(userCredential.user, tempProfile);
            } else {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                await syncUserToFirestore(userCredential.user);
            }
            setIsSuccess(true);
        } catch (err: any) {
            if (viewMode === 'REGISTER') {
                localStorage.removeItem('mks_user_profile');
            }
            setError(translateFirebaseError(err.code));
            setIsLoading(false);
        }
    };

    const translateFirebaseError = (code: string) => {
        switch (code) {
            case 'auth/invalid-email': return 'Geçersiz e-posta formatı.';
            case 'auth/user-not-found': return 'Hesap bulunamadı.';
            case 'auth/wrong-password': return 'Hatalı şifre.';
            case 'auth/email-already-in-use': return 'Bu e-posta zaten kullanımda.';
            case 'auth/weak-password': return 'Şifre çok zayıf (en az 6 karakter).';
            case 'auth/too-many-requests': return 'Çok fazla deneme. Lütfen bekleyin.';
            case 'auth/invalid-credential': return 'E-posta veya şifre hatalı.';
            case 'auth/captcha-check-failed': return 'Güvenlik doğrulaması başarısız.';
            default: return 'Bir hata oluştu.';
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-950 p-4">
                <div className="text-center animate-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{t('login.success')}</h2>
                    <p className="text-stone-500 text-xs mt-1">{t('login.success.desc')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-6 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-[340px] relative z-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-800 mb-4 shadow-xl border border-emerald-400/20">
                        <Sparkles size={24} className="text-white" />
                    </div>
                    <div className="flex flex-col items-center">
                        <h1 className="text-3xl font-black text-stone-100 tracking-tight leading-none mb-1">{t('login.title')}</h1>
                        <span className="font-bold text-emerald-500 uppercase tracking-[0.2em] text-[9px]">{t('login.subtitle')}</span>
                    </div>
                </div>

                <div className="bg-stone-900/40 backdrop-blur-2xl rounded-[2.2rem] p-6 border border-white/5 shadow-2xl">
                    
                    {/* --- RESET PASSWORD VIEW --- */}
                    {viewMode === 'RESET' && (
                        <div className="animate-in slide-in-from-right duration-300">
                            <button onClick={() => { setViewMode('LOGIN'); setError(null); }} className="flex items-center text-stone-500 hover:text-stone-200 text-[10px] font-bold mb-6 transition-colors uppercase tracking-widest">
                                <ArrowLeft size={12} className="mr-1" /> {t('login.back')}
                            </button>
                            <h2 className="text-base font-bold text-stone-100 mb-1">{t('login.reset_title')}</h2>
                            <p className="text-[11px] text-stone-500 mb-6">{t('login.reset_desc')}</p>

                            <div className="space-y-4">
                                <a 
                                    href="https://wa.me/905428254087" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-full py-4 bg-[#25D366] hover:bg-[#22c35e] text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <MessageCircle size={18} />
                                    {t('login.whatsapp')}
                                </a>
                                <p className="text-[10px] text-stone-600 text-center px-4">
                                    {t('login.reset_hint')}
                                </p>
                            </div>
                        </div>
                    )}


                    {/* --- EMAIL LOGIN / REGISTER VIEW --- */}
                    {(viewMode === 'LOGIN' || viewMode === 'REGISTER') && (
                        <div className="animate-in fade-in duration-500">
                            <div className="flex justify-center mb-5">
                                <span className="text-[9px] font-black text-stone-600 uppercase tracking-[0.3em]">
                                    {viewMode === 'REGISTER' ? t('login.new_account') : t('login.welcome')}
                                </span>
                            </div>

                            <form onSubmit={handleEmailAuth} className="space-y-2.5">
                                {viewMode === 'REGISTER' && (
                                    <>
                                        <div className="relative group">
                                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500" size={14} />
                                            <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('login.fullname')} className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all" />
                                        </div>
                                        {/* Phone Number Field for Register */}
                                        <div className="relative group">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500" size={14} />
                                            <input 
                                                type="tel" 
                                                value={phoneNumber} 
                                                onChange={e => setPhoneNumber(e.target.value)} 
                                                placeholder="+90 5XX..." 
                                                className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all" 
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={t('login.company')} className="w-full px-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-[13px] outline-none focus:border-emerald-500/50 transition-all" />
                                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('login.title_label')} className="w-full px-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-[13px] outline-none focus:border-emerald-500/50 transition-all" />
                                        </div>
                                    </>
                                )}

                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t('login.email')} className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700" />
                                </div>
                                
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                                    <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder={t('login.password')} className="w-full pl-11 pr-11 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-300">
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>

                                <div className="flex items-center justify-end px-1">
                                    {viewMode === 'LOGIN' && (
                                        <button type="button" onClick={() => setViewMode('RESET')} className="text-[9px] font-bold text-stone-500 hover:text-emerald-500 transition-colors">{t('login.forgot_password')}</button>
                                    )}
                                </div>

                                <button type="submit" disabled={isLoading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center mt-2">
                                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : (viewMode === 'REGISTER' ? t('login.register') : t('login.button'))}
                                </button>
                            </form>


                            <div className="mt-8 pt-6 border-t border-white/5">
                                <button 
                                    type="button" 
                                    onClick={() => { setViewMode(viewMode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setError(null); }} 
                                    className="w-full group relative flex items-center justify-center py-3.5 px-4 rounded-2xl bg-stone-900/50 hover:bg-stone-800 border border-white/5 hover:border-emerald-500/30 transition-all duration-300 active:scale-[0.98]"
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-medium text-stone-500 mb-0.5 group-hover:text-stone-400 transition-colors">
                                            {viewMode === 'REGISTER' ? t('login.have_account') : t('login.no_account')}
                                        </span>
                                        <span className="text-xs font-black text-emerald-500 uppercase tracking-[0.15em] group-hover:text-emerald-400 transition-colors">
                                            {viewMode === 'REGISTER' ? t('login.login_now') : t('login.register_now')}
                                        </span>
                                    </div>
                                    <ChevronRight className="absolute right-4 text-emerald-500/50 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[9px] text-center font-bold flex items-center justify-center gap-2 animate-in slide-in-from-bottom-1">
                            <AlertCircle size={10} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Language Selector */}
                <div className="mt-8 flex items-center justify-center gap-2">
                    <button 
                        onClick={() => setLanguage('tr')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${language === 'tr' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-900/50 text-stone-500 border border-white/5 hover:text-stone-300'}`}
                    >
                        Türkçe
                    </button>
                    <button 
                        onClick={() => setLanguage('en')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${language === 'en' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-900/50 text-stone-500 border border-white/5 hover:text-stone-300'}`}
                    >
                        English
                    </button>
                    <button 
                        onClick={() => setLanguage('ar')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${language === 'ar' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-900/50 text-stone-500 border border-white/5 hover:text-stone-300'}`}
                    >
                        العربية
                    </button>
                </div>

                <p className="text-center text-[9px] text-stone-700 mt-6 font-medium">
                    &copy; 2026 Mühendis Kayıt Sistemi &bull; v3.1.2
                </p>
            </div>
        </div>
    );
};
