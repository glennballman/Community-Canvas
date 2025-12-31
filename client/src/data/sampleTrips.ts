import { RoadTrip } from '../types/roadtrips';

export const sampleTrips: RoadTrip[] = [
  {
    id: 'whistler-ski-day',
    slug: 'whistler-ski-day',
    title: 'Whistler Blackcomb Ski Day',
    tagline: "North America's largest ski resort, 2 hours from Vancouver",
    description: 'Experience world-class skiing at Whistler Blackcomb with over 8,000 acres of terrain. This day trip takes you along the stunning Sea to Sky Highway with incredible coastal mountain views.',
    category: 'ski-snowboard',
    difficulty: 'moderate',
    seasons: ['winter'],
    tags: ['skiing', 'snowboarding', 'mountains', 'scenic-drive'],
    duration: { min_hours: 12, max_hours: 14, recommended_days: 1, best_start_time: '6:00 AM' },
    region: 'Sea to Sky',
    start_location: { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
    end_location: { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
    estimated_cost: { budget: 185, moderate: 285, comfort: 450 },
    rating: 4.8,
    rating_count: 234,
    segments: [
      {
        id: 'ws-1',
        order: 1,
        type: 'departure',
        title: 'Start from Vancouver',
        location: { name: 'HI Vancouver Central', latitude: 49.2827, longitude: -123.1207, address: '1114 Burnaby St' },
        duration_minutes: 0,
        cost: { budget: 0, moderate: 0, comfort: 0 },
        details: { type: 'accommodation', accommodation_type: 'hostel', provider_name: 'HI Vancouver Central' },
        webcam_ids: [],
        pro_tips: ['Pack breakfast from hostel', 'Leave by 6 AM for first chair']
      },
      {
        id: 'ws-2',
        order: 2,
        type: 'transport',
        title: 'Drive Sea to Sky Highway',
        location: { name: 'Highway 99', latitude: 49.45, longitude: -123.23 },
        duration_minutes: 120,
        cost: { budget: 55, moderate: 55, comfort: 55 },
        details: { 
          type: 'transport', 
          mode: 'drive', 
          route_name: 'Sea to Sky Highway (Hwy 99)',
          distance_km: 125,
          highway_numbers: ['99'],
          fuel_estimate: 35,
          parking_cost: 20
        },
        webcam_ids: [1, 2, 3, 4, 5, 6, 7, 8],
        road_segments: ['hwy99'],
        pro_tips: ['Stop at Shannon Falls (5 min walk)', 'Gas up in Squamish - cheaper than Whistler']
      },
      {
        id: 'ws-3',
        order: 3,
        type: 'activity',
        title: 'Ski Whistler Blackcomb',
        location: { name: 'Whistler Blackcomb', latitude: 50.1163, longitude: -122.9574 },
        duration_minutes: 480,
        cost: { budget: 89, moderate: 189, comfort: 289 },
        details: {
          type: 'activity',
          activity_type: 'skiing',
          provider_name: 'Whistler Blackcomb',
          provider_url: 'https://www.whistlerblackcomb.com',
          pricing: { free: false, adult_price: 189, rental: 65 },
          requirements: ['Ski/snowboard ability', 'Warm clothing'],
          reservation_required: false
        },
        webcam_ids: [9, 10, 11, 12],
        weather_station_id: 'whistler-roundhouse',
        pro_tips: ['Download trail map before going up', 'Roundhouse has best views for lunch']
      },
      {
        id: 'ws-4',
        order: 4,
        type: 'meal',
        title: 'Apres Ski in Village',
        location: { name: 'Whistler Village', latitude: 50.1150, longitude: -122.9540 },
        duration_minutes: 90,
        cost: { budget: 25, moderate: 50, comfort: 100 },
        details: {
          type: 'meal',
          meal_type: 'drinks',
          recommendations: {
            budget: 'Splitz Grill - great burgers ($15-20)',
            moderate: 'Longhorn Saloon - classic apres ($25-40)',
            comfort: 'Bearfoot Bistro - upscale ($60-100)'
          }
        },
        webcam_ids: [13],
        pro_tips: ['Happy hour 3-5pm at most spots', 'Longhorn gets packed - arrive early']
      },
      {
        id: 'ws-5',
        order: 5,
        type: 'transport',
        title: 'Return to Vancouver',
        location: { name: 'Highway 99 South', latitude: 49.45, longitude: -123.23 },
        duration_minutes: 120,
        cost: { budget: 35, moderate: 35, comfort: 35 },
        details: {
          type: 'transport',
          mode: 'drive',
          route_name: 'Sea to Sky Highway (Hwy 99)',
          distance_km: 125,
          fuel_estimate: 35
        },
        webcam_ids: [8, 7, 6, 5, 4, 3, 2, 1],
        road_segments: ['hwy99'],
        pro_tips: ['Leave by 5:30 PM to avoid traffic', 'Check road conditions before leaving']
      }
    ]
  },
  {
    id: 'tofino-storm-watching',
    slug: 'tofino-storm-watching',
    title: 'Tofino Storm Watching',
    tagline: 'Wild Pacific waves and cozy beach vibes',
    description: 'Experience the raw power of Pacific storms from the comfort of Tofino. Watch massive waves crash on Cox Bay, explore rainforest trails, and warm up in natural hot springs.',
    category: 'beach-coastal',
    difficulty: 'easy',
    seasons: ['fall', 'winter'],
    tags: ['beach', 'storms', 'hot-springs', 'rainforest'],
    duration: { min_hours: 48, max_hours: 72, recommended_days: 3 },
    region: 'Vancouver Island',
    start_location: { name: 'Victoria', latitude: 48.4284, longitude: -123.3656 },
    end_location: { name: 'Victoria', latitude: 48.4284, longitude: -123.3656 },
    estimated_cost: { budget: 280, moderate: 450, comfort: 750 },
    rating: 4.9,
    rating_count: 189,
    segments: [
      {
        id: 'tf-1',
        order: 1,
        type: 'departure',
        title: 'Start from Victoria',
        location: { name: 'HI Victoria', latitude: 48.4284, longitude: -123.3656 },
        duration_minutes: 0,
        cost: { budget: 0, moderate: 0, comfort: 0 },
        details: { type: 'accommodation', accommodation_type: 'hostel', provider_name: 'HI Victoria' },
        webcam_ids: [],
        pro_tips: ['Stock up on snacks for the drive']
      },
      {
        id: 'tf-2',
        order: 2,
        type: 'transport',
        title: 'Drive to Tofino',
        location: { name: 'Pacific Rim Highway', latitude: 49.15, longitude: -125.90 },
        duration_minutes: 270,
        cost: { budget: 60, moderate: 60, comfort: 60 },
        details: {
          type: 'transport',
          mode: 'drive',
          route_name: 'Pacific Rim Highway (Hwy 4)',
          distance_km: 316,
          highway_numbers: ['1', '4'],
          fuel_estimate: 60
        },
        webcam_ids: [20, 21, 22, 23, 24],
        road_segments: ['hwy1-victoria-nanaimo', 'hwy4-parksville-tofino'],
        pro_tips: ['Stop at Cathedral Grove for old-growth trees', 'Windy road after Port Alberni - take your time']
      },
      {
        id: 'tf-3',
        order: 3,
        type: 'activity',
        title: 'Cox Bay Storm Watching',
        location: { name: 'Cox Bay', latitude: 49.1033, longitude: -125.8769 },
        duration_minutes: 180,
        cost: { budget: 0, moderate: 0, comfort: 0 },
        details: {
          type: 'activity',
          activity_type: 'beach',
          pricing: { free: true }
        },
        webcam_ids: [25],
        weather_station_id: 'tofino',
        pro_tips: ['Best waves during incoming storms', 'Bring rain gear!']
      },
      {
        id: 'tf-4',
        order: 4,
        type: 'accommodation',
        title: 'Stay in Tofino',
        location: { name: 'Tofino', latitude: 49.1530, longitude: -125.9066 },
        duration_minutes: 720,
        cost: { budget: 45, moderate: 120, comfort: 250 },
        details: {
          type: 'accommodation',
          accommodation_type: 'hostel',
          provider_name: 'Whalers on the Point Guesthouse',
          amenities: ['Kitchen', 'Ocean views', 'Free parking']
        },
        webcam_ids: [26],
        pro_tips: ['Book ahead in storm season']
      },
      {
        id: 'tf-5',
        order: 5,
        type: 'activity',
        title: 'Hot Springs Cove',
        location: { name: 'Hot Springs Cove', latitude: 49.3575, longitude: -126.2644 },
        duration_minutes: 360,
        cost: { budget: 120, moderate: 140, comfort: 200 },
        details: {
          type: 'activity',
          activity_type: 'hot-springs',
          provider_name: 'Tofino Water Taxi',
          provider_url: 'https://tofinowatertaxi.com',
          pricing: { free: false, adult_price: 120 },
          reservation_required: true
        },
        webcam_ids: [],
        pro_tips: ['Book water taxi in advance', 'Bring towel and swimsuit']
      }
    ]
  },
  {
    id: 'okanagan-wine-trail',
    slug: 'okanagan-wine-trail',
    title: 'Okanagan Wine Country',
    tagline: 'World-class wines and stunning lake views',
    description: 'Tour the famous Okanagan wine region with stops at award-winning wineries, beautiful lake beaches, and farm-to-table dining.',
    category: 'wine-culinary',
    difficulty: 'easy',
    seasons: ['spring', 'summer', 'fall'],
    tags: ['wine', 'culinary', 'lakes', 'relaxation'],
    duration: { min_hours: 8, max_hours: 10, recommended_days: 1 },
    region: 'Okanagan',
    start_location: { name: 'Kelowna', latitude: 49.8880, longitude: -119.4960 },
    end_location: { name: 'Kelowna', latitude: 49.8880, longitude: -119.4960 },
    estimated_cost: { budget: 100, moderate: 180, comfort: 350 },
    rating: 4.7,
    rating_count: 156,
    segments: [
      {
        id: 'ok-1',
        order: 1,
        type: 'departure',
        title: 'Start from Kelowna',
        location: { name: 'SameSun Kelowna', latitude: 49.8880, longitude: -119.4960 },
        duration_minutes: 0,
        cost: { budget: 0, moderate: 0, comfort: 0 },
        details: { type: 'accommodation', accommodation_type: 'hostel', provider_name: 'SameSun Backpackers' },
        webcam_ids: [],
        pro_tips: ['Designate a driver or book a wine tour']
      },
      {
        id: 'ok-2',
        order: 2,
        type: 'activity',
        title: 'Mission Hill Winery',
        location: { name: 'Mission Hill', latitude: 49.8283, longitude: -119.4789 },
        duration_minutes: 90,
        cost: { budget: 15, moderate: 35, comfort: 75 },
        details: {
          type: 'activity',
          activity_type: 'wine-tasting',
          provider_name: 'Mission Hill Family Estate',
          provider_url: 'https://www.missionhillwinery.com',
          pricing: { free: false, adult_price: 15 },
          reservation_required: true
        },
        webcam_ids: [30],
        pro_tips: ['The architecture is stunning - worth the tour', 'Reserve terrace lunch in summer']
      },
      {
        id: 'ok-3',
        order: 3,
        type: 'activity',
        title: 'Summerhill Pyramid Winery',
        location: { name: 'Summerhill', latitude: 49.8547, longitude: -119.4856 },
        duration_minutes: 60,
        cost: { budget: 10, moderate: 25, comfort: 50 },
        details: {
          type: 'activity',
          activity_type: 'wine-tasting',
          provider_name: 'Summerhill Pyramid Winery',
          provider_url: 'https://www.summerhill.bc.ca',
          pricing: { free: false, adult_price: 10 }
        },
        webcam_ids: [],
        pro_tips: ['Unique pyramid aging structure', 'Great organic wines']
      },
      {
        id: 'ok-4',
        order: 4,
        type: 'meal',
        title: 'Winery Lunch',
        location: { name: 'Quails Gate', latitude: 49.8167, longitude: -119.5000 },
        duration_minutes: 90,
        cost: { budget: 35, moderate: 60, comfort: 120 },
        details: {
          type: 'meal',
          meal_type: 'lunch',
          recommendations: {
            budget: 'Picnic on winery grounds ($35)',
            moderate: 'Old Vines Restaurant ($60)',
            comfort: 'Full tasting menu ($120)'
          }
        },
        webcam_ids: [],
        pro_tips: ['Old Vines has lake views', 'Reservations essential']
      },
      {
        id: 'ok-5',
        order: 5,
        type: 'activity',
        title: 'Beach at Okanagan Lake',
        location: { name: 'Gyro Beach', latitude: 49.8650, longitude: -119.4875 },
        duration_minutes: 120,
        cost: { budget: 0, moderate: 0, comfort: 0 },
        details: {
          type: 'activity',
          activity_type: 'beach',
          pricing: { free: true }
        },
        webcam_ids: [31],
        pro_tips: ['Perfect for sobering up before heading back', 'Warm lake swimming in summer']
      }
    ]
  },
  {
    id: 'sunshine-coast-circle',
    slug: 'sunshine-coast-circle',
    title: 'Sunshine Coast Loop',
    tagline: 'Two ferries, beaches, and coastal charm',
    description: 'A classic BC road trip featuring two ferry crossings, quaint coastal towns, and stunning ocean views. Perfect for a weekend getaway.',
    category: 'scenic-drives',
    difficulty: 'easy',
    seasons: ['spring', 'summer', 'fall'],
    tags: ['ferries', 'coastal', 'towns', 'beaches'],
    duration: { min_hours: 24, max_hours: 48, recommended_days: 2 },
    region: 'Sunshine Coast',
    start_location: { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
    end_location: { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
    estimated_cost: { budget: 180, moderate: 320, comfort: 550 },
    rating: 4.6,
    rating_count: 142,
    segments: [
      {
        id: 'sc-1', order: 1, type: 'departure',
        title: 'Start from Vancouver',
        location: { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
        duration_minutes: 0, cost: { budget: 0, moderate: 0, comfort: 0 },
        details: { type: 'accommodation', accommodation_type: 'hostel' },
        webcam_ids: []
      },
      {
        id: 'sc-2', order: 2, type: 'transport',
        title: 'Ferry: Horseshoe Bay to Langdale',
        location: { name: 'Horseshoe Bay', latitude: 49.3742, longitude: -123.2733 },
        duration_minutes: 40,
        cost: { budget: 65, moderate: 65, comfort: 65 },
        details: { type: 'transport', mode: 'ferry', operator: 'BC Ferries', fare: 65 },
        webcam_ids: [40, 41],
        pro_tips: ['Book ahead in summer', 'Arrive 30 min early']
      },
      {
        id: 'sc-3', order: 3, type: 'activity',
        title: 'Explore Gibsons',
        location: { name: 'Gibsons', latitude: 49.3948, longitude: -123.5059 },
        duration_minutes: 120,
        cost: { budget: 20, moderate: 40, comfort: 80 },
        details: { type: 'activity', activity_type: 'sightseeing', pricing: { free: true } },
        webcam_ids: [],
        pro_tips: ['Famous from The Beachcombers TV show', 'Great fish and chips at Smittys']
      },
      {
        id: 'sc-4', order: 4, type: 'transport',
        title: 'Drive to Powell River',
        location: { name: 'Highway 101', latitude: 49.7, longitude: -124.2 },
        duration_minutes: 150,
        cost: { budget: 30, moderate: 30, comfort: 30 },
        details: { type: 'transport', mode: 'drive', distance_km: 85, fuel_estimate: 30 },
        webcam_ids: [42, 43, 44],
        pro_tips: ['Stop at Roberts Creek for coffee', 'Sechelt has great bakeries']
      },
      {
        id: 'sc-5', order: 5, type: 'transport',
        title: 'Ferry: Earls Cove to Saltery Bay',
        location: { name: 'Earls Cove', latitude: 49.7500, longitude: -124.0167 },
        duration_minutes: 50,
        cost: { budget: 55, moderate: 55, comfort: 55 },
        details: { type: 'transport', mode: 'ferry', operator: 'BC Ferries', fare: 55 },
        webcam_ids: [45],
        pro_tips: ['Scenic crossing through Jervis Inlet']
      },
      {
        id: 'sc-6', order: 6, type: 'activity',
        title: 'Explore Powell River and Lund',
        location: { name: 'Powell River', latitude: 49.8353, longitude: -124.5247 },
        duration_minutes: 180,
        cost: { budget: 0, moderate: 30, comfort: 60 },
        details: { type: 'activity', activity_type: 'sightseeing', pricing: { free: true } },
        webcam_ids: [],
        pro_tips: ['Lund is Mile 0 of the Sunshine Coast', 'Nancys Bakery is legendary']
      }
    ]
  },
  {
    id: 'harrison-hot-springs',
    slug: 'harrison-hot-springs',
    title: 'Harrison Hot Springs Getaway',
    tagline: 'Natural hot springs and mountain lake views',
    description: 'A quick escape from Vancouver to the healing hot springs of Harrison Lake. Perfect for a relaxing day trip or overnight stay.',
    category: 'hot-springs',
    difficulty: 'easy',
    seasons: ['spring', 'summer', 'fall', 'winter'],
    tags: ['hot-springs', 'relaxation', 'lakes', 'mountains'],
    duration: { min_hours: 6, max_hours: 24, recommended_days: 1 },
    region: 'Fraser Valley',
    start_location: { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
    end_location: { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
    estimated_cost: { budget: 80, moderate: 150, comfort: 300 },
    rating: 4.5,
    rating_count: 198,
    segments: [
      {
        id: 'hh-1', order: 1, type: 'departure',
        title: 'Start from Vancouver',
        location: { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
        duration_minutes: 0, cost: { budget: 0, moderate: 0, comfort: 0 },
        details: { type: 'accommodation', accommodation_type: 'hostel' },
        webcam_ids: []
      },
      {
        id: 'hh-2', order: 2, type: 'transport',
        title: 'Drive to Harrison',
        location: { name: 'Highway 7', latitude: 49.25, longitude: -121.8 },
        duration_minutes: 90,
        cost: { budget: 25, moderate: 25, comfort: 25 },
        details: { type: 'transport', mode: 'drive', distance_km: 128, fuel_estimate: 25 },
        webcam_ids: [50, 51],
        pro_tips: ['Highway 7 is more scenic than Highway 1']
      },
      {
        id: 'hh-3', order: 3, type: 'activity',
        title: 'Harrison Hot Springs Pool',
        location: { name: 'Harrison Hot Springs', latitude: 49.2992, longitude: -121.7853 },
        duration_minutes: 180,
        cost: { budget: 18, moderate: 18, comfort: 80 },
        details: {
          type: 'activity', activity_type: 'hot-springs',
          provider_name: 'Harrison Hot Springs Public Pool',
          pricing: { free: false, adult_price: 18 }
        },
        webcam_ids: [],
        pro_tips: ['Public pool is affordable', 'Resort spa for luxury option']
      },
      {
        id: 'hh-4', order: 4, type: 'meal',
        title: 'Lakeside Dining',
        location: { name: 'Harrison Hot Springs', latitude: 49.2992, longitude: -121.7853 },
        duration_minutes: 60,
        cost: { budget: 20, moderate: 45, comfort: 80 },
        details: {
          type: 'meal', meal_type: 'lunch',
          recommendations: {
            budget: 'Black Forest Steakhouse patio ($20)',
            moderate: 'Harrison Hot Springs Resort restaurant ($45)',
            comfort: 'Copper Room fine dining ($80)'
          }
        },
        webcam_ids: [],
        pro_tips: ['Lake views are best at sunset']
      }
    ]
  }
];

export function getTripsByCategory(category: string): RoadTrip[] {
  return sampleTrips.filter(trip => trip.category === category);
}

export function getTripsBySeason(season: string): RoadTrip[] {
  return sampleTrips.filter(trip => trip.seasons.includes(season as any));
}
