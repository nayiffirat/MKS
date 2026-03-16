
import React from 'react';
import { Type, User, ChevronRight, Briefcase, UserRound, Sun, Settings, RefreshCw } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { UIScale } from '../types';

interface SettingsProps {
    onNavigate: (view: any) => void;
}

export const SettingsScreen: React.FC<SettingsProps> = ({ onNavigate }) => {
  const { uiScale, setUiScale, userProfile, updateUserProfile, performManualTurnover } = useAppViewModel();

  const handleScaleChange = (scale: UIScale) => {
    setUiScale(scale);
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
          
          <div className="flex p-1 bg-stone-950/40 rounded-2xl border border-stone-800 mb-6">
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

          <div className="flex items-center justify-between p-4 bg-stone-950/40 rounded-2xl border border-stone-800 mb-6">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg">
                      <Sun size={18} />
                  </div>
                  <div>
                      <h4 className="text-xs font-bold text-stone-200">Yüksek Kontrast (Saha Modu)</h4>
                      <p className="text-[9px] text-stone-600 font-bold uppercase">Güneş altında daha iyi görünürlük</p>
                  </div>
              </div>
              <button 
                onClick={() => updateUserProfile({ ...userProfile, highContrastMode: !userProfile.highContrastMode })}
                className={`w-12 h-6 rounded-full relative transition-all duration-300 ${userProfile.highContrastMode ? 'bg-emerald-500' : 'bg-stone-800'}`}
              >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${userProfile.highContrastMode ? 'left-7' : 'left-1'}`}></div>
              </button>
          </div>

          {/* Voice Selection */}
          <div className="flex items-center space-x-3 mb-4 mt-6">
              <div className="p-2.5 bg-emerald-900/30 text-emerald-400 rounded-xl">
                  <UserRound size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">Asistan Sesi</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Saha Asistanı Karakteri</p>
              </div>
          </div>
          <div className="flex p-1 bg-stone-950/40 rounded-2xl border border-stone-800">
              <button
                  onClick={() => updateUserProfile({ ...userProfile, assistantVoice: 'male' })}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                      userProfile.assistantVoice === 'male' || !userProfile.assistantVoice
                      ? 'bg-emerald-600 text-white shadow-lg' 
                      : 'text-stone-600 hover:text-stone-300'
                  }`}
              >
                  Erkek (Tok)
              </button>
              <button
                  onClick={() => updateUserProfile({ ...userProfile, assistantVoice: 'female' })}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 ${
                      userProfile.assistantVoice === 'female'
                      ? 'bg-emerald-600 text-white shadow-lg' 
                      : 'text-stone-600 hover:text-stone-300'
                  }`}
              >
                  Kadın (Sakin)
              </button>
          </div>
      </div>

      {/* System Operations */}
      <div className="bg-stone-900/60 backdrop-blur rounded-[2.5rem] p-6 shadow-sm border border-white/5 mb-6">
          <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 bg-purple-900/30 text-purple-400 rounded-xl">
                  <RefreshCw size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-stone-100 text-lg tracking-tight">Sistem İşlemleri</h3>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Yıl Sonu İşlemleri</p>
              </div>
          </div>
          
          <button 
            onClick={() => {
              if (window.confirm('Yeni yıla devir işlemi yapmak istediğinize emin misiniz? Bu işlem mevcut bakiyeleri yeni yıla devir bakiyesi olarak aktaracaktır.')) {
                performManualTurnover();
              }
            }}
            className="w-full flex items-center justify-between p-4 bg-stone-950/40 rounded-2xl border border-stone-800 hover:border-purple-500/50 hover:bg-stone-900 transition-all group"
          >
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-colors">
                      <RefreshCw size={18} />
                  </div>
                  <div className="text-left">
                      <h4 className="text-xs font-bold text-stone-200 group-hover:text-purple-400 transition-colors">Yeni Yıla Devret</h4>
                      <p className="text-[9px] text-stone-600 font-bold uppercase">Bakiyeleri yeni yıla aktar</p>
                  </div>
              </div>
              <ChevronRight size={18} className="text-stone-700 group-hover:text-purple-400 transition-colors" />
          </button>
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
