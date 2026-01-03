-- =====================================================================
-- MIGRATION 014: UNIFIED RENTALS
-- Add accommodation categories and seed equipment for Bamfield
-- =====================================================================

-- Add accommodation rental categories
INSERT INTO cc_rental_categories (name, slug, icon, required_waiver_slug, minimum_age, sort_order) VALUES
('Accommodations', 'accommodations', 'Home', NULL, 18, 1),
('Cottages & Cabins', 'cottages', 'House', NULL, 18, 2),
('RV & Camping', 'rv-camping', 'Tent', NULL, 18, 3)
ON CONFLICT (slug) DO NOTHING;

-- Seed more equipment for Bamfield
INSERT INTO cc_rental_items (
    owner_name, 
    home_community_id, 
    category_id, 
    name, 
    slug, 
    description,
    brand, 
    model,
    capacity, 
    included_items,
    pricing_model, 
    rate_hourly, 
    rate_half_day, 
    rate_daily,
    rate_weekly,
    damage_deposit,
    min_rental_hours,
    location_name,
    photos
) VALUES
-- Tandem Kayak
('Glenn Ballman', 
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'watercraft'),
 'Ocean Kayak - Tandem',
 'kayak-tandem-1',
 'Two-person sit-on-top kayak, stable and fun for couples',
 'Ocean Kayak', 'Malibu Two',
 2,
 '["2 lifejackets", "2 paddles", "dry bag", "safety whistle"]'::jsonb,
 'hourly', 35.00, 80.00, 140.00, 600.00, 150.00, 1,
 'West Bamfield Marina',
 '[]'::jsonb),

-- Stand-Up Paddleboard
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'watercraft'),
 'Stand-Up Paddleboard',
 'sup-1',
 'Stable inflatable SUP, great for calm water',
 'Red Paddle Co', 'Ride 10.6',
 1,
 '["paddle", "lifejacket", "pump", "carry bag"]'::jsonb,
 'hourly', 25.00, 55.00, 90.00, 400.00, 100.00, 1,
 'West Bamfield Marina',
 '[]'::jsonb),

-- Single Kayak
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'watercraft'),
 'Sea Kayak - Single',
 'kayak-single-1',
 'Sleek touring kayak for experienced paddlers',
 'Current Designs', 'Solstice GT',
 1,
 '["lifejacket", "paddle", "spray skirt", "pump"]'::jsonb,
 'hourly', 30.00, 70.00, 120.00, 500.00, 150.00, 1,
 'West Bamfield Marina',
 '[]'::jsonb),

-- Mountain Bike
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'bicycles'),
 'Mountain Bike - Adult',
 'mtb-adult-1',
 'Hardtail mountain bike, 21-speed, fits 5''6" - 6''2"',
 'Trek', 'Marlin 5',
 1,
 '["helmet", "lock", "repair kit"]'::jsonb,
 'hourly', 15.00, 35.00, 50.00, 200.00, 100.00, 2,
 'West Bamfield Shop',
 '[]'::jsonb),

-- E-Bike
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'bicycles'),
 'E-Bike - Step-Through',
 'ebike-1',
 'Electric assist bike, easy mount, 50km range',
 'Rad Power', 'RadCity',
 1,
 '["helmet", "lock", "charger"]'::jsonb,
 'hourly', 25.00, 60.00, 100.00, 450.00, 200.00, 2,
 'West Bamfield Shop',
 '[]'::jsonb),

-- Boat Trailer Parking
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'parking'),
 'Boat Trailer Parking',
 'parking-trailer-1',
 'Large spot for boat trailer, near launch ramp',
 NULL, NULL,
 1,
 '["power outlet"]'::jsonb,
 'daily', NULL, NULL, 25.00, 125.00, 0, 24,
 'West Bamfield Marina',
 '[]'::jsonb),

-- Vehicle Parking
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'parking'),
 'Vehicle Parking - Covered',
 'parking-covered-1',
 'Covered parking spot, secure location',
 NULL, NULL,
 1,
 '[]'::jsonb,
 'daily', NULL, NULL, 15.00, 75.00, 0, 24,
 'West Bamfield Shop',
 '[]'::jsonb),

-- Moorage 25ft
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'moorage'),
 'Guest Moorage - Up to 25ft',
 'moorage-25ft',
 'Moorage for boats up to 25ft, power and water available',
 NULL, NULL,
 1,
 '["power hookup", "water hookup", "wifi access"]'::jsonb,
 'daily', NULL, NULL, 45.00, 250.00, 100.00, 24,
 'West Bamfield Marina',
 '[]'::jsonb),

-- Moorage 35ft
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'moorage'),
 'Guest Moorage - Up to 35ft',
 'moorage-35ft',
 'Moorage for larger vessels up to 35ft',
 NULL, NULL,
 1,
 '["power hookup", "water hookup", "wifi access", "pump out access"]'::jsonb,
 'daily', NULL, NULL, 65.00, 350.00, 150.00, 24,
 'West Bamfield Marina',
 '[]'::jsonb),

-- Pressure Washer
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'tools'),
 'Pressure Washer - 3000 PSI',
 'tool-pressure-washer',
 'Commercial gas pressure washer with hose and nozzles',
 'Simpson', 'MegaShot 3200',
 1,
 '["50ft hose", "4 nozzles", "soap injector"]'::jsonb,
 'daily', NULL, 40.00, 75.00, 300.00, 200.00, 4,
 'West Bamfield Shop',
 '[]'::jsonb),

-- Chainsaw
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'tools'),
 'Chainsaw - 16" Bar',
 'tool-chainsaw-16',
 'Professional chainsaw for small to medium trees',
 'Stihl', 'MS 271',
 1,
 '["bar oil", "fuel mix", "safety chaps", "helmet with face shield"]'::jsonb,
 'daily', NULL, 30.00, 50.00, 200.00, 150.00, 4,
 'West Bamfield Shop',
 '[]'::jsonb),

-- Generator
('Glenn Ballman',
 (SELECT id FROM sr_communities WHERE name = 'Bamfield'),
 (SELECT id FROM cc_rental_categories WHERE slug = 'tools'),
 'Generator - 3500W Inverter',
 'tool-generator-3500',
 'Quiet inverter generator, perfect for sensitive electronics',
 'Honda', 'EU3000iS',
 1,
 '["power cables", "fuel can"]'::jsonb,
 'daily', NULL, 50.00, 85.00, 400.00, 250.00, 4,
 'West Bamfield Shop',
 '[]'::jsonb)

ON CONFLICT DO NOTHING;

-- Verify
SELECT 'Migration 014: Unified rentals complete' as status;
SELECT rc.name as category, COUNT(ri.id) as items
FROM cc_rental_categories rc
LEFT JOIN cc_rental_items ri ON ri.category_id = rc.id
GROUP BY rc.name, rc.sort_order
ORDER BY rc.sort_order;
