
import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Bus, Route, BusTrip, BusType, SeatStatus, Seat } from "../types";
import {
  Loader2,
  Clock,
  MapPin,
  Wallet,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  BusFront,
  LayoutGrid,
  Info,
  ArrowRight,
  Zap,
  Check,
} from "lucide-react";
import {
  generateCabinLayout,
  generateSleeperLayout,
} from "../utils/generators";
import { isSameDay } from "../utils/dateUtils";
import { Badge } from "./ui/Badge";

interface AddTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: Date;
  preSelectedRouteId?: string;
  initialData?: BusTrip;
  existingTrips: BusTrip[];
  routes: Route[];
  buses: Bus[];
  onSave: (tripData: Partial<BusTrip>) => Promise<void>;
}

export const AddTripModal: React.FC<AddTripModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  preSelectedRouteId,
  initialData,
  existingTrips,
  routes,
  buses,
  onSave,
}) => {
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedBusId, setSelectedBusId] = useState<string>("");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [time, setTime] = useState("07:00");
  const [price, setPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedRouteId && !initialData) {
      const route = routes.find((r) => r.id === selectedRouteId);
      if (route) {
        if (route.price) setPrice(route.price);
        if (direction === "inbound" && route.returnTime) setTime(route.returnTime);
        else if (direction === "outbound" && route.departureTime) setTime(route.departureTime);
        if (!selectedBusId) setSelectedBusId("");
      }
    }
  }, [selectedRouteId, direction, routes, initialData]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        let rId = initialData.routeId ? String(initialData.routeId) : (routes.find(r => r.name === initialData.route)?.id || "");
        setSelectedRouteId(String(rId));
        const bus = buses.find((b) => b.plate === initialData.licensePlate);
        setSelectedBusId(bus ? bus.id : "");
        setTime(initialData.departureTime.split(" ")[1] || "07:00");
        setPrice(initialData.basePrice);
        setDirection(initialData.direction || "outbound");
      } else {
        setSelectedRouteId(preSelectedRouteId || "");
        setSelectedBusId("");
        setDirection("outbound");
        if (!preSelectedRouteId) setTime("07:00");
        setPrice(0);
      }
    }
  }, [isOpen, preSelectedRouteId, initialData, routes, buses]);

  const filteredBuses = useMemo(() => {
    return buses.filter((bus) => {
      if (bus.status !== "Hoạt động" && bus.status !== "Xe thuê/Tăng cường") return false;
      if (initialData && bus.plate === initialData.licensePlate) return true;
      if (!selectedRouteId) return true;
      const currentRoute = routes.find((r) => r.id === selectedRouteId);
      if (!currentRoute || currentRoute.isEnhanced || bus.status === "Xe thuê/Tăng cường") return true;
      return String(bus.defaultRouteId) === String(selectedRouteId) || !bus.defaultRouteId;
    });
  }, [buses, selectedRouteId, routes, initialData]);

  const conflictWarning = useMemo(() => {
    if (!selectedRouteId || !selectedBusId) return null;
    const route = routes.find((r) => r.id === selectedRouteId);
    if (route?.isEnhanced) return null;
    const selectedBus = buses.find((b) => b.id === selectedBusId);
    if (!selectedBus) return null;
    const tripsOnDay = existingTrips.filter((t) => {
      const tDate = new Date(t.departureTime.split(" ")[0]);
      return isSameDay(tDate, targetDate) && t.id !== initialData?.id;
    });
    const sameRouteTrips = tripsOnDay.filter(t => (t.routeId && String(t.routeId) === String(selectedRouteId)) || t.route === route?.name);
    const oppositeDirectionTrip = sameRouteTrips.find(t => t.direction !== direction && t.licensePlate === selectedBus.plate);
    if (oppositeDirectionTrip) return { title: "Xung đột chiều chạy", message: `Xe ${selectedBus.plate} đã được xếp chạy chiều ngược lại.` };
    const otherRouteTrip = tripsOnDay.find(t => ((t.routeId && String(t.routeId) !== String(selectedRouteId)) || t.route !== route?.name) && t.licensePlate === selectedBus.plate);
    if (otherRouteTrip) return { title: "Trùng xe với tuyến khác", message: `Xe ${selectedBus.plate} đã được xếp cho tuyến "${otherRouteTrip.route}".` };
    return null;
  }, [selectedRouteId, selectedBusId, direction, existingTrips, targetDate, routes, buses, initialData]);

  const handleSubmit = async () => {
    if (!selectedRouteId || !selectedBusId) return;
    setIsSaving(true);
    const route = routes.find((r) => r.id === selectedRouteId);
    const bus = buses.find((b) => b.id === selectedBusId);
    if (!route || !bus) { setIsSaving(false); return; }

    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
    const dateTimeStr = `${dateStr} ${time}`;

    // FIX: Sử dụng Map theo ID ghế (Số thứ tự) để bảo toàn trạng thái, KHÔNG dùng tọa độ hàng/cột
    const occupiedSeatsMap = new Map<string, Seat>(); 
    (initialData?.seats || []).forEach((s) => {
      if (s.status !== SeatStatus.AVAILABLE) {
        occupiedSeatsMap.set(s.id, s);
      }
    });

    let newLayoutSeats: Seat[] = [];
    if (bus.layoutConfig) {
      const config = bus.layoutConfig;
      // Standard seats
      for (let f = 1; f <= config.floors; f++) {
        for (let r = 0; r < config.rows; r++) {
          for (let c = 0; c < config.cols; c++) {
            const key = `${f}-${r}-${c}`;
            if (config.activeSeats.includes(key)) {
              let label = config.seatLabels?.[key] || (bus.type === BusType.CABIN ? `${c === 0 ? 'B' : 'A'}${r + 1}` : `${newLayoutSeats.length + 1}`);
              newLayoutSeats.push({ id: label, label, floor: f as 1 | 2, status: SeatStatus.AVAILABLE, price: price, row: r, col: c });
            }
          }
        }
      }
      // Floor seats
      if (config.hasFloorSeats) {
          const fCount = bus.type === BusType.CABIN ? 6 : 12;
          for (let i = 0; i < fCount; i++) {
              const key = `1-floor-${i}`;
              if (config.activeSeats.includes(key)) {
                  const label = config.seatLabels?.[key] || `Sàn ${i + 1}`;
                  newLayoutSeats.push({ id: label, label, floor: 1, status: SeatStatus.AVAILABLE, price: price, row: i, col: 0, isFloorSeat: true });
              }
          }
      }
      // Rear Bench
      if (config.hasRearBench) {
        for (let f = 1; f <= config.floors; f++) {
          if (config.benchFloors?.includes(f)) {
            for (let i = 0; i < 5; i++) {
              const key = `${f}-bench-${i}`;
              if (config.activeSeats.includes(key)) {
                let label = config.seatLabels?.[key] || (bus.type === BusType.CABIN ? `G${i + 1}` : `B${f}-${i + 1}`);
                newLayoutSeats.push({ id: label, label, floor: f as 1 | 2, status: SeatStatus.AVAILABLE, price: price, row: config.rows, col: i });
              }
            }
          }
        }
      }
    } else {
      newLayoutSeats = bus.type === BusType.CABIN ? generateCabinLayout(price) : generateSleeperLayout(price);
    }

    const handledOldIds = new Set<string>();
    let finalSeats = newLayoutSeats.map((newSeat) => {
      // FIX: Ánh xạ dựa trên ID (Số thứ tự ghế)
      const oldSeat = occupiedSeatsMap.get(newSeat.id);
      if (oldSeat) {
        handledOldIds.add(oldSeat.id);
        // Giữ trạng thái cũ, nhưng cập nhật vị trí hàng/tầng theo bus mới
        return { ...newSeat, status: oldSeat.status, price: price, note: oldSeat.note };
      }
      return newSeat;
    });

    // Những ghế cũ đã đặt nhưng không tìm thấy ID tương ứng trên bus mới (Ghế thừa/Lệch sơ đồ)
    (initialData?.seats || []).forEach((oldSeat) => {
      if (oldSeat.status !== SeatStatus.AVAILABLE && !handledOldIds.has(oldSeat.id)) {
        // Đưa vào khu vực "Ghế lệch sơ đồ" (row: 99) để quản lý không bị mất dữ liệu
        finalSeats.push({ ...oldSeat, floor: 1, row: 99, col: 0 });
      }
    });

    let tripName = route.origin && route.destination ? (direction === "inbound" ? `${route.destination} - ${route.origin}` : `${route.origin} - ${route.destination}`) : route.name;

    try {
      await onSave({ routeId: route.id, name: tripName, route: route.name, departureTime: dateTimeStr, type: bus.type, licensePlate: bus.plate, basePrice: price, seats: finalSeats, direction: direction });
      onClose();
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={initialData ? "Cập nhật chuyến xe" : "Tạo lịch chạy mới"} className="max-w-4xl"
      footer={<><Button variant="outline" onClick={onClose} disabled={isSaving}>Hủy bỏ</Button><Button onClick={handleSubmit} disabled={isSaving || !selectedRouteId || !selectedBusId} className="min-w-[120px]">{isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle2 className="mr-2" size={16} />}{initialData ? "Cập nhật" : "Lưu chuyến"}</Button></>}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 text-sm"><MapPin size={18} className="text-primary" /> Thông tin tuyến</h3>
            <div className="mb-4"><label className="block text-sm font-medium text-slate-700 mb-1.5">Chọn tuyến đường <span className="text-red-500">*</span></label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 bg-white text-sm" value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)} disabled={!!preSelectedRouteId && !initialData}>
                <option value="">-- Chọn tuyến --</option>
                {routes.filter((r) => r.status !== "inactive").map((r) => (<option key={r.id} value={r.id}>{r.name} {r.isEnhanced ? "(Tăng cường)" : ""}</option>))}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-2">Chiều chạy</label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDirection("outbound")} className={`flex-1 p-3 rounded-lg border-2 transition-all ${direction === "outbound" ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200"}`}><div className="flex items-center gap-2 font-bold text-sm"><span>Chiều đi</span><ArrowRight size={14} /></div></button>
                <button type="button" onClick={() => setDirection("inbound")} className={`flex-1 p-3 rounded-lg border-2 transition-all ${direction === "inbound" ? "bg-orange-50 border-orange-500 text-orange-700 shadow-sm" : "bg-white border-slate-200"}`}><div className="flex items-center gap-2 font-bold text-sm"><ArrowRight size={14} className="rotate-180" /><span>Chiều về</span></div></button>
              </div>
            </div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 mb-2">Chọn xe vận hành <span className="text-red-500">*</span></label>
            {!selectedRouteId ? <div className="bg-slate-100 border border-slate-200 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-slate-400"><BusFront size={24} className="mb-2 opacity-50" /><span className="text-sm">Vui lòng chọn tuyến đường trước</span></div>
            : filteredBuses.length === 0 ? <div className="text-sm text-red-600 bg-red-50 p-4 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center"><AlertTriangle size={24} /><p>Không tìm thấy xe phù hợp.</p></div>
            : <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">{filteredBuses.map((bus) => (<button key={bus.id} type="button" onClick={() => setSelectedBusId(bus.id)} className={`relative flex flex-col items-start p-3 rounded-lg border transition-all text-left group ${bus.id === selectedBusId ? "bg-primary/5 border-primary ring-1 ring-primary" : "bg-white border-slate-200"}`}><div className="flex items-start justify-between w-full mb-1"><span className={`font-bold text-sm ${bus.id === selectedBusId ? "text-primary" : "text-slate-800"}`}>{bus.plate}</span>{bus.status === "Xe thuê/Tăng cường" && <span><Zap size={14} className="text-amber-500 fill-amber-500" /></span>}</div><div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1"><LayoutGrid size={12} /><span>{bus.type === BusType.CABIN ? "Phòng" : "Giường"}</span></div></button>))}</div>}
          </div>
        </div>
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 h-full flex flex-col shadow-sm">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 text-sm"><Clock size={18} className="text-primary" /> Thời gian & Giá vé</h3>
            <div className="space-y-5 flex-1">
              <div className="bg-blue-50 text-blue-800 px-4 py-3 rounded-lg flex items-center gap-3 border border-blue-100"><Calendar className="text-blue-600" size={24} /><div><div className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">Ngày khởi hành</div><div className="font-bold text-lg leading-none">{targetDate.toLocaleDateString("vi-VN")}</div></div></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Giờ khởi hành</label>
                <input type="time" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Giá vé (VNĐ)</label>
                <input type="text" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none font-bold" value={price.toLocaleString("vi-VN")} onChange={(e) => setPrice(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))} />
              </div>
              <div className="mt-auto pt-4 border-t border-slate-100"><div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100"><Info size={14} className="shrink-0 mt-0.5 text-slate-400" /><p>Hệ thống bảo toàn số ghế cũ dựa trên mã số ghế khi bạn thay đổi xe hoặc cập nhật thông tin.</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
