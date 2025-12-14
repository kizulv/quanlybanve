import React from 'react';
import { Button } from './Button';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in" 
        onClick={() => onOpenChange(false)} 
      />
      {children}
    </div>
  );
};

export const AlertDialogContent: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <div className={`relative z-[201] grid w-full max-w-lg scale-100 gap-4 border bg-white p-6 opacity-100 shadow-lg animate-in fade-in-90 zoom-in-90 sm:rounded-lg md:w-full sm:max-w-[425px] m-4 ${className}`}>
    {children}
  </div>
);

export const AlertDialogHeader: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <div className={`flex flex-col space-y-2 text-center sm:text-left ${className}`}>
    {children}
  </div>
);

export const AlertDialogFooter: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 ${className}`}>
    {children}
  </div>
);

export const AlertDialogTitle: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-slate-900 ${className}`}>
    {children}
  </h3>
);

export const AlertDialogDescription: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <p className={`text-sm text-slate-500 ${className}`}>
    {children}
  </p>
);

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export const AlertDialogAction: React.FC<AlertDialogActionProps> = ({ children, className = '', ...props }) => (
  <Button className={`${className}`} {...props}>
    {children}
  </Button>
);

export const AlertDialogCancel: React.FC<AlertDialogActionProps> = ({ children, className = '', ...props }) => (
  <Button variant="outline" className={`mt-2 sm:mt-0 ${className}`} {...props}>
    {children}
  </Button>
);