// NEW: Sync Bus Layouts - API endpoint
app.post("/api/maintenance/sync-bus-layouts", async (req, res) => {
  try {
    const logs = [];
    let cabinCount = 0;
    let sleeperCount = 0;

    const buses = await Bus.find();

    for (const bus of buses) {
      const isCabin = bus.type === "CABIN";
      let defaultConfig;

      // Generate default config based on bus type
      if (isCabin) {
        // CABIN: 24 phòng + 6 sàn = 30 chỗ
        const active = [];
        // 2 floors × 6 rows × 2 cols
        for (let f = 1; f <= 2; f++) {
          for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 2; c++) {
              active.push(`${f}-${r}-${c}`);
            }
          }
        }
        // 6 floor seats
        for (let i = 0; i < 6; i++) {
          active.push(`1-floor-${i}`);
        }

        // Generate labels
        const labels = {};
        // Floor seats
        for (let i = 0; i < 6; i++) {
          labels[`1-floor-${i}`] = `Sàn ${i + 1}`;
        }
        // Room labels: row * 2 + floor
        for (let c = 0; c < 2; c++) {
          const prefix = c === 0 ? "B" : "A";
          for (let f = 1; f <= 2; f++) {
            for (let r = 0; r < 6; r++) {
              const key = `${f}-${r}-${c}`;
              const num = r * 2 + f;
              labels[key] = `${prefix}${num}`;
            }
          }
        }

        defaultConfig = {
          floors: 2,
          rows: 6,
          cols: 2,
          activeSeats: active,
          seatLabels: labels,
          hasRearBench: false,
          benchFloors: [],
          hasFloorSeats: true,
          floorSeatCount: 6,
        };
        cabinCount++;
      } else {
        // SLEEPER: 36 giường + băng tầng 2 = 41 chỗ
        const active = [];
        // 2 floors × 6 rows × 3 cols
        for (let f = 1; f <= 2; f++) {
          for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 3; c++) {
              active.push(`${f}-${r}-${c}`);
            }
          }
        }
        // 5 bench seats on floor 2
        for (let i = 0; i < 5; i++) {
          active.push(`2-bench-${i}`);
        }

        // Generate labels (sequential numbering for SLEEPER)
        const labels = {};
        const regularSeats = active.filter((k) => !k.includes("bench"));
        regularSeats.sort((a, b) => {
          const [af, ar, ac] = a.split("-").map(Number);
          const [bf, br, bc] = b.split("-").map(Number);
          if (ar !== br) return ar - br;
          if (af !== bf) return af - bf;
          return ac - bc;
        });
        regularSeats.forEach((key, idx) => {
          labels[key] = (idx + 1).toString();
        });

        defaultConfig = {
          floors: 2,
          rows: 6,
          cols: 3,
          activeSeats: active,
          seatLabels: labels,
          hasRearBench: false, // tracks floor 1 bench только
          benchFloors: [2], // floor 2 always has bench
          hasFloorSeats: false,
          floorSeatCount: 0,
        };
        sleeperCount++;
      }

      // Update bus
      bus.layoutConfig = defaultConfig;
      bus.markModified("layoutConfig");
      await bus.save();

      logs.push({
        route: "N/A",
        date: new Date().toLocaleDateString("vi-VN"),
        seat: "Layout Config",
        action: `Sync ${bus.type}`,
        details: `Đã sync xe ${bus.plate} (${bus.type}) về config mặc định`,
      });
    }

    res.json({
      logs,
      cabinCount,
      sleeperCount,
      totalCount: buses.length,
    });
  } catch (e) {
    console.error("Sync bus layouts error:", e);
    res.status(500).json({ error: e.message });
  }
});
