
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
      // Sử dụng QR đen trắng thuần túy
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}&color=0-0-0&bgcolor=ffffff`;

      const renderLien = (title: string) => `
        <div class="lien-container">
          <div class="lien-header">
            <div class="brand-box">
               <div class="brand">VINABUS</div>
               <div class="print-time">Ngày in: ${nowStr}</div>
            </div>
            <div class="lien-title">${title}</div>
          </div>
          
          <div class="lien-body">
            <div class="col-main">
              <div class="field-row">
                <div class="field">
                  <span class="label">MÃ ĐƠN HÀNG:</span>
                  <span class="value">#${(bookingId || '').slice(-6).toUpperCase()}</span>
                </div>
                <div class="field">
                  <span class="label">NGÀY ĐI:</span>
                  <span class="value">${new Date(trip.tripDate).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <div class="field-row">
                <div class="field">
                  <span class="label">SĐT KHÁCH:</span>
                  <span class="value">${bookingForm.phone || "---"}</span>
                </div>
                <div class="field">
                  <span class="label">BIỂN SỐ:</span>
                  <span class="value">${trip.licensePlate}</span>
                </div>
              </div>

              <div class="field">
                <span class="label">TUYẾN ĐƯỜNG:</span>
                <span class="value route-val">${trip.route}</span>
              </div>
              
              <div class="field">
                <span class="label">VỊ TRÍ GHẾ:</span>
                <span class="value seat-val">${seatLabels}</span>
              </div>
            </div>
            
            <div class="col-qr">
              <div class="qr-wrapper">
                <img src="${qrUrl}" width="70" height="70" />
              </div>
              <div class="payment-box">
                 <div class="total-label">TỔNG CẦN THU</div>
                 <div class="total-value">${formatCurrency(finalTotal)}đ</div>
              </div>
            </div>
          </div>

          <div class="lien-footer">
            <span class="pay-methods">THANH TOÁN: TM: ${formatCurrency(paidCash)} | CK: ${formatCurrency(paidTransfer)}</span>
            <span class="thanks">TRÂN TRỌNG CẢM ƠN!</span>
          </div>
        </div>
      `;

      return `
        <div class="page-a5-landscape">
          <div class="liens-wrapper">
            <div class="row-top">
              ${renderLien('LIÊN KHÁCH HÀNG')}
              ${renderLien('LIÊN SOÁT VÉ')}
            </div>
            <div class="row-bottom">
              ${renderLien('LIÊN ĐỐI SOÁT')}
            </div>
          </div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>PhieuVe_VINABUS_${(bookingId || '').slice(-6).toUpperCase()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            
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
              .page-a5-landscape { 
                page-break-after: always;
              }
            }

            /* Khổ giấy A5 Landscape chính xác 210mm x 148mm */
            .page-a5-landscape {
              width: 210mm;
              height: 148mm;
              margin: 0 auto;
              position: relative;
              overflow: hidden;
              padding: 4mm;
              display: flex;
              flex-direction: column;
              background: #fff;
            }

            .liens-wrapper {
              display: flex;
              flex-direction: column;
              height: 100%;
              width: 100%;
              gap: 4mm; /* Khoảng cách giữa hàng trên và hàng dưới */
            }

            .row-top {
              display: flex;
              gap: 4mm;
              height: 68mm;
              width: 100%;
            }

            .row-bottom {
              display: flex;
              justify-content: center;
              height: 68mm;
              width: 100%;
            }

            .lien-container {
              width: 99mm; /* Tính toán lại để khít lề */
              height: 68mm;
              border: 1.5pt solid #000;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              position: relative;
              background: #fff;
            }

            .lien-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2pt solid #000;
              padding-bottom: 1.5mm;
              margin-bottom: 2mm;
            }

            .brand-box { display: flex; flex-direction: column; }
            .brand { font-size: 14px; font-weight: 800; line-height: 1; letter-spacing: 1px; }
            .print-time { font-size: 8px; margin-top: 1mm; }
            .lien-title { font-size: 10px; font-weight: 800; text-transform: uppercase; border: 1pt solid #000; padding: 1px 5px; }

            .lien-body {
              flex: 1;
              display: flex;
              gap: 3mm;
            }

            .col-main { flex: 1; display: flex; flex-direction: column; gap: 2mm; }
            .col-qr { width: 30mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border-left: 1pt dashed #000; padding-left: 2mm; }

            .field-row { display: flex; gap: 4mm; }
            .field { display: flex; flex-direction: column; line-height: 1.1; }
            
            .label { font-size: 8px; font-weight: 700; margin-bottom: 1px; }
            .value { font-size: 11px; font-weight: 700; }
            
            .route-val { font-size: 11px; border-left: 3pt solid #000; padding-left: 2mm; }
            .seat-val { font-size: 12px; font-weight: 800; border-top: 1pt solid #000; padding-top: 1mm; margin-top: 1mm; }

            .qr-wrapper { border: 1pt solid #000; padding: 1mm; background: #fff; }

            .payment-box { width: 100%; text-align: center; border: 1pt solid #000; padding: 2mm 0; }
            .total-label { font-size: 8px; font-weight: 800; }
            .total-value { font-size: 13px; font-weight: 800; }

            .lien-footer {
              margin-top: 2mm;
              border-top: 1pt solid #000;
              padding-top: 1.5mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              font-weight: 700;
            }

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
              padding: 10px 50px;
              font-weight: 800;
              font-size: 16px;
              cursor: pointer;
            }
            .print-btn:hover { background: #eee; }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <button class="print-btn" onclick="window.print()">THỰC HIỆN IN PHIẾU</button>
            <p style="margin-top: 10px; font-size: 12px;">Cài đặt máy in: <b>Khổ A5 - Chiều ngang (Landscape) - Tỷ lệ 100%</b></p>
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
