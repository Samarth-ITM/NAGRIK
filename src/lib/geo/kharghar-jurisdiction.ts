/**
 * Kharghar Municipal Ward & Police Jurisdiction Resolution Module
 * Maps civic coordinates deterministically to Panvel Municipal Corporation (PMC)
 * Administrative Wards and Navi Mumbai Police Commissionerate jurisdictions.
 */

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

  // 1. Kharghar South & Institutional Area (Sectors 1 to 7, ITM, Belpada, Railway Station)
  if (
    lat < 19.0360 ||
    text.includes("itm") ||
    text.includes("sector 1") ||
    text.includes("sector 2") ||
    text.includes("sector 3") ||
    text.includes("sector 4") ||
    text.includes("sector 5") ||
    text.includes("sector 6") ||
    text.includes("sector 7") ||
    text.includes("belpada") ||
    text.includes("utsav chowk") ||
    text.includes("railway station") ||
    text.includes("bharti")
  ) {
    const isStationBelpada = lat < 19.0250 || text.includes("belpada") || text.includes("station");
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
  if (
    lat > 19.0580 ||
    text.includes("sector 30") ||
    text.includes("sector 31") ||
    text.includes("sector 32") ||
    text.includes("sector 33") ||
    text.includes("sector 34") ||
    text.includes("sector 35") ||
    text.includes("sector 36") ||
    text.includes("valley shilp") ||
    text.includes("pandavkada") ||
    text.includes("raf") ||
    text.includes("owe")
  ) {
    const isNorthHigh = lat > 19.0700 || text.includes("sector 35") || text.includes("sector 36");
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
  if (
    (lon > 73.0680 && lat >= 19.0420) ||
    text.includes("central park") ||
    text.includes("golf") ||
    text.includes("iskcon") ||
    text.includes("sector 21") ||
    text.includes("sector 22") ||
    text.includes("sector 23") ||
    text.includes("sector 24") ||
    text.includes("sector 25")
  ) {
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
