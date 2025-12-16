import React, { useState, createContext, useContext, useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface SheetContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const SheetContext = createContext<SheetContextValue | undefined>(undefined);

export const Sheet: React.FC<{
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}> = ({ children, open: controlledOpen, onOpenChange }) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setIsOpen = (newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen);
    else setUncontrolledOpen(newOpen);
  };

  return (
    <SheetContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </SheetContext.Provider>
  );
};

export const SheetTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = "",
  asChild
}) => {
  const context = useContext(SheetContext);
  if (!context) throw new Error("SheetTrigger must be used within Sheet");

  const handleClick = () => context.setIsOpen(true);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        handleClick();
      },
      className: `${children.props.className || ''} ${className}`.trim() || undefined
    });
  }

  return (
    <div onClick={handleClick} className={`cursor-pointer ${className}`}>
      {children}
    </div>
  );
};

export const SheetContent: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  side?: "right" | "left" 
}> = ({ children, className = "", side = "right" }) => {
  const context = useContext(SheetContext);
  if (!context) throw new Error("SheetContent must be used within Sheet");

  const { isOpen, setIsOpen } = context;

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={() => setIsOpen(false)}
      />
      
      {/* Content */}
      <div 
        className={`
          fixed inset-y-0 right-0 z-[101] h-full w-full sm:w-[400px] border-l bg-white p-6 shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300
          ${className}
        `}
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
};

export const SheetHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`flex flex-col space-y-2 text-center sm:text-left mb-6 ${className}`}>
    {children}
  </div>
);

export const SheetTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <h3 className={`text-lg font-semibold text-slate-950 ${className}`}>
    {children}
  </h3>
);

export const SheetDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <p className={`text-sm text-slate-500 ${className}`}>
    {children}
  </p>
);