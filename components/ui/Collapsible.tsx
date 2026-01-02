import React, { useState, createContext, useContext } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleContextType {
  isOpen: boolean;
  toggle: () => void;
}

const CollapsibleContext = createContext<CollapsibleContextType | undefined>(
  undefined
);

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Collapsible: React.FC<CollapsibleProps> = ({
  open,
  onOpenChange,
  defaultOpen = false,
  children,
  className = "",
  disabled = false,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const isOpen = disabled ? true : open !== undefined ? open : internalOpen;

  const toggle = () => {
    if (disabled) return;
    const nextOpen = !isOpen;
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };

  return (
    <CollapsibleContext.Provider value={{ isOpen, toggle }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  );
};

export const CollapsibleTrigger: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  const context = useContext(CollapsibleContext);
  if (!context)
    throw new Error("CollapsibleTrigger must be used within Collapsible");

  return (
    <div
      onClick={context.toggle}
      className={`cursor-pointer select-none flex items-center justify-between ${className}`}
    >
      {children}
      <div className="lg:hidden mr-2 transition-transform duration-200">
        {context.isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
    </div>
  );
};

export const CollapsibleContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  const context = useContext(CollapsibleContext);
  if (!context)
    throw new Error("CollapsibleContent must be used within Collapsible");

  if (!context.isOpen) return null;

  return (
    <div
      className={`overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${className}`}
    >
      {children}
    </div>
  );
};
