import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  trigger: React.ReactNode;
  content: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  side?: "top" | "bottom";
  className?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  trigger,
  content,
  align = "left",
  side = "bottom",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    right: 0,
    width: 0,
    isMobile: false,
  });

  const updateCoords = () => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      setCoords({
        top:
          side === "bottom"
            ? rect.bottom + window.scrollY + 8
            : rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX,
        right: window.innerWidth - rect.right - window.scrollX,
        width: rect.width,
        isMobile,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
    }
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [isOpen]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside trigger
      if (
        triggerRef.current &&
        triggerRef.current.contains(event.target as Node)
      ) {
        return;
      }

      // Check if click is inside portal content
      const portalContent = document.getElementById("popover-portal-content");
      if (portalContent && portalContent.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const close = () => setIsOpen(false);

  const popoverContent = (
    <div
      id="popover-portal-content"
      className={`z-9999 ${
        coords.isMobile
          ? "fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          : "absolute"
      } ${side === "top" ? "-translate-y-full" : ""} ${className}`}
      style={
        !coords.isMobile
          ? {
              top: coords.top,
              ...(align === "right"
                ? { right: coords.right }
                : { left: coords.left }),
            }
          : {}
      }
      onClick={(e) => {
        // Close if clicking the backdrop on mobile
        if (coords.isMobile && e.target === e.currentTarget) {
          close();
        }
      }}
    >
      <div className={`${coords.isMobile ? "shadow-2xl" : ""}`}>
        {content(close)}
      </div>
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
