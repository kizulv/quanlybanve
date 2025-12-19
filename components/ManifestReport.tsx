
import React from "react";
import { Booking, BusTrip, BusType } from "../types";

interface ManifestReportProps {
  trip: BusTrip;
  manifest: Booking[];
  totalPrice: number;
}

export const ManifestReport = React.forwardRef<HTMLDivElement, ManifestReportProps>(
  ({ trip, manifest, totalPrice }, ref) => {
    const tripDate = new Date(trip.departureTime);
    const dateFormatted = `${tripDate.getDate()}/${tripDate.getMonth() + 1}/${tripDate.getFullYear()}`;

    const isCabin = trip.type === BusType.CABIN;

    // Helper: Tìm booking theo Seat ID
    const getBookingForSeat = (seatId: string) => {
      const b = manifest.find((b) =>
        b.items.some((item) => item.tripId === trip.id && item.seatIds.includes(seatId))
      );
      if (!b) return null;
      const item = b.items.find(i => i.tripId === trip.id);
      const ticket = item?.tickets?.find(t => t.seatId === seatId);
      return {
        phone: b.passenger.phone,
        pickup: ticket?.pickup || b.passenger.pickupPoint || "",
        dropoff: ticket?.dropoff || b.passenger.dropoffPoint || "",
        note: b.passenger.note || "",
        price: ticket?.price || 0
      };
    };

    // --- VIEW 1: XE PHÒNG (CABIN 22) - LAYOUT 5 CỘT NGANG ---
    const renderCabinView = () => {
      const renderSeatBox = (label: string, isGray: boolean = false) => {
        const info = getBookingForSeat(label);
        return (
          <div className={`seat-box border-l border-b border-black relative h-[100px] flex flex-col p-1.5 ${isGray ? 'bg-[#cccccc]' : 'bg-white'}`}>
            <div className="text-[11px] font-bold leading-none mb-1">{label}</div>
            <div className="flex-1 flex flex-col justify-center gap-3.5 px-1">
              {info ? (
                <div className="text-[12px] font-bold leading-tight break-all">
                  {info.phone}
                  <div className="text-[10px] font-normal italic mt-1 truncate">{info.pickup}</div>
                </div>
              ) : (
                <>
                  <div className="border-b border-dotted border-black/40 w-full h-0"></div>
                  <div className="border-b border-dotted border-black/40 w-full h-0"></div>
                  <div className="border-b border-dotted border-black/40 w-full h-0"></div>
                </>
              )}
            </div>
            <div className="price-sub-box absolute bottom-0 right-0 w-12 h-6 border-l border-t border-black flex items-center justify-center bg-white">
              {info && info.price > 0 && <span className="text-[9px] font-black">{(info.price/1000)}k</span>}
            </div>
          </div>
        );
      };

      const renderFloorRow = () => (
        <div className="floor-box border-l border-b border-black h-[100px] flex flex-col justify-center px-1 gap-4 bg-white">
          {[1,2,3,4].map(i => <div key={i} className="border-b border-dotted border-black/40 w-full h-0"></div>)}
        </div>
      );

      return (
        <div className="cabin-layout-container">
          <div className="flex border-r border-black font-bold text-[11px] text-center uppercase tracking-wider">
            <div className="flex-1 border-l border-black border-b py-1.5">Tầng 1</div>
            <div className="flex-1 border-l border-black border-b py-1.5">Tầng 2</div>
            <div className="w-[12%] border-l border-black border-b py-1.5">Sàn</div>
            <div className="flex-1 border-l border-black border-b py-1.5">Tầng 1</div>
            <div className="flex-1 border-l border-black border-b py-1.5">Tầng 2</div>
          </div>
          <div className="flex border-r border-black">
            <div className="flex-1 flex flex-col border-t border-black">
              {[1, 3, 5, 7, 9].map(n => renderSeatBox(`B${n}`))}
              {renderSeatBox(`B11`, true)}
            </div>
            <div className="flex-1 flex flex-col border-t border-black">
              {[2, 4, 6, 8, 10, 12].map(n => renderSeatBox(`B${n}`))}
            </div>
            <div className="w-[12%] flex flex-col border-t border-black">
              {Array.from({ length: 6 }).map((_, i) => <React.Fragment key={i}>{renderFloorRow()}</React.Fragment>)}
            </div>
            <div className="flex-1 flex flex-col border-t border-black">
              {[1, 3, 5, 7, 9].map(n => renderSeatBox(`A${n}`))}
              <div className="border-l border-b border-black h-[50px] flex items-center px-2 font-bold text-[10px]">Tổng tiền đặt trước</div>
              <div className="border-l border-b border-black h-[50px] flex items-center px-2 font-bold text-[10px]">Tổng vé đã bán</div>
            </div>
            <div className="flex-1 flex flex-col border-t border-black">
              {[2, 4, 6, 8, 10].map(n => renderSeatBox(`A${n}`))}
              <div className="border-l border-b border-black h-[50px] flex items-center justify-end px-3 font-bold text-sm">-</div>
              <div className="border-l border-b border-black h-[50px] flex flex-col justify-center px-3 relative">
                 <div className="text-right font-black text-xs pr-1">{manifest.length} vé</div>
                 <div className="absolute bottom-0 right-0 w-12 h-6 border-l border-t border-black flex items-center justify-center bg-white">
                    <span className="text-[9px] font-black">{(totalPrice/1000)}k</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    // --- VIEW 2: XE GIƯỜNG (SLEEPER 41) - LAYOUT BẢNG DỌC ---
    const renderSleeperView = () => {
      const groups = [
        { label: "1.1", seats: ["1", "2", "3"] }, { label: "1.2", seats: ["4", "5", "6"] },
        { label: "2.1", seats: ["7", "8", "9"] }, { label: "2.2", seats: ["10", "11", "12"] },
        { label: "3.1", seats: ["13", "14", "15"] }, { label: "3.2", seats: ["16", "17", "18"] },
        { label: "4.1", seats: ["19", "20", "21"] }, { label: "4.2", seats: ["22", "23", "24"] },
        { label: "5.1", seats: ["25", "26", "27"] }, { label: "5.2", seats: ["28", "29", "30"] },
        { label: "6.1", seats: ["31", "32", "33"] }, { label: "6.2", seats: ["34", "35", "36"] },
        { label: "2",   seats: ["37", "38", "39", "40", "41"] },
      ];

      return (
        <div className="sleeper-layout-container">
          <table className="w-full border-collapse border border-black text-[12px]">
            <thead>
              <tr className="bg-white text-center">
                <th className="border border-black w-[40px] py-1">1</th>
                <th className="border border-black w-[40px] py-1">Số</th>
                <th className="border border-black py-1">Số điện thoại</th>
                <th className="border border-black w-[18%] py-1">Nơi đón</th>
                <th className="border border-black w-[18%] py-1">Nơi trả</th>
                <th className="border border-black w-[15%] py-1">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <React.Fragment key={group.label}>
                  {group.seats.map((seatNum, idx) => {
                    const info = getBookingForSeat(seatNum);
                    return (
                      <tr key={seatNum} className="h-[28px]">
                        {idx === 0 && <td rowSpan={group.seats.length} className="border border-black text-center font-bold align-middle">{group.label}</td>}
                        <td className="border border-black text-center font-bold">{seatNum}</td>
                        <td className="border border-black px-2 font-bold text-[13px]">{info?.phone || ""}</td>
                        <td className="border border-black px-2 truncate">{info?.pickup || ""}</td>
                        <td className="border border-black px-2 truncate">{info?.dropoff || ""}</td>
                        <td className="border border-black px-2 text-[10px] italic">{info?.note || ""}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
               <tr className="h-[35px]">
                  <td colSpan={2} className="border border-black border-t-0"></td>
                  <td colSpan={3} className="border border-black border-t-0 text-right px-4 font-bold uppercase text-[11px]">Tổng tiền vé đặt trước</td>
                  <td className="border border-black border-t-0 text-right px-4 font-black text-sm">{totalPrice > 0 ? totalPrice.toLocaleString('vi-VN') : "-"}</td>
               </tr>
            </tfoot>
          </table>
        </div>
      );
    };

    return (
      <div ref={ref} className={`manifest-pdf-final ${isCabin ? 'is-landscape' : 'is-portrait'} bg-white text-black font-sans leading-none select-none`}>
        {/* Universal Header */}
        <div className="flex items-center border-t border-l border-r border-black mb-0">
          <div className="flex-1 py-4 text-center text-xl font-black uppercase tracking-wider border-r border-black">
            {trip.name || (isCabin ? "XE CHUYÊN CƠ VIP" : "XE THƯỜNG LAI CHÂU - NGHỆ AN")}
          </div>
          <div className="w-[280px] px-4 font-bold text-sm flex items-center gap-2">
            NGÀY: <span className="flex-1 border-b border-black border-dotted h-5 font-mono text-center">{dateFormatted}</span>
          </div>
        </div>

        {/* Content View Selection */}
        {isCabin ? renderCabinView() : renderSleeperView()}

        {/* Universal Footer */}
        <div className="flex justify-between mt-6 px-10 text-[10px] font-bold italic opacity-80">
           <div className="flex flex-col items-center gap-14">
              <span>Lái xe ký nhận</span>
              <div className="w-32 border-b border-black border-dotted"></div>
           </div>
           <div className="flex flex-col items-center gap-14">
              <span>Văn phòng bến</span>
              <div className="w-32 border-b border-black border-dotted"></div>
           </div>
        </div>

        <style>{`
          /* Tách biệt hoàn toàn style in ấn để không ảnh hưởng app */
          @media screen {
             .manifest-pdf-final { display: none !important; }
          }
          
          @media print {
            body { background: white !important; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
            
            .manifest-pdf-final {
              display: block !important;
              position: relative;
              background: white !important;
              color: black !important;
              box-sizing: border-box;
            }
            
            /* Chỉ áp dụng border-color cho các phần tử bên trong container này */
            .manifest-pdf-final, 
            .manifest-pdf-final div, 
            .manifest-pdf-final table, 
            .manifest-pdf-final td, 
            .manifest-pdf-final th { 
              border-color: #000000 !important; 
            }

            .manifest-pdf-final.is-landscape {
              width: 297mm;
              height: 210mm;
              padding: 8mm;
            }
            .manifest-pdf-final.is-portrait {
              width: 210mm;
              margin: 0 auto;
              padding: 5mm;
            }

            .manifest-pdf-final .border-dotted {
              border-bottom-style: dotted !important;
              border-bottom-width: 1.5px !important;
              border-color: #000 !important;
            }
          }

          @page {
            margin: 0;
          }
          .is-landscape { size: A4 landscape; }
          .is-portrait { size: A4 portrait; }
        `}</style>
      </div>
    );
  }
);

ManifestReport.displayName = "ManifestReport";
