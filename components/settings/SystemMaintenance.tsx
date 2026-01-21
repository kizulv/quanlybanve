import React, { useState, useMemo, useEffect } from "react";
import { Bus, BusTrip, BusType, Route, MaintenanceLog } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useToast } from "../ui/Toast";
import { api } from "../../lib/api";
import {
  BarChart3,
  LayoutGrid,
  Activity,
  ShieldCheck,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Calendar,
  CircleDollarSign,
  WalletCards,
  Settings2,
} from "lucide-react";

interface SystemMaintenanceProps {
  buses: Bus[];
  trips: BusTrip[];
  onDataChange: () => Promise<void>;
}

export const SystemMaintenance: React.FC<SystemMaintenanceProps> = ({
  buses,
  trips,
  onDataChange,
}) => {
  const { toast } = useToast();

  // -- STATE --
  const [isFixingSeats, setIsFixingSeats] = useState(false);
  const [isFixingPayments, setIsFixingPayments] = useState(false);

  // Persistence: Seats
  const [maintenanceResults, setMaintenanceResults] = useState<{
    logs: MaintenanceLog[];
    counts: { fixed: number; sync: number; conflict: number };
  } | null>(() => {
    try {
      const saved = localStorage.getItem("settings_fix_seats_results");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (maintenanceResults) {
      localStorage.setItem(
        "settings_fix_seats_results",
        JSON.stringify(maintenanceResults),
      );
    } else if (!isFixingSeats) {
      // Only clear if null and not currently running (avoid clearing during init)
      // Actually best to only clear if explicitly requested.
      // If handleFixSeats sets it to null, we want to remove it.
      if (localStorage.getItem("settings_fix_seats_results")) {
        localStorage.removeItem("settings_fix_seats_results");
      }
    }
  }, [maintenanceResults, isFixingSeats]);

  // Persistence: Payments (Optional, but good for consistency)
  const [paymentMaintenanceResults, setPaymentMaintenanceResults] = useState<{
    logs: MaintenanceLog[];
    deletedCount: number;
    fixedCount: number;
    mismatchCount: number;
  } | null>(null);

  // Stats Check
  const detailedStats = useMemo(() => {
    const cabinBuses = buses.filter((b) => b.type === BusType.CABIN).length;
    const sleeperBuses = buses.filter((b) => b.type === BusType.SLEEPER).length;
    let cabinOccupied = 0;
    let sleeperOccupied = 0;
    trips.forEach((t) => {
      const occupied = (t.seats || []).filter(
        (s) => s.status !== "available",
      ).length;
      if (t.type === BusType.CABIN) cabinOccupied += occupied;
      else sleeperOccupied += occupied;
    });
    return { cabinBuses, sleeperBuses, cabinOccupied, sleeperOccupied };
  }, [buses, trips]);

  // -- HANDLERS --
  const handleFixSeats = async () => {
    setIsFixingSeats(true);
    setMaintenanceResults(null);
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
        ? `Tạo payment hoàn tiền ${Math.abs(difference).toLocaleString()}đ (Thừa)?`
        : `Tạo payment bù ${Math.abs(difference).toLocaleString()}đ (Thiếu)?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const paymentAmount = -difference;
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
    <div className="space-y-6 focus-visible:outline-none">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resource Stats */}
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

        {/* Seat Occupancy Stats */}
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
                        100,
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
                        100,
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
                  Quét & Khôi phục sơ đồ ghế (Ghost & Duplicate Seats Fix)
                </h4>
                <p className="text-slate-500 mb-6 leading-relaxed max-w-3xl text-xs">
                  Hệ thống thực hiện đối soát 3 chiều giữa{" "}
                  <strong>Dòng tiền (Payments)</strong>,{" "}
                  <strong>Đơn hàng (Bookings)</strong> và{" "}
                  <strong>Sơ đồ ghế (Trips)</strong>. Tự động phát hiện ghế bị
                  trùng giữa 2 số điện thoại và giữ lại đơn có thanh toán cao
                  hơn. Giải phóng các "ghế ma" không có đơn hàng thực tế.
                </p>
                <div className="flex flex-wrap gap-4 items-center">
                  <Button
                    type="button"
                    onClick={handleFixSeats}
                    disabled={isFixingSeats}
                    className="bg-indigo-600 hover:bg-indigo-700 h-10 px-8 font-bold text-base"
                  >
                    {isFixingSeats ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />
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
                            <th className="px-6 py-3">Ghế & Lịch trình</th>
                            <th className="px-6 py-3">Loại sửa đổi</th>
                            <th className="px-6 py-3">Chi tiết xử lý</th>
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
                  <strong>Chênh lệch số tiền</strong> giữa Payment History và
                  Booking, <strong>Payments</strong> không có đơn hàng,{" "}
                  <strong>Payments lỗi</strong> của đơn HOLD, và{" "}
                  <strong>Tổng tiền booking sai</strong>. Hệ thống sẽ tự động
                  xóa các payment không hợp lệ và báo cáo chi tiết các chênh
                  lệch cần xử lý thủ công.
                </p>
                <div className="flex flex-wrap gap-4 items-center">
                  <Button
                    type="button"
                    onClick={handleFixPayments}
                    disabled={isFixingPayments}
                    className="bg-emerald-600 hover:bg-emerald-700 h-10 px-8 font-bold text-base"
                  >
                    {isFixingPayments ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />
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
                        Chênh lệch: {paymentMaintenanceResults.mismatchCount}
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold px-3 py-1.5">
                        Đã sửa: {paymentMaintenanceResults.fixedCount}
                      </Badge>
                    </div>
                  </div>

                  <div className="max-h-75 overflow-y-auto">
                    {paymentMaintenanceResults.logs.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 italic font-medium">
                        Hệ thống tài chính sạch. Không tìm thấy thanh toán lỗi
                        nào.
                      </div>
                    ) : (
                      <table className="w-full text-sm text-left">
                        <thead className="bg-emerald-100/50 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 border-b border-emerald-200">
                          <tr>
                            <th className="px-6 py-3">Lịch trình & Ghế</th>
                            <th className="px-6 py-3">Phân loại</th>
                            <th className="px-6 py-3">Lý do xử lý</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-200/50">
                          {paymentMaintenanceResults.logs.map((log, idx) => (
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
                                      : log.action.includes("Chỉnh") ||
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
                                  {log.action.includes("Chênh lệch") &&
                                    log.bookingId && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleFixMismatch(log)}
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
      </div>
    </div>
  );
};
