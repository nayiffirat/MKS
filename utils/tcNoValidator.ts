/**
 * T.C. Kimlik Numarası Doğrulama Algoritması (Modüler Aritmetik)
 * 1. İlk hane 0 olamaz.
 * 2. 10. hane = ((Tekler * 7) - Çiftler) mod 10
 *    Tekler: 1, 3, 5, 7, 9. haneler (0, 2, 4, 6, 8. indeksler)
 *    Çiftler: 2, 4, 6, 8. haneler (1, 3, 5, 7. indeksler)
 * 3. 11. hane = (İlk 10 hanenin toplamı) mod 10
 */
export function isValidTcNo(tc: string): boolean {
  tc = tc.trim();
  if (!/^[1-9][0-9]{10}$/.test(tc)) return false;

  const d = tc.split('').map(Number);

  const T = d[0] + d[2] + d[4] + d[6] + d[8];
  const C = d[1] + d[3] + d[5] + d[7];

  const calculatedD10 = (((T * 7 - C) % 10) + 10) % 10;
  if (d[9] !== calculatedD10) return false;

  const sumFirst10 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  const calculatedD11 = sumFirst10 % 10;
  if (d[10] !== calculatedD11) return false;

  return true;
}

/**
 * 10 Haneli Vergi Kimlik Numarası (VKN) Doğrulama Algoritması (GİB Formülü)
 * 1. İlk 9 hanenin her biri için: a = (d_i + (9 - i)) mod 10
 * 2. Üs alma: a != 0 ise v = (a * 2^(9-i)) mod 9. Kalan 0 ise v = 9
 * 3. Toplama: İlk 9 hane için hesaplanan değerlerin toplamı (sum)
 * 4. Son Hane (Kontrol Basamağı): (10 - (sum mod 10)) mod 10 = 10. hane
 */
export function isValidVkn(vkn: string): boolean {
  vkn = vkn.trim();
  if (!/^[0-9]{10}$/.test(vkn)) return false;

  const d = vkn.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    const a = (d[i] + (9 - i)) % 10;
    if (a !== 0) {
      const power = Math.pow(2, 9 - i);
      let v = (a * power) % 9;
      if (v === 0) v = 9;
      sum += v;
    }
  }

  const lastDigitCalc = (10 - (sum % 10)) % 10;
  return d[9] === lastDigitCalc;
}

export type TcValidationResult = {
  isValid: boolean;
  status: 'EMPTY' | 'VALID_TC' | 'VALID_VKN' | 'INVALID_LENGTH' | 'INVALID_TC_ALGORITHM' | 'INVALID_VKN_ALGORITHM';
  message: string;
};

export function validateTcNo(value?: string): TcValidationResult {
  return validateTcOrVkn(value);
}

export function validateTcOrVkn(value?: string): TcValidationResult {
  const val = (value || '').trim();
  if (!val) {
    return { isValid: true, status: 'EMPTY', message: '' };
  }

  if (val.length === 10) {
    if (isValidVkn(val)) {
      return { isValid: true, status: 'VALID_VKN', message: 'Geçerli Vergi Kimlik Numarası (VKN)' };
    } else {
      return { isValid: false, status: 'INVALID_VKN_ALGORITHM', message: 'Geçersiz Vergi Kimlik Numarası (VKN Algoritma Hatası)' };
    }
  }

  if (val.length === 11) {
    if (isValidTcNo(val)) {
      return { isValid: true, status: 'VALID_TC', message: 'Geçerli T.C. Kimlik Numarası' };
    } else {
      return { isValid: false, status: 'INVALID_TC_ALGORITHM', message: 'Geçersiz T.C. Kimlik Numarası (Algoritma Hatası)' };
    }
  }

  return { 
    isValid: false, 
    status: 'INVALID_LENGTH', 
    message: `TC Kimlik 11 hane veya VKN 10 hane olmalıdır (Şu an: ${val.length} hane)` 
  };
}


