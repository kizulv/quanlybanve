
import React from "react";
import { Booking, BusTrip } from "../types";
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
    const timeFormatted = formatTime(trip.departureTime);

    // Sắp xếp danh sách theo vị trí ghế
    const sortedList = [...manifest].sort((a, b) => {
      const seatA = a.items.find((i) => i.tripId === trip.id)?.seatIds[0] || "";
      const seatB = b.items.find((i) => i.tripId === trip.id)?.seatIds[0] || "";
      return seatA.localeCompare(seatB, undefined, { numeric: true });
    });

    return (
      <div ref={ref} className="p-10 text-slate-900 bg-white font-serif min-h-screen">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold uppercase tracking-tight mb-1">
            Bảng Kê Danh Sách Hành Khách
          </h1>
          <div className="text-lg font-bold text-blue-800">{trip.name}</div>
          <div className="w-32 h-1 bg-slate-800 mx-auto mt-2"></div>
        </div>

        {/* Trip Meta Information */}
        <div className="grid grid-cols-2 gap-y-3 mb-8 text-sm border-b border-slate-200 pb-6">
          <div className="flex gap-2">
            <span className="font-bold w-32">Biển số xe:</span>
            <span className="font-mono bg-slate-100 px-2 rounded border border-slate-300">
              {trip.licensePlate}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold w-32">Ngày khởi hành:</span>
            <span>{dateFormatted}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold w-32">Giờ xuất bến:</span>
            <span>{timeFormatted}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold w-32">Lái xe:</span>
            <span className="border-b border-dotted border-slate-400 flex-1">
              {trip.driver || "...................................."}
            </span>
          </div>
        </div>

        {/* Manifest Table */}
        <table className="w-full border-collapse border border-slate-800 text-sm mb-8">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-800 p-2 w-10 text-center uppercase font-bold text-[10px]">STT</th>
              <th className="border border-slate-800 p-2 w-20 text-center uppercase font-bold text-[10px]">Vị trí ghế</th>
              <th className="border border-slate-800 p-2 w-32 text-center uppercase font-bold text-[10px]">Số điện thoại</th>
              <th className="border border-slate-800 p-2 text-left uppercase font-bold text-[10px]">Lộ trình (Đón - Trả)</th>
              <th className="border border-slate-800 p-2 w-32 text-right uppercase font-bold text-[10px]">Tiền vé (VNĐ)</th>
              <th className="border border-slate-800 p-2 text-left uppercase font-bold text-[10px]">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {sortedList.map((booking, index) => {
              const item = booking.items.find((i) => i.tripId === trip.id);
              const seats = item?.seatIds.join(", ") || "";
              const price = item?.price || 0;
              const pickup = item?.tickets?.[0]?.pickup || booking.passenger.pickupPoint || "Dọc đường";
              const dropoff = item?.tickets?.[0]?.dropoff || booking.passenger.dropoffPoint || "Dọc đường";

              return (
                <tr key={booking.id}>
                  <td className="border border-slate-800 p-2 text-center">{index + 1}</td>
                  <td className="border border-slate-800 p-2 text-center font-bold">{seats}</td>
                  <td className="border border-slate-800 p-2 text-center font-mono">
                    {booking.passenger.phone}
                  </td>
                  <td className="border border-slate-800 p-2 italic">
                    {pickup} → {dropoff}
                  </td>
                  <td className="border border-slate-800 p-2 text-right font-bold">
                    {price.toLocaleString("vi-VN")}
                  </td>
                  <td className="border border-slate-800 p-2 text-[11px] text-slate-600">
                    {booking.passenger.note}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-bold">
              <td colSpan={4} className="border border-slate-800 p-3 text-right text-xs uppercase">
                Tổng thực thu chuyến xe:
              </td>
              <td className="border border-slate-800 p-3 text-right text-red-700 text-lg">
                {totalPrice.toLocaleString("vi-VN")} đ
              </td>
              <td className="border border-slate-800 p-3"></td>
            </tr>
          </tfoot>
        </table>

        {/* Footer / Signatures */}
        <div className="grid grid-cols-2 mt-12 text-center text-sm italic">
          <div>
            <div className="font-bold not-italic mb-20 text-base uppercase">Lái xe ký nhận</div>
            <div className="text-slate-400">................................................</div>
          </div>
          <div>
            <div className="font-bold not-italic mb-20 text-base uppercase">Văn phòng bến</div>
            <div className="text-slate-400">................................................</div>
          </div>
        </div>

        {/* Print Date Meta */}
        <div className="mt-20 pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between italic">
          <span>Hệ thống quản lý VinaBus Manager - Xuất bản bởi: Quản trị viên</span>
          <span>Ngày in: {new Date().toLocaleString("vi-VN")}</span>
        </div>
        
        <style>{`
          @page {
            size: A4;
            margin: 20mm;
          }
          @media print {
            body { font-family: 'Times New Roman', serif; }
          }
        `}</style>
      </div>
    );
  }
);

ManifestReport.displayName = "ManifestReport";
