import React, { useState } from 'react';
import { Route, Bus, BusTrip, BusType } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { 
  Plus, Edit, Trash2, MapPin, BusFront, Settings2, 
  ArrowRight, Clock, Zap, AlertCircle, CheckCircle2, 
  MoreHorizontal, Phone, LayoutGrid, AlertTriangle
} from 'lucide-react';
import { ManagerRouteModal } from './ManagerRouteModal';
import { ManagerCarModal } from './ManagerCarModal';
import { api } from '../lib/api';
import { Dialog } from './ui/Dialog';

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
  onDataChange 
}) => {
  const [activeTab, setActiveTab] = useState('routes');
  
  // Modal States
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  
  const [isBusModalOpen, setIsBusModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);

  // Delete Confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'route' | 'bus' | null>(null);

  // Stats
  const activeBusesCount = buses.filter(b => b.status === 'Hoạt động').length;
  const activeRoutesCount = routes.filter(r => r.status !== 'inactive').length;

  // Handlers for Routes
  const handleAddRoute = () => {
    setEditingRoute(null);
    setIsRouteModalOpen(true);
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setIsRouteModalOpen(true);
  };

  const handleSaveRoute = async (routeData: Route) => {
    try {
      if (editingRoute) {
        await api.routes.update(editingRoute.id, routeData);
      } else {
        await api.routes.create(routeData);
      }
      await onDataChange();
    } catch (error) {
      console.error("Save route failed", error);
    }
  };

  const handleDeleteRoute = async () => {
    if (!deleteId) return;
    try {
      await api.routes.delete(deleteId);
      await onDataChange();
      setDeleteId(null);
      setDeleteType(null);
    } catch (error) {
      console.error("Delete route failed", error);
    }
  };

  // Handlers for Buses
  const handleAddBus = () => {
    setEditingBus(null);
    setIsBusModalOpen(true);
  };

  const handleEditBus = (bus: Bus) => {
    setEditingBus(bus);
    setIsBusModalOpen(true);
  };

  const handleSaveBus = async (busData: Bus) => {
    try {
      if (editingBus) {
        await api.buses.update(editingBus.id, busData);
      } else {
        await api.buses.create(busData);
      }
      await onDataChange();
    } catch (error) {
      console.error("Save bus failed", error);
    }
  };

  const handleDeleteBus = async () => {
    if (!deleteId) return;
    try {
      await api.buses.delete(deleteId);
      await onDataChange();
      setDeleteId(null);
      setDeleteType(null);
    } catch (error) {
      console.error("Delete bus failed", error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Cấu hình hệ thống</h2>
           <p className="text-slate-500 mt-2 text-lg">Quản lý tài nguyên vận hành và mạng lưới tuyến đường.</p>
        </div>
        
        <div className="flex gap-4">
           <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-col min-w-[140px]">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Tổng số xe</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{buses.length}</span>
                <span className="text-sm font-medium text-green-600 bg-green-50 px-1.5 rounded">{activeBusesCount} hoạt động</span>
              </div>
           </div>
           <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-col min-w-[140px]">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Tổng tuyến</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{routes.length}</span>
                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-1.5 rounded">{activeRoutesCount} khai thác</span>
              </div>
           </div>
        </div>
      </div>

      <Tabs defaultValue="routes" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-0 bg-slate-50/95 backdrop-blur z-10 py-2">
          <TabsList className="bg-white border border-slate-200 p-1.5 rounded-xl h-auto shadow-sm">
            <TabsTrigger 
              value="routes" 
              className="px-6 py-2.5 rounded-lg text-sm font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"
            >
              <MapPin size={18} className="mr-2"/> Quản lý Tuyến đường
            </TabsTrigger>
            <TabsTrigger 
              value="buses" 
              className="px-6 py-2.5 rounded-lg text-sm font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"
            >
              <BusFront size={18} className="mr-2"/> Đội xe vận hành
            </TabsTrigger>
          </TabsList>

          <Button 
            onClick={activeTab === 'routes' ? handleAddRoute : handleAddBus} 
            className="shadow-lg shadow-primary/20 rounded-lg h-11 px-6 font-semibold"
          >
             <Plus size={20} className="mr-2"/> 
             {activeTab === 'routes' ? 'Thêm tuyến mới' : 'Thêm xe mới'}
          </Button>
        </div>

        {/* ROUTES CONTENT */}
        <TabsContent value="routes" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {routes.map(route => {
              const isActive = route.status !== 'inactive';
              return (
                <div 
                  key={route.id} 
                  className={`
                    group relative bg-white rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden
                    ${isActive 
                      ? 'border-slate-200 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5' 
                      : 'border-slate-200 bg-slate-50/50 opacity-80'
                    }
                  `}
                >
                   {/* Card Header */}
                   <div className="p-5 flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <Badge variant={route.isEnhanced ? 'warning' : 'default'} className={route.isEnhanced ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'}>
                             {route.isEnhanced ? <Zap size={10} className="mr-1 fill-amber-700"/> : null}
                             {route.isEnhanced ? 'Tăng cường' : 'Cố định'}
                           </Badge>
                           {!isActive && (
                              <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                                <AlertCircle size={10} className="mr-1"/> Đã ngưng
                              </Badge>
                           )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/90 backdrop-blur p-1 rounded-lg border border-slate-100 shadow-sm">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-blue-50" onClick={() => handleEditRoute(route)}>
                             <Edit size={14}/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-red-50" onClick={() => { setDeleteId(String(route.id)); setDeleteType('route'); }}>
                             <Trash2 size={14}/>
                          </Button>
                      </div>
                   </div>
                   
                   {/* Card Body */}
                   <div className="px-5 pb-5">
                      <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-400'}`}>
                              <MapPin size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                              <h3 className={`font-bold text-lg truncate ${isActive ? 'text-slate-900' : 'text-slate-500'}`} title={route.name}>{route.name}</h3>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                 <span className="truncate max-w-[100px] font-medium">{route.origin}</span>
                                 <ArrowRight size={12} className="text-slate-300"/>
                                 <span className="truncate max-w-[100px] font-medium">{route.destination}</span>
                              </div>
                          </div>
                      </div>

                      <div className={`rounded-xl p-4 flex justify-between items-center ${isActive ? 'bg-slate-50 border border-slate-100' : 'bg-slate-100 border border-slate-200'}`}>
                          <div>
                             <div className="text-xs text-slate-500 mb-1">Giá niêm yết</div>
                             <div className="text-lg font-bold text-primary">
                                {route.price?.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span>
                             </div>
                          </div>
                          <div className="text-right">
                             <div className="text-xs text-slate-500 mb-1">Xuất bến</div>
                             <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                                <Clock size={14} className="text-slate-400"/> {route.departureTime || '--:--'}
                             </div>
                             {route.returnTime && (
                                <div className="text-[10px] text-slate-400 mt-0.5">Về: {route.returnTime}</div>
                             )}
                          </div>
                      </div>
                   </div>
                </div>
              );
            })}
            
            {/* Add New Route Card Placeholder */}
            <button 
               onClick={handleAddRoute}
               className="group relative rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center min-h-[220px] text-slate-400 hover:text-primary gap-3"
            >
               <div className="w-14 h-14 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center transition-colors">
                  <Plus size={24} />
               </div>
               <span className="font-semibold">Thêm tuyến mới</span>
            </button>
          </div>
        </TabsContent>

        {/* BUSES CONTENT */}
        <TabsContent value="buses" className="space-y-4 focus-visible:outline-none">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                     <tr>
                        <th className="px-6 py-4">Thông tin xe</th>
                        <th className="px-6 py-4">Loại & Sức chứa</th>
                        <th className="px-6 py-4">Tuyến mặc định</th>
                        <th className="px-6 py-4">Liên hệ</th>
                        <th className="px-6 py-4">Trạng thái</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {buses.map(bus => {
                        const defaultRoute = routes.find(r => r.id === bus.defaultRouteId);
                        const isCabin = bus.type === BusType.CABIN;
                        
                        return (
                        <tr key={bus.id} className="group hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-bold border border-slate-200 shadow-sm">
                                    <BusFront size={20} />
                                 </div>
                                 <div>
                                    <div className="font-bold text-slate-900 text-base">{bus.plate}</div>
                                    <div className="text-xs text-slate-400 font-mono">ID: {bus.id.slice(-6)}</div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2 font-medium text-slate-700">
                                    {isCabin ? <LayoutGrid size={16} className="text-indigo-500"/> : <LayoutGrid size={16} className="text-blue-500"/>}
                                    {isCabin ? 'Xe Phòng VIP' : 'Xe Giường Đơn'}
                                 </div>
                                 <span className="text-xs text-slate-500 pl-6">{bus.seats} chỗ</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              {defaultRoute ? (
                                <div className="flex items-center gap-2 max-w-[200px]">
                                   <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 truncate">
                                      {defaultRoute.name}
                                   </Badge>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic pl-2">-- Chưa gán --</span>
                              )}
                           </td>
                           <td className="px-6 py-4">
                              {bus.phoneNumber ? (
                                <div className="flex items-center gap-2 text-slate-600">
                                   <Phone size={14} className="text-slate-400"/>
                                   <span className="font-mono">{bus.phoneNumber}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">--</span>
                              )}
                           </td>
                           <td className="px-6 py-4">
                              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                                 bus.status === 'Hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : 
                                 bus.status === 'Xe thuê/Tăng cường' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                 {bus.status === 'Hoạt động' && <CheckCircle2 size={12} className="mr-1.5"/>}
                                 {bus.status === 'Xe thuê/Tăng cường' && <Zap size={12} className="mr-1.5"/>}
                                 {bus.status === 'Ngưng hoạt động' && <AlertCircle size={12} className="mr-1.5"/>}
                                 {bus.status}
                              </div>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                 <Button variant="ghost" size="sm" onClick={() => handleEditBus(bus)} className="hover:bg-blue-50 hover:text-blue-600">
                                    <Settings2 size={16} className="mr-2"/> Cấu hình
                                 </Button>
                                 <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive hover:bg-red-50" onClick={() => { setDeleteId(bus.id); setDeleteType('bus'); }}>
                                    <Trash2 size={16}/>
                                 </Button>
                              </div>
                           </td>
                        </tr>
                        );
                     })}
                     {buses.length === 0 && (
                        <tr>
                           <td colSpan={6} className="py-16 text-center text-slate-400 bg-slate-50/30">
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                  <BusFront size={32} className="opacity-20"/>
                                </div>
                                <p className="text-sm font-medium">Chưa có xe nào trong hệ thống.</p>
                                <Button variant="outline" size="sm" onClick={handleAddBus}>Thêm xe ngay</Button>
                              </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
             </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ManagerRouteModal 
        isOpen={isRouteModalOpen} 
        onClose={() => setIsRouteModalOpen(false)} 
        onSave={handleSaveRoute}
        initialData={editingRoute}
      />
      
      <ManagerCarModal 
        isOpen={isBusModalOpen} 
        onClose={() => setIsBusModalOpen(false)} 
        onSave={handleSaveBus}
        initialData={editingBus}
        routes={routes}
      />

      {/* Delete Confirmation */}
      <Dialog 
        isOpen={!!deleteId} 
        onClose={() => { setDeleteId(null); setDeleteType(null); }}
        title="Xác nhận xóa"
      >
        <div className="p-6 text-center">
           <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 animate-in zoom-in duration-300">
              <AlertTriangle size={32} className="text-red-500"/>
           </div>
           <h3 className="text-xl font-bold text-slate-900 mb-2">
              Xóa {deleteType === 'route' ? 'tuyến đường' : 'xe'} này?
           </h3>
           <p className="text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
             Hành động này sẽ xóa dữ liệu khỏi hệ thống và không thể hoàn tác. Vui lòng kiểm tra kỹ trước khi tiếp tục.
           </p>
           
           <div className="flex justify-center gap-3">
              <Button variant="outline" className="min-w-[100px]" onClick={() => { setDeleteId(null); setDeleteType(null); }}>Hủy bỏ</Button>
              <Button variant="destructive" className="min-w-[100px]" onClick={deleteType === 'route' ? handleDeleteRoute : handleDeleteBus}>Xóa ngay</Button>
           </div>
        </div>
      </Dialog>
    </div>
  );
};