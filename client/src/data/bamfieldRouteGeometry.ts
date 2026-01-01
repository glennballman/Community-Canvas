// Define the actual roads used in the Bamfield route
export const bamfieldRouteSegments = [
  {
    name: 'Highway 99 South',
    keywords: ['Highway 99', 'Hwy 99', 'Sea to Sky'],
    boundingBox: { north: 49.38, south: 49.25, west: -123.30, east: -123.10 }
  },
  {
    name: 'Highway 1 West',
    keywords: ['Highway 1', 'Hwy 1', 'Trans-Canada', 'Upper Levels'],
    boundingBox: { north: 49.35, south: 49.30, west: -123.30, east: -123.00 }
  },
  {
    name: 'BC Ferries Horseshoe Bay',
    keywords: ['Horseshoe Bay', 'ferry'],
    boundingBox: { north: 49.40, south: 49.36, west: -123.30, east: -123.26 }
  },
  {
    name: 'Highway 19 Nanaimo',
    keywords: ['Highway 19', 'Hwy 19', 'Island Highway', 'Nanaimo'],
    boundingBox: { north: 49.20, south: 49.10, west: -124.00, east: -123.90 }
  },
  {
    name: 'Highway 4 West',
    keywords: ['Highway 4', 'Hwy 4', 'Port Alberni', 'Cathedral Grove', 'Alberni'],
    boundingBox: { north: 49.35, south: 49.05, west: -125.50, east: -124.00 }
  },
  {
    name: 'Bamfield Road',
    keywords: ['Bamfield', 'Franklin River', 'Pachena'],
    boundingBox: { north: 49.10, south: 48.80, west: -125.20, east: -124.80 }
  }
];

export interface AlertForFiltering {
  headline?: string;
  title?: string;
  description?: string;
  summary?: string;
  message?: string;
  latitude?: number;
  longitude?: number;
  roads?: string[];
  region_name?: string;
}

// Function to check if an alert matches our route
export function isAlertOnRoute(alert: AlertForFiltering): boolean {
  // Build searchable text from all available fields
  const alertText = `${alert.headline || ''} ${alert.title || ''} ${alert.description || ''} ${alert.summary || ''} ${alert.message || ''} ${alert.region_name || ''} ${(alert.roads || []).join(' ')}`.toLowerCase();

  for (const segment of bamfieldRouteSegments) {
    // Check keyword match
    for (const keyword of segment.keywords) {
      if (alertText.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    // Check GPS if available
    if (alert.latitude && alert.longitude) {
      const bbox = segment.boundingBox;
      if (
        alert.latitude >= bbox.south &&
        alert.latitude <= bbox.north &&
        alert.longitude >= bbox.west &&
        alert.longitude <= bbox.east
      ) {
        return true;
      }
    }
  }

  return false;
}

// Get matching route segment name for display
export function getRouteSegmentName(alert: AlertForFiltering): string | null {
  const alertText = `${alert.headline || ''} ${alert.title || ''} ${alert.description || ''} ${alert.summary || ''} ${alert.message || ''} ${alert.region_name || ''} ${(alert.roads || []).join(' ')}`.toLowerCase();

  for (const segment of bamfieldRouteSegments) {
    // Check keyword match
    for (const keyword of segment.keywords) {
      if (alertText.includes(keyword.toLowerCase())) {
        return segment.name;
      }
    }

    // Check GPS if available
    if (alert.latitude && alert.longitude) {
      const bbox = segment.boundingBox;
      if (
        alert.latitude >= bbox.south &&
        alert.latitude <= bbox.north &&
        alert.longitude >= bbox.west &&
        alert.longitude <= bbox.east
      ) {
        return segment.name;
      }
    }
  }

  return null;
}

// Deduplicate alerts by grouping by road segment
export function deduplicateRouteAlerts<T extends AlertForFiltering>(alerts: T[]): T[] {
  const segmentAlerts: Record<string, T[]> = {};

  for (const alert of alerts) {
    const segmentName = getRouteSegmentName(alert);
    if (segmentName) {
      if (!segmentAlerts[segmentName]) {
        segmentAlerts[segmentName] = [];
      }
      segmentAlerts[segmentName].push(alert);
    }
  }

  // For each segment, keep the most severe or first alert
  const deduplicated: T[] = [];
  for (const segmentName of Object.keys(segmentAlerts)) {
    const segmentAlertList = segmentAlerts[segmentName];
    if (segmentAlertList.length > 0) {
      // Sort by severity if available, otherwise take first
      const severityOrder: Record<string, number> = { 'CLOSURE': 0, 'MAJOR': 1, 'MINOR': 2, 'FUTURE': 3 };
      const sorted = segmentAlertList.sort((a: T, b: T) => {
        const aSev = (a as AlertForFiltering & { severity?: string }).severity || 'MINOR';
        const bSev = (b as AlertForFiltering & { severity?: string }).severity || 'MINOR';
        return (severityOrder[aSev] || 99) - (severityOrder[bSev] || 99);
      });
      deduplicated.push(sorted[0]);
    }
  }

  return deduplicated;
}
