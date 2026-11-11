import React from 'react';
import { BRAND_BG } from '../constants';

export interface MksBrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<NonNullable<MksBrandLogoProps['size']>, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-11 h-11',
  xl: 'w-16 h-16',
};

/** Yaklaşık CSS piksel boyutu (srcSet/sizes ve width/height öznitelikleri için). */
const SIZE_PX: Record<NonNullable<MksBrandLogoProps['size']>, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 44,
  xl: 64,
};

const ROUNDED_CLASSES: Record<NonNullable<MksBrandLogoProps['rounded']>, string> = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

/**
 * UI-20/UI-21: Küçük boyutlarda 512px PNG'yi küçültmek yerine tarayıcı yoğunluğa göre
 * 192px (1x–4x küçük logolar) veya 512px kaynağı seçer; PNG yüklenemezse saf vektör logo.svg'ye düşer.
 */
export const MksBrandLogo: React.FC<MksBrandLogoProps> = ({
  size = 'md',
  rounded = 'xl',
  className = '',
  alt = 'MKS — Mühendis Kayıt Sistemi',
}) => {
  const px = SIZE_PX[size];
  return (
    <div
      className={`${SIZE_CLASSES[size]} ${ROUNDED_CLASSES[rounded]} border border-white/15 shadow-sm overflow-hidden flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ backgroundColor: BRAND_BG }}
    >
      <img
        src="/icons/icon-192.png?v=8.2.1"
        srcSet="/icons/icon-192.png?v=8.2.1 192w, /icons/icon-512.png?v=8.2.1 512w"
        sizes={`${px}px`}
        width={px}
        height={px}
        decoding="async"
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (!img.src.endsWith('/logo.svg')) {
            img.srcset = '';
            img.src = '/logo.svg';
          }
        }}
        alt={alt}
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  );
};
