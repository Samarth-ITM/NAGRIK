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
  allowAnyLocation?: boolean;
}

export const PILOT_CONFIG: PilotConfig = {
  id: "nagrik_civic_v1",
  name: "Nagrik Civic Platform (All India / Any Location)",
  anchorDescription: "Kharghar Central Park / Sector 12 (City Centre)",
  radiusMetres: Number(process.env.PILOT_RADIUS_METRES) || 6000,
  // City center coordinates: Central Park / Sector 12, Kharghar (covers Sectors 1-45 within 6km)
  centreLatitude: Number(process.env.PILOT_CENTRE_LAT) || 19.0435,
  centreLongitude: Number(process.env.PILOT_CENTRE_LON) || 73.0680,
  enabled: true,
  allowAnyLocation: process.env.PILOT_ALLOW_ANY_LOCATION !== "false", // enabled: accepts any location
} as const;
