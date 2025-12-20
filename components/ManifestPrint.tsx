
import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./ui/Button";
import { BusTrip, Booking, BusType, Seat, SeatStatus } from "../types";
import { formatLunarDate } from "../utils/dateUtils";
import { useToast } from "./ui/Toast";

interface ManifestPrintProps {
  selectedTrip: BusTrip | null;
  manifest: Booking[];
  disabled?: boolean;
}

export const ManifestPrint: React.FC<ManifestPrintProps> = ({
  selectedTrip,
  manifest,
  disabled = false,
}) => {
  const { toast } = useToast();

  const handlePrint = () => {
    if (!selectedTrip) return;

    const manifestWindow = window.open("", "_blank");
    if (!manifestWindow) {
      toast({
        type: "error",
        title: "Lỗi trình duyệt",
        message: "Vui lòng cho phép trình duyệt mở tab mới để in bảng kê.",
      });
      return;
    }

    const tripDate = new Date(selectedTrip.departureTime);
    const dateFormatted = `${tripDate.getDate()}/${tripDate.getMonth() + 1}/${tripDate.getFullYear()}`;
    const lunarFormatted = formatLunarDate(tripDate);

    const seatDataMap = new Map<string, { 
      phone: string; 
      pickup: string; 
      dropoff: string; 
      price: number; 
      status: 'sold' | 'booked' | 'held';
    }>();

    manifest.forEach((booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip.id);
      if (!tripItem) return;

      const totalPaid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
      const isPaid = totalPaid >= booking.totalPrice || booking.status === 'payment';
      const isHold = booking.status === 'hold';
      const status: 'sold' | 'booked' | 'held' = isPaid ? 'sold' : (isHold ? 'held' : 'booked');

      tripItem.seatIds.forEach((seatId) => {
        const ticket = tripItem.tickets?.find((t) => t.seatId === seatId);
        seatDataMap.set(seatId, {
          phone: booking.passenger.phone,
          pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
          dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
          price: ticket?.price || 0,
          status: status
        });
      });
    });

    selectedTrip.seats.forEach(s => {
      if (s.status === SeatStatus.HELD && !seatDataMap.has(s.id)) {
        seatDataMap.set(s.id, { phone: "---", pickup: "---", dropoff: "---", price: 0, status: 'held' });
      }
    });

    // Render từng ô ghế - Đã tăng chiều cao lên h-[60px] để vừa tờ A4 ngang
    const renderSeatHtml = (seat: Seat | undefined, isSmall: boolean = false) => {
      const cellHeight = isSmall ? 'h-[50px]' : 'h-[60px]';
      if (!seat) return `<div class="border-transparent bg-transparent ${cellHeight}"></div>`;
      
      const data = seatDataMap.get(seat.id);
      const label = seat.label;

      if (!data) {
        return `
          <div class="border border-dashed border-slate-300 rounded flex flex-col items-center justify-center bg-slate-50 opacity-40 ${cellHeight}">
            <span class="font-black text-slate-400 text-xs">${label}</span>
          </div>
        `;
      }

      const statusColors = {
        sold: "border-green-600 bg-green-50 text-green-900",
        booked: "border-amber-500 bg-amber-50 text-amber-900",
        held: "border-purple-600 bg-purple-50 text-purple-900"
      };

      const tagColors = {
        sold: "bg-green-600",
        booked: "bg-amber-600",
        held: "bg-purple-600"
      };

      const statusLabel = data.status === 'sold' ? "MUA" : (data.status === 'held' ? "GIỮ" : "ĐẶT");

      return `
        <div class="border-2 rounded flex flex-col p-1 shadow-sm relative overflow-hidden ${statusColors[data.status]} ${cellHeight}">
          <div class="flex justify-between items-center border-b border-black/5 pb-0.5 mb-1">
            <span class="font-black text-xs text-black leading-none">${label}</span>
            <span class="text-[7px] font-bold text-white px-1 rounded ${tagColors[data.status]}">${statusLabel}</span>
          </div>
          <div class="flex-1 flex flex-col justify-center overflow-hidden">
            <div class="font-black text-[11px] leading-tight text-black">${data.phone}</div>
            <div class="text-[9px] truncate leading-tight opacity-90 mt-0.5">${data.pickup || '---'}</div>
            <div class="text-[9px] truncate leading-tight opacity-90">${data.dropoff || '---'}</div>
          </div>
          ${data.price > 0 ? `<div class="absolute bottom-0.5 right-1 font-black text-[8px] text-red-700 bg-white/60 px-0.5 rounded">${(data.price/1000)}k</div>` : ''}
        </div>
      `;
    };

    const isCabin = selectedTrip.type === BusType.CABIN;
    let layoutHtml = "";

    if (isCabin) {
      const regularSeats = selectedTrip.seats.filter(s => !s.isFloorSeat);
      const floorSeats = selectedTrip.seats.filter(s => s.isFloorSeat).sort((a,b) => (a.row||0) - (b.row||0));
      const colB = regularSeats.filter(s => s.col === 0);
      const colA = regularSeats.filter(s => s.col === 1);
      const rows = [0,1,2,3,4,5,6,7,8,9,10];

      layoutHtml = `
        <div class="flex gap-3 w-full max-h-[185mm] overflow-hidden">
          <!-- DÃY B -->
          <div class="flex-1 flex flex-col border border-slate-200 rounded-lg p-1.5 bg-slate-50/50">
            <div class="bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded mb-1.5 text-center uppercase tracking-wider">Dãy B (Phòng Lẻ)</div>
            <div class="flex flex-col gap-1.5">
              ${rows.map(r => `
                <div class="grid grid-cols-2 gap-1.5">
                  ${renderSeatHtml(colB.find(s => s.row === r && s.floor === 1))}
                  ${renderSeatHtml(colB.find(s => s.row === r && s.floor === 2))}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- DÃY SÀN -->
          <div class="w-[85px] flex flex-col border border-slate-200 rounded-lg p-1.5 bg-slate-50/50 shrink-0">
            <div class="bg-slate-500 text-white text-[10px] font-bold py-1 px-2 rounded mb-1.5 text-center uppercase">SÀN</div>
            <div class="flex flex-col gap-2 justify-around h-full">
              ${[0,1,2,3,4,5].map(i => renderSeatHtml(floorSeats[i])).join('')}
            </div>
          </div>

          <!-- DÃY A -->
          <div class="flex-1 flex flex-col border border-slate-200 rounded-lg p-1.5 bg-slate-50/50">
            <div class="bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded mb-1.5 text-center uppercase tracking-wider">Dãy A (Phòng Chẵn)</div>
            <div class="flex flex-col gap-1.5">
              ${rows.map(r => `
                <div class="grid grid-cols-2 gap-1.5">
                  ${renderSeatHtml(colA.find(s => s.row === r && s.floor === 1))}
                  ${renderSeatHtml(colA.find(s => s.row === r && s.floor === 2))}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      layoutHtml = `<div class="grid grid-cols-2 gap-4 max-h-[220mm] overflow-hidden">`;
      [1, 2].forEach(floor => {
        layoutHtml += `
          <div class="border border-slate-200 rounded-xl p-2 bg-white shadow-sm">
            <div class="bg-slate-800 text-white text-[10px] font-bold py-1 px-3 rounded mb-2 inline-block uppercase">Tầng ${floor}</div>
            <div class="grid grid-cols-3 gap-2">
              ${[0,1,2,3,4,5].map(r => 
                [0,1,2].map(c => renderSeatHtml(selectedTrip.seats.find(s => s.floor === floor && s.row === r && s.col === c && !s.isFloorSeat))).join('')
              ).join('')}
              <div class="col-span-3 grid grid-cols-5 gap-1 mt-2 pt-2 border-t border-dashed border-slate-200">
                ${selectedTrip.seats.filter(s => s.floor === floor && s.row === 6).sort((a,b)=>(a.col||0)-(b.col||0)).map(s => renderSeatHtml(s, true)).join('')}
              </div>
            </div>
          </div>
        `;
      });
      layoutHtml += `</div>`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng kê - ${selectedTrip.licensePlate}</title>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 ${isCabin ? 'landscape' : 'portrait'}; margin: 6mm; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; margin: 0; }
            .container-page { height: 100vh; max-height: 100vh; overflow: hidden; }
          }
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; background: white; }
          .container-page { width: 100%; margin: 0 auto; display: flex; flex-direction: column; }
        </style>
      </head>
      <body class="p-0">
        <div class="container-page px-4">
          <!-- HEADER -->
          <div class="flex justify-between items-center border-b-2 border-black py-2 mb-3">
            <div class="flex flex-col">
              <h1 class="text-2xl font-black uppercase leading-tight">SƠ ĐỒ BẢNG KÊ HÀNH KHÁCH</h1>
              <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hệ thống VinaBus Manager</span>
            </div>
            <div class="text-right flex items-center gap-4">
              <span class="bg-black text-white px-3 py-1 rounded text-lg font-black">${selectedTrip.licensePlate}</span>
              <div class="flex flex-col text-right">
                <span class="text-lg font-bold">${dateFormatted}</span>
                <span class="text-xs font-bold text-slate-500 uppercase">ÂL: ${lunarFormatted}</span>
              </div>
            </div>
          </div>

          <!-- TRIP INFO BAR -->
          <div class="bg-slate-50 border border-slate-300 rounded p-2 mb-3 flex justify-between items-center shadow-inner shrink-0">
            <div class="flex flex-col">
              <span class="text-[9px] font-bold text-slate-400 uppercase">Tuyến đường vận hành</span>
              <span class="text-xl font-black text-blue-900">${selectedTrip.route}</span>
            </div>
            <div class="flex gap-10">
              <div class="flex flex-col items-center">
                <span class="text-[9px] font-bold text-slate-400 uppercase">Giờ xuất bến</span>
                <span class="text-xl font-black">${selectedTrip.departureTime.split(' ')[1]}</span>
              </div>
              <div class="flex flex-col items-end">
                <span class="text-[9px] font-bold text-slate-400 uppercase">Tài xế phụ trách</span>
                <span class="text-xl font-black text-slate-700">${selectedTrip.driver || '---'}</span>
              </div>
            </div>
          </div>

          <!-- MAIN MAP -->
          <div class="flex-1 min-h-0 overflow-hidden">
            ${layoutHtml}
          </div>

          <!-- FOOTER -->
          <div class="mt-3 py-2 border-t-2 border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-500 shrink-0">
            <div>Xuất lúc: ${new Date().toLocaleString('vi-VN')} | Chữ ký xác nhận: .......................................</div>
            <div class="flex gap-4">
              <div class="flex items-center gap-1.5"><div class="w-3 h-3 bg-green-500 rounded-sm border border-green-700"></div> ĐÃ THANH TOÁN</div>
              <div class="flex items-center gap-1.5"><div class="w-3 h-3 bg-amber-500 rounded-sm border border-amber-700"></div> ĐẶT VÉ (CHƯA THU)</div>
              <div class="flex items-center gap-1.5"><div class="w-3 h-3 bg-purple-500 rounded-sm border border-purple-700"></div> GIỮ CHỖ</div>
            </div>
          </div>

          <div class="no-print mt-6 flex justify-center pb-6">
            <button onclick="window.print()" class="bg-blue-700 hover:bg-blue-800 text-white font-black py-3 px-12 rounded-full shadow-2xl transition-all transform hover:scale-105 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              BẮT ĐẦU IN (CTRL + P)
            </button>
          </div>
        </div>
      </body>
      </html>
    `;

    manifestWindow.document.write(htmlContent);
    manifestWindow.document.close();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handlePrint}
      className="h-7 text-[10px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-100"
      disabled={disabled || !selectedTrip}
    >
      <Printer size={12} className="mr-1" /> Xuất sơ đồ in
    </Button>
  );
};
