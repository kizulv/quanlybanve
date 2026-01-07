import React, { useState, useMemo } from "react";
import { Route, Bus, BusTrip, BusType } from "../types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/Tabs";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  BusFront,
  Settings2,
  ArrowRight,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Phone,
  LayoutGrid,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Database,
  Activity,
  BarChart3,
  HardDrive,
  Server,
  Loader2,
  Calendar,
  ChevronRight,
  WalletCards,
  CircleDollarSign,
} from "lucide-react";
import { ManagerRouteModal } from "./ManagerRouteModal";
import { ManagerCarModal } from "./ManagerCarModal";
import { api } from "../lib/api";
import { Dialog } from "./ui/Dialog";
import { useToast } from "./ui/Toast";

interface MaintenanceLog {
  route: string;
  date: string;
  seat: string;
  action: string;
  details: string;
  bookingId?: string;
  actualPrice?: number;
  paidAmount?: number;
}

interface SettingsViewProps {
  routes: Route[];
  setRoutes: (routes: Route[]) => void;
  buses: Bus[];
  setBuses: (buses: Bus[]) => void;
  trips: BusTrip[];
  setTrips: (trips: BusTrip[]) => void;
  onDataChange: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  routes,
  buses,
  trips,
  onDataChange,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("routes");

  // Modal States
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  const [isBusModalOpen, setIsBusModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);

  // Delete Confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"route" | "bus" | null>(null);

  // Maintenance State (Seats)
  const [isFixingSeats, setIsFixingSeats] = useState(false);
  const [maintenanceResults, setMaintenanceResults] = useState<{
    logs: MaintenanceLog[];
    counts: { fixed: number; sync: number; conflict: number };
  } | null>(null);

  // Maintenance State (Payments)
  const [isFixingPayments, setIsFixingPayments] = useState(false);
  const [paymentMaintenanceResults, setPaymentMaintenanceResults] = useState<{
    logs: MaintenanceLog[];
    deletedCount: number;
    fixedCount: number;
    mismatchCount: number;
  } | null>(null);

  // Maintenance State (Floor Seats)
  const [isFixingFloorSeats, setIsFixingFloorSeats] = useState(false);
  const [floorFixResults, setFloorFixResults] = useState<{
    logs: MaintenanceLog[];
    busUpdateCount: number;
    tripUpdateCount: number;
  } | null>(null);

  // System Settings State
  const [systemSettings, setSystemSettings] = useState({
    bankName: "",
    bankAccount: "",
    accountName: "",
    bankBin: "",
    qrTemplate: "compact",
    qrExpiryTime: 300,
  });

  // Fetch Settings on Mount
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.systemSettings.get();
        if (res) setSystemSettings(res);
      } catch (e) {
        console.error("Failed to fetch system settings", e);
      }
    };
    fetchSettings();
  }, []);

  // Stats
  const activeBusesCount = buses.filter((b) => b.status === "Hoạt động").length;
  const activeRoutesCount = routes.filter(
    (r) => r.status !== "inactive"
  ).length;

  const detailedStats = useMemo(() => {
    const cabinBuses = buses.filter((b) => b.type === BusType.CABIN).length;
    const sleeperBuses = buses.filter((b) => b.type === BusType.SLEEPER).length;
    let cabinOccupied = 0;
    let sleeperOccupied = 0;
    trips.forEach((t) => {
      const occupied = t.seats.filter((s) => s.status !== "available").length;
      if (t.type === BusType.CABIN) cabinOccupied += occupied;
      else sleeperOccupied += occupied;
    });
    return { cabinBuses, sleeperBuses, cabinOccupied, sleeperOccupied };
  }, [buses, trips]);

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
      setDeleteType(null);
    } catch (error) {
      console.error(error);
    }
  };

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
      setDeleteType(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleFixSeats = async () => {
    setIsFixingSeats(true);
    setMaintenanceResults(null);
    setPaymentMaintenanceResults(null);
    try {
      const result = await api.maintenance.fixSeats();
      setMaintenanceResults({
        logs: result.logs || [],
        counts: {
          fixed: result.fixedCount || 0,
          sync: result.syncCount || 0,
          conflict: result.conflictCount || 0,
        },
      });

      if (result.logs && result.logs.length > 0) {
        toast({
          type: "success",
          title: "Đã xử lý dữ liệu",
          message: `Phát hiện và sửa lỗi cho ${result.logs.length} vị trí.`,
        });
      } else {
        toast({
          type: "info",
          title: "Hệ thống sạch",
          message: "Không phát hiện lỗi dữ liệu nào cần xử lý.",
        });
      }
      await onDataChange();
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi bảo trì",
        message: "Không thể thực hiện quét dữ liệu.",
      });
    } finally {
      setIsFixingSeats(false);
    }
  };

  const handleFixPayments = async () => {
    setIsFixingPayments(true);
    setPaymentMaintenanceResults(null);
    setMaintenanceResults(null);
    try {
      const result = await api.maintenance.fixPayments();
      setPaymentMaintenanceResults({
        logs: result.logs || [],
        deletedCount: result.deletedCount || 0,
        fixedCount: result.fixedCount || 0,
        mismatchCount: result.mismatchCount || 0,
      });

      if (
        result.deletedCount > 0 ||
        result.mismatchCount > 0 ||
        result.fixedCount > 0
      ) {
        toast({
          type: "success",
          title: "Đã quét dòng tiền",
          message: `Xóa: ${result.deletedCount}, Chênh lệch: ${result.mismatchCount}, Đã sửa: ${result.fixedCount}`,
        });
      } else {
        toast({
          type: "info",
          title: "Dòng tiền ổn định",
          message: "Không phát hiện vấn đề về thanh toán.",
        });
      }
      await onDataChange();
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi bảo trì",
        message: "Không thể thực hiện quét thanh toán.",
      });
    } finally {
      setIsFixingPayments(false);
    }
  };

  const handleSyncBusLayouts = async () => {
    setIsFixingFloorSeats(true);
    setFloorFixResults(null);
    try {
      const result = await api.maintenance.syncBusLayouts();
      setFloorFixResults({
        logs: result.logs || [],
        busUpdateCount: 0, // Không sync buses nữa
        tripUpdateCount: result.tripUpdateCount || 0,
      });

      if (result.logs && result.logs.length > 0) {
        toast({
          type: "success",
          title: "Đã sync sơ đồ ghế chuyến",
          message: `Đã sync ${result.tripUpdateCount} chuyến từ ${result.totalCount} xe.`,
        });
      } else {
        toast({
          type: "info",
          title: "Không có chuyến",
          message: "Không tìm thấy chuyến nào để sync.",
        });
      }
      await onDataChange();
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi sync",
        message: "Không thể sync sơ đồ ghế.",
      });
    } finally {
      setIsFixingFloorSeats(false);
    }
  };

  const handleFixMismatch = async (log: MaintenanceLog) => {
    if (!log.bookingId || !log.actualPrice || log.paidAmount === undefined) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Thiếu thông tin để sửa chênh lệch.",
      });
      return;
    }

    const difference = log.paidAmount - log.actualPrice;
    const confirmMsg =
      difference > 0
        ? `Tạo payment hoàn tiền ${Math.abs(
            difference
          ).toLocaleString()}đ (Thừa)?`
        : `Tạo payment bù ${Math.abs(difference).toLocaleString()}đ (Thiếu)?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      // Tạo payment để bù chênh lệch
      const paymentAmount = -difference; // Ngược dấu để cân bằng
      await api.payments.create({
        bookingId: log.bookingId,
        totalAmount: paymentAmount,
        cashAmount: paymentAmount,
        transferAmount: 0,
        type: paymentAmount > 0 ? "payment" : "refund",
        transactionType: "incremental",
        method: "cash",
        note: `Bù chênh lệch thanh toán (${
          difference > 0 ? "Thừa" : "Thiếu"
        } ${Math.abs(difference).toLocaleString()}đ)`,
        timestamp: new Date(),
      });

      toast({
        type: "success",
        title: "Đã sửa chênh lệch",
        message: `Đã tạo payment ${
          paymentAmount > 0 ? "bù" : "hoàn"
        } ${Math.abs(paymentAmount).toLocaleString()}đ.`,
      });

      // Chạy lại fix payments để cập nhật kết quả
      await handleFixPayments();
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể tạo payment bù chênh lệch.",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex-col md:flex">
        <div className="flex-1 space-y-4">
          <Tabs
            defaultValue="routes"
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            {/* Tabs List */}
            <TabsList>
              <TabsTrigger value="routes">Tuyến đường</TabsTrigger>
              <TabsTrigger value="buses">Đội xe</TabsTrigger>
              <TabsTrigger value="system">Hệ thống</TabsTrigger>
              <TabsTrigger value="qr-bank">QR / Ngân hàng</TabsTrigger>
            </TabsList>

            <TabsContent value="routes" className="space-y-4">
              {/* Header với stats và action */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {routes.length} tuyến đường
                </p>
                <Button
                  onClick={() => {
                    setEditingRoute(null);
                    setIsRouteModalOpen(true);
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus size={16} className="mr-2" />
                  Thêm tuyến đường
                </Button>
              </div>

              {/* Routes Card Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                              <span className="font-medium">
                                {route.origin}
                              </span>
                              <ArrowRight
                                size={10}
                                className="text-slate-400"
                              />
                              <span className="font-medium">
                                {route.destination}
                              </span>
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
                                setDeleteType("route");
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
                          <span className="text-xs text-muted-foreground">
                            Giá vé
                          </span>
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
                            <span className="text-xs text-muted-foreground">
                              Về
                            </span>
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
                            <Badge
                              variant="outline"
                              className="h-5 px-2 text-[10px]"
                            >
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
            </TabsContent>

            <TabsContent
              value="buses"
              className="space-y-4 focus-visible:outline-none"
            >
              {/* Header với stats và action */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {buses.length} xe vận hành
                </p>
                <Button
                  size="sm"
                  onClick={handleAddBus}
                  className="h-8 px-3 text-xs"
                >
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
                          (r) => r.id === bus.defaultRouteId
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
                                <span className="text-slate-400 text-xs">
                                  --
                                </span>
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
                                  <Settings2 size={16} className="mr-2" /> Cấu
                                  hình
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-slate-400 hover:text-destructive hover:bg-red-50"
                                  onClick={() => {
                                    setDeleteId(bus.id);
                                    setDeleteType("bus");
                                  }}
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
            </TabsContent>

            <TabsContent
              value="system"
              className="space-y-6 focus-visible:outline-none"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                      <BarChart3 size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900">
                      Phân tích tài nguyên xe
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100">
                      <div className="flex items-center gap-3">
                        <LayoutGrid size={16} className="text-indigo-500" />
                        <span className="text-sm font-medium text-slate-700">
                          Xe Phòng VIP (22)
                        </span>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                        {detailedStats.cabinBuses} xe
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <LayoutGrid size={16} className="text-blue-500" />
                        <span className="text-sm font-medium text-slate-700">
                          Xe Giường đơn (41)
                        </span>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                        {detailedStats.sleeperBuses} xe
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                      <Activity size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900">
                      Trạng thái vận hành ghế
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                        <span>Công suất VIP Room</span>
                        <span>{detailedStats.cabinOccupied} vé</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(
                              100,
                              (detailedStats.cabinOccupied /
                                (detailedStats.cabinBuses * 28 || 1)) *
                                100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                        <span>Công suất Giường đơn</span>
                        <span>{detailedStats.sleeperOccupied} vé</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(
                              100,
                              (detailedStats.sleeperOccupied /
                                (detailedStats.sleeperBuses * 41 || 1)) *
                                100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Seat Diagram Fix Tool */}
                <div className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                    <ShieldCheck size={20} className="text-primary" />
                    <h3 className="font-bold text-slate-900">
                      Công cụ bảo trì sơ đồ ghế
                    </h3>
                  </div>
                  <div className="p-8">
                    <div className="flex flex-col md:flex-row items-start gap-8">
                      <div
                        className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                          isFixingSeats
                            ? "bg-primary text-white scale-110 shadow-xl shadow-primary/20 ring-4 ring-primary/10"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        <RefreshCw
                          size={40}
                          className={isFixingSeats ? "animate-spin" : ""}
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-slate-900 mb-3">
                          Quét & Khôi phục sơ đồ ghế (Ghost & Duplicate Seats
                          Fix)
                        </h4>
                        <p className="text-slate-500 mb-6 leading-relaxed max-w-3xl text-xs">
                          Hệ thống thực hiện đối soát 3 chiều giữa{" "}
                          <strong>Dòng tiền (Payments)</strong>,{" "}
                          <strong>Đơn hàng (Bookings)</strong> và{" "}
                          <strong>Sơ đồ ghế (Trips)</strong>. Tự động phát hiện
                          ghế bị trùng giữa 2 số điện thoại và giữ lại đơn có
                          thanh toán cao hơn. Giải phóng các "ghế ma" không có
                          đơn hàng thực tế.
                        </p>
                        <div className="flex flex-wrap gap-4 items-center">
                          <Button
                            onClick={handleFixSeats}
                            disabled={isFixingSeats}
                            className="bg-indigo-600 hover:bg-indigo-700 h-10 px-8 font-bold text-base"
                          >
                            {isFixingSeats ? (
                              <>
                                <Loader2
                                  className="animate-spin mr-2"
                                  size={18}
                                />
                                Đang đối soát dữ liệu...
                              </>
                            ) : (
                              "Bắt đầu quét & sửa lỗi"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {maintenanceResults && (
                      <div className="mt-10 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                          <div className="p-5 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-50 rounded-lg text-green-600">
                                <CheckCircle2 size={20} />
                              </div>
                              <h5 className="font-bold text-slate-800">
                                Kết quả bảo trì sơ đồ
                              </h5>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold px-2.5 py-1">
                                Đã sửa: {maintenanceResults.counts.fixed}
                              </Badge>
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-2.5 py-1">
                                Đồng bộ: {maintenanceResults.counts.sync}
                              </Badge>
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold px-2.5 py-1">
                                Xung đột: {maintenanceResults.counts.conflict}
                              </Badge>
                            </div>
                          </div>

                          <div className="max-h-75 overflow-y-auto">
                            {maintenanceResults.logs.length === 0 ? (
                              <div className="p-12 text-center text-slate-400 italic font-medium">
                                Không phát hiện sai lệch sơ đồ ghế nào.
                              </div>
                            ) : (
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100/50 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 border-b border-slate-200">
                                  <tr>
                                    <th className="px-6 py-3">
                                      Ghế & Lịch trình
                                    </th>
                                    <th className="px-6 py-3">Loại sửa đổi</th>
                                    <th className="px-6 py-3">
                                      Chi tiết xử lý
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {maintenanceResults.logs.map((log, idx) => (
                                    <tr
                                      key={idx}
                                      className="hover:bg-white transition-colors bg-slate-50/30"
                                    >
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-primary shadow-sm">
                                            {log.seat}
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="font-bold text-slate-900">
                                              {log.route}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold mt-0.5">
                                              <Calendar size={10} /> {log.date}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border ${
                                            log.action.includes("Trống") ||
                                            log.action.includes("ma")
                                              ? "bg-blue-50 text-blue-700 border-blue-200"
                                              : log.action.includes("màu")
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                              : "bg-amber-50 text-amber-700 border-amber-200"
                                          }`}
                                        >
                                          {log.action}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <p className="text-xs text-slate-600 font-medium italic leading-relaxed">
                                          {log.details}
                                        </p>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Cleanup Tool */}
                <div className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                    <CircleDollarSign size={20} className="text-emerald-600" />
                    <h3 className="font-bold text-slate-900">
                      Công cụ bảo trì dòng tiền
                    </h3>
                  </div>
                  <div className="p-8">
                    <div className="flex flex-col md:flex-row items-start gap-8">
                      <div
                        className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                          isFixingPayments
                            ? "bg-emerald-600 text-white scale-110 shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/10"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        <WalletCards
                          size={40}
                          className={isFixingPayments ? "animate-bounce" : ""}
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-slate-900 mb-3">
                          Dọn dẹp giao dịch không hợp lệ (Payment Cleanup)
                        </h4>
                        <p className="text-slate-500 mb-6 leading-relaxed max-w-3xl text-xs">
                          Kiểm tra và phát hiện các vấn đề về dòng tiền:{" "}
                          <strong>Chênh lệch số tiền</strong> giữa Payment
                          History và Booking, <strong>Payments</strong> không có
                          đơn hàng, <strong>Payments lỗi</strong> của đơn HOLD,
                          và <strong>Tổng tiền booking sai</strong>. Hệ thống sẽ
                          tự động xóa các payment không hợp lệ và báo cáo chi
                          tiết các chênh lệch cần xử lý thủ công.
                        </p>
                        <div className="flex flex-wrap gap-4 items-center">
                          <Button
                            onClick={handleFixPayments}
                            disabled={isFixingPayments}
                            className="bg-emerald-600 hover:bg-emerald-700 h-10 px-8 font-bold text-base"
                          >
                            {isFixingPayments ? (
                              <>
                                <Loader2
                                  className="animate-spin mr-2"
                                  size={18}
                                />
                                Đang quét thanh toán...
                              </>
                            ) : (
                              "Bắt đầu dọn dẹp dòng tiền"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {paymentMaintenanceResults && (
                      <div className="mt-10 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 overflow-hidden">
                          <div className="p-5 border-b border-emerald-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                <CheckCircle2 size={20} />
                              </div>
                              <h5 className="font-bold text-slate-800">
                                Kết quả bảo trì dòng tiền
                              </h5>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Badge className="bg-red-100 text-red-700 border-red-200 font-bold px-3 py-1.5">
                                Đã xóa: {paymentMaintenanceResults.deletedCount}
                              </Badge>
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-bold px-3 py-1.5">
                                Chênh lệch:{" "}
                                {paymentMaintenanceResults.mismatchCount}
                              </Badge>
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold px-3 py-1.5">
                                Đã sửa: {paymentMaintenanceResults.fixedCount}
                              </Badge>
                            </div>
                          </div>

                          <div className="max-h-75 overflow-y-auto">
                            {paymentMaintenanceResults.logs.length === 0 ? (
                              <div className="p-12 text-center text-slate-400 italic font-medium">
                                Hệ thống tài chính sạch. Không tìm thấy thanh
                                toán lỗi nào.
                              </div>
                            ) : (
                              <table className="w-full text-sm text-left">
                                <thead className="bg-emerald-100/50 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 border-b border-emerald-200">
                                  <tr>
                                    <th className="px-6 py-3">
                                      Lịch trình & Ghế
                                    </th>
                                    <th className="px-6 py-3">Phân loại</th>
                                    <th className="px-6 py-3">Lý do xử lý</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-200/50">
                                  {paymentMaintenanceResults.logs.map(
                                    (log, idx) => (
                                      <tr
                                        key={idx}
                                        className="hover:bg-white transition-colors bg-white/40"
                                      >
                                        <td className="px-6 py-4">
                                          <div className="flex flex-col">
                                            <span className="font-bold text-slate-900">
                                              {log.route}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold mt-0.5">
                                              <Badge
                                                variant="outline"
                                                className="text-[9px] px-1 h-4 border-slate-200"
                                              >
                                                {log.seat || "Không rõ ghế"}
                                              </Badge>
                                              <span className="mx-1">•</span>
                                              {log.date}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4">
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border ${
                                              log.action.includes("Xóa")
                                                ? "bg-red-50 text-red-700 border-red-200"
                                                : log.action.includes(
                                                    "Chỉnh"
                                                  ) ||
                                                  log.action.includes("Sửa")
                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            }`}
                                          >
                                            {log.action}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4">
                                          <div className="flex flex-col gap-2">
                                            <p className="text-xs text-slate-600 font-medium italic leading-relaxed">
                                              {log.details}
                                            </p>
                                            {log.action.includes(
                                              "Chênh lệch"
                                            ) &&
                                              log.bookingId && (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() =>
                                                    handleFixMismatch(log)
                                                  }
                                                  className="w-fit text-xs h-7 px-3 border-amber-300 text-amber-700 hover:bg-amber-50"
                                                >
                                                  <Settings2
                                                    size={12}
                                                    className="mr-1.5"
                                                  />
                                                  Sửa chênh lệch
                                                </Button>
                                              )}
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="qr-bank" className="space-y-6">
              <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-indigo-50 rounded text-indigo-600">
                    <WalletCards size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Cấu hình thanh toán
                    </h2>
                    <p className="text-sm text-slate-500">
                      Thiết lập thông tin nhận tiền và thời gian mã QR
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      Thông tin tài khoản ngân hàng
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">
                            Tên ngân hàng (Short Name)
                          </label>
                          <input
                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="VD: BIDV, VCB, MB..."
                            value={systemSettings.bankName}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                bankName: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Số tài khoản
                        </label>
                        <input
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Nhập số tài khoản"
                          type="text"
                          value={systemSettings.bankAccount}
                          onChange={(e) =>
                            setSystemSettings({
                              ...systemSettings,
                              bankAccount: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Bin ngân hàng
                        </label>
                        <input
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Mã Bin (VietQR)"
                          type="text"
                          value={systemSettings.bankBin}
                          onChange={(e) =>
                            setSystemSettings({
                              ...systemSettings,
                              bankBin: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Tên chủ tài khoản
                        </label>
                        <input
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Tên in hoa không dấu"
                          value={systemSettings.accountName}
                          onChange={(e) =>
                            setSystemSettings({
                              ...systemSettings,
                              accountName: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      Thiết lập mã QR
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Thời gian hết hạn (giây)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                            value={systemSettings.qrExpiryTime}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                qrExpiryTime: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                          <span className="text-sm text-slate-500 whitespace-nowrap">
                            phút: {Math.floor(systemSettings.qrExpiryTime / 60)}
                            p {systemSettings.qrExpiryTime % 60}s
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Mẫu QR (Template)
                        </label>
                        <select
                          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          value={systemSettings.qrTemplate}
                          onChange={(e) =>
                            setSystemSettings({
                              ...systemSettings,
                              qrTemplate: e.target.value,
                            })
                          }
                        >
                          <option value="compact">Compact (Mặc định)</option>
                          <option value="compact2">
                            Compact 2 (Kèm thông tin)
                          </option>
                          <option value="qr_only">QR Only (Chỉ mã QR)</option>
                          <option value="print">Print (In ấn)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 flex justify-end">
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 min-w-30"
                      onClick={async () => {
                        try {
                          await api.systemSettings.update(systemSettings);
                          toast({
                            type: "success",
                            title: "Đã lưu cài đặt",
                            message: "Thông tin cấu hình đã được cập nhật.",
                          });
                        } catch (e) {
                          toast({
                            type: "error",
                            title: "Lỗi",
                            message: "Không thể lưu cài đặt.",
                          });
                        }
                      }}
                    >
                      <CheckCircle2 size={16} className="mr-2" /> Lưu thay đổi
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <ManagerRouteModal
            isOpen={isRouteModalOpen}
            onClose={() => setIsRouteModalOpen(false)}
            onSave={handleSaveRoute}
            initialData={editingRoute}
          />
          <ManagerCarModal
            isOpen={isBusModalOpen}
            onClose={() => setIsBusModalOpen(false)}
            onSave={handleSaveBus}
            initialData={editingBus}
            routes={routes}
          />
          <Dialog
            isOpen={!!deleteId}
            onClose={() => {
              setDeleteId(null);
              setDeleteType(null);
            }}
            title="Xác nhận xóa"
            className="max-w-md text-slate-900 border-indigo-900"
            headerClassName="px-4 h-[40px] border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white text-xs font-semibold"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Xóa {deleteType === "route" ? "tuyến đường" : "xe"} này?
              </h3>
              <p className="text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
                Hành động này sẽ xóa dữ liệu khỏi hệ thống và không thể hoàn
                tác.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="custom"
                  className="bg-indigo-950 border-indigo-950 text-white hover:bg-indigo-900 hover:text-white h-8 px-6 text-xs font-bold min-w-25"
                  onClick={() => {
                    setDeleteId(null);
                    setDeleteType(null);
                  }}
                >
                  Hủy bỏ
                </Button>
                <Button
                  variant="custom"
                  className="bg-red-600 border-red-600 text-white hover:bg-red-700 hover:text-white h-8 px-6 text-xs font-bold min-w-25"
                  onClick={
                    deleteType === "route" ? handleDeleteRoute : handleDeleteBus
                  }
                >
                  Xóa ngay
                </Button>
              </div>
            </div>
          </Dialog>
        </div>
      </div>
    </div>
  );
};
