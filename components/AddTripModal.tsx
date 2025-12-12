import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Bus, Route, BusTrip, BusType, SeatStatus } from '../types';
import { Loader2, Clock, MapPin, Wallet, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';
import { generateCabinLayout, generateSleeperLayout } from '../utils/generators';

interface AddTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: Date;
  preSelectedRouteId?: string;
  initialData?: BusTrip;
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
  routes,
  buses,
  onSave
}) => {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [time, setTime] = useState('07:00');
  const [price, setPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fill form when Route changes (only if NOT editing)
  useEffect(() => {
    if (selectedRouteId && !initialData) {
      const route = routes.find(r => r.id === selectedRouteId);
      if (route) {
        if (route.price) setPrice(route.price);
        if (route.departureTime) setTime(route.departureTime);
        setSelectedBusId(''); // Reset bus when route changes because availability changes
      }
    }
  }, [selectedRouteId, routes, initialData]);

  // Reset/Fill form on open
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit Mode
        // FIX: Prefer routeId, fallback to finding by name
        let rId = '';
        if (initialData.routeId) {
            rId = String(initialData.routeId);
        } else {
            const r = routes.find(route => route.name === initialData.route);
            rId = r ? String(r.id) : '';
        }
        setSelectedRouteId(rId);
        
        const bus = buses.find(b => b.plate === initialData.licensePlate);
        setSelectedBusId(bus ? bus.id : '');
        
        // Extract time from "YYYY-MM-DD HH:MM"
        const timePart = initialData.departureTime.split(' ')[1] || '07:00';
        setTime(timePart);
        
        setPrice(initialData.basePrice);
      } else {
        // Create Mode
        setSelectedRouteId(preSelectedRouteId || '');
        setSelectedBusId('');
        setTime('07:00');
        setPrice(0);
      }
    }
  }, [isOpen, preSelectedRouteId, initialData, routes, buses]);

  // Filter Buses Logic
  const filteredBuses = useMemo(() => {
    return buses.filter(bus => {
        if (bus.status !== 'Hoạt động') return false;
        
        // If editing, always allow the currently assigned bus (even if it violates current route logic)
        if (initialData && bus.plate === initialData.licensePlate) return true;
        
        // If no route selected yet, show all active buses
        if (!selectedRouteId) return true;

        const currentRoute = routes.find(r => r.id === selectedRouteId);
        if (!currentRoute) return true;

        // Requirement: Enhanced routes allow any bus
        if (currentRoute.isEnhanced) return true;

        // Requirement: Regular routes allow buses configured for that route OR unassigned buses
        return String(bus.defaultRouteId) === String(selectedRouteId) || !bus.defaultRouteId;
    });
  }, [buses, selectedRouteId, routes, initialData]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove non-numeric chars
    const rawValue = e.target.value.replace(/\D/g, "");
    setPrice(rawValue ? parseInt(rawValue, 10) : 0);
  };

  const formatPrice = (val: number) => {
    return val.toLocaleString('vi-VN');
  };

  const handleSubmit = async () => {
    if (!selectedRouteId || !selectedBusId) return;

    setIsSaving(true);
    
    const route = routes.find(r => r.id === selectedRouteId);
    const bus = buses.find(b => b.id === selectedBusId);
    
    if (!route || !bus) {
        setIsSaving(false);
        return;
    }

    // Format date string Manually to avoid UTC issues
    // Use targetDate for Date part (which comes from ScheduleView)
    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    const dateTimeStr = `${dateStr} ${time}`;

    // Logic: Do we need to regenerate seats?
    // 1. If creating new trip -> Yes.
    // 2. If editing and Bus Changed -> Yes (Layout might be different).
    // 3. If editing and Bus Same -> Keep existing seats (preserve bookings), unless we want to force reset.
    //    For now, assume if Bus stays same, we update other metadata but keep seats.
    
    let seats = initialData?.seats || [];
    const busChanged = initialData && initialData.licensePlate !== bus.plate;
    const isNew = !initialData;

    if (isNew || busChanged) {
        seats = []; // Reset
        if (bus.layoutConfig) {
          const config = bus.layoutConfig;
          for (let f = 1; f <= config.floors; f++) {
            for (let r = 0; r < config.rows; r++) {
              for (let c = 0; c < config.cols; c++) {
                const key = `${f}-${r}-${c}`;
                if (config.activeSeats.includes(key)) {
                  let label = config.seatLabels?.[key];
                  if (!label) {
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
                  seats.push({
                    id: label,
                    label: label,
                    floor: f as 1 | 2,
                    status: SeatStatus.AVAILABLE,
                    price: price,
                    row: r,
                    col: c
                  });
                }
              }
            }
          }
          // Add bench if exists
          if (config.hasRearBench) {
            for (let f = 1; f <= config.floors; f++) {
              if(config.benchFloors?.includes(f)) {
                 for (let i = 0; i < 5; i++) {
                    const key = `${f}-bench-${i}`;
                    if (config.activeSeats.includes(key)) {
                        let label = config.seatLabels?.[key];
                        if(!label) {
                           const prefix = f === 1 ? "A" : "B";
                           label = bus.type === BusType.CABIN ? `${prefix}-G${i + 1}` : `B${f}-${i + 1}`;
                        }
                        seats.push({
                          id: label, label, floor: f as 1 | 2, status: SeatStatus.AVAILABLE, price: price, row: config.rows, col: i
                        });
                    }
                 }
              }
            }
          }
        } else {
          seats = bus.type === BusType.CABIN 
            ? generateCabinLayout(price) 
            : generateSleeperLayout(price);
        }
    } else {
        // If bus is same, update the price of available seats?
        // Optional requirement, but good UX.
        seats = seats.map(s => s.status === SeatStatus.AVAILABLE ? { ...s, price: price } : s);
    }

    const tripData: Partial<BusTrip> = {
      routeId: route.id, // CRITICAL FIX: Save routeId
      name: route.name, // Use route name or custom
      route: route.name,
      departureTime: dateTimeStr,
      type: bus.type,
      licensePlate: bus.plate,
      basePrice: price,
      seats: seats as any
    };

    try {
        await onSave(tripData);
        onClose();
    } catch(e) {
        console.error(e);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialData ? "Cập nhật chuyến xe" : "Tạo lịch chạy mới"}
      className="max-w-lg"
      footer={
         <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Hủy bỏ</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || !selectedRouteId || !selectedBusId}
            className="min-w-[120px]"
          >
            {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle2 className="mr-2" size={16} />}
            {initialData ? 'Cập nhật' : 'Lưu chuyến'}
          </Button>
         </>
      }
    >
      <div className="space-y-5">
        
        {/* Date Info Banner */}
        <div className="bg-blue-50 text-blue-800 px-4 py-3 rounded-lg flex items-center gap-3 border border-blue-100">
           <Calendar className="text-blue-600" size={20} />
           <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">Ngày khởi hành</div>
              <div className="font-bold text-lg leading-none">{targetDate.toLocaleDateString('vi-VN')}</div>
           </div>
        </div>

        {/* Route Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Chọn tuyến đường <span className="text-red-500">*</span></label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
               <MapPin size={18} />
             </div>
             <select 
               required
               className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 appearance-none shadow-sm disabled:bg-slate-100"
               value={selectedRouteId}
               onChange={(e) => setSelectedRouteId(e.target.value)}
               disabled={!!preSelectedRouteId && !initialData} // Allow changing route if editing
             >
               <option value="">-- Chọn tuyến --</option>
               {routes.filter(r => r.status !== 'inactive').map(r => (
                 <option key={r.id} value={r.id}>{r.name} {r.isEnhanced ? '(Tăng cường)' : ''}</option>
               ))}
             </select>
          </div>
        </div>

        {/* Bus Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Chọn xe vận hành <span className="text-red-500">*</span></label>
          {filteredBuses.length === 0 && selectedRouteId ? (
             <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100 mb-2 flex items-center gap-2">
                <AlertTriangle size={16} />
                Chưa có xe nào được cài đặt cho tuyến này. Vui lòng vào Cài đặt xe để gán tuyến hoặc chọn xe khác.
             </div>
          ) : (
            <select 
               required
               className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm"
               value={selectedBusId}
               onChange={(e) => setSelectedBusId(e.target.value)}
               disabled={!selectedRouteId}
            >
               <option value="">-- Chọn xe --</option>
               {filteredBuses.map(b => (
                 <option key={b.id} value={b.id}>
                   {b.plate} - {b.type === 'CABIN' ? 'Xe Phòng' : 'Giường nằm'} ({b.seats} chỗ)
                 </option>
               ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Giờ khởi hành</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Clock size={16} />
              </div>
              <input 
                type="time" 
                required
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 shadow-sm"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          
          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Giá vé (VNĐ)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Wallet size={16} />
              </div>
              <input 
                type="text" 
                required
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 font-bold shadow-sm"
                value={formatPrice(price)}
                onChange={handlePriceChange}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};