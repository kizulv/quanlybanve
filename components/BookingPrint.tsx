
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

    const nowStr = new Date().toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Tạo nội dung cho từng chuyến (mỗi chuyến 1 trang A5 3 liên)
    const pagesHtml = items.map((trip, tripIndex) => {
      const seatList = trip.seats.map((s: any) => {
        const { price, pickup, dropoff } = getSeatValues(trip.tripId, s, trip.pickup, trip.dropoff, trip.basePrice);
        return `<li>Ghế ${s.label}: ${formatCurrency(price)}đ</li>`;
      }).join("");

      // Tạo URL tra cứu đơn hàng cho mã QR
      const baseUrl = window.location.origin + window.location.pathname;
      const qrData = `${baseUrl}?bookingId=${bookingId || ''}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrData)}`;

      const renderLien = (title: string) => `
        <div class="lien-container">
          <div class="print-timestamp">In lúc: ${nowStr}</div>
          <div class="header">
            <div class="header-left">
              <h1 class="brand-name">VinaBus</h1>
              <h2 class="lien-title">${title}</h2>
            </div>
            <div class="header-qr">
              <img src="${qrUrl}" width="55" height="55" />
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
            <div class="info-row route-row">
              <span class="value">${trip.route}</span>
            </div>
            <div class="info-row">
              <span class="label">Ngày:</span>
              <span class="value">${new Date(trip.tripDate).toLocaleDateString('vi-VN')}</span>
            </div>
            <div class="info-row">
              <span class="label">Xe:</span>
              <span class="value">${trip.licensePlate}</span>
            </div>
            
            <div class="seat-section">
              <div class="section-title">DANH SÁCH GHẾ:</div>
              <ul class="seat-list">
                ${seatList}
              </ul>
            </div>
          </div>

          <div class="footer-section">
            <div class="total-box">
              <div class="total-row"><span>Cần thu:</span> <strong>${formatCurrency(finalTotal)}đ</strong></div>
              <div class="paid-row">
                TM: ${formatCurrency(paidCash)} | CK: ${formatCurrency(paidTransfer)}
              </div>
            </div>
            <div class="footer-note">Cảm ơn quý khách!</div>
          </div>
        </div>
      `;

      return `
        <div class="page-a5-landscape">
          <div class="liens-wrapper">
            ${renderLien('LIÊN KHÁCH HÀNG')}
            <div class="divider"></div>
            ${renderLien('LIÊN SOÁT VÉ')}
            <div class="divider"></div>
            ${renderLien('LIÊN ĐỐI SOÁT')}
          </div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>In phiếu vé 3 liên - #${(bookingId || '').slice(-6).toUpperCase()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0; 
              background: #f0f0f0;
              -webkit-print-color-adjust: exact;
              color: #000;
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
              overflow: hidden;
            }

            .liens-wrapper {
              display: flex;
              height: 100%;
              padding: 5mm;
              gap: 4mm;
            }

            .lien-container {
              flex: 1;
              display: flex;
              flex-direction: column;
              height: 100%;
              border: 0.5pt solid #ddd;
              padding: 3mm;
              box-sizing: border-box;
              border-radius: 2px;
              position: relative;
            }

            .divider {
              width: 0;
              border-left: 1px dashed #bbb;
              height: 95%;
              align-self: center;
            }

            .print-timestamp {
              font-size: 7px;
              color: #666;
              margin-bottom: 2mm;
              text-align: right;
              border-bottom: 0.2pt solid #eee;
              padding-bottom: 1mm;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 2mm;
            }

            .brand-name { margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #000; }
            .lien-title { margin: 1px 0; font-size: 10px; font-weight: 700; color: #444; }
            .header-qr { text-align: right; }

            .content-body { flex: 1; }
            
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 2px;
              font-size: 10px;
            }
            .info-row .label { color: #555; }
            .info-row .value { font-weight: 600; }
            .route-row { 
                border-top: 1pt solid #000; 
                border-bottom: 1pt solid #000; 
                padding: 1.5px 0; 
                margin: 3px 0;
                justify-content: center;
                text-align: center;
            }
            .route-row .value { font-size: 11px; font-weight: 800; }

            .seat-section {
              margin-top: 3mm;
              border-top: 0.5pt dashed #ccc;
              padding-top: 2mm;
            }
            .section-title { font-size: 8px; font-weight: bold; color: #666; margin-bottom: 1mm; }
            .seat-list { list-style: none; padding: 0; margin: 0; font-size: 9px; }
            .seat-list li { margin-bottom: 1px; font-weight: 500; }

            .footer-section {
              margin-top: auto;
              padding-top: 2mm;
            }

            .total-box {
              background: #f5f5f5;
              padding: 2mm;
              border-radius: 2px;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
            }
            .paid-row {
               font-size: 8px;
               color: #444;
               margin-top: 1px;
               text-align: right;
            }

            .footer-note {
              text-align: center;
              font-size: 8px;
              font-style: italic;
              color: #888;
              margin-top: 2mm;
            }

            .no-print-bar {
              background: #222;
              color: white;
              padding: 12px;
              text-align: center;
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            
            .print-btn {
              background: #2563eb;
              color: white;
              border: none;
              padding: 10px 30px;
              border-radius: 6px;
              font-weight: 700;
              cursor: pointer;
              box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <button class="print-btn" onclick="window.print()">IN PHIẾU NGAY (${items.length} trang)</button>
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">Khổ A5 ngang • 3 liên/trang</div>
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
