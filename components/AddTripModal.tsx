
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Bus, Route, BusTrip, BusType, SeatStatus } from '../types';
import { Loader2, Clock, MapPin, Wallet, Calendar, CheckCircle2, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { generateCabinLayout, generateSleeperLayout } from '../utils/generators';
import { isSameDay } from '../utils/dateUtils';

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
  onSave
}) => {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [time, setTime] = useState('07:00');
  const [price, setPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Effect: Update defaults when Route or Direction changes
  useEffect(() => {
    if (selectedRouteId && !initialData) {
      const route = routes.find(r => r.id === selectedRouteId);
      if (route) {
        if (route.price) setPrice(route.price);
        
        // Auto-fill time based on selected direction
        if (direction === 'inbound' && route.returnTime) {
            setTime(route.returnTime);
        } else if (direction === 'outbound' && route.departureTime) {
            setTime(route.departureTime);
        }
        
        // Only reset bus if user hasn't selected one or logic requires it
        if (!selectedBusId) setSelectedBusId(''); 
      }
    }
  }, [selectedRouteId, direction, routes, initialData]);

  // Reset/Fill form on open
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit Mode
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
        
        // Extract time
        const timePart = initialData.departureTime.split(' ')[1] || '07:00';
        setTime(timePart);
        
        setPrice(initialData.basePrice);
        setDirection(initialData.direction || 'outbound');
      } else {
        // Create Mode
        setSelectedRouteId(preSelectedRouteId || '');
        setSelectedBusId('');
        // Time & Direction defaults
        setDirection('outbound');
        if (!preSelectedRouteId) setTime('07:00'); 
        setPrice(0);
      }
    }
  }, [isOpen, preSelectedRouteId, initialData, routes, buses]);

  // Filter Buses Logic
  const filteredBuses = useMemo(() => {
    return buses.filter(bus => {
        if (bus.status !== 'Hoạt động' && bus.status !== 'Xe thuê/Tăng cường') return false;
        if (initialData && bus.plate === initialData.licensePlate) return true;
        if (!selectedRouteId) return true;

        const currentRoute = routes.find(r => r.id === selectedRouteId);
        if (!currentRoute) return true;
        if (currentRoute.isEnhanced) return true;
        if (bus.status === 'Xe thuê/Tăng cường') return true;

        return String(bus.defaultRouteId) === String(selectedRouteId) || !bus.defaultRouteId;
    });
  }, [buses, selectedRouteId, routes, initialData]);

  // Warning Check Logic
  const conflictWarning = useMemo(() => {
      if (!selectedRouteId || !selectedBusId) return null;
      
      const route = routes.find(r => r.id === selectedRouteId);
      // Skip check for Enhanced routes
      if (route?.isEnhanced) return null; 

      const selectedBus = buses.find(b => b.id === selectedBusId);
      if (!selectedBus) return null;

      // Filter trips for this day
      const tripsOnDay = existingTrips.filter(t => {
          const tDate = new Date(t.departureTime.split(' ')[0]);
          return isSameDay(tDate, targetDate) && t.id !== initialData?.id; // Exclude self if editing
      });

      // Check 1: Same route, opposite direction with same plate
      const sameRouteTrips = tripsOnDay.filter(t => 
         (t.routeId && String(t.routeId) === String(selectedRouteId)) || t.route === route?.name
      );
      
      const oppositeDirectionTrip = sameRouteTrips.find(t => 
         t.direction !== direction && t.licensePlate === selectedBus.plate
      );
      
      if (oppositeDirectionTrip) {
         return {
             title: "Xung đột chiều chạy",
             message: `Xe ${selectedBus.plate} đã được xếp chạy chiều ngược lại (${oppositeDirectionTrip.direction === 'inbound' ? 'Chiều về' : 'Chiều đi'}) trong ngày này.`
         };
      }

      // Check 2: Different route with same plate
      const otherRouteTrip = tripsOnDay.find(t => {
         const isDifferentRoute = (t.routeId && String(t.routeId) !== String(selectedRouteId)) || (t.route !== route?.name);
         return isDifferentRoute && t.licensePlate === selectedBus.plate;
      });

      if (otherRouteTrip) {
          return {
             title: "Trùng xe với tuyến khác",
             message: `Xe ${selectedBus.plate} đã được xếp cho tuyến "${otherRouteTrip.route}" trong ngày này.`
          };
      }

      return null;
  }, [selectedRouteId, selectedBusId, direction, existingTrips, targetDate, routes, buses, initialData]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    const dateTimeStr = `${dateStr} ${time}`;

    // Generate seats if needed
    let seats = initialData?.seats || [];
    const busChanged = initialData && initialData.licensePlate !== bus.plate;
    const isNew = !initialData;

    if (isNew || busChanged) {
        seats = []; 
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
        seats = seats.map(s => s.status === SeatStatus.AVAILABLE ? { ...s, price: price } : s);
    }

    // Name Generation logic
    let tripName = route.name;
    if (direction === 'inbound') {
       if (route.origin && route.destination) {
         tripName = `${route.destination} - ${route.origin}`;
       } else {
         tripName = `${route.name} (Chiều về)`;
       }
    } else {
       if (route.origin && route.destination) {
         tripName = `${route.origin} - ${route.destination}`;
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
      seats: seats as any,
      direction: direction
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

  const getRouteLabel = () => {
    const r = routes.find(x => x.id === selectedRouteId);
    if (!r) return "";
    return r.name;
  }

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
        
        {/* Date Info */}
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
               disabled={!!preSelectedRouteId && !initialData}
             >
               <option value="">-- Chọn tuyến --</option>
               {routes.filter(r => r.status !== 'inactive').map(r => (
                 <option key={r.id} value={r.id}>{r.name} {r.isEnhanced ? '(Tăng cường)' : ''}</option>
               ))}
             </select>
          </div>
        </div>

        {/* Direction Selection */}
        <div>
           <label className="block text-sm font-medium text-slate-700 mb-1.5">Chiều chạy</label>
           <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDirection('outbound')}
                className={`flex items-center justify-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  direction === 'outbound' 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                 <ArrowRightLeft size={14} className={direction === 'outbound' ? 'rotate-0' : 'text-slate-400'}/>
                 Chiều đi
              </button>
              <button
                type="button"
                onClick={() => setDirection('inbound')}
                className={`flex items-center justify-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  direction === 'inbound' 
                    ? 'bg-orange-600 text-white border-orange-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                 <ArrowRightLeft size={14} className={direction === 'inbound' ? 'rotate-180' : 'text-slate-400'}/>
                 Chiều về
              </button>
           </div>
        </div>

        {/* Bus Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Chọn xe vận hành <span className="text-red-500">*</span></label>
          {filteredBuses.length === 0 && selectedRouteId ? (
             <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100 mb-2 flex items-center gap-2">
                <AlertTriangle size={16} />
                Chưa có xe phù hợp.
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
                   {b.plate} {b.status === 'Xe thuê/Tăng cường' ? '(Thuê)' : ''} - {b.seats} chỗ
                 </option>
               ))}
            </select>
          )}
        </div>

        {/* Alert for Conflict */}
        {conflictWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                <div>
                    <h4 className="text-sm font-bold text-yellow-800">{conflictWarning.title}</h4>
                    <p className="text-xs text-yellow-700 mt-0.5">{conflictWarning.message}</p>
                </div>
            </div>
        )}

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