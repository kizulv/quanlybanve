
import React, { useState, useMemo } from 'react';
import { Bus, BusTrip, Route, BusType } from '../types';
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Trash2, CalendarDays, BusFront, AlertCircle, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { getDaysInMonth, daysOfWeek, formatLunarDate, formatTime, isSameDay } from '../utils/dateUtils';
import { AddTripModal } from './AddTripModal';
import { generateCabinLayout, generateSleeperLayout } from '../utils/generators';

interface ScheduleViewProps {
  trips: BusTrip[];
  routes: Route[];
  buses: Bus[];
  onAddTrip: (date: Date, tripData: Partial<BusTrip>) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onUpdateBus: (busId: string, updates: Partial<Bus>) => Promise<void>;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ 
  trips, 
  routes, 
  buses, 
  onAddTrip, 
  onDeleteTrip,
  onUpdateBus
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<Date>(new Date());
  const [preSelectedRouteId, setPreSelectedRouteId] = useState<string>('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = getDaysInMonth(year, month);
  
  // Sort routes: Active regular routes first, then Enhanced routes
  const displayRoutes = useMemo(() => {
    return routes
      .filter(r => r.status !== 'inactive')
      .sort((a, b) => {
        // If one is enhanced and other isn't, enhanced goes last (return 1)
        if (!!a.isEnhanced !== !!b.isEnhanced) {
          return a.isEnhanced ? 1 : -1;
        }
        return 0;
      });
  }, [routes]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleOpenAdd = (date: Date, routeId: string = '') => {
    setSelectedDateForAdd(date);
    setPreSelectedRouteId(routeId);
    setIsModalOpen(true);
  };

  const handleSaveTrip = async (tripData: Partial<BusTrip>) => {
    await onAddTrip(selectedDateForAdd, tripData);
  };

  const handleQuickAssign = async (date: Date, route: Route, busId: string) => {
     if (!busId) return;
     const bus = buses.find(b => b.id === busId);
     if (!bus) return;

     // Generate date string
     const dateStr = date.toISOString().split('T')[0];
     const timeStr = route.departureTime || "07:00";
     const dateTimeStr = `${dateStr} ${timeStr}`;

     // Generate seats
     let seats = [];
     if (bus.layoutConfig) {
        const config = bus.layoutConfig;
        for (let f = 1; f <= config.floors; f++) {
            for (let r = 0; r < config.rows; r++) {
                for (let c = 0; c < config.cols; c++) {
                    const key = `${f}-${r}-${c}`;
                    if (config.activeSeats.includes(key)) {
                        let label = config.seatLabels?.[key];
                        if (!label) label = `${f}-${r}-${c}`; // Fallback
                        seats.push({
                            id: label, label, floor: f as 1 | 2, status: 'available', price: route.price || 0, row: r, col: c
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
                             let label = config.seatLabels?.[key] || `B${f}-${i+1}`;
                             seats.push({ id: label, label, floor: f as 1 | 2, status: 'available', price: route.price || 0, row: config.rows, col: i });
                         }
                    }
                }
             }
        }
     } else {
        seats = bus.type === BusType.CABIN 
            ? generateCabinLayout(route.price || 0) 
            : generateSleeperLayout(route.price || 0);
     }

     const tripData: Partial<BusTrip> = {
         name: route.name,
         route: route.name,
         departureTime: dateTimeStr,
         type: bus.type,
         licensePlate: bus.plate,
         driver: "",
         basePrice: route.price || 0,
         seats: seats as any
     };

     await onAddTrip(date, tripData);

     // Auto-save bus assignment for Regular Routes if not already assigned
     if (!route.isEnhanced && bus.defaultRouteId !== String(route.id)) {
        await onUpdateBus(bus.id, { defaultRouteId: String(route.id) });
     }
  }

  // Helper to filter buses for dropdown
  const getAvailableBusesForRoute = (route: Route) => {
    return buses.filter(b => {
        if (b.status !== 'Hoạt động') return false;
        // If Enhanced route, show ALL active buses
        if (route.isEnhanced) return true;
        // If Regular route, show ONLY buses assigned to this route OR unassigned buses
        return String(b.defaultRouteId) === String(route.id) || !b.defaultRouteId;
    });
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
           <CalendarDays className="text-primary" />
           <h2 className="text-lg font-bold text-slate-800 capitalize">Lịch chạy xe tháng {month + 1}/{year}</h2>
        </div>
        
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <button onClick={handleToday} className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-primary">
            Hôm nay
          </button>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {days.map((day) => {
          const isToday = new Date().toDateString() === day.toDateString();
          
          return (
            <div 
              key={day.toISOString()} 
              className={`flex flex-col md:flex-row bg-white rounded-xl border transition-all ${isToday ? 'border-primary/50 ring-1 ring-primary/20 shadow-sm' : 'border-slate-200'}`}
            >
              {/* Date Column */}
              <div className={`
                md:w-48 p-4 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start gap-2 border-b md:border-b-0 md:border-r border-slate-100
                ${isToday ? 'bg-primary/5' : ''}
              `}>
                 <div className="flex items-center gap-3 md:block">
                   <div className="flex flex-col items-center md:items-start">
                     <span className={`text-3xl font-bold ${isToday ? 'text-primary' : 'text-slate-700'}`}>
                        {day.getDate()}
                     </span>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        {daysOfWeek[day.getDay()]}
                     </span>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-normal">
                      {formatLunarDate(day)}
                   </Badge>
                   {isToday && <Badge className="md:hidden">Hôm nay</Badge>}
                 </div>
              </div>

              {/* Trips Content - Iterating by Routes to show Slots */}
              <div className="flex-1 p-4 space-y-3">
                 {displayRoutes.map(route => {
                    const existingTrips = trips.filter(t => {
                        const tDate = new Date(t.departureTime.split(' ')[0]);
                        return isSameDay(tDate, day) && t.route === route.name;
                    });

                    const availableBuses = getAvailableBusesForRoute(route);
                    const noBusWarning = availableBuses.length === 0;

                    const shouldShowAddSlot = route.isEnhanced || existingTrips.length === 0;

                    return (
                        <div key={`${route.id}-${day.getDate()}`} className="flex flex-col gap-2">
                            {/* 1. Existing Trips */}
                            {existingTrips.map(trip => (
                                <div key={trip.id} className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 p-3 rounded-lg border border-slate-200 hover:border-primary/30 hover:bg-slate-50 transition-all bg-white shadow-sm">
                                    <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-2 mb-1">
                                          <Badge variant="outline" className="bg-slate-100 font-mono text-slate-700 border-slate-200">
                                             {formatTime(trip.departureTime)}
                                          </Badge>
                                          <h4 className="font-bold text-slate-800 text-sm truncate flex items-center gap-2">
                                              {trip.route}
                                              {route.isEnhanced && <Zap size={14} className="text-yellow-500 fill-yellow-500" />}
                                          </h4>
                                       </div>
                                       <div className="flex items-center gap-3 text-xs text-slate-500">
                                          <span className="flex items-center gap-1">
                                            <MapPin size={12} /> {trip.seats.filter(s => s.status === 'available').length} chỗ trống
                                          </span>
                                          <span className="hidden sm:inline">|</span>
                                          <span className="font-medium text-slate-700">{trip.basePrice.toLocaleString('vi-VN')} đ</span>
                                       </div>
                                    </div>
                                    
                                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0.5 min-w-[120px]">
                                       <span className="font-bold text-slate-800 text-sm">{trip.licensePlate}</span>
                                       <span className="text-[10px] uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                          {trip.type === BusType.CABIN ? 'Xe Phòng' : 'Giường nằm'}
                                       </span>
                                    </div>
                                    
                                    <div className="absolute top-2 right-2 sm:static opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-red-50"
                                          onClick={() => onDeleteTrip(trip.id)}
                                        >
                                           <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            {/* 2. Empty Slot (Quick Assign) */}
                            {shouldShowAddSlot && (
                                <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50">
                                     <div className="flex-1 flex items-center gap-3 w-full">
                                        <div className={`p-2 rounded-full ${route.isEnhanced ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-200 text-slate-400'}`}>
                                            {route.isEnhanced ? <Zap size={18} className="fill-current" /> : <BusFront size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-medium text-sm ${route.isEnhanced ? 'text-yellow-700' : 'text-slate-500'}`}>
                                                {route.name}
                                            </h4>
                                            <div className="text-xs text-slate-400 flex items-center gap-2">
                                                <Clock size={12} /> 
                                                {route.departureTime || '--:--'}
                                                {route.isEnhanced && <span className="font-bold text-yellow-600 ml-1">(Tăng cường)</span>}
                                            </div>
                                        </div>
                                     </div>

                                     <div className="w-full sm:w-auto flex items-center gap-2">
                                        {noBusWarning ? (
                                            <div className="text-xs text-red-500 flex items-center gap-1 px-3 py-1.5 bg-red-50 rounded border border-red-100">
                                                <AlertCircle size={12} /> Chưa có xe phù hợp
                                                <Button variant="ghost" size="sm" className="h-auto p-0 ml-1 text-red-600 underline" onClick={() => handleOpenAdd(day, String(route.id))}>Chi tiết</Button>
                                            </div>
                                        ) : (
                                            <select 
                                                className="h-9 w-full sm:w-[180px] text-sm border-slate-300 rounded-md focus:border-primary focus:ring-primary/20 bg-white"
                                                onChange={(e) => handleQuickAssign(day, route, e.target.value)}
                                                value=""
                                            >
                                                <option value="" disabled>-- Chọn xe chạy --</option>
                                                {availableBuses.map(b => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.plate} ({b.type === 'CABIN' ? '22P' : '41G'})
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                     </div>
                                </div>
                            )}
                        </div>
                    );
                 })}
                 
                 {/* Generic Add Button */}
                 <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenAdd(day)}
                    className="w-full mt-2 border border-dashed border-slate-200 text-slate-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 h-8 text-xs"
                 >
                    <Plus size={14} className="mr-1" /> Thêm chuyến tùy chỉnh
                 </Button>
              </div>
            </div>
          );
        })}
        
        {/* Empty space at bottom */}
        <div className="h-10"></div>
      </div>

      <AddTripModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetDate={selectedDateForAdd}
        preSelectedRouteId={preSelectedRouteId}
        routes={routes}
        buses={buses}
        onSave={handleSaveTrip}
      />
    </div>
  );
};
