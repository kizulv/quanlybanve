
import React, { useState, useMemo } from 'react';
import { Route, Bus, BusTrip, BusType } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { 
  Plus, Edit, Trash2, MapPin, BusFront, Settings2, 
  ArrowRight, Clock, Zap, AlertCircle, CheckCircle2, 
  MoreHorizontal, Phone, LayoutGrid, AlertTriangle, ShieldCheck, RefreshCw,
  Database, Activity, BarChart3, HardDrive, Server,
  Loader2, Calendar, ChevronRight, WalletCards, CircleDollarSign
} from 'lucide-react';
import { ManagerRouteModal } from './ManagerRouteModal';
import { ManagerCarModal } from './ManagerCarModal';
import { api } from '../lib/api';
import { Dialog } from './ui/Dialog';
import { useToast } from './ui/Toast';

interface MaintenanceLog {
  route: string;
  date: string;
  seat: string;
  action: string;
  details: string;
}

interface SettingsViewProps {
  routes: Route[];
  setRoutes: (routes: Route[]) => void;
  buses: Bus[];
  setBuses: (buses: Bus[]) => void;
  trips: BusTrip[];
  setTrips: (trips: BusTrip[]) => void;
  onDataChange: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  routes, 
  buses, 
  trips,
  onDataChange 
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('routes');
  
  // Modal States
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  
  const [isBusModalOpen, setIsBusModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);

  // Delete Confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'route' | 'bus' | null>(null);

  // Maintenance State (Seats)
  const [isFixingSeats, setIsFixingSeats] = useState(false);
  const [maintenanceResults, setMaintenanceResults] = useState<{
    logs: MaintenanceLog[];
    counts: { fixed: number; sync: number; conflict: number };
  } | null>(null);

  // Maintenance State (Payments)
  const [isFixingPayments, setIsFixingPayments] = useState(false);
  const [paymentMaintenanceResults, setPaymentMaintenanceResults] = useState<{
    logs: MaintenanceLog[];
    deletedCount: number;
  } | null>(null);

  // Stats
  const activeBusesCount = buses.filter(b => b.status === 'Hoạt động').length;
  const activeRoutesCount = routes.filter(r => r.status !== 'inactive').length;

  const detailedStats = useMemo(() => {
    const cabinBuses = buses.filter(b => b.type === BusType.CABIN).length;
    const sleeperBuses = buses.filter(b => b.type === BusType.SLEEPER).length;
    let cabinOccupied = 0;
    let sleeperOccupied = 0;
    trips.forEach(t => {
      const occupied = t.seats.filter(s => s.status !== 'available').length;
      if (t.type === BusType.CABIN) cabinOccupied += occupied;
      else sleeperOccupied += occupied;
    });
    return { cabinBuses, sleeperBuses, cabinOccupied, sleeperOccupied };
  }, [buses, trips]);

  const handleAddRoute = () => { setEditingRoute(null); setIsRouteModalOpen(true); };
  const handleEditRoute = (route: Route) => { setEditingRoute(route); setIsRouteModalOpen(true); };
  const handleSaveRoute = async (routeData: Route) => {
    try {
      if (editingRoute) await api.routes.update(String(editingRoute.id), routeData);
      else await api.routes.create(routeData);
      await onDataChange();
    } catch (error) { console.error(error); }
  };
  const handleDeleteRoute = async () => {
    if (!deleteId) return;
    try { await api.routes.delete(deleteId); await onDataChange(); setDeleteId(null); setDeleteType(null); } catch (error) { console.error(error); }
  };

  const handleAddBus = () => { setEditingBus(null); setIsBusModalOpen(true); };
  const handleEditBus = (bus: Bus) => { setEditingBus(bus); setIsBusModalOpen(true); };
  const handleSaveBus = async (busData: Bus) => {
    try {
      if (editingBus) await api.buses.update(editingBus.id, busData);
      else await api.buses.create(busData);
      await onDataChange();
    } catch (error) { console.error(error); }
  };
  const handleDeleteBus = async () => {
    if (!deleteId) return;
    try { await api.buses.delete(deleteId); await onDataChange(); setDeleteId(null); setDeleteType(null); } catch (error) { console.error(error); }
  };

  const handleFixSeats = async () => {
    setIsFixingSeats(true);
    setMaintenanceResults(null);
    setPaymentMaintenanceResults(null);
    try {
      const result = await api.maintenance.fixSeats();
      setMaintenanceResults({
        logs: result.logs || [],
        counts: {
          fixed: result.fixedCount || 0,
          sync: result.syncCount || 0,
          conflict: result.conflictCount || 0
        }
      });

      if (result.logs && result.logs.length > 0) {
        toast({
          type: 'success',
          title: 'Đã xử lý dữ liệu',
          message: `Phát hiện và sửa lỗi cho ${result.logs.length} vị trí.`
        });
      } else {
        toast({
          type: 'info',
          title: 'Hệ thống sạch',
          message: 'Không phát hiện lỗi dữ liệu nào cần xử lý.'
        });
      }
      await onDataChange();
    } catch (e) {
      toast({ type: 'error', title: 'Lỗi bảo trì', message: 'Không thể thực hiện quét dữ liệu.' });
    } finally {
      setIsFixingSeats(false);
    }
  };

  const handleFixPayments = async () => {
    setIsFixingPayments(true);
    setPaymentMaintenanceResults(null);
    setMaintenanceResults(null);
    try {
      const result = await api.maintenance.fixPayments();
      setPaymentMaintenanceResults({
        logs: result.logs || [],
        deletedCount: result.deletedCount || 0
      });

      if (result.deletedCount > 0) {
        toast({
          type: 'success',
          title: 'Đã dọn dẹp dòng tiền',
          message: `Đã xóa ${result.deletedCount} giao dịch thanh toán không hợp lệ.`
        });
      } else {
        toast({
          type: 'info',
          title: 'Dòng tiền ổn định',
          message: 'Không tìm thấy giao dịch thanh toán nào gắn với đơn HOLD.'
        });
      }
      await onDataChange();
    } catch (e) {
      toast({ type: 'error', title: 'Lỗi bảo trì', message: 'Không thể thực hiện quét thanh toán.' });
    } finally {
      setIsFixingPayments(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Cấu hình hệ thống</h2>
           <p className="text-slate-500 mt-2 text-lg">Quản lý tài nguyên vận hành và mạng lưới tuyến đường.</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-col min-w-[140px]">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Tổng số xe</div>
              <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-slate-900">{buses.length}</span><span className="text-sm font-medium text-green-600 bg-green-50 px-1.5 rounded">{activeBusesCount} hoạt động</span></div>
           </div>
           <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-col min-w-[140px]">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Tổng tuyến</div>
              <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-slate-900">{routes.length}</span><span className="text-sm font-medium text-blue-600 bg-blue-50 px-1.5 rounded">{activeRoutesCount} khai thác</span></div>
           </div>
        </div>
      </div>

      <Tabs defaultValue="routes" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-0 bg-slate-50/95 backdrop-blur z-10 py-2">
          <TabsList className="bg-white border border-slate-200 p-1.5 rounded-xl h-auto shadow-sm">
            <TabsTrigger value="routes" className="px-6 py-2.5 rounded-lg text-sm font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"><MapPin size={18} className="mr-2"/> Quản lý Tuyến đường</TabsTrigger>
            <TabsTrigger value="buses" className="px-6 py-2.5 rounded-lg text-sm font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"><BusFront size={18} className="mr-2"/> Đội xe vận hành</TabsTrigger>
            <TabsTrigger value="system" className="px-6 py-2.5 rounded-lg text-sm font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"><ShieldCheck size={18} className="mr-2"/> Hệ thống</TabsTrigger>
          </TabsList>
          {activeTab !== 'system' && (
            <Button onClick={activeTab === 'routes' ? handleAddRoute : handleAddBus} className="shadow-lg shadow-primary/20 rounded-lg h-11 px-6 font-semibold"><Plus size={20} className="mr-2"/> {activeTab === 'routes' ? 'Thêm tuyến mới' : 'Thêm xe mới'}</Button>
          )}
        </div>

        <TabsContent value="routes" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {routes.map(route => {
              const isActive = route.status !== 'inactive';
              return (
                <div key={route.id} className={`group relative bg-white rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden ${isActive ? 'border-slate-200 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5' : 'border-slate-200 bg-slate-50/50 opacity-80'}`}>
                   <div className="p-5 flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <Badge variant={route.isEnhanced ? 'warning' : 'default'} className={route.isEnhanced ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'}>{route.isEnhanced ? <Zap size={10} className="mr-1 fill-amber-700"/> : null}{route.isEnhanced ? 'Tăng cường' : 'Cố định'}</Badge>
                           {!isActive && <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200"><AlertCircle size={10} className="mr-1"/> Đã ngưng</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/90 backdrop-blur p-1 rounded-lg border border-slate-100 shadow-sm">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-blue-50" onClick={() => handleEditRoute(route)}><Edit size={14}/></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-red-50" onClick={() => { setDeleteId(String(route.id)); setDeleteType('route'); }}><Trash2 size={14}/></Button>
                      </div>
                   </div>
                   <div className="px-5 pb-5">
                      <div className="flex items-center gap-3 mb-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-400'}`}><MapPin size={20} /></div><div className="flex-1 min-w-0"><h3 className={`font-bold text-lg truncate ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>{route.name}</h3><div className="flex items-center gap-2 text-xs text-slate-500"><span className="truncate max-w-[100px] font-medium">{route.origin}</span><ArrowRight size={12} className="text-slate-300"/><span className="truncate max-w-[100px] font-medium">{route.destination}</span></div></div></div>
                      <div className={`rounded-xl p-4 flex justify-between items-center ${isActive ? 'bg-slate-50 border border-slate-100' : 'bg-slate-100 border border-slate-200'}`}><div><div className="text-xs text-slate-500 mb-1">Giá niêm yết</div><div className="text-lg font-bold text-primary">{route.price?.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span></div></div><div className="text-right"><div className="text-xs text-slate-500 mb-1">Xuất bến</div><div className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><Clock size={14} className="text-slate-400"/> {route.departureTime || '--:--'}</div>{route.returnTime && <div className="text-[10px] text-slate-400 mt-0.5">Về: {route.returnTime}</div>}</div></div>
                   </div>
                </div>
              );
            })}
            <button onClick={handleAddRoute} className="group relative rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center min-h-[220px] text-slate-400 hover:text-primary gap-3"><div className="w-14 h-14 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center transition-colors"><Plus size={24} /></div><span className="font-semibold">Thêm tuyến mới</span></button>
          </div>
        </TabsContent>

        <TabsContent value="buses" className="space-y-4 focus-visible:outline-none">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider"><tr><th className="px-6 py-4">Thông tin xe</th><th className="px-6 py-4">Loại & Sức chứa</th><th className="px-6 py-4">Tuyến mặc định</th><th className="px-6 py-4">Liên hệ</th><th className="px-6 py-4">Trạng thái</th><th className="px-6 py-4 text-right">Thao tác</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                     {buses.map(bus => {
                        const defaultRoute = routes.find(r => r.id === bus.defaultRouteId);
                        const isCabin = bus.type === BusType.CABIN;
                        return (
                        <tr key={bus.id} className="group hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-bold border border-slate-200 shadow-sm"><BusFront size={20} /></div><div><div className="font-bold text-slate-900 text-base">{bus.plate}</div><div className="text-xs text-slate-400 font-mono">ID: {bus.id.slice(-6)}</div></div></div></td>
                           <td className="px-6 py-4"><div className="flex flex-col gap-1"><div className="flex items-center gap-2 font-medium text-slate-700">{isCabin ? <LayoutGrid size={16} className="text-indigo-500"/> : <LayoutGrid size={16} className="text-blue-500"/>}{isCabin ? 'Xe Phòng VIP' : 'Xe Giường Đơn'}</div><span className="text-xs text-slate-500 pl-6">{bus.seats} chỗ</span></div></td>
                           <td className="px-6 py-4">{defaultRoute ? <div className="flex items-center gap-2 max-w-[200px]"><Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 truncate">{defaultRoute.name}</Badge></div> : <span className="text-slate-400 text-xs italic pl-2">-- Chưa gán --</span>}</td>
                           <td className="px-6 py-4">{bus.phoneNumber ? <div className="flex items-center gap-2 text-slate-600"><Phone size={14} className="text-slate-400"/><span className="font-mono">{bus.phoneNumber}</span></div> : <span className="text-slate-400 text-xs">--</span>}</td>
                           <td className="px-6 py-4"><div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${bus.status === 'Hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : bus.status === 'Xe thuê/Tăng cường' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{bus.status === 'Hoạt động' && <CheckCircle2 size={12} className="mr-1.5"/>}{bus.status === 'Xe thuê/Tăng cường' && <Zap size={12} className="mr-1.5"/>}{bus.status === 'Ngưng hoạt động' && <AlertCircle size={12} className="mr-1.5"/>}{bus.status}</div></td>
                           <td className="px-6 py-4 text-right"><div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="sm" onClick={() => handleEditBus(bus)} className="hover:bg-blue-50 hover:text-blue-600"><Settings2 size={16} className="mr-2"/> Cấu hình</Button><Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive hover:bg-red-50" onClick={() => { setDeleteId(bus.id); setDeleteType('bus'); }}><Trash2 size={16}/></Button></div></td>
                        </tr>
                        );
                     })}
                  </tbody>
               </table>
             </div>
          </div>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-6 focus-visible:outline-none">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><div className="flex items-center gap-3 mb-6"><div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><BarChart3 size={20} /></div><h3 className="font-bold text-slate-900">Phân tích tài nguyên xe</h3></div><div className="space-y-4"><div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="flex items-center gap-3"><LayoutGrid size={16} className="text-indigo-500" /><span className="text-sm font-medium text-slate-700">Xe Phòng VIP (22)</span></div><Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">{detailedStats.cabinBuses} xe</Badge></div><div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="flex items-center gap-3"><LayoutGrid size={16} className="text-blue-500" /><span className="text-sm font-medium text-slate-700">Xe Giường đơn (41)</span></div><Badge className="bg-blue-100 text-blue-700 border-blue-200">{detailedStats.sleeperBuses} xe</Badge></div></div></div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><div className="flex items-center gap-3 mb-6"><div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Activity size={20} /></div><h3 className="font-bold text-slate-900">Trạng thái vận hành ghế</h3></div><div className="space-y-4"><div className="space-y-2"><div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Công suất VIP Room</span><span>{detailedStats.cabinOccupied} vé</span></div><div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (detailedStats.cabinOccupied / (detailedStats.cabinBuses * 28 || 1)) * 100)}%` }}></div></div></div><div className="space-y-2"><div className="flex justify-between text-xs font-bold text-slate-500 uppercase"><span>Công suất Giường đơn</span><span>{detailedStats.sleeperOccupied} vé</span></div><div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (detailedStats.sleeperOccupied / (detailedStats.sleeperBuses * 41 || 1)) * 100)}%` }}></div></div></div></div></div>
           </div>

           <div className="grid grid-cols-1 gap-6">
               {/* Seat Diagram Fix Tool */}
               <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                   <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50"><ShieldCheck size={20} className="text-primary" /><h3 className="font-bold text-slate-900">Công cụ bảo trì sơ đồ ghế</h3></div>
                   <div className="p-8">
                      <div className="flex flex-col md:flex-row items-start gap-8">
                          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${isFixingSeats ? 'bg-primary text-white scale-110 shadow-xl shadow-primary/20 ring-4 ring-primary/10' : 'bg-blue-50 text-blue-600'}`}><RefreshCw size={40} className={isFixingSeats ? "animate-spin" : ""} /></div>
                          <div className="flex-1">
                              <h4 className="text-xl font-black text-slate-900 mb-3">Quét & Khôi phục sơ đồ ghế (Ghost & Duplicate Seats Fix)</h4>
                              <p className="text-slate-500 mb-6 leading-relaxed max-w-3xl">
                                  Hệ thống thực hiện đối soát 3 chiều giữa <strong>Dòng tiền (Payments)</strong>, <strong>Đơn hàng (Bookings)</strong> và <strong>Sơ đồ ghế (Trips)</strong>. 
                                  Tự động phát hiện ghế bị trùng giữa 2 số điện thoại và giữ lại đơn có thanh toán cao hơn. Giải phóng các "ghế ma" không có đơn hàng thực tế.
                              </p>
                              <div className="flex flex-wrap gap-4 items-center">
                                <Button onClick={handleFixSeats} disabled={isFixingSeats} className="bg-blue-600 hover:bg-blue-700 h-12 px-8 font-bold text-base shadow-lg shadow-blue-500/20">{isFixingSeats ? <><Loader2 className="animate-spin mr-2" size={18} />Đang đối soát dữ liệu...</> : 'Bắt đầu quét & sửa lỗi'}</Button>
                              </div>
                          </div>
                      </div>

                      {maintenanceResults && (
                        <div className="mt-10 animate-in slide-in-from-bottom-4 duration-500">
                          <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                               <div className="flex items-center gap-3">
                                  <div className="p-2 bg-green-50 rounded-lg text-green-600"><CheckCircle2 size={20}/></div>
                                  <h5 className="font-bold text-slate-800">Kết quả bảo trì sơ đồ</h5>
                               </div>
                               <div className="flex gap-2 flex-wrap">
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold px-2.5 py-1">Đã sửa: {maintenanceResults.counts.fixed}</Badge>
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-2.5 py-1">Đồng bộ: {maintenanceResults.counts.sync}</Badge>
                                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold px-2.5 py-1">Xung đột: {maintenanceResults.counts.conflict}</Badge>
                               </div>
                            </div>
                            
                            <div className="max-h-[300px] overflow-y-auto">
                              {maintenanceResults.logs.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 italic font-medium">Không phát hiện sai lệch sơ đồ ghế nào.</div>
                              ) : (
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-slate-100/50 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 border-b border-slate-200">
                                    <tr><th className="px-6 py-3">Ghế & Lịch trình</th><th className="px-6 py-3">Loại sửa đổi</th><th className="px-6 py-3">Chi tiết xử lý</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {maintenanceResults.logs.map((log, idx) => (
                                      <tr key={idx} className="hover:bg-white transition-colors bg-slate-50/30">
                                        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-primary shadow-sm">{log.seat}</div><div className="flex flex-col"><span className="font-bold text-slate-900">{log.route}</span><div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold mt-0.5"><Calendar size={10}/> {log.date}</div></div></div></td>
                                        <td className="px-6 py-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border ${log.action.includes('Trống') || log.action.includes('ma') ? 'bg-blue-50 text-blue-700 border-blue-200' : log.action.includes('màu') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{log.action}</span></td>
                                        <td className="px-6 py-4"><p className="text-xs text-slate-600 font-medium italic leading-relaxed">{log.details}</p></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                   </div>
               </div>

               {/* Payment Cleanup Tool */}
               <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                   <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50"><CircleDollarSign size={20} className="text-emerald-600" /><h3 className="font-bold text-slate-900">Công cụ bảo trì dòng tiền</h3></div>
                   <div className="p-8">
                      <div className="flex flex-col md:flex-row items-start gap-8">
                          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${isFixingPayments ? 'bg-emerald-600 text-white scale-110 shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/10' : 'bg-emerald-50 text-emerald-600'}`}><WalletCards size={40} className={isFixingPayments ? "animate-bounce" : ""} /></div>
                          <div className="flex-1">
                              <h4 className="text-xl font-black text-slate-900 mb-3">Dọn dẹp giao dịch không hợp lệ (Payment Cleanup)</h4>
                              <p className="text-slate-500 mb-6 leading-relaxed max-w-3xl">
                                  Tự động lọc và xóa bỏ các bản ghi thanh toán (Payment) liên quan đến đơn hàng đang ở trạng thái <strong>Hold (Giữ vé)</strong>. 
                                  Theo quy tắc hệ thống, đơn giữ vé không được phép có giao dịch thanh toán để tránh sai lệch báo cáo doanh thu thực tế.
                              </p>
                              <div className="flex flex-wrap gap-4 items-center">
                                <Button onClick={handleFixPayments} disabled={isFixingPayments} className="bg-emerald-600 hover:bg-emerald-700 h-12 px-8 font-bold text-base shadow-lg shadow-emerald-500/20">{isFixingPayments ? <><Loader2 className="animate-spin mr-2" size={18} />Đang quét thanh toán...</> : 'Bắt đầu dọn dẹp dòng tiền'}</Button>
                              </div>
                          </div>
                      </div>

                      {paymentMaintenanceResults && (
                        <div className="mt-10 animate-in slide-in-from-bottom-4 duration-500">
                          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 overflow-hidden">
                            <div className="p-5 border-b border-emerald-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                               <div className="flex items-center gap-3">
                                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle2 size={20}/></div>
                                  <h5 className="font-bold text-slate-800">Kết quả bảo trì dòng tiền</h5>
                               </div>
                               <div>
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold px-3 py-1.5">Tổng giao dịch đã xóa: {paymentMaintenanceResults.deletedCount}</Badge>
                               </div>
                            </div>
                            
                            <div className="max-h-[300px] overflow-y-auto">
                              {paymentMaintenanceResults.logs.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 italic font-medium">Hệ thống tài chính sạch. Không tìm thấy thanh toán lỗi nào.</div>
                              ) : (
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-emerald-100/50 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 border-b border-emerald-200">
                                    <tr><th className="px-6 py-3">Lịch trình & Ghế</th><th className="px-6 py-3">Phân loại</th><th className="px-6 py-3">Lý do xử lý</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-emerald-200/50">
                                    {paymentMaintenanceResults.logs.map((log, idx) => (
                                      <tr key={idx} className="hover:bg-white transition-colors bg-white/40">
                                        <td className="px-6 py-4"><div className="flex flex-col"><span className="font-bold text-slate-900">{log.route}</span><div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold mt-0.5"><Badge variant="outline" className="text-[9px] px-1 h-4 border-slate-200">{log.seat || 'Không rõ ghế'}</Badge><span className="mx-1">•</span>{log.date}</div></div></td>
                                        <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border bg-red-50 text-red-700 border-red-200">{log.action}</span></td>
                                        <td className="px-6 py-4"><p className="text-xs text-slate-600 font-medium italic leading-relaxed">{log.details}</p></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                   </div>
               </div>
           </div>
        </TabsContent>
      </Tabs>

      <ManagerRouteModal isOpen={isRouteModalOpen} onClose={() => setIsRouteModalOpen(false)} onSave={handleSaveRoute} initialData={editingRoute}/>
      <ManagerCarModal isOpen={isBusModalOpen} onClose={() => setIsBusModalOpen(false)} onSave={handleSaveBus} initialData={editingBus} routes={routes}/>
      <Dialog isOpen={!!deleteId} onClose={() => { setDeleteId(null); setDeleteType(null); }} title="Xác nhận xóa"><div className="p-6 text-center"><div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 animate-in zoom-in duration-300"><AlertTriangle size={32} className="text-red-500"/></div><h3 className="text-xl font-bold text-slate-900 mb-2">Xóa {deleteType === 'route' ? 'tuyến đường' : 'xe'} này?</h3><p className="text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">Hành động này sẽ xóa dữ liệu khỏi hệ thống và không thể hoàn tác.</p><div className="flex justify-center gap-3"><Button variant="outline" className="min-w-[100px]" onClick={() => { setDeleteId(null); setDeleteType(null); }}>Hủy bỏ</Button><Button variant="destructive" className="min-w-[100px]" onClick={deleteType === 'route' ? handleDeleteRoute : handleDeleteBus}>Xóa ngay</Button></div></div></Dialog>
    </div>
  );
};
