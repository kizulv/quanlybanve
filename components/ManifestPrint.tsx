
import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./ui/Button";
import { BusTrip, Booking } from "../types";
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
    if (!selectedTrip || manifest.length === 0) {
      toast({
        type: "warning",
        title: "Không có dữ liệu",
        message: "Chưa chọn chuyến hoặc không có khách để xuất bảng kê.",
      });
      return;
    }

    const manifestWindow = window.open("", "_blank");
    if (!manifestWindow) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Vui lòng cho phép trình duyệt mở tab mới để xuất bảng kê.",
      });
      return;
    }

    const tripDate = new Date(selectedTrip.departureTime);
    const dateFormatted = `${tripDate.getDate()}/${tripDate.getMonth() + 1}/${tripDate.getFullYear()}`;
    const lunarFormatted = formatLunarDate(tripDate);

    let rowsHtml = "";
    let grandTotal = 0;
    let seatIndex = 1;

    // Duyệt qua danh sách booking để hiển thị theo từng ghế
    manifest.forEach((booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip.id);
      if (!tripItem) return;

      tripItem.seatIds.forEach((seatId) => {
        const ticket = tripItem.tickets?.find((t) => t.seatId === seatId);
        const seatObj = selectedTrip.seats.find((s) => s.id === seatId);
        const seatLabel = seatObj ? seatObj.label : seatId;
        const price = ticket ? ticket.price : 0;
        grandTotal += price;

        rowsHtml += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; text-align: center;">${seatIndex++}</td>
            <td style="padding: 8px; text-align: center; font-weight: bold;">${seatLabel}</td>
            <td style="padding: 8px;">${booking.passenger.phone}</td>
            <td style="padding: 8px;">${ticket?.pickup || booking.passenger.pickupPoint || "---"}</td>
            <td style="padding: 8px;">${ticket?.dropoff || booking.passenger.dropoffPoint || "---"}</td>
            <td style="padding: 8px; text-align: right;">${price.toLocaleString("vi-VN")}</td>
            <td style="padding: 8px; font-style: italic; font-size: 11px;">${booking.passenger.note || ""}</td>
          </tr>
        `;
      });
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng kê hành khách - ${selectedTrip.licensePlate}</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #2563eb; text-transform: uppercase; font-size: 24px; }
          .trip-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; font-size: 12px; text-transform: uppercase; }
          td { border: 1px solid #e2e8f0; font-size: 13px; padding: 8px; }
          .footer { margin-top: 30px; text-align: right; font-weight: bold; font-size: 18px; color: #b91c1c; }
          @media print {
            button { display: none; }
            body { padding: 0; }
            .trip-info { border: none; background: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Bảng kê hành khách</h1>
          <p>Nhà xe VinaBus Manager</p>
        </div>
        <div class="trip-info">
          <div>
            <strong>Tuyến:</strong> ${selectedTrip.route}<br>
            <strong>Chuyến:</strong> ${selectedTrip.name}
          </div>
          <div style="text-align: right;">
            <strong>Ngày chạy:</strong> ${dateFormatted} (${lunarFormatted})<br>
            <strong>Biển số:</strong> ${selectedTrip.licensePlate} | <strong>Tài xế:</strong> ${selectedTrip.driver || "---"}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th width="40">STT</th>
              <th width="60">Ghế</th>
              <th width="120">SĐT</th>
              <th>Điểm đón</th>
              <th>Điểm trả</th>
              <th width="100">Tiền vé</th>
              <th width="200">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 20px;">Không có dữ liệu hành khách</td></tr>'}
          </tbody>
        </table>
        <div class="footer">
          Tổng cộng: ${grandTotal.toLocaleString("vi-VN")} đ
        </div>
        <div style="margin-top: 40px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">In bảng kê</button>
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
      disabled={disabled || !selectedTrip || manifest.length === 0}
    >
      <Printer size={12} className="mr-1" /> Xuất bảng kê
    </Button>
  );
};
