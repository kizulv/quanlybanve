
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

    const pagesHtml = items.map((trip, tripIndex) => {
      const seatLabels = trip.seats.map((s: any) => s.label).join(", ");
      const baseUrl = window.location.origin + window.location.pathname;
      const qrData = `${baseUrl}?bookingId=${bookingId || ''}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}`;

      const renderLien = (title: string, customClass: string = "") => `
        <div class="lien-container ${customClass}">
          <div class="lien-header">
            <div class="brand-box">
               <div class="brand">VINABUS</div>
               <div class="print-time">In: ${nowStr}</div>
            </div>
            <div class="lien-title">${title}</div>
          </div>
          
          <div class="lien-body">
            <div class="col-main">
              <div class="field-row">
                <div class="field">
                  <span class="label">Mã đơn:</span>
                  <span class="value">#${(bookingId || '').slice(-6).toUpperCase()}</span>
                </div>
                <div class="field">
                  <span class="label">Ngày đi:</span>
                  <span class="value">${new Date(trip.tripDate).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <div class="field-row">
                <div class="field">
                  <span class="label">SĐT Khách:</span>
                  <span class="value phone-val">${bookingForm.phone || "---"}</span>
                </div>
                <div class="field">
                  <span class="label">Biển số:</span>
                  <span class="value">${trip.licensePlate}</span>
                </div>
              </div>

              <div class="field full-width">
                <span class="label">Tuyến đường:</span>
                <span class="value route-val">${trip.route}</span>
              </div>
              
              <div class="field full-width">
                <span class="label">Vị trí ghế:</span>
                <span class="value seat-val">${seatLabels}</span>
              </div>
            </div>
            
            <div class="col-qr">
              <div class="qr-wrapper">
                <img src="${qrUrl}" />
              </div>
              <div class="payment-summary">
                 <div class="total-label">TỔNG THU</div>
                 <div class="total-value">${formatCurrency(finalTotal)}đ</div>
              </div>
            </div>
          </div>

          <div class="lien-footer">
            <span class="pay-methods">TM: ${formatCurrency(paidCash)} | CK: ${formatCurrency(paidTransfer)}</span>
            <span class="thanks">Cảm ơn & Hẹn gặp lại!</span>
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
          <title>In vé VINABUS - #${(bookingId || '').slice(-6).toUpperCase()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0; 
              background: #f8fafc;
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
                margin: 0;
              }
            }

            .page-a5-landscape {
              background: white;
              width: 210mm;
              height: 148mm;
              margin: 0 auto;
              box-sizing: border-box;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 4mm;
            }

            .liens-wrapper {
              display: flex;
              flex-direction: column;
              gap: 4mm;
              width: 100%;
              height: 100%;
              justify-content: center;
              align-items: center;
            }

            .row-top {
              display: flex;
              gap: 4mm;
              width: 100%;
              justify-content: center;
            }

            .row-bottom {
              width: 100%;
              display: flex;
              justify-content: center;
            }

            .lien-container {
              width: 98mm;
              height: 68mm;
              border: 1pt solid #000;
              padding: 2.5mm 3.5mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              position: relative;
              background: #fff;
              border-radius: 4px;
            }

            .lien-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 1.5pt solid #000;
              padding-bottom: 1.5mm;
              margin-bottom: 2mm;
            }

            .brand-box { display: flex; flex-direction: column; }
            .brand { font-size: 13px; font-weight: 800; color: #1e40af; letter-spacing: 0.8px; line-height: 1; }
            .print-time { font-size: 7px; color: #64748b; font-style: italic; margin-top: 1mm; }
            .lien-title { font-size: 9px; font-weight: 800; color: #000; text-transform: uppercase; background: #f1f5f9; padding: 1px 4px; border-radius: 2px; }

            .lien-body {
              flex: 1;
              display: flex;
              gap: 3mm;
            }

            .col-main { flex: 1; display: flex; flex-direction: column; gap: 1.5mm; }
            .col-qr { width: 32mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding-left: 2mm; border-left: 0.5pt dashed #ccc; }

            .field-row { display: flex; gap: 4mm; }
            .field { display: flex; flex-direction: column; flex: 1; line-height: 1.2; }
            .full-width { width: 100%; }
            
            .label { font-size: 7.5px; color: #475569; text-transform: uppercase; font-weight: 700; margin-bottom: 0.2mm; }
            .value { font-size: 10.5px; font-weight: 700; color: #000; }
            
            .phone-val { color: #1e40af; font-size: 11px; }
            .route-val { font-size: 11px; color: #000; border-left: 2pt solid #1e40af; padding-left: 2mm; }
            .seat-val { font-size: 12px; color: #b91c1c; font-weight: 800; }

            .qr-wrapper { width: 22mm; height: 22mm; background: #fff; display: flex; align-items: center; justify-content: center; }
            .qr-wrapper img { width: 100%; height: 100%; }

            .payment-summary { width: 100%; text-align: center; background: #f8fafc; padding: 1.5mm 0; border: 0.5pt solid #e2e8f0; border-radius: 4px; }
            .total-label { font-size: 7px; font-weight: 800; color: #475569; }
            .total-value { font-size: 13px; font-weight: 800; color: #b91c1c; }

            .lien-footer {
              margin-top: 2mm;
              border-top: 0.5pt solid #000;
              padding-top: 1.5mm;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 7.5px;
              color: #475569;
              font-weight: 600;
            }
            .pay-methods { background: #f1f5f9; padding: 1px 4px; border-radius: 2px; }
            .thanks { font-style: italic; color: #94a3b8; }

            .no-print-bar {
              background: #0f172a;
              color: white;
              padding: 14px;
              text-align: center;
              position: sticky;
              top: 0;
              z-index: 1000;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            
            .print-btn {
              background: #2563eb;
              color: white;
              border: none;
              padding: 12px 48px;
              border-radius: 8px;
              font-weight: 800;
              font-size: 15px;
              cursor: pointer;
              box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <button class="print-btn" onclick="window.print()">BẮT ĐẦU IN VÉ (A5 LANDSCAPE)</button>
            <div style="margin-top: 8px; font-size: 12px; opacity: 0.7; font-weight: 500;">
              Khổ A5 Ngang • 3 Liên Tối Ưu (98x68mm) • 1 Vé/Trang
            </div>
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
