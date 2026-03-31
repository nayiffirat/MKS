export const formatCurrency = (amount: number, currencyCode: 'TRY' | 'USD' | 'EUR' = 'TRY') => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
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
