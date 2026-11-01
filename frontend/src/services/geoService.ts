/**
 * Geolocation & France boundary helpers
 */

// Approximate bounding box for Metropolitan France including Corsica
export const METROPOLITAN_FRANCE_BOUNDS = {
  minLat: 41.3,
  maxLat: 51.15,
  minLng: -5.2,
  maxLng: 9.6,
};

// Center of Metropolitan France
export const FRANCE_CENTER: [number, number] = [46.603354, 1.888334];
export const FRANCE_DEFAULT_ZOOM = 6;

/**
 * Checks if coordinates are within Metropolitan France (including Corsica)
 */
export function isWithinMetropolitanFrance(lat: number, lng: number): boolean {
  return (
    lat >= METROPOLITAN_FRANCE_BOUNDS.minLat &&
    lat <= METROPOLITAN_FRANCE_BOUNDS.maxLat &&
    lng >= METROPOLITAN_FRANCE_BOUNDS.minLng &&
    lng <= METROPOLITAN_FRANCE_BOUNDS.maxLng
  );
}

/**
 * Requests browser GPS position with high accuracy
 */
export async function getCurrentGPSPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas supportée par votre navigateur."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let msg = "Impossible d'accéder à votre position GPS.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Permission GPS refusée. Vous pouvez sélectionner votre parcelle sur la carte.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Le signal GPS a mis trop de temps à répondre.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Quick reverse geocode to get commune / region in France
 */
export async function reverseGeocodeFrance(lat: number, lng: number): Promise<{
  commune: string;
  department?: string;
  postcode?: string;
}> {
  try {
    // Use French Government Address API (adresse.data.gouv.fr) - fast, free, no key
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}`
    );
    if (response.ok) {
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const props = data.features[0].properties;
        return {
          commune: props.city || props.name || 'Parcelle agricole',
          department: props.context ? props.context.split(',')[1]?.trim() : undefined,
          postcode: props.postcode,
        };
      }
    }
  } catch (err) {
    console.warn('Reverse geocoding fallback:', err);
  }

  // Graceful fallback coordinate label
  return {
    commune: `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`,
  };
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
