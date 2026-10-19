export type Units = 'miles' | 'kilometers' | 'degrees' | 'radians';

export interface DistanceOptions {
  units?: Units;
}

export interface PointFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: Record<string, unknown>;
}

/**
 * Calculates the distance between two points in degrees, radians, miles, or kilometers.
 * @param from Origin point [longitude, latitude]
 * @param to Destination point [longitude, latitude]
 * @param options Options including units
 */
export function distance(
  from: [number, number],
  to: [number, number],
  options?: DistanceOptions
): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;

  const R = options?.units === 'miles' ? 3960 : 6371; // Earth radius in miles or km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Creates a GeoJSON Point Feature from coordinates.
 * @param coordinates [longitude, latitude] pair
 * @param properties Optional properties object
 */
export function point(
  coordinates: [number, number],
  properties?: Record<string, unknown>
): PointFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates,
    },
    properties: properties ?? {},
  };
}
