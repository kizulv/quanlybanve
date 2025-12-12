
import React, { useState, useEffect } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Bus, Route, BusTrip, BusType } from '../types';
import { Loader2, Calendar, Clock, MapPin, User, Wallet } from 'lucide-react';
import { generateCabinLayout, generateSleeperLayout } from '../utils/generators';

interface AddTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: Date;
  routes: Route[];
  buses: Bus[];
  onSave: (tripData: Partial<BusTrip>) => Promise<void>;
}

export const AddTripModal: React.FC<AddTripModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  routes,
  buses,
  onSave
}) => {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [driver, setDriver] = useState('');
  const [time, setTime] = useState('07:00');
  const [price, setPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fill form when Route changes
  useEffect(() => {
    if (selectedRouteId) {
      const route = routes.find(r => r.id === selectedRouteId);
      if (route) {
        if (route.price) setPrice(route.price);
        if (route.departureTime) setTime(route.departureTime);
      }
    }
  }, [selectedRouteId, routes]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setSelectedRouteId('');
      setSelectedBusId('');
      setDriver('');
      setTime('07:00');
      setPrice(0);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouteId || !selectedBusId) return;

    setIsSaving(true);
    
    const route = routes.find(r => r.id === selectedRouteId);
    const bus = buses.find(b => b.id === selectedBusId);
    
    if (!route || !bus) return;

    // Format date string YYYY-MM-DD HH:MM
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const dateTimeStr = `${dateStr} ${time}`;

    // Generate seats
    let seats = [];
    if (bus.layoutConfig) {
      // Logic duplicated from SettingsView for consistency
      // In a real app, extract this to a generator utility that takes layoutConfig
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
                status: 'available',
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
          for (let i = 0; i < 5; i++) {
            const key = `${f}-bench-${i}`;
             if (config.activeSeats.includes(key)) {
                let label = config.seatLabels?.[key];
                if(!label) {
                   const prefix = f === 1 ? "A" : "B";
                   label = bus.type === BusType.CABIN ? `${prefix}-G${i + 1}` : `B${f}-${i + 1}`;
                }
                seats.push({
                  id: label, label, floor: f as 1 | 2, status: 'available', price: price, row: config.rows, col: i
                });
             }
          }
        }
      }
    } else {
      seats = bus.type === BusType.CABIN 
        ? generateCabinLayout(price) 
        : generateSleeperLayout(price);
    }

    const tripData: Partial<BusTrip> = {
      name: route.name, // Use route name or custom
      route: route.name,
      departureTime: dateTimeStr,
      type: bus.type,
      licensePlate: bus.plate,
      driver: driver,
      basePrice: price,
      seats: seats as any
    };

    await onSave(tripData);
    setIsSaving(false);
    onClose();
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Lên lịch cho ngày ${targetDate.toLocaleDateString('vi-VN')}`}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Route Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Chọn tuyến đường</label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
               <MapPin size={18} />
             </div>
             <select 
               required
               className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900 appearance-none"
               value={selectedRouteId}
               onChange={(e) => setSelectedRouteId(e.target.value)}
             >
               <option value="">-- Chọn tuyến --</option>
               {routes.map(r => (
                 <option key={r.id} value={r.id}>{r.name}</option>
               ))}
             </select>
          </div>
        </div>

        {/* Bus Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Chọn xe</label>
          <select 
             required
             className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900"
             value={selectedBusId}
             onChange={(e) => setSelectedBusId(e.target.value)}
          >
             <option value="">-- Chọn xe --</option>
             {buses.filter(b => b.status === 'Hoạt động').map(b => (
               <option key={b.id} value={b.id}>
                 {b.plate} - {b.type === 'CABIN' ? 'Xe Phòng' : 'Giường nằm'} ({b.seats} chỗ)
               </option>
             ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Giờ khởi hành</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Clock size={16} />
              </div>
              <input 
                type="time" 
                required
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          
          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Giá vé</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Wallet size={16} />
              </div>
              <input 
                type="number" 
                required
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Driver */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tài xế / Phụ xe</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
               <User size={18} />
             </div>
            <input 
              type="text" 
              placeholder="Nhập tên tài xế..."
              className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-3 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button type="submit" className="flex-1" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin mr-2" /> : null}
            Tạo chuyến
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
