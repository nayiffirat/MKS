
import React from 'react';
import { Type, User, ChevronRight, Briefcase, Volume2, Mic, UserRound } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { UIScale } from '../types';

interface SettingsProps {
    onNavigate: (view: any) => void;
}

export const SettingsScreen: React.FC<SettingsProps> = ({ onNavigate }) => {
  const { uiScale, setUiScale, userProfile, updateUserProfile } = useAppViewModel();

  const handleScaleChange = (scale: UIScale) => {
    setUiScale(scale);
  };

  const handleVoiceChange = (voice: 'MALE' | 'FEMALE') => {
      updateUserProfile({ ...userProfile, assistantVoice: voice });
  };

  return (
    <div className="pb-32 animate-in fade-in duration-300 px-4">
      
      {/* Profile Settings Section */}
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 mb-6 mt-4">
          <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-emerald-900/30 text-emerald-400 rounded-xl">
                  <User size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">Hesap Ayarları</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Kişisel Bilgiler</p>
              </div>
          </div>

          <div 
            onClick={() => onNavigate('PROFILE')}
            className="flex items-center justify-between bg-stone-950/40 p-4 rounded-2xl border border-stone-800 cursor-pointer hover:border-emerald-500/50 hover:bg-stone-900 transition-all group"
          >
              <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center border-2 border-emerald-500/20 text-emerald-500 group-hover:border-emerald-500 transition-colors">
                      <span className="text-lg font-bold">{userProfile.fullName ? userProfile.fullName.charAt(0).toUpperCase() : 'U'}</span>
                  </div>
                  <div className="min-w-0">
                      <h4 className="font-bold text-stone-200 group-hover:text-emerald-400 transition-colors truncate">
                          {userProfile.fullName || 'Profil Oluştur'}
                      </h4>
                      <p className="text-[10px] text-stone-500 font-bold uppercase truncate">
                          {userProfile.title || 'Düzenlemek için dokun'}
                      </p>
                  </div>
              </div>
              <ChevronRight size={20} className="text-stone-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
      </div>

      {/* Assistant Voice Settings */}
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 mb-6">
          <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-amber-900/30 text-amber-400 rounded-xl">
                  <Mic size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">Saha Asistanı</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Ses Tercihleri</p>
              </div>
          </div>
          
          <p className="text-stone-400 text-xs mb-5 font-medium leading-relaxed">
              Saha modunda asistanın size hangi ses tonuyla hitap etmesini istersiniz?
          </p>

          <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVoiceChange('MALE')}
                className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                    userProfile.assistantVoice === 'MALE' 
                    ? 'bg-amber-600 border-amber-500 text-white shadow-lg' 
                    : 'bg-stone-950/40 border-stone-800 text-stone-500 hover:border-amber-500/30'
                }`}
              >
                  <div className={`p-2 rounded-lg ${userProfile.assistantVoice === 'MALE' ? 'bg-white/20' : 'bg-stone-800'}`}>
                      <UserRound size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider">Erkek (Tok)</span>
              </button>

              <button
                onClick={() => handleVoiceChange('FEMALE')}
                className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                    userProfile.assistantVoice === 'FEMALE' 
                    ? 'bg-amber-600 border-amber-500 text-white shadow-lg' 
                    : 'bg-stone-950/40 border-stone-800 text-stone-500 hover:border-amber-500/30'
                }`}
              >
                  <div className={`p-2 rounded-lg ${userProfile.assistantVoice === 'FEMALE' ? 'bg-white/20' : 'bg-stone-800'}`}>
                      <UserRound size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider">Kadın (Etkili)</span>
              </button>
          </div>
      </div>

      {/* Accessibility / UI Size Settings */}
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 mb-6">
          <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-blue-900/30 text-blue-400 rounded-xl">
                  <Type size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">Erişilebilirlik</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Arayüz Ölçeği</p>
              </div>
          </div>
          
          <div className="flex p-1 bg-stone-950/40 rounded-2xl border border-stone-800">
              {(['SMALL', 'MEDIUM', 'LARGE'] as const).map((scaleOption) => {
                  const isActive = uiScale === scaleOption;
                  let label = scaleOption === 'SMALL' ? 'Küçük' : scaleOption === 'MEDIUM' ? 'Orta' : 'Büyük';

                  return (
                      <button
                          key={scaleOption}
                          onClick={() => handleScaleChange(scaleOption)}
                          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                              isActive 
                              ? 'bg-blue-600 text-white shadow-lg' 
                              : 'text-stone-600 hover:text-stone-300'
                          }`}
                      >
                          {label}
                      </button>
                  );
              })}
          </div>
      </div>

      {/* App Info Footer */}
      <div className="text-center py-8">
          <div className="w-12 h-12 bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-900/30 shadow-inner">
              <span className="font-black text-sm">MKS</span>
          </div>
          <h2 className="font-black text-xs text-stone-500 uppercase tracking-[0.2em]">Mühendis Kayıt Sistemi</h2>
          <p className="text-[10px] text-stone-700 mt-1 font-bold">PREMIUM v2.5.1</p>
          <p className="text-[9px] text-stone-800 mt-6 uppercase tracking-widest">© 2026 Nayif Fırat</p>
      </div>

    </div>
  );
};
