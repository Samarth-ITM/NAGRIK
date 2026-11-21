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
  id: "kharghar_city_v1",
  name: "Kharghar City, Navi Mumbai",
  anchorDescription: "Kharghar Central Park / Sector 12 (City Centre)",
  radiusMetres: Number(process.env.PILOT_RADIUS_METRES) || 6000,
  // City center coordinates: Central Park / Sector 12, Kharghar (covers Sectors 1-45 within 6km)
  centreLatitude: Number(process.env.PILOT_CENTRE_LAT) || 19.0435,
  centreLongitude: Number(process.env.PILOT_CENTRE_LON) || 73.0680,
  enabled: true,
} as const;
