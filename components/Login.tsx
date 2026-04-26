
import React, { useState, useEffect, useRef } from 'react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup,
    signInWithRedirect,
    signInWithCredential,
    GoogleAuthProvider,
    getRedirectResult,
    User,
    updateProfile,
    setPersistence, 
    browserLocalPersistence 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';
import { safeStringify } from '../utils/json';
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff, User as UserIcon, Sparkles, Phone, ChevronRight, MessageCircle, Globe } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { Language } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export const LoginScreen: React.FC = () => {
    const { language, setLanguage, t, showToast, hapticFeedback } = useAppViewModel();
    // Modes
    const [viewMode, setViewMode] = useState<'LOGIN' | 'REGISTER' | 'RESET' | 'BRIDGE_SUCCESS'>('LOGIN');

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
    const [authErrorType, setAuthErrorType] = useState<'none' | 'iframe-restricted'>('none');
    
    // Auth Bridge State
    const bridgePollInterval = useRef<any>(null);
    const urlParams = new URLSearchParams(window.location.search);
    const bridgeSession = urlParams.get('bridgeSession');
    const API_BASE = 'https://ais-pre-zmy7cyrul53kimjptv7wnk-324283545149.europe-west2.run.app';

    useEffect(() => {
        auth.useDeviceLanguage(); // Türkçe dil desteği
        
        // Handle Redirect Result
        const handleRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    setIsLoading(true);
                    await syncUserToFirestore(result.user);
                    setIsSuccess(true);
                }
            } catch (err: any) {
                console.error("Redirect redirect error:", err);
                setError('Google girişi tamamlanamadı.');
            } finally {
                setIsLoading(false);
            }
        };
        handleRedirect();
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

    const handleGoogleAuth = async () => {
        if (isLoading) return;
        setIsLoading(true);
        setError(null);
        setAuthErrorType('none');
        hapticFeedback('medium');
        
        try {
            await setPersistence(auth, browserLocalPersistence);
            googleProvider.setCustomParameters({ 
                prompt: 'select_account',
                hl: language
            });

            // Geliştiricinin Notu: Google'ın standart, hatasız "Popup & Redirect" mekanizmasına geçildi.
            try {
                const result = await signInWithPopup(auth, googleProvider);
                await syncUserToFirestore(result.user);
                setIsSuccess(true);
                showToast('Başarıyla giriş yapıldı!', 'success');
            } catch (e: any) {
                console.warn("Popup engellendi veya kapandı, standart yönlendirmeye geçiliyor...", e);
                const isIframe = window.self !== window.top;
                
                // Eğer kullanıcı popup'ı manuel olarak kapatmadıysa
                if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
                    if (isIframe) {
                        // AI Studio (iframe) içindeyken "signInWithRedirect" YAPILAMAZ! 
                        // Çünkü tarayıcılar iframe içinde depolamayı böler ("Storage-partitioned browser environment" hatası verir).
                        setError('Tarayıcınız açılır pencereyi (Popup) engelledi. Lütfen adres çubuğundaki uyarından izin verin veya uygulamayı sağ üstten "Yeni Sekmede" açın.');
                        setIsLoading(false);
                    } else {
                        showToast('Güvenli giriş sayfasına yönlendiriliyorsunuz...', 'info');
                        await signInWithRedirect(auth, googleProvider);
                    }
                } else {
                    setIsLoading(false);
                    setError('Giriş işlemi iptal edildi.');
                }
            }
        } catch (err: any) {
            console.error("Final Google Auth Error:", err);
            setError(translateFirebaseError(err.code));
            setIsLoading(false);
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
            case 'auth/unauthorized-domain': return 'Kritik Uyarı: Bu link Firebase panelinde "Yetkili Alan Adları"na (Authorized Domains) eklenmemiş! Lütfen Firebase Authentication ayarlarına girip bu sayfanın URL adresini ekleyin.';
            case 'auth/popup-blocked': return 'Tarayıcı pencereyi engelledi. Lütfen izin verin.';
            default: return `İşlem başarısız (${code}).`;
        }
    };
    
    if (viewMode === 'BRIDGE_SUCCESS') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-950 p-4">
                <div className="text-center animate-in zoom-in duration-500 max-w-sm">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                        <CheckCircle2 size={40} className="text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight mb-2">Giriş Başarılı</h2>
                    <p className="text-stone-400 text-sm mb-6">Uygulamadaki sekmeye güvenle geri dönebilirsiniz. Bu tarayıcı penceresini kapatabilirsiniz.</p>
                </div>
            </div>
        );
    }

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
                    <AnimatePresence>
                        {authErrorType === 'iframe-restricted' && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3 overflow-hidden"
                            >
                                <div className="flex gap-3">
                                    <AlertCircle className="text-amber-500 shrink-0" size={16} />
                                    <p className="text-[11px] text-amber-200 font-medium leading-relaxed">
                                        Google güvenlik kısıtlaması nedeniyle giriş yapılamadı. Çözüm için uygulamayı tam ekranda açın.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => window.open(window.location.href, '_blank')}
                                    className="w-full py-3 bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl active:scale-95 transition-all"
                                >
                                    Tam Ekran Moduna Geç
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
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

                                <div className="relative flex items-center justify-center my-4">
                                    <div className="absolute inset-0 flex items-center px-4"><div className="w-full border-t border-white/5"></div></div>
                                    <span className="relative bg-stone-900 p-2 text-[8px] font-black text-stone-600 uppercase tracking-widest">VEYA</span>
                                </div>

                                <button 
                                    type="button" 
                                    onClick={handleGoogleAuth}
                                    disabled={isLoading}
                                    className="w-full py-3.5 bg-white text-black rounded-2xl font-bold text-xs shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                    Google ile Devam Et
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
