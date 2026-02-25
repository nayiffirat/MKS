import React from 'react';
import { Mail, User, Heart, MessageCircle, Info } from 'lucide-react';

export const ContactScreen: React.FC = () => {
  return (
    <div className="p-4 pb-24 animate-in fade-in duration-300 max-w-lg mx-auto">
        
        {/* Profile / Intro Card */}
        <div className="bg-stone-900/80 backdrop-blur rounded-3xl p-8 shadow-xl border border-white/5 text-center mb-6 relative overflow-hidden">
            {/* Decorative background element */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-900/30 to-transparent -z-10"></div>

            <div className="w-24 h-24 bg-stone-800 border-4 border-emerald-500/30 rounded-full mx-auto flex items-center justify-center mb-4 shadow-2xl relative">
                <User size={40} className="text-emerald-500" />
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-2 border-stone-800 rounded-full flex items-center justify-center">
                    <Info size={14} className="text-stone-900" />
                </div>
            </div>

            <h2 className="text-2xl font-bold text-stone-100 mb-1">Nayif Fırat</h2>
            <div className="inline-block px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-500/20 mb-6">
                <p className="text-emerald-400 text-xs font-bold tracking-wide uppercase">Ziraat Mühendisi</p>
            </div>

            <div className="bg-stone-950/50 p-5 rounded-xl border border-white/5 mb-2 relative">
                <span className="absolute top-2 left-2 text-4xl text-stone-700 font-serif leading-3 opacity-50">“</span>
                <p className="text-stone-300 italic text-sm leading-relaxed px-2">
                    Değerli meslektaşlarım; bu uygulamayı sahadaki iş yükümüzü hafifletmek, verimliliğimizi artırmak ve teknolojiyle tarımı buluşturmak amacıyla bizler için geliştirdim. Her türlü görüş ve öneriniz benim için çok kıymetli.
                </p>
                <span className="absolute bottom-[-10px] right-4 text-4xl text-stone-700 font-serif leading-3 opacity-50">”</span>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
            <a
                href="https://wa.me/905428254087"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-[#20bd5a] transition-all active:scale-95 group relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <MessageCircle className="mr-3" size={24} />
                WhatsApp ile Ulaş
            </a>

            <a
                href="mailto:nayiffirat@gmail.com"
                className="flex items-center justify-center w-full py-4 bg-stone-800 text-stone-200 rounded-2xl font-bold border border-white/5 hover:bg-stone-700 transition-all active:scale-95"
            >
                <Mail className="mr-3 text-stone-400" size={24} />
                E-Posta Gönder
            </a>
        </div>

        <div className="mt-12 text-center opacity-60">
            <p className="text-stone-600 text-xs flex items-center justify-center">
                Meslektaşlarınız için <Heart size={12} className="text-red-800 mx-1 fill-red-900" /> ile geliştirildi.
            </p>
        </div>
    </div>
  );
};