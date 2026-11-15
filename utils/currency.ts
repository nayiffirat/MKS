export const roundAmount = (amount: number): number => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const round2 = roundAmount;

export const parseTrDecimal = (val: unknown): number => {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (val === null || val === undefined) return 0;
  let s = String(val)
    .trim()
    .replace(/[₺$€]/g, '')
    .replace(/(?<![a-zA-Z])(?:TRY|USD|EUR|TL)(?![a-zA-Z])/gi, '')
    .replace(/\s+/g, '');
  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaCount = (s.match(/,/g) || []).length;
    s = commaCount > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      s = s.replace(/\./g, '');
    }
  }

  const num = Number(s);
  return Number.isFinite(num) ? num : 0;
};

export const formatCurrency = (amount: number, currencyCode: 'TRY' | 'USD' | 'EUR' = 'TRY') => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(roundAmount(amount));
};

export const getCurrencySymbol = (currencyCode: 'TRY' | 'USD' | 'EUR' = 'TRY') => {
  switch (currencyCode) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'TRY':
    default: return '₺';
  }
};

export const getCurrencySuffix = (currencyCode: 'TRY' | 'USD' | 'EUR' = 'TRY') => {
  switch (currencyCode) {
    case 'USD': return 'USD';
    case 'EUR': return 'EUR';
    case 'TRY':
    default: return 'TL';
  }
};
