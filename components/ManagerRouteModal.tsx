import React, { useState, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Route } from "../types";
import { MapPin, Save, Clock, Loader2, Banknote, AlertCircle, Zap } from "lucide-react";

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
    price: 0,
    departureTime: "",
    returnTime: "",
    status: 'active',
    isEnhanced: false
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        price: initialData.price || 0,
        departureTime: initialData.departureTime || "",
        returnTime: initialData.returnTime || "",
        status: initialData.status || 'active',
        isEnhanced: initialData.isEnhanced || false,
      });
    } else {
      setFormData({
        name: "",
        price: 0,
        departureTime: "",
        returnTime: "",
        status: 'active',
        isEnhanced: false
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
          [name]: checked
      }));
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-numeric characters
    const rawValue = e.target.value.replace(/\D/g, "");
    const numberValue = rawValue ? parseInt(rawValue, 10) : 0;

    setFormData((prev) => ({
      ...prev,
      price: numberValue,
    }));
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return "";
    return price.toLocaleString("vi-VN");
  };

  const handleSave = async () => {
    if (!formData.name) return;
    setIsSaving(true);
    try {
      // Ensure ID exists or is handled by parent/backend
      const routeToSave = {
        ...formData,
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
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Hủy bỏ
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.name}
            className="min-w-[100px]"
          >
            {isSaving ? (
              <Loader2 className="animate-spin mr-2" size={16} />
            ) : (
              <Save className="mr-2" size={16} />
            )}
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Tên tuyến */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Tên tuyến đường <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <MapPin size={18} />
            </div>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ví dụ: Hà Nội - Sapa"
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 font-medium shadow-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Giá vé niêm yết */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Giá vé niêm yết (VNĐ)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Banknote size={18} />
            </div>
            <input
              type="text"
              name="price"
              value={formatPrice(formData.price)}
              onChange={handlePriceChange}
              placeholder="0"
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm font-bold"
            />
          </div>
        </div>

        {/* Giờ xuất bến (Ngang hàng) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Giờ xuất bến đi
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
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Giờ xuất bến đến
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
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Status and Enhanced Option */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
           <div>
               <label className="block text-sm font-medium text-slate-700 mb-1.5">Tình trạng</label>
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                   <AlertCircle size={16} />
                 </div>
                 <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm appearance-none"
                 >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Đã hủy tuyến</option>
                 </select>
               </div>
           </div>
           
           <div className="flex items-center">
              <label className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 w-full cursor-pointer hover:bg-slate-50 transition-colors h-[42px] mt-6">
                  <input 
                    type="checkbox" 
                    name="isEnhanced"
                    checked={formData.isEnhanced}
                    onChange={handleCheckboxChange}
                    className="w-5 h-5 text-primary border-slate-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
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