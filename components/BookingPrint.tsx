
import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./ui/Button";
import { formatCurrency } from "../utils/formatters";
import { formatLunarDate } from "../utils/dateUtils";

interface BookingPrintProps {
  items: any[];
  bookingForm: { phone: string };
  paidCash: number;
  paidTransfer: number;
  finalTotal: number;
  getSeatValues: (tripId: string, seat: any, pickup: string, dropoff: string, basePrice: number) => any;
  disabled?: boolean;
  bookingId?: string; // ID để tạo QR
}

export const BookingPrint: React.FC<BookingPrintProps> = ({
  items,
  bookingForm,
  paidCash,
  paidTransfer,
  finalTotal,
  getSeatValues,
  disabled = false,
  bookingId
}) => {
  const handlePrintReceipt = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const bookingDetails = items.map(trip => {
      const seatList = trip.seats.map((s: any) => {
        const { price, pickup, dropoff } = getSeatValues(trip.tripId, s, trip.pickup, trip.dropoff, trip.basePrice);
        return `<li>Ghế ${s.label}: ${formatCurrency(price)}đ (${pickup} → ${dropoff})</li>`;
      }).join("");

      return `
        <div style="margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
          <p><strong>Chuyến:</strong> ${trip.route}</p>
          <p><strong>Ngày đi:</strong> ${new Date(trip.tripDate).toLocaleDateString('vi-VN')} - ${formatLunarDate(new Date(trip.tripDate))}</p>
          <p><strong>Biển số:</strong> ${trip.licensePlate}</p>
          <ul style="list-style: none; padding-left: 10px; font-size: 14px;">
            ${seatList}
          </ul>
        </div>
      `;
    }).join("");

    // Tạo URL tra cứu đơn hàng cho mã QR
    const baseUrl = window.location.origin + window.location.pathname;
    const qrData = `${baseUrl}?bookingId=${bookingId || ''}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Phiếu thu tạm tính - ${bookingForm.phone}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
            .header-info { text-align: left; }
            .header-qr { text-align: right; }
            .qr-label { font-size: 8px; font-weight: bold; margin-top: 4px; text-transform: uppercase; display: block; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; font-style: italic; }
            .total-box { background: #f9f9f9; padding: 15px; border: 1px solid #ddd; margin-top: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-info">
              <h2 style="margin: 0 0 10px 0;">PHIẾU THU TẠM TÍNH</h2>
              <p style="margin: 5px 0;"><strong>SĐT Khách:</strong> ${bookingForm.phone || "---"}</p>
              <p style="margin: 5px 0;"><strong>Mã đơn:</strong> #${(bookingId || '').slice(-6).toUpperCase()}</p>
            </div>
            <div class="header-qr">
              <img src="${qrUrl}" width="100" height="100" />
              <span class="qr-label">Quét để xem vé</span>
            </div>
          </div>
          ${bookingDetails}
          <div class="total-box">
            <p><strong>Tổng tiền:</strong> ${formatCurrency(finalTotal)} đ</p>
            <p><strong>Tiền mặt:</strong> ${formatCurrency(paidCash)} đ</p>
            <p><strong>Chuyển khoản:</strong> ${formatCurrency(paidTransfer)} đ</p>
          </div>
          <div class="footer">
            <p>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
            <p>Thời gian in: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 5px; font-weight: bold;">In phiếu ngay</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Button
      variant="outline"
      onClick={handlePrintReceipt}
      disabled={disabled}
      className="border-indigo-700 text-indigo-100 hover:bg-indigo-800 bg-indigo-900/40 h-11 px-6 text-sm font-bold flex items-center justify-center gap-2 min-w-[120px]"
    >
      <Printer size={16} />
      In phiếu
    </Button>
  );
};
