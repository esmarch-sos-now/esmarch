export type Phone = { label: string; number: string; is24h: boolean };

export type Facility = {
  id: string;
  name: string;
  type: "HOSPITAL" | "CLINIC" | "MEDICAL_STATION";
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  distanceMethod?: "ROAD" | "STRAIGHT_LINE";
  hasEmergency: boolean;
  phones: Phone[];
  verifiedAt: string;
};
