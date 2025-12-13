export const daysOfWeek = [
  "Chủ Nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

export const getDaysInMonth = (year: number, month: number): Date[] => {
  const date = new Date(year, month, 1);
  const days: Date[] = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

// Accurate Lunar Date calculation using Native Intl API
export const getLunarDate = (
  date: Date
): { day: number; month: number; year: number } => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-chinese", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });

    const parts = formatter.formatToParts(date);
    let day = 0;
    let month = 0;
    let year = 0;

    parts.forEach((p) => {
      if (p.type === "day") {
        day = parseInt(p.value, 10);
      }
      if (p.type === "month") {
        month = parseInt(p.value, 10);
      }
      // 'relatedYear' is standard for chinese calendar year in recent browsers
      if ((p.type as string) === "relatedYear") {
        year = parseInt(p.value, 10);
      }
      // Fallback: sometimes it comes as 'year'
      if (p.type === "year" && !year) {
        // Some browsers might return '2024(Jia-Chen)' or just '2024'
        year = parseInt(p.value, 10);
      }
    });

    // Fallback if parsing failed but didn't throw (e.g. valid date but NaN results)
    if (isNaN(day) || isNaN(month) || isNaN(year) || day === 0) {
      // Simplistic fallback: Lunar date is roughly Solar - 1 month (very rough approximation for UI safety)
      // Ideally, we shouldn't hit this with modern browsers
      return {
        day: date.getDate(),
        month: date.getMonth() === 0 ? 12 : date.getMonth(),
        year: date.getFullYear(),
      };
    }

    return { day, month, year };
  } catch (e) {
    // Ultimate fallback to solar date to prevent crash
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }
};

export const formatLunarDate = (date: Date): string => {
  const { day, month } = getLunarDate(date);
  return `${day}/${month} Âm Lịch`;
};

export const formatTime = (dateStr: string): string => {
  if (!dateStr) return "";
  // Handles "YYYY-MM-DD HH:MM"
  const parts = dateStr.split(" ");
  return parts.length > 1 ? parts[1] : dateStr;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
};
