
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

    // 1. Thu thập dữ liệu từ Manifest gắn vào SeatID
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

    // Bổ sung các ghế HELD thủ công không qua booking
    selectedTrip.seats.forEach(s => {
      if (s.status === SeatStatus.HELD && !seatDataMap.has(s.id)) {
        seatDataMap.set(s.id, { phone: "---", pickup: "---", dropoff: "---", price: 0, status: 'held' });
      }
    });

    // Hàm render HTML cho từng ô ghế sử dụng Tailwind
    const renderSeatHtml = (seat: Seat | undefined, isSmall: boolean = false) => {
      if (!seat) return `<div class="border-transparent bg-transparent ${isSmall ? 'h-12' : 'h-16'}"></div>`;
      
      const data = seatDataMap.get(seat.id);
      const label = seat.label;

      if (!data) {
        return `
          <div class="border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50 opacity-40 ${isSmall ? 'h-12' : 'h-16'}">
            <span class="font-black text-slate-400 text-sm">${label}</span>
            <span class="text-[8px] font-bold text-slate-300 uppercase">TRỐNG</span>
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
        <div class="border-2 rounded-lg flex flex-col p-1 shadow-sm relative overflow-hidden ${statusColors[data.status]} ${isSmall ? 'h-12' : 'h-16'}">
          <div class="flex justify-between items-center border-b border-black/5 pb-0.5 mb-0.5">
            <span class="font-black text-sm text-black leading-none">${label}</span>
            <span class="text-[8px] font-bold text-white px-1 rounded ${tagColors[data.status]}">${statusLabel}</span>
          </div>
          <div class="flex-1 flex flex-col justify-between overflow-hidden">
            <div class="font-black text-[11px] leading-none text-black">${data.phone}</div>
            <div class="text-[9px] truncate leading-tight opacity-80">Đ: ${data.pickup || '---'}</div>
            <div class="text-[9px] truncate leading-tight opacity-80">T: ${data.dropoff || '---'}</div>
          </div>
          ${data.price > 0 ? `<div class="absolute bottom-0.5 right-1 font-black text-[9px] text-red-700">${data.price.toLocaleString('vi-VN')}</div>` : ''}
        </div>
      `;
    };

    const isCabin = selectedTrip.type === BusType.CABIN;
    let layoutHtml = "";

    if (isCabin) {
      // --- LAYOUT CABIN 22 PHÒNG + 6 SÀN (Dàn trang khổ ngang) ---
      const regularSeats = selectedTrip.seats.filter(s => !s.isFloorSeat);
      const floorSeats = selectedTrip.seats.filter(s => s.isFloorSeat).sort((a,b) => (a.row||0) - (b.row||0));
      const colB = regularSeats.filter(s => s.col === 0);
      const colA = regularSeats.filter(s => s.col === 1);
      const rows = [0,1,2,3,4,5,6,7,8,9,10];

      layoutHtml = `
        <div class="grid grid-cols-12 gap-4 w-full">
          <!-- DÃY B (PHÒNG LẺ) -->
          <div class="col-span-5 flex flex-col border border-slate-200 rounded-xl p-2 bg-slate-50/50">
            <div class="bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded mb-2 text-center uppercase tracking-widest">Dãy B (Phòng 1 - 2)</div>
            <div class="flex justify-between px-4 text-[9px] font-black text-slate-400 mb-1"><span>TẦNG 1</span><span>TẦNG 2</span></div>
            <div class="flex flex-col gap-1.5">
              ${rows.map(r => `
                <div class="grid grid-cols-2 gap-2">
                  ${renderSeatHtml(colB.find(s => s.row === r && s.floor === 1))}
                  ${renderSeatHtml(colB.find(s => s.row === r && s.floor === 2))}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- DÃY SÀN (GIỮA) -->
          <div class="col-span-2 flex flex-col border border-slate-200 rounded-xl p-2 bg-slate-50/50">
            <div class="bg-slate-500 text-white text-[10px] font-bold py-1 px-2 rounded mb-2 text-center uppercase tracking-widest">SÀN</div>
            <div class="flex flex-col gap-1.5 justify-center h-full">
              ${[0,1,2,3,4,5].map(i => renderSeatHtml(floorSeats[i])).join('')}
              <div class="flex-1"></div> <!-- Spacer to push seats up if needed -->
            </div>
          </div>

          <!-- DÃY A (PHÒNG CHẴN) -->
          <div class="col-span-5 flex flex-col border border-slate-200 rounded-xl p-2 bg-slate-50/50">
            <div class="bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded mb-2 text-center uppercase tracking-widest">Dãy A (Phòng 1 - 2)</div>
            <div class="flex justify-between px-4 text-[9px] font-black text-slate-400 mb-1"><span>TẦNG 1</span><span>TẦNG 2</span></div>
            <div class="flex flex-col gap-1.5">
              ${rows.map(r => `
                <div class="grid grid-cols-2 gap-2">
                  ${renderSeatHtml(colA.find(s => s.row === r && s.floor === 1))}
                  ${renderSeatHtml(colA.find(s => s.row === r && s.floor === 2))}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      // --- LAYOUT GIƯỜNG 41 (Khổ đứng mặc định) ---
      layoutHtml = `<div class="flex flex-col gap-6">`;
      [1, 2].forEach(floor => {
        layoutHtml += `
          <div class="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
            <div class="bg-slate-800 text-white text-xs font-bold py-1.5 px-4 rounded-lg mb-4 inline-block uppercase tracking-widest">Tầng ${floor}</div>
            <div class="grid grid-cols-3 gap-3">
              ${[0,1,2,3,4,5].map(r => 
                [0,1,2].map(c => renderSeatHtml(selectedTrip.seats.find(s => s.floor === floor && s.row === r && s.col === c && !s.isFloorSeat))).join('')
              ).join('')}
              <div class="col-span-3 grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-dashed border-slate-200">
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
        <title>Bảng kê hành khách - ${selectedTrip.licensePlate}</title>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 ${isCabin ? 'landscape' : 'portrait'}; margin: 5mm; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; margin: 0; }
          }
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
          .container-page { width: 100%; margin: 0 auto; padding: 5px; }
        </style>
      </head>
      <body class="bg-white text-slate-900">
        <div class="container-page">
          <!-- HEADER -->
          <div class="flex justify-between items-end border-b-4 border-black pb-2 mb-4">
            <div class="flex flex-col">
              <h1 class="text-2xl font-black uppercase tracking-tighter leading-none">Sơ đồ bảng kê hành khách</h1>
              <span class="text-[10px] font-bold text-slate-500 mt-1 uppercase">Hệ thống quản lý vận tải VinaBus Manager</span>
            </div>
            <div class="text-right flex flex-col gap-1">
              <div class="flex items-center justify-end gap-4">
                <span class="bg-black text-white px-3 py-1 rounded text-lg font-black">${selectedTrip.licensePlate}</span>
                <span class="text-xl font-bold">${dateFormatted}</span>
              </div>
              <span class="text-xs font-bold text-slate-600">Âm lịch: ${lunarFormatted}</span>
            </div>
          </div>

          <!-- TRIP INFO BAR -->
          <div class="bg-slate-100 border border-slate-300 rounded-lg p-3 mb-4 flex justify-between items-center shadow-inner">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-slate-400 uppercase">Tuyến đường</span>
              <span class="text-lg font-black text-blue-800">${selectedTrip.route}</span>
            </div>
            <div class="flex gap-8">
              <div class="flex flex-col items-center">
                <span class="text-[10px] font-bold text-slate-400 uppercase">Giờ chạy</span>
                <span class="text-lg font-black">${selectedTrip.departureTime.split(' ')[1]}</span>
              </div>
              <div class="flex flex-col items-end">
                <span class="text-[10px] font-bold text-slate-400 uppercase">Tài xế</span>
                <span class="text-lg font-black">${selectedTrip.driver || '---'}</span>
              </div>
            </div>
          </div>

          <!-- MAIN CONTENT (SEAT MAP) -->
          <div class="flex-1">
            ${layoutHtml}
          </div>

          <!-- FOOTER -->
          <div class="mt-4 pt-4 border-t-2 border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-500">
            <div>Ngày in: ${new Date().toLocaleString('vi-VN')} | Người lập: .............................</div>
            <div class="flex gap-4">
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-green-500 rounded-sm border border-green-700"></div> ĐÃ THANH TOÁN</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-amber-500 rounded-sm border border-amber-700"></div> ĐẶT VÉ (CHƯA THU)</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 bg-purple-500 rounded-sm border border-purple-700"></div> GIỮ CHỖ (QUẢN LÝ)</div>
            </div>
          </div>

          <!-- PRINT BUTTON (NO-PRINT) -->
          <div class="no-print mt-10 flex justify-center pb-10">
            <button onclick="window.print()" class="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-12 rounded-full shadow-2xl transition-all transform hover:scale-105 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              IN BẢNG KÊ (CTRL + P)
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
