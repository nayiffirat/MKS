// Firebase / MKS kimlik doğrulama hata kodlarını Türkçe mesaja çevirir.
export const translateFirebaseError = (code: string) => {
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
