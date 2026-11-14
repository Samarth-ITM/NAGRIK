/**
 * Deterministic Geospatial Matching & Haversine Distance
 * Authority: TRD Section 10.2, 10.3 & PRD Section 9.2
 *
 * Rules:
 * - Exactly measure distance to immutable spot canonical anchor coordinate.
 * - Never use moving centroids or chained report-to-report distances.
 * - AI is NEVER used for duplicate detection or merging.
 */

const EARTH_RADIUS_METRES = 6_371_000;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates the great-circle distance between two points in metres using the Haversine formula.
 */
export function calculateHaversineDistanceMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METRES * c;
}

export type CandidateBand =
  | "STRONG_CANDIDATE"      // 0 <= d <= 5m
  | "POSSIBLE_CANDIDATE"    // 5m < d <= 10m
  | "NOT_A_CANDIDATE";     // d > 10m

/**
 * Classifies the distance between a candidate report and a spot's canonical anchor.
 * PRD Section 9.2:
 * 0–5m: Strong candidate (do not auto-merge)
 * >5–10m: Possible nearby candidate (do not auto-merge)
 * >10m: Separate physical spot by default
 */
export function classifyCandidateBand(distanceMetres: number): CandidateBand {
  if (distanceMetres >= 0 && distanceMetres <= 5.0) {
    return "STRONG_CANDIDATE";
  }
  if (distanceMetres > 5.0 && distanceMetres <= 10.0) {
    return "POSSIBLE_CANDIDATE";
  }
  return "NOT_A_CANDIDATE";
}

/**
 * Verifies if coordinates fall within the pilot geofence boundary.
 */
export function isWithinGeofence(
  lat: number,
  lon: number,
  centreLat: number,
  centreLon: number,
  radiusMetres: number = 500
): { within: boolean; distanceMetres: number } {
  const dist = calculateHaversineDistanceMetres(lat, lon, centreLat, centreLon);
  return {
    within: dist <= radiusMetres,
    distanceMetres: dist,
  };
}
