// Facility data now comes from the backend (Postgres seed); only display helpers live here.

// Khi chưa có vị trí: tính khoảng cách từ trung tâm TP.HCM (chợ Bến Thành).
export const cityCenter = { lat: 10.7769, lng: 106.7009 };

// Hiển thị số dễ đọc: 028 3841 2692, 0903 023 194
export function formatPhone(number: string): string {
  // Account numbers are E.164 (+84912345678): show them the local way (0912 345 678)
  if (/^\+84\d{9,10}$/.test(number)) number = `0${number.slice(3)}`;
  if (/^028\d{8}$/.test(number)) return `${number.slice(0, 3)} ${number.slice(3, 7)} ${number.slice(7)}`;
  if (/^0\d{9}$/.test(number)) return `${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}`;
  return number;
}

export function formatDistance(meters: number | undefined): string {
  if (meters === undefined || !Number.isFinite(meters) || meters < 0) return "";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
