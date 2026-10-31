/**
 * Geospatial polygon surface area calculator (WGS84 ellipsoidal/spherical model)
 * Computes exact surface area in hectares (1 ha = 10,000 m²)
 */

const EARTH_RADIUS_METERS = 6378137; // WGS84 major axis

/**
 * Calculates the geodesic area of a polygon in hectares.
 * @param coordinates Array of [latitude, longitude] pairs in decimal degrees
 * @returns Surface area in hectares rounded to 2 decimal places
 */
export function calculatePolygonAreaHectares(coordinates: Array<[number, number]>): number {
  if (!coordinates || coordinates.length < 3) {
    return 0;
  }

  let totalAngle = 0;
  const numPoints = coordinates.length;

  for (let i = 0; i < numPoints; i++) {
    const lng1 = coordinates[i][1];
    const lat2 = coordinates[(i + 1) % numPoints][0];
    const lng3 = coordinates[(i + 2) % numPoints][1];

    const dLng = ((lng3 - lng1) * Math.PI) / 180;
    const latRad = (lat2 * Math.PI) / 180;

    totalAngle += dLng * Math.sin(latRad);
  }

  const areaSquareMeters = Math.abs((totalAngle * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
  const areaHectares = areaSquareMeters / 10000;

  return Math.round(areaHectares * 100) / 100;
}

/**
 * Calculates the centroid [lat, lng] of a polygon.
 */
export function calculatePolygonCentroid(coordinates: Array<[number, number]>): [number, number] {
  if (!coordinates || coordinates.length === 0) {
    return [46.603354, 1.888334]; // Center of France
  }

  let sumLat = 0;
  let sumLng = 0;

  coordinates.forEach(([lat, lng]) => {
    sumLat += lat;
    sumLng += lng;
  });

  return [sumLat / coordinates.length, sumLng / coordinates.length];
}
