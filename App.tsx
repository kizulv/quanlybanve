
import React, { useState, useMemo, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SeatMap } from './components/SeatMap';
import { BookingForm } from './components/BookingForm';
import { SettingsView } from './components/SettingsView';
import { ScheduleView } from './components/ScheduleView';
import { Badge } from './components/ui/Badge';
import { Button } from './components/ui/Button';
import { BusTrip, Seat, SeatStatus, Passenger, Booking, Route, Bus, BusType } from './types';
import { Search, Filter, BusFront, Armchair, Banknote, CalendarDays, Ticket, Clock, MapPin, Loader2, ArrowRightLeft } from 'lucide-react';
import { api } from './lib/api';
import { isSameDay } from './utils/dateUtils';

function App() {
  const [activeTab, setActiveTab] = useState('sales');
  
  // -- GLOBAL STATE (Fetched from API) --
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // -- DATA FETCHING --
  const refreshData = async () => {
    try {
      const [tripsData, routesData, busesData, bookingsData] = await Promise.all([
        api.trips.getAll(),
        api.routes.getAll(),
        api.buses.getAll(),
        api.bookings.getAll()
      ]);
      setTrips(tripsData);
      setRoutes(routesData);
      setBuses(busesData);
      setBookings(bookingsData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // -- LOCAL UI STATE --
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  
  // Filter States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [selectedRoute, setSelectedRoute] = useState<string>('');

  // Derived state for Filter Logic
  // 1. Find routes that actually have trips on the selected date and direction
  const availableRouteNames = useMemo(() => {
    const matchingTrips = trips.filter(trip => {
      const tripDate = new Date(trip.departureTime.split(' ')[0]);
      const dateMatch = isSameDay(tripDate, selectedDate);
      // Fallback direction to outbound if missing (legacy data support)
      const tripDir = trip.direction || 'outbound'; 
      return dateMatch && tripDir === selectedDirection;
    });

    const routeNames = [...new Set(matchingTrips.map(t => t.route))];
    return routeNames.sort();
  }, [trips, selectedDate, selectedDirection]);

  // 2. Auto-select the first available route if the current one is invalid
  useEffect(() => {
    if (activeTab === 'sales') {
      if (availableRouteNames.length > 0) {
        if (!selectedRoute || !availableRouteNames.includes(selectedRoute)) {
          setSelectedRoute(availableRouteNames[0]);
        }
      } else {
        setSelectedRoute('');
      }
    }
  }, [availableRouteNames, selectedRoute, activeTab]);

  const selectedTrip = trips.find(t => t.id === selectedTripId) || null;
  const selectedSeats = selectedTrip?.seats.filter(s => s.status === SeatStatus.SELECTED) || [];

  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      // Logic for sales tab: Filter by date AND route AND direction
      const tripDate = new Date(trip.departureTime.split(' ')[0]);
      const dateMatch = isSameDay(tripDate, selectedDate);
      const tripDir = trip.direction || 'outbound';
      const dirMatch = tripDir === selectedDirection;
      
      // Strict route match (no more "all")
      const routeMatch = trip.route === selectedRoute;

      return dateMatch && dirMatch && routeMatch;
    });
  }, [trips, selectedRoute, selectedDate, selectedDirection]);

  // Handlers
  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);
  };

  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;

    // Optimistic Update
    const updatedSeats = selectedTrip.seats.map(seat => {
      if (seat.id === clickedSeat.id) {
        return {
          ...seat,
          status: seat.status === SeatStatus.SELECTED ? SeatStatus.AVAILABLE : SeatStatus.SELECTED
        };
      }
      return seat;
    });

    // Update Local State immediately for responsiveness
    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips(trips.map(t => t.id === selectedTrip.id ? updatedTrip : t));

    // Persist to "DB" via API
    try {
      await api.trips.updateSeats(selectedTrip.id, updatedSeats);
    } catch (e) {
      console.error("Failed to update seat status", e);
      // Revert on error would go here
    }
  };

  const handleBookingSubmit = async (passenger: Passenger) => {
    if (!selectedTrip) return;

    // Call API transaction
    try {
      const result = await api.bookings.create(selectedTrip.id, selectedSeats, passenger);
      
      // Update Local State with result
      setTrips(trips.map(t => t.id === selectedTrip.id ? result.updatedTrip : t));
      setBookings([...bookings, ...result.bookings]);
      setShowBookingForm(false);
    } catch (error) {
      alert("Đặt vé thất bại. Vui lòng thử lại.");
    }
  };

  const cancelSelection = async () => {
    if(!selectedTrip) return;
     const updatedSeats = selectedTrip.seats.map(seat => {
      if (seat.status === SeatStatus.SELECTED) {
        return { ...seat, status: SeatStatus.AVAILABLE };
      }
      return seat;
    });
    
    // Update Local
    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips(trips.map(t => t.id === selectedTrip.id ? updatedTrip : t));
    setShowBookingForm(false);

    // Update DB
    await api.trips.updateSeats(selectedTrip.id, updatedSeats);
  }

  // --- SCHEDULE HANDLERS ---
  const handleAddTrip = async (date: Date, tripData: Partial<BusTrip>) => {
    try {
      const newTrip = {
        id: `TRIP-${Date.now()}`,
        ...tripData
      } as BusTrip;
      
      await api.trips.create(newTrip);
      await refreshData();
    } catch (e) {
      console.error("Create trip failed", e);
    }
  };

  const handleUpdateTrip = async (tripId: string, tripData: Partial<BusTrip>) => {
    try {
      await api.trips.update(tripId, tripData);
      await refreshData();
    } catch (e) {
      console.error("Update trip failed", e);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await api.trips.delete(tripId);
      await refreshData();
      if(selectedTripId === tripId) setSelectedTripId(null);
    } catch(e) {
      console.error("Delete trip failed", e);
    }
  };

  const handleUpdateBus = async (busId: string, updates: Partial<Bus>) => {
    try {
      await api.buses.update(busId, updates);
      setBuses(prev => prev.map(b => b.id === busId ? { ...b, ...updates } : b));
    } catch (e) {
      console.error("Update bus failed", e);
    }
  };

  // Views
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  const renderTicketSales = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
        {/* Trip List Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
               <div className="font-semibold text-slate-700 flex items-center gap-2">
                <BusFront size={18} className="text-primary" />
                Kết quả tìm kiếm
              </div>
              <Badge variant="default" className="bg-slate-200 text-slate-700 hover:bg-slate-300 border-none">
                {filteredTrips.length} chuyến
              </Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredTrips.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <Search size={40} className="mb-2 opacity-50" />
                  <p className="font-medium text-slate-600">Không tìm thấy chuyến xe nào</p>
                  <p className="text-xs mt-1">Vui lòng kiểm tra lại ngày, chiều đi hoặc tuyến đường.</p>
                </div>
              ) : (
                filteredTrips.map(trip => {
                  const availableSeats = trip.seats.filter(s => s.status === SeatStatus.AVAILABLE).length;
                  const isSelected = selectedTripId === trip.id;
                  const isReturn = trip.direction === 'inbound';
                  return (
                    <div 
                      key={trip.id}
                      onClick={() => handleTripSelect(trip.id)}
                      className={`
                        group relative p-4 rounded-lg cursor-pointer transition-all duration-200 border
                        ${isSelected 
                          ? 'bg-primary/5 border-primary shadow-sm' 
                          : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm hover:bg-slate-50'
                        }
                      `}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className={`font-bold text-sm ${isSelected ? 'text-primary' : 'text-slate-900'}`}>{trip.route}</h3>
                          <div className="flex items-center text-xs text-slate-500 mt-1 gap-2">
                             <span className="flex items-center"><Clock size={12} className="mr-1"/> {trip.departureTime.split(' ')[1]}</span>
                             {trip.direction && (
                                <span className={`flex items-center px-1.5 py-0.5 rounded ${isReturn ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                   <ArrowRightLeft size={10} className="mr-1" />
                                   {isReturn ? 'Chiều về' : 'Chiều đi'}
                                </span>
                             )}
                          </div>
                        </div>
                        <Badge variant={trip.type === BusType.CABIN ? 'warning' : 'default'} className="scale-90 origin-right">
                          {trip.type === BusType.CABIN ? 'Xe Phòng' : 'Giường Đơn'}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-end pt-2 border-t border-slate-100/50 mt-2">
                        <div className="text-xs text-slate-500">
                           <span className="font-medium text-slate-700 flex items-center gap-1"><BusFront size={12}/> {trip.licensePlate}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-primary">{trip.basePrice.toLocaleString('vi-VN')}đ</div>
                          <div className={`text-[10px] font-medium mt-0.5 ${availableSeats === 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {availableSeats} chỗ trống
                          </div>
                        </div>
                      </div>
                      
                      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Seat Map Area */}
        <div className="lg:col-span-8 h-full flex flex-col">
          {selectedTrip ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden relative">
              {/* Toolbar */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-10">
                <div>
                   <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                     {selectedTrip.name}
                     <span className="text-xs font-normal text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full">{selectedTrip.type === BusType.CABIN ? 'Xe Phòng' : 'Xe Giường Đơn'}</span>
                   </h2>
                </div>
                <div className="flex gap-4 text-xs font-medium">
                   <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded border border-slate-300 bg-white"></div> Trống</div>
                   <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary"></div> Đang chọn</div>
                   <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400"></div> Đã đặt</div>
                   <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></div> Đã bán</div>
                </div>
              </div>
              
              {/* Scrollable Map */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                <SeatMap 
                  seats={selectedTrip.seats} 
                  busType={selectedTrip.type} 
                  onSeatClick={handleSeatClick} 
                />
              </div>

              {/* Bottom Action Bar */}
              <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                  <div className="flex items-center gap-3">
                     <div className="bg-primary/10 text-primary p-2 rounded-lg">
                       <Armchair size={24} />
                     </div>
                     <div>
                       <div className="text-sm text-slate-500">Đang chọn</div>
                       <div className="font-bold text-slate-900 text-lg leading-none">{selectedSeats.length} <span className="text-sm font-normal text-slate-500">ghế</span></div>
                     </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-500">Tổng tiền tạm tính</div>
                      <div className="text-xl font-bold text-primary">
                        {selectedSeats.reduce((sum, s) => sum + s.price, 0).toLocaleString('vi-VN')} <span className="text-sm align-top">đ</span>
                      </div>
                    </div>
                    <Button 
                      size="lg" 
                      disabled={selectedSeats.length === 0}
                      onClick={() => setShowBookingForm(true)}
                      className="shadow-lg shadow-primary/20 min-w-[140px]"
                    >
                      Đặt vé ngay
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col items-center justify-center text-slate-400 p-8 border-dashed">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <BusFront size={40} className="opacity-20 text-slate-900" />
                </div>
                <h3 className="text-lg font-medium text-slate-600">Chưa chọn chuyến xe</h3>
                <p className="max-w-xs text-center mt-2 text-sm">Vui lòng chọn một chuyến xe từ danh sách bên trái để xem sơ đồ ghế và đặt vé.</p>
             </div>
          )}
        </div>
      </div>
      
      {showBookingForm && selectedTrip && (
        <BookingForm 
          selectedSeats={selectedSeats}
          onCancel={cancelSelection}
          onSubmit={handleBookingSubmit}
        />
      )}
    </div>
  );

  const renderTickets = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Danh sách vé gần đây</h2>
            <Button variant="outline" size="sm"><Filter size={16} className="mr-2"/> Bộ lọc</Button>
         </div>
         <div className="overflow-x-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
               <tr>
                 <th className="px-6 py-4">Mã vé</th>
                 <th className="px-6 py-4">Khách hàng</th>
                 <th className="px-6 py-4">Chuyến xe</th>
                 <th className="px-6 py-4">Ghế</th>
                 <th className="px-6 py-4">Tổng tiền</th>
                 <th className="px-6 py-4">Trạng thái</th>
                 <th className="px-6 py-4">Ngày đặt</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {bookings.length === 0 ? (
                 <tr>
                   <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                     <div className="flex flex-col items-center gap-2">
                       <Ticket size={32} className="opacity-20" />
                       <span>Chưa có dữ liệu đặt vé nào</span>
                     </div>
                   </td>
                 </tr>
               ) : (
                 bookings.map(booking => {
                   const trip = trips.find(t => t.id === booking.busId);
                   return (
                     <tr key={booking.id} className="hover:bg-slate-50 transition-colors group">
                       <td className="px-6 py-4 font-medium text-primary">{booking.id}</td>
                       <td className="px-6 py-4">
                         <div className="font-medium text-slate-900">{booking.passenger.name}</div>
                         <div className="text-slate-500 text-xs">{booking.passenger.phone}</div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="text-slate-900 max-w-[200px] truncate" title={trip?.route}>{trip?.route}</div>
                         <div className="text-slate-500 text-xs flex items-center mt-0.5">
                           <Clock size={10} className="mr-1"/> {trip?.departureTime}
                         </div>
                       </td>
                       <td className="px-6 py-4">
                         <Badge variant="default" className="font-mono">{booking.seatId}</Badge>
                       </td>
                       <td className="px-6 py-4 font-bold text-slate-900">
                         {booking.totalPrice.toLocaleString('vi-VN')} đ
                       </td>
                       <td className="px-6 py-4">
                         <Badge variant="success">Đã thanh toán</Badge>
                       </td>
                       <td className="px-6 py-4 text-slate-500">
                         {new Date(booking.createdAt).toLocaleDateString('vi-VN')}
                       </td>
                     </tr>
                   );
                 })
               )}
             </tbody>
           </table>
         </div>
       </div>
    </div>
  );

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      selectedRoute={selectedRoute}
      onRouteChange={setSelectedRoute}
      routes={availableRouteNames}
      selectedDirection={selectedDirection}
      onDirectionChange={setSelectedDirection}
    >
      {activeTab === 'sales' && renderTicketSales()}
      {activeTab === 'tickets' && renderTickets()}
      {activeTab === 'schedule' && (
        <ScheduleView 
          trips={trips}
          routes={routes}
          buses={buses}
          onAddTrip={handleAddTrip}
          onUpdateTrip={handleUpdateTrip}
          onDeleteTrip={handleDeleteTrip}
          onUpdateBus={handleUpdateBus}
        />
      )}
      {activeTab === 'settings' && (
        <SettingsView 
          routes={routes} 
          setRoutes={setRoutes}
          buses={buses}
          setBuses={setBuses}
          trips={trips}
          setTrips={setTrips}
          onDataChange={refreshData}
        />
      )}
    </Layout>
  );
}

export default App;
