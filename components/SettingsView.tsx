import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Dialog } from './ui/Dialog';
import { Plus, Edit2, Trash2, MapPin, BusFront, AlertTriangle } from 'lucide-react';
import { Route, Bus, BusTrip, BusType, SeatStatus } from '../types';
import { generateCabinLayout, generateSleeperLayout } from '../utils/generators';
import { ManagerCarModal } from './ManagerCarModal';
import { api } from '../lib/api';

interface SettingsViewProps {
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  buses: Bus[];
  setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
  trips: BusTrip[];
  setTrips: React.Dispatch<React.SetStateAction<BusTrip[]>>;
  onDataChange: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  routes, buses, trips, onDataChange 
}) => {
  // Modal State for Add/Edit
  const [activeModal, setActiveModal] = useState<'route' | 'trip' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // New Manager Car Modal State
  const [isCarManagerOpen, setIsCarManagerOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);

  // Modal State for Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'route' | 'bus' | 'trip', id: string | number } | null>(null);

  // --- HANDLERS FOR ROUTES ---
  const handleSaveRoute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const routeData: Partial<Route> = {
      name: formData.get('name') as string,
      distance: formData.get('distance') as string,
      duration: formData.get('duration') as string,
      stops: Number(formData.get('stops')),
    };

    try {
      if (editingItem) {
        await api.routes.update(editingItem.id, routeData);
      } else {
        await api.routes.create({
          id: `ROUTE-${Date.now()}`, 
          ...routeData as Route
        });
      }
      onDataChange();
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  const requestDeleteRoute = (id: number | string) => {
    setDeleteTarget({ type: 'route', id });
  };

  // --- HANDLERS FOR BUSES (USING NEW MODAL) ---
  const handleOpenBusModal = (bus?: Bus) => {
    setEditingBus(bus || null);
    setIsCarManagerOpen(true);
  };

  const handleSaveBus = async (newBus: Bus) => {
    try {
      if (editingBus) {
        await api.buses.update(newBus.id, newBus);
      } else {
        await api.buses.create(newBus);
      }
      onDataChange();
    } catch (e) {
      console.error(e);
    }
  };

  const requestDeleteBus = (id: string) => {
    setDeleteTarget({ type: 'bus', id });
  };

  // --- HANDLERS FOR TRIPS (SCHEDULES) ---
  const handleSaveTrip = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const busId = formData.get('busId') as string;
    // Important: Find the bus in the *latest* props
    const selectedBus = buses.find(b => b.id === busId);
    if (!selectedBus) return;

    const basePrice = Number(formData.get('basePrice'));
    
    // Generate seats based on Bus Layout Config if available
    let seats = [];
    if (selectedBus.layoutConfig) {
      const config = selectedBus.layoutConfig;
      
      // 1. Generate Main Grid Seats
      for(let f=1; f<=config.floors; f++) {
        for(let r=0; r<config.rows; r++) {
          for(let c=0; c<config.cols; c++) {
            const key = `${f}-${r}-${c}`;
            if (config.activeSeats.includes(key)) {
              // Use custom label if exists, else fallback
              let label = config.seatLabels?.[key];
              
              if (!label) {
                 if (selectedBus.type === BusType.CABIN) {
                    const prefix = String.fromCharCode(65 + c); 
                    const num = (r * 2) + f;
                    label = `${prefix}${num}`;
                 } else {
                    const seatsPerRow = config.cols * config.floors;
                    const val = (r * seatsPerRow) + ((f - 1) * config.cols) + c + 1;
                    label = val.toString();
                 }
              }

              seats.push({
                id: label,
                label: label,
                floor: f as 1 | 2,
                status: SeatStatus.AVAILABLE,
                price: basePrice,
                row: r,
                col: c
              });
            }
          }
        }
      }

      // 2. Generate Rear Bench Seats
      if (config.hasRearBench) {
         for(let f=1; f<=config.floors; f++) {
           for(let i=0; i<5; i++) {
             const key = `${f}-bench-${i}`;
             if (config.activeSeats.includes(key)) {
                let label = config.seatLabels?.[key];
                if (!label) {
                  const prefix = f === 1 ? 'A' : 'B'; 
                  label = selectedBus.type === BusType.CABIN ? `${prefix}-G${i+1}` : `B${f}-${i+1}`;
                }
                
                seats.push({
                  id: label,
                  label: label,
                  floor: f as 1 | 2,
                  status: SeatStatus.AVAILABLE,
                  price: basePrice,
                  row: config.rows, 
                  col: i 
                });
             }
           }
         }
      }

    } else {
      // Fallback to legacy generators
      seats = editingItem 
      ? editingItem.seats 
      : selectedBus.type === BusType.CABIN 
        ? generateCabinLayout(basePrice) 
        : generateSleeperLayout(basePrice);
    }
    
    // Create new trip object
    const newTripData: Partial<BusTrip> = {
      name: formData.get('name') as string,
      route: formData.get('route') as string,
      departureTime: formData.get('departureTime') as string,
      type: selectedBus.type,
      licensePlate: selectedBus.plate,
      driver: formData.get('driver') as string,
      basePrice: basePrice,
      seats: seats,
    };

    try {
      if (editingItem) {
        // Caution: In a real app, editing a trip might require complex seat merging if layout changed.
        // For now, we update basic details but keep existing seats unless user explicitly wants reset.
        // To simplify, we'll just update info, NOT reset seats if it's an edit, to preserve bookings.
        // If you want to force layout update, you'd delete and recreate or add a "Reset Layout" button.
        await api.trips.update(editingItem.id, {
            ...newTripData,
            seats: editingItem.seats // PRESERVE SEATS ON EDIT to avoid losing bookings
        });
      } else {
        await api.trips.create({
          id: `TRIP-${Date.now()}`,
          ...newTripData as BusTrip
        });
      }
      onDataChange();
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  const requestDeleteTrip = (id: string) => {
    setDeleteTarget({ type: 'trip', id });
  };

  // --- GENERAL HANDLERS ---
  const openModal = (type: 'route' | 'trip', item: any = null) => {
    setEditingItem(item);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setEditingItem(null);
    setIsCarManagerOpen(false);
    setEditingBus(null);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;

    try {
      if (type === 'route') {
        await api.routes.delete(id);
      } else if (type === 'bus') {
        await api.buses.delete(id as string);
      } else if (type === 'trip') {
        await api.trips.delete(id as string);
      }
      onDataChange();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <Tabs defaultValue="routes" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-8">
            <TabsTrigger value="routes">Quản lý tuyến</TabsTrigger>
            <TabsTrigger value="buses">Quản lý xe</TabsTrigger>
          </TabsList>

          {/* TAB 1: QUẢN LÝ TUYẾN */}
          <TabsContent value="routes">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="text-primary" size={20} /> Danh sách tuyến đường
              </h3>
              <Button size="sm" onClick={() => openModal('route')}><Plus size={16} className="mr-1"/> Thêm tuyến mới</Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Tên tuyến</th>
                    <th className="px-4 py-3">Khoảng cách</th>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Điểm dừng</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routes.map((route) => (
                    <tr key={route.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{route.name}</td>
                      <td className="px-4 py-3 text-slate-500">{route.distance}</td>
                      <td className="px-4 py-3 text-slate-500">{route.duration}</td>
                      <td className="px-4 py-3 text-slate-500">{route.stops} trạm</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openModal('route', route)} className="h-8 w-8 text-slate-500 hover:text-primary"><Edit2 size={14}/></Button>
                          <Button variant="ghost" size="icon" onClick={() => requestDeleteRoute(route.id)} className="h-8 w-8 text-slate-500 hover:text-destructive"><Trash2 size={14}/></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 2: QUẢN LÝ XE */}
          <TabsContent value="buses">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BusFront className="text-primary" size={20} /> Danh sách phương tiện
              </h3>
              <Button size="sm" onClick={() => handleOpenBusModal()}><Plus size={16} className="mr-1"/> Thêm xe mới</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {buses.map((bus) => (
                <div key={bus.id} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow flex flex-col">
                  
                  {/* Bus Info Section */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-lg text-slate-900">{bus.plate}</h4>
                        <p className="text-xs text-slate-500">{bus.id}</p>
                      </div>
                      <Badge variant={bus.status === 'Hoạt động' ? 'success' : 'warning'}>{bus.status}</Badge>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      <div className="flex justify-between">
                        <span>Loại xe:</span>
                        <span className="font-medium">{bus.type === BusType.CABIN ? 'Xe Phòng' : 'Xe Giường Đơn'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Số ghế:</span>
                        <span className="font-medium">{bus.seats}</span>
                      </div>
                    </div>
                    {bus.layoutConfig && (
                      <div className="mt-2 text-xs text-slate-400 bg-slate-50 p-2 rounded">
                        Sơ đồ: {bus.layoutConfig.floors} tầng, {bus.layoutConfig.rows}x{bus.layoutConfig.cols}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Section */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-slate-200 text-slate-700 hover:text-primary hover:border-primary hover:bg-primary/5"
                      onClick={() => handleOpenBusModal(bus)}
                    >
                      <Edit2 size={16} className="mr-2"/> Sửa
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200"
                      onClick={() => requestDeleteBus(bus.id)}
                    >
                      <Trash2 size={16} className="mr-2"/> Xóa
                    </Button>
                  </div>

                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- DIALOGS --- */}

      {/* NEW MANAGER CAR MODAL */}
      <ManagerCarModal 
        isOpen={isCarManagerOpen}
        onClose={closeModal}
        onSave={handleSaveBus}
        initialData={editingBus}
      />

      {/* CONFIRM DELETE DIALOG */}
      <Dialog 
        isOpen={!!deleteTarget} 
        onClose={() => setDeleteTarget(null)} 
        title="Xác nhận xóa"
      >
        <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
           <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
             <AlertTriangle size={24} />
           </div>
           <div>
             <h3 className="text-lg font-medium text-slate-900">Bạn có chắc chắn muốn xóa?</h3>
             <p className="text-sm text-slate-500 mt-1">
               Hành động này không thể hoàn tác. Dữ liệu liên quan có thể bị ảnh hưởng.
             </p>
           </div>
           <div className="flex gap-3 w-full mt-4">
             <Button variant="outline" className="w-full" onClick={() => setDeleteTarget(null)}>Hủy bỏ</Button>
             <Button variant="destructive" className="w-full" onClick={executeDelete}>Xóa ngay</Button>
           </div>
        </div>
      </Dialog>

      {/* ROUTE DIALOG */}
      <Dialog 
        isOpen={activeModal === 'route'} 
        onClose={closeModal} 
        title={editingItem ? 'Cập nhật tuyến' : 'Thêm tuyến mới'}
      >
        <form id="route-form" onSubmit={handleSaveRoute} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên tuyến *</label>
            <input name="name" defaultValue={editingItem?.name} required placeholder="Ví dụ: Hà Nội - Sapa" className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900" />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Khoảng cách</label>
               <input name="distance" defaultValue={editingItem?.distance} placeholder="300km" className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900" />
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian</label>
               <input name="duration" defaultValue={editingItem?.duration} placeholder="5h30" className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900" />
             </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Số điểm dừng</label>
            <input type="number" name="stops" defaultValue={editingItem?.stops || 0} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900" />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>Hủy</Button>
            <Button type="submit">Lưu lại</Button>
          </div>
        </form>
      </Dialog>

      {/* TRIP DIALOG */}
      <Dialog 
        isOpen={activeModal === 'trip'} 
        onClose={closeModal} 
        title={editingItem ? 'Cập nhật lịch trình' : 'Tạo lịch chạy mới'}
      >
        <form id="trip-form" onSubmit={handleSaveTrip} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tên chuyến</label>
            <input name="name" defaultValue={editingItem?.name} required placeholder="Chuyến Sáng..." className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tuyến đường</label>
            <select name="route" defaultValue={editingItem?.route} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900">
              {routes.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian khởi hành</label>
             {/* Simple text input for demo, real app uses datetime picker */}
             <input type="text" name="departureTime" defaultValue={editingItem?.departureTime || '2023-10-27 08:00'} placeholder="YYYY-MM-DD HH:MM" className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900" />
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Chọn xe</label>
             <select name="busId" defaultValue={buses.find(b => b.plate === editingItem?.licensePlate)?.id} className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900">
                {buses.filter(b => b.status === 'Hoạt động').map(b => (
                  <option key={b.id} value={b.id}>{b.plate} ({b.type === BusType.CABIN ? '22P' : '41G'})</option>
                ))}
             </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tài xế</label>
            <input name="driver" defaultValue={editingItem?.driver} placeholder="Tên tài xế" className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Giá vé cơ bản (VNĐ)</label>
            <input type="number" name="basePrice" defaultValue={editingItem?.basePrice} required placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-primary/20 outline-none bg-white text-slate-900" />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>Hủy</Button>
            <Button type="submit">Lưu lại</Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
};