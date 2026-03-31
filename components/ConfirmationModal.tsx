
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Evet, Sil',
  cancelText = 'Vazgeç',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle className="text-rose-500" size={24} />,
          button: 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20',
          bg: 'bg-rose-500/10 border-rose-500/20'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="text-amber-500" size={24} />,
          button: 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20',
          bg: 'bg-amber-500/10 border-amber-500/20'
        };
      default:
        return {
          icon: <AlertTriangle className="text-blue-500" size={24} />,
          button: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20',
          bg: 'bg-blue-500/10 border-blue-500/20'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-sm bg-stone-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${styles.bg} border`}>
                {styles.icon}
              </div>
              <button onClick={onClose} className="p-2 text-stone-500 hover:text-stone-300 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <h3 className="text-lg font-black text-stone-100 mb-2 tracking-tight">{title}</h3>
            <p className="text-sm text-stone-400 leading-relaxed">{message}</p>
          </div>
          
          <div className="p-4 bg-stone-950/50 border-t border-white/5 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-stone-800 text-stone-300 font-bold text-xs uppercase tracking-widest hover:bg-stone-700 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-3 px-4 rounded-xl text-white font-bold text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${styles.button}`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
