
import React from "react";
import { Booking, BusTrip } from "../types";

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

    // Render một ô ghế theo đúng style trong ảnh
    const renderSeatBox = (label: string, seatId: string, isGray: boolean = false) => {
      const booking = getBookingForSeat(seatId);
      const isBooked = !!booking;
      
      // Lấy thông tin từ booking nếu có
      const item = booking?.items.find(i => i.tripId === trip.id);
      const ticket = item?.tickets?.find(t => t.seatId === seatId);
      const phone = booking?.passenger.phone || "";
      const price = ticket?.price || 0;

      return (
        <div className={`border-l border-b border-black relative h-[56px] flex flex-col p-1.5 ${isGray ? 'bg-[#c0c0c0]' : 'bg-white'}`}>
          {/* Nhãn ghế góc trên trái */}
          <div className="text-[10px] font-bold leading-none">{label}</div>
          
          {/* Nội dung dòng kẻ hoặc thông tin khách */}
          <div className="flex-1 flex flex-col justify-center gap-2 mt-1 px-1">
            {isBooked ? (
              <div className="text-[10px] font-bold leading-tight">
                {phone}
              </div>
            ) : (
              <>
                <div className="border-b border-dotted border-black/40 w-full h-0"></div>
                <div className="border-b border-dotted border-black/40 w-full h-0"></div>
              </>
            )}
          </div>

          {/* Ô vuông nhỏ ở góc dưới bên phải */}
          <div className="absolute bottom-0 right-0 w-8 h-5 border-l border-t border-black flex items-center justify-center bg-white">
            {isBooked && price > 0 && (
               <span className="text-[8px] font-bold">{(price/1000)}k</span>
            )}
          </div>
        </div>
      );
    };

    // Render dòng của cột Sàn
    const renderFloorRow = (label?: string) => (
      <div className="border-l border-b border-black h-[56px] flex flex-col justify-center px-1 gap-2">
        <div className="border-b border-dotted border-black/40 w-full h-0"></div>
        <div className="border-b border-dotted border-black/40 w-full h-0"></div>
        <div className="border-b border-dotted border-black/40 w-full h-0"></div>
      </div>
    );

    return (
      <div ref={ref} className="manifest-report-print bg-white text-black font-sans w-full">
        {/* Header - Tiêu đề và Ngày */}
        <div className="flex border-t border-l border-r border-black items-center">
          <div className="flex-1 py-3 text-center text-lg font-black uppercase tracking-widest border-r border-black">
            {trip.name || "XE CHUYÊN CƠ HÀ TĨNH - LAI CHÂU"}
          </div>
          <div className="w-[200px] px-3 font-bold text-sm">
            NGÀY: <span className="ml-2 font-mono">{dateFormatted}</span>
          </div>
        </div>

        {/* Bảng sơ đồ chính */}
        <div className="flex border-r border-black">
          
          {/* CỘT 1: DÃY B - TẦNG 1 */}
          <div className="flex-1 flex flex-col border-t border-black">
            <div className="border-l border-b border-black text-center py-1 font-bold text-xs">Tầng 1</div>
            <div className="flex flex-col">
              {[1, 3, 5, 7, 9].map(n => renderSeatBox(`B${n}`, `B${n}`))}
              {renderSeatBox(`B11`, `B11`, true)}
            </div>
          </div>

          {/* CỘT 2: DÃY B - TẦNG 2 */}
          <div className="flex-1 flex flex-col border-t border-black">
            <div className="border-l border-b border-black text-center py-1 font-bold text-xs">Tầng 2</div>
            <div className="flex flex-col">
              {[2, 4, 6, 8, 10, 12].map(n => renderSeatBox(`B${n}`, `B${n}`))}
            </div>
          </div>

          {/* CỘT 3: SÀN */}
          <div className="w-[12%] flex flex-col border-t border-black">
            <div className="border-l border-b border-black text-center py-1 font-bold text-xs">Sàn</div>
            <div className="flex flex-col">
              {Array.from({ length: 6 }).map((_, i) => renderFloorRow())}
            </div>
          </div>

          {/* CỘT 4: DÃY A - TẦNG 1 */}
          <div className="flex-1 flex flex-col border-t border-black">
            <div className="border-l border-b border-black text-center py-1 font-bold text-xs">Tầng 1</div>
            <div className="flex flex-col">
              {[1, 3, 5, 7, 9].map(n => renderSeatBox(`A${n}`, `A${n}`))}
              {/* Footer Summary (Row 1) */}
              <div className="border-l border-b border-black h-[28px] px-2 flex items-center justify-between text-[10px] font-bold">
                <span>Tổng tiền đặt trước</span>
                <span>-</span>
              </div>
              <div className="border-l border-b border-black h-[28px] px-2 flex items-center text-[10px] font-bold">
                <span>Tổng vé đã bán</span>
              </div>
            </div>
          </div>

          {/* CỘT 5: DÃY A - TẦNG 2 */}
          <div className="flex-1 flex flex-col border-t border-black">
            <div className="border-l border-b border-black text-center py-1 font-bold text-xs">Tầng 2</div>
            <div className="flex flex-col">
              {[2, 4, 6, 8, 10].map(n => renderSeatBox(`A${n}`, `A${n}`))}
              {/* Footer Summary Values (Row 2) */}
              <div className="border-l border-b border-black h-[28px]"></div>
              <div className="border-l border-b border-black h-[28px]"></div>
            </div>
          </div>

        </div>

        {/* Style cục bộ cho việc in */}
        <style>{`
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          .manifest-report-print {
            max-width: 1060px;
            margin: 0 auto;
            border-bottom: none;
          }
          /* Đảm bảo các dòng kẻ chấm hiển thị rõ khi in */
          .border-dotted {
            border-bottom-style: dotted !important;
            border-bottom-width: 1.5px !important;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        `}</style>
      </div>
    );
  }
);

ManifestReport.displayName = "ManifestReport";
