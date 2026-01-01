export interface CustomWebcam {
  id: string;
  name: string;
  description: string;
  location: {
    name: string;
    lat: number;
    lng: number;
  };
  imageUrl: string;
  pageUrl: string;
  streamUrl?: string;
  provider: string;
  refreshIntervalSeconds: number;
  isActive: boolean;
}

export const customWebcams: CustomWebcam[] = [
  {
    id: 'bmsc-inlet',
    name: 'Bamfield Marine Sciences Centre',
    description: 'View across Bamfield Inlet from BMSC',
    location: {
      name: 'Bamfield Marine Sciences Centre',
      lat: 48.8353,
      lng: -125.1361,
    },
    imageUrl: 'https://bamfieldmsc.com/webcam/camera1.jpg',
    pageUrl: 'https://bamfieldmsc.com/webcam/',
    provider: 'Bamfield Historical Society',
    refreshIntervalSeconds: 300,
    isActive: true,
  },
];

export function getCustomWebcamsNear(
  lat: number, 
  lng: number, 
  radiusKm: number = 20
): CustomWebcam[] {
  return customWebcams.filter(cam => {
    if (!cam.isActive) return false;
    const distance = calculateDistance(
      lat, lng,
      cam.location.lat, cam.location.lng
    );
    return distance <= radiusKm;
  });
}

function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function getWebcamWithCacheBust(cam: CustomWebcam): string {
  return `${cam.imageUrl}?t=${Date.now()}`;
}
