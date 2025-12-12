
import React, { useState } from 'react';
import { Bus, BusTrip, Route, BusType } from '../types';
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Trash2, CalendarDays } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { getDaysInMonth, daysOfWeek, formatLunarDate, formatTime, isSameDay } from '../utils/dateUtils';
import { AddTripModal } from './AddTripModal';

interface ScheduleViewProps {
  trips: BusTrip[];
  routes: Route[];
  buses: Bus[];
  onAddTrip: (date: Date, tripData: Partial<BusTrip>) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ 
  trips, 
  routes, 
  buses, 
  onAddTrip, 
  onDeleteTrip 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = getDaysInMonth(year, month);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleOpenAdd = (date: Date) => {
    setSelectedDateForAdd(date);
    setIsModalOpen(true);
  };

  const handleSaveTrip = async (tripData: Partial<BusTrip>) => {
    await onAddTrip(selectedDateForAdd, tripData);
  };

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
          const dayTrips = trips.filter(t => {
             // Parse trip date string YYYY-MM-DD HH:MM
             const tDate = new Date(t.departureTime.split(' ')[0]);
             return isSameDay(tDate, day);
          }).sort((a, b) => a.departureTime.localeCompare(b.departureTime));

          return (
            <div 
              key={day.toISOString()} 
              className={`flex flex-col md:flex-row bg-white rounded-xl border transition-all hover:shadow-md ${isToday ? 'border-primary/50 ring-1 ring-primary/20 shadow-sm' : 'border-slate-200'}`}
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

              {/* Trips Content */}
              <div className="flex-1 p-4">
                 <div className="space-y-3">
                   {dayTrips.length === 0 ? (
                      <div className="flex items-center justify-between text-slate-400 py-2">
                        <span className="text-sm italic">Chưa có chuyến xe nào</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOpenAdd(day)}
                          className="hover:bg-primary/5 hover:text-primary"
                        >
                          <Plus size={16} className="mr-1" /> Tạo chuyến
                        </Button>
                      </div>
                   ) : (
                      <>
                        {dayTrips.map(trip => (
                          <div key={trip.id} className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 p-3 rounded-lg border border-slate-100 hover:border-primary/30 hover:bg-slate-50 transition-all bg-slate-50/30">
                             
                             {/* Time & Route */}
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                   <Badge variant="outline" className="bg-white font-mono text-primary border-primary/20">
                                      {formatTime(trip.departureTime)}
                                   </Badge>
                                   <h4 className="font-bold text-slate-800 text-sm truncate">{trip.route}</h4>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                   <span className="flex items-center gap-1">
                                     <MapPin size={12} /> {trip.seats.filter(s => s.status === 'available').length} chỗ trống
                                   </span>
                                   <span className="hidden sm:inline">|</span>
                                   <span className="font-medium text-slate-700">{trip.basePrice.toLocaleString('vi-VN')} đ</span>
                                </div>
                             </div>

                             {/* Bus Info */}
                             <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0.5 min-w-[120px]">
                                <span className="font-bold text-slate-800 text-sm">{trip.licensePlate}</span>
                                <span className="text-[10px] uppercase bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                   {trip.type === BusType.CABIN ? 'Xe Phòng' : 'Giường nằm'}
                                </span>
                             </div>

                             {/* Actions */}
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
                        
                        {/* Quick Add at bottom of list */}
                        <div className="pt-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenAdd(day)}
                            className="w-full border border-dashed border-slate-200 text-slate-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 h-8 text-xs"
                          >
                            <Plus size={14} className="mr-1" /> Thêm chuyến khác
                          </Button>
                        </div>
                      </>
                   )}
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
        routes={routes}
        buses={buses}
        onSave={handleSaveTrip}
      />
    </div>
  );
};
