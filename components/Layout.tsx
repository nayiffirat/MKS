import React from 'react';
import { Home, Users, BookOpen, FileText, ClipboardList } from 'lucide-react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  const navItems = [
    { id: 'DASHBOARD', icon: Home, label: 'Ana Sayfa' },
    { id: 'FARMERS', icon: Users, label: 'Çiftçiler' },
    { id: 'PESTICIDES', icon: BookOpen, label: 'İlaçlar' },
    { id: 'PRESCRIPTIONS', icon: FileText, label: 'Reçeteler' },
    { id: 'VISITS', icon: ClipboardList, label: 'Ziyaretler' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-earth-50">
      {/* Sidebar (Desktop) */}
      <nav className="hidden md:flex flex-col w-64 bg-agri-800 text-white fixed h-full z-20">
        <div className="p-6 border-b border-agri-700">
          <h1 className="text-xl font-bold flex items-center">
            🌱 MKS Tarım
          </h1>
        </div>
        <div className="flex-1 py-6 px-4 space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewState)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                currentView === item.id 
                  ? 'bg-white text-agri-800 shadow-lg font-bold' 
                  : 'text-agri-100 hover:bg-agri-700'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 relative min-h-screen">
        {/* Mobile Header */}
        <div className="md:hidden bg-agri-800 text-white p-4 sticky top-0 z-30 shadow-md flex justify-between items-center">
           <h1 className="font-bold text-lg">🌱 MKS Tarım</h1>
        </div>

        {children}
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-stone-200 z-50 pb-safe">
        <div className="flex justify-around items-center p-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewState)}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                currentView === item.id 
                  ? 'text-agri-600' 
                  : 'text-stone-400'
              }`}
            >
              <item.icon size={24} className={currentView === item.id ? 'fill-current opacity-20' : ''} />
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};