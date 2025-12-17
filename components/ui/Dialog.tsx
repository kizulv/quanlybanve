
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export const Dialog: React.FC<DialogProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  className = '',
  headerClassName = ''
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  // Determine if we should apply default white bg or use provided one
  const bgClass = className.includes('bg-') ? '' : 'bg-white';
  const widthClass = className.includes('max-w-') ? '' : 'max-w-lg';

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Overlay background */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div 
        className={`
          relative rounded-xl shadow-2xl w-full ${widthClass} ${bgClass}
          flex flex-col max-h-[90vh] overflow-hidden 
          animate-in zoom-in-95 fade-in duration-200 border border-slate-200/20
          ${className}
        `}
        role="dialog"
        aria-modal="true"
      >
        <div className={`flex justify-between items-center px-4 py-3 border-b border-slate-100/10 shrink-0 ${headerClassName}`}>
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="h-8 w-8 opacity-70 hover:opacity-100 rounded-full hover:bg-white/10"
          >
            <X size={18} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>

        {footer && (
          <div className="px-4 py-3 border-t border-slate-100/10 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
