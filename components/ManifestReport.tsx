
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

    // Render một ô ghế chuẩn theo mẫu ảnh
    const renderSeatBox = (label: string, isGray: boolean = false) => {
      const booking = getBookingForSeat(label);
      const isBooked = !!booking;
      
      const item = booking?.items.find(i => i.tripId === trip.id);
      const ticket = item?.tickets?.find(t => t.seatId === label);
      const phone = booking?.passenger.phone || "";
      const price = ticket?.price || 0;

      return (
        <div className={`border-l border-b border-black relative h-[100px] flex flex-col p-1.5 ${isGray ? 'bg-[#cccccc]' : 'bg-white'}`}>
          {/* Nhãn ghế góc trên trái */}
          <div className="text-[11px] font-bold leading-none mb-1">{label}</div>
          
          {/* 3 dòng kẻ chấm hoặc thông tin khách */}
          <div className="flex-1 flex flex-col justify-center gap-3.5 px-1">
            {isBooked ? (
              <div className="text-[12px] font-bold leading-tight break-all">
                {phone}
                <div className="text-[10px] font-normal italic mt-1 truncate">
                  {ticket?.pickup || booking?.passenger.pickupPoint || ""}
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-dotted border-black/40 w-full h-0"></div>
                <div className="border-b border-dotted border-black/40 w-full h-0"></div>
                <div className="border-b border-dotted border-black/40 w-full h-0"></div>
              </>
            )}
          </div>

          {/* Ô vuông nhỏ ở góc dưới bên phải dành cho giá vé */}
          <div className="absolute bottom-0 right-0 w-12 h-6 border-l border-t border-black flex items-center justify-center bg-white">
            {isBooked && price > 0 && (
               <span className="text-[9px] font-black">{(price/1000)}k</span>
            )}
          </div>
        </div>
      );
    };

    // Render ô Sàn (Lối đi giữa)
    const renderFloorRow = () => (
      <div className="border-l border-b border-black h-[100px] flex flex-col justify-center px-1 gap-4 bg-white">
        <div className="border-b border-dotted border-black/40 w-full h-0"></div>
        <div className="border-b border-dotted border-black/40 w-full h-0"></div>
        <div className="border-b border-dotted border-black/40 w-full h-0"></div>
        <div className="border-b border-dotted border-black/40 w-full h-0"></div>
      </div>
    );

    return (
      <div ref={ref} className="manifest-pdf-final bg-white text-black font-sans leading-none select-none">
        {/* Header Cao Nhất */}
        <div className="flex items-center border-t border-l border-r border-black">
          <div className="flex-1 py-4 text-center text-xl font-black uppercase tracking-[0.2em] border-r border-black">
            {trip.name || "XE CHUYÊN CƠ HÀ TĨNH - LAI CHÂU"}
          </div>
          <div className="w-[280px] px-4 font-bold text-sm flex items-center gap-2">
            NGÀY: <span className="flex-1 border-b border-black border-dotted h-5 font-mono text-center">{dateFormatted}</span>
          </div>
        </div>

        {/* Sub-Header: Tầng 1, Tầng 2, Sàn... */}
        <div className="flex border-r border-black font-bold text-[11px] text-center uppercase tracking-wider">
          <div className="flex-1 border-l border-black border-b py-1.5">Tầng 1</div>
          <div className="flex-1 border-l border-black border-b py-1.5">Tầng 2</div>
          <div className="w-[12%] border-l border-black border-b py-1.5">Sàn</div>
          <div className="flex-1 border-l border-black border-b py-1.5">Tầng 1</div>
          <div className="flex-1 border-l border-black border-b py-1.5">Tầng 2</div>
        </div>

        {/* Grid Body: 6 Rows Total */}
        <div className="flex border-r border-black">
          
          {/* CỘT 1: Dãy B Tầng 1 (Lẻ) */}
          <div className="flex-1 flex flex-col border-t border-black">
            {[1, 3, 5, 7, 9].map(n => renderSeatBox(`B${n}`))}
            {renderSeatBox(`B11`, true)}
          </div>

          {/* CỘT 2: Dãy B Tầng 2 (Chẵn) */}
          <div className="flex-1 flex flex-col border-t border-black">
            {[2, 4, 6, 8, 10, 12].map(n => renderSeatBox(`B${n}`))}
          </div>

          {/* CỘT 3: Sàn */}
          <div className="w-[12%] flex flex-col border-t border-black">
            {Array.from({ length: 6 }).map((_, i) => (
               <React.Fragment key={i}>{renderFloorRow()}</React.Fragment>
            ))}
          </div>

          {/* CỘT 4: Dãy A Tầng 1 + Tổng hợp */}
          <div className="flex-1 flex flex-col border-t border-black">
            {[1, 3, 5, 7, 9].map(n => renderSeatBox(`A${n}`))}
            {/* Hàng 6 - Nhãn Tổng */}
            <div className="border-l border-b border-black h-[50px] flex items-center px-2 font-bold text-[10px]">
              Tổng tiền đặt trước
            </div>
            <div className="border-l border-b border-black h-[50px] flex items-center px-2 font-bold text-[10px]">
              Tổng vé đã bán
            </div>
          </div>

          {/* CỘT 5: Dãy A Tầng 2 + Giá trị Tổng hợp */}
          <div className="flex-1 flex flex-col border-t border-black">
            {[2, 4, 6, 8, 10].map(n => renderSeatBox(`A${n}`))}
            {/* Hàng 6 - Giá trị Tổng */}
            <div className="border-l border-b border-black h-[50px] flex items-center justify-end px-3 font-bold text-sm">
              -
            </div>
            <div className="border-l border-b border-black h-[50px] flex flex-col justify-center px-3 relative">
               <div className="text-right font-black text-xs pr-1">{manifest.length} vé</div>
               <div className="absolute bottom-0 right-0 w-12 h-6 border-l border-t border-black flex items-center justify-center bg-white">
                  <span className="text-[9px] font-black">{(totalPrice/1000)}k</span>
               </div>
            </div>
          </div>

        </div>

        <style>{`
          @page {
            size: A4 landscape;
            margin: 0;
          }
          .manifest-pdf-final {
            width: 297mm;
            height: 210mm;
            padding: 8mm;
            box-sizing: border-box;
          }
          /* Đảm bảo viền đen khi in */
          div { border-color: #000000 !important; }
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
