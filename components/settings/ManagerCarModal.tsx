import React, { useState, useEffect } from "react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Bus, BusType, BusLayoutConfig, Route } from "../../types";
import { Save, Settings2, Info, X, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/AlertDialog";

interface ManagerCarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bus: Bus) => Promise<void> | void;
  initialData?: Bus | null;
  routes: Route[];
}

export const ManagerCarModal: React.FC<ManagerCarModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  routes,
}) => {
  // Form State
  const [plate, setPlate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [defaultRouteId, setDefaultRouteId] = useState("");
  const [type, setType] = useState<BusType>(BusType.CABIN);
  const [status, setStatus] = useState<Bus["status"]>("Hoạt động");
  const [isSaving, setIsSaving] = useState(false);
  const [isErrorAlertOpen, setIsErrorAlertOpen] = useState(false);

  // Layout Builder State
  const [config, setConfig] = useState<BusLayoutConfig>({
    floors: 2,
    rows: 11,
    cols: 2,
    activeSeats: [],
    seatLabels: {},
    hasRearBench: false,
    benchFloors: [1],
    hasFloorSeats: false,
    floorSeatCount: 0,
  });

  const [editingSeat, setEditingSeat] = useState<{
    key: string;
    label: string;
    floor: number;
  } | null>(null);

  useEffect(() => {
    if (initialData) {
      setPlate(initialData.plate);
      setPhoneNumber(initialData.phoneNumber || "");
      setDefaultRouteId(initialData.defaultRouteId || "");
      setType(initialData.type);
      setStatus(initialData.status);

      if (initialData.layoutConfig) {
        setConfig({
          ...initialData.layoutConfig,
          floors: 2,
          benchFloors:
            initialData.layoutConfig.benchFloors ||
            (initialData.layoutConfig.hasRearBench ? [1] : []),
        });
      } else {
        initDefaultConfig(initialData.type);
      }
    } else {
      setPlate("");
      setPhoneNumber("");
      setDefaultRouteId("");
      setType(BusType.CABIN);
      setStatus("Hoạt động");
      initDefaultConfig(BusType.CABIN);
    }
    setEditingSeat(null);
    setIsSaving(false);
  }, [initialData, isOpen]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    let formatted = val;
    if (val.length > 7) {
      formatted = `${val.slice(0, 4)} ${val.slice(4, 7)} ${val.slice(7, 10)}`;
    } else if (val.length > 4) {
      formatted = `${val.slice(0, 4)} ${val.slice(4)}`;
    }
    setPhoneNumber(formatted);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as Bus["status"];
    setStatus(newStatus);
    if (newStatus !== "Hoạt động") {
      setDefaultRouteId("");
    }
  };

  const recalculateLabels = (
    activeSeats: string[],
    busTypeOverride?: BusType,
    currentCols?: number,
    currentLabels?: Record<string, string>,
  ) => {
    const currentBusType = busTypeOverride || type;
    const colsCount = currentCols || config.cols;
    const newLabels: Record<string, string> = {
      ...(currentLabels || config.seatLabels),
    };

    const parseKey = (key: string) => {
      const parts = key.split("-");
      const floor = parseInt(parts[0]);
      if (parts[1] === "bench") {
        return {
          floor,
          isBench: true,
          isFloor: false,
          r: 999,
          c: parseInt(parts[2]),
        };
      }
      if (parts[1] === "floor") {
        return {
          floor,
          isBench: false,
          isFloor: true,
          r: 1000,
          c: parseInt(parts[2]),
        };
      }
      return {
        floor,
        isBench: false,
        isFloor: false,
        r: parseInt(parts[1]),
        c: parseInt(parts[2]),
      };
    };

    // Reset floor labels
    const floorSeatKeys = activeSeats
      .filter((k) => k.includes("-floor-"))
      .sort((a, b) => {
        const ka = parseKey(a);
        const kb = parseKey(b);
        return ka.c - kb.c;
      });
    floorSeatKeys.forEach((k, i) => {
      newLabels[k] = `Sàn ${i + 1}`;
    });

    if (currentBusType === BusType.CABIN) {
      // CABIN: Mỗi dãy A và B có 12 phòng (6 hàng × 2 tầng)
      // Đánh số theo hàng: Hàng 0 floor 1=1, floor 2=2; Hàng 1 floor 1=3, floor 2=4; ...

      // Lấy tất cả regular seats
      const regularSeats = activeSeats.filter((key) => {
        const k = parseKey(key);
        return !k.isBench && !k.isFloor;
      });

      // Đánh số cho từng dãy riêng biệt
      for (let layoutCol = 0; layoutCol < colsCount; layoutCol++) {
        const prefix = layoutCol === 0 ? "B" : "A";

        // Lấy seats của dãy này
        const dãySeats = regularSeats.filter((key) => {
          const k = parseKey(key);
          return k.c === layoutCol;
        });

        // Đánh số: row * 2 + floor
        dãySeats.forEach((key) => {
          const k = parseKey(key);
          const num = k.r * 2 + k.floor;
          newLabels[key] = `${prefix}${num}`;
        });
      }
    } else {
      const standardSeats = activeSeats
        .filter((k) => !k.includes("floor"))
        .sort((a, b) => {
          const ka = parseKey(a);
          const kb = parseKey(b);
          if (ka.r !== kb.r) return ka.r - kb.r;
          if (ka.floor !== kb.floor) return ka.floor - kb.floor;
          return ka.c - kb.c;
        });
      standardSeats.forEach((key, index) => {
        newLabels[key] = (index + 1).toString();
      });
    }
    return newLabels;
  };

  const initDefaultConfig = (busType: BusType) => {
    let active: string[] = [];
    let rows = 6;
    let cols = 2;
    let hasBench = false;
    let hasFloor = false;
    let floorCount = 0;

    if (busType === BusType.CABIN) {
      rows = 6; // 6 hàng
      cols = 2; // 2 dãy (B và A)

      // Tạo seats cho 2 floors (tầng 1 và tầng 2)
      // Floor 1 = tầng 1, Floor 2 = tầng 2
      for (let f = 1; f <= 2; f++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            active.push(`${f}-${r}-${c}`);
          }
        }
      }

      // Thêm 6 ghế sàn ở giữa
      for (let i = 0; i < 6; i++) {
        active.push(`1-floor-${i}`);
      }
      hasBench = false;
      hasFloor = true;
      floorCount = 6;
    } else {
      rows = 6; // 6 hàng × 3 dãy × 2 tầng = 36 chỗ + 5 băng cuối = 41 chỗ
      cols = 3;
      for (let f = 1; f <= 2; f++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) active.push(`${f}-${r}-${c}`);
        }
      }
      for (let i = 0; i < 5; i++) active.push(`2-bench-${i}`);
      hasBench = true;
      hasFloor = false;
      floorCount = 0;
    }

    const finalLabels = recalculateLabels(active, busType, cols, {});
    setConfig({
      floors: 2,
      rows,
      cols,
      activeSeats: active,
      seatLabels: finalLabels,
      hasRearBench: hasBench,
      benchFloors: [2],
      hasFloorSeats: hasFloor,
      floorSeatCount: floorCount,
    });
  };

  const toggleFloorSeats = (checked: boolean) => {
    let newActive = [...config.activeSeats];
    const count = 6; // Fixed: Both Cabin and Sleeper now have 6 floor seats
    if (checked) {
      for (let i = 0; i < count; i++) {
        const key = `1-floor-${i}`;
        if (!newActive.includes(key)) newActive.push(key);
      }
    } else {
      newActive = newActive.filter((k) => !k.includes("-floor-"));
    }
    const newLabels = recalculateLabels(newActive);
    setConfig({
      ...config,
      hasFloorSeats: checked,
      floorSeatCount: checked ? count : 0,
      activeSeats: newActive,
      seatLabels: newLabels,
    });
  };

  const handleSeatClick = (key: string, floor: number) => {
    const isActive = config.activeSeats.includes(key);
    let newActive = [...config.activeSeats];
    if (isActive) {
      newActive = newActive.filter((k) => k !== key);
    } else {
      newActive.push(key);
    }
    const newLabels = recalculateLabels(newActive);
    setConfig({ ...config, activeSeats: newActive, seatLabels: newLabels });
  };

  const handleUpdateLabel = () => {
    if (!editingSeat) return;
    const newLabels = {
      ...config.seatLabels,
      [editingSeat.key]: editingSeat.label,
    };
    setConfig({ ...config, seatLabels: newLabels });
    setEditingSeat(null);
  };

  const handleRowChange = (newRows: number) => {
    let newActive = [...config.activeSeats];
    const isCabin = type === BusType.CABIN;
    const maxFloor = isCabin ? 1 : 2; // CABIN chỉ có 1 tầng, SLEEPER có 2 tầng

    if (newRows > config.rows) {
      for (let f = 1; f <= maxFloor; f++) {
        for (let r = config.rows; r < newRows; r++) {
          for (let c = 0; c < config.cols; c++) {
            const key = `${f}-${r}-${c}`;
            if (!newActive.includes(key)) newActive.push(key);
          }
        }
      }
    } else if (newRows < config.rows) {
      newActive = newActive.filter((key) => {
        if (key.includes("bench") || key.includes("floor")) return true;
        const r = parseInt(key.split("-")[1]);
        return r < newRows;
      });
    }
    const newLabels = recalculateLabels(newActive, type, config.cols);
    setConfig({
      ...config,
      rows: newRows,
      activeSeats: newActive,
      seatLabels: newLabels,
    });
  };

  const toggleRearBenchMaster = (checked: boolean) => {
    let newActive = [...config.activeSeats];
    let newLabels = { ...config.seatLabels };

    // Toggle băng tầng 1 (optional)
    if (checked) {
      const f = 1;
      for (let i = 0; i < 5; i++) {
        const key = `${f}-bench-${i}`;
        if (!newActive.includes(key)) newActive.push(key);
      }
    } else {
      // Chỉ xóa băng tầng 1, giữ băng tầng 2
      newActive = newActive.filter((k) => !k.startsWith("1-bench-"));
    }

    newLabels = recalculateLabels(newActive, type, config.cols, newLabels);

    // benchFloors: [2] mặc định (tầng 2 always on), [1,2] khi bật cả 2
    const currentBenchFloors = [...(config.benchFloors || [])];
    let newBenchFloors = currentBenchFloors;

    if (checked) {
      // Thêm tầng 1
      if (!newBenchFloors.includes(1)) {
        newBenchFloors = [...newBenchFloors, 1].sort();
      }
    } else {
      // Xóa tầng 1, giữ tầng 2
      newBenchFloors = newBenchFloors.filter((f) => f !== 1);
    }

    setConfig({
      ...config,
      hasRearBench: checked, // Chỉ track băng tầng 1
      activeSeats: newActive,
      seatLabels: newLabels,
      benchFloors: newBenchFloors,
    });
  };

  const handleSave = async () => {
    if (!plate) return;
    setIsSaving(true);
    const cleanLabels: Record<string, string> = {};
    config.activeSeats.forEach((key) => {
      cleanLabels[key] = config.seatLabels?.[key] || key;
    });
    const cleanConfig: BusLayoutConfig = { ...config, seatLabels: cleanLabels };
    const newBus: Bus = {
      id: initialData ? initialData.id : `BUS-${Date.now()}`,
      plate,
      phoneNumber,
      defaultRouteId: defaultRouteId || undefined,
      type,
      status,
      seats: config.activeSeats.length,
      layoutConfig: cleanConfig,
    };
    try {
      await onSave(newBus);
      onClose();
    } catch (error) {
      setIsErrorAlertOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const SeatButton: React.FC<{
    floor: number;
    row?: number;
    col?: number;
    index?: number;
    isBench?: boolean;
    isFloor?: boolean;
  }> = ({ floor, row, col, index, isBench = false, isFloor = false }) => {
    let key = `${floor}-${row}-${col}`;
    if (isBench) key = `${floor}-bench-${index}`;
    if (isFloor) key = `${floor}-floor-${index}`;

    const isActive = config.activeSeats.includes(key);
    const isEditing = editingSeat?.key === key;
    const label = config.seatLabels?.[key] || (isActive ? "??" : "");

    return (
      <button
        onClick={() => handleSeatClick(key, floor)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (isActive) setEditingSeat({ key, label, floor });
        }}
        className={`
          relative flex flex-col items-center justify-center transition-all duration-200 border rounded-t-xl rounded-b-md
          ${
            isBench
              ? "h-9 w-7 text-[10px]"
              : isFloor
                ? "h-11 w-12 text-xs"
                : "h-11 w-12 text-xs"
          }
          ${isEditing ? "ring-2 ring-primary ring-offset-2 z-10" : ""}
          ${
            isActive
              ? "bg-primary border-primary text-white shadow-sm hover:bg-primary/90"
              : "bg-slate-50 text-slate-300 border-slate-200 border-dashed hover:border-slate-300"
          }
          ${isFloor ? "rounded-lg" : ""}
        `}
      >
        {isActive ? (
          <>
            <span className="font-bold">{label}</span>
            <div className="absolute top-1 w-1/2 h-0.5 bg-white/30 rounded-full"></div>
          </>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
        )}
      </button>
    );
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={initialData ? "Cập nhật thông tin xe" : "Thêm xe mới"}
        className="max-w-5xl w-full text-slate-900 border-indigo-900"
        headerClassName="px-4 h-[40px] border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white text-xs font-semibold"
        footer={
          <div className="flex gap-3 justify-between">
            <Button
              variant="custom"
              onClick={onClose}
              disabled={isSaving}
              className="bg-red-800 border-red-800 text-white hover:bg-red-900 hover:text-white h-8 px-6 text-xs font-bold min-w-20"
            >
              Đóng
            </Button>
            <Button
              variant="custom"
              onClick={handleSave}
              disabled={isSaving || !plate}
              className={`h-8 font-bold text-xs transition-all min-w-30 border text-white flex items-center gap-2 ${
                isSaving || !plate
                  ? "bg-slate-700 opacity-40 cursor-not-allowed border-slate-700"
                  : "bg-indigo-950 border-indigo-950 text-white hover:bg-indigo-900 hover:text-white active:scale-95"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Lưu cấu hình
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-5 h-full flex flex-col gap-4 overflow-y-auto pr-2 p-4">
            <div className="bg-slate-50/50 p-5 rounded border border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 text-xs">
                <Info size={16} /> Thông tin xe
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Biển kiểm soát <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="29B-123.45"
                    className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-slate-900 font-bold text-xs transition-colors hover:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Số điện thoại xe
                  </label>
                  <input
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="0912 076 076"
                    className="w-full px-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white text-xs transition-colors hover:border-slate-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Tình trạng
                    </label>
                    <select
                      value={status}
                      onChange={handleStatusChange}
                      className="w-full px-2 py-2 border border-slate-200 rounded bg-white text-xs"
                    >
                      <option value="Hoạt động">Hoạt động</option>
                      <option value="Xe thuê/Tăng cường">
                        Xe thuê/Tăng cường
                      </option>
                      <option value="Ngưng hoạt động">Ngưng hoạt động</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Tuyến mặc định
                    </label>
                    <select
                      value={defaultRouteId}
                      onChange={(e) => setDefaultRouteId(e.target.value)}
                      disabled={status !== "Hoạt động"}
                      className="w-full px-2 py-2 border border-slate-200 rounded text-xs disabled:bg-slate-100"
                    >
                      <option value="">-- Chọn --</option>
                      {routes
                        .filter((r) => !r.isEnhanced && r.status !== "inactive")
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Loại xe
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newType = BusType.CABIN;
                        setType(newType);
                        // Force reset config khi chuyển loại, bất kể đang edit hay tạo mới
                        initDefaultConfig(newType);
                      }}
                      className={`flex-1 p-3 rounded border-2 transition-all ${
                        type === BusType.CABIN
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-xs">Xe phòng VIP (22)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newType = BusType.SLEEPER;
                        setType(newType);
                        // Force reset config khi chuyển loại, bất kể đang edit hay tạo mới
                        initDefaultConfig(newType);
                      }}
                      className={`flex-1 p-3 rounded border-2 transition-all ${
                        type === BusType.SLEEPER
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-xs">Giường đơn (41)</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded border border-slate-200 flex-1 flex flex-col">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 text-xs">
                <Settings2 size={16} /> Cấu hình sơ đồ
              </h3>
              <div className="space-y-6">
                <div className="bg-slate-50/50 p-3 rounded border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">
                        Vé nằm SÀN
                      </span>
                      <span className="text-[10px] text-slate-500">6 chỗ</span>
                    </div>
                    <div
                      onClick={() => toggleFloorSeats(!config.hasFloorSeats)}
                      className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                        config.hasFloorSeats ? "bg-primary" : "bg-slate-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transform transition-transform ${
                          config.hasFloorSeats
                            ? "translate-x-4"
                            : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                  {type === BusType.SLEEPER && (
                    <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      <span className="text-xs text-slate-700">
                        Băng 5 cuối (Tầng 1)
                      </span>
                      <div
                        onClick={() =>
                          toggleRearBenchMaster(!config.hasRearBench)
                        }
                        className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                          config.hasRearBench ? "bg-primary" : "bg-slate-300"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full transform transition-transform ${
                            config.hasRearBench
                              ? "translate-x-4"
                              : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-auto pt-4">
                {editingSeat ? (
                  <div className="bg-indigo-50 border border-indigo-200 p-3 rounded">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-indigo-700 uppercase">
                        Đổi tên ghế
                      </span>
                      <button title="Hủy" onClick={() => setEditingSeat(null)}>
                        <X size={14} className="text-slate-400" />
                      </button>
                    </div>
                    <input
                      title="Nhập tên ghế"
                      autoFocus
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded mb-2 bg-white"
                      value={editingSeat.label}
                      onChange={(e) =>
                        setEditingSeat({
                          ...editingSeat,
                          label: e.target.value,
                        })
                      }
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleUpdateLabel()
                      }
                    />
                    <Button
                      size="sm"
                      className="w-full h-8 bg-indigo-600 text-white text-xs"
                      onClick={handleUpdateLabel}
                    >
                      Cập nhật
                    </Button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-2 rounded-lg text-[10px] text-slate-500 flex gap-2 items-center border border-slate-100">
                    <Info size={16} className="shrink-0 text-slate-400" />
                    <p>Chuột phải vào ghế trên sơ đồ để đổi tên.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-7 h-full bg-slate-100/50 overflow-hidden relative flex flex-col">
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm z-10">
              Tổng: {config.activeSeats.length} chỗ
            </div>
            <div className="flex-1 overflow-auto p-4 md:p-8">
              <div className="min-h-full min-w-full flex flex-col justify-center items-center gap-6">
                {type === BusType.CABIN ? (
                  <div className="flex gap-4 md:gap-12">
                    <div className="bg-white rounded border border-slate-300 w-45 overflow-hidden">
                      <div className="bg-slate-50 border-b py-2 text-center text-[10px] font-bold text-slate-500">
                        DÃY B (PHÒNG LẺ)
                      </div>
                      <div className="p-4 space-y-2">
                        {[...Array(config.rows)].map((_, r) => (
                          <div key={r} className="flex gap-3 justify-center">
                            <SeatButton floor={1} row={r} col={0} />
                            <SeatButton floor={2} row={r} col={0} />
                          </div>
                        ))}
                      </div>
                    </div>
                    {config.hasFloorSeats && (
                      <div className="w-20 bg-slate-200/50 rounded border border-dashed border-slate-300 flex flex-col items-center p-2 gap-2">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                          SÀN
                        </div>
                        {[...Array(config.floorSeatCount)].map((_, i) => (
                          <SeatButton
                            key={i}
                            floor={1}
                            index={i}
                            isFloor={true}
                          />
                        ))}
                      </div>
                    )}
                    <div className="bg-white rounded  border border-slate-300 w-45 overflow-hidden">
                      <div className="bg-slate-50 border-b py-2 text-center text-[10px] font-bold text-slate-500">
                        DÃY A (PHÒNG CHẴN)
                      </div>
                      <div className="p-4 space-y-2">
                        {[...Array(config.rows)].map((_, r) => (
                          <div key={r} className="flex gap-3 justify-center">
                            <SeatButton floor={1} row={r} col={1} />
                            <SeatButton floor={2} row={r} col={1} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-4 md:gap-8">
                      {[1, 2].map((floor) => (
                        <div
                          key={floor}
                          className="bg-white rounded border border-slate-300 w-50 overflow-hidden"
                        >
                          <div className="bg-slate-50 border-b py-2 text-center text-[10px] font-bold text-slate-500">
                            TẦNG {floor}
                          </div>
                          <div className="p-4 flex flex-col items-center gap-2">
                            <div className="grid grid-cols-3 gap-1.5">
                              {[...Array(config.rows)].map((_, r) =>
                                [0, 1, 2].map((c) => (
                                  <SeatButton
                                    key={`${floor}-${r}-${c}`}
                                    floor={floor}
                                    row={r}
                                    col={c}
                                  />
                                )),
                              )}
                            </div>
                            {config.benchFloors?.includes(floor) && (
                              <div className="flex justify-center gap-1 mt-1 pt-1 border-t border-dashed border-slate-200">
                                {[...Array(5)].map((_, i) => (
                                  <SeatButton
                                    key={i}
                                    isBench={true}
                                    index={i}
                                    floor={floor}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {config.hasFloorSeats && (
                      <div className="w-full max-w-105 bg-slate-200/50 rounded border border-dashed border-slate-300 p-4">
                        <div className="text-center mb-3 text-[9px] font-bold text-slate-400 uppercase">
                          DÃY VÉ SÀN NẰM (GIỮA LỐI ĐI)
                        </div>
                        <div className="grid grid-cols-6 gap-2 justify-items-center">
                          {[...Array(config.floorSeatCount)].map((_, i) => (
                            <SeatButton
                              key={i}
                              floor={1}
                              index={i}
                              isFloor={true}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Dialog>
      <AlertDialog open={isErrorAlertOpen} onOpenChange={setIsErrorAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              Lưu dữ liệu thất bại
            </AlertDialogTitle>
            <AlertDialogDescription>
              Đã xảy ra lỗi khi lưu cấu hình xe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsErrorAlertOpen(false)}>
              Đóng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
