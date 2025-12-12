
import React, { useState, useMemo } from 'react';
import { Bus, BusTrip, Route, BusType } from '../types';
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Trash2, CalendarDays, BusFront, AlertCircle, Zap, Edit2, ArrowRight, RotateCcw } from 'lucide-react';
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
  onUpdateTrip: (tripId: string, tripData: Partial<BusTrip>) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onUpdateBus: (busId: string, updates: Partial<Bus>) => Promise<void>;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ 
  trips, 
  routes, 
  buses, 
  onAddTrip, 
  onUpdateTrip,
  onDeleteTrip,
  onUpdateBus
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<Date>(new Date());
  const [preSelectedRouteId, setPreSelectedRouteId] = useState<string>('');
  const [editingTrip, setEditingTrip] = useState<BusTrip | undefined>(undefined);

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
    setEditingTrip(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (trip: BusTrip) => {
    const tripDate = new Date(trip.departureTime.split(' ')[0]);
    setSelectedDateForAdd(tripDate);
    // Find route by ID first, fallback to Name
    let routeIdToEdit = '';
    if (trip.routeId) {
        routeIdToEdit = String(trip.routeId);
    } else {
        const route = routes.find(r => r.name === trip.route);
        routeIdToEdit = route ? String(route.id) : '';
    }
    
    setPreSelectedRouteId(routeIdToEdit);
    setEditingTrip(trip);
    setIsModalOpen(true);
  };

  const handleSaveTrip = async (tripData: Partial<BusTrip>) => {
    if (editingTrip) {
      await onUpdateTrip(editingTrip.id, tripData);
    } else {
      await onAddTrip(selectedDateForAdd, tripData);
    }
  };

  // direction: 'outbound' (Departure Time) | 'inbound' (Return Time)
  const handleQuickAssign = async (date: Date, route: Route, busId: string, direction: 'outbound' | 'inbound') => {
     if (!busId) return;
     const bus = buses.find(b => b.id === busId);
     if (!bus) return;

     const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
     // Select time based on direction
     const timeStr = direction === 'outbound' ? (route.departureTime || "07:00") : (route.returnTime || "13:00");
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
         routeId: route.id,
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

     // Only update default route if it's a regular route and outbound assignment
     if (!route.isEnhanced && direction === 'outbound' && bus.status === 'Hoạt động' && bus.defaultRouteId !== String(route.id)) {
        await onUpdateBus(bus.id, { defaultRouteId: String(route.id) });
     }
  }

  // Find buses that ran the OUTBOUND leg of this route on the PREVIOUS day
  const getPreviousDayBuses = (currentDate: Date, route: Route) => {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    
    return trips.filter(t => {
      // 1. Match Date = Yesterday
      const tDate = new Date(t.departureTime.split(' ')[0]);
      if (!isSameDay(tDate, prevDate)) return false;

      // 2. Match Route
      if (t.routeId && String(t.routeId) !== String(route.id)) return false;
      if (!t.routeId && t.route !== route.name) return false;

      // 3. Match Direction = Outbound (Time matches route departure time)
      // This is heuristic if data isn't perfectly clean, but works for standard logic
      const tTime = t.departureTime.split(' ')[1];
      return tTime === route.departureTime;
    }).map(t => t.licensePlate);
  };

  // Helper to filter buses for dropdown
  const getAvailableBusesForDropdown = (route: Route, direction: 'outbound' | 'inbound', date: Date) => {
    let rotationBuses: string[] = [];
    
    // If Inbound (Return), prioritise buses from yesterday
    if (direction === 'inbound') {
      rotationBuses = getPreviousDayBuses(date, route);
    }

    const allBuses = buses.filter(b => {
        // Allow Active buses AND Rental/Reinforcement buses
        if (b.status !== 'Hoạt động' && b.status !== 'Xe thuê/Tăng cường') return false;
        
        // If Enhanced route, show ALL allowed buses
        if (route.isEnhanced) return true;
        
        // If Rental/Reinforcement, always show
        if (b.status === 'Xe thuê/Tăng cường') return true;

        // If Regular route, show assigned buses OR unassigned buses
        return String(b.defaultRouteId) === String(route.id) || !b.defaultRouteId;
    });

    // Sorting: 
    // 1. Rotation buses (Yesterday's outbound) first [For Inbound only]
    // 2. Buses assigned to this route
    // 3. Rental/Reinforcement
    // 4. Others
    return allBuses.sort((a, b) => {
      if (direction === 'inbound') {
        const aIsRot = rotationBuses.includes(a.plate);
        const bIsRot = rotationBuses.includes(b.plate);
        if (aIsRot && !bIsRot) return -1;
        if (!aIsRot && bIsRot) return 1;
      }
      
      const aIsAssigned = String(a.defaultRouteId) === String(route.id);
      const bIsAssigned = String(b.defaultRouteId) === String(route.id);
      if (aIsAssigned && !bIsAssigned) return -1;
      if (!aIsAssigned && bIsAssigned) return 1;

      return 0;
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
              className={`flex flex-col bg-white rounded-xl border transition-all ${isToday ? 'border-primary/50 ring-1 ring-primary/20 shadow-sm' : 'border-slate-200'}`}
            >
              {/* Date Header */}
              <div className={`
                p-3 flex justify-between items-center border-b border-slate-100
                ${isToday ? 'bg-primary/5' : 'bg-slate-50/50'}
              `}>
                 <div className="flex items-center gap-3">
                   <div className="flex items-baseline gap-2">
                     <span className={`text-xl font-bold ${isToday ? 'text-primary' : 'text-slate-700'}`}>
                        {day.getDate()}
                     </span>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        {daysOfWeek[day.getDay()]}
                     </span>
                   </div>
                   <Badge variant="secondary" className="bg-white text-slate-500 font-normal border border-slate-200">
                      {formatLunarDate(day)}
                   </Badge>
                   {isToday && <Badge className="">Hôm nay</Badge>}
                 </div>
              </div>

              {/* Day Content - Split Columns */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                 
                 {/* COLUMN 1: CHIỀU ĐI (OUTBOUND) */}
                 <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Chiều đi</span>
                        <ArrowRight size={12} className="text-slate-300" />
                    </div>
                    
                    {displayRoutes.map(route => {
                         // Filter trips for this route, this day, matching Departure Time
                         const existingTrips = trips.filter(t => {
                            const tDate = new Date(t.departureTime.split(' ')[0]);
                            if (!isSameDay(tDate, day)) return false;
                            
                            // Check Route ID/Name
                            const isRouteMatch = (t.routeId && String(t.routeId) === String(route.id)) || (!t.routeId && t.route === route.name);
                            if (!isRouteMatch) return false;

                            // STRICT CHECK: Time match departureTime
                            const tTime = t.departureTime.split(' ')[1];
                            return tTime === route.departureTime;
                         });

                         const availableBuses = getAvailableBusesForDropdown(route, 'outbound', day);
                         const noBusWarning = availableBuses.length === 0;
                         const shouldShowAddSlot = route.isEnhanced || existingTrips.length === 0;

                         return (
                            <div key={`out-${route.id}-${day.getDate()}`} className="flex flex-col gap-2">
                                {existingTrips.map(trip => (
                                    <TripCard 
                                        key={trip.id} 
                                        trip={trip} 
                                        isEnhanced={!!route.isEnhanced} 
                                        onEdit={() => handleOpenEdit(trip)} 
                                        onDelete={() => onDeleteTrip(trip.id)} 
                                    />
                                ))}

                                {shouldShowAddSlot && (
                                    <EmptySlot 
                                        route={route} 
                                        timeDisplay={route.departureTime}
                                        availableBuses={availableBuses}
                                        noBusWarning={noBusWarning}
                                        onQuickAssign={(busId) => handleQuickAssign(day, route, busId, 'outbound')}
                                        onOpenDetail={() => handleOpenAdd(day, String(route.id))}
                                        isEnhanced={!!route.isEnhanced}
                                        direction="outbound"
                                    />
                                )}
                            </div>
                         )
                    })}
                 </div>

                 {/* COLUMN 2: CHIỀU VỀ (INBOUND) */}
                 <div className="space-y-3 md:border-l md:border-slate-100 md:pl-8">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Chiều về</span>
                        <RotateCcw size={12} className="text-slate-300" />
                    </div>

                    {displayRoutes.map(route => {
                         // Filter trips for this route, this day, matching Return Time
                         const existingTrips = trips.filter(t => {
                            const tDate = new Date(t.departureTime.split(' ')[0]);
                            if (!isSameDay(tDate, day)) return false;
                            
                            // Check Route ID/Name
                            const isRouteMatch = (t.routeId && String(t.routeId) === String(route.id)) || (!t.routeId && t.route === route.name);
                            if (!isRouteMatch) return false;

                            // STRICT CHECK: Time match returnTime
                            const tTime = t.departureTime.split(' ')[1];
                            return tTime === route.returnTime;
                         });

                         const availableBuses = getAvailableBusesForDropdown(route, 'inbound', day);
                         const noBusWarning = availableBuses.length === 0;
                         const shouldShowAddSlot = route.isEnhanced || existingTrips.length === 0;
                         const rotationBuses = getPreviousDayBuses(day, route);

                         return (
                            <div key={`in-${route.id}-${day.getDate()}`} className="flex flex-col gap-2">
                                {existingTrips.map(trip => (
                                    <TripCard 
                                        key={trip.id} 
                                        trip={trip} 
                                        isEnhanced={!!route.isEnhanced} 
                                        onEdit={() => handleOpenEdit(trip)} 
                                        onDelete={() => onDeleteTrip(trip.id)} 
                                    />
                                ))}

                                {shouldShowAddSlot && (
                                    <EmptySlot 
                                        route={route} 
                                        timeDisplay={route.returnTime}
                                        availableBuses={availableBuses}
                                        noBusWarning={noBusWarning}
                                        onQuickAssign={(busId) => handleQuickAssign(day, route, busId, 'inbound')}
                                        onOpenDetail={() => handleOpenAdd(day, String(route.id))}
                                        isEnhanced={!!route.isEnhanced}
                                        rotationBuses={rotationBuses}
                                        direction="inbound"
                                    />
                                )}
                            </div>
                         )
                    })}
                 </div>

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
        initialData={editingTrip}
        routes={routes}
        buses={buses}
        onSave={handleSaveTrip}
      />
    </div>
  );
};

// Sub-components for cleaner render
const TripCard: React.FC<{ trip: BusTrip; isEnhanced: boolean; onEdit: () => void; onDelete: () => void }> = ({ trip, isEnhanced, onEdit, onDelete }) => (
    <div className="group relative flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:border-primary/30 hover:bg-slate-50 transition-all bg-white shadow-sm">
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-slate-100 font-mono text-slate-700 border-slate-200 px-1.5 py-0">
                    {formatTime(trip.departureTime)}
                </Badge>
                <h4 className="font-bold text-slate-800 text-sm truncate flex items-center gap-2">
                    {trip.route}
                    {isEnhanced && <Zap size={12} className="text-yellow-500 fill-yellow-500" />}
                </h4>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{trip.licensePlate}</span>
                <span>•</span>
                <span>{trip.seats.filter(s => s.status === 'available').length} chỗ</span>
            </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-primary/10"
                onClick={onEdit}
            >
                <Edit2 size={14} />
            </Button>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-red-50"
                onClick={onDelete}
            >
                <Trash2 size={14} />
            </Button>
        </div>
    </div>
);

const EmptySlot: React.FC<{ 
    route: Route; 
    timeDisplay?: string; 
    availableBuses: Bus[]; 
    noBusWarning: boolean; 
    onQuickAssign: (id: string) => void; 
    onOpenDetail: () => void; 
    isEnhanced: boolean;
    rotationBuses?: string[]; // Plate numbers
    direction: 'outbound' | 'inbound';
}> = ({ route, timeDisplay, availableBuses, noBusWarning, onQuickAssign, onOpenDetail, isEnhanced, rotationBuses, direction }) => (
    <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/50">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                 <div className={`p-1.5 rounded-full ${isEnhanced ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-200 text-slate-400'}`}>
                    {isEnhanced ? <Zap size={14} className="fill-current" /> : <BusFront size={14} />}
                </div>
                <div>
                    <h4 className={`font-medium text-sm leading-none ${isEnhanced ? 'text-yellow-700' : 'text-slate-500'}`}>
                        {route.name}
                    </h4>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                        <Clock size={10} /> 
                        {timeDisplay || '--:--'}
                        {isEnhanced && <span className="font-bold text-yellow-600">(TC)</span>}
                    </div>
                </div>
            </div>
        </div>

        <div>
            {isEnhanced ? (
                 <Button 
                    size="sm" 
                    onClick={onOpenDetail}
                    className="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-300 h-8 text-xs"
                >
                    <Plus size={14} className="mr-1" /> Lên lịch xe
                </Button>
            ) : (
                noBusWarning ? (
                    <div className="text-xs text-red-500 flex items-center gap-1 px-2 py-1 bg-red-50 rounded border border-red-100">
                        <AlertCircle size={12} /> Chưa có xe
                        <Button variant="ghost" size="sm" className="h-auto p-0 ml-auto text-red-600 underline text-xs" onClick={onOpenDetail}>Chi tiết</Button>
                    </div>
                ) : (
                    <select 
                        className="h-8 w-full text-xs border-slate-300 rounded-md focus:border-primary focus:ring-primary/20 bg-white"
                        onChange={(e) => onQuickAssign(e.target.value)}
                        value=""
                    >
                        <option value="" disabled>-- Chọn xe --</option>
                        {availableBuses.map(b => {
                            const isRecommended = rotationBuses?.includes(b.plate);
                            const isRental = b.status === 'Xe thuê/Tăng cường';
                            return (
                                <option key={b.id} value={b.id}>
                                    {isRecommended ? '⭐ ' : ''}
                                    {b.plate} 
                                    {isRental ? ' (Thuê)' : ''} 
                                    {isRecommended ? ' (Quay đầu)' : ''}
                                </option>
                            );
                        })}
                    </select>
                )
            )}
        </div>
    </div>
);
