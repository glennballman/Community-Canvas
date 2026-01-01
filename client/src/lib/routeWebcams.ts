/**
 * Route Webcam Utilities
 * Find live DriveBC webcams along a travel route
 */

export interface Webcam {
  id: string;
  nickname: string;
  city: string;
  latitude: number;
  longitude: number;
  directFeedUrl: string;
  viewDescription: string;
  hostPageUrl: string;
  distanceKm?: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  name: string;
}

// Haversine formula for distance between two GPS points
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// BC webcams data - key cameras along major routes
// Sourced from data/webcams-bc.json with direct DriveBC feed URLs
export const BC_WEBCAMS: Webcam[] = [
  // Ferry terminals & connections
  {
    id: 'horseshoe-bay-e',
    nickname: 'Horseshoe Bay - E',
    city: 'West Vancouver',
    latitude: 49.3722,
    longitude: -123.2738,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/228.jpg',
    viewDescription: 'Highway 99 at Horseshoe Bay ferry terminal, looking east.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/228.html'
  },
  {
    id: 'departure-bay-ferry',
    nickname: 'Departure Bay Ferry',
    city: 'Nanaimo',
    latitude: 49.1917,
    longitude: -123.9589,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/743.jpg',
    viewDescription: 'Departure Bay ferry terminal.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/743.html'
  },
  {
    id: 'departure-bay-northbound',
    nickname: 'Departure Bay northbound',
    city: 'Nanaimo',
    latitude: 49.1917,
    longitude: -123.9589,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/741.jpg',
    viewDescription: 'Highway 19 at Departure Bay, looking north.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/741.html'
  },
  // Highway 4 corridor to Port Alberni / Tofino / Bamfield
  {
    id: 'qualicum-interchange-w',
    nickname: 'Qualicum Interchange - W',
    city: 'Parksville',
    latitude: 49.325828,
    longitude: -124.429476,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/348.jpg',
    viewDescription: 'Highway 19 at Qualicum Interchange, looking west toward Highway 4.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/348.html'
  },
  {
    id: 'hwy4-alberni-hwy-n',
    nickname: 'Highway 4 at Alberni Highway - N',
    city: 'Parksville',
    latitude: 49.30363,
    longitude: -124.454829,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/649.jpg',
    viewDescription: 'Highway 4 at Alberni Highway junction, looking north.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/649.html'
  },
  {
    id: 'horne-lake-road-n',
    nickname: 'Horne Lake Road - N',
    city: 'Qualicum Beach',
    latitude: 49.3714,
    longitude: -124.6175,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/947.jpg',
    viewDescription: 'Highway 4 at Horne Lake Road, looking north toward Cathedral Grove.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/947.html'
  },
  {
    id: 'port-alberni-summit',
    nickname: 'Port Alberni Summit',
    city: 'Port Alberni',
    latitude: 49.247808,
    longitude: -124.69124,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/102.jpg',
    viewDescription: 'Highway 4 at Port Alberni Summit near Cathedral Grove.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/102.html'
  },
  {
    id: 'taylor-river-w',
    nickname: 'Taylor River - W',
    city: 'Port Alberni',
    latitude: 49.298517,
    longitude: -125.294362,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/1066.jpg',
    viewDescription: 'Highway 4 at Taylor River, looking west toward Tofino.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/1066.html'
  },
  {
    id: 'kennedy-lake',
    nickname: 'Kennedy Lake',
    city: 'Kennedy Lake',
    latitude: 49.10065,
    longitude: -125.45269,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/375.jpg',
    viewDescription: 'Highway 4 at Kennedy Lake on route to Tofino/Ucluelet.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/375.html'
  },
  // Sea-to-Sky Highway
  {
    id: 'lions-bay-n',
    nickname: 'Lions Bay - N',
    city: 'Lions Bay',
    latitude: 49.4517,
    longitude: -123.2361,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/765.jpg',
    viewDescription: 'Highway 99 at Lions Bay, looking north toward Squamish.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/765.html'
  },
  // Nanaimo area
  {
    id: 'nanaimo-parkway',
    nickname: 'Nanaimo Parkway',
    city: 'Nanaimo',
    latitude: 49.1659,
    longitude: -123.9406,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/9.jpg',
    viewDescription: 'Nanaimo Parkway showing traffic conditions.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/9.html'
  },
  {
    id: 'nanaimo-airport-n',
    nickname: 'Nanaimo Airport - N',
    city: 'Nanaimo',
    latitude: 49.0547,
    longitude: -123.8703,
    directFeedUrl: 'https://images.drivebc.ca/bchighwaycam/pub/cameras/476.jpg',
    viewDescription: 'Highway 1 near Nanaimo Airport, looking north.',
    hostPageUrl: 'https://images.drivebc.ca/bchighwaycam/pub/html/www/476.html'
  }
];

/**
 * Find webcams within a specified radius of route points
 */
export function getWebcamsAlongRoute(
  routePoints: RoutePoint[],
  radiusKm: number = 15
): Webcam[] {
  const found: Map<string, Webcam> = new Map();
  
  for (const point of routePoints) {
    for (const webcam of BC_WEBCAMS) {
      if (found.has(webcam.id)) continue;
      
      const distance = haversineDistance(
        point.lat, point.lng,
        webcam.latitude, webcam.longitude
      );
      
      if (distance <= radiusKm) {
        found.set(webcam.id, {
          ...webcam,
          distanceKm: Math.round(distance * 10) / 10
        });
      }
    }
  }
  
  // Sort by distance
  return Array.from(found.values()).sort((a, b) => 
    (a.distanceKm || 0) - (b.distanceKm || 0)
  );
}

/**
 * Get webcams for the Bamfield route specifically
 */
export function getBamfieldRouteWebcams(): Webcam[] {
  const bamfieldRoute: RoutePoint[] = [
    { lat: 49.3722, lng: -123.2738, name: 'Horseshoe Bay' },
    { lat: 49.1917, lng: -123.9589, name: 'Departure Bay' },
    { lat: 49.3036, lng: -124.4548, name: 'Highway 4 Junction' },
    { lat: 49.2478, lng: -124.6912, name: 'Port Alberni Summit' },
    { lat: 49.2339, lng: -124.8055, name: 'Port Alberni' },
    { lat: 48.8333, lng: -125.1333, name: 'Bamfield' }
  ];
  
  return getWebcamsAlongRoute(bamfieldRoute, 20);
}

/**
 * Get a timestamp-busted URL for real-time webcam images
 * DriveBC cameras update every few minutes - add cache buster
 */
export function getLiveWebcamUrl(directFeedUrl: string): string {
  const timestamp = Math.floor(Date.now() / 60000); // Change every minute
  return `${directFeedUrl}?t=${timestamp}`;
}
