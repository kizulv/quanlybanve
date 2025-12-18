
import React, { useState, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Bus, BusType, BusLayoutConfig, Route } from "../types";
import {
  Save,
  LayoutGrid,
  Settings2,
  Info,
  CheckCircle2,
  X,
  Loader2,
  Phone,
  MapPin,
  AlertTriangle,
  MoveDown
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/AlertDialog";

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
  routes
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
    rows: 6,
    cols: 2,
    activeSeats: [],
    seatLabels: {},
    hasRearBench: false,
    benchFloors: [1, 2],
    hasFloorSeats: false,
    floorSeatCount: 0
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
            (initialData.layoutConfig.hasRearBench ? [1, 2] : []),
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
    const val = e.target.value.replace(/\D/g, '');
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
    if (newStatus !== 'Hoạt động') {
      setDefaultRouteId("");
    }
  };

  const recalculateLabels = (
    activeSeats: string[],
    busTypeOverride?: BusType,
    currentCols?: number,
    currentLabels?: Record<string, string>
  ) => {
    const currentBusType = busTypeOverride || type;
    const colsCount = currentCols || config.cols;
    const newLabels: Record<string, string> = { ...(currentLabels || config.seatLabels) };

    const parseKey = (key: string) => {
      const parts = key.split("-");
      const floor = parseInt(parts[0]);
      if (parts[1] === "bench") {
        return { floor, isBench: true, isFloor: false, r: 999, c: parseInt(parts[2]) };
      }
      if (parts[1] === "floor") {
        return { floor, isBench: false, isFloor: true, r: 1000, c: parseInt(parts[2]) };
      }
      return {
        floor,
        isBench: false,
        isFloor: false,
        r: parseInt(parts[1]),
        c: parseInt(parts[2]),
      };
    };

    // Reset floor labels to recalculate sequence
    const floorSeatKeys = activeSeats.filter(k => k.includes('-floor-')).sort((a,b) => {
        const ka = parseKey(a);
        const kb = parseKey(b);
        return ka.c - kb.c;
    });
    floorSeatKeys.forEach((k, i) => {
        newLabels[k] = `Sàn ${i + 1}`;
    });

    if (currentBusType === BusType.CABIN) {
      for (let col = 0; col < colsCount; col++) {
        let prefix = col === 0 ? "B" : "A";
        const colSeats = activeSeats.filter((key) => {
          const k = parseKey(key);
          return !k.isBench && !k.isFloor && k.c === col;
        });
        const uniqueRows = Array.from(new Set(colSeats.map((s) => parseKey(s).r))).sort((a, b) => a - b);
        colSeats.forEach((key) => {
          const k = parseKey(key);
          const logicalRowIndex = uniqueRows.indexOf(k.r);
          const num = logicalRowIndex * 2 + k.floor;
          newLabels[key] = `${prefix}${num}`;
        });
      }
    } else {
      const standardSeats = activeSeats.filter(k => !k.includes('floor')).sort((a, b) => {
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

    if (busType === BusType.CABIN) {
      rows = 6;
      cols = 2;
      for (let f = 1; f <= 2; f++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) active.push(`${f}-${r}-${c}`);
        }
      }
      hasBench = false;
    } else {
      rows = 6;
      cols = 3;
      for (let f = 1; f <= 2; f++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) active.push(`${f}-${r}-${c}`);
        }
        for (let i = 0; i < 5; i++) active.push(`${f}-bench-${i}`);
      }
      hasBench = true;
    }

    const finalLabels = recalculateLabels(active, busType, cols, {});
    setConfig({
      floors: 2,
      rows,
      cols,
      activeSeats: active,
      seatLabels: finalLabels,
      hasRearBench: hasBench,
      benchFloors: [1, 2],
      hasFloorSeats: false,
      floorSeatCount: 0
    });
  };

  const toggleFloorSeats = (checked: boolean) => {
      let newActive = [...config.activeSeats];
      const count = type === BusType.CABIN ? 6 : 5;
      if (checked) {
          for (let i = 0; i < count; i++) {
              const key = `1-floor-${i}`;
              if (!newActive.includes(key)) newActive.push(key);
          }
      } else {
          newActive = newActive.filter(k => !k.includes("-floor-"));
      }
      const newLabels = recalculateLabels(newActive);
      setConfig({...config, hasFloorSeats: checked, floorSeatCount: checked ? count : 0, activeSeats: newActive, seatLabels: newLabels});
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
    const newLabels = { ...config.seatLabels, [editingSeat.key]: editingSeat.label };
    setConfig({ ...config, seatLabels: newLabels });
    setEditingSeat(null);
  };

  const handleRowChange = (newRows: number) => {
    let newActive = [...config.activeSeats];
    if (newRows > config.rows) {
      for (let f = 1; f <= 2; f++) {
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
    setConfig({ ...config, rows: newRows, activeSeats: newActive, seatLabels: newLabels });
  };

  const toggleRearBenchMaster = (checked: boolean) => {
    let newActive = [...config.activeSeats];
    let newLabels = { ...config.seatLabels };
    if (checked) {
      for (let f = 1; f <= 2; f++) {
        for (let i = 0; i < 5; i++) {
          const key = `${f}-bench-${i}`;
          if (!newActive.includes(key)) newActive.push(key);
        }
      }
      if (type === BusType.CABIN) {
          newActive.forEach((key) => {
            if (key.includes("bench") && !newLabels[key]) {
              const parts = key.split("-");
              const f = parts[0];
              const i = parseInt(parts[2]);
              const prefix = f === "1" ? "A" : "B";
              newLabels[key] = `${prefix}-G${i + 1}`;
            }
          });
      }
    } else {
      newActive = newActive.filter((k) => !k.includes("bench"));
    }
    if (type === BusType.SLEEPER) {
        newLabels = recalculateLabels(newActive, type, config.cols, newLabels);
    }
    setConfig({ ...config, hasRearBench: checked, activeSeats: newActive, seatLabels: newLabels, benchFloors: checked ? [1, 2] : [] });
  };

  const toggleBenchFloor = (floor: number, checked: boolean) => {
    let newActive = [...config.activeSeats];
    let currentFloors = config.benchFloors || [];
    let newBenchFloors = checked ? [...new Set([...currentFloors, floor])] : currentFloors.filter((f) => f !== floor);
    if (checked) {
      for (let i = 0; i < 5; i++) {
        const key = `${floor}-bench-${i}`;
        if (!newActive.includes(key)) newActive.push(key);
      }
    } else {
      newActive = newActive.filter((k) => !k.startsWith(`${floor}-bench-`));
    }
    let newLabels = { ...config.seatLabels };
    if (type === BusType.SLEEPER) newLabels = recalculateLabels(newActive, type, config.cols);
    setConfig({ ...config, activeSeats: newActive, seatLabels: newLabels, benchFloors: newBenchFloors });
  };

  const handleSave = async () => {
    if (!plate) return;
    setIsSaving(true);
    const cleanLabels: Record<string, string> = {};
    config.activeSeats.forEach((key) => { cleanLabels[key] = config.seatLabels?.[key] || key; });
    const cleanConfig: BusLayoutConfig = { ...config, seatLabels: cleanLabels };
    const newBus: Bus = {
      id: initialData ? initialData.id : `BUS-${Date.now()}`,
      plate, phoneNumber, defaultRouteId: defaultRouteId || undefined, type, status,
      seats: config.activeSeats.length,
      layoutConfig: cleanConfig,
    };
    try { await onSave(newBus); onClose(); } catch (error) { setIsErrorAlertOpen(true); } finally { setIsSaving(false); }
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
        onContextMenu={(e) => { e.preventDefault(); if (isActive) setEditingSeat({ key, label, floor }); }}
        className={`
          relative flex flex-col items-center justify-center transition-all duration-200 border rounded-t-xl rounded-b-md
          ${isBench ? "h-9 w-7 text-[10px]" : (isFloor ? "h-8 w-12 text-[10px]" : "h-11 w-12 text-xs")}
          ${isEditing ? "ring-2 ring-primary ring-offset-2 z-10" : ""}
          ${isActive ? "bg-primary border-primary text-white shadow-sm hover:bg-primary/90" : "bg-slate-50 text-slate-300 border-slate-200 border-dashed hover:border-slate-300"}
          ${isFloor ? "rounded-lg" : ""}
        `}
      >
        {isActive ? (
          <>
            <span className="font-bold">{label}</span>
            <div className="absolute top-1 w-1/2 h-0.5 bg-white/30 rounded-full"></div>
          </>
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-200" />
        )}
      </button>
    );
  };

  return (
    <>
      <Dialog isOpen={isOpen} onClose={onClose} title={initialData ? "Cập nhật thông tin xe" : "Thêm xe mới"} className="max-w-6xl w-full"
        footer={<><Button variant="outline" onClick={onClose} disabled={isSaving}>Đóng</Button><Button onClick={handleSave} className="flex items-center gap-2" disabled={isSaving || !plate}>{isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</Button></>}
      >
        <div className="grid grid-cols-12 gap-6 lg:h-[70vh]">
          <div className="col-span-12 lg:col-span-6 h-full flex flex-col gap-4 overflow-y-auto pr-2">
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-200"><Info size={18} /> Thông tin xe</h3>
              <div className="space-y-4">
                <div><label className="block text-sm text-slate-700 mb-1.5">Biển kiểm soát <span className="text-red-500">*</span></label>
                  <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-slate-400 font-bold text-xs">VN</span></div>
                    <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="29B-123.45" className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm font-bold" />
                  </div>
                </div>
                <div><label className="block text-sm text-slate-700 mb-1.5">Số điện thoại theo xe</label>
                  <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone size={16} className="text-slate-400" /></div>
                    <input value={phoneNumber} onChange={handlePhoneChange} placeholder="VD: 0912 076 076" className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm text-slate-700 mb-1.5">Tình trạng</label>
                    <select value={status} onChange={handleStatusChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm">
                        <option value="Hoạt động">Hoạt động</option>
                        <option value="Xe thuê/Tăng cường">Xe thuê/Tăng cường</option>
                        <option value="Ngưng hoạt động">Ngưng hoạt động</option>
                        <option value="Đã bán">Đã bán</option>
                    </select>
                    </div>
                    <div><label className="block text-sm text-slate-700 mb-1.5">Tuyến mặc định</label>
                    <select value={defaultRouteId} onChange={(e) => setDefaultRouteId(e.target.value)} disabled={status !== 'Hoạt động'} className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-100">
                        <option value="">-- Chọn tuyến --</option>
                        {routes.filter(r => !r.isEnhanced && r.status !== 'inactive').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    </div>
                </div>
                <div><label className="block text-sm text-slate-700 mb-1.5">Loại phương tiện</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setType(BusType.CABIN); initDefaultConfig(BusType.CABIN); }} className={`flex-1 p-3 rounded-lg border-2 text-left ${type === BusType.CABIN ? "border-primary bg-white shadow-sm" : "border-slate-200 bg-white"}`}><div className="font-bold text-sm">Xe phòng</div></button>
                    <button type="button" onClick={() => { setType(BusType.SLEEPER); initDefaultConfig(BusType.SLEEPER); }} className={`flex-1 p-3 rounded-lg border-2 text-left ${type === BusType.SLEEPER ? "border-primary bg-white shadow-sm" : "border-slate-200 bg-white"}`}><div className="font-bold text-sm">Giường đơn</div></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 flex-1 flex flex-col shadow-sm">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-100"><Settings2 size={18} /> Cấu hình sơ đồ</h3>
              <div className="space-y-6">
                <div><div className="flex justify-between mb-2 text-sm"><span className="text-slate-700">Số hàng ghế</span></div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => handleRowChange(5)} className={`px-4 py-2 rounded-md text-sm font-bold border transition-colors ${config.rows === 5 ? "bg-primary text-white border-primary" : "bg-slate-50 text-slate-600 border-slate-200"}`}>5 Hàng</button>
                    <button type="button" onClick={() => handleRowChange(6)} className={`px-4 py-2 rounded-md text-sm font-bold border transition-colors ${config.rows === 6 ? "bg-primary text-white border-primary" : "bg-slate-50 text-slate-600 border-slate-200"}`}>6 Hàng</button>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><MoveDown size={14}/> Cho phép vé nằm Sàn</span>
                      <div onClick={() => toggleFloorSeats(!config.hasFloorSeats)} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${config.hasFloorSeats ? "bg-primary" : "bg-slate-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${config.hasFloorSeats ? "translate-x-4" : "translate-x-0"}`} />
                      </div>
                    </div>
                    {type === BusType.SLEEPER && (
                        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="text-sm text-slate-700">Ghế cuối (5 ghế/băng)</span>
                        <div onClick={() => toggleRearBenchMaster(!config.hasRearBench)} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${config.hasRearBench ? "bg-primary" : "bg-slate-300"}`}><div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${config.hasRearBench ? "translate-x-4" : "translate-x-0"}`} /></div>
                        </div>
                    )}
                </div>
              </div>
              <div className="mt-auto pt-4">
                {editingSeat ? (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-blue-700 uppercase">Đổi tên ghế</span><button onClick={() => setEditingSeat(null)}><X size={14} className="text-slate-400" /></button></div>
                    <input autoFocus className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded mb-2 bg-white" value={editingSeat.label} onChange={(e) => setEditingSeat({ ...editingSeat, label: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleUpdateLabel()} />
                    <Button size="sm" className="w-full h-8 bg-blue-600 text-white" onClick={handleUpdateLabel}>Cập nhật</Button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500 flex gap-2 flex items-center border border-slate-100"><Info size={16} className="shrink-0 text-slate-400" /><p>Nhấp ghế để Ẩn/Hiện. Chuột phải để đổi tên.</p></div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 h-full bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden relative flex flex-col">
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm z-10">Tổng cộng: {config.activeSeats.length} ghế</div>
            <div className="flex-1 overflow-auto p-8">
              <div className="min-h-full min-w-full flex flex-col justify-center items-center gap-6">
                {type === BusType.CABIN ? (
                  <div className="flex gap-4 md:gap-8">
                    <div className="bg-white rounded-2xl border border-slate-300 w-[180px] overflow-hidden">
                        <div className="bg-slate-50 border-b py-2 text-center text-xs font-bold text-slate-500">DÃY B</div>
                        <div className="p-4 space-y-3">{[...Array(config.rows)].map((_, r) => <div key={r} className="flex gap-2 justify-center"><SeatButton floor={1} row={r} col={0} /><SeatButton floor={2} row={r} col={0} /></div>)}</div>
                    </div>
                    {config.hasFloorSeats && (
                        <div className="w-[80px] bg-slate-200/50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center p-2 gap-3">
                             <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">SÀN</div>
                             {[...Array(config.rows)].map((_, i) => <SeatButton key={i} floor={1} index={i} isFloor={true} />)}
                        </div>
                    )}
                    <div className="bg-white rounded-2xl border border-slate-300 w-[180px] overflow-hidden">
                        <div className="bg-slate-50 border-b py-2 text-center text-xs font-bold text-slate-500">DÃY A</div>
                        <div className="p-4 space-y-3">{[...Array(config.rows)].map((_, r) => <div key={r} className="flex gap-2 justify-center"><SeatButton floor={1} row={r} col={1} /><SeatButton floor={2} row={r} col={1} /></div>)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-4 md:gap-8">
                        {[1, 2].map((floor) => (
                            <div key={floor} className="bg-white rounded-2xl border border-slate-300 w-[200px] overflow-hidden">
                            <div className="bg-slate-50 border-b py-2 text-center text-xs font-bold text-slate-500">TẦNG {floor}</div>
                            <div className="p-4 flex flex-col items-center gap-3">
                                <div className="grid grid-cols-3 gap-2">{[...Array(config.rows)].map((_, r) => [0, 1, 2].map(c => <SeatButton key={`${floor}-${r}-${c}`} floor={floor} row={r} col={c} />))}</div>
                                {config.hasRearBench && config.benchFloors?.includes(floor) && <div className="flex justify-center gap-1">{[...Array(5)].map((_, i) => <SeatButton key={i} isBench={true} index={i} floor={floor} />)}</div>}
                            </div>
                            </div>
                        ))}
                    </div>
                    {config.hasFloorSeats && (
                        <div className="w-full bg-slate-200/50 rounded-xl border border-dashed border-slate-300 p-4">
                            <div className="text-center mb-2 text-xs font-bold text-slate-400">SÀN NẰM (DƯỚI BĂNG 5)</div>
                            <div className="flex justify-center gap-2">{[...Array(5)].map((_, i) => <SeatButton key={i} floor={1} index={i} isFloor={true} />)}</div>
                        </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Dialog>
      <AlertDialog open={isErrorAlertOpen} onOpenChange={setIsErrorAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="text-red-600">Lưu dữ liệu thất bại</AlertDialogTitle><AlertDialogDescription>Đã xảy ra lỗi khi lưu cấu hình xe.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction onClick={() => setIsErrorAlertOpen(false)}>Đóng</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
};
