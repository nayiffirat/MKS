
export interface ContactInfo {
  fullName: string;
  phoneNumber: string;
}

export const ContactService = {
  isSupported: (): boolean => {
    // Chrome Android ve bazı modern tarayıcılar için native contact picker kontrolü
    return 'contacts' in navigator && !!(navigator as any).contacts?.select;
  },

  getContactsNative: async (): Promise<ContactInfo[]> => {
    try {
      // Sadece isim ve telefon numaralarını istiyoruz
      const props = ['name', 'tel'];
      const options = { multiple: true };
      
      const contacts = await (navigator as any).contacts.select(props, options);
      
      if (!contacts || contacts.length === 0) return [];

      return contacts.map((c: any) => {
        // İsim dizisinden ilkini al, yoksa "İsimsiz"
        const name = c.name?.[0] || 'İsimsiz Çiftçi';
        // Telefon dizisinden ilkini al ve formatla
        const rawPhone = c.tel?.[0] || '';
        const formattedPhone = ContactService.formatPhoneNumber(rawPhone);

        return {
          fullName: name,
          phoneNumber: formattedPhone,
        };
      }).filter((c: ContactInfo) => c.phoneNumber.length > 10); // Çok kısa veya boş numaraları ele
    } catch (error) {
      console.warn("Native Contact picker failed or cancelled:", error);
      throw error; // UI tarafında yakalayıp dosya yüklemeye yönlendirmek için hatayı fırlat
    }
  },

  parseVCF: async (file: File): Promise<ContactInfo[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const contacts: ContactInfo[] = [];
            
            // VCF formatını bloklara ayır
            const vcardBlocks = text.split(/BEGIN:VCARD/i);
            
            vcardBlocks.forEach(block => {
              if (!block.trim()) return;
              let name = '';
              let tel = '';
              
              // 1. İsim Ayrıştırma (FN veya N alanları)
              // Quoted-Printable (Örn: =C3=A7 gibi karakterler) decode ediliyor
              const fnMatch = block.match(/^FN(?:;[^:]*)?:(.*)$/im);
              const nMatch = block.match(/^N(?:;[^:]*)?:(.*)$/im);
              
              let rawName = '';
              if (fnMatch?.[1]) {
                rawName = fnMatch[1];
              } else if (nMatch?.[1]) {
                rawName = nMatch[1].split(';').filter(p => p.trim()).reverse().join(' ');
              }

              // Quoted-printable decode denemesi
              try {
                  if (rawName.includes('=')) {
                      // Basit bir decode yaklaşımı
                      name = decodeURIComponent(rawName.replace(/=/g, '%')); 
                  } else {
                      name = rawName;
                  }
              } catch {
                  name = rawName; // Decode başarısız olursa ham hali kullan
              }
              name = name.replace(/\r/g, '').trim();

              // 2. Telefon Ayrıştırma
              // Standart TEL alanı veya iPhone formatlarını yakala
              const telMatches = block.matchAll(/^(?:.*?\.)?TEL(?:;[^:]*)?:(.*)$/gim);
              for (const match of telMatches) {
                if (match[1]) {
                  const cleaned = match[1].replace(/\r/g, '').trim();
                  if (cleaned) {
                    tel = ContactService.formatPhoneNumber(cleaned);
                    if (tel.length > 10) break; // Geçerli bir numara bulduysak döngüden çık
                  }
                }
              }
              
              if (tel && tel.length > 10) {
                contacts.push({
                  fullName: name || 'İsimsiz Kişi',
                  phoneNumber: tel
                });
              }
            });
            
            resolve(contacts);
        } catch (err) {
            reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Dosya okunamadı."));
      reader.readAsText(file);
    });
  },

  /**
   * Telefon numarasını standart +90 5XX XXX XX XX formatına çevirir.
   */
  formatPhoneNumber: (raw: string): string => {
    if (!raw) return '';
    
    // Tüm boşlukları, parantezleri ve tireleri temizle
    let cleaned = raw.replace(/\D/g, ''); 
    
    // Türkiye Numarası Mantığı
    // 1. Başında 90 varsa koru
    if (cleaned.startsWith('90') && cleaned.length > 10) {
        // Zaten 90 ile başlıyor, bir şey yapma
    } 
    // 2. Başında 0 varsa (0532...) -> 90532...
    else if (cleaned.startsWith('0')) {
        cleaned = '90' + cleaned.substring(1);
    }
    // 3. Sadece 5 ile başlıyorsa (532...) -> 90532...
    else if (cleaned.startsWith('5') && cleaned.length === 10) {
        cleaned = '90' + cleaned;
    }
    
    // Sonuç + ile başlamıyorsa ekle
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }

    // Okunabilirlik için boşluk ekleme (Opsiyonel, şimdilik veritabanı tutarlılığı için bitişik veya basit format)
    // Örn: +905321234567 -> +90 532 123 45 67
    if (cleaned.startsWith('+90') && cleaned.length === 13) {
        return `+90 ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9, 11)} ${cleaned.substring(11, 13)}`;
    }

    return cleaned;
  }
};
