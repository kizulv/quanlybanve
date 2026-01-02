import React, { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (props: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(({ type, title, message }: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-9999 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start w-72 rounded-lg p-3 shadow-xl border border-slate-100 bg-white transition-all animate-in slide-in-from-right-full duration-300"
          >
            <div className="shrink-0 pt-0.5">
              {t.type === "success" && (
                <CheckCircle2 size={18} className="text-green-600" />
              )}
              {t.type === "error" && (
                <AlertCircle size={18} className="text-red-600" />
              )}
              {t.type === "warning" && (
                <AlertCircle size={18} className="text-amber-500" />
              )}
              {t.type === "info" && (
                <Info size={18} className="text-blue-600" />
              )}
            </div>

            <div className="flex-1 ml-3 mr-2 min-w-0">
              <h4 className="text-sm font-bold text-slate-800 leading-tight">
                {t.title}
              </h4>
              {t.message && (
                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  {t.message}
                </p>
              )}
            </div>

            <button
              title="Đóng"
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors pt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
