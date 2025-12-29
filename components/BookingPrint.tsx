
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

    // Tạo nội dung cho từng chuyến (mỗi chuyến 1 trang A5 dọc, 3 liên xếp chồng)
    const pagesHtml = items.map((trip, tripIndex) => {
      const seatLabels = trip.seats.map((s: any) => s.label).join(", ");

      // Tạo URL tra cứu đơn hàng cho mã QR
      const baseUrl = window.location.origin + window.location.pathname;
      const qrData = `${baseUrl}?bookingId=${bookingId || ''}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrData)}`;

      const renderLien = (title: string) => `
        <div class="lien-container">
          <div class="print-timestamp">Thời gian in: ${nowStr}</div>
          
          <div class="header">
            <div class="brand-section">
              <h1 class="brand-name">VinaBus Manager</h1>
              <div class="lien-title">${title}</div>
            </div>
            <div class="qr-section">
              <img src="${qrUrl}" width="60" height="60" />
            </div>
          </div>

          <div class="info-grid">
            <div class="info-column">
              <div class="info-item">
                <span class="label">Mã đơn:</span>
                <span class="value">#${(bookingId || '').slice(-6).toUpperCase()}</span>
              </div>
              <div class="info-item">
                <span class="label">Điện thoại:</span>
                <span class="value">${bookingForm.phone || "---"}</span>
              </div>
              <div class="info-item route-box">
                <span class="label">Tuyến đường:</span>
                <span class="value highlight-text">${trip.route}</span>
              </div>
            </div>
            
            <div class="info-column border-left">
              <div class="info-item">
                <span class="label">Ngày đi:</span>
                <span class="value">${new Date(trip.tripDate).toLocaleDateString('vi-VN')}</span>
              </div>
              <div class="info-item">
                <span class="label">Biển số xe:</span>
                <span class="value">${trip.licensePlate}</span>
              </div>
              <div class="info-item">
                <span class="label">Số ghế:</span>
                <span class="value font-black text-blue-800">${seatLabels}</span>
              </div>
            </div>
          </div>

          <div class="footer-summary">
            <div class="payment-details">
              <div class="payment-row">
                <span class="label">Thanh toán:</span>
                <span class="value font-bold">${formatCurrency(finalTotal)} đ</span>
              </div>
              <div class="payment-sub">
                (TM: ${formatCurrency(paidCash)} | CK: ${formatCurrency(paidTransfer)})
              </div>
            </div>
            <div class="thank-you">Cảm ơn quý khách đã tin tưởng VinaBus!</div>
          </div>
        </div>
      `;

      return `
        <div class="page-a5-portrait">
          ${renderLien('LIÊN 1: KHÁCH HÀNG')}
          <div class="page-divider"></div>
          ${renderLien('LIÊN 2: SOÁT VÉ')}
          <div class="page-divider"></div>
          ${renderLien('LIÊN 3: ĐỐI SOÁT')}
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>In vé 3 liên A5 - #${(bookingId || '').slice(-6).toUpperCase()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0; 
              background: #f4f4f5;
              -webkit-print-color-adjust: exact;
              color: #000;
            }

            @page { 
              size: A5 portrait; 
              margin: 0; 
            }

            @media print {
              body { background: white; }
              .no-print { display: none; }
              .page-a5-portrait { 
                page-break-after: always;
                width: 148mm;
                height: 210mm;
              }
            }

            .page-a5-portrait {
              background: white;
              width: 148mm;
              height: 210mm;
              margin: 0 auto;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              padding: 5mm;
            }

            .lien-container {
              flex: 1;
              display: flex;
              flex-direction: column;
              border: 0.5pt solid #e2e8f0;
              padding: 4mm;
              position: relative;
              overflow: hidden;
            }

            .page-divider {
              height: 0;
              border-top: 1pt dashed #cbd5e1;
              margin: 2mm 0;
            }

            .print-timestamp {
              font-size: 7px;
              color: #94a3b8;
              text-align: right;
              margin-bottom: 2mm;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 1.5pt solid #000;
              padding-bottom: 2mm;
              margin-bottom: 3mm;
            }

            .brand-name { margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; color: #1e40af; }
            .lien-title { font-size: 10px; font-weight: 700; color: #475569; margin-top: 1px; }

            .info-grid {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 4mm;
              flex: 1;
            }

            .info-column {
              display: flex;
              flex-direction: column;
              gap: 2mm;
            }

            .border-left {
              border-left: 0.5pt dashed #e2e8f0;
              padding-left: 4mm;
            }

            .info-item {
              display: flex;
              flex-direction: column;
            }

            .info-item .label {
              font-size: 8px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .info-item .value {
              font-size: 11px;
              font-weight: 700;
              color: #0f172a;
            }

            .highlight-text {
              color: #1e40af !important;
              font-size: 12px !important;
            }

            .route-box {
              background: #f8fafc;
              padding: 2mm;
              border-radius: 4px;
              border-left: 3pt solid #1e40af;
            }

            .footer-summary {
              margin-top: 3mm;
              padding-top: 2mm;
              border-top: 0.5pt solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }

            .payment-details {
              display: flex;
              flex-direction: column;
            }

            .payment-row {
              display: flex;
              align-items: baseline;
              gap: 2mm;
            }

            .payment-row .label { font-size: 9px; color: #475569; }
            .payment-row .value { font-size: 13px; color: #b91c1c; }
            
            .payment-sub {
              font-size: 8px;
              color: #94a3b8;
              font-style: italic;
            }

            .thank-you {
              font-size: 8px;
              font-style: italic;
              color: #94a3b8;
              text-align: right;
            }

            .no-print-bar {
              background: #0f172a;
              color: white;
              padding: 15px;
              text-align: center;
              position: sticky;
              top: 0;
              z-index: 1000;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            
            .print-btn {
              background: #2563eb;
              color: white;
              border: none;
              padding: 12px 40px;
              border-radius: 8px;
              font-weight: 700;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .print-btn:hover {
              background: #1d4ed8;
              transform: translateY(-1px);
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <button class="print-btn" onclick="window.print()">BẮT ĐẦU IN PHIẾU (${items.length} TRANG)</button>
            <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">Cài đặt in: Khổ A5, Chiều dọc (Portrait)</div>
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
