export const formatPhoneNumber = (value: string): string => {
  const raw = value.replace(/\D/g, "");
  if (raw.length > 15) return raw.slice(0, 15);
  if (raw.length > 7) {
    return `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
  }
  if (raw.length > 4) {
    return `${raw.slice(0, 4)} ${raw.slice(4)}`;
  }
  return raw;
};

export const validatePhoneNumber = (phone: string): string | null => {
  const raw = phone.replace(/\D/g, "");
  if (raw.length === 0) return "Vui lòng nhập số điện thoại";
  if (!raw.startsWith("0")) return "SĐT phải bắt đầu bằng số 0";
  if (raw.length !== 10) return "SĐT phải đủ 10 số";
  return null;
};

export const getStandardizedLocation = (input: string): string => {
  if (!input) return "";
  let value = input.trim();
  const lower = value.toLowerCase();

  const mappings: Record<string, string> = {
    "lai chau": "BX Lai Châu",
    "lai châu": "BX Lai Châu",
    "ha tinh": "BX Hà Tĩnh",
    "hà tĩnh": "BX Hà Tĩnh",
    "lao cai": "BX Lào Cai",
    vinh: "BX Vinh",
    "nghe an": "BX Vinh",
    "nghệ an": "BX Vinh",
  };

  if (mappings[lower]) return mappings[lower];

  if (/^bx\s/i.test(value)) {
    value = value.replace(/^bx\s/i, "BX ");
  }

  return value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};

/**
 * Định dạng số tiền để hiển thị (VD: 100.000)
 */
export const formatCurrency = (
  amount: number | string | undefined | null
): string => {
  if (amount === undefined || amount === null || amount === "") return "0";
  const num =
    typeof amount === "string"
      ? parseInt(amount.replace(/\D/g, "") || "0", 10)
      : amount;
  return new Intl.NumberFormat("vi-VN").format(num);
};

/**
 * Phân tích chuỗi định dạng tiền tệ về số nguyên (VD: "100.000" -> 100000)
 */
export const parseCurrency = (value: string | number): number => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  return parseInt(value.replace(/\D/g, "") || "0", 10);
};

/**
 * Định dạng mượt mà cho chuỗi số
 */
export const formatCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " " +
      date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    );
  } catch (e) {
    return dateStr;
  }
};
