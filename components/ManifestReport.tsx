
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

    // Cấu trúc nhóm ghế cho xe 41 chỗ theo mẫu
    const groups = [
      { label: "1.1", seats: ["1", "2", "3"] },
      { label: "1.2", seats: ["4", "5", "6"] },
      { label: "2.1", seats: ["7", "8", "9"] },
      { label: "2.2", seats: ["10", "11", "12"] },
      { label: "3.1", seats: ["13", "14", "15"] },
      { label: "3.2", seats: ["16", "17", "18"] },
      { label: "4.1", seats: ["19", "20", "21"] },
      { label: "4.2", seats: ["22", "23", "24"] },
      { label: "5.1", seats: ["25", "26", "27"] },
      { label: "5.2", seats: ["28", "29", "30"] },
      { label: "6.1", seats: ["31", "32", "33"] },
      { label: "6.2", seats: ["34", "35", "36"] },
      { label: "2",   seats: ["37", "38", "39", "40", "41"] },
    ];

    // Tìm thông tin đặt vé cho một số ghế cụ thể
    const getBookingInfo = (seatId: string) => {
      const booking = manifest.find((b) =>
        b.items.some((item) => item.tripId === trip.id && item.seatIds.includes(seatId))
      );
      if (!booking) return null;

      const item = booking.items.find(i => i.tripId === trip.id);
      const ticket = item?.tickets?.find(t => t.seatId === seatId);

      return {
        phone: booking.passenger.phone,
        pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
        dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
        note: booking.passenger.note || "",
      };
    };

    return (
      <div ref={ref} className="manifest-print-table-view bg-white text-black font-sans select-none">
        {/* Header Cao Nhất */}
        <div className="flex border-t border-l border-r border-black items-stretch">
          <div className="flex-1 py-3 text-center text-xl font-black uppercase tracking-wider border-r border-black flex items-center justify-center">
            {trip.name || "XE THƯỜNG LAI CHÂU - NGHỆ AN"}
          </div>
          <div className="w-[200px] flex flex-col justify-center px-3 font-bold text-sm">
            <div>NGÀY:</div>
            <div className="mt-1 border-b border-black border-dotted h-4 font-mono">{dateFormatted}</div>
          </div>
        </div>

        {/* Table Structure */}
        <table className="w-full border-collapse border border-black text-[12px]">
          <thead>
            <tr className="bg-white">
              <th className="border border-black w-[40px] py-1 text-center">1</th>
              <th className="border border-black w-[40px] py-1 text-center">Số</th>
              <th className="border border-black py-1 text-center">Số điện thoại</th>
              <th className="border border-black w-[18%] py-1 text-center">Nơi đón</th>
              <th className="border border-black w-[18%] py-1 text-center">Nơi trả</th>
              <th className="border border-black w-[15%] py-1 text-center">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.label}>
                {group.seats.map((seatNum, idx) => {
                  const info = getBookingInfo(seatNum);
                  return (
                    <tr key={seatNum} className="h-[28px]">
                      {/* Cột nhóm: Chỉ render ở hàng đầu tiên của nhóm */}
                      {idx === 0 && (
                        <td 
                          rowSpan={group.seats.length} 
                          className="border border-black text-center font-bold align-middle bg-white"
                        >
                          {group.label}
                        </td>
                      )}
                      
                      {/* Số ghế */}
                      <td className="border border-black text-center font-bold bg-white">
                        {seatNum}
                      </td>

                      {/* Thông tin khách */}
                      <td className="border border-black px-2 font-black text-[13px]">
                        {info?.phone || ""}
                      </td>
                      <td className="border border-black px-2 truncate">
                        {info?.pickup || ""}
                      </td>
                      <td className="border border-black px-2 truncate">
                        {info?.dropoff || ""}
                      </td>
                      <td className="border border-black px-2 text-[10px] italic">
                        {info?.note || ""}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
             <tr className="h-[35px]">
                <td colSpan={2} className="border border-black border-t-0"></td>
                <td colSpan={3} className="border border-black border-t-0 text-right px-4 font-bold uppercase text-[11px]">
                   Tổng tiền vé đặt trước
                </td>
                <td className="border border-black border-t-0 text-right px-4 font-black text-sm">
                   {totalPrice > 0 ? totalPrice.toLocaleString('vi-VN') : "-"}
                </td>
             </tr>
          </tfoot>
        </table>

        {/* Footer Signatures */}
        <div className="flex justify-between mt-8 px-10 text-[11px] font-bold italic opacity-80">
           <div className="flex flex-col items-center gap-16">
              <span>Lái xe ký nhận</span>
              <div className="w-32 border-b border-black border-dotted"></div>
           </div>
           <div className="flex flex-col items-center gap-16">
              <span>Văn phòng bến</span>
              <div className="w-32 border-b border-black border-dotted"></div>
           </div>
        </div>

        <style>{`
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          .manifest-print-table-view {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            color: black !important;
          }
          table {
            border-spacing: 0;
            border-width: 1px 0 0 1px;
          }
          th, td {
            border-color: black !important;
          }
          @media print {
            body { background: white; -webkit-print-color-adjust: exact; }
            .no-print { display: none; }
          }
        `}</style>
      </div>
    );
  }
);

ManifestReport.displayName = "ManifestReport";
