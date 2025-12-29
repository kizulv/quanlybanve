
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
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(qrData)}`;

      const renderLien = (title: string) => `
        <div class="lien-container">
          <div class="lien-header">
            <div class="brand">VINABUS</div>
            <div class="title">${title}</div>
          </div>
          
          <div class="lien-body">
            <div class="col-left">
              <div class="field">
                <span class="label">Mã đơn:</span>
                <span class="value">#${(bookingId || '').slice(-6).toUpperCase()}</span>
              </div>
              <div class="field">
                <span class="label">Ngày đi:</span>
                <span class="value">${new Date(trip.tripDate).toLocaleDateString('vi-VN')}</span>
              </div>
              <div class="field">
                <span class="label">Biển số:</span>
                <span class="value">${trip.licensePlate}</span>
              </div>
              <div class="field">
                <span class="label">Tuyến:</span>
                <span class="value route-val">${trip.route}</span>
              </div>
            </div>
            
            <div class="col-right">
              <div class="field">
                <span class="label">SĐT:</span>
                <span class="value">${bookingForm.phone || "---"}</span>
              </div>
              <div class="field">
                <span class="label">Ghế:</span>
                <span class="value seat-val">${seatLabels}</span>
              </div>
              <div class="qr-box">
                <img src="${qrUrl}" width="38" height="38" />
              </div>
            </div>
          </div>

          <div class="lien-footer">
            <div class="payment-info">
              T.Toán: <strong>${formatCurrency(finalTotal)}đ</strong> 
              <span class="pay-detail">(TM:${formatCurrency(paidCash)}|CK:${formatCurrency(paidTransfer)})</span>
            </div>
            <div class="print-time">${nowStr}</div>
          </div>
        </div>
      `;

      return `
        <div class="page-a5-portrait">
          <div class="liens-wrapper">
            ${renderLien('LIÊN 1: KHÁCH HÀNG')}
            <div class="cut-line">✂---------------------------------------------------</div>
            ${renderLien('LIÊN 2: SOÁT VÉ')}
            <div class="cut-line">✂---------------------------------------------------</div>
            ${renderLien('LIÊN 3: ĐỐI SOÁT')}
          </div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>In vé 85x55 - #${(bookingId || '').slice(-6).toUpperCase()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0; 
              background: #f1f5f9;
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
              padding: 10mm 0;
            }

            .liens-wrapper {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 4mm;
            }

            .lien-container {
              width: 85mm;
              height: 55mm;
              border: 0.5pt solid #000;
              padding: 2mm 3mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              position: relative;
              background: #fff;
            }

            .cut-line {
              font-size: 8px;
              color: #94a3b8;
              width: 120mm;
              text-align: center;
              margin: 1mm 0;
            }

            .lien-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 0.8pt solid #000;
              padding-bottom: 1mm;
              margin-bottom: 1.5mm;
            }

            .brand { font-size: 11px; font-weight: 800; color: #1e40af; letter-spacing: 0.5px; }
            .title { font-size: 8px; font-weight: 700; color: #475569; }

            .lien-body {
              flex: 1;
              display: flex;
              gap: 2mm;
            }

            .col-left { flex: 1.3; display: flex; flex-direction: column; gap: 0.8mm; }
            .col-right { flex: 1; display: flex; flex-direction: column; gap: 0.8mm; align-items: flex-end; }

            .field { display: flex; flex-direction: column; line-height: 1.1; }
            .label { font-size: 6.5px; color: #64748b; text-transform: uppercase; font-weight: 600; }
            .value { font-size: 9px; font-weight: 700; color: #000; }
            
            .route-val { font-size: 9.5px; color: #1e40af; }
            .seat-val { font-size: 10px; color: #b91c1c; }

            .qr-box {
              margin-top: auto;
              border: 0.2pt solid #e2e8f0;
              padding: 0.5mm;
              background: #f8fafc;
            }

            .lien-footer {
              margin-top: 1mm;
              border-top: 0.5pt dashed #ccc;
              padding-top: 1mm;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }

            .payment-info { font-size: 8px; color: #000; }
            .payment-info strong { font-size: 10px; color: #b91c1c; }
            .pay-detail { font-size: 6.5px; color: #64748b; margin-left: 1mm; }
            
            .print-time { font-size: 6.5px; color: #94a3b8; font-style: italic; }

            .no-print-bar {
              background: #0f172a;
              color: white;
              padding: 12px;
              text-align: center;
              position: sticky;
              top: 0;
              z-index: 1000;
              box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }
            
            .print-btn {
              background: #2563eb;
              color: white;
              border: none;
              padding: 10px 30px;
              border-radius: 6px;
              font-weight: 700;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <button class="print-btn" onclick="window.print()">IN PHIẾU (KHỔ 85x55mm)</button>
            <div style="margin-top: 5px; font-size: 11px; opacity: 0.7;">Máy in A5 Portrait • 3 liên/trang</div>
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
