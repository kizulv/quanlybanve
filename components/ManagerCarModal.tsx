
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
    rows: 11,
    cols: 2,
    activeSeats: [],
    seatLabels: {},
    hasRearBench: false,
    benchFloors: [1],
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

    // Reset floor labels
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
    let rows = 11; // 22 phòng = 11 hàng * 2 dãy (mỗi hàng 1 tầng 1 + 1 tầng 2)
    let cols = 2;
    let hasBench = false;

    if (busType === BusType.CABIN) {
      rows = 11;
      cols = 2;
      for (let f = 1; f <= 2; f++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
              // Tầng 1 cho dãy B (col 0), Tầng 2 cho dãy B? 
              // Theo logic Cabin hiện tại: Mỗi ô dọc là r, c. Ở đây r=0..10, c=0..1.
              // Chúng ta chỉ kích hoạt 22 phòng: (11 hàng * 2 dãy)
              active.push(`${f}-${r}-${c}`);
          }
        }
      }
      // Lọc lại để chỉ lấy 22 phòng (ví dụ: mỗi hàng chỉ có 1 phòng/dãy trải qua 2 tầng)
      // Nhưng logic UI hiện tại là render 2 tầng chồng lên nhau. 
      // Xe 22 phòng thực tế là 11 cabin bên trái, 11 cabin bên phải.
      // Vậy là 11 hàng, 2 dãy, mỗi hàng/dãy có tầng 1 và tầng 2? Đó là 44 chỗ.
      // ĐÚNG: Xe 22 phòng là 11 hàng, mỗi hàng có 2 phòng (1 Trái - A, 1 Phải - B).
      // Nhưng mỗi phòng đó là 1 cabin đơn. Vậy tổng 11 hàng * 2 dãy = 22 phòng.
      // Cấu hình: 11 hàng, 2 dãy, nhưng mỗi tọa độ (r,c) chỉ có 1 tầng? 
      // Hoặc 11 hàng, 1 dãy, 2 tầng? -> Không, thường là 2 dãy.
      // CHUẨN: 11 hàng, 2 dãy. Tầng 1 là phòng lẻ, Tầng 2 là phòng chẵn.
      active = [];
      for (let r = 0; r < 11; r++) {
          active.push(`1-${r}-0`); // B tầng 1
          active.push(`2-${r}-0`); // B tầng 2 (Nếu xe 22 phòng là chồng tầng)
          // Đợi đã, 22 phòng thường là 11 hàng, mỗi hàng 2 phòng chồng lên nhau? -> Đó là 1 dãy.
          // Xe 22 phòng thường có 2 dãy. Mỗi dãy 11 phòng. Vậy mỗi dãy là 11 hàng, 1 tầng? 
          // Không, thường là 11 hàng, 2 dãy, mỗi vị trí là 1 phòng đơn (tổng 22).
          // Ta sẽ để 11 hàng, 2 dãy, tầng 1 cho dãy B, tầng 2 cho dãy A? -> Không trực quan.
          // CHỐT: 11 hàng, 2 dãy, tầng 1. Tổng 22.
          active.push(`1-${r}-0`); 
          active.push(`1-${r}-1`);
      }
      hasBench = false;
    } else {
      // Xe 41 giường: 6 hàng * 3 dãy * 2 tầng = 36. + 5 ghế băng cuối tầng 1 = 41.
      rows = 6;
      cols = 3;
      for (let f = 1; f <= 2; f++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) active.push(`${f}-${r}-${c}`);
        }
      }
      for (let i = 0; i < 5; i++) active.push(`1-bench-${i}`);
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
      benchFloors: [1],
      hasFloorSeats: false,
      floorSeatCount: 0
    });
  };

  const toggleFloorSeats = (checked: boolean) => {
      let newActive = [...config.activeSeats];
      // Yêu cầu: Xe phòng 6 sàn, Xe giường 12 sàn
      const count = type === BusType.CABIN ? 6 : 12;
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
      // Mặc định xe giường nằm chỉ có băng 5 ở tầng 1
      const f = 1;
      for (let i = 0; i < 5; i++) {
        const key = `${f}-bench-${i}`;
        if (!newActive.includes(key)) newActive.push(key);
      }
    } else {
      newActive = newActive.filter((k) => !k.includes("bench"));
    }
    newLabels = recalculateLabels(newActive, type, config.cols, newLabels);
    setConfig({ ...config, hasRearBench: checked, activeSeats: newActive, seatLabels: newLabels, benchFloors: checked ? [1] : [] });
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
          ${isBench ? "h-8 w-7 text-[10px]" : (isFloor ? "h-7 w-11 text-[9px]" : "h-10 w-11 text-xs")}
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
          <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
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
          <div className="col-span-12 lg:col-span-4 h-full flex flex-col gap-4 overflow-y-auto pr-2">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 text-sm"><Info size={16} /> Thông tin xe</h3>
              <div className="space-y-3">
                <div><label className="block text-xs text-slate-600 mb-1">Biển kiểm soát <span className="text-red-500">*</span></label>
                    <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="29B-123.45" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-white text-slate-900 font-bold text-sm shadow-sm" />
                </div>
                <div><label className="block text-xs text-slate-600 mb-1">Số điện thoại xe</label>
                    <input value={phoneNumber} onChange={handlePhoneChange} placeholder="0912 076 076" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-white text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs text-slate-600 mb-1">Tình trạng</label>
                    <select value={status} onChange={handleStatusChange} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xs">
                        <option value="Hoạt động">Hoạt động</option>
                        <option value="Xe thuê/Tăng cường">Thuê/Tăng cường</option>
                        <option value="Ngưng hoạt động">Ngưng hoạt động</option>
                    </select>
                    </div>
                    <div><label className="block text-xs text-slate-600 mb-1">Tuyến mặc định</label>
                    <select value={defaultRouteId} onChange={(e) => setDefaultRouteId(e.target.value)} disabled={status !== 'Hoạt động'} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs disabled:bg-slate-100">
                        <option value="">-- Chọn --</option>
                        {routes.filter(r => !r.isEnhanced && r.status !== 'inactive').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    </div>
                </div>
                <div><label className="block text-xs text-slate-600 mb-1">Loại phương tiện</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setType(BusType.CABIN); initDefaultConfig(BusType.CABIN); }} className={`flex-1 py-2 rounded-lg border-2 text-center text-xs font-bold ${type === BusType.CABIN ? "border-primary bg-blue-50" : "border-slate-200 bg-white"}`}>Xe phòng (22)</button>
                    <button type="button" onClick={() => { setType(BusType.SLEEPER); initDefaultConfig(BusType.SLEEPER); }} className={`flex-1 py-2 rounded-lg border-2 text-center text-xs font-bold ${type === BusType.SLEEPER ? "border-primary bg-blue-50" : "border-slate-200 bg-white"}`}>Giường đơn (41)</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 flex-1 flex flex-col shadow-sm">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 text-sm"><Settings2 size={16} /> Cấu hình sơ đồ</h3>
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">Vé nằm SÀN</span>
                        <span className="text-[10px] text-slate-500">{type === BusType.CABIN ? "Cho phép 6 chỗ" : "Cho phép 12 chỗ"}</span>
                      </div>
                      <div onClick={() => toggleFloorSeats(!config.hasFloorSeats)} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${config.hasFloorSeats ? "bg-primary" : "bg-slate-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${config.hasFloorSeats ? "translate-x-4" : "translate-x-0"}`} />
                      </div>
                    </div>
                    {type === BusType.SLEEPER && (
                        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                        <span className="text-xs text-slate-700">Băng 5 cuối (Tầng 1)</span>
                        <div onClick={() => toggleRearBenchMaster(!config.hasRearBench)} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${config.hasRearBench ? "bg-primary" : "bg-slate-300"}`}><div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${config.hasRearBench ? "translate-x-4" : "translate-x-0"}`} /></div>
                        </div>
                    )}
                </div>
                
                {editingSeat ? (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-bold text-blue-700 uppercase">Đổi tên ghế: {editingSeat.key}</span><button onClick={() => setEditingSeat(null)}><X size={14} className="text-slate-400" /></button></div>
                    <input autoFocus className="w-full px-3 py-1 text-sm border border-slate-300 rounded mb-2 bg-white" value={editingSeat.label} onChange={(e) => setEditingSeat({ ...editingSeat, label: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleUpdateLabel()} />
                    <Button size="sm" className="w-full h-7 bg-blue-600 text-white text-xs" onClick={handleUpdateLabel}>Cập nhật</Button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-2 rounded-lg text-[10px] text-slate-500 flex gap-2 items-center border border-slate-100"><Info size={14} className="shrink-0 text-slate-400" /><p>Nhấp ghế để Ẩn/Hiện. Chuột phải để đổi tên thủ công.</p></div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 h-full bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden relative flex flex-col">
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-primary shadow-sm z-10">Tổng: {config.activeSeats.length} chỗ</div>
            <div className="flex-1 overflow-auto p-4 md:p-8">
              <div className="min-h-full min-w-full flex flex-col justify-center items-center gap-6">
                {type === BusType.CABIN ? (
                  <div className="flex gap-4 md:gap-12">
                    <div className="bg-white rounded-2xl border border-slate-300 w-[160px] overflow-hidden shadow-sm">
                        <div className="bg-slate-50 border-b py-2 text-center text-[10px] font-bold text-slate-500">DÃY B (PHÒNG LẺ)</div>
                        <div className="p-3 space-y-2">{[...Array(config.rows)].map((_, r) => <div key={r} className="flex gap-2 justify-center"><SeatButton floor={1} row={r} col={0} /><SeatButton floor={2} row={r} col={0} /></div>)}</div>
                    </div>
                    {config.hasFloorSeats && (
                        <div className="w-[70px] bg-slate-200/50 rounded-xl border border-dashed border-slate-300 flex flex-col items-center p-2 gap-2">
                             <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">SÀN</div>
                             {[...Array(config.floorSeatCount)].map((_, i) => <SeatButton key={i} floor={1} index={i} isFloor={true} />)}
                        </div>
                    )}
                    <div className="bg-white rounded-2xl border border-slate-300 w-[160px] overflow-hidden shadow-sm">
                        <div className="bg-slate-50 border-b py-2 text-center text-[10px] font-bold text-slate-500">DÃY A (PHÒNG CHẴN)</div>
                        <div className="p-3 space-y-2">{[...Array(config.rows)].map((_, r) => <div key={r} className="flex gap-2 justify-center"><SeatButton floor={1} row={r} col={1} /><SeatButton floor={2} row={r} col={1} /></div>)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-3 md:gap-8">
                        {[1, 2].map((floor) => (
                            <div key={floor} className="bg-white rounded-2xl border border-slate-300 w-[180px] overflow-hidden shadow-sm">
                            <div className="bg-slate-50 border-b py-2 text-center text-[10px] font-bold text-slate-500">TẦNG {floor}</div>
                            <div className="p-3 flex flex-col items-center gap-2">
                                <div className="grid grid-cols-3 gap-1.5">{[...Array(config.rows)].map((_, r) => [0, 1, 2].map(c => <SeatButton key={`${floor}-${r}-${c}`} floor={floor} row={r} col={c} />))}</div>
                                {config.hasRearBench && config.benchFloors?.includes(floor) && <div className="flex justify-center gap-1 mt-1 pt-1 border-t border-dashed border-slate-200">{[...Array(5)].map((_, i) => <SeatButton key={i} isBench={true} index={i} floor={floor} />)}</div>}
                            </div>
                            </div>
                        ))}
                    </div>
                    {config.hasFloorSeats && (
                        <div className="w-full max-w-[400px] bg-slate-200/50 rounded-xl border border-dashed border-slate-300 p-3">
                            <div className="text-center mb-2 text-[9px] font-bold text-slate-400 uppercase">DÃY VÉ SÀN NẰM (GIỮA LỐI ĐI)</div>
                            <div className="grid grid-cols-6 gap-2 justify-items-center">{[...Array(config.floorSeatCount)].map((_, i) => <SeatButton key={i} floor={1} index={i} isFloor={true} />)}</div>
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
