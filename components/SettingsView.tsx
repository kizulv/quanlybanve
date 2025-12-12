
import React, { useState, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/Tabs";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Dialog } from "./ui/Dialog";
import {
  Plus,
  Edit2,
  Trash2,
  MapPin,
  BusFront,
  AlertTriangle,
  Phone,
  Database,
  Download,
  Upload,
  FileJson,
  CheckCircle2
} from "lucide-react";
import { Route, Bus, BusTrip, BusType, SeatStatus } from "../types";
import {
  generateCabinLayout,
  generateSleeperLayout,
} from "../utils/generators";
import { ManagerCarModal } from "./ManagerCarModal";
import { ManagerRouteModal } from "./ManagerRouteModal";
import { api } from "../lib/api";

interface SettingsViewProps {
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  buses: Bus[];
  setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
  trips: BusTrip[];
  setTrips: React.Dispatch<React.SetStateAction<BusTrip[]>>;
  onDataChange: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  routes,
  buses,
  trips,
  onDataChange,
}) => {
  // Modal State for Add/Edit
  const [activeModal, setActiveModal] = useState<"trip" | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // New Manager Modals State
  const [isCarManagerOpen, setIsCarManagerOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);

  const [isRouteManagerOpen, setIsRouteManagerOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  // Modal State for Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "route" | "bus" | "trip";
    id: string | number;
  } | null>(null);

  // Data Management State
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS FOR ROUTES ---
  const handleOpenRouteModal = (route?: Route) => {
    setEditingRoute(route || null);
    setIsRouteManagerOpen(true);
  };

  const handleSaveRoute = async (routeData: Route) => {
    try {
      if (editingRoute) {
        await api.routes.update(routeData.id, routeData);
      } else {
        await api.routes.create(routeData);
      }
      onDataChange();
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  const requestDeleteRoute = (id: number | string) => {
    setDeleteTarget({ type: "route", id });
  };

  // --- HANDLERS FOR BUSES ---
  const handleOpenBusModal = (bus?: Bus) => {
    setEditingBus(bus || null);
    setIsCarManagerOpen(true);
  };

  const handleSaveBus = async (newBus: Bus) => {
    try {
      if (editingBus) {
        await api.buses.update(newBus.id, newBus);
      } else {
        await api.buses.create(newBus);
      }
      onDataChange();
    } catch (e) {
      console.error(e);
    }
  };

  const requestDeleteBus = (id: string) => {
    setDeleteTarget({ type: "bus", id });
  };

  // --- HANDLERS FOR TRIPS (SCHEDULES) ---
  const handleSaveTrip = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const busId = formData.get("busId") as string;
    const selectedBus = buses.find((b) => b.id === busId);
    if (!selectedBus) return;

    const basePrice = Number(formData.get("basePrice"));

    // Generate seats based on Bus Layout Config if available
    let seats = [];
    if (selectedBus.layoutConfig) {
      const config = selectedBus.layoutConfig;

      // 1. Generate Main Grid Seats
      for (let f = 1; f <= config.floors; f++) {
        for (let r = 0; r < config.rows; r++) {
          for (let c = 0; c < config.cols; c++) {
            const key = `${f}-${r}-${c}`;
            if (config.activeSeats.includes(key)) {
              let label = config.seatLabels?.[key];

              if (!label) {
                if (selectedBus.type === BusType.CABIN) {
                  const prefix = String.fromCharCode(65 + c);
                  const num = r * 2 + f;
                  label = `${prefix}${num}`;
                } else {
                  const seatsPerRow = config.cols * config.floors;
                  const val = r * seatsPerRow + (f - 1) * config.cols + c + 1;
                  label = val.toString();
                }
              }

              seats.push({
                id: label,
                label: label,
                floor: f as 1 | 2,
                status: SeatStatus.AVAILABLE,
                price: basePrice,
                row: r,
                col: c,
              });
            }
          }
        }
      }

      // 2. Generate Rear Bench Seats
      if (config.hasRearBench) {
        for (let f = 1; f <= config.floors; f++) {
          for (let i = 0; i < 5; i++) {
            const key = `${f}-bench-${i}`;
            if (config.activeSeats.includes(key)) {
              let label = config.seatLabels?.[key];
              if (!label) {
                const prefix = f === 1 ? "A" : "B";
                label =
                  selectedBus.type === BusType.CABIN
                    ? `${prefix}-G${i + 1}`
                    : `B${f}-${i + 1}`;
              }

              seats.push({
                id: label,
                label: label,
                floor: f as 1 | 2,
                status: SeatStatus.AVAILABLE,
                price: basePrice,
                row: config.rows,
                col: i,
              });
            }
          }
        }
      }
    } else {
      // Fallback to legacy generators
      seats = editingItem
        ? editingItem.seats
        : selectedBus.type === BusType.CABIN
        ? generateCabinLayout(basePrice)
        : generateSleeperLayout(basePrice);
    }

    const newTripData: Partial<BusTrip> = {
      name: formData.get("name") as string,
      route: formData.get("route") as string,
      departureTime: formData.get("departureTime") as string,
      type: selectedBus.type,
      licensePlate: selectedBus.plate,
      driver: formData.get("driver") as string,
      basePrice: basePrice,
      seats: seats,
    };

    try {
      if (editingItem) {
        await api.trips.update(editingItem.id, {
          ...newTripData,
          seats: editingItem.seats,
        });
      } else {
        await api.trips.create({
          id: `TRIP-${Date.now()}`,
          ...(newTripData as BusTrip),
        });
      }
      onDataChange();
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  const requestDeleteTrip = (id: string) => {
    setDeleteTarget({ type: "trip", id });
  };

  // --- DATA MANAGEMENT HANDLERS ---
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const data = await api.system.exportData();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vinabus-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
      alert("Lỗi khi xuất dữ liệu");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("CẢNH BÁO: Việc nhập dữ liệu sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại của hệ thống (Xe, Tuyến, Lịch trình, Vé). Bạn có chắc chắn muốn tiếp tục?")) {
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const jsonContent = e.target?.result as string;
        const data = JSON.parse(jsonContent);

        // Basic validation
        if (!data.buses || !data.routes || !data.trips) {
          throw new Error("File không đúng định dạng VinaBus Manager");
        }

        const success = await api.system.importData(data);
        if (success) {
          alert("Khôi phục dữ liệu thành công! Hệ thống sẽ tải lại dữ liệu.");
          onDataChange();
        } else {
          alert("Có lỗi xảy ra khi lưu dữ liệu.");
        }
      } catch (error) {
        console.error("Import error", error);
        alert("File không hợp lệ hoặc bị lỗi.");
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsText(file);
  };

  // --- GENERAL HANDLERS ---
  const openModal = (type: "trip", item: any = null) => {
    setEditingItem(item);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setEditingItem(null);
    setIsCarManagerOpen(false);
    setEditingBus(null);
    setIsRouteManagerOpen(false);
    setEditingRoute(null);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;

    try {
      if (type === "route") {
        await api.routes.delete(id);
      } else if (type === "bus") {
        await api.buses.delete(id as string);
      } else if (type === "trip") {
        await api.trips.delete(id as string);
      }
      onDataChange();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteTarget(null);
    }
  };
  
  const formatPhoneNumber = (phoneNumber: string): string => {
    const regex = /^(\d{4})(\d{3})(\d{3})$/;
    const cleanedNumber = phoneNumber.replace(/\D/g, "");
    if (regex.test(cleanedNumber)) {
      return cleanedNumber.replace(regex, "$1 $2 $3");
    }
    return phoneNumber;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <Tabs defaultValue="routes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px] mb-8">
            <TabsTrigger value="routes">Quản lý tuyến</TabsTrigger>
            <TabsTrigger value="buses">Quản lý xe</TabsTrigger>
            <TabsTrigger value="data">Dữ liệu</TabsTrigger>
          </TabsList>

          {/* TAB 1: QUẢN LÝ TUYẾN */}
          <TabsContent value="routes">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="text-primary" size={20} /> Danh sách tuyến đường
              </h3>
              <Button size="sm" onClick={() => handleOpenRouteModal()}>
                <Plus size={16} className="mr-1" /> Thêm tuyến mới
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Tên tuyến</th>
                    <th className="px-4 py-3">Giá niêm yết</th>
                    <th className="px-4 py-3">Giờ chạy</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routes.map((route) => {
                    const isInactive = route.status === "inactive";
                    return (
                      <tr
                        key={route.id}
                        className={`hover:bg-slate-50 ${
                          isInactive ? "opacity-60 bg-slate-50/50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                isInactive
                                  ? "line-through text-slate-500"
                                  : "font-medium"
                              }
                            >
                              {route.name}
                            </span>
                            {route.isEnhanced && (
                              <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded border border-yellow-200">
                                (Tăng cường)
                              </span>
                            )}
                            {isInactive && (
                              <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                                Đã hủy
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-primary font-bold">
                          {route.price
                            ? `${route.price.toLocaleString("vi-VN")} đ`
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm mb-1">
                            <span className="text-slate-500">Đi:</span>{" "}
                            <span className="font-medium text-slate-900">
                              {route.departureTime || "--:--"}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-slate-500">Về:</span>{" "}
                            <span className="font-medium text-slate-900">
                              {route.returnTime || "--:--"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenRouteModal(route)}
                              className="h-8 w-8 text-slate-500 hover:text-primary"
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => requestDeleteRoute(route.id)}
                              className="h-8 w-8 text-slate-500 hover:text-destructive"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 2: QUẢN LÝ XE */}
          <TabsContent value="buses">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BusFront className="text-primary" size={20} /> Danh sách phương tiện
              </h3>
              <Button size="sm" onClick={() => handleOpenBusModal()}>
                <Plus size={16} className="mr-1" /> Thêm xe mới
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {buses.map((bus) => (
                <div
                  key={bus.id}
                  className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-lg text-slate-900">
                            {bus.plate}
                          </h4>
                          {bus.phoneNumber && (
                            <span className="flex items-center text-xs text-slate-500">
                              <Phone size={10} className="mr-1" />
                              {formatPhoneNumber(bus.phoneNumber)}
                            </span>
                          )}
                        </div>
                        {bus.defaultRouteId && (
                          <div className="mt-1">
                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 flex w-fit items-center gap-1">
                              <MapPin size={10} />
                              {routes.find((r) => r.id === bus.defaultRouteId)
                                ?.name || "Tuyến không tồn tại"}
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={
                          bus.status === "Hoạt động" ? "success" : "warning"
                        }
                      >
                        {bus.status}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600 mt-3">
                      <div className="flex justify-between">
                        <span>Loại xe:</span>
                        <span className="font-medium">
                          {bus.type === BusType.CABIN
                            ? "Xe phòng"
                            : "Giường đơn"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Số giường:</span>
                        <span className="font-medium">{bus.seats}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-slate-200 text-slate-700 hover:text-primary hover:border-primary hover:bg-primary/5"
                      onClick={() => handleOpenBusModal(bus)}
                    >
                      <Edit2 size={16} className="mr-2" /> Sửa
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200"
                      onClick={() => requestDeleteBus(bus.id)}
                    >
                      <Trash2 size={16} className="mr-2" /> Xóa
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: DỮ LIỆU */}
          <TabsContent value="data">
             <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Database className="text-primary" size={20} /> Sao lưu và Khôi phục
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Section */}
                <div className="border border-slate-200 rounded-xl p-6 bg-white hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Download size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800">Xuất dữ liệu</h4>
                            <p className="text-sm text-slate-500">Tải xuống toàn bộ dữ liệu hệ thống dưới dạng file JSON.</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-100">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                            <FileJson size={14} /> Bao gồm:
                        </div>
                        <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                            <li>Danh sách tuyến đường & xe</li>
                            <li>Lịch trình chạy xe</li>
                            <li>Lịch sử đặt vé & hành khách</li>
                            <li>Cấu hình ghế ngồi</li>
                        </ul>
                    </div>
                    <Button 
                        onClick={handleExportData} 
                        disabled={isExporting}
                        className="w-full"
                    >
                        {isExporting ? 'Đang xử lý...' : 'Tải xuống bản sao lưu'}
                    </Button>
                </div>

                {/* Import Section */}
                <div className="border border-slate-200 rounded-xl p-6 bg-white hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                            <Upload size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800">Nhập dữ liệu</h4>
                            <p className="text-sm text-slate-500">Khôi phục hệ thống từ file sao lưu JSON.</p>
                        </div>
                    </div>
                    
                    <div className="bg-red-50 p-4 rounded-lg mb-6 border border-red-100">
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">
                                <span className="font-bold">Cảnh báo:</span> Hành động này sẽ <span className="underline">ghi đè</span> toàn bộ dữ liệu hiện tại. Hãy chắc chắn rằng bạn đã sao lưu dữ liệu cũ trước khi thực hiện.
                            </p>
                        </div>
                    </div>

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json" 
                        className="hidden" 
                    />
                    
                    <Button 
                        variant="outline"
                        onClick={handleImportClick} 
                        disabled={isImporting}
                        className="w-full border-dashed border-2 hover:border-orange-500 hover:text-orange-600 hover:bg-orange-50"
                    >
                        {isImporting ? 'Đang khôi phục...' : 'Chọn file để khôi phục'}
                    </Button>
                </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- DIALOGS --- */}

      {/* MANAGER CAR MODAL */}
      <ManagerCarModal
        isOpen={isCarManagerOpen}
        onClose={closeModal}
        onSave={handleSaveBus}
        initialData={editingBus}
        routes={routes}
      />

      {/* MANAGER ROUTE MODAL */}
      <ManagerRouteModal
        isOpen={isRouteManagerOpen}
        onClose={closeModal}
        onSave={handleSaveRoute}
        initialData={editingRoute}
      />

      {/* CONFIRM DELETE DIALOG */}
      <Dialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xác nhận xóa"
      >
        <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-slate-900">
              Bạn có chắc chắn muốn xóa?
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Hành động này không thể hoàn tác. Dữ liệu liên quan có thể bị ảnh
              hưởng.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDeleteTarget(null)}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={executeDelete}
            >
              Xóa ngay
            </Button>
          </div>
        </div>
      </Dialog>
      
      {/* Existing Trip Dialog (Hidden/Unused if moved fully to ScheduleView but kept for compatibility if needed) */}
      <Dialog
        isOpen={activeModal === "trip"}
        onClose={closeModal}
        title={editingItem ? "Cập nhật lịch trình" : "Tạo lịch chạy mới"}
      >
        {/* Form content omitted for brevity as it is likely replaced by ScheduleView logic */}
         <form id="trip-form" onSubmit={handleSaveTrip} className="space-y-4">
            <p className="text-sm text-slate-500">Form này đã cũ, vui lòng sử dụng màn hình Lịch Trình để quản lý chuyến đi.</p>
             <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Đóng
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
