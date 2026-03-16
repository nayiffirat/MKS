import React from 'react';
import { Lock, LogOut } from 'lucide-react';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

interface SubscriptionLockProps {
  subscriptionEndsAt: string;
}

export const SubscriptionLock: React.FC<SubscriptionLockProps> = ({ subscriptionEndsAt }) => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const endDate = new Date(subscriptionEndsAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-stone-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-stone-900 border border-red-500/30 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-red-500/10 blur-[50px] pointer-events-none" />
        
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 relative z-10">
          <Lock size={32} className="text-red-500" />
        </div>
        
        <h1 className="text-2xl font-black text-white mb-2 relative z-10">Aboneliğiniz Sona Erdi</h1>
        <p className="text-stone-400 mb-8 relative z-10">
          Uygulama kullanım süreniz <strong className="text-white">{endDate}</strong> tarihinde dolmuştur. Sisteme erişmeye devam etmek için lütfen yönetici ile iletişime geçin.
        </p>
        
        <div className="w-full space-y-3 relative z-10">
          <a 
            href="mailto:nayiffirat@gmail.com"
            className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
          >
            Yöneticiye Ulaş
          </a>
          
          <button 
            onClick={handleLogout}
            className="w-full py-4 bg-stone-800 text-stone-300 rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stone-700 transition-colors"
          >
            <LogOut size={18} />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
};
