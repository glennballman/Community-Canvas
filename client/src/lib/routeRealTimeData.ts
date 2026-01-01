/**
 * Route Real-Time Data Utilities
 * Fetch live weather and alerts for trip routes
 */

import { apiRequest } from './queryClient';

export interface RoutePoint {
  lat: number;
  lng: number;
  name: string;
}

export interface LiveAlert {
  id: number;
  alert_type: string;
  severity: string;
  title: string;
  summary: string;
  message: string;
  latitude: number | null;
  longitude: number | null;
  region_name: string | null;
  source_url: string | null;
  created_at: string;
  details: Record<string, any>;
  distanceKm?: number;
}

export interface LiveWeather {
  location: string;
  temperature: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  observedAt: string;
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

export interface AlertWithLocation extends LiveAlert {
  nearestRoutePoint: string;
}

/**
 * Fetch all active alerts and filter by proximity to route (20km default)
 */
export async function getAlertsAlongRoute(
  routePoints: RoutePoint[],
  radiusKm: number = 20
): Promise<AlertWithLocation[]> {
  try {
    const response = await fetch('/api/v1/alerts/active');
    if (!response.ok) {
      console.error('Failed to fetch alerts:', response.status);
      return [];
    }
    
    const allAlerts: LiveAlert[] = await response.json();
    
    // Filter alerts that have coordinates and are within radius of any route point
    const nearbyAlerts: AlertWithLocation[] = [];
    
    for (const alert of allAlerts) {
      if (alert.latitude === null || alert.longitude === null) continue;
      
      // Find the nearest route point and its distance
      let minDistance = Infinity;
      let nearestPoint = routePoints[0]?.name || 'Route';
      
      for (const point of routePoints) {
        const distance = haversineDistance(
          point.lat, point.lng,
          alert.latitude, alert.longitude
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = point.name;
        }
      }
      
      if (minDistance <= radiusKm) {
        nearbyAlerts.push({
          ...alert,
          distanceKm: Math.round(minDistance * 10) / 10,
          nearestRoutePoint: nearestPoint
        });
      }
    }
    
    // Sort by severity (emergency first) then distance
    const severityOrder: Record<string, number> = {
      emergency: 1, critical: 2, major: 3, warning: 4, advisory: 5, minor: 6
    };
    
    return nearbyAlerts.sort((a, b) => {
      const sevA = severityOrder[a.severity] || 7;
      const sevB = severityOrder[b.severity] || 7;
      if (sevA !== sevB) return sevA - sevB;
      return (a.distanceKm || 0) - (b.distanceKm || 0);
    });
  } catch (error) {
    console.error('Error fetching route alerts:', error);
    return [];
  }
}

/**
 * Fetch current weather for the dashboard (Vancouver area)
 */
export async function getCurrentWeather(): Promise<LiveWeather | null> {
  try {
    const response = await fetch('/api/v1/weather');
    if (!response.ok) {
      console.error('Failed to fetch weather:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}

/**
 * Convert alert severity to timeline format
 */
export function mapAlertSeverity(severity: string): 'info' | 'minor' | 'major' {
  switch (severity) {
    case 'emergency':
    case 'critical':
    case 'major':
      return 'major';
    case 'warning':
    case 'advisory':
      return 'minor';
    default:
      return 'info';
  }
}

/**
 * Convert weather condition to icon name
 */
export function mapWeatherConditionToIcon(condition: string): string {
  const lowerCondition = condition.toLowerCase();
  
  if (lowerCondition.includes('rain') || lowerCondition.includes('shower')) {
    return 'rain';
  }
  if (lowerCondition.includes('snow') || lowerCondition.includes('flurr')) {
    return 'snow';
  }
  if (lowerCondition.includes('cloud') || lowerCondition.includes('overcast')) {
    return 'cloudy';
  }
  if (lowerCondition.includes('sun') || lowerCondition.includes('clear')) {
    return 'sunny';
  }
  if (lowerCondition.includes('partly') || lowerCondition.includes('mix')) {
    return 'partly-cloudy';
  }
  if (lowerCondition.includes('fog') || lowerCondition.includes('mist')) {
    return 'fog';
  }
  if (lowerCondition.includes('thunder') || lowerCondition.includes('storm')) {
    return 'thunderstorm';
  }
  
  return 'cloudy'; // default
}

// Bamfield route points for quick reference
export const BAMFIELD_ROUTE_POINTS: RoutePoint[] = [
  { lat: 49.2827, lng: -123.1207, name: 'Vancouver' },
  { lat: 49.3722, lng: -123.2738, name: 'Horseshoe Bay' },
  { lat: 49.1917, lng: -123.9589, name: 'Departure Bay' },
  { lat: 49.1659, lng: -123.9406, name: 'Nanaimo' },
  { lat: 49.3036, lng: -124.4548, name: 'Highway 4 Junction' },
  { lat: 49.2478, lng: -124.6912, name: 'Port Alberni Summit' },
  { lat: 49.2339, lng: -124.8055, name: 'Port Alberni' },
  { lat: 48.8333, lng: -125.1333, name: 'Bamfield' }
];
