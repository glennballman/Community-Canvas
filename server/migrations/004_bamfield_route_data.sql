-- =====================================================
-- BAMFIELD ROUTE DATA
-- Complete route from Vancouver with all alternatives
-- =====================================================

-- Transport Providers
INSERT INTO transport_providers (id, name, slug, provider_type, phone, website, booking_url, base_location, service_area, has_live_api, accepts_vehicles, max_vehicle_length_feet, accepts_kayaks, reservation_required, advance_booking_days, operating_season, notes) VALUES

('bc-ferries', 'BC Ferries', 'bc-ferries', 'ferry', '1-888-223-3779', 'https://www.bcferries.com', 'https://www.bcferries.com/book-a-ferry', 'Victoria', ARRAY['Vancouver Island', 'Gulf Islands', 'Sunshine Coast'], true, true, 60, true, false, 90, NULL, 'Major routes have live API. Overheight vehicles must book commercial.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('lady-rose', 'Lady Rose Marine Services', 'lady-rose', 'ferry', '250-723-8313', 'https://www.ladyrosemarine.com', 'https://www.ladyrosemarine.com/reservations', 'Port Alberni', ARRAY['Barkley Sound', 'Bamfield', 'Ucluelet'], false, false, NULL, true, true, 30, 'Year-round, reduced winter', 'MV Frances Barkley. No vehicles. Kayaks OK. Essential Bamfield access when road closed.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('harbour-air', 'Harbour Air', 'harbour-air', 'float_plane', '1-800-665-0212', 'https://www.harbourair.com', 'https://www.harbourair.com/book', 'Vancouver', ARRAY['Vancouver Island', 'Gulf Islands', 'Sunshine Coast'], false, false, NULL, false, true, 7, NULL, 'Float plane service. Weather dependent. Limited luggage.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('west-coast-trail-express', 'West Coast Trail Express', 'wct-express', 'bus', '250-477-8700', 'https://trailbus.com', 'https://trailbus.com/booking', 'Victoria', ARRAY['Victoria', 'Port Renfrew', 'Bamfield', 'Pachena Bay'], false, false, NULL, false, true, 14, 'May 1 - Sep 30', 'Shuttle for West Coast Trail hikers. Seasonal.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('bamfield-water-taxi', 'Bamfield Water Taxi', 'bamfield-water-taxi', 'water_taxi', '250-728-3290', NULL, NULL, 'Bamfield', ARRAY['Bamfield', 'Barkley Sound'], false, false, NULL, true, true, 3, NULL, 'Local water taxi. Good for short hops within Barkley Sound.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- Route Segments
INSERT INTO route_segments (id, name, slug, description, start_location_name, start_lat, start_lng, end_location_name, end_lat, end_lng, distance_km, typical_duration_minutes, route_type, road_surface, highway_numbers, minimum_vehicle_class, winter_tires_required, high_clearance_recommended, hazards, notes, conditions_source) VALUES

('van-to-hsb', 'Vancouver to Horseshoe Bay', 'van-to-hsb', 'Highway 99/1 through Stanley Park and along the Sea to Sky Highway to the ferry terminal.', 'Vancouver Downtown', 49.2827, -123.1207, 'Horseshoe Bay Ferry Terminal', 49.3742, -123.2733, 20, 30, 'highway', 'paved', ARRAY['99', '1'], 'sedan', false, false, ARRAY['traffic'], 'Can be congested during rush hour and ferry sailings.', 'drivebc')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('hsb-to-nan', 'Horseshoe Bay to Nanaimo Ferry', 'hsb-to-nan', 'BC Ferries crossing from Horseshoe Bay to Departure Bay, Nanaimo.', 'Horseshoe Bay Terminal', 49.3742, -123.2733, 'Departure Bay Terminal', 49.1659, -123.9401, 55, 100, 'water', NULL, NULL, NULL, false, false, NULL, 'Major ferry route. Reservations recommended in summer.', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('nan-to-pa', 'Nanaimo to Port Alberni', 'nan-to-pa', 'Highway 4 through Mount Arrowsmith area. Beautiful mountain scenery with Cathedral Grove.', 'Nanaimo', 49.1659, -123.9401, 'Port Alberni', 49.2339, -124.8055, 80, 75, 'highway', 'paved', ARRAY['4'], 'sedan', true, false, ARRAY['wildlife', 'fog'], 'Stop at Cathedral Grove for giant old-growth trees. Winter tires required Oct 1 - Apr 30.', 'drivebc')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('bamfield-road', 'Bamfield Road (Logging Road)', 'bamfield-road', 'Active logging road from Port Alberni to Bamfield. Single lane with pullouts. Logging trucks have right of way.', 'Port Alberni', 49.2339, -124.8055, 'Bamfield', 48.8333, -125.1353, 80, 150, 'logging_road', 'rough_gravel', NULL, 'truck', false, true, ARRAY['logging_trucks', 'wildlife', 'steep_grades', 'dust'], 'Logging trucks Mon-Fri 6am-6pm - YIELD TO THEM. VHF radio channel 123.1 recommended. Not suitable for RVs or low-clearance vehicles.', 'manual')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('pa-to-ucluelet', 'Port Alberni to Ucluelet', 'pa-to-ucluelet', 'Highway 4 continuation to the west coast. Scenic Pacific Rim Highway.', 'Port Alberni', 49.2339, -124.8055, 'Ucluelet', 48.9417, -125.5467, 100, 90, 'highway', 'paved', ARRAY['4'], 'sedan', true, false, ARRAY['wildlife', 'fog'], 'Winter tires required Oct 1 - Apr 30. Stop at Sproat Lake.', 'drivebc')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),

('lady-rose-route', 'Lady Rose: Port Alberni to Bamfield', 'lady-rose-route', 'MV Frances Barkley passenger ferry through Barkley Sound. No vehicles, kayaks allowed.', 'Port Alberni Harbour Quay', 49.2350, -124.8053, 'Bamfield Government Dock', 48.8333, -125.1353, 65, 270, 'water', NULL, NULL, NULL, false, false, NULL, 'Essential alternative when Bamfield Road is closed. Kayak transport available. Advance booking required.', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

-- Route Alternatives
INSERT INTO route_alternatives (primary_segment_id, alternative_type, alternative_description, trigger_conditions, additional_time_minutes, additional_cost_estimate, provider_name, provider_contact, provider_booking_url, priority, notes) VALUES

('bamfield-road', 'ferry', 'MV Frances Barkley passenger ferry from Port Alberni to Bamfield. No vehicles.', ARRAY['road_closed', 'vehicle_not_suitable', 'weather'], 120, 80, 'Lady Rose Marine Services', '250-723-8313', 'https://www.ladyrosemarine.com/reservations', 1, 'Primary alternative when logging road is impassable. Runs year-round with reduced winter schedule.'),

('bamfield-road', 'float_plane', 'Charter float plane from Port Alberni or Victoria to Bamfield.', ARRAY['time_sensitive', 'road_closed', 'medical_emergency'], -90, 400, 'Harbour Air / Tofino Air', '1-800-665-0212', 'https://www.harbourair.com', 2, 'Fastest option. Weather dependent. Limited luggage.'),

('bamfield-road', 'water_taxi', 'Water taxi from Ucluelet to Bamfield via Barkley Sound.', ARRAY['road_closed', 'scenic_preference'], 60, 150, 'Bamfield Water Taxi', '250-728-3290', NULL, 3, 'Scenic route via outer coast. Weather dependent.');

-- Lady Rose Schedules (simplified - actual schedules vary by season)
INSERT INTO transport_schedules (provider_id, route_name, origin, destination, day_of_week, departure_time, arrival_time, duration_minutes, valid_from, valid_to, adult_fare, child_fare, kayak_fare, passenger_capacity, notes) VALUES

('lady-rose', 'Port Alberni - Bamfield', 'Port Alberni Harbour Quay', 'Bamfield', 2, '08:00', '12:30', 270, '2025-06-01', '2025-09-30', 48.00, 24.00, 25.00, 100, 'Summer schedule Tuesday departure'),
('lady-rose', 'Port Alberni - Bamfield', 'Port Alberni Harbour Quay', 'Bamfield', 4, '08:00', '12:30', 270, '2025-06-01', '2025-09-30', 48.00, 24.00, 25.00, 100, 'Summer schedule Thursday departure'),
('lady-rose', 'Port Alberni - Bamfield', 'Port Alberni Harbour Quay', 'Bamfield', 6, '08:00', '12:30', 270, '2025-06-01', '2025-09-30', 48.00, 24.00, 25.00, 100, 'Summer schedule Saturday departure'),
('lady-rose', 'Bamfield - Port Alberni', 'Bamfield', 'Port Alberni Harbour Quay', 2, '13:00', '17:30', 270, '2025-06-01', '2025-09-30', 48.00, 24.00, 25.00, 100, 'Summer schedule Tuesday return'),
('lady-rose', 'Bamfield - Port Alberni', 'Bamfield', 'Port Alberni Harbour Quay', 4, '13:00', '17:30', 270, '2025-06-01', '2025-09-30', 48.00, 24.00, 25.00, 100, 'Summer schedule Thursday return'),
('lady-rose', 'Bamfield - Port Alberni', 'Bamfield', 'Port Alberni Harbour Quay', 6, '13:00', '17:30', 270, '2025-06-01', '2025-09-30', 48.00, 24.00, 25.00, 100, 'Summer schedule Saturday return');

-- Skill Requirements for Bamfield Trip
INSERT INTO skill_requirements (requirement_type, requirement_target_id, skill_category, skill_type, minimum_level, enforcement, resolution_options, notes) VALUES

('trip', 'bamfield-adventure', 'driving', 'gravel_road', 'intermediate', 'required', '[{"type": "training", "provider": "BCAA", "duration": "2h", "cost": 0, "description": "Review BCAA gravel road driving tips"}]', 'Required for Bamfield Road - active logging road'),
('trip', 'bamfield-adventure', 'driving', 'mountain_driving', 'beginner', 'recommended', '[]', 'Helpful for Highway 4 mountain section'),
('activity', 'kayaking', 'paddling', 'sea_kayak', 'intermediate', 'required', '[{"type": "course", "provider": "Ocean River Sports", "duration": "8h", "cost": 195, "description": "Level 2 Sea Kayak Skills"}]', 'Required for Broken Group Islands paddling'),
('activity', 'kayaking', 'water_safety', 'self_rescue', 'certified', 'required', '[{"type": "course", "provider": "Ocean River Sports", "duration": "4h", "cost": 125, "description": "Sea Kayak Self-Rescue Certification"}]', 'Required for any open water paddling');

-- Equipment Types for Kayaking
INSERT INTO equipment_types (id, name, category, description, skill_category, skill_minimum, daily_rental_rate, weekly_rental_rate, purchase_price, unlocks_trip_types) VALUES

('sea-kayak-single', 'Single Sea Kayak', 'kayak', 'Touring sea kayak for open water paddling. 16-17 ft length.', 'paddling', 'beginner', 75.00, 400.00, 2500.00, ARRAY['kayaking', 'multi-day-paddling']),
('sea-kayak-double', 'Double Sea Kayak', 'kayak', 'Tandem touring kayak. Good for couples or parent-child. 18-21 ft.', 'paddling', 'beginner', 95.00, 500.00, 3500.00, ARRAY['kayaking']),
('pfd-touring', 'Touring PFD', 'safety', 'Personal flotation device designed for paddling. Coast Guard approved.', NULL, NULL, 10.00, 50.00, 150.00, NULL),
('paddle-touring', 'Touring Paddle', 'kayak', 'Lightweight touring paddle. 215-230 cm length.', NULL, NULL, 15.00, 75.00, 200.00, NULL),
('dry-bag-set', 'Dry Bag Set', 'camping', 'Set of dry bags for multi-day paddling. Keeps gear dry.', NULL, NULL, 12.00, 60.00, 80.00, NULL),
('spray-skirt', 'Spray Skirt', 'kayak', 'Neoprene spray skirt. Keeps water out of cockpit.', 'paddling', 'beginner', 10.00, 50.00, 120.00, NULL),
('vhf-radio', 'VHF Marine Radio', 'safety', 'Handheld VHF radio for marine communication. Channel 16 for emergencies.', 'water_safety', 'beginner', 15.00, 75.00, 150.00, NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
