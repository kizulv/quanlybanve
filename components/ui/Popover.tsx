import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  trigger: React.ReactNode;
  content: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export const Popover: React.FC<PopoverProps> = ({ trigger, content, align = 'left', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, right: 0, width: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (isOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY + 8, // 8px offset
          left: rect.left + window.scrollX,
          right: window.innerWidth - rect.right - window.scrollX,
          width: rect.width,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        right: window.innerWidth - rect.right - window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside trigger
      if (triggerRef.current && triggerRef.current.contains(event.target as Node)) {
        return;
      }
      
      // Check if click is inside portal content
      const portalContent = document.getElementById('popover-portal-content');
      if (portalContent && portalContent.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const close = () => setIsOpen(false);

  const popoverContent = (
    <div 
      id="popover-portal-content"
      className={`absolute z-[9999] animate-in fade-in zoom-in-95 duration-100 ${className}`}
      style={{
        top: coords.top,
        ...(align === 'right' ? { right: coords.right } : { left: coords.left }),
      }}
    >
      {content(close)}
    </div>
  );

  return (
    <>
      <div 
        ref={triggerRef} 
        onClick={() => setIsOpen(!isOpen)} 
        className="cursor-pointer inline-block"
      >
        {trigger}
      </div>
      {isOpen && createPortal(popoverContent, document.body)}
    </>
  );
};