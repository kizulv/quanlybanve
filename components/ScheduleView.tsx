
import React, { useState, useMemo } from 'react';
import { Bus, BusTrip, Route, BusType } from '../types';
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Trash2, CalendarDays, BusFront, AlertCircle, Zap, Edit2, ArrowRightLeft } from 'lucide-react';
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
  
  const displayRoutes = useMemo(() => {
    return routes
      .filter(r => r.status !== 'inactive')
      .sort((a, b) => {
        if (!!a.isEnhanced !== !!b.isEnhanced) return a.isEnhanced ? 1 : -1;
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

  const getAvailableBusesForRoute = (route: Route) => {
    return buses.filter(b => {
        if (b.status !== 'Hoạt động') return false;
        if (route.isEnhanced) return true;
        return String(b.defaultRouteId) === String(route.id) || !b.defaultRouteId;
    });
  }

  const renderTripItem = (trip: BusTrip, route: Route) => {
    const isReturn = trip.direction === 'inbound';
    return (
        <div key={trip.id} className="group relative flex flex-col items-start gap-2 p-3 rounded-lg border border-slate-200 hover:border-primary/30 hover:bg-slate-50 transition-all bg-white shadow-sm min-w-[160px] md:min-w-[180px]">
            {/* Header: Time & Direction Badge */}
            <div className="w-full flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-slate-100 font-mono text-slate-700 border-slate-200">
                        {formatTime(trip.departureTime)}
                    </Badge>
                </div>
                <Badge variant={isReturn ? 'warning' : 'default'} className={`text-[10px] px-1.5 h-5 ${isReturn ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                    {isReturn ? 'Chiều về' : 'Chiều đi'}
                </Badge>
            </div>
            
            <div className="w-full">
                <div className="flex items-center gap-1 mb-1">
                     <span className="font-bold text-slate-800 text-sm">{trip.licensePlate}</span>
                </div>
                <h4 className="font-medium text-slate-600 text-xs truncate" title={trip.name}>{trip.name}</h4>
            </div>
            
            <div className="w-full flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 mt-1">
                <span className="flex items-center gap-1">
                    <MapPin size={12} /> {trip.seats.filter(s => s.status === 'available').length} chỗ
                </span>
                <span className="text-[10px] uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                    {trip.type === BusType.CABIN ? 'Phòng' : 'Giường'}
                </span>
            </div>
            
            {/* Action Buttons */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur rounded p-1 border border-slate-100 shadow-sm z-10">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-400 hover:text-primary"
                    onClick={() => handleOpenEdit(trip)}
                    title="Chỉnh sửa"
                >
                    <Edit2 size={12} />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-400 hover:text-destructive"
                    onClick={() => onDeleteTrip(trip.id)}
                    title="Xóa"
                >
                    <Trash2 size={12} />
                </Button>
            </div>
        </div>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4">
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

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {days.map((day) => {
          const isToday = new Date().toDateString() === day.toDateString();
          
          return (
            <div 
              key={day.toISOString()} 
              className={`flex flex-col md:flex-row bg-white rounded-xl border transition-all ${isToday ? 'border-primary/50 ring-1 ring-primary/20 shadow-sm' : 'border-slate-200'}`}
            >
              <div className={`
                md:w-32 p-4 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start gap-2 border-b md:border-b-0 md:border-r border-slate-100
                ${isToday ? 'bg-primary/5' : ''}
              `}>
                 <div className="flex items-center gap-3 md:block">
                   <div className="flex flex-col items-center md:items-center w-full">
                     <span className={`text-3xl font-bold ${isToday ? 'text-primary' : 'text-slate-700'}`}>
                        {day.getDate()}
                     </span>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        {daysOfWeek[day.getDay()]}
                     </span>
                   </div>
                 </div>
                 <div className="flex items-center gap-2 w-full justify-center">
                   <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-normal text-[10px] px-1.5">
                      {formatLunarDate(day)}
                   </Badge>
                 </div>
              </div>

              <div className="flex-1 p-4 space-y-4">
                 {displayRoutes.map(route => {
                    // Filter and Sort Trips
                    const routeTrips = trips.filter(t => {
                        const tDate = new Date(t.departureTime.split(' ')[0]);
                        const isSameDayCheck = isSameDay(tDate, day);
                        if (!isSameDayCheck) return false;
                        if (t.routeId && route.id) return String(t.routeId) === String(route.id);
                        return t.route === route.name;
                    }).sort((a, b) => {
                         // Logic: Outbound first, then Inbound
                         const dirA = a.direction === 'inbound' ? 1 : 0;
                         const dirB = b.direction === 'inbound' ? 1 : 0;
                         if (dirA !== dirB) return dirA - dirB;
                         // Secondary sort by time
                         return a.departureTime.localeCompare(b.departureTime);
                    });

                    // Check quota for regular routes (Max 2 trips: 1 outbound + 1 inbound effectively, or just length check)
                    const isLimitReached = !route.isEnhanced && routeTrips.length >= 2;

                    return (
                        <div key={`${route.id}-${day.getDate()}`} className="rounded-xl border border-slate-100 p-3 bg-slate-50/30">
                            {/* Route Title with Action */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-sm ${route.isEnhanced ? 'text-yellow-700' : 'text-slate-800'}`}>{route.name}</span>
                                    {route.isEnhanced && <Badge variant="warning" className="text-[10px] px-1 h-5">Tăng cường</Badge>}
                                </div>
                                
                                {/* Hide Add button if quota reached for regular routes */}
                                {!isLimitReached ? (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                                        onClick={() => handleOpenAdd(day, String(route.id))}
                                    >
                                        <Plus size={14} className="mr-1" /> Thêm xe
                                    </Button>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic px-2">Đã đủ chuyến</span>
                                )}
                            </div>

                            {/* Horizontal Trip List */}
                            {routeTrips.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {routeTrips.map(t => renderTripItem(t, route))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic pl-1">Chưa có chuyến nào</div>
                            )}
                        </div>
                    );
                 })}
                 
                 {displayRoutes.length === 0 && (
                     <div className="text-center py-8 text-slate-400 text-sm">
                        Chưa có tuyến đường nào được cấu hình.
                     </div>
                 )}
              </div>
            </div>
          );
        })}
        
        <div className="h-10"></div>
      </div>

      <AddTripModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetDate={selectedDateForAdd}
        preSelectedRouteId={preSelectedRouteId}
        initialData={editingTrip}
        existingTrips={trips}
        routes={routes}
        buses={buses}
        onSave={handleSaveTrip}
      />
    </div>
  );
};