
import React, { useEffect, useState, useRef } from 'react';
import { AdMob, BannerAdSize, BannerAdPosition, BannerAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

export const AdBanner: React.FC = () => {
    const [isNative, setIsNative] = useState(false);
    const adInitialized = useRef(false);

    useEffect(() => {
        // Platform kontrolü
        if (Capacitor.isNativePlatform()) {
            setIsNative(true);
            
            const initializeAdMob = async () => {
                if (adInitialized.current) return;
                
                try {
                    // Android Test ID: 'ca-app-pub-3940256099942544/6300978111'
                    // Canlıya alırken kendi ID'niz ile değiştirin (Örn: 'ca-app-pub-8216705362885050/XXXXXXXXXX')
                    const adId = 'ca-app-pub-3940256099942544/6300978111';

                    const options: BannerAdOptions = {
                        adId: adId, 
                        adSize: BannerAdSize.ADAPTIVE_BANNER, // Daha iyi görünüm için Adaptive
                        position: BannerAdPosition.BOTTOM_CENTER, 
                        margin: 0,
                        isTesting: true // GERÇEK YAYINDA BUNU 'false' YAPIN!
                    };

                    await AdMob.showBanner(options);
                    adInitialized.current = true;
                } catch (error) {
                    console.error('AdMob Banner Error:', error);
                }
            };

            // Biraz gecikmeli başlat ki UI render olsun
            setTimeout(initializeAdMob, 1000);
        } else {
            // Web ortamı için AdSense tetikleme
            try {
                setTimeout(() => {
                    if (window.adsbygoogle) {
                        try {
                            (window.adsbygoogle = window.adsbygoogle || []).push({});
                        } catch (e) {
                            // Hata yutulur (Slot dolu veya adblocker)
                        }
                    }
                }, 1000);
            } catch (e) {
                console.error("AdSense Error", e);
            }
        }

        // Cleanup: Bileşen ekrandan kalktığında native banner'ı kaldır
        return () => {
            if (Capacitor.isNativePlatform()) {
                AdMob.removeBanner().catch(err => console.error('AdMob Remove Error', err));
                adInitialized.current = false;
            }
        };
    }, []);

    // Native platformda HTML render etmeye gerek yok (Native Overlay çalışır)
    // Sadece yer tutucu div bırakıyoruz ki layout bozulmasın (native overlay bunun üzerine gelir genellikle)
    if (isNative) return <div className="h-[50px] w-full bg-transparent"></div>;

    // Web için AdSense Alanı
    return (
        <div className="w-full flex justify-center items-center my-2 min-h-[90px] bg-stone-900/40 border-y border-white/5 overflow-hidden relative backdrop-blur-sm">
            <div className="absolute text-[8px] text-stone-600 top-0.5 right-1 font-mono uppercase tracking-widest opacity-50">Sponsorlu</div>
            {/* Google AdSense */}
            <ins className="adsbygoogle"
                 style={{ display: 'block', width: '100%', textAlign: 'center' }}
                 data-ad-client="ca-pub-8216705362885050"
                 data-ad-slot="88888888" 
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
        </div>
    ); 
};
