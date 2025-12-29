
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

    // Tạo nội dung cho từng chuyến (mỗi chuyến 1 trang A5 2 liên)
    const pagesHtml = items.map((trip, tripIndex) => {
      const seatList = trip.seats.map((s: any) => {
        const { price, pickup, dropoff } = getSeatValues(trip.tripId, s, trip.pickup, trip.dropoff, trip.basePrice);
        return `<li>Ghế ${s.label}: ${formatCurrency(price)}đ (${pickup} → ${dropoff})</li>`;
      }).join("");

      // Tạo URL tra cứu đơn hàng cho mã QR
      const baseUrl = window.location.origin + window.location.pathname;
      const qrData = `${baseUrl}?bookingId=${bookingId || ''}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}`;

      const renderLien = (title: string) => `
        <div class="lien-container">
          <div class="header">
            <div class="header-left">
              <h1 style="margin: 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">VinaBus Manager</h1>
              <div style="font-size: 10px; color: #666; margin-bottom: 5px;">Hệ thống đặt vé thông minh</div>
              <h2 style="margin: 5px 0; font-size: 14px; font-weight: 700; color: #000;">${title}</h2>
            </div>
            <div class="header-qr">
              <img src="${qrUrl}" width="70" height="70" />
              <span class="qr-label">Quét tra cứu</span>
            </div>
          </div>

          <div class="content-body">
            <div class="info-row">
              <span class="label">Mã đơn:</span>
              <span class="value">#${(bookingId || '').slice(-6).toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="label">Điện thoại:</span>
              <span class="value">${bookingForm.phone || "---"}</span>
            </div>
            <div class="info-row">
              <span class="label">Chuyến:</span>
              <span class="value" style="font-weight: 800;">${trip.route}</span>
            </div>
            <div class="info-row">
              <span class="label">Ngày đi:</span>
              <span class="value">${new Date(trip.tripDate).toLocaleDateString('vi-VN')} (${formatLunarDate(new Date(trip.tripDate)).replace(' Âm Lịch', '')})</span>
            </div>
            <div class="info-row">
              <span class="label">Xe/Tài:</span>
              <span class="value">${trip.licensePlate}</span>
            </div>
            
            <div style="margin-top: 10px; border-top: 1px dashed #eee; padding-top: 5px;">
              <div style="font-size: 10px; font-weight: bold; margin-bottom: 3px;">DANH SÁCH GHẾ:</div>
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 11px;">
                ${seatList}
              </ul>
            </div>
          </div>

          <div class="footer-section">
            <div class="total-box">
              <div class="total-row"><span>Cần thu:</span> <strong>${formatCurrency(finalTotal)}đ</strong></div>
              <div class="total-row" style="font-size: 9px; opacity: 0.8;">
                <span>Đã trả:</span> TM: ${formatCurrency(paidCash)} | CK: ${formatCurrency(paidTransfer)}
              </div>
            </div>
            <div class="footer-note">
              Cảm ơn quý khách! (${new Date().toLocaleTimeString('vi-VN')})
            </div>
          </div>
        </div>
      `;

      return `
        <div class="page-a5-landscape">
          <div class="liens-wrapper">
            ${renderLien('LIÊN KHÁCH HÀNG')}
            <div class="divider"></div>
            ${renderLien('LIÊN KIỂM SOÁT')}
          </div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>In phiếu vé - #${(bookingId || '').slice(-6).toUpperCase()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
            
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0; 
              background: #f0f0f0;
              -webkit-print-color-adjust: exact;
            }

            @page { 
              size: A5 landscape; 
              margin: 0; 
            }

            @media print {
              body { background: white; }
              .no-print { display: none; }
              .page-a5-landscape { 
                page-break-after: always;
                width: 210mm;
                height: 148mm;
              }
            }

            .page-a5-landscape {
              background: white;
              width: 210mm;
              height: 148mm;
              margin: 0 auto;
              position: relative;
              box-sizing: border-box;
            }

            .liens-wrapper {
              display: flex;
              height: 100%;
              padding: 8mm;
              gap: 10mm;
            }

            .lien-container {
              flex: 1;
              display: flex;
              flex-direction: column;
              height: 100%;
              border: 1px solid #eee;
              padding: 5mm;
              box-sizing: border-box;
              border-radius: 4px;
            }

            .divider {
              width: 0;
              border-left: 1px dashed #ccc;
              height: 90%;
              align-self: center;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #000;
              padding-bottom: 5px;
              margin-bottom: 10px;
            }

            .header-qr { text-align: right; }
            .qr-label { font-size: 7px; font-weight: bold; display: block; margin-top: 2px; }

            .content-body { flex: 1; }
            
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              font-size: 11px;
            }
            .info-row .label { color: #666; }
            .info-row .value { font-weight: 600; color: #000; }

            .footer-section {
              margin-top: 10px;
            }

            .total-box {
              background: #f9f9f9;
              border: 1px solid #eee;
              padding: 5px;
              border-radius: 4px;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
            }

            .footer-note {
              text-align: center;
              font-size: 9px;
              font-style: italic;
              color: #999;
              margin-top: 5px;
            }

            .no-print-bar {
              background: #333;
              color: white;
              padding: 10px;
              text-align: center;
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            
            .print-btn {
              background: #2563eb;
              color: white;
              border: none;
              padding: 8px 24px;
              border-radius: 6px;
              font-weight: bold;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <button class="print-btn" onclick="window.print()">Bắt đầu in phiếu (${items.length} trang)</button>
            <span style="margin-left: 15px; font-size: 12px; opacity: 0.8;">Cài đặt máy in: Khổ A5, Chiều Ngang (Landscape)</span>
          </div>
          ${pagesHtml}
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
