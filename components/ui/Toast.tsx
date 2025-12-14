
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
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-start w-80 rounded-lg p-4 shadow-lg border border-slate-200 transition-all animate-in slide-in-from-right-full
              ${t.type === 'success' ? 'bg-white text-slate-900 border-l-4 border-l-green-500' : ''}
              ${t.type === 'error' ? 'bg-white text-slate-900 border-l-4 border-l-red-500' : ''}
              ${t.type === 'warning' ? 'bg-white text-slate-900 border-l-4 border-l-yellow-500' : ''}
              ${t.type === 'info' ? 'bg-white text-slate-900 border-l-4 border-l-blue-500' : ''}
            `}
          >
            <div className="flex-1 mr-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                {t.type === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                {t.type === 'error' && <AlertCircle size={16} className="text-red-500" />}
                {t.type === 'warning' && <AlertCircle size={16} className="text-yellow-500" />}
                {t.type === 'info' && <Info size={16} className="text-blue-500" />}
                {t.title}
              </div>
              {t.message && <p className="text-sm text-slate-500 mt-1">{t.message}</p>}
            </div>
            <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-900">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
