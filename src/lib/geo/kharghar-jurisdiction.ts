/**
 * Kharghar Municipal Ward & Police Jurisdiction Resolution Module
 * Maps civic coordinates deterministically to Panvel Municipal Corporation (PMC)
 * Administrative Wards and Navi Mumbai Police Commissionerate jurisdictions.
 */

import { calculateHaversineDistanceMetres } from "@/lib/geospatial/haversine";

export interface KhargharJurisdiction {
  sector: string;
  wardCode: string;
  wardName: string;
  wardOffice: string;
  wardContact: string;
  policeStation: string;
  policeStationMr: string;
  policeDivision: string;
  policePhone: string;
  policePhoneAlt: string;
  policeEmergency: string;
  policeAddress: string;
  beatChowki: string;
}

/**
 * Deterministically resolves the municipal ward and police station jurisdiction
 * based on geographic coordinates and optional landmark text.
 */
export function resolveJurisdiction(
  lat: number = 19.0435,
  lon: number = 73.0680,
  hintText: string = ""
): KhargharJurisdiction {
  const text = (hintText || "").toLowerCase();

  // If coordinates are clearly outside Kharghar (> 15km) and no Kharghar sector mentioned, provide general regional civic/police routing
  const distFromKharghar = calculateHaversineDistanceMetres(lat, lon, 19.0435, 73.0680);
  if (distFromKharghar > 15000 && !/kharghar|sector\s*\d/i.test(text)) {
    return {
      sector: "Municipal Jurisdiction / Urban Local Body",
      wardCode: "Local Municipal Ward / Division",
      wardName: "Jurisdictional Municipal Corporation / Council",
      wardOffice: "Local Municipal Corporation / Ward Administration Desk",
      wardContact: "1916 (Civic Helpline)",
      policeStation: "Jurisdictional Police Station",
      policeStationMr: "स्थानिक पोलीस ठाणे",
      policeDivision: "State Police Commissionerate / District Police",
      policePhone: "112 (National Emergency Helpline)",
      policePhoneAlt: "100",
      policeEmergency: "112",
      policeAddress: "Jurisdictional Police Station Desk",
      beatChowki: "Local Beat Chowki / Mobile Patrol Unit",
    };
  }

  const zone = resolveZone(lat, lon, text);

  // 1. Kharghar South & Institutional Area (Sectors 1 to 7, ITM, Belpada, Railway Station)
  if (zone === "south") {
    const sectorNo = extractSectorNumber(text);
    const isStationBelpada =
      sectorNo !== null ? sectorNo <= 2 : lat < 19.0250 || /\bbelpada\b|\bstation\b/.test(text);
    return {
      sector: isStationBelpada ? "Sector 1 / Belpada Station Node" : "Sector 4 / Institutional Area (ITM)",
      wardCode: "PMC Ward Committee 'A' (Prabhag 1)",
      wardName: "Kharghar South (Sectors 1–7, ITM, Belpada)",
      wardOffice: "Panvel Municipal Corporation (PMC) Kharghar Ward Office, Sector 12",
      wardContact: "022-27740123",
      policeStation: "Kharghar Police Station",
      policeStationMr: "खारघर पोलीस ठाणे",
      policeDivision: "Navi Mumbai Police Commissionerate (Zone II)",
      policePhone: "022-27740100",
      policePhoneAlt: "022-27742100",
      policeEmergency: "112",
      policeAddress: "Plot 1, Sector 7, Near Utsav Chowk, Kharghar, Navi Mumbai - 410210",
      beatChowki: "Kharghar Beat Chowki No. 1 (Station & Institutional Area)",
    };
  }

  // 2. Kharghar North & Valley Shilp (Sectors 30 to 36, RAF, Owe, Pandavkada)
  if (zone === "north") {
    const sectorNo = extractSectorNumber(text);
    const isNorthHigh = sectorNo !== null ? sectorNo >= 35 : lat > 19.0700;
    return {
      sector: isNorthHigh ? "Sector 35 / 36 (Valley Shilp & North Node)" : "Sector 30–34 (Pandavkada & Hills)",
      wardCode: "PMC Ward Committee 'A' (Prabhag 4)",
      wardName: "Kharghar North (Sectors 30–36, Valley Shilp)",
      wardOffice: "Panvel Municipal Corporation (PMC) Kharghar Ward Office, Sector 12",
      wardContact: "022-27740123",
      policeStation: "Kharghar Police Station",
      policeStationMr: "खारघर पोलीस ठाणे",
      policeDivision: "Navi Mumbai Police Commissionerate (Zone II)",
      policePhone: "022-27740100",
      policePhoneAlt: "022-27742100",
      policeEmergency: "112",
      policeAddress: "Plot 1, Sector 7, Near Utsav Chowk, Kharghar, Navi Mumbai - 410210",
      beatChowki: "Kharghar Beat Chowki No. 4 (Valley Shilp & Northern Beats)",
    };
  }

  // 3. Kharghar East & Central Park (Sectors 21 to 25, Golf Course, ISKCON)
  if (zone === "east") {
    return {
      sector: "Sector 23–25 / Central Park & Golf Course",
      wardCode: "PMC Ward Committee 'A' (Prabhag 3)",
      wardName: "Kharghar East (Sectors 21–25, Central Park)",
      wardOffice: "Panvel Municipal Corporation (PMC) Kharghar Ward Office, Sector 12",
      wardContact: "022-27740123",
      policeStation: "Kharghar Police Station",
      policeStationMr: "खारघर पोलीस ठाणे",
      policeDivision: "Navi Mumbai Police Commissionerate (Zone II)",
      policePhone: "022-27740100",
      policePhoneAlt: "022-27742100",
      policeEmergency: "112",
      policeAddress: "Plot 1, Sector 7, Near Utsav Chowk, Kharghar, Navi Mumbai - 410210",
      beatChowki: "Kharghar Beat Chowki No. 3 (Central Park & Golf Course)",
    };
  }

  // 4. Kharghar Central (Sectors 8 to 20, Shilp Chowk, Sector 12 City Centre)
  return {
    sector: "Sector 10–20 / Shilp Chowk & Central Node",
    wardCode: "PMC Ward Committee 'A' (Prabhag 2)",
    wardName: "Kharghar Central (Sectors 8–20, Shilp Chowk)",
    wardOffice: "Panvel Municipal Corporation (PMC) Kharghar Ward Office, Sector 12",
    wardContact: "022-27740123",
    policeStation: "Kharghar Police Station",
    policeStationMr: "खारघर पोलीस ठाणे",
    policeDivision: "Navi Mumbai Police Commissionerate (Zone II)",
    policePhone: "022-27740100",
    policePhoneAlt: "022-27742100",
    policeEmergency: "112",
    policeAddress: "Plot 1, Sector 7, Near Utsav Chowk, Kharghar, Navi Mumbai - 410210",
    beatChowki: "Kharghar Beat Chowki No. 2 (Shilp Chowk & Market Area)",
  };
}

type Zone = "south" | "central" | "east" | "north";

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/**
 * Finds a sector the resident named, e.g. "Sector 12", "sec-12", "सेक्टर १२".
 * Word-bounded, so "Sector 12" is never read as "Sector 1".
 */
export function extractSectorNumber(text: string): number | null {
  const t = (text || "")
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  const m = t.match(/(?:\bsector|\bsec\.?|सेक्टर|सेक्टर)\s*[-:#]?\s*(\d{1,2})(?!\d)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 45 ? n : null;
}

function zoneForSector(n: number): Zone {
  if (n <= 7) return "south";
  if (n <= 20) return "central";
  if (n <= 29) return "east";
  return "north";
}

/**
 * Order of evidence:
 * 1. A sector number the resident said or typed (their own words beat a rough map).
 * 2. A well-known landmark name, matched as whole words.
 * 3. The GPS position.
 */
function resolveZone(lat: number, lon: number, text: string): Zone {
  const sector = extractSectorNumber(text);
  if (sector !== null) return zoneForSector(sector);

  if (/\bitm\b|\bbelpada\b|utsav chowk|railway station|\bbharti\b/.test(text)) return "south";
  if (/valley shilp|pandavkada|\braf\b|\bowe\b/.test(text)) return "north";
  if (/central park|\bgolf\b|\biskcon\b/.test(text)) return "east";
  if (/shilp chowk|little world|raintree/.test(text)) return "central";

  if (lat < 19.036) return "south";
  if (lat > 19.058) return "north";
  // East of the Sector 12 / Raintree Marg spine and north of it: Central Park side.
  if (lon > 73.072 && lat >= 19.042) return "east";
  return "central";
}
