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
  radiusMetres: 500,
  // Preliminary coordinates; verified via map pin before deployment (TRD Section 4.1)
  centreLatitude: 19.0475,
  centreLongitude: 73.0699,
  enabled: true,
} as const;
