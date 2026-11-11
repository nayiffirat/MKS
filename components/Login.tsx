
import React, { useState, useEffect, useRef } from 'react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail,
    signInWithPopup,
    signInWithRedirect,
    signInWithCredential,
    GoogleAuthProvider,
    getRedirectResult,
    User,
    updateProfile,
    setPersistence,
    browserLocalPersistence,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    getAdditionalUserInfo,
    ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';
import { safeStringify } from '../utils/json';
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff, User as UserIcon, Sparkles, Phone, ChevronRight, MessageCircle, Globe, Send, Download, KeyRound, Headphones, Monitor, Smartphone, Apple, ShieldCheck, Satellite, Database, Layers, X } from 'lucide-react';
import { WebLandingPortal } from './WebLandingPortal';
import { LiveSupportWidget } from './LiveSupportWidget';
import { CorporateShowcaseWebsite } from './CorporateShowcaseWebsite';
import { MksBrandLogo } from './MksBrandLogo';
import { dbService } from '../services/db';

type SupportCategory = 'general' | 'subscription' | 'password_reset' | 'bkst_gts';
const PHONE_DIR_PATH = ['MKS', 'g892bEaJyGfEq1Fa67yb', 'phone_directory'] as const;
const PHONE_MAP_KEY = 'mks_phone_email_map';
const RESET_SUPPORT_PREFILL = 'Merhaba Fırat Bey, şifremi unuttum ve e-postama erişemiyorum. Hesabım için geçici şifre / kurtarma kodu rica ediyorum.';

// "05XX...", "+90 5XX...", "5XX..." -> "5XXXXXXXXX" ('' if not a TR mobile number)
export const normalizePhone = (raw: string): string => {
    const key = (raw || '').replace(/\D/g, '').slice(-10);
    return /^5\d{9}$/.test(key) ? key : '';
};

// Phone -> existing email (localStorage first, then isolated single-doc phone_directory lookup)
const resolveEmailByPhone = async (key: string): Promise<string | null> => {
    try {
        const map = JSON.parse(localStorage.getItem(PHONE_MAP_KEY) || '{}');
        if (map[key]) return map[key];
    } catch { /* corrupt map -> fall through to Firestore */ }
    try {
        const phoneSnap = await getDoc(doc(db, ...PHONE_DIR_PATH, key));
        if (phoneSnap.exists()) {
            const data = phoneSnap.data();
            return data.email || null;
        }
    } catch (err) {
        console.warn('Phone lookup failed:', err);
    }
    return null;
};
import { useAppViewModel } from '../context/AppContext';
import { Language } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

import { API_BASE } from '../utils/api';

export const LoginScreen: React.FC = () => {
    const { language, setLanguage, t, showToast, hapticFeedback } = useAppViewModel();
    // Modes
    const [viewMode, setViewMode] = useState<'LOGIN' | 'REGISTER' | 'RESET' | 'BRIDGE_SUCCESS'>('LOGIN');

    // Email/Pass Inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // Password Reset States
    const [resetEmail, setResetEmail] = useState('');
    const [isResetSent, setIsResetSent] = useState(false);
    
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

    // Login method + phone / SMS OTP
    const [loginMethod, setLoginMethod] = useState<'EMAIL' | 'PHONE'>('EMAIL');
    const [loginPhone, setLoginPhone] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpConfirmation, setOtpConfirmation] = useState<ConfirmationResult | null>(null);
    const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

    // Top bar modals
    const [showPortal, setShowPortal] = useState(false);
    const [portalInitialTab, setPortalInitialTab] = useState<'overview' | 'download' | 'pricing' | 'ios_guide'>('download');
    const [support, setSupport] = useState<{ open: boolean; category: SupportCategory; prefill: string }>({ open: false, category: 'general', prefill: '' });
    const openSupport = (category: SupportCategory = 'general', prefill = '') => setSupport({ open: true, category, prefill });
    const openPortalTab = (tab: 'overview' | 'download' | 'pricing' | 'ios_guide') => {
        setPortalInitialTab(tab);
        setShowPortal(true);
    };
    const loginCardRef = useRef<HTMLDivElement | null>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const p = new URLSearchParams(window.location.search);
        return Boolean(p.get('bridgeSession') || p.get('auth'));
    });
    const scrollToAuth = (targetMode: 'LOGIN' | 'REGISTER') => {
        setViewMode(targetMode);
        setError(null);
        setShowPortal(false);
        setIsAuthModalOpen(true);
    };

    useEffect(() => {
        if (!isAuthModalOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsAuthModalOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isAuthModalOpen]);

    // Auth Bridge State
    const bridgePollInterval = useRef<any>(null);
    const urlParams = new URLSearchParams(window.location.search);
    const bridgeSession = urlParams.get('bridgeSession');

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
            const existing = await dbService.getUserProfile(user.uid);
            if (additionalData && (additionalData.fullName || additionalData.phoneNumber || additionalData.companyName || additionalData.title)) {
                const merged = {
                    ...(existing || {}),
                    uid: user.uid,
                    email: user.email || existing?.email || '',
                    fullName: additionalData.fullName || existing?.fullName || user.displayName || 'İsimsiz Kullanıcı',
                    phoneNumber: additionalData.phoneNumber || existing?.phoneNumber || user.phoneNumber || '',
                    companyName: additionalData.companyName || existing?.companyName || '',
                    title: additionalData.title || existing?.title || 'Ziraat Mühendisi',
                } as any;
                delete merged.password;
                await dbService.saveUserProfile(user.uid, merged);
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
            googleProvider.setCustomParameters({ 
                prompt: 'select_account',
                hl: language
            });

            // ÖNEMLİ: signInWithPopup öncesinde await kullanılmaz; aksi halde Chrome kullanıcı etkileşim (user-gesture) kilidi popup penceresini engeller!
            try {
                const result = await signInWithPopup(auth, googleProvider);
                await syncUserToFirestore(result.user);
                setIsSuccess(true);
                showToast('Başarıyla giriş yapıldı!', 'success');
            } catch (e: any) {
                console.warn("Google Auth hatası:", e);
                setIsLoading(false);

                // Kullanıcı pencereyi manuel kapattıysa
                if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
                    return;
                }

                if (e.code === 'auth/popup-blocked') {
                    setError('Tarayıcınız açılır pencereyi (Popup) engelledi. Lütfen adres çubuğundaki bildirimden açılır pencerelere izin verip tekrar deneyin.');
                    showToast('Açılır pencere engellendi, lütfen izin verin.', 'warning');
                    return;
                }

                if (e.code === 'auth/unauthorized-domain') {
                    setError('Bu alan adı Firebase panelinde henüz yetkilendirilmedi.');
                    return;
                }

                setError(translateFirebaseError(e.code) || 'Google ile giriş başarısız oldu.');
            }
        } catch (err: any) {
            console.error("Final Google Auth Error:", err);
            setError(translateFirebaseError(err.code));
            setIsLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        const isPhoneLogin = viewMode === 'LOGIN' && loginMethod === 'PHONE';
        if ((!isPhoneLogin && !email) || !password) return;
        setIsLoading(true);
        setError(null);

        try {
            if (isPhoneLogin) {
                const key = normalizePhone(loginPhone);
                if (!key) throw { code: 'mks/invalid-phone' };
                const linkedEmail = await resolveEmailByPhone(key);
                if (!linkedEmail) throw { code: 'mks/phone-not-linked' };
                await setPersistence(auth, browserLocalPersistence);
                // Sign into the exact existing email account (same UID, all old data)
                const cred = await signInWithEmailAndPassword(auth, linkedEmail, password);
                await syncUserToFirestore(cred.user);
                setIsSuccess(true);
                return;
            }

            // Set persistence to local by default for automatic login
            await setPersistence(auth, browserLocalPersistence);

            if (viewMode === 'REGISTER') {
                if (!fullName) {
                    setError("Ad Soyad zorunludur.");
                    setIsLoading(false);
                    return;
                }
                
                // Pre-populate localStorage to avoid race condition with App.tsx's getUserProfile (7-day trial, no plaintext password)
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 7);
                const tempProfile = {
                    fullName,
                    phoneNumber,
                    companyName,
                    title: title || 'Ziraat Mühendisi',
                    role: 'user',
                    subscriptionStatus: 'trial',
                    subscriptionTier: 'PRO',
                    subscriptionEndsAt: endDate.toISOString(),
                    subscriptionEndsAtMs: endDate.getTime()
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

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetEmail = (resetEmail || email).trim();
        if (!targetEmail) {
            setError('Lütfen e-posta adresinizi girin.');
            return;
        }
        setIsLoading(true);
        setError(null);
        hapticFeedback('medium');

        try {
            await sendPasswordResetEmail(auth, targetEmail);
            setIsResetSent(true);
            showToast('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.', 'success');
        } catch (err: any) {
            console.error("Password reset error:", err);
            setError(translateFirebaseError(err.code));
        } finally {
            setIsLoading(false);
        }
    };

    const resetOtp = () => {
        setOtpConfirmation(null);
        setOtpCode('');
    };

    const handleSendOtp = async () => {
        const key = normalizePhone(loginPhone);
        if (!key) { setError(translateFirebaseError('mks/invalid-phone')); return; }
        setIsLoading(true);
        setError(null);
        hapticFeedback('medium');
        try {
            if (!recaptchaRef.current) {
                recaptchaRef.current = new RecaptchaVerifier(auth, 'mks-recaptcha', { size: 'invisible' });
            }
            const confirmation = await signInWithPhoneNumber(auth, `+90${key}`, recaptchaRef.current);
            setOtpConfirmation(confirmation);
            showToast('SMS doğrulama kodu gönderildi.', 'success');
        } catch (err: any) {
            console.error('SMS OTP error:', err);
            recaptchaRef.current?.clear();
            recaptchaRef.current = null;
            setError(translateFirebaseError(err.code));
        } finally {
            setIsLoading(false);
        }
    };

    // purpose 'RESET': only an existing account counts as recovery
    const handleConfirmOtp = async (purpose: 'LOGIN' | 'RESET') => {
        if (!otpConfirmation || otpCode.trim().length < 6) return;
        setIsLoading(true);
        setError(null);
        try {
            await setPersistence(auth, browserLocalPersistence);
            const cred = await otpConfirmation.confirm(otpCode.trim());
            if (getAdditionalUserInfo(cred)?.isNewUser) {
                const linkedEmail = await resolveEmailByPhone(normalizePhone(loginPhone));
                if (purpose === 'RESET' || linkedEmail) {
                    // Never strand an existing user in a fresh empty UID
                    await cred.user.delete();
                    resetOtp();
                    throw { code: linkedEmail ? 'mks/phone-linked-to-email' : 'mks/phone-not-linked' };
                }
            }
            await syncUserToFirestore(cred.user, { phoneNumber: `+90${normalizePhone(loginPhone)}` });
            if (purpose === 'RESET') showToast('Hesabınıza giriş yapıldı. Ayarlar > Güvenlik bölümünden yeni şifre belirleyebilirsiniz.', 'success');
            setIsSuccess(true);
        } catch (err: any) {
            setError(translateFirebaseError(err.code));
            setIsLoading(false);
        }
    };

    const renderPhoneInput = (required: boolean) => (
        <div className="relative group">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500" size={14} />
            <input
                type="tel"
                required={required}
                value={loginPhone}
                onChange={e => { setLoginPhone(e.target.value); if (otpConfirmation) resetOtp(); }}
                placeholder="05XX XXX XX XX"
                className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700"
            />
        </div>
    );

    // LOGIN reuses the phone field already in the form; RESET renders its own
    const renderPhoneOtpBlock = (purpose: 'LOGIN' | 'RESET') => (
        <div className="space-y-2.5">
            {purpose === 'RESET' && renderPhoneInput(false)}
            {otpConfirmation ? (
                <>
                    <div className="relative group">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500" size={14} />
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="6 haneli SMS kodu"
                            className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm tracking-[0.3em] outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700 placeholder:tracking-normal"
                        />
                    </div>
                    <button type="button" onClick={() => handleConfirmOtp(purpose)} disabled={isLoading || otpCode.length < 6} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={14} /> Kodu Doğrula ve Giriş Yap</>}
                    </button>
                    <button type="button" onClick={resetOtp} className="w-full py-2 text-stone-500 hover:text-stone-300 text-[10px] font-bold transition-colors">
                        Kodu tekrar gönder
                    </button>
                </>
            ) : (
                <button type="button" onClick={handleSendOtp} disabled={isLoading} className="w-full py-3 bg-stone-900 hover:bg-stone-800 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 rounded-2xl font-bold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><MessageCircle size={14} /> {purpose === 'RESET' ? 'SMS Kurtarma Kodu Gönder' : 'SMS ile Tek Kullanımlık Kod Gönder'}</>}
                </button>
            )}
        </div>
    );

    const translateFirebaseError = (code: string) => {
        switch (code) {
            case 'mks/invalid-phone': return 'Geçerli bir cep telefonu girin (05XX XXX XX XX).';
            case 'mks/phone-not-linked': return 'Bu numara bir hesaba bağlı değil. E-posta ile giriş yapıp Profil > Bağlı Giriş Yöntemlerim bölümünden numaranızı bağlayın.';
            case 'mks/phone-linked-to-email': return 'Bu numara e-posta hesabınıza bağlı. Verilerinizi korumak için Telefon No + Şifre ile giriş yapın veya Canlı Destek\'ten geçici şifre isteyin.';
            case 'auth/invalid-phone-number': return 'Telefon numarası geçersiz.';
            case 'auth/invalid-verification-code': return 'SMS kodu hatalı.';
            case 'auth/code-expired': return 'SMS kodunun süresi doldu. Yeniden kod isteyin.';
            case 'auth/operation-not-allowed': return 'Bu giriş yöntemi şu an etkin değil. Lütfen Canlı Destek ile iletişime geçin.';
            case 'auth/account-exists-with-different-credential': return 'Bu e-posta başka bir yöntemle kayıtlı. Önce e-posta ile giriş yapıp Profil\'den Google hesabınızı bağlayın.';
            case 'auth/invalid-email': return 'Geçersiz e-posta adresi formatı.';
            case 'auth/user-not-found': return 'Bu e-posta adresine kayıtlı bir kullanıcı bulunamadı.';
            case 'auth/wrong-password': return 'Hatalı şifre.';
            case 'auth/email-already-in-use': return 'Bu e-posta zaten kullanımda.';
            case 'auth/weak-password': return 'Şifre çok zayıf (en az 6 karakter).';
            case 'auth/too-many-requests': return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.';
            case 'auth/invalid-credential': return 'E-posta veya şifre hatalı.';
            case 'auth/captcha-check-failed': return 'Güvenlik doğrulaması başarısız.';
            case 'auth/unauthorized-domain': return 'Kritik Uyarı: Bu link Firebase panelinde "Yetkili Alan Adları"na eklenmemiş.';
            case 'auth/popup-blocked': return 'Tarayıcı pencereyi engelledi. Lütfen izin verin.';
            case 'auth/network-request-failed': return 'İnternet bağlantınızı kontrol edin.';
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

    const isStandaloneOrNativeApp =
        Capacitor.isNativePlatform() ||
        urlParams.get('platform') === 'desktop' ||
        (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)')?.matches);

    const renderAuthCard = () => (
        <div ref={loginCardRef} id="mks-giris-paneli" className="w-full max-w-[390px] mx-auto relative z-10">
            {isStandaloneOrNativeApp && (
                <div className="flex flex-col gap-2 mb-6">
                    <button
                        type="button"
                        onClick={() => openPortalTab('download')}
                        className="w-full py-2.5 px-3 rounded-2xl bg-stone-900/60 hover:bg-stone-800 border border-white/5 hover:border-emerald-500/30 text-stone-300 hover:text-white text-[10px] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <Download size={13} className="text-emerald-400 shrink-0" />
                        Uygulamayı İndir / Paketler (Windows • iOS • Android)
                    </button>
                    <button
                        type="button"
                        onClick={() => openSupport()}
                        className="w-full py-2.5 px-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-[10px] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <Headphones size={13} className="shrink-0" />
                        Canlı Destek
                    </button>
                </div>
            )}

            {isStandaloneOrNativeApp ? (
                <div className="text-center mb-5">
                    <MksBrandLogo size="xl" rounded="2xl" className="mx-auto mb-3 border-emerald-500/30 shadow-lg" />
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-semibold text-stone-100 tracking-tight leading-snug mb-1">{t('login.title')}</h2>
                        <span className="font-medium text-stone-400 text-xs">
                            {t('login.subtitle')}
                        </span>
                    </div>
                </div>
            ) : null}

            <div className="bg-[#0D1219]/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-white/10 shadow-[0_28px_80px_rgba(0,0,0,0.75)] relative">
                    {!isStandaloneOrNativeApp && isAuthModalOpen && (
                        <button
                            type="button"
                            onClick={() => setIsAuthModalOpen(false)}
                            aria-label="Giriş penceresini kapat"
                            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={15} />
                        </button>
                    )}
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
                            {isResetSent ? (
                                <div className="text-center py-2">
                                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                                        <Send size={22} />
                                    </div>
                                    <h2 className="text-base font-bold text-stone-100 mb-2">{t('login.reset_sent_title')}</h2>
                                    <p className="text-[11px] text-stone-400 leading-relaxed mb-6 px-1">
                                        <span className="font-bold text-emerald-400 block mb-1 break-all">{resetEmail || email}</span>
                                        {t('login.reset_sent_desc')}
                                    </p>

                                    <div className="space-y-2.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setViewMode('LOGIN');
                                                setIsResetSent(false);
                                                setError(null);
                                            }}
                                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            <ArrowLeft size={14} />
                                            {t('login.reset_success_back')}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsResetSent(false);
                                                setError(null);
                                            }}
                                            className="w-full py-2.5 text-stone-500 hover:text-stone-300 text-[10px] font-bold transition-colors"
                                        >
                                            Farklı E-posta ile Tekrar Dene
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <button 
                                        type="button"
                                        onClick={() => { setViewMode('LOGIN'); setError(null); }} 
                                        className="flex items-center text-stone-500 hover:text-stone-200 text-[10px] font-bold mb-4 transition-colors uppercase tracking-widest"
                                    >
                                        <ArrowLeft size={12} className="mr-1" /> {t('login.back')}
                                    </button>
                                    
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                                            <Mail size={18} />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold text-stone-100">{t('login.reset_title')}</h2>
                                            <span className="text-[10px] text-emerald-500 font-medium block">1 · E-Posta Sıfırlama Bağlantısı Gönder</span>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-stone-400 mb-5 leading-relaxed">
                                        {t('login.reset_desc')}
                                    </p>

                                    <form onSubmit={handlePasswordReset} className="space-y-3">
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                                            <input 
                                                type="email" 
                                                required 
                                                value={resetEmail} 
                                                onChange={e => setResetEmail(e.target.value)} 
                                                placeholder={t('login.email')} 
                                                className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700" 
                                            />
                                        </div>

                                        <button 
                                            type="submit" 
                                            disabled={isLoading} 
                                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="animate-spin" size={16} />
                                            ) : (
                                                <>
                                                    <Send size={14} />
                                                    {t('login.reset_button')}
                                                </>
                                            )}
                                        </button>
                                    </form>

                                    {/* Option 2: SMS recovery */}
                                    <div className="mt-5 pt-4 border-t border-white/5">
                                        <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest block mb-2">2 · Telefona SMS Kurtarma Kodu</span>
                                        {renderPhoneOtpBlock('RESET')}
                                    </div>

                                    {/* Option 3: admin / live support */}
                                    <div className="mt-5 pt-4 border-t border-white/5">
                                        <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest block mb-2">3 · Yönetici Desteği</span>
                                        <button
                                            type="button"
                                            onClick={() => openSupport('password_reset', RESET_SUPPORT_PREFILL)}
                                            className="w-full py-3 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-2xl font-bold text-[10px] leading-snug transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            <Headphones size={14} className="shrink-0" />
                                            E-postama ulaşamıyorum — Canlı Destek / Yöneticiden Tek Kullanımlık Şifre İste
                                        </button>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                                        <p className="text-[10px] text-stone-500 text-center">
                                            {t('login.reset_hint')}
                                        </p>
                                        <a 
                                            href="https://wa.me/905428254087" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 border border-white/5 text-stone-400 hover:text-white rounded-xl font-bold text-[10px] transition-all flex items-center justify-center gap-2"
                                        >
                                            <MessageCircle size={14} className="text-[#25D366]" />
                                            {t('login.whatsapp')}
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    {/* --- EMAIL LOGIN / REGISTER VIEW --- */}
                    {(viewMode === 'LOGIN' || viewMode === 'REGISTER') && (
                        <div className="animate-in fade-in duration-300">
                            <div className="mb-4 pr-10 flex items-center gap-3">
                                {!isStandaloneOrNativeApp && (
                                    <MksBrandLogo size="lg" rounded="xl" className="border-emerald-500/30" />
                                )}
                                <div className="min-w-0">
                                    <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                                        {viewMode === 'REGISTER' ? 'Yeni mühendis veya bayi hesabı' : 'Hesabınıza giriş yapın'}
                                    </h2>
                                    <p className="text-xs text-stone-400 mt-0.5">
                                        {viewMode === 'REGISTER'
                                            ? 'Temiz başlangıç hesabınız tüm cihazlarınızda anında eşitlenir'
                                            : 'Telefon, masaüstü ve web verileriniz anında senkronize olur'}
                                    </p>
                                </div>
                            </div>

                            {viewMode === 'LOGIN' && (
                                <div className="grid grid-cols-2 gap-1.5 p-1 mb-4 bg-stone-950/70 border border-white/10 rounded-2xl" role="tablist">
                                    {([
                                        { id: 'EMAIL', label: 'E-posta ile giriş', icon: <Mail size={14} /> },
                                        { id: 'PHONE', label: 'Telefon ile giriş', icon: <Phone size={14} /> },
                                    ] as const).map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={loginMethod === tab.id}
                                            onClick={() => { setLoginMethod(tab.id); setError(null); resetOtp(); }}
                                            className={`min-h-[40px] py-2 px-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${loginMethod === tab.id ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}
                                        >
                                            {tab.icon}
                                            <span className="truncate">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

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

                                {viewMode === 'LOGIN' && loginMethod === 'PHONE' ? renderPhoneInput(true) : (
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t('login.email')} className="w-full pl-11 pr-4 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700" />
                                </div>
                                )}
                                
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                                    <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder={t('login.password')} className="w-full pl-11 pr-11 py-3 bg-stone-950/50 border border-stone-800 rounded-2xl text-stone-200 text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-stone-700" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-300">
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>

                                <div className="flex items-center justify-end px-1">
                                    {viewMode === 'LOGIN' && (
                                        <button 
                                            type="button" 
                                            onClick={() => { 
                                                setResetEmail(email); 
                                                setIsResetSent(false); 
                                                setError(null); 
                                                setViewMode('RESET'); 
                                            }} 
                                            className="text-[9px] font-bold text-stone-500 hover:text-emerald-500 transition-colors"
                                        >
                                            {t('login.forgot_password')}
                                        </button>
                                    )}
                                </div>

                                <button type="submit" disabled={isLoading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center mt-2">
                                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : (viewMode === 'REGISTER' ? t('login.register') : t('login.button'))}
                                </button>

                                <div className="relative flex items-center justify-center my-4">
                                    <div className="absolute inset-0 flex items-center px-4"><div className="w-full border-t border-white/5"></div></div>
                                    <span className="relative bg-stone-900 p-2 text-[8px] font-black text-stone-600 uppercase tracking-widest">VEYA</span>
                                </div>

                                {viewMode === 'LOGIN' && loginMethod === 'PHONE' && renderPhoneOtpBlock('LOGIN')}

                                <button 
                                    type="button" 
                                    onClick={handleGoogleAuth}
                                    disabled={isLoading}
                                    className="w-full py-3.5 bg-white hover:bg-stone-100 text-stone-900 rounded-2xl font-bold text-xs shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                    Google ile Tek Tıkla Devam Et
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
                <div className="mt-6 flex items-center justify-center gap-2">
                    <button 
                        type="button"
                        onClick={() => setLanguage('tr')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${language === 'tr' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-900/50 text-stone-500 border border-white/5 hover:text-stone-300'}`}
                    >
                        Türkçe
                    </button>
                    <button 
                        type="button"
                        onClick={() => setLanguage('en')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${language === 'en' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-900/50 text-stone-500 border border-white/5 hover:text-stone-300'}`}
                    >
                        English
                    </button>
                    <button 
                        type="button"
                        onClick={() => setLanguage('ar')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${language === 'ar' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-900/50 text-stone-500 border border-white/5 hover:text-stone-300'}`}
                    >
                        العربية
                    </button>
                </div>

                <p className="text-center text-[10px] text-stone-600 mt-4 font-medium">
                    &copy; 2026 Mühendis Kayıt Sistemi &bull; v8.2.0 Enterprise
                </p>
            </div>
    );

    if (isStandaloneOrNativeApp) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-5 relative overflow-hidden">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />
                <div id="mks-recaptcha" />
                {showPortal && (
                    <WebLandingPortal
                        mode="modal"
                        initialTab={portalInitialTab}
                        onClose={() => setShowPortal(false)}
                        onGoToLogin={(m) => scrollToAuth(m || 'LOGIN')}
                        onOpenSupport={(category, prefill) => { setShowPortal(false); openSupport(category, prefill); }}
                    />
                )}
                <LiveSupportWidget
                    isOpenExternal={support.open}
                    onCloseExternal={() => setSupport(s => ({ ...s, open: false }))}
                    initialCategory={support.category}
                    initialPrefill={support.prefill}
                />
                {renderAuthCard()}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#06090E] text-slate-100 relative overflow-x-hidden flex flex-col">
            {/* Invisible reCAPTCHA host for SMS OTP */}
            <div id="mks-recaptcha" />

            {showPortal && (
                <WebLandingPortal
                    mode="modal"
                    initialTab={portalInitialTab}
                    onClose={() => setShowPortal(false)}
                    onGoToLogin={(m) => scrollToAuth(m || 'LOGIN')}
                    onOpenSupport={(category, prefill) => { setShowPortal(false); openSupport(category, prefill); }}
                />
            )}
            <LiveSupportWidget
                isOpenExternal={support.open}
                onCloseExternal={() => setSupport(s => ({ ...s, open: false }))}
                initialCategory={support.category}
                initialPrefill={support.prefill}
            />

            <CorporateShowcaseWebsite
                onOpenAuthModal={(mode) => scrollToAuth(mode)}
                onOpenPortalTab={(tab) => openPortalTab(tab)}
                onOpenSupport={() => openSupport()}
            />

            <AnimatePresence>
                {isAuthModalOpen && (
                    <motion.div
                        key="corporate-auth-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setIsAuthModalOpen(false);
                        }}
                        className="fixed inset-0 z-50 bg-[#04070B]/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
                    >
                        <motion.div
                            key="corporate-auth-dialog"
                            initial={{ opacity: 0, y: 18, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 12, scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                            className="w-full max-w-[400px] my-auto"
                        >
                            {renderAuthCard()}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
