import React, { useState } from 'react';
import { Route, Bus, BusTrip } from '../types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { Button } from './ui/Button';
import { Plus, Edit, Trash2, MapPin, BusFront, Settings2 } from 'lucide-react';
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
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900">Cấu hình hệ thống</h2>
           <p className="text-slate-500">Quản lý danh sách tuyến đường và đội xe.</p>
        </div>
      </div>

      <Tabs defaultValue="routes" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-lg">
          <TabsTrigger value="routes" className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-medium">
            <MapPin size={16} className="mr-2"/> Tuyến đường ({routes.length})
          </TabsTrigger>
          <TabsTrigger value="buses" className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-medium">
            <BusFront size={16} className="mr-2"/> Đội xe ({buses.length})
          </TabsTrigger>
        </TabsList>

        {/* ROUTES CONTENT */}
        <TabsContent value="routes" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleAddRoute} className="shadow-sm">
               <Plus size={18} className="mr-1"/> Thêm tuyến mới
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routes.map(route => (
              <div key={route.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-primary/50 transition-colors group">
                 <div className="flex justify-between items-start mb-3">
                    <div className={`px-2 py-1 rounded text-xs uppercase tracking-wide font-bold ${route.isEnhanced ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                      {route.isEnhanced ? 'Tăng cường' : 'Cố định'}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => handleEditRoute(route)}>
                           <Edit size={14}/>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => { setDeleteId(String(route.id)); setDeleteType('route'); }}>
                           <Trash2 size={14}/>
                        </Button>
                    </div>
                 </div>
                 
                 <h3 className="font-bold text-lg text-slate-900 mb-1 truncate" title={route.name}>{route.name}</h3>
                 <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                    <span className="truncate max-w-[40%]">{route.origin}</span>
                    <span className="text-slate-300">→</span>
                    <span className="truncate max-w-[40%]">{route.destination}</span>
                 </div>

                 <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="text-xs text-slate-500">
                       Giá vé: <span className="font-bold text-slate-700 text-sm">{route.price?.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                       {route.departureTime} / {route.returnTime}
                    </div>
                 </div>
              </div>
            ))}
            {routes.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                   <MapPin size={48} className="mx-auto mb-2 opacity-20"/>
                   <p>Chưa có tuyến đường nào.</p>
                </div>
            )}
          </div>
        </TabsContent>

        {/* BUSES CONTENT */}
        <TabsContent value="buses" className="space-y-4">
           <div className="flex justify-end">
            <Button onClick={handleAddBus} className="shadow-sm">
               <Plus size={18} className="mr-1"/> Thêm xe mới
            </Button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                     <tr>
                        <th className="px-6 py-4">Biển số</th>
                        <th className="px-6 py-4">Loại xe</th>
                        <th className="px-6 py-4">Số ghế</th>
                        <th className="px-6 py-4">Điện thoại</th>
                        <th className="px-6 py-4">Trạng thái</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {buses.map(bus => (
                        <tr key={bus.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4 font-bold text-slate-900">{bus.plate}</td>
                           <td className="px-6 py-4 text-slate-600">
                              {bus.type === 'CABIN' ? 'Xe Phòng' : 'Giường nằm'}
                           </td>
                           <td className="px-6 py-4 text-slate-600">{bus.seats} chỗ</td>
                           <td className="px-6 py-4 text-slate-500 font-mono">{bus.phoneNumber || '--'}</td>
                           <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium 
                                ${bus.status === 'Hoạt động' ? 'bg-green-100 text-green-700' : 
                                  bus.status === 'Xe thuê/Tăng cường' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                 {bus.status}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                 <Button variant="outline" size="sm" onClick={() => handleEditBus(bus)}>
                                    <Settings2 size={14} className="mr-1"/> Cấu hình
                                 </Button>
                                 <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive" onClick={() => { setDeleteId(bus.id); setDeleteType('bus'); }}>
                                    <Trash2 size={16}/>
                                 </Button>
                              </div>
                           </td>
                        </tr>
                     ))}
                     {buses.length === 0 && (
                        <tr>
                           <td colSpan={6} className="py-12 text-center text-slate-400">
                              <BusFront size={48} className="mx-auto mb-2 opacity-20"/>
                              <p>Chưa có xe nào trong hệ thống.</p>
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
           <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <Trash2 size={24}/>
           </div>
           <h3 className="text-lg font-bold text-slate-900 mb-2">
              Bạn có chắc chắn muốn xóa {deleteType === 'route' ? 'tuyến đường' : 'xe'} này?
           </h3>
           <p className="text-slate-500 mb-6">Hành động này không thể hoàn tác.</p>
           
           <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteType(null); }}>Hủy bỏ</Button>
              <Button variant="destructive" onClick={deleteType === 'route' ? handleDeleteRoute : handleDeleteBus}>Xóa ngay</Button>
           </div>
        </div>
      </Dialog>
    </div>
  );
};