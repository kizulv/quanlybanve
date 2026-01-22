import React from "react";
import { Printer, ChevronDown } from "lucide-react";
import { Button } from "../ui/Button";
import { Popover } from "../ui/Popover";
import { BusTrip, Booking, BusType, Seat, SeatStatus } from "../../types";
import { formatLunarDate } from "../../utils/dateUtils";
import { useToast } from "../ui/Toast";

interface ManifestPrintProps {
  selectedTrip: BusTrip | null;
  manifest: Booking[];
  disabled?: boolean;
}

export const ManifestPrint: React.FC<ManifestPrintProps> = ({
  selectedTrip,
  manifest,
  disabled = false,
}) => {
  const { toast } = useToast();

  const handlePrint = (template: "default" | "list_a4" = "default") => {
    if (!selectedTrip) return;

    const manifestWindow = window.open("", "_blank");
    if (!manifestWindow) {
      toast({
        type: "error",
        title: "Lỗi trình duyệt",
        message: "Vui lòng cho phép trình duyệt mở tab mới để in bảng kê.",
      });
      return;
    }

    const tripDate = new Date(selectedTrip.departureTime);
    const dateFormatted = `${tripDate.getDate()}/${
      tripDate.getMonth() + 1
    }/${tripDate.getFullYear()}`;
    const lunarFormatted = formatLunarDate(tripDate);

    const seatDataMap = new Map<
      string,
      {
        phone: string;
        pickup: string;
        dropoff: string;
        price: number;
        note: string;
        status: "sold" | "booked" | "held";
        exactBed?: boolean; // ✅ Xếp đúng giường
        groupIndex?: number;
        groupTotal?: number;
      }
    >();

    manifest.forEach((booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip.id);
      if (!tripItem) return;

      const isHold = booking.status === "hold";
      const status =
        booking.status === "payment" ? "sold" : isHold ? "held" : "booked";

      // Lấy danh sách seatIds và sắp xếp để đánh số thứ tự ổn định
      const seatIds = [...tripItem.seatIds].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      );
      const groupTotal = seatIds.length;

      tripItem.seatIds.forEach((seatId) => {
        const ticket = tripItem.tickets?.find((t) => t.seatId === seatId);
        const groupIndex = seatIds.indexOf(seatId) + 1;

        // Determine granular status for this specific seat
        let seatStatus: "sold" | "booked" | "held" = "booked";
        if (ticket?.status === "hold") {
          seatStatus = "held";
        } else if (ticket?.status === "payment") {
          seatStatus = "sold";
        } else {
          // Fallback to booking level status if ticket status is ambiguous but booking says payment
          // actually, if price is 0, it should probably remain 'booked' even if booking is 'payment' (partial payment scenario?)
          // But let's stick to the rule: Price > 0 = Sold/Payment.
          seatStatus = "booked";
        }

        // Special case: Override if booking is strictly HOLD
        if (booking.status === "hold") seatStatus = "held";

        seatDataMap.set(seatId, {
          phone: booking.passenger.phone,
          pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
          dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
          price: ticket?.price || 0,
          // FIX: Ưu tiên ghi chú của từng vé, sau đó mới đến ghi chú chung của khách hàng
          note: ticket?.note || booking.passenger.note || "",
          status: seatStatus,
          exactBed: ticket?.exactBed, // ✅ Load exactBed
          groupIndex,
          groupTotal,
        });
      });
    });

    (selectedTrip.seats || []).forEach((s) => {
      if (s.status === SeatStatus.HELD && !seatDataMap.has(s.id)) {
        seatDataMap.set(s.id, {
          phone: "---",
          pickup: "---",
          dropoff: "---",
          price: 0,
          note: s.note || "",
          status: "held",
        });
      }
    });

    // TÍNH TỔNG TIỀN VÉ
    const totalAmount = Array.from(seatDataMap.values()).reduce(
      (sum, data) => sum + (data.status === "sold" ? data.price : 0),
      0,
    );

    const isCabin = selectedTrip.type === BusType.CABIN;
    const isListLayout = template === "list_a4";

    // Page Style setup
    let pageStyle = "";
    if (isListLayout) {
      pageStyle = "size: A4 portrait; margin: 5mm;";
    } else {
      pageStyle = isCabin
        ? "size: A4 landscape; margin: 3mm;"
        : "size: A4 portrait; margin: 0;";
    }

    const A4_margin =
      isCabin && !isListLayout ? "margin-left: 20mm;" : "margin-top: 0;";
    // Default layout constants
    const A4_LayoutHeight = isCabin ? "h-[170px]" : "h-[190px]";
    const Manifest_RecordHight = isCabin ? "h-[98px]" : "h-[108px]";
    const Manifest_SeatFontSize = isCabin ? "text-[12px]" : "text-[10px]";
    let layoutHtml = "";

    const renderSeatHtml = (seat: Seat | undefined) => {
      if (!seat)
        return `<div class="border-transparent bg-transparent ${Manifest_RecordHight}"></div>`;

      const data = seatDataMap.get(seat.id);
      const label = seat.label;

      if (!data) {
        return `
        <div class="border-2 border-slate-900 flex flex-col p-1 relative overflow-hidden ${Manifest_RecordHight}">
          <div class="flex justify-between items-center border-b border-black/5 pb-0.5">
            <span class="font-black text-[11px] text-black leading-none">${label}</span>
          </div>
          <div class="flex-1 flex flex-col justify-between overflow-hidden">
            <div class="flex-1 border-b border-gray-300 opacity-50"></div>
            <div class="flex-1 border-b border-gray-300 opacity-50"></div>
            <div class="flex-1 border-b border-gray-300 opacity-50"></div>
          </div>
        </div>
        `;
      }

      const statusColors = {
        sold: "border-slate-600 bg-slate-200",
        booked: "border-slate-600",
        held: "border-slate-600",
      };

      // Case: HELD - Only show label and note
      if (data.status === "held") {
        return `
          <div class="border-2 flex flex-col p-1 relative overflow-hidden ${
            statusColors.held
          } ${Manifest_RecordHight} ">
            <div class="flex justify-between items-center border-b border-black/5 pb-0.5 mb-1">
              <span class="font-black text-[11px] text-black leading-none">${label}</span>
            </div>
            <div class="flex-1 flex flex-col items-center justify-center text-center overflow-hidden">
              <div class="text-[10px] leading-tight italic font-medium w-full truncate px-1">
                ${data.note || ""}
              </div>
            </div>
          </div>
        `;
      }

      // Case: SOLD or BOOKED - Full Info
      return `
        <div class="border-2 flex flex-col p-1 relative overflow-hidden ${
          statusColors[data.status]
        } ${Manifest_RecordHight} ${data.exactBed ? "bg-slate-100" : ""}">
          <div class="flex justify-between items-center border-b border-black/5 pb-0.5 mb-1">
            <span class="font-black text-[11px] text-black leading-none">${label}</span>
            ${
              data.status === "sold"
                ? `<div class="text-[8px] font-semibold">Đã TT: ${
                    data.price / 1000
                  }</div>`
                : `<div class="font-semibold text-[8px]">${
                    data.exactBed ? "Chưa TT - Xếp đúng chỗ" : ""
                  }</div>`
            }
          </div>
          <div class="flex-1 flex flex-col overflow-hidden text-center">
            <div class="flex justify-center">
            <span class="font-black ${Manifest_SeatFontSize} leading-tight mr-1">${
              data.phone
            }</span>
            ${
              data.groupTotal && data.groupTotal > 1
                ? ` <span class="text-[10px] font-normal">(${data.groupIndex}/${data.groupTotal})</span>`
                : ""
            }</div>
            <div class="${Manifest_SeatFontSize} leading-tight opacity-90 mt-0.5">${
              data.pickup || "---"
            } - ${data.dropoff || "---"}</div>
            <div class="text-[10px] leading-tight opacity-90 mt-1 italic">${
              data.note || ""
            }</div>
          </div>
        </div>
      `;
    };

    if (isListLayout) {
      // --- LOGIC FOR A4 LIST LAYOUT ---
      const allSeats = [...(selectedTrip.seats || [])];

      const regularSeats = allSeats.filter((s) => !s.isFloorSeat);
      const floorSeats = allSeats.filter((s) => s.isFloorSeat);

      // Group Regular Seats by Row.Floor (e.g., 1.1, 1.2)
      const groupMap = new Map<string, Seat[]>();

      regularSeats.forEach((seat) => {
        const row = (seat.row || 0) + 1; // 1-based index
        const floor = seat.floor || 1;
        const key = `${row}.${floor}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)?.push(seat);
      });

      // Sort Group Keys (1.1, 1.2, 2.1, 2.2...)
      const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => {
        const [rA, fA] = a.split(".").map(Number);
        const [rB, fB] = b.split(".").map(Number);
        if (rA !== rB) return rA - rB;
        return fA - fB;
      });

      // Sort seats within each group by Column (Left -> Right)
      sortedKeys.forEach((key) => {
        groupMap.get(key)?.sort((a, b) => (a.col || 0) - (b.col || 0));
      });

      // Prepare final groups list including Floor seats
      const groups: { label: string; seats: Seat[] }[] = [];

      // Add Regular Groups
      sortedKeys.forEach((key) => {
        groups.push({
          label: key,
          seats: groupMap.get(key) || [],
        });
      });

      // Floor seats will be handled separately at the end
      // as a summary below the table

      layoutHtml = `
            <table class="w-full border-collapse border border-slate-900 text-xs" style="table-layout: fixed;">
                <colgroup>
                    <col style="width: 5%;"> <!-- STT/Group -->
                    <col style="width: 5%;"> <!-- Số -->
                    <col style="width: 31%;"> <!-- SĐT -->
                    <col style="width: 16%;"> <!-- Nơi đón -->
                    <col style="width: 16%;"> <!-- Nơi trả -->
                    <col style="width: 7%;"> <!-- Giá vé -->
                    <col style="width: 20%;"> <!-- Ghi chú -->
                </colgroup>
                <thead>
                    <tr class="bg-gray-100">
                        <th class="border border-slate-900 py-1 px-1 text-center h-7"></th>
                        <th class="border border-slate-900 py-1 px-1 text-center">Số</th>
                        <th class="border border-slate-900 py-1 px-1 text-center">Số điện thoại</th>
                        <th class="border border-slate-900 py-1 px-1 text-center">Nơi đón</th>
                        <th class="border border-slate-900 py-1 px-1 text-center">Nơi trả</th>
                        <th class="border border-slate-900 py-1 px-1 text-center">Giá</th>
                        <th class="border border-slate-900 py-1 px-1 text-center">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
        `;

      groups.forEach((group) => {
        group.seats.forEach((seat, index) => {
          const data = seatDataMap.get(seat.id);
          const label = seat.label;
          const isFirstInGroup = index === 0;

          let rowClass = "h-5.5";
          if (data) {
            if (data.status === "sold") {
              rowClass += " bg-slate-200";
            } else if (data.status === "booked" && data.exactBed) {
              rowClass += " bg-slate-100";
            }
          }

          layoutHtml += `<tr class="${rowClass}">`;

          // First Column with Rowspan (Group Label: 1.1, 1.2...)
          if (isFirstInGroup) {
            // Hide label for "Băng 5" (usually has more than 3 seats)
            const showGroupLabel = group.seats.length <= 3;
            layoutHtml += `<td class="border border-slate-900 py-0.5 px-1 text-center font-bold align-middle bg-white" rowspan="${group.seats.length}">${showGroupLabel ? group.label : ""}</td>`;
          }

          // Seat Number with Vertical Line Indicator
          let numberCellContent = label;
          let isConnectedTop = false;
          let isConnectedBottom = false;

          if (data && data.phone && data.phone !== "---") {
            // Check connections for seamless vertical line
            if (index > 0) {
              const prevSeat = group.seats[index - 1];
              const prevData = seatDataMap.get(prevSeat.id);
              if (prevData && prevData.phone === data.phone) {
                isConnectedTop = true;
              }
            }

            if (index < group.seats.length - 1) {
              const nextSeat = group.seats[index + 1];
              const nextData = seatDataMap.get(nextSeat.id);
              if (nextData && nextData.phone === data.phone) {
                isConnectedBottom = true;
              }
            }

            const topStyle = isConnectedTop ? "top-[-5px]" : "top-[20%]";
            const bottomStyle = isConnectedBottom
              ? "bottom-[-5px]"
              : "bottom-[20%]";

            const isExactBed = data?.exactBed;
            const circleClass = isExactBed
              ? "border border-slate-900 rounded-full w-4 h-4 flex items-center justify-center bg-white text-[10px]"
              : "";

            numberCellContent = `
                <div class="absolute left-1.75 w-0.5 bg-slate-900 z-10 h-auto ${topStyle} ${bottomStyle}"></div>
                <div class="relative w-full h-full flex items-center justify-center">
                    <span class="relative z-20 ${circleClass}">${label}</span>
                </div>
             `;
          } else {
            const isExactBed = data?.exactBed;
            if (isExactBed) {
              numberCellContent = `
                    <div class="relative w-full h-full flex items-center justify-center">
                        <span class="border border-slate-900 rounded-full w-4 h-4 flex items-center justify-center bg-white text-[10px]">${label}</span>
                    </div>
                 `;
            }
          }

          layoutHtml += `<td class="border border-slate-900 py-0.5 px-1 text-center font-bold p-0 relative align-middle">${numberCellContent}</td>`;

          // Data Columns
          if (data) {
            // Only show info if it's the start of a sequence (or unique)
            const showInfo = !isConnectedTop;

            let phoneContent = "";
            let pickupContent = "";
            let dropoffContent = "";
            let noteContent = "";
            let priceContent = "";

            if (showInfo) {
              phoneContent = data.phone;
              pickupContent = data.pickup;
              dropoffContent = data.dropoff;
              noteContent = data.note;

              // Calculate Total Price for the Group (Same Phone)
              if (data.phone && data.phone !== "---") {
                let totalPrice = 0;
                // Sum only for the current contiguous group within this row
                for (let i = index; i < group.seats.length; i++) {
                  const s = group.seats[i];
                  const d = seatDataMap.get(s.id);
                  if (d && d.phone === data.phone) {
                    totalPrice += d.price || 0;
                  } else {
                    break;
                  }
                }

                if (totalPrice > 0) {
                  priceContent = (totalPrice / 1000).toLocaleString("vi-VN");
                }
              } else {
                // No phone or "---", just show this ticket's price
                if (data.price > 0) {
                  priceContent = (data.price / 1000).toLocaleString("vi-VN");
                }
              }
            } else {
              // Check if it's the second row of the group
              // It is the second row if it is connected to top (current row)
              // AND (it's index 1 OR the one before prev (index-2) was NOT connected or different phone)
              // Simpler: Check if index-1 was the start (!isConnectedTop of index-1)
              // But we don't have easy access to index-1's computed isConnectedTop here without recomputing or looking at data

              let isSecondRow = false;
              if (index > 0) {
                // We know isConnectedTop is true here (because else !showInfo)
                // So group.seats[index-1] has same phone.
                // We just need to check if group.seats[index-2] has DIFFERENT phone or doesn't exist.
                if (index === 1) {
                  isSecondRow = true;
                } else {
                  const prevPrevSeat = group.seats[index - 2];
                  const prevPrevData = seatDataMap.get(prevPrevSeat.id);
                  if (!prevPrevData || prevPrevData.phone !== data.phone) {
                    isSecondRow = true;
                  }
                }
              }

              if (isSecondRow && data.phone && data.phone !== "---") {
                // Calculate stats
                let totalCount = 0;
                let visualGroupCount = 0;
                let seatLabels: string[] = [];

                // New logic for exactBed
                let exactBedCount = 0;
                let exactBedLabels: string[] = [];

                groups.forEach((g) => {
                  g.seats.forEach((s, idx) => {
                    const d = seatDataMap.get(s.id);
                    if (d && d.phone === data.phone) {
                      totalCount++;
                      seatLabels.push(s.label);

                      if (d.exactBed) {
                        exactBedCount++;
                        exactBedLabels.push(s.label);
                      }

                      // Check if start of new visual group
                      // A start is if idx==0 OR prev seat in this group has different phone/no data
                      let isStart = false;
                      if (idx === 0) {
                        isStart = true;
                      } else {
                        const prev = g.seats[idx - 1];
                        const prevD = seatDataMap.get(prev.id);
                        if (!prevD || prevD.phone !== data.phone) {
                          isStart = true;
                        }
                      }

                      if (isStart) {
                        visualGroupCount++;
                      }
                    }
                  });
                });

                // Only show if > 1 visual group (discontiguous)
                if (totalCount > 1 && visualGroupCount > 1) {
                  const isSold = data.status === "sold";
                  if (exactBedCount > 0) {
                    phoneContent = `<div class="text-[10px] italic font-normal text-slate-600">(Tổng: ${totalCount} - Xếp đúng giường: ${exactBedLabels.join(", ")})</div>`;
                  } else if (isSold) {
                    phoneContent = `<div class="text-[10px] italic font-normal text-slate-600">(Tổng: ${totalCount} - Giường: ${seatLabels.join(", ")})</div>`;
                  } else {
                    phoneContent = `<div class="text-[10px] italic font-normal text-slate-600">(Tổng ${totalCount} Giường - Chưa sắp chỗ)</div>`;
                  }
                }
              }
            }

            layoutHtml += `
                <td class="border border-slate-900 py-0.5 px-1 text-center font-bold truncate">${phoneContent}</td>
                <td class="border border-slate-900 py-0.5 px-1 truncate text-center">${pickupContent}</td>
                <td class="border border-slate-900 py-0.5 px-1 truncate text-center">${dropoffContent}</td>
                <td class="border border-slate-900 py-0.5 px-1 text-center">${priceContent}</td>
                <td class="border border-slate-900 py-0.5 px-1 italic text-[10px] wrap-break-word">${noteContent}</td>
            `;
          } else {
            // Empty data
            layoutHtml += `
                        <td class="border border-slate-900 py-0.5 px-1"></td>
                        <td class="border border-slate-900 py-0.5 px-1"></td>
                        <td class="border border-slate-900 py-0.5 px-1"></td>
                        <td class="border border-slate-900 py-0.5 px-1"></td>
                        <td class="border border-slate-900 py-0.5 px-1"></td>
                    `;
          }

          layoutHtml += `</tr>`;
        });
      });

      layoutHtml += `</tbody></table>`;

      // Render Floor Seat Summary (below table, no border)
      // Format: [Note] [Phone] [Pickup]-[Dropoff] (Grid 3 cols)
      if (floorSeats.length > 0) {
        // Group floor seats by Phone
        const floorGroupByPhone = new Map<
          string,
          {
            count: number;
            phone: string;
            pickup: string;
            dropoff: string;
            label: string;
            note: string;
          }
        >();
        const noPhoneSeats: Seat[] = [];

        floorSeats.forEach((seat) => {
          const data = seatDataMap.get(seat.id);
          if (data && data.phone && data.phone !== "---") {
            if (!floorGroupByPhone.has(data.phone)) {
              floorGroupByPhone.set(data.phone, {
                count: 0,
                phone: data.phone,
                pickup: data.pickup || "",
                dropoff: data.dropoff || "",
                label: seat.label,
                note: data.note || "",
              });
            }
            const entry = floorGroupByPhone.get(data.phone);
            if (entry) {
              entry.count++;
            }
          } else {
            noPhoneSeats.push(seat);
          }
        });

        // Grid Layout: 3 columns, auto rows (user asked for 2 rows, assuming data fits or flows)
        layoutHtml += `<div class="mt-2 text-[11px] font-bold font-mono grid grid-cols-3 gap-y-1 gap-x-2">`;

        floorGroupByPhone.forEach((entry) => {
          // Note should be displayed first.
          const notePart = entry.note
            ? `<span class="mr-1">${entry.note} - </span>`
            : "";
          layoutHtml += `<div>${notePart}${entry.phone} ${entry.pickup}-${entry.dropoff}</div>`;
        });

        layoutHtml += `</div>`;
      }
    } else if (isCabin) {
      const regularSeats = (selectedTrip.seats || []).filter(
        (s) => !s.isFloorSeat,
      );
      const floorSeats = (selectedTrip.seats || [])
        .filter((s) => s.isFloorSeat)
        .sort((a, b) => (a.row || 0) - (b.row || 0));
      const colB = regularSeats.filter((s) => s.col === 0);
      const colA = regularSeats.filter((s) => s.col === 1);
      const rows = [0, 1, 2, 3, 4, 5];

      layoutHtml = `
        <div class="flex gap-4 w-full h-[170mm] overflow-hidden">
          <div class="flex-1 flex flex-col">
            <div class="text-sm font-bold py-1 px-2 mb-1.5 text-center uppercase tracking-wider">Dãy B</div>
            <div class="flex flex-col justify-around h-full">
              ${rows
                .map(
                  (r) => `
                <div class="grid grid-cols-2 gap-1.5">
                  ${renderSeatHtml(
                    colB.find((s) => s.row === r && s.floor === 1),
                  )}
                  ${renderSeatHtml(
                    colB.find((s) => s.row === r && s.floor === 2),
                  )}
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
          <div class="w-45 flex flex-col">
            <div class="text-sm font-bold py-1 px-2 mb-1.5 text-center uppercase tracking-wider">SÀN</div>
            <div class="flex flex-col justify-around h-full">
              ${[0, 1, 2, 3, 4, 5]
                .map((i) => renderSeatHtml(floorSeats[i]))
                .join("")}
            </div>
          </div>
          <div class="flex-1 flex flex-col">
            <div class="text-sm font-bold py-1 px-2 mb-1.5 text-center uppercase tracking-wider">Dãy A</div>
            <div class="flex flex-col justify-around h-full">
              ${rows
                .map(
                  (r) => `
                <div class="grid grid-cols-2 gap-1.5">
                  ${renderSeatHtml(
                    colA.find((s) => s.row === r && s.floor === 1),
                  )}
                  ${renderSeatHtml(
                    colA.find((s) => s.row === r && s.floor === 2),
                  )}
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
      `;
    } else {
      const floorSeats = (selectedTrip.seats || [])
        .filter((s) => s.isFloorSeat)
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        );

      const benchSeatsF1 = (selectedTrip.seats || [])
        .filter(
          (s) =>
            s.floor === 1 &&
            !s.isFloorSeat &&
            (s.row === 6 ||
              (s.id && s.id.startsWith("B1-")) ||
              (s.label && s.label.startsWith("B1-"))),
        )
        .sort((a, b) => (a.col || 0) - (b.col || 0));

      const benchSeatsF2 = (selectedTrip.seats || [])
        .filter(
          (s) =>
            s.floor === 2 &&
            !s.isFloorSeat &&
            (s.row === 6 ||
              (s.id && s.id.startsWith("B2-")) ||
              (s.label && s.label.startsWith("B2-"))),
        )
        .sort((a, b) => (a.col || 0) - (b.col || 0));

      layoutHtml = `<div class="grid grid-cols-2 gap-4 h-[190mm] overflow-hidden">`;
      [1, 2].forEach((floor) => {
        layoutHtml += `
          <div class="bg-white">
            <div class="flex flex-col items-center text-sm font-bold py-1 px-3 rounded mb-1 uppercase">Tầng ${floor}</div>
            <div class="grid grid-cols-3 gap-1.5">
              ${[0, 1, 2, 3, 4, 5]
                .map((r) =>
                  [0, 1, 2]
                    .map((c) =>
                      renderSeatHtml(
                        (selectedTrip.seats || []).find(
                          (s) =>
                            s.floor === floor &&
                            s.row === r &&
                            s.col === c &&
                            !s.isFloorSeat,
                        ),
                      ),
                    )
                    .join(""),
                )
                .join("")}
            </div>
          </div>
        `;
      });
      layoutHtml += `</div>`;

      if (benchSeatsF1.length > 0 || benchSeatsF2.length > 0) {
        layoutHtml += `<div class="pt-2 space-y-1">`;
        if (benchSeatsF1.length > 0) {
          layoutHtml += `
              <div>
                <div class="grid gap-1" style="grid-template-columns: repeat(${
                  benchSeatsF1.length
                }, 1fr)">
                  ${benchSeatsF1.map((s) => renderSeatHtml(s)).join("")}
                </div>
              </div>
            `;
        }
        if (benchSeatsF2.length > 0) {
          layoutHtml += `
              <div class="">
                <div class="grid gap-1" style="grid-template-columns: repeat(${
                  benchSeatsF2.length
                }, 1fr)">
                  ${benchSeatsF2.map((s) => renderSeatHtml(s)).join("")}
                </div>
              </div>
            `;
        }
        layoutHtml += `</div>`;
      }

      if (floorSeats.length > 0) {
        layoutHtml += `
            <div class="pt-2">
              <div class="text-center font-black text-2.5 uppercase mb-1.5 tracking-widest text-slate-500">SÀN</div>
              <div class="grid grid-cols-6 gap-1.5 justify-center">
                ${floorSeats
                  .slice(0, 6)
                  .map((s) => renderSeatHtml(s))
                  .join("")}
              </div>
            </div>
          `;
      }
    }

    const styles = Array.from(
      document.querySelectorAll("style, link[rel='stylesheet']"),
    )
      .map((el) => el.outerHTML)
      .join("\n");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng kê - ${dateFormatted} (${lunarFormatted}) - ${
          selectedTrip.licensePlate
        }</title>
        <meta charset="UTF-8">
        ${styles}
        <style>
          @page { ${pageStyle}}
          @media print {
            .no-print { display: none; }
            body { padding: 0; margin: 0; }
            .container-page { height: 100vh; max-height: 100vh; overflow: hidden; }
          }
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; background: white; }
          .container-page { width: 100%; margin: 0 auto; display: flex; flex-direction: column; }
        </style>
      </head>
      <body class="p-0 flex flex-col h-full" style="${A4_margin}">
        <div class="container-page px-4 max-w-[297mm] bg-white pb-4">
          <div class="flex justify-between items-center border-b-2 border-black py-2 mb-1">
            <div class="flex flex-col">
              <h1 class="text-md font-black uppercase leading-tight">BẢNG KÊ TUYẾN: ${
                selectedTrip.route
              }</h1>
              <span class="text-sm font-bold text-slate-500 uppercase tracking-widest">XUẤT BẾN:  ${
                selectedTrip.departureTime.split(" ")[1]
              }</span>
            </div>
            
            <div class="text-right flex items-center gap-4">
              <div class="flex flex-col items-end px-4 border-r border-slate-300">
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Đã thanh toán:</span>
                <span class="text-lg font-black text-red-600 leading-none">${totalAmount.toLocaleString(
                  "vi-VN",
                )} đ</span>
              </div>
              <span class="bg-white border-2 border-slate-900 text-slate-900 px-3 py-1 rounded text-lg font-black">${
                selectedTrip.licensePlate
              }</span>
              <div class="flex flex-col text-right">
                <span class="text-md font-bold">${dateFormatted}</span>
                <span class="text-xs font-bold text-slate-500 uppercase">${lunarFormatted}</span>
              </div>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-hidden">
            ${layoutHtml}
          </div>
          <div class="flex justify-between items-center text-slate-500 text-[10px] shrink-0 mt-2">
            <div>Thời gian in: ${new Date().toLocaleString("vi-VN")} </div>
            <div class="no-print">
               <button onclick="window.print()" class="bg-slate-900 text-white hover:bg-slate-700 px-8 py-2 rounded text-sm font-bold uppercase tracking-wider">In bảng kê</button>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    manifestWindow.document.write(htmlContent);
    manifestWindow.document.close();
  };

  // Check if bus type is Cabin or similar
  const isCabinOrDouble =
    selectedTrip &&
    (selectedTrip.type === BusType.CABIN ||
      (selectedTrip.type as unknown as string) === "Giường Đôi" ||
      (selectedTrip as any).busType?.includes("Cabin")); // Fallback if data has busType

  if (isCabinOrDouble) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[12px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-100"
        disabled={disabled || !selectedTrip}
        onClick={() => handlePrint("default")}
      >
        <Printer size={12} className="mr-1" /> In bảng kê
      </Button>
    );
  }

  return (
    <Popover
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[12px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-100"
          disabled={disabled || !selectedTrip}
        >
          <Printer size={12} className="mr-1" /> In bảng kê{" "}
          <ChevronDown size={12} className="ml-1 opacity-50" />
        </Button>
      }
      content={(close) => (
        <div className="flex flex-col bg-white rounded border border-slate-200 shadow-lg overflow-hidden min-w-37.5">
          <button
            onClick={() => {
              handlePrint("default");
              close();
            }}
            className="px-4 py-2 text-left text-sm hover:bg-slate-100 border-b border-slate-100 transition-colors"
          >
            Mẫu mới (A4 dọc)
          </button>
          <button
            onClick={() => {
              handlePrint("list_a4");
              close();
            }}
            className="px-4 py-2 text-left text-sm hover:bg-slate-100 transition-colors"
          >
            Mẫu cũ (A4 dọc)
          </button>
        </div>
      )}
    />
  );
};
