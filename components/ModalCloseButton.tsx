import React from 'react';
import { X } from 'lucide-react';

export interface ModalCloseButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  iconSize?: number;
}

export const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({
  onClick,
  label = 'Kapat',
  className = '',
  iconSize = 20
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    data-mks-modal-close="true"
    className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-300 hover:text-white bg-stone-800/80 hover:bg-stone-700/90 border border-white/10 transition-colors shrink-0 ${className}`.trim()}
  >
    <X size={iconSize} />
  </button>
);

export default ModalCloseButton;
