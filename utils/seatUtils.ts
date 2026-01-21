import { Seat, SeatStatus, BusType, BusLayoutConfig } from "../types";

export const generateSeatsFromLayout = (
  config: BusLayoutConfig,
  basePrice: number,
  busType: BusType,
): Seat[] => {
  const seats: Seat[] = [];

  // Parse key helper
  const parseKey = (key: string) => {
    const parts = key.split("-");
    const floor = parseInt(parts[0]);
    if (parts[1] === "bench") {
      return {
        floor,
        isBench: true,
        isFloor: false,
        r: 999,
        c: parseInt(parts[2]),
      };
    }
    if (parts[1] === "floor") {
      return {
        floor,
        isBench: false,
        isFloor: true,
        r: 1000,
        c: parseInt(parts[2]),
      };
    }
    return {
      floor,
      isBench: false,
      isFloor: false,
      r: parseInt(parts[1]),
      c: parseInt(parts[2]),
    };
  };

  // 1. Regular Seats (Floors 1 & 2)
  for (let f = 1; f <= config.floors; f++) {
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const key = `${f}-${r}-${c}`;
        if (config.activeSeats.includes(key)) {
          let label = config.seatLabels?.[key];

          if (!label) {
            // Fallback default labeling logic if not provided in config
            if (busType === BusType.CABIN) {
              // Logic: A1, A2... B1, B2...
              // Assuming 2 cols: Col 0 = B, Col 1 = A (based on ManagerCarModal UI)
              const prefix = c === 0 ? "B" : "A";
              // Row mapping: 0 -> 1,2; 1 -> 3,4...
              const num = r * 2 + f;
              label = `${prefix}${num}`;
            } else {
              // Sleeper default numeric logic could be complex, usually user sets names.
              // Fallback to simple index or key if strictly needed
              label = `${seats.length + 1}`;
            }
          }

          seats.push({
            id: key,
            label,
            floor: f as 1 | 2,
            status: SeatStatus.AVAILABLE,
            price: basePrice, // Logic for cabin multiplier can be applied outside or here if config has multipliers
            row: r,
            col: c,
          });
        }
      }
    }
  }

  // 2. Floor Seats
  if (config.hasFloorSeats) {
    const fCount = busType === BusType.CABIN ? 6 : 12; // Or use config.floorSeatCount if reliable
    // Use activeSeats to determine actual floor seats
    const floorKeys = config.activeSeats.filter((k) => k.includes("-floor-"));

    floorKeys.forEach((key) => {
      const parsed = parseKey(key);
      // c is the index
      const label = config.seatLabels?.[key] || `Sàn ${parsed.c + 1}`;
      seats.push({
        id: key,
        label,
        floor: 1,
        status: SeatStatus.AVAILABLE,
        price: basePrice,
        row: parsed.c, // Use column index as row for floor seats display order? Or keep 1000?
        // ManagerCarModal uses row=i, col=0 for floor seats list logic
        col: 0,
        isFloorSeat: true,
      });
    });
  }

  // 3. Rear Bench (5 seats)
  // Trust benchFloors if it exists and has length, otherwise fallback to hasRearBench check
  // EXCLUDE Cabin buses from bench generation
  const hasBench =
    busType !== BusType.CABIN &&
    ((config.benchFloors && config.benchFloors.length > 0) ||
      config.hasRearBench);

  if (hasBench && config.benchFloors) {
    config.benchFloors.forEach((f) => {
      for (let i = 0; i < 5; i++) {
        const key = `${f}-bench-${i}`;
        if (config.activeSeats.includes(key)) {
          let label = config.seatLabels?.[key];
          if (!label) {
            label = `B${f}-${i + 1}`;
          }

          seats.push({
            id: key,
            label,
            floor: f as 1 | 2,
            status: SeatStatus.AVAILABLE,
            price: basePrice,
            row: config.rows, // IMPORTANT: Assign to the row AFTER the last regular row
            col: i,
            isBench: true,
          });
        }
      }
    });
  }

  return seats;
};
