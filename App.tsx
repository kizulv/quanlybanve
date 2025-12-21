import React, { useState, useEffect, useMemo } from "react";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { useToast, ToastProvider } from "./components/ui/Toast";
import { Layout } from "./components/Layout";
import { RightSheet } from "./components/RightSheet";
import { SeatTransfer } from "./components/SeatTransfer";
import { api } from "./lib/api";
import { isSameDay } from "./utils/dateUtils";
import { Bus, BusTrip, Route, Booking, UndoAction } from "./types";

// Modify AppContent to manage trip1Id and trip2Id for SeatTransfer

function AppContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sales");

  // Global State
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  // Local UI State
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<"outbound" | "inbound">("outbound");

  // Transfer Page State (Lifted for Header Access)
  const [transferTrip1Id, setTransferTrip1Id] = useState<string>('');
  const [transferTrip2Id, setTransferTrip2Id] = useState<string>('');

  const refreshData = async () => {
    try {
      const [tripsData, routesData, busesData, bookingsData] = await Promise.all([
          api.trips.getAll(), api.routes.getAll(), api.buses.getAll(), api.bookings.getAll(),
        ]);
      setTrips(tripsData); setRoutes(routesData); setBuses(busesData); setBookings(bookingsData);
    } catch (error) {
      toast({ type: "error", title: "Lỗi hệ thống", message: "Không thể tải dữ liệu." });
    } finally { setIsLoading(false); }
  };

  useEffect(() => { refreshData(); }, []);

  const availableTripsForDate = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.departureTime.split(" ")[0]);
      return isSameDay(tripDate, selectedDate) && (trip.direction || "outbound") === selectedDirection;
    });
  }, [trips, selectedDate, selectedDirection]);

  // Handle trip selection logic for transfer tab in header
  const transferSubHeader = useMemo(() => {
    if (activeTab !== 'transfer') return null;
    return (
      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
        <select 
          value={transferTrip1Id} 
          onChange={e => setTransferTrip1Id(e.target.value)}
          className="h-9 px-3 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all min-w-[120px] max-w-[180px]"
        >
          <option value="">-- Xe nguồn --</option>
          {availableTripsForDate.map(t => (
            <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate}</option>
          ))}
        </select>
        <ArrowRightLeft size={14} className="text-slate-300" />
        <select 
          value={transferTrip2Id} 
          onChange={e => setTransferTrip2Id(e.target.value)}
          className="h-9 px-3 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all min-w-[120px] max-w-[180px]"
        >
          <option value="">-- Xe đích --</option>
          {availableTripsForDate.filter(t => t.id !== transferTrip1Id).map(t => (
            <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate}</option>
          ))}
        </select>
      </div>
    );
  }, [activeTab, availableTripsForDate, transferTrip1Id, transferTrip2Id]);

  // ... (Other handlers omitted for brevity - same as original)

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      availableTrips={availableTripsForDate}
      selectedTripId={selectedTripId}
      onTripChange={setSelectedTripId}
      selectedDirection={selectedDirection}
      onDirectionChange={setSelectedDirection}
      routes={routes}
      headerRight={<RightSheet bookings={bookings} trips={trips} onSelectBooking={() => {}} onUndo={() => {}} lastUndoAction={undoStack[undoStack.length - 1]} />}
      subHeaderContent={transferSubHeader}
    >
      {activeTab === "sales" && (
        // ... (Sales View)
        <div className="flex flex-col md:flex-row gap-4 animate-in fade-in">Sales Content...</div>
      )}
      {activeTab === "transfer" && (
        <SeatTransfer 
          trips={trips} 
          bookings={bookings} 
          selectedDate={selectedDate} 
          onRefresh={refreshData}
          trip1Id={transferTrip1Id}
          trip2Id={transferTrip2Id}
          onTrip1Change={setTransferTrip1Id}
          onTrip2Change={setTransferTrip2Id}
        />
      )}
      {/* ... (Other tabs) */}
    </Layout>
  );
}

function App() { return <ToastProvider><AppContent /></ToastProvider>; }
export default App;