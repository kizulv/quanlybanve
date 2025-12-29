
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
            <div class="brand-side">
              <div class="brand-name">VINABUS</div>
              <div class="print-time">Ngày in: ${nowStr}</div>
            </div>
            <div class="tag-side">${title}</div>
          </div>
          
          <div class="lien-body">
            <div class="info-main">
              <div class="row">
                <div class="cell">
                  <div class="label">MÃ ĐƠN HÀNG:</div>
                  <div class="value">#${(bookingId || '').slice(-6).toUpperCase()}</div>
                </div>
                <div class="cell">
                  <div class="label">SĐT KHÁCH:</div>
                  <div class="value">${bookingForm.phone || "---"}</div>
                </div>
              </div>
              <div class="row">
                <div class="cell">
                  <div class="label">NGÀY ĐI:</div>
                  <div class="value">${new Date(trip.tripDate).toLocaleDateString('vi-VN')}</div>
                </div>
                <div class="cell">
                  <div class="label">BIỂN SỐ XE:</div>
                  <div class="value">${trip.licensePlate}</div>
                </div>
              </div>
              <div class="row full">
                <div class="label">TUYẾN ĐƯỜNG:</div>
                <div class="value route-val"><span>|</span> ${trip.route}</div>
              </div>
              <div class="row full">
                <div class="label">VỊ TRÍ GHẾ:</div>
                <div class="value seat-val">${seatLabels}</div>
              </div>
            </div>
            
            <div class="info-aside">
              <div class="qr-box">
                <img src="${qrUrl}" width="70" height="70" />
              </div>
              <div class="total-box">
                 <div class="total-label">TỔNG THU</div>
                 <div class="total-price">${formatCurrency(finalTotal)}đ</div>
              </div>
            </div>
          </div>

          <div class="lien-footer">
            <div class="footer-left">Thanh toán: TM ${formatCurrency(paidCash)} | CK ${formatCurrency(paidTransfer)}</div>
            <div class="footer-right">CHÚC QUÝ KHÁCH THƯỢNG LỘ BÌNH AN!</div>
          </div>
        </div>
      `;

      return `
        <div class="a5-page">
          <!-- Guides -->
          <div class="v-line"><span class="scissor">✂</span></div>
          <div class="h-line"><span class="scissor">✂</span></div>

          <div class="top-row">
            ${renderLien('LIÊN KHÁCH HÀNG')}
            ${renderLien('LIÊN SOÁT VÉ')}
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
              .a5-page { page-break-after: always; }
            }

            .a5-page {
              width: 210mm;
              height: 148mm;
              position: relative;
              overflow: hidden;
              background: #fff;
              padding: 2mm;
            }

            /* Hàng trên: 2 liên */
            .top-row {
              display: flex;
              justify-content: space-between;
              height: 72mm;
              width: 100%;
            }

            /* Hàng dưới: 1 liên giữa */
            .bottom-row {
              display: flex;
              justify-content: center;
              height: 72mm;
              width: 100%;
              margin-top: 2mm;
            }

            /* Đường cắt */
            .v-line {
              position: absolute;
              left: 50%;
              top: 2mm;
              height: 70mm;
              border-left: 1pt dashed #000;
              z-index: 10;
            }
            .h-line {
              position: absolute;
              top: 74mm;
              left: 2mm;
              right: 2mm;
              border-top: 1pt dashed #000;
              z-index: 10;
            }
            .scissor {
              position: absolute;
              font-size: 12px;
              background: #fff;
              padding: 0 2px;
            }
            .v-line .scissor { top: 50%; left: -6px; transform: translateY(-50%); }
            .h-line .scissor { left: 50%; top: -8px; transform: translateX(-50%); }

            /* Container của mỗi liên */
            .lien-container {
              width: 102mm;
              height: 70mm;
              border: 1.5pt solid #000;
              padding: 2.5mm;
              display: flex;
              flex-direction: column;
              background: #fff;
            }

            .lien-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2pt solid #000;
              padding-bottom: 1mm;
              margin-bottom: 2mm;
            }

            .brand-name { font-size: 18px; font-weight: 900; line-height: 1; letter-spacing: 0.5px; }
            .print-time { font-size: 8px; margin-top: 1px; font-weight: 500; }
            .tag-side { font-size: 10px; font-weight: 800; text-transform: uppercase; border: 1.5pt solid #000; padding: 2px 6px; }

            .lien-body {
              flex: 1;
              display: flex;
              gap: 2mm;
              overflow: hidden;
            }

            .info-main { flex: 1; display: flex; flex-direction: column; gap: 1.5mm; }
            .info-aside { width: 32mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border-left: 1pt dashed #000; padding-left: 2mm; }

            .row { display: flex; gap: 2mm; }
            .full { width: 100%; flex-direction: column; gap: 0.5mm; }
            .cell { flex: 1; }

            .label { font-size: 8px; font-weight: 800; color: #000; margin-bottom: 0.5mm; text-transform: uppercase; }
            .value { font-size: 11px; font-weight: 700; line-height: 1.1; }
            
            .route-val { font-size: 11px; font-weight: 800; }
            .route-val span { font-weight: 900; font-size: 14px; margin-right: 2px; }
            
            .seat-val { font-size: 16px; font-weight: 900; border-top: 1pt solid #000; padding-top: 1mm; margin-top: 0.5mm; }

            .qr-box { border: 1pt solid #000; padding: 1mm; background: #fff; line-height: 0; }
            .total-box { width: 100%; text-align: center; border: 1.5pt solid #000; padding: 1mm 0; margin-top: 1mm; }
            .total-label { font-size: 8px; font-weight: 900; }
            .total-price { font-size: 15px; font-weight: 900; }

            .lien-footer {
              margin-top: 1.5mm;
              border-top: 1.5pt solid #000;
              padding-top: 1.5mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8.5px;
              font-weight: 800;
            }
            .footer-right { font-style: italic; }

            /* Thanh điều khiển */
            .no-print-bar {
              background: #111;
              color: #fff;
              padding: 12px;
              text-align: center;
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            .print-btn {
              background: #fff;
              color: #000;
              border: none;
              padding: 8px 40px;
              font-weight: 900;
              font-size: 14px;
              cursor: pointer;
            }
            .print-btn:hover { background: #ccc; }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <button class="print-btn" onclick="window.print()">BẮT ĐẦU IN (A5 LANDSCAPE)</button>
            <p style="margin-top: 8px; font-size: 11px;">Chọn khổ giấy <b>A5</b> • Chiều <b>Landscape</b> • Tỷ lệ <b>100%</b></p>
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
