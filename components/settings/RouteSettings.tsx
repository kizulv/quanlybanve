import React, { useState } from "react";
import { Route } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { ManagerRouteModal } from "./ManagerRouteModal";
import { api } from "../../lib/api";
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  ArrowRight,
  Clock,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface RouteSettingsProps {
  routes: Route[];
  onDataChange: () => Promise<void>;
}

export const RouteSettings: React.FC<RouteSettingsProps> = ({
  routes,
  onDataChange,
}) => {
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAddRoute = () => {
    setEditingRoute(null);
    setIsRouteModalOpen(true);
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setIsRouteModalOpen(true);
  };

  const handleSaveRoute = async (routeData: Route) => {
    try {
      if (editingRoute)
        await api.routes.update(String(editingRoute.id), routeData);
      else await api.routes.create(routeData);
      await onDataChange();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteRoute = async () => {
    if (!deleteId) return;
    try {
      await api.routes.delete(deleteId);
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
          {routes.length} tuyến đường
        </p>
        <Button
          onClick={handleAddRoute}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus size={16} className="mr-2" />
          Thêm tuyến đường
        </Button>
      </div>

      {/* Routes Card Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {routes.map((route) => {
          const isActive = route.status !== "inactive";
          return (
            <div
              key={route.id}
              className={`group bg-white rounded-lg border transition-colors ${
                isActive
                  ? "border-slate-200 hover:border-primary/50 cursor-pointer"
                  : "border-slate-200 bg-slate-50/30 opacity-70"
              }`}
              onClick={() => isActive && handleEditRoute(route)}
            >
              {/* Card Header */}
              <div className="p-4 pb-3">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base text-slate-900 leading-none mb-1.5">
                      {route.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="font-medium">{route.origin}</span>
                      <ArrowRight size={10} className="text-slate-400" />
                      <span className="font-medium">{route.destination}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditRoute(route);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(String(route.id));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-slate-100" />

              {/* Card Content */}
              <div className="p-4 pt-3 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Giá vé</span>
                  <span className="font-semibold text-sm text-primary tabular-nums">
                    {route.price?.toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Xuất bến
                  </span>
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" />
                    <span className="text-sm font-medium tabular-nums">
                      {route.departureTime || "--:--"}
                    </span>
                  </div>
                </div>
                {route.returnTime && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Về</span>
                    <span className="text-xs text-slate-600 tabular-nums">
                      {route.returnTime}
                    </span>
                  </div>
                )}
                <div className="flex gap-1.5 pt-1">
                  {route.isEnhanced ? (
                    <Badge
                      variant="secondary"
                      className="h-5 px-2 text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                    >
                      <Zap size={10} className="mr-0.5" />
                      Tăng cường
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-5 px-2 text-[10px]">
                      Cố định
                    </Badge>
                  )}
                  {isActive ? (
                    <Badge
                      variant="outline"
                      className="h-5 px-2 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      Hoạt động
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-5 px-2 text-[10px] bg-red-50 text-red-700 border-red-200"
                    >
                      Đã ngưng
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ManagerRouteModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        onSave={handleSaveRoute}
        initialData={editingRoute}
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
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            Xóa tuyến đường này?
          </h3>
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
              onClick={handleDeleteRoute}
            >
              Xóa ngay
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
