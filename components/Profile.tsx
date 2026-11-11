
import React, { useState, useEffect } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/db';
import { User, Save, Briefcase, Phone, CheckCircle, Loader2, ArrowLeft, Stamp, Sparkles, Circle, Square, Check, Mail, Link2, ShieldCheck } from 'lucide-react';
import { linkWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';
import { normalizePhone } from './Login';
import { UserProfile } from '../types';
import { RealisticStamp } from './RealisticStamp';

interface ProfileProps {
    onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileProps> = ({ onBack }) => {
  const { userProfile, updateUserProfile, t, showToast } = useAppViewModel();
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState<UserProfile>(userProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Linked login methods
  const [isGoogleLinked, setIsGoogleLinked] = useState(() => !!auth.currentUser?.providerData.some(p => p.providerId === 'google.com'));
  const [linkPhone, setLinkPhone] = useState(userProfile.phoneNumber || '+90 ');
  const [linkBusy, setLinkBusy] = useState<'google' | 'phone' | null>(null);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleLinkGoogle = async () => {
      const user = auth.currentUser;
      if (!user || isGoogleLinked) return;
      setLinkBusy('google');
      setLinkMsg(null);
      try {
          googleProvider.setCustomParameters({ prompt: 'select_account' });
          await linkWithPopup(user, googleProvider); // same UID, data untouched
          setIsGoogleLinked(true);
          setLinkMsg({ ok: true, text: 'Google hesabınız bu hesaba bağlandı.' });
      } catch (err: any) {
          console.error('Google link failed:', err);
          const text = err.code === 'auth/credential-already-in-use'
              ? 'Bu Google hesabı başka bir MKS hesabına bağlı.'
              : err.code === 'auth/popup-closed-by-user' ? 'İşlem iptal edildi.' : `Google bağlanamadı (${err.code || 'hata'}).`;
          setLinkMsg({ ok: false, text });
      } finally {
          setLinkBusy(null);
      }
  };

  const handleLinkPhone = async () => {
      const user = auth.currentUser;
      const key = normalizePhone(linkPhone);
      if (!user?.email) { setLinkMsg({ ok: false, text: 'Telefon bağlamak için e-posta ile giriş yapmış olmalısınız.' }); return; }
      if (!key) { setLinkMsg({ ok: false, text: 'Geçerli bir cep telefonu girin (+90 5XX...).' }); return; }
      setLinkBusy('phone');
      setLinkMsg(null);
      try {
          const phoneNumber = `+90 ${key}`;
          await updateUserProfile({ ...userProfile, phoneNumber });
          let map: Record<string, string> = {};
          try { map = JSON.parse(localStorage.getItem('mks_phone_email_map') || '{}'); } catch { /* reset corrupt map */ }
          map[key] = user.email;
          localStorage.setItem('mks_phone_email_map', JSON.stringify(map));
          await setDoc(
              doc(db, 'MKS', 'g892bEaJyGfEq1Fa67yb', 'phone_directory', key),
              { uid: user.uid, email: user.email.toLowerCase(), updatedAt: new Date().toISOString() },
              { merge: true }
          );
          setLinkPhone(phoneNumber);
          setLinkMsg({ ok: true, text: 'Telefon numaranız bağlandı. Artık Telefon No + Şifre ile aynı hesaba giriş yapabilirsiniz.' });
      } catch (err) {
          console.error('Phone link failed:', err);
          setLinkMsg({ ok: false, text: 'Telefon numarası kaydedilemedi.' });
      } finally {
          setLinkBusy(null);
      }
  };

  // Sync if context updates externally
  useEffect(() => {
    // If phone is empty, default to +90
    let initialData = { ...userProfile };
    if (!initialData.phoneNumber) {
        initialData.phoneNumber = '+90 ';
    }
    setFormData(initialData);
  }, [userProfile]);

  const handleChange = (field: keyof UserProfile, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (error) setError(null);
  };

  const handlePhoneChange = (value: string) => {
      if (value.length < 4) {
          setFormData(prev => ({ ...prev, phoneNumber: '+90 ' }));
      } else if (!value.startsWith('+90')) {
          setFormData(prev => ({ ...prev, phoneNumber: '+90 ' + value.replace(/^\+90\s*/, '') }));
      } else {
          setFormData(prev => ({ ...prev, phoneNumber: value }));
      }
      if (error) setError(null);
  };

  const validatePhone = (phone: string) => {
      // Basic check: starts with +90 and has digits
      if (!phone || phone.trim() === '+90') return true; // Allow empty-ish
      const clean = phone.replace(/\D/g, '');
      // 90 5XX XXX XX XX -> ~12 digits
      return clean.length >= 12;
  };

  const handleGenerateAiStamp = () => {
      const compName = (formData.companyName || 'ZİRAİ MÜHENDİSLİK DÜKKANI').toUpperCase();
      const titleVal = formData.title ? `${formData.title} ` : 'Ziraat Yüksek Mühendisi ';
      const authName = (formData.fullName || 'Yönetici').toUpperCase();
      const city = formData.selectedCity?.name || 'ŞANLIURFA';
      const phone = formData.phoneNumber || '+90 542 825 40 87';

      setFormData(prev => ({
          ...prev,
          stampEnabled: true,
          stampTitle: compName.includes('LTD') || compName.includes('ŞTİ') || compName.includes('A.Ş') ? compName : `${compName} TARIM SAN. VE TİC. LTD. ŞTİ.`,
          stampSubTitle: `${titleVal}${authName}`,
          stampTaxInfo: `${city} V.D. - ${Math.floor(1000000000 + Math.random() * 8999999999)}`,
          stampTradeInfo: `Tic. Sic. No: ${Math.floor(10000 + Math.random() * 80000)}`,
          stampAddressPhone: `${city} - Tel: ${phone}`,
          stampColor: prev.stampColor || '#1d4ed8',
          stampShape: prev.stampShape || 'RECTANGLE'
      }));
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (formData.phoneNumber && !validatePhone(formData.phoneNumber)) {
          setError(t('profile.error.phone'));
          return;
      }

      setIsSaving(true);
      setError(null);

      try {
          // Update Global State & Local Storage (includes Firebase Sync)
          await updateUserProfile(formData);

          setIsSaving(false);
          showToast(t('profile.success'), 'success');
      } catch (err) {
          console.error("Failed to save profile:", err);
          setError(t('profile.error.save'));
          setIsSaving(false);
      }
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300 max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center mb-6 pt-2">
            <button onClick={onBack} aria-label="Geri" className="mr-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-stone-200">
                <ArrowLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold text-stone-100">{t('profile.title')}</h2>
        </div>

        {/* Profile Card Preview */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-stone-900 rounded-3xl p-6 border border-white/5 mb-8 flex items-center space-x-5 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <User size={120} />
             </div>
             
             <div className="w-20 h-20 bg-stone-800 rounded-full flex items-center justify-center border-4 border-emerald-500/20 text-emerald-500 shadow-xl z-10">
                 <span className="text-2xl font-bold">{formData.fullName ? formData.fullName.charAt(0).toUpperCase() : 'U'}</span>
             </div>
             
             <div className="z-10">
                 <h3 className="text-xl font-bold text-white leading-tight flex items-center gap-2">
                    {formData.fullName || t('profile.unnamed')}
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full border bg-orange-500/10 border-orange-500/30 text-orange-400">
                        {t('login.dealer').toUpperCase()}
                    </span>
                 </h3>
                 <p className="text-emerald-400 text-sm font-medium">{formData.title || t('profile.noTitle')}</p>
                 <p className="text-stone-500 text-xs mt-1">{formData.companyName}</p>
             </div>
        </div>

        {/* Linked login methods */}
        <div className="bg-stone-900/60 backdrop-blur rounded-2xl p-6 border border-emerald-500/20 shadow-sm mb-6">
            <h3 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
                <ShieldCheck size={14} className="mr-2 shrink-0" /> Bağlı Giriş Yöntemlerim (Eski Hesap Koruma &amp; Birleştirme)
            </h3>
            <p className="text-stone-500 text-[11px] mb-4">Tüm yöntemler aynı hesaba (UID) bağlanır; mevcut verileriniz korunur.</p>

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 bg-stone-950 border border-stone-800 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                        <Mail size={16} className="text-emerald-500 shrink-0" />
                        <span className="text-sm text-stone-200 truncate">{currentUser?.email || 'E-posta yok'}</span>
                    </div>
                    {currentUser?.email && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">Bağlı</span>}
                </div>

                <div className="flex items-center justify-between gap-3 p-3 bg-stone-950 border border-stone-800 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Link2 size={16} className="text-sky-400 shrink-0" />
                        <span className="text-sm text-stone-200">Google</span>
                    </div>
                    {isGoogleLinked ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">Google Hesabı Bağlı</span>
                    ) : (
                        <button type="button" onClick={handleLinkGoogle} disabled={linkBusy !== null} className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-900 text-[11px] font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5">
                            {linkBusy === 'google' && <Loader2 size={12} className="animate-spin" />} Google Hesabı Bağla
                        </button>
                    )}
                </div>

                <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl">
                    <label htmlFor="link-phone" className="flex items-center gap-2 text-sm text-stone-200 mb-2">
                        <Phone size={16} className="text-amber-400" /> Telefon Numarası Bağla
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="link-phone"
                            type="tel"
                            value={linkPhone}
                            onChange={(e) => setLinkPhone(e.target.value)}
                            placeholder="+90 5XX..."
                            className="flex-1 min-w-0 bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-stone-200 text-sm outline-none focus:border-emerald-500 transition-all placeholder-stone-600"
                        />
                        <button type="button" onClick={handleLinkPhone} disabled={linkBusy !== null} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5">
                            {linkBusy === 'phone' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Kaydet
                        </button>
                    </div>
                </div>

                {linkMsg && (
                    <p role="status" className={`text-[11px] font-medium ${linkMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{linkMsg.text}</p>
                )}
            </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
            
            {/* Personal Info Section */}
            <div className="bg-stone-900/60 backdrop-blur rounded-2xl p-6 border border-white/5 shadow-sm">
                <h3 className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center">
                    <User size={14} className="mr-2" /> {t('profile.personalInfo')}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('profile.fullName')}</label>
                        <input 
                            type="text" 
                            value={formData.fullName}
                            onChange={(e) => handleChange('fullName', e.target.value)}
                            placeholder={t('profile.fullName.placeholder')}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('profile.phone')}</label>
                        <input 
                            type="tel" 
                            value={formData.phoneNumber}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="+90 5xxxxxxxxx"
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-stone-600"
                        />
                        <p className="text-[11px] text-stone-500 mt-1">{t('profile.phone.desc')}</p>
                    </div>
                </div>
            </div>

            {/* Company Info Section */}
            <div className="bg-stone-900/60 backdrop-blur rounded-2xl p-6 border border-white/5 shadow-sm">
                <h3 className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center">
                    <Briefcase size={14} className="mr-2" /> {t('profile.corporateInfo')}
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('profile.companyName')}</label>
                        <input 
                            type="text" 
                            value={formData.companyName}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                            placeholder={t('profile.companyName.placeholder')}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('profile.jobTitle')}</label>
                        <input 
                            type="text" 
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder={t('profile.jobTitle.placeholder')}
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>
                </div>
            </div>

            {/* Official Stamp & Digital Approval Section */}
            <div className="bg-stone-900/60 backdrop-blur rounded-2xl p-6 border border-emerald-500/20 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center">
                        <Stamp size={16} className="mr-2 text-emerald-400" /> Resmi İşyeri Kaşesi &amp; Dijital Onay
                    </h3>

                    <button
                        type="button"
                        onClick={handleGenerateAiStamp}
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-bold rounded-xl shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition-all active:scale-95"
                    >
                        <Sparkles size={13} className="animate-pulse text-amber-300" />
                        Yapay Zeka ile Otomatik Kaşe
                    </button>
                </div>

                <p className="text-stone-400 text-xs mb-5 leading-relaxed">
                    Faturalarda, reçetelerde ve raporlarda altta basılı görünecek resmi yazılı kaşenizi özelleştirin. Kaşe, gerçek mürekkep baskısı efektiyle belgelerinize otomatik yerleştirilir.
                </p>

                {/* Stamp Live Preview Paper Box */}
                <div className="mb-6 p-6 bg-[#fdfdfc] rounded-2xl border border-stone-300 flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
                    <div className="absolute top-2 left-3 text-[11px] font-bold text-stone-400 uppercase tracking-widest pointer-events-none">
                        Canlı Kaşe Önizleme
                    </div>
                    <div className="my-2 py-2">
                        <RealisticStamp
                            profile={formData}
                            title={formData.stampTitle}
                            subTitle={formData.stampSubTitle}
                            taxInfo={formData.stampTaxInfo}
                            tradeInfo={formData.stampTradeInfo}
                            addressPhone={formData.stampAddressPhone}
                            color={formData.stampColor}
                            shape={formData.stampShape}
                            size="md"
                        />
                    </div>
                    <div className="text-[11px] text-stone-400 italic">
                        * Tüm fatura ve PDF rapor çıktılarının en altına otomatik basılacaktır.
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Shape & Color Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Kaşe Şekli</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, stampShape: 'RECTANGLE' }))}
                                    className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                        (formData.stampShape || 'RECTANGLE') === 'RECTANGLE'
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                                    }`}
                                >
                                    <Square size={14} />
                                    Dikdörtgen
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, stampShape: 'OVAL' }))}
                                    className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                        formData.stampShape === 'OVAL'
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                                    }`}
                                >
                                    <Circle size={14} />
                                    Oval (Dairesel)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-400 mb-2">Mürekkep Rengi</label>
                            <div className="flex items-center gap-2.5 pt-1">
                                {[
                                    { name: 'Klasik Mavi', hex: '#1d4ed8' },
                                    { name: 'Koyu Lacivert', hex: '#1e3a8a' },
                                    { name: 'Resmi Mürdüm', hex: '#701a75' },
                                    { name: 'Siyah', hex: '#1c1917' },
                                    { name: 'Kırmızı', hex: '#991b1b' },
                                ].map(c => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        title={c.name}
                                        onClick={() => setFormData(p => ({ ...p, stampColor: c.hex }))}
                                        style={{ backgroundColor: c.hex }}
                                        className={`w-9 h-9 rounded-full border-2 transition-transform flex items-center justify-center ${
                                            (formData.stampColor || '#1d4ed8') === c.hex ? 'scale-110 border-white shadow-md' : 'border-transparent opacity-85 hover:opacity-100'
                                        }`}
                                    >
                                        {(formData.stampColor || '#1d4ed8') === c.hex && <Check size={15} className="text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Stamp Text Inputs */}
                    <div>
                        <label className="block text-xs font-bold text-stone-300 mb-1">Firma / Şirket Ünvanı (Kaşe Üst Satırı)</label>
                        <input
                            type="text"
                            value={formData.stampTitle || ''}
                            onChange={(e) => setFormData(p => ({ ...p, stampTitle: e.target.value }))}
                            placeholder="Örn: BETA ZİRAİ MÜHENDİSLİK SAN. VE TİC. LTD. ŞTİ."
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-300 mb-1">Yetkili Kişi &amp; Unvanı</label>
                        <input
                            type="text"
                            value={formData.stampSubTitle || ''}
                            onChange={(e) => setFormData(p => ({ ...p, stampSubTitle: e.target.value }))}
                            placeholder="Örn: Ziraat Yüksek Mühendisi Nayif FIRAT"
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-stone-300 mb-1">Vergi Dairesi ve No</label>
                            <input
                                type="text"
                                value={formData.stampTaxInfo || ''}
                                onChange={(e) => setFormData(p => ({ ...p, stampTaxInfo: e.target.value }))}
                                placeholder="Örn: Haliliye V.D. - 388 042 1902"
                                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500 transition-all placeholder-stone-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-300 mb-1">Ticaret Sicil No / MERSİS</label>
                            <input
                                type="text"
                                value={formData.stampTradeInfo || ''}
                                onChange={(e) => setFormData(p => ({ ...p, stampTradeInfo: e.target.value }))}
                                placeholder="Örn: Tic. Sic. No: 45892"
                                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500 transition-all placeholder-stone-600"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-300 mb-1">Adres ve İletişim Bilgisi</label>
                        <input
                            type="text"
                            value={formData.stampAddressPhone || ''}
                            onChange={(e) => setFormData(p => ({ ...p, stampAddressPhone: e.target.value }))}
                            placeholder="Örn: Şanlıurfa - Tel: +90 542 825 40 87"
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500 transition-all placeholder-stone-600"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm font-medium flex items-center">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>
                    {error}
                </div>
            )}

            <button 
                type="submit" 
                disabled={isSaving}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center transition-all active:scale-[0.98] ${
                    isSaving 
                    ? 'bg-stone-800 text-stone-500 cursor-not-allowed' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/30'
                }`}
            >
                {isSaving ? (
                    <>
                        <Loader2 className="animate-spin mr-2" size={20} /> {t('profile.saving')}
                    </>
                ) : (
                    <>
                        <Save className="mr-2" size={20} /> {t('profile.save')}
                    </>
                )}
            </button>
        </form>

        {/* Success Toast: UI-66 — uygulamanın ortak showToast'u kullanılıyor (handleSave) */}

    </div>
  );
};
