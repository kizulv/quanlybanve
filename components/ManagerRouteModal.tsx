import React, { useState, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Route } from "../types";
import { MapPin, Save, Clock, Loader2, Banknote } from "lucide-react";

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
    distance: "",
    duration: "",
    stops: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        price: initialData.price || 0,
        departureTime: initialData.departureTime || "",
        returnTime: initialData.returnTime || "",
      });
    } else {
      setFormData({
        name: "",
        price: 0,
        departureTime: "",
        returnTime: "",
        distance: "",
        duration: "",
        stops: 0,
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "price" || name === "stops" ? Number(value) : value,
    }));
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
          <Button onClick={handleSave} disabled={isSaving || !formData.name} className="min-w-[100px]">
            {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
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
              type="number"
              name="price"
              value={formData.price || ''}
              onChange={handleChange}
              placeholder="0"
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm font-mono"
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

        {/* Thông tin bổ sung (Ẩn bớt hoặc làm nhỏ để tập trung vào yêu cầu chính, nhưng giữ lại để không mất dữ liệu) */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
           <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Khoảng cách
            </label>
            <input
              name="distance"
              value={formData.distance}
              onChange={handleChange}
              placeholder="300km"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded bg-slate-50 text-slate-700"
            />
          </div>
           <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Thời gian
            </label>
             <input
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              placeholder="5h30"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded bg-slate-50 text-slate-700"
            />
          </div>
           <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Điểm dừng
            </label>
             <input
              type="number"
              name="stops"
              value={formData.stops || 0}
              onChange={handleChange}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded bg-slate-50 text-slate-700"
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
