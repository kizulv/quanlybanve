import React, { useState } from "react";
import { Bus, Route, BusType } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { ManagerCarModal } from "./ManagerCarModal";
import { api } from "../../lib/api";
import {
  Plus,
  Settings2,
  Trash2,
  BusFront,
  LayoutGrid,
  Phone,
  CheckCircle2,
  Zap,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

interface BusSettingsProps {
  buses: Bus[];
  routes: Route[];
  onDataChange: () => Promise<void>;
}

export const BusSettings: React.FC<BusSettingsProps> = ({
  buses,
  routes,
  onDataChange,
}) => {
  const [isBusModalOpen, setIsBusModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAddBus = () => {
    setEditingBus(null);
    setIsBusModalOpen(true);
  };

  const handleEditBus = (bus: Bus) => {
    setEditingBus(bus);
    setIsBusModalOpen(true);
  };

  const handleSaveBus = async (busData: Bus) => {
    try {
      if (editingBus) await api.buses.update(editingBus.id, busData);
      else await api.buses.create(busData);
      await onDataChange();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteBus = async () => {
    if (!deleteId) return;
    try {
      await api.buses.delete(deleteId);
      await onDataChange();
      setDeleteId(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header với stats và action */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {buses.length} xe vận hành
        </p>
        <Button size="sm" onClick={handleAddBus} className="h-8 px-3 text-xs">
          <Plus size={14} className="mr-1.5" />
          Thêm xe
        </Button>
      </div>

      {/* Card với Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Thông tin xe
                </th>
                <th className="py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Loại & Sức chứa
                </th>
                <th className="py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tuyến mặc định
                </th>
                <th className="py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Liên hệ
                </th>
                <th className="py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buses.map((bus) => {
                const defaultRoute = routes.find(
                  (r) => r.id === bus.defaultRouteId,
                );
                const isCabin = bus.type === BusType.CABIN;
                return (
                  <tr
                    key={bus.id}
                    className="group hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center font-bold border border-slate-200">
                          <BusFront size={16} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900">
                            {bus.plate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-center gap-2 font-medium text-slate-700">
                          <LayoutGrid size={16} className="" />
                          {isCabin ? "Xe Phòng VIP" : "Xe Giường Đơn"}
                          <span className="text-xs text-slate-500 px-3 py-1 bg-slate-100 rounded">
                            {bus.seats} chỗ
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {defaultRoute ? (
                        <div className="flex items-center justify-center gap-2 max-w-50">
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 border-blue-100 truncate"
                          >
                            {defaultRoute.name}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic pl-2">
                          -- Chưa gán --
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {bus.phoneNumber ? (
                        <div className="flex items-center justify-center gap-2 text-slate-600">
                          <Phone size={14} className="text-slate-400" />
                          <span className="text-sm font-bold">
                            {bus.phoneNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">--</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          bus.status === "Hoạt động"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : bus.status === "Xe thuê/Tăng cường"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {bus.status === "Hoạt động" && (
                          <CheckCircle2 size={12} className="mr-1.5" />
                        )}
                        {bus.status === "Xe thuê/Tăng cường" && (
                          <Zap size={12} className="mr-1.5" />
                        )}
                        {bus.status === "Ngưng hoạt động" && (
                          <AlertCircle size={12} className="mr-1.5" />
                        )}
                        {bus.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditBus(bus)}
                          className="hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Settings2 size={16} className="mr-2" /> Cấu hình
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-destructive hover:bg-red-50"
                          onClick={() => setDeleteId(bus.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ManagerCarModal
        isOpen={isBusModalOpen}
        onClose={() => setIsBusModalOpen(false)}
        onSave={handleSaveBus}
        initialData={editingBus}
        routes={routes}
      />

      <Dialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Xác nhận xóa"
        className="max-w-md text-slate-900 border-indigo-900"
        headerClassName="px-4 h-[40px] border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white text-xs font-semibold"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Xóa xe này?</h3>
          <p className="text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
            Hành động này sẽ xóa dữ liệu khỏi hệ thống và không thể hoàn tác.
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="custom"
              className="bg-indigo-950 border-indigo-950 text-white hover:bg-indigo-900 hover:text-white h-8 px-6 text-xs font-bold min-w-25"
              onClick={() => setDeleteId(null)}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="custom"
              className="bg-red-600 border-red-600 text-white hover:bg-red-700 hover:text-white h-8 px-6 text-xs font-bold min-w-25"
              onClick={handleDeleteBus}
            >
              Xóa ngay
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
