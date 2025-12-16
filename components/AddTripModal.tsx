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
  const [direction, setDirection] = useState<"outbound" | "inbound">(
    "outbound"
  );
  const [time, setTime] = useState("07:00");
  const [price, setPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Effect: Update defaults when Route or Direction changes
  useEffect(() => {
    if (selectedRouteId && !initialData) {
      const route = routes.find((r) => r.id === selectedRouteId);
      if (route) {
        if (route.price) setPrice(route.price);

        // Auto-fill time based on selected direction
        if (direction === "inbound" && route.returnTime) {
          setTime(route.returnTime);
        } else if (direction === "outbound" && route.departureTime) {
          setTime(route.departureTime);
        }

        // Only reset bus if user hasn't selected one or logic requires it
        if (!selectedBusId) setSelectedBusId("");
      }
    }
  }, [selectedRouteId, direction, routes, initialData]);

  // Reset/Fill form on open
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit Mode
        let rId = "";
        if (initialData.routeId) {
          rId = String(initialData.routeId);
        } else {
          const r = routes.find((route) => route.name === initialData.route);
          rId = r ? String(r.id) : "";
        }
        setSelectedRouteId(rId);

        const bus = buses.find((b) => b.plate === initialData.licensePlate);
        setSelectedBusId(bus ? bus.id : "");

        // Extract time
        const timePart = initialData.departureTime.split(" ")[1] || "07:00";
        setTime(timePart);

        setPrice(initialData.basePrice);
        setDirection(initialData.direction || "outbound");
      } else {
        // Create Mode
        setSelectedRouteId(preSelectedRouteId || "");
        setSelectedBusId("");
        // Time & Direction defaults
        setDirection("outbound");
        if (!preSelectedRouteId) setTime("07:00");
        setPrice(0);
      }
    }
  }, [isOpen, preSelectedRouteId, initialData, routes, buses]);

  // Filter Buses Logic
  const filteredBuses = useMemo(() => {
    return buses.filter((bus) => {
      if (bus.status !== "Hoạt động" && bus.status !== "Xe thuê/Tăng cường")
        return false;
      if (initialData && bus.plate === initialData.licensePlate) return true;
      if (!selectedRouteId) return true;

      const currentRoute = routes.find((r) => r.id === selectedRouteId);
      if (!currentRoute) return true;
      if (currentRoute.isEnhanced) return true;
      if (bus.status === "Xe thuê/Tăng cường") return true;

      return (
        String(bus.defaultRouteId) === String(selectedRouteId) ||
        !bus.defaultRouteId
      );
    });
  }, [buses, selectedRouteId, routes, initialData]);

  // Warning Check Logic
  const conflictWarning = useMemo(() => {
    if (!selectedRouteId || !selectedBusId) return null;

    const route = routes.find((r) => r.id === selectedRouteId);
    // Skip check for Enhanced routes
    if (route?.isEnhanced) return null;

    const selectedBus = buses.find((b) => b.id === selectedBusId);
    if (!selectedBus) return null;

    // Filter trips for this day
    const tripsOnDay = existingTrips.filter((t) => {
      const tDate = new Date(t.departureTime.split(" ")[0]);
      return isSameDay(tDate, targetDate) && t.id !== initialData?.id; // Exclude self if editing
    });

    // Check 1: Same route, opposite direction with same plate
    const sameRouteTrips = tripsOnDay.filter(
      (t) =>
        (t.routeId && String(t.routeId) === String(selectedRouteId)) ||
        t.route === route?.name
    );

    const oppositeDirectionTrip = sameRouteTrips.find(
      (t) => t.direction !== direction && t.licensePlate === selectedBus.plate
    );

    if (oppositeDirectionTrip) {
      return {
        title: "Xung đột chiều chạy",
        message: `Xe ${selectedBus.plate} đã được xếp chạy chiều ngược lại (${
          oppositeDirectionTrip.direction === "inbound"
            ? "Chiều về"
            : "Chiều đi"
        }) trong ngày này.`,
      };
    }

    // Check 2: Different route with same plate
    const otherRouteTrip = tripsOnDay.find((t) => {
      const isDifferentRoute =
        (t.routeId && String(t.routeId) !== String(selectedRouteId)) ||
        t.route !== route?.name;
      return isDifferentRoute && t.licensePlate === selectedBus.plate;
    });

    if (otherRouteTrip) {
      return {
        title: "Trùng xe với tuyến khác",
        message: `Xe ${selectedBus.plate} đã được xếp cho tuyến "${otherRouteTrip.route}" trong ngày này.`,
      };
    }

    return null;
  }, [
    selectedRouteId,
    selectedBusId,
    direction,
    existingTrips,
    targetDate,
    routes,
    buses,
    initialData,
  ]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    setPrice(rawValue ? parseInt(rawValue, 10) : 0);
  };

  const formatPrice = (val: number) => {
    return val.toLocaleString("vi-VN");
  };

  const handleSubmit = async () => {
    if (!selectedRouteId || !selectedBusId) return;

    setIsSaving(true);

    const route = routes.find((r) => r.id === selectedRouteId);
    const bus = buses.find((b) => b.id === selectedBusId);

    if (!route || !bus) {
      setIsSaving(false);
      return;
    }

    const dateStr = `${targetDate.getFullYear()}-${String(
      targetDate.getMonth() + 1
    ).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
    const dateTimeStr = `${dateStr} ${time}`;

    // --- SEAT GENERATION LOGIC ---
    let finalSeats: Seat[] = [];
    const busChanged = initialData && initialData.licensePlate !== bus.plate;
    const isNew = !initialData;

    // 1. Snapshot previous seats state (status map)
    const previousSeats = initialData?.seats || [];
    const occupiedSeatMap = new Map<string, SeatStatus>(); // Key = Label, Value = Status
    const occupiedSeatFullData = new Map<string, Seat>(); // Key = Label, Value = Full Object

    previousSeats.forEach((s) => {
      if (s.status !== SeatStatus.AVAILABLE) {
        occupiedSeatMap.set(s.label, s.status);
        occupiedSeatFullData.set(s.label, s);
      }
    });

    // 2. Generate FRESH layout based on the SELECTED bus
    let newLayoutSeats: Seat[] = [];

    if (bus.layoutConfig) {
      // Use Custom Config
      const config = bus.layoutConfig;
      for (let f = 1; f <= config.floors; f++) {
        for (let r = 0; r < config.rows; r++) {
          for (let c = 0; c < config.cols; c++) {
            const key = `${f}-${r}-${c}`;
            if (config.activeSeats.includes(key)) {
              let label = config.seatLabels?.[key];
              if (!label) {
                // Fallback label generation
                if (bus.type === BusType.CABIN) {
                  const prefix = String.fromCharCode(65 + c);
                  const num = r * 2 + f;
                  label = `${prefix}${num}`;
                } else {
                  const seatsPerRow = config.cols * config.floors;
                  const val = r * seatsPerRow + (f - 1) * config.cols + c + 1;
                  label = val.toString();
                }
              }
              newLayoutSeats.push({
                id: label, // Using Label as ID for consistency in new trips
                label: label,
                floor: f as 1 | 2,
                status: SeatStatus.AVAILABLE,
                price: price,
                row: r,
                col: c,
              });
            }
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
                let label = config.seatLabels?.[key];
                if (!label) {
                  const prefix = f === 1 ? "A" : "B";
                  label =
                    bus.type === BusType.CABIN
                      ? `${prefix}-G${i + 1}`
                      : `B${f}-${i + 1}`;
                }
                newLayoutSeats.push({
                  id: label,
                  label,
                  floor: f as 1 | 2,
                  status: SeatStatus.AVAILABLE,
                  price: price,
                  row: config.rows,
                  col: i,
                });
              }
            }
          }
        }
      }
    } else {
      // Use Default Generators
      newLayoutSeats =
        bus.type === BusType.CABIN
          ? generateCabinLayout(price)
          : generateSleeperLayout(price);
    }

    // 3. MERGE LOGIC
    if (isNew) {
      finalSeats = newLayoutSeats;
    } else {
      const handledOldIds = new Set<string>(); // Tracks IDs of seats mapped positionally (like Bench 2)

      // --- SPECIAL MAPPING: Floor 2 Rear Bench Positional Mapping ---
      // If we are editing (not new) and specifically for sleeper/buses with benches
      if (busChanged) {
        // 1. Identify Bench Row in OLD Bus (Floor 2, Row with >= 5 cols)
        const oldSeatsF2 = previousSeats.filter((s) => s.floor === 2);
        const oldRowCounts = oldSeatsF2.reduce((acc, s) => {
          const r = s.row ?? 0;
          acc[r] = (acc[r] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        const oldBenchRow = Object.keys(oldRowCounts).find(
          (r) => oldRowCounts[Number(r)] >= 5
        );

        // 2. Identify Bench Row in NEW Bus
        const newSeatsF2 = newLayoutSeats.filter((s) => s.floor === 2);
        const newRowCounts = newSeatsF2.reduce((acc, s) => {
          const r = s.row ?? 0;
          acc[r] = (acc[r] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        const newBenchRow = Object.keys(newRowCounts).find(
          (r) => newRowCounts[Number(r)] >= 5
        );

        // 3. Map Positionally (Index 0->0, 1->1...)
        if (oldBenchRow !== undefined && newBenchRow !== undefined) {
          const oldBenchSeats = oldSeatsF2
            .filter((s) => s.row === Number(oldBenchRow))
            .sort((a, b) => (a.col ?? 0) - (b.col ?? 0));

          const newBenchSeats = newSeatsF2
            .filter((s) => s.row === Number(newBenchRow))
            .sort((a, b) => (a.col ?? 0) - (b.col ?? 0));

          // Iterate positions 0 to 4
          for (let i = 0; i < 5; i++) {
            const oldS = oldBenchSeats[i];
            const newS = newBenchSeats[i];

            // If old seat exists at this index, is occupied, and new seat exists
            if (oldS && newS && oldS.status !== SeatStatus.AVAILABLE) {
              // Override mapping for this NEW label to match OLD status
              occupiedSeatMap.set(newS.label, oldS.status);

              // Mark OLD seat as handled so it doesn't appear as Orphan
              handledOldIds.add(oldS.id);
            }
          }
        }
      }

      // A. Update statuses of new layout matching old labels (or injected positional mappings)
      finalSeats = newLayoutSeats.map((newSeat) => {
        if (occupiedSeatMap.has(newSeat.label)) {
          return {
            ...newSeat,
            status: occupiedSeatMap.get(newSeat.label)!,
            price: price,
          };
        }
        return newSeat;
      });

      // B. Handle ORPHANED seats (Occupied in old bus, but label not found in new bus)
      const newLayoutLabels = new Set(newLayoutSeats.map((s) => s.label));

      previousSeats.forEach((oldSeat) => {
        if (
          oldSeat.status !== SeatStatus.AVAILABLE &&
          !newLayoutLabels.has(oldSeat.label) &&
          !handledOldIds.has(oldSeat.id) // Skip if handled by Bench Logic
        ) {
          finalSeats.push({
            ...oldSeat,
            id: oldSeat.id, // Keep original ID
            label: oldSeat.label,
            status: oldSeat.status,
            price: oldSeat.price, // Keep original price
            floor: 1, // Default floor
            row: 99, // MARKER FOR ORPHAN ROW
            col: 0,
          });
        }
      });
    }

    // Name Generation logic
    let tripName = route.name;
    if (route.origin && route.destination) {
      if (direction === "inbound") {
        tripName = `${route.destination} - ${route.origin}`;
      } else {
        tripName = `${route.origin} - ${route.destination}`;
      }
    } else if (route.name.includes(" - ")) {
      const parts = route.name.split(" - ");
      if (parts.length === 2) {
        if (direction === "inbound") {
          tripName = `${parts[1]} - ${parts[0]}`;
        } else {
          tripName = route.name;
        }
      }
    }

    const tripData: Partial<BusTrip> = {
      routeId: route.id,
      name: tripName,
      route: route.name,
      departureTime: dateTimeStr,
      type: bus.type,
      licensePlate: bus.plate,
      basePrice: price,
      seats: finalSeats,
      direction: direction,
    };

    try {
      await onSave(tripData);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const getRouteLabel = () => {
    const r = routes.find((x) => x.id === selectedRouteId);
    if (!r) return "";
    return r.name;
  };

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Cập nhật chuyến xe" : "Tạo lịch chạy mới"}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Hủy bỏ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !selectedRouteId || !selectedBusId}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <Loader2 className="animate-spin mr-2" size={16} />
            ) : (
              <CheckCircle2 className="mr-2" size={16} />
            )}
            {initialData ? "Cập nhật" : "Lưu chuyến"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* --- LEFT COLUMN: ROUTE & BUS --- */}
        <div className="space-y-5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
              <MapPin size={18} className="text-primary" /> Thông tin tuyến
            </h3>

            {/* Route Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Chọn tuyến đường <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm"
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                disabled={!!preSelectedRouteId && !initialData}
              >
                <option value="">-- Chọn tuyến --</option>
                {routes
                  .filter((r) => r.status !== "inactive")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.isEnhanced ? "(Tăng cường)" : ""}
                    </option>
                  ))}
              </select>
            </div>

            {/* Direction Buttons */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Chiều chạy
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDirection("outbound")}
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    direction === "outbound"
                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>Chiều đi</span>
                    <ArrowRight size={14} />
                  </div>
                  <div className="text-[10px] mt-1 opacity-80">
                    {selectedRoute?.origin || "Điểm đi"} ➝{" "}
                    {selectedRoute?.destination || "Điểm đến"}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDirection("inbound")}
                  className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    direction === "inbound"
                      ? "bg-orange-50 border-orange-500 text-orange-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <ArrowRight size={14} className="rotate-180" />
                    <span>Chiều về</span>
                  </div>
                  <div className="text-[10px] mt-1 opacity-80">
                    {selectedRoute?.destination || "Điểm đến"} ➝{" "}
                    {selectedRoute?.origin || "Điểm đi"}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Bus Selection - CARD GRID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Chọn xe vận hành <span className="text-red-500">*</span>
            </label>

            {!selectedRouteId ? (
              <div className="bg-slate-100 border border-slate-200 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-slate-400">
                <BusFront size={24} className="mb-2 opacity-50" />
                <span className="text-sm">Vui lòng chọn tuyến đường trước</span>
              </div>
            ) : filteredBuses.length === 0 ? (
              <div className="text-sm text-red-600 bg-red-50 p-4 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center">
                <AlertTriangle size={24} />
                <p>Không tìm thấy xe phù hợp cho tuyến này.</p>
                <p className="text-xs text-red-500">
                  Hãy kiểm tra lại cấu hình tuyến mặc định của xe hoặc thêm xe
                  tăng cường.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                {filteredBuses.map((bus) => {
                  const isSelected = bus.id === selectedBusId;
                  const isEnhanced = bus.status === "Xe thuê/Tăng cường";

                  return (
                    <button
                      key={bus.id}
                      type="button"
                      onClick={() => setSelectedBusId(bus.id)}
                      className={`
                            relative flex flex-col items-start p-3 rounded-lg border transition-all text-left group
                            ${
                              isSelected
                                ? "bg-primary/5 border-primary ring-1 ring-primary shadow-sm z-10"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            }
                          `}
                    >
                      <div className="flex items-start justify-between w-full mb-1">
                        <span
                          className={`font-bold text-sm ${
                            isSelected ? "text-primary" : "text-slate-800"
                          }`}
                        >
                          {bus.plate}
                        </span>
                        {isEnhanced && (
                          <span title="Xe thuê/Tăng cường">
                            <Zap
                              size={14}
                              className="text-amber-500 fill-amber-500"
                            />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <LayoutGrid size={12} />
                        <span>
                          {bus.type === BusType.CABIN ? "Phòng" : "Giường"}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 mx-0.5"></span>
                        <span>{bus.seats} chỗ</span>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <Check size={16} className="text-primary" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Warning Display */}
          {conflictWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
              <AlertTriangle
                className="text-yellow-600 shrink-0 mt-0.5"
                size={20}
              />
              <div>
                <h4 className="text-sm font-bold text-yellow-800">
                  {conflictWarning.title}
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                  {conflictWarning.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* --- RIGHT COLUMN: TIME & PRICE --- */}
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 h-full flex flex-col">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Clock size={18} className="text-primary" /> Thời gian & Giá vé
            </h3>

            <div className="space-y-5 flex-1">
              {/* Date Display */}
              <div className="bg-blue-50 text-blue-800 px-4 py-3 rounded-lg flex items-center gap-3 border border-blue-100">
                <Calendar className="text-blue-600" size={24} />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">
                    Ngày khởi hành
                  </div>
                  <div className="font-bold text-lg leading-none">
                    {targetDate.toLocaleDateString("vi-VN")}
                  </div>
                </div>
              </div>

              {/* Time Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Giờ khởi hành
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Clock size={16} />
                  </div>
                  <input
                    title="Định dạng 24h (HH:MM)"
                    type="time"
                    required
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm font-medium"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {direction === "outbound"
                    ? `Giờ xuất bến mặc định: ${
                        selectedRoute?.departureTime || "--:--"
                      }`
                    : `Giờ về mặc định: ${
                        selectedRoute?.returnTime || "--:--"
                      }`}
                </p>
              </div>

              {/* Price Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Giá vé (VNĐ)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Wallet size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 font-bold shadow-sm text-lg"
                    value={formatPrice(price)}
                    onChange={handlePriceChange}
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Giá niêm yết:{" "}
                  {selectedRoute?.price?.toLocaleString("vi-VN") || 0} đ
                </p>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100">
                <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <p>
                    Lịch chạy sẽ được tạo tự động với cấu hình ghế và giá vé đã
                    chọn. Bạn có thể chỉnh sửa ghế sau khi tạo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};