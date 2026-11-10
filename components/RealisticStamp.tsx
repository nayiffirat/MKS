import React from 'react';
import { UserProfile } from '../types';

interface RealisticStampProps {
  profile?: UserProfile | null;
  engineerName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  shape?: 'RECTANGLE' | 'OVAL';
  color?: string;
  title?: string;
  subTitle?: string;
  taxInfo?: string;
  tradeInfo?: string;
  addressPhone?: string;
  className?: string;
  showSignature?: boolean;
  tiltAngle?: number; // e.g. -2.5
}

export const RealisticStamp: React.FC<RealisticStampProps> = ({
  profile,
  engineerName,
  size = 'md',
  shape,
  color,
  title,
  subTitle,
  taxInfo,
  tradeInfo,
  addressPhone,
  className = '',
  showSignature = true,
  tiltAngle = -2.5,
}) => {
  // Determine effective values from props or userProfile or fallback defaults
  const isEnabled = profile?.stampEnabled ?? true;
  if (!isEnabled) return null;

  const effectiveTitle = (title || profile?.stampTitle || profile?.companyName || 'ZİRAİ OTOMASYON TARIM ÜRÜNLERİ').toUpperCase();
  const effectiveSubTitle = subTitle || profile?.stampSubTitle || (profile?.title ? `${profile.title} ${profile?.fullName || ''}`.trim() : engineerName || profile?.fullName || 'Ziraat Mühendisi');
  const effectiveTaxInfo = taxInfo || profile?.stampTaxInfo || (profile?.selectedCity ? `${profile.selectedCity.name} V.D. - 1234567890` : 'Vergi D. - 1234567890');
  const effectiveTradeInfo = tradeInfo || profile?.stampTradeInfo || 'Tic. Sic. No: 45892';
  const effectiveAddress = addressPhone || profile?.stampAddressPhone || (profile?.phoneNumber ? `Tel: ${profile.phoneNumber}` : '');
  
  const effectiveShape = shape || profile?.stampShape || 'RECTANGLE';
  const effectiveColor = color || profile?.stampColor || '#1d4ed8'; // Classic Stamp Blue

  // Size scalers
  const sizeMap = {
    xs: { scale: 'scale-75 origin-bottom-right', pxWidth: 200 },
    sm: { scale: 'scale-90 origin-center', pxWidth: 240 },
    md: { scale: 'scale-100 origin-center', pxWidth: 280 },
    lg: { scale: 'scale-110 origin-center', pxWidth: 320 },
  };

  const scaleClass = sizeMap[size].scale;

  // SVG Filter unique ID to avoid DOM collisions
  const filterId = `stamp-distort-${Math.random().toString(36).substring(2, 7)}`;

  return (
    <div className={`inline-block select-none ${scaleClass} ${className}`}>
      {/* SVG Definitions for Stamp Ink Noise and Grunge Filter */}
      <svg className="absolute w-0 h-0 overflow-hidden" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
            {/* Turbulence creates natural rubber stamp imperfections and ink bleed */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.6"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            {/* Soften edges slightly */}
            <feGaussianBlur in="displaced" stdDeviation="0.25" result="blurred" />
            <feMerge>
              <feMergeNode in="blurred" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div
        style={{
          transform: `rotate(${tiltAngle}deg)`,
          filter: `url(#${filterId})`,
          mixBlendMode: 'multiply',
          color: effectiveColor,
          borderColor: effectiveColor,
        }}
        className="relative transition-transform duration-300 pointer-events-none"
      >
        {effectiveShape === 'RECTANGLE' ? (
          /* --- RECTANGULAR OFFICIAL CORPORATE STAMP --- */
          <div
            className="border-[2.5px] rounded-lg p-2.5 text-center relative max-w-[290px] shadow-sm bg-transparent"
            style={{ borderColor: effectiveColor }}
          >
            {/* Inner Thin Border with Double Line Effect */}
            <div
              className="border-[1px] border-dashed rounded p-2 flex flex-col justify-between items-center"
              style={{ borderColor: `${effectiveColor}cc` }}
            >
              {/* Company Title */}
              <div className="font-extrabold uppercase tracking-tight text-[11px] leading-tight mb-1 text-center font-serif" style={{ color: effectiveColor }}>
                {effectiveTitle}
              </div>

              <div className="w-full border-t my-1 opacity-60" style={{ borderColor: effectiveColor }}></div>

              {/* Authorized Name & Title */}
              <div className="font-black uppercase tracking-wider text-[10px] leading-tight mb-0.5" style={{ color: effectiveColor }}>
                {effectiveSubTitle}
              </div>

              {/* Tax & Trade Registration Info */}
              <div className="text-[8.5px] font-bold tracking-tight opacity-90 leading-tight">
                {effectiveTaxInfo} {effectiveTradeInfo ? `| ${effectiveTradeInfo}` : ''}
              </div>

              {/* Address & Phone */}
              {effectiveAddress && (
                <div className="text-[8px] font-semibold tracking-tight opacity-80 leading-tight mt-0.5 truncate max-w-[250px]">
                  {effectiveAddress}
                </div>
              )}

              {/* Handwritten Blue/Dark Ink Signature Overlay */}
              {showSignature && (
                <div className="mt-1 -mb-1 relative h-6 w-full flex items-center justify-center opacity-85">
                  <svg viewBox="0 0 160 35" className="h-full w-auto" style={{ stroke: effectiveColor, fill: 'none' }}>
                    <path
                      d="M 10,22 Q 35,5 45,28 T 75,12 Q 90,30 110,8 T 135,25 Q 150,15 155,20"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M 25,28 Q 70,33 130,22"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.8"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Stamp Authenticity Corner Notches */}
            <div className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l" style={{ borderColor: effectiveColor }}></div>
            <div className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r" style={{ borderColor: effectiveColor }}></div>
            <div className="absolute bottom-1 left-1 w-1.5 h-1.5 border-b border-l" style={{ borderColor: effectiveColor }}></div>
            <div className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r" style={{ borderColor: effectiveColor }}></div>
          </div>
        ) : (
          /* --- OVAL OFFICIAL STAMP --- */
          <div className="relative w-[210px] h-[135px] flex items-center justify-center">
            <svg viewBox="0 0 220 140" className="w-full h-full overflow-visible">
              {/* Outer Oval */}
              <ellipse
                cx="110"
                cy="70"
                rx="102"
                ry="62"
                fill="none"
                stroke={effectiveColor}
                strokeWidth="3"
              />
              {/* Inner Oval */}
              <ellipse
                cx="110"
                cy="70"
                rx="94"
                ry="54"
                fill="none"
                stroke={effectiveColor}
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />

              {/* Top Arc Path for Curved Text */}
              <path
                id={`curve-top-${filterId}`}
                d="M 20,70 A 90,50 0 0,1 200,70"
                fill="none"
              />
              {/* Bottom Arc Path for Curved Text */}
              <path
                id={`curve-bottom-${filterId}`}
                d="M 200,70 A 90,50 0 0,1 20,70"
                fill="none"
              />

              {/* Top Curved Text */}
              <text fill={effectiveColor} fontSize="9" fontWeight="900" letterSpacing="1">
                <textPath href={`#curve-top-${filterId}`} startOffset="50%" textAnchor="middle">
                  {effectiveTitle.length > 32 ? `${effectiveTitle.substring(0, 30)}..` : effectiveTitle}
                </textPath>
              </text>

              {/* Bottom Curved Text */}
              <text fill={effectiveColor} fontSize="8" fontWeight="700" letterSpacing="0.5">
                <textPath href={`#curve-bottom-${filterId}`} startOffset="50%" textAnchor="middle">
                  {effectiveTaxInfo}
                </textPath>
              </text>

              {/* Center Content */}
              <g textAnchor="middle" fill={effectiveColor}>
                <text x="110" y="60" fontSize="10" fontWeight="900" textAnchor="middle">
                  {effectiveSubTitle}
                </text>
                <text x="110" y="73" fontSize="7.5" fontWeight="700" textAnchor="middle" opacity="0.9">
                  {effectiveTradeInfo}
                </text>
                <text x="110" y="85" fontSize="7" fontWeight="600" textAnchor="middle" opacity="0.8">
                  {effectiveAddress ? (effectiveAddress.length > 28 ? effectiveAddress.substring(0, 26) + '..' : effectiveAddress) : 'RESMİ ONAYLI KAŞE'}
                </text>
              </g>

              {/* Side Accent Stars */}
              <text x="24" y="73" fill={effectiveColor} fontSize="10" textAnchor="middle">★</text>
              <text x="196" y="73" fill={effectiveColor} fontSize="10" textAnchor="middle">★</text>
            </svg>

            {/* Handwritten Signature Overlay */}
            {showSignature && (
              <div className="absolute inset-0 flex items-center justify-center opacity-85 pointer-events-none">
                <svg viewBox="0 0 160 40" className="w-32 h-auto" style={{ stroke: effectiveColor, fill: 'none' }}>
                  <path
                    d="M 15,22 Q 40,8 50,30 T 80,15 Q 95,32 115,10 T 140,28"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
