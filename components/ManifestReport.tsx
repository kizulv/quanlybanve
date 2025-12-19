
import React from "react";
import { Booking, BusTrip, SeatStatus } from "../types";
import { formatTime } from "../utils/dateUtils";

interface ManifestReportProps {
  trip: BusTrip;
  manifest: Booking[];
  totalPrice: number;
}

export const ManifestReport = React.forwardRef<HTMLDivElement, ManifestReportProps>(
  ({ trip, manifest, totalPrice }, ref) => {
    const tripDate = new Date(trip.departureTime);
    const dateFormatted = `${tripDate.getDate()}/${tripDate.getMonth() + 1}/${tripDate.getFullYear()}`;

    // Helper: Tìm booking theo Seat ID
    const getBookingForSeat = (seatId: string) => {
      return manifest.find((b) =>
        b.items.some((item) => item.tripId === trip.id && item.seatIds.includes(seatId))
      );
    };

    // Helper: Render nội dung ô ghế
    const renderSeatBox = (label: string, seatId: string, isGray: boolean = false) => {
      const booking = getBookingForSeat(seatId);
      const isBooked = !!booking;
      
      // Lấy thông tin chi tiết của ghế trong booking
      const item = booking?.items.find(i => i.tripId === trip.id);
      const ticket = item?.tickets?.find(t => t.seatId === seatId);
      
      const phone = booking?.passenger.phone || "";
      const pickupDropoff = ticket ? `${ticket.pickup} - ${ticket.dropoff}` : (booking?.passenger.pickupPoint || "");
      const price = ticket?.price || 0;

      return (
        <div className={`border-l border-b border-black relative h-[58px] flex flex-col p-1 text-[9px] ${isGray ? 'bg-gray-200' : ''}`}>
          <div className="font-bold flex justify-between items-center">
            <span>{label}</span>
            {isBooked && price > 0 && <span className="font-mono">{price.toLocaleString('vi-VN')}</span>}
          </div>
          <div className="flex-1 flex flex-col justify-end gap-0.5 mt-0.5">
            {isBooked ? (
              <>
                <div className="font-bold truncate">{phone}</div>
                <div className="truncate italic opacity-80">{pickupDropoff}</div>
              </>
            ) : (
              <>
                <div className="border-b border-dotted border-gray-400 h-3 w-full"></div>
                <div className="border-b border-dotted border-gray-400 h-3 w-full"></div>
              </>
            )}
          </div>
        </div>
      );
    };

    // Chuẩn bị dữ liệu cho sơ đồ 11 hàng (Dãy B) và 10 hàng (Dãy A)
    const rows = Array.from({ length: 11 }, (_, i) => i);
    const floorRows = Array.from({ length: 6 }, (_, i) => i); // 6 ghế sàn

    return (
      <div ref={ref} className="manifest-print-container p-4 bg-white text-black font-sans leading-tight">
        {/* Header Section */}
        <div className="flex justify-between items-center border-t border-l border-r border-black p-2">
          <div className="flex-1 text-center font-black text-lg uppercase">
            {trip.name || "XE CHUYÊN CƠ"}
          </div>
          <div className="w-1/3 text-right font-bold flex justify-end gap-2 items-center">
            <span>NGÀY:</span>
            <span className="border-b border-black px-4">{dateFormatted}</span>
          </div>
        </div>

        {/* Grid Container */}
        <div className="flex border-r border-black min-h-[650px]">
          {/* DÃY B (Bên trái) */}
          <div className="flex-[2] flex flex-col border-t border-black">
             <div className="grid grid-cols-2 text-center font-bold text-xs border-b border-black">
                <div className="border-l border-black py-1">Tầng 1</div>
                <div className="border-l border-black py-1">Tầng 2</div>
             </div>
             <div className="grid grid-cols-2 flex-1">
                {/* Cột 1: B1, B3, B5... */}
                <div className="flex flex-col">
                   {[1,3,5,7,9,11,13,15,17,19,21].map((n, idx) => (
                      renderSeatBox(`B${n}`, `B${n}`, n === 21) // B11 (idx=11) theo mẫu là 21
                   ))}
                </div>
                {/* Cột 2: B2, B4, B6... */}
                <div className="flex flex-col">
                   {[2,4,6,8,10,12,14,16,18,20,22].map((n) => (
                      renderSeatBox(`B${n}`, `B${n}`)
                   ))}
                </div>
             </div>
          </div>

          {/* SÀN (Giữa) */}
          <div className="flex-1 flex flex-col border-t border-black bg-gray-50/30">
              <div className="text-center font-bold text-xs border-b border-black border-l py-1">
                Sàn
              </div>
              <div className="flex flex-col flex-1">
                {Array.from({length: 11}).map((_, i) => (
                  <div key={i} className="border-l border-b border-black h-[58px] p-1">
                    {i < 6 && renderSeatBox(`S${i+1}`, `Sàn ${i+1}`)}
                  </div>
                ))}
              </div>
          </div>

          {/* DÃY A (Bên phải) */}
          <div className="flex-[2] flex flex-col border-t border-black">
             <div className="grid grid-cols-2 text-center font-bold text-xs border-b border-black">
                <div className="border-l border-black py-1">Tầng 1</div>
                <div className="border-l border-black py-1">Tầng 2</div>
             </div>
             <div className="grid grid-cols-2 flex-1 relative">
                {/* Cột 1: A1, A3... */}
                <div className="flex flex-col">
                   {[1,3,5,7,9].map((n) => renderSeatBox(`A${n}`, `A${n}`))}
                   {/* Phần trống bên dưới A9 */}
                   <div className="flex-1 border-l border-black"></div>
                </div>
                {/* Cột 2: A2, A4... */}
                <div className="flex flex-col">
                   {[2,4,6,8,10].map((n) => renderSeatBox(`A${n}`, `A${n}`))}
                   
                   {/* Bảng tổng hợp nằm ở góc dưới bên phải dãy A */}
                   <div className="flex-1 border-l border-black">
                      <div className="absolute bottom-0 right-0 w-full h-[120px] bg-white border-l border-t border-black p-2 flex flex-col justify-between text-xs">
                          <div className="flex justify-between border-b border-black pb-1">
                            <span className="font-bold">Tổng tiền đặt trước</span>
                            <span className="font-black text-sm">-</span>
                          </div>
                          <div className="flex justify-between border-b border-black pb-1 mt-1">
                            <span className="font-bold">Tổng vé đã bán</span>
                            <span className="font-black text-sm">{manifest.length}</span>
                          </div>
                          <div className="flex justify-between items-end mt-auto font-black text-red-600">
                            <span className="uppercase text-[10px]">Thực thu:</span>
                            <span className="text-lg">{totalPrice.toLocaleString('vi-VN')} đ</span>
                          </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Footer Area for signatures if needed */}
        <div className="flex justify-between mt-4 px-10 text-xs italic">
           <div>Lái xe ký xác nhận: ........................................</div>
           <div>Văn phòng/Kế toán: ........................................</div>
        </div>

        <style>{`
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          .manifest-print-container {
            width: 100%;
            max-width: 1100px;
            margin: 0 auto;
            color: black !important;
          }
          @media print {
            body { background: white; }
            .no-print { display: none; }
          }
        `}</style>
      </div>
    );
  }
);

ManifestReport.displayName = "ManifestReport";
