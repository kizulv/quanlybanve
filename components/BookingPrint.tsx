
import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./ui/Button";
import { formatCurrency } from "../utils/formatters";

interface BookingPrintProps {
  items: any[];
  bookingForm: { phone: string };
  paidCash: number;
  paidTransfer: number;
  finalTotal: number;
  getSeatValues: (tripId: string, seat: any, pickup: string, dropoff: string, basePrice: number) => any;
  disabled?: boolean;
  bookingId?: string;
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

    const pagesHtml = items.map((trip, tripIndex) => {
      const seatLabels = trip.seats.map((s: any) => s.label).join(", ");
      const baseUrl = window.location.origin + window.location.pathname;
      const qrData = `${baseUrl}?bookingId=${bookingId || ''}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}&color=0-0-0&bgcolor=ffffff`;

      const renderLien = (title: string) => `
        <div class="lien-container">
          <div class="lien-header">
            <div class="brand-info">
              <div class="brand-name">VINABUS</div>
              <div class="print-date">Ngày in: ${nowStr}</div>
            </div>
            <div class="lien-tag">${title}</div>
          </div>
          
          <div class="lien-content">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">MÃ ĐƠN HÀNG:</span>
                <span class="info-value">#${(bookingId || '').slice(-6).toUpperCase()}</span>
              </div>
              <div class="info-item">
                <span class="info-label">SĐT KHÁCH:</span>
                <span class="info-value">${bookingForm.phone || "---"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">NGÀY ĐI:</span>
                <span class="info-value">${new Date(trip.tripDate).toLocaleDateString('vi-VN')}</span>
              </div>
              <div class="info-item">
                <span class="info-label">BIỂN SỐ XE:</span>
                <span class="info-value">${trip.licensePlate}</span>
              </div>
              <div class="info-item full-width">
                <span class="info-label">TUYẾN ĐƯỜNG:</span>
                <span class="info-value route-text">${trip.route}</span>
              </div>
              <div class="info-item full-width">
                <span class="info-label">VỊ TRÍ GHẾ:</span>
                <span class="info-value seat-text">${seatLabels}</span>
              </div>
            </div>
            
            <div class="qr-section">
              <div class="qr-border">
                <img src="${qrUrl}" width="75" height="75" />
              </div>
              <div class="total-box">
                 <div class="total-label">TỔNG THU</div>
                 <div class="total-price">${formatCurrency(finalTotal)}đ</div>
              </div>
            </div>
          </div>

          <div class="lien-footer">
            <div class="payment-detail">Thanh toán: TM ${formatCurrency(paidCash)} | CK ${formatCurrency(paidTransfer)}</div>
            <div class="thanks-msg">CHÚC QUÝ KHÁCH THƯỢNG LỘ BÌNH AN!</div>
          </div>
        </div>
      `;

      return `
        <div class="print-page">
          <div class="top-row">
            ${renderLien('LIÊN KHÁCH HÀNG')}
            <div class="v-cut-line">
              <div class="scissors">✂</div>
            </div>
            ${renderLien('LIÊN SOÁT VÉ')}
          </div>
          
          <div class="h-cut-line">
            <div class="scissors">✂</div>
          </div>
          
          <div class="bottom-row">
            ${renderLien('LIÊN ĐỐI SOÁT')}
          </div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>PhieuVe_VINABUS</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
            
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; border-radius: 0 !important; }
            
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0; 
              background: #fff;
              color: #000;
            }

            @page { 
              size: A5 landscape; 
              margin: 0; 
            }

            @media print {
              .no-print { display: none !important; }
              body { background: white; }
              .print-page { page-break-after: always; }
            }

            .print-page {
              width: 210mm;
              height: 148mm;
              margin: 0 auto;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              background: #fff;
              overflow: hidden;
            }

            .top-row {
              display: flex;
              height: 72mm;
              width: 100%;
              justify-content: space-between;
              align-items: stretch;
            }

            .bottom-row {
              display: flex;
              justify-content: center;
              height: 72mm;
              width: 100%;
              align-items: stretch;
            }

            /* Cut lines */
            .v-cut-line {
              width: 4mm;
              height: 100%;
              border-left: 1pt dashed #000;
              position: relative;
              margin-left: 2mm;
            }
            .h-cut-line {
              height: 4mm;
              width: 100%;
              border-top: 1pt dashed #000;
              position: relative;
              margin-top: 1mm;
              margin-bottom: 1mm;
            }
            .scissors {
              position: absolute;
              font-size: 12px;
              background: white;
              padding: 0 2px;
            }
            .v-cut-line .scissors { top: 50%; left: -6px; transform: translateY(-50%); }
            .h-cut-line .scissors { left: 50%; top: -8px; transform: translateX(-50%); }

            .lien-container {
              width: 100mm;
              height: 70mm;
              border: 1.2pt solid #000;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              background: #fff;
            }

            .lien-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 1.5pt solid #000;
              padding-bottom: 1.5mm;
              margin-bottom: 2mm;
            }

            .brand-info { display: flex; flex-direction: column; }
            .brand-name { font-size: 16px; font-weight: 900; line-height: 1; letter-spacing: 0.5px; }
            .print-date { font-size: 8px; margin-top: 1mm; font-weight: 500; }
            .lien-tag { font-size: 10px; font-weight: 800; text-transform: uppercase; border: 1.2pt solid #000; padding: 2px 6px; }

            .lien-content {
              flex: 1;
              display: flex;
              gap: 3mm;
              overflow: hidden;
            }

            .info-grid {
              flex: 1;
              display: flex;
              flex-wrap: wrap;
              align-content: flex-start;
              gap: 1.5mm 3mm;
            }

            .info-item {
              display: flex;
              flex-direction: column;
              width: calc(50% - 1.5mm);
            }
            .full-width { width: 100%; }

            .info-label { font-size: 8px; font-weight: 800; color: #000; margin-bottom: 0.5mm; }
            .info-value { font-size: 11px; font-weight: 700; line-height: 1.1; }
            
            .route-text { font-size: 11px; border-left: 3pt solid #000; padding-left: 2mm; margin-top: 1px; }
            .seat-text { font-size: 13px; font-weight: 900; border-top: 1pt solid #000; padding-top: 1mm; margin-top: 1mm; }

            .qr-section {
              width: 30mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              border-left: 1pt dashed #000;
              padding-left: 3mm;
            }

            .qr-border { border: 1pt solid #000; padding: 1mm; background: #fff; line-height: 0; }
            .total-box { width: 100%; text-align: center; border: 1.2pt solid #000; padding: 1.5mm 0; margin-top: 2mm; }
            .total-label { font-size: 8px; font-weight: 900; }
            .total-price { font-size: 14px; font-weight: 900; }

            .lien-footer {
              margin-top: 2mm;
              border-top: 1.2pt solid #000;
              padding-top: 1.5mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              font-weight: 800;
            }
            .thanks-msg { font-style: italic; }

            .no-print-bar {
              background: #000;
              color: #fff;
              padding: 15px;
              text-align: center;
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            
            .print-btn {
              background: #fff;
              color: #000;
              border: 2pt solid #fff;
              padding: 10px 60px;
              font-weight: 900;
              font-size: 16px;
              cursor: pointer;
            }
            .print-btn:hover { background: #ddd; }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <button class="print-btn" onclick="window.print()">TIẾN HÀNH IN VÉ</button>
            <p style="margin-top: 10px; font-size: 12px; font-weight: 600;">
              Lưu ý: Chọn khổ giấy <b>A5</b>, Chiều <b>Landscape (Ngang)</b> và Tỷ lệ <b>100%</b>
            </p>
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
