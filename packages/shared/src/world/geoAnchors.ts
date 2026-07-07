export interface GeoAnchor {
  name: string;
  lat: number;
  lng: number;
  /** Relative spawn weight — higher = more servers placed near this city */
  weight: number;
}

/**
 * ~35 real-world city anchors distributed across all populated continents.
 * Servers are placed near these cities with a random jitter, giving the map
 * a realistic-looking distribution of network infrastructure.
 *
 * Physical location is intentionally decoupled from subnet / IPv6 address.
 */
export const GEO_ANCHORS: GeoAnchor[] = [
  // North America
  { name: 'New York',        lat:  40.71,  lng: -74.01, weight: 12 },
  { name: 'Los Angeles',     lat:  34.05,  lng: -118.24, weight: 10 },
  { name: 'Chicago',         lat:  41.85,  lng:  -87.65, weight:  8 },
  { name: 'Dallas',          lat:  32.78,  lng:  -96.80, weight:  6 },
  { name: 'Toronto',         lat:  43.65,  lng:  -79.38, weight:  5 },
  { name: 'Seattle',         lat:  47.61,  lng: -122.33, weight:  5 },
  { name: 'Miami',           lat:  25.76,  lng:  -80.19, weight:  4 },
  { name: 'Atlanta',         lat:  33.75,  lng:  -84.39, weight:  4 },

  // South America
  { name: 'São Paulo',       lat: -23.55,  lng:  -46.63, weight:  8 },
  { name: 'Buenos Aires',    lat: -34.60,  lng:  -58.38, weight:  5 },
  { name: 'Bogotá',          lat:   4.71,  lng:  -74.07, weight:  3 },
  { name: 'Santiago',        lat: -33.46,  lng:  -70.65, weight:  3 },

  // Europe
  { name: 'London',          lat:  51.51,  lng:   -0.13, weight: 12 },
  { name: 'Frankfurt',       lat:  50.11,  lng:    8.68, weight: 10 },
  { name: 'Amsterdam',       lat:  52.37,  lng:    4.90, weight:  8 },
  { name: 'Paris',           lat:  48.85,  lng:    2.35, weight:  7 },
  { name: 'Stockholm',       lat:  59.33,  lng:   18.07, weight:  5 },
  { name: 'Warsaw',          lat:  52.23,  lng:   21.01, weight:  4 },
  { name: 'Madrid',          lat:  40.42,  lng:   -3.70, weight:  4 },
  { name: 'Milan',           lat:  45.46,  lng:    9.19, weight:  4 },
  { name: 'Kyiv',            lat:  50.45,  lng:   30.52, weight:  3 },
  { name: 'Istanbul',        lat:  41.01,  lng:   28.98, weight:  4 },

  // Middle East / Africa
  { name: 'Dubai',           lat:  25.20,  lng:   55.27, weight:  5 },
  { name: 'Johannesburg',    lat: -26.20,  lng:   28.04, weight:  4 },
  { name: 'Lagos',           lat:   6.52,  lng:    3.38, weight:  3 },
  { name: 'Cairo',           lat:  30.06,  lng:   31.25, weight:  3 },
  { name: 'Nairobi',         lat:  -1.29,  lng:   36.82, weight:  2 },

  // Asia
  { name: 'Tokyo',           lat:  35.69,  lng:  139.69, weight: 12 },
  { name: 'Singapore',       lat:   1.35,  lng:  103.82, weight: 10 },
  { name: 'Hong Kong',       lat:  22.32,  lng:  114.17, weight:  8 },
  { name: 'Seoul',           lat:  37.57,  lng:  126.98, weight:  7 },
  { name: 'Shanghai',        lat:  31.23,  lng:  121.47, weight:  8 },
  { name: 'Mumbai',          lat:  19.08,  lng:   72.88, weight:  6 },
  { name: 'Bangalore',       lat:  12.97,  lng:   77.59, weight:  5 },
  { name: 'Beijing',         lat:  39.91,  lng:  116.39, weight:  6 },

  // Oceania
  { name: 'Sydney',          lat: -33.87,  lng:  151.21, weight:  5 },
  { name: 'Melbourne',       lat: -37.81,  lng:  144.96, weight:  4 },
];

/** Sum of all anchor weights, used for weighted random picks. */
export const GEO_ANCHOR_TOTAL_WEIGHT: number = GEO_ANCHORS.reduce(
  (sum, a) => sum + a.weight,
  0,
);
