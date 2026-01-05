import React, { useState, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Route } from "../types";
import {
  MapPin,
  Save,
  Clock,
  Loader2,
  Banknote,
  AlertCircle,
  Zap,
  ArrowRightLeft,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, parseCurrency } from "../utils/formatters";
import { CurrencyInput } from "./ui/CurrencyInput";

interface ManagerRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (route: Route) => Promise<void> | void;
  initialData?: Route | null;
}

export const ManagerRouteModal: React.FC<ManagerRouteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [formData, setFormData] = useState<Partial<Route>>({
    name: "",
    origin: "",
    destination: "",
    price: 0,
    departureTime: "",
    returnTime: "",
    status: "active",
    isEnhanced: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      let origin = initialData.origin || "";
      let destination = initialData.destination || "";

      if (!origin && !destination && initialData.name) {
        const parts = initialData.name.split(" - ");
        if (parts.length === 2) {
          origin = parts[0];
          destination = parts[1];
        } else {
          origin = initialData.name;
        }
      }

      setFormData({
        ...initialData,
        origin,
        destination,
        price: initialData.price || 0,
        departureTime: initialData.departureTime || "",
        returnTime: initialData.returnTime || "",
        status: initialData.status || "active",
        isEnhanced: initialData.isEnhanced || false,
      });
    } else {
      setFormData({
        name: "",
        origin: "",
        destination: "",
        price: 0,
        departureTime: "",
        returnTime: "",
        status: "active",
        isEnhanced: false,
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      price: parseCurrency(e.target.value),
    }));
  };

  const handleSwapLocations = () => {
    setFormData((prev) => ({
      ...prev,
      origin: prev.destination,
      destination: prev.origin,
    }));
  };

  const handleSave = async () => {
    if (!formData.origin || !formData.destination) return;
    setIsSaving(true);
    try {
      const constructedName = `${formData.origin} - ${formData.destination}`;

      const routeToSave = {
        ...formData,
        name: constructedName,
        id: initialData?.id || `ROUTE-${Date.now()}`,
      } as Route;

      await onSave(routeToSave);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Cập nhật tuyến đường" : "Thêm tuyến đường mới"}
      className="max-w-xl text-slate-900 border-indigo-900"
      headerClassName="px-4 h-[40px] border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white text-xs font-semibold"
      footer={
        <div className="flex gap-3 justify-between">
          <Button
            variant="custom"
            onClick={onClose}
            disabled={isSaving}
            className="bg-indigo-950 border-indigo-950 text-white hover:bg-indigo-900 hover:text-white h-8 px-6 text-xs font-bold min-w-25"
          >
            Hủy bỏ
          </Button>
          <Button
            variant="custom"
            onClick={handleSave}
            disabled={isSaving || !formData.origin || !formData.destination}
            className={`h-8 w-40 font-bold text-xs transition-all min-w-30 border text-white ${
              isSaving || !formData.origin || !formData.destination
                ? "bg-slate-700 opacity-40 cursor-not-allowed border-slate-700"
                : "bg-indigo-950 border-indigo-950 text-white hover:bg-indigo-900 hover:text-white shadow-slate-500/20 active:scale-95"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="mr-2" size={16} />
                Lưu
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-4">
        <div className="bg-slate-50/50 p-5 rounded border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 top-0.75 left-0 pl-3 flex items-center pointer-events-none">
                  <div className="uppercase text-[10px] text-slate-400 font-bold">
                    {" "}
                    Bến đi
                  </div>
                </div>
                <input
                  name="origin"
                  value={formData.origin}
                  onChange={handleChange}
                  placeholder="Bến đi (VD: Hà Nội)"
                  className="w-full pl-12.5 py-2 mt-0.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-900 font-medium text-xs transition-colors hover:border-slate-400"
                  autoFocus
                />
              </div>
            </div>

            <span className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
              <ArrowRightLeft size={16} />
            </span>
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 top-1 left-0 pl-3 flex items-center pointer-events-none">
                  <div className="uppercase text-[10px] text-slate-400 font-bold">
                    {" "}
                    Bến đến
                  </div>
                </div>
                <input
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  placeholder="Bến đến (VD: Sapa)"
                  className="w-full pl-15 py-2 mt-0.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-900 font-medium text-xs transition-colors hover:border-slate-400"
                />
              </div>
            </div>
          </div>

          {formData.origin && formData.destination && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 border-dashed">
              <span className="font-bold text-blue-600">{formData.origin}</span>
              <ArrowRight size={14} className="text-slate-400" />
              <span className="font-bold text-red-600">
                {formData.destination}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Giá vé niêm yết (VNĐ)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Banknote size={18} />
            </div>
            <CurrencyInput
              name="price"
              value={formData.price || 0}
              onChange={handlePriceChange}
              placeholder="0"
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-900 font-bold text-xs transition-colors hover:border-slate-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Giờ xuất bến (Chiều đi)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Clock size={16} />
              </div>
              <input
                type="text"
                name="departureTime"
                value={formData.departureTime}
                onChange={handleChange}
                placeholder="07:00"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-900 text-xs transition-colors hover:border-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Giờ xuất bến (Chiều về)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Clock size={16} />
              </div>
              <input
                type="text"
                name="returnTime"
                value={formData.returnTime}
                onChange={handleChange}
                placeholder="13:00"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-900 text-xs transition-colors hover:border-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Tình trạng
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <AlertCircle size={16} />
              </div>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-900 text-xs appearance-none transition-colors hover:border-slate-400"
              >
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Đã hủy tuyến</option>
              </select>
            </div>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2 w-full pl-3 pr-3 py-2 mt-5.5 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-900 text-xs appearance-none transition-colors hover:border-slate-400">
              <input
                type="checkbox"
                name="isEnhanced"
                checked={formData.isEnhanced}
                onChange={handleCheckboxChange}
                className="text-primary border-slate-300 rounded focus:ring-primary"
              />
              <span className="text-xs font-medium text-slate-700 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500 fill-yellow-500" />
                Tăng cường
              </span>
            </label>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
