/**
 * Nagrik Pilot Configuration Baseline
 * Authority: PRD Section 3 & TRD Section 4
 */

export interface PilotConfig {
  id: string;
  name: string;
  anchorDescription: string;
  radiusMetres: number;
  centreLatitude: number;
  centreLongitude: number;
  enabled: boolean;
}

export const PILOT_CONFIG: PilotConfig = {
  id: "kharghar_itm_v1",
  name: "ITM Sector 4, Kharghar",
  anchorDescription: "ITM Skills University main public entrance",
  radiusMetres: Number(process.env.PILOT_RADIUS_METRES) || 2000,
  // Coordinates verified for ITM Skills University / ITM Campus, Sector 4, Kharghar
  centreLatitude: Number(process.env.PILOT_CENTRE_LAT) || 19.0338,
  centreLongitude: Number(process.env.PILOT_CENTRE_LON) || 73.0630,
  enabled: true,
} as const;
