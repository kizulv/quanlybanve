
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
      const departureTimeOnly = trip.tripDate.split(" ")[1] || "";

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
                  <div class="label">GIỜ KHỞI HÀNH (DỰ KIẾN):</div>
                  <div class="value">${departureTimeOnly}</div>
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
                <img src="${qrUrl}" width="65" height="65" />
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
          <!-- Hàng trên: 2 liên -->
          <div class="top-row">
            ${renderLien('LIÊN KHÁCH HÀNG')}
            <div class="v-line-shim"></div>
            ${renderLien('LIÊN SOÁT VÉ')}
          </div>
          
          <!-- Hàng dưới: 1 liên -->
          <div class="bottom-row">
            ${renderLien('LIÊN ĐỐI SOÁT')}
          </div>

          <!-- Đường cắt tuyệt đối để không chiếm diện tích box -->
          <div class="guide-v"><span class="scissor">✂</span></div>
          <div class="guide-h"><span class="scissor">✂</span></div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>InPhieu_VINABUS</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
            
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; border-radius: 0 !important; margin: 0; padding: 0; }
            
            body { 
              font-family: 'Inter', sans-serif; 
              background: #fff;
              color: #000;
            }

            @page { 
              size: A5 landscape; 
              margin: 0; 
            }

            @media print {
              .no-print-bar { display: none !important; }
              .a5-page { page-break-after: always; }
            }

            .a5-page {
              width: 210mm;
              height: 148mm;
              position: relative;
              overflow: hidden;
              background: #fff;
              padding: 5mm; /* Lề an toàn xung quanh */
            }

            .top-row {
              display: flex;
              justify-content: space-between;
              width: 100%;
              margin-bottom: 8mm; /* Khoảng cách để cắt hàng ngang */
            }

            .bottom-row {
              display: flex;
              justify-content: center;
              width: 100%;
            }

            .v-line-shim {
              width: 4mm; /* Khoảng trống ở giữa 2 liên trên */
            }

            /* Hướng dẫn cắt vẽ tuyệt đối */
            .guide-v {
              position: absolute;
              left: 50%;
              top: 5mm;
              height: 64mm;
              border-left: 1pt dashed #000;
              z-index: 50;
            }
            .guide-h {
              position: absolute;
              top: 73mm; /* Nằm giữa 2 hàng */
              left: 5mm;
              right: 5mm;
              border-top: 1pt dashed #000;
              z-index: 50;
            }
            .scissor {
              position: absolute;
              font-size: 11px;
              background: #fff;
              padding: 0 2px;
              line-height: 1;
            }
            .guide-v .scissor { top: 50%; left: -6px; transform: translateY(-50%); }
            .guide-h .scissor { left: 50%; top: -6px; transform: translateX(-50%); }

            /* Container của mỗi liên - Thu nhỏ chiều cao */
            .lien-container {
              width: 98mm;
              height: 64mm; 
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
              border-bottom: 1.8pt solid #000;
              padding-bottom: 1mm;
              margin-bottom: 1.5mm;
            }

            .brand-name { font-size: 16px; font-weight: 900; line-height: 1; letter-spacing: 0.5px; }
            .print-time { font-size: 8px; margin-top: 1px; }
            .tag-side { font-size: 10px; font-weight: 800; text-transform: uppercase; border: 1.5pt solid #000; padding: 1px 5px; }

            .lien-body {
              flex: 1;
              display: flex;
              gap: 2mm;
              overflow: hidden;
            }

            .info-main { flex: 1; display: flex; flex-direction: column; gap: 1.2mm; }
            .info-aside { width: 30mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border-left: 1pt dashed #000; padding-left: 2mm; }

            .row { display: flex; gap: 2mm; }
            .full { width: 100%; flex-direction: column; }
            .cell { flex: 1; }

            .label { font-size: 7.5px; font-weight: 800; margin-bottom: 0.5px; text-transform: uppercase; }
            .value { font-size: 10.5px; font-weight: 700; line-height: 1; }
            
            .route-val { font-size: 10.5px; font-weight: 800; margin-top: 1px; }
            .route-val span { font-weight: 900; font-size: 13px; margin-right: 2px; }
            
            .seat-val { font-size: 15px; font-weight: 900; border-top: 1pt solid #000; padding-top: 0.5mm; margin-top: 0.5mm; line-height: 1.1; }

            .qr-box { border: 1pt solid #000; padding: 0.5mm; background: #fff; line-height: 0; }
            .total-box { width: 100%; text-align: center; border: 1.2pt solid #000; padding: 1mm 0; margin-top: 1mm; }
            .total-label { font-size: 7.5px; font-weight: 900; }
            .total-price { font-size: 14px; font-weight: 900; }

            .lien-footer {
              margin-top: 1.2mm;
              border-top: 1.5pt solid #000;
              padding-top: 1.2mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              font-weight: 800;
            }

            /* UI Toolbar */
            .no-print-bar {
              background: #000;
              color: #fff;
              padding: 12px;
              text-align: center;
              position: sticky;
              top: 0;
              z-index: 1000;
              border-bottom: 1pt solid #333;
            }
            .print-btn {
              background: #fff;
              color: #000;
              border: none;
              padding: 8px 50px;
              font-weight: 900;
              font-size: 14px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="no-print-bar">
            <button class="print-btn" onclick="window.print()">XÁC NHẬN IN PHIẾU (A5)</button>
            <p style="margin-top: 6px; font-size: 11px;">Cài đặt: <b>Khổ A5</b> • <b>Ngang (Landscape)</b> • <b>Tỷ lệ 100%</b></p>
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
