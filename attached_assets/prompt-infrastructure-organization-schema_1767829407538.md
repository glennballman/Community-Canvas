# PROMPT — INFRASTRUCTURE & ORGANIZATION SCHEMA STANDARDIZATION

**Context:** We have ~10,000+ entities across infrastructure (airports, fire halls, hospitals, etc.), Chambers of Commerce (107), and Chamber members (5,732). These need proper schema.org types and NAICS codes.

---

## PHASE 1: INFRASTRUCTURE TYPE REFERENCE TABLE

```sql
-- Reference table for infrastructure types with schema.org mappings
CREATE TABLE IF NOT EXISTS ref_infrastructure_types (
  code VARCHAR(30) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  schema_type VARCHAR(50) NOT NULL,
  schema_subtype VARCHAR(50),
  naics_code VARCHAR(6),
  naics_description VARCHAR(255),
  unspsc_segment VARCHAR(2),
  description TEXT
);

-- Seed infrastructure types from your dashboard categories
INSERT INTO ref_infrastructure_types (code, display_name, schema_type, schema_subtype, naics_code, naics_description, unspsc_segment) VALUES
  -- AVIATION
  ('airport', 'Airport', 'Airport', NULL, '488119', 'Other Airport Operations', '78'),
  ('heliport', 'Heliport', 'Airport', 'Heliport', '488119', 'Other Airport Operations', '78'),
  ('seaplane_base', 'Seaplane Base', 'Airport', 'SeaplaneBase', '488119', 'Other Airport Operations', '78'),
  
  -- WEATHER & MONITORING
  ('weather_station', 'Weather Station', 'CivicStructure', 'WeatherStation', '541990', 'All Other Professional Services', '41'),
  ('avalanche_station', 'Avalanche Station', 'CivicStructure', 'AvalancheStation', '541990', 'All Other Professional Services', '41'),
  ('hydrometric_station', 'Hydrometric Station', 'CivicStructure', 'HydrometricStation', '541990', 'All Other Professional Services', '41'),
  
  -- MARINE
  ('ferry_terminal', 'Ferry Terminal', 'BusStation', 'FerryTerminal', '483212', 'Inland Water Passenger Transportation', '78'),
  ('marina', 'Marina', 'BoatTerminal', NULL, '713930', 'Marinas', '49'),
  ('port', 'Port', 'BoatTerminal', 'Port', '488310', 'Port and Harbor Operations', '78'),
  ('coast_guard', 'Coast Guard Station', 'GovernmentOrganization', 'CoastGuard', '928110', 'National Security', '46'),
  
  -- HEALTHCARE
  ('hospital', 'Hospital', 'Hospital', NULL, '622110', 'General Medical and Surgical Hospitals', '42'),
  ('health_center', 'Health Center', 'MedicalClinic', NULL, '621498', 'All Other Outpatient Care Centers', '42'),
  ('nursing_home', 'Nursing Home', 'NursingHome', NULL, '623110', 'Nursing Care Facilities', '42'),
  ('pharmacy', 'Pharmacy', 'Pharmacy', NULL, '446110', 'Pharmacies and Drug Stores', '51'),
  ('medical_lab', 'Medical Laboratory', 'MedicalClinic', 'DiagnosticLab', '621511', 'Medical Laboratories', '42'),
  
  -- EMERGENCY SERVICES
  ('fire_hall', 'Fire Hall', 'FireStation', NULL, '922160', 'Fire Protection', '46'),
  ('fire_station', 'Fire Station', 'FireStation', NULL, '922160', 'Fire Protection', '46'),
  ('police_station', 'Police Station', 'PoliceStation', NULL, '922120', 'Police Protection', '46'),
  ('rcmp_detachment', 'RCMP Detachment', 'PoliceStation', 'RCMP', '922120', 'Police Protection', '46'),
  ('ambulance_station', 'Ambulance Station', 'EmergencyService', 'Ambulance', '621910', 'Ambulance Services', '42'),
  ('sar_station', 'Search and Rescue', 'EmergencyService', 'SearchAndRescue', '922190', 'Other Justice/Public Order/Safety', '46'),
  ('emergency_operations', 'Emergency Operations Center', 'EmergencyService', 'EOC', '922190', 'Other Justice/Public Order/Safety', '46'),
  
  -- UTILITIES
  ('power_station', 'Power Station', 'CivicStructure', 'PowerStation', '221110', 'Electric Power Generation', '26'),
  ('substation', 'Electrical Substation', 'CivicStructure', 'Substation', '221121', 'Electric Bulk Power Transmission', '26'),
  ('water_treatment', 'Water Treatment Plant', 'CivicStructure', 'WaterTreatment', '221310', 'Water Supply', '40'),
  ('wastewater', 'Wastewater Treatment', 'CivicStructure', 'WastewaterTreatment', '221320', 'Sewage Treatment Facilities', '40'),
  ('dam', 'Dam', 'CivicStructure', 'Dam', '221111', 'Hydroelectric Power Generation', '26'),
  ('pump_station', 'Pump Station', 'CivicStructure', 'PumpStation', '221310', 'Water Supply', '40'),
  
  -- WASTE MANAGEMENT
  ('landfill', 'Landfill', 'CivicStructure', 'Landfill', '562212', 'Solid Waste Landfill', '76'),
  ('recycling_depot', 'Recycling Depot', 'CivicStructure', 'RecyclingCenter', '562111', 'Solid Waste Collection', '76'),
  ('transfer_station', 'Transfer Station', 'CivicStructure', 'TransferStation', '562111', 'Solid Waste Collection', '76'),
  
  -- TRANSPORTATION
  ('bus_station', 'Bus Station', 'BusStation', NULL, '485210', 'Interurban and Rural Bus Transportation', '78'),
  ('bus_stop', 'Bus Stop', 'BusStop', NULL, '485210', 'Interurban and Rural Bus Transportation', '78'),
  ('taxi_stand', 'Taxi Stand', 'TaxiStand', NULL, '485310', 'Taxi Service', '78'),
  ('train_station', 'Train Station', 'TrainStation', NULL, '482111', 'Line-Haul Railroads', '78'),
  ('transit_hub', 'Transit Hub', 'BusStation', 'TransitHub', '485111', 'Mixed Mode Transit Systems', '78'),
  
  -- POSTAL & COMMUNICATIONS
  ('post_office', 'Post Office', 'PostOffice', NULL, '491110', 'Postal Service', '78'),
  ('postal_outlet', 'Postal Outlet', 'PostOffice', 'PostalOutlet', '491110', 'Postal Service', '78'),
  ('cell_tower', 'Cell Tower', 'CivicStructure', 'CellTower', '517312', 'Wireless Telecommunications Carriers', '43'),
  
  -- EDUCATION
  ('school', 'School', 'School', NULL, '611110', 'Elementary and Secondary Schools', '86'),
  ('elementary_school', 'Elementary School', 'ElementarySchool', NULL, '611110', 'Elementary and Secondary Schools', '86'),
  ('high_school', 'High School', 'HighSchool', NULL, '611110', 'Elementary and Secondary Schools', '86'),
  ('college', 'College', 'CollegeOrUniversity', NULL, '611210', 'Junior Colleges', '86'),
  ('university', 'University', 'CollegeOrUniversity', NULL, '611310', 'Colleges, Universities, and Professional Schools', '86'),
  ('library', 'Library', 'Library', NULL, '519120', 'Libraries and Archives', '86'),
  
  -- GOVERNMENT & CIVIC
  ('city_hall', 'City Hall', 'CityHall', NULL, '921110', 'Executive Offices', '80'),
  ('municipal_office', 'Municipal Office', 'GovernmentOffice', NULL, '921110', 'Executive Offices', '80'),
  ('courthouse', 'Courthouse', 'Courthouse', NULL, '922110', 'Courts', '80'),
  ('community_hall', 'Community Hall', 'CivicStructure', 'CommunityCenter', '813410', 'Civic and Social Organizations', '94'),
  ('first_nation_band_office', 'First Nation Band Office', 'GovernmentOffice', 'FirstNationBandOffice', '921150', 'American Indian and Alaska Native Tribal Governments', '80'),
  ('service_bc', 'Service BC', 'GovernmentOffice', 'ServiceBC', '921190', 'Other General Government Support', '80'),
  
  -- RECREATION
  ('recreation_center', 'Recreation Center', 'SportsActivityLocation', 'RecreationCenter', '713940', 'Fitness and Recreational Sports Centers', '49'),
  ('arena', 'Arena', 'StadiumOrArena', NULL, '711310', 'Promoters with Facilities', '49'),
  ('swimming_pool', 'Swimming Pool', 'PublicSwimmingPool', NULL, '713940', 'Fitness and Recreational Sports Centers', '49'),
  ('park', 'Park', 'Park', NULL, '712190', 'Nature Parks and Other Similar Institutions', '49'),
  ('campground', 'Campground', 'Campground', NULL, '721211', 'RV Parks and Campgrounds', '49'),
  ('golf_course', 'Golf Course', 'GolfCourse', NULL, '713910', 'Golf Courses and Country Clubs', '49'),
  ('ski_resort', 'Ski Resort', 'SkiResort', NULL, '713920', 'Skiing Facilities', '49'),
  
  -- SUPPLY CHAIN
  ('warehouse', 'Warehouse', 'CivicStructure', 'Warehouse', '493110', 'General Warehousing and Storage', '78'),
  ('distribution_center', 'Distribution Center', 'CivicStructure', 'DistributionCenter', '493110', 'General Warehousing and Storage', '78'),
  ('fuel_depot', 'Fuel Depot', 'CivicStructure', 'FuelDepot', '424710', 'Petroleum Bulk Stations and Terminals', '15'),
  
  -- BUSINESS ASSOCIATIONS
  ('chamber_of_commerce', 'Chamber of Commerce', 'Organization', 'ChamberOfCommerce', '813910', 'Business Associations', '80'),
  ('tourism_association', 'Tourism Association', 'Organization', 'TourismAssociation', '813910', 'Business Associations', '80'),
  ('industry_association', 'Industry Association', 'Organization', 'IndustryAssociation', '813910', 'Business Associations', '80')
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  schema_type = EXCLUDED.schema_type,
  schema_subtype = EXCLUDED.schema_subtype,
  naics_code = EXCLUDED.naics_code,
  naics_description = EXCLUDED.naics_description,
  unspsc_segment = EXCLUDED.unspsc_segment;
```

---

## PHASE 2: ORGANIZATION TYPES REFERENCE TABLE

```sql
-- Reference table for organization/business types
CREATE TABLE IF NOT EXISTS ref_organization_types (
  code VARCHAR(30) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  schema_type VARCHAR(50) NOT NULL,
  default_naics VARCHAR(6),
  description TEXT
);

INSERT INTO ref_organization_types (code, display_name, schema_type, default_naics) VALUES
  -- GOVERNMENT
  ('federal_government', 'Federal Government', 'GovernmentOrganization', '911110'),
  ('provincial_government', 'Provincial Government', 'GovernmentOrganization', '912110'),
  ('municipal_government', 'Municipal Government', 'GovernmentOrganization', '913110'),
  ('first_nation', 'First Nation', 'GovernmentOrganization', '921150'),
  ('regional_district', 'Regional District', 'GovernmentOrganization', '913110'),
  ('crown_corporation', 'Crown Corporation', 'GovernmentOrganization', '911110'),
  
  -- NON-PROFIT
  ('non_profit', 'Non-Profit Organization', 'NGO', '813110'),
  ('charity', 'Charity', 'NGO', '813110'),
  ('foundation', 'Foundation', 'NGO', '813211'),
  ('cooperative', 'Cooperative', 'Organization', '813930'),
  
  -- BUSINESS TYPES (schema.org LocalBusiness subtypes)
  ('business', 'Business', 'LocalBusiness', '999999'),
  ('corporation', 'Corporation', 'Corporation', '999999'),
  ('sole_proprietor', 'Sole Proprietor', 'LocalBusiness', '999999'),
  ('partnership', 'Partnership', 'LocalBusiness', '999999'),
  
  -- HOSPITALITY (from earlier)
  ('hotel', 'Hotel', 'Hotel', '721110'),
  ('motel', 'Motel', 'Motel', '721110'),
  ('resort', 'Resort', 'Resort', '721110'),
  ('bed_and_breakfast', 'Bed and Breakfast', 'BedAndBreakfast', '721191'),
  ('campground', 'Campground', 'Campground', '721211'),
  ('vacation_rental', 'Vacation Rental', 'LodgingBusiness', '721199'),
  
  -- FOOD SERVICE
  ('restaurant', 'Restaurant', 'Restaurant', '722511'),
  ('cafe', 'Cafe', 'CafeOrCoffeeShop', '722515'),
  ('bar', 'Bar', 'BarOrPub', '722410'),
  ('food_truck', 'Food Truck', 'FoodEstablishment', '722330'),
  ('catering', 'Catering', 'FoodEstablishment', '722320'),
  ('bakery', 'Bakery', 'Bakery', '311811'),
  
  -- RETAIL
  ('retail_store', 'Retail Store', 'Store', '453998'),
  ('grocery_store', 'Grocery Store', 'GroceryStore', '445110'),
  ('convenience_store', 'Convenience Store', 'ConvenienceStore', '445120'),
  ('hardware_store', 'Hardware Store', 'HardwareStore', '444130'),
  ('clothing_store', 'Clothing Store', 'ClothingStore', '448140'),
  ('sporting_goods', 'Sporting Goods Store', 'SportingGoodsStore', '451110'),
  ('liquor_store', 'Liquor Store', 'LiquorStore', '445310'),
  ('pharmacy', 'Pharmacy', 'Pharmacy', '446110'),
  ('gas_station', 'Gas Station', 'GasStation', '447110'),
  
  -- AUTOMOTIVE
  ('auto_dealer', 'Auto Dealer', 'AutoDealer', '441110'),
  ('auto_repair', 'Auto Repair', 'AutoRepair', '811111'),
  ('auto_body', 'Auto Body Shop', 'AutoBodyShop', '811121'),
  ('tire_shop', 'Tire Shop', 'TireShop', '441320'),
  ('car_rental', 'Car Rental', 'AutoRental', '532111'),
  
  -- PROFESSIONAL SERVICES
  ('law_firm', 'Law Firm', 'LegalService', '541110'),
  ('accounting_firm', 'Accounting Firm', 'AccountingService', '541211'),
  ('real_estate', 'Real Estate', 'RealEstateAgent', '531210'),
  ('insurance', 'Insurance Agency', 'InsuranceAgency', '524210'),
  ('financial_advisor', 'Financial Advisor', 'FinancialService', '523930'),
  ('bank', 'Bank', 'BankOrCreditUnion', '522110'),
  ('credit_union', 'Credit Union', 'BankOrCreditUnion', '522130'),
  
  -- HEALTHCARE
  ('medical_clinic', 'Medical Clinic', 'MedicalClinic', '621111'),
  ('dental_office', 'Dental Office', 'Dentist', '621210'),
  ('veterinary', 'Veterinary Clinic', 'VeterinaryCare', '541940'),
  ('optometrist', 'Optometrist', 'Optician', '621320'),
  ('physiotherapy', 'Physiotherapy', 'MedicalClinic', '621340'),
  ('chiropractor', 'Chiropractor', 'MedicalClinic', '621310'),
  
  -- CONSTRUCTION & TRADES
  ('general_contractor', 'General Contractor', 'GeneralContractor', '236220'),
  ('plumber', 'Plumber', 'Plumber', '238220'),
  ('electrician', 'Electrician', 'Electrician', '238210'),
  ('hvac', 'HVAC Contractor', 'HVACBusiness', '238220'),
  ('roofing', 'Roofing Contractor', 'RoofingContractor', '238160'),
  ('landscaping', 'Landscaping', 'LandscapingService', '561730'),
  
  -- TOURISM & RECREATION
  ('tour_operator', 'Tour Operator', 'TouristInformationCenter', '561520'),
  ('travel_agency', 'Travel Agency', 'TravelAgency', '561510'),
  ('fishing_charter', 'Fishing Charter', 'LocalBusiness', '487210'),
  ('whale_watching', 'Whale Watching', 'LocalBusiness', '487210'),
  ('kayak_rental', 'Kayak Rental', 'LocalBusiness', '532284'),
  ('ski_shop', 'Ski Shop', 'SportingGoodsStore', '451110'),
  ('marina', 'Marina', 'LocalBusiness', '713930'),
  
  -- TECHNOLOGY
  ('software_company', 'Software Company', 'LocalBusiness', '541511'),
  ('it_services', 'IT Services', 'LocalBusiness', '541512'),
  ('telecom', 'Telecommunications', 'LocalBusiness', '517311'),
  
  -- MANUFACTURING
  ('manufacturer', 'Manufacturer', 'LocalBusiness', '339999'),
  ('food_processor', 'Food Processor', 'LocalBusiness', '311999'),
  ('brewery', 'Brewery', 'Brewery', '312120'),
  ('winery', 'Winery', 'Winery', '312130'),
  ('distillery', 'Distillery', 'Distillery', '312140'),
  
  -- RESOURCE INDUSTRIES
  ('mining', 'Mining Company', 'LocalBusiness', '212299'),
  ('forestry', 'Forestry Company', 'LocalBusiness', '113310'),
  ('fishing', 'Commercial Fishing', 'LocalBusiness', '114111'),
  ('farming', 'Farm', 'LocalBusiness', '111419'),
  ('ranching', 'Ranch', 'LocalBusiness', '112111')
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  schema_type = EXCLUDED.schema_type,
  default_naics = EXCLUDED.default_naics;
```

---

## PHASE 3: UPDATE ORGANIZATIONS TABLE

```sql
-- Add infrastructure and classification columns to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS infrastructure_type VARCHAR(30) REFERENCES ref_infrastructure_types(code),
  ADD COLUMN IF NOT EXISTS organization_type VARCHAR(30) REFERENCES ref_organization_types(code),
  ADD COLUMN IF NOT EXISTS is_infrastructure BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_government BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_emergency_service BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_chamber_member BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS chamber_id UUID REFERENCES organizations(id), -- which chamber they belong to
  ADD COLUMN IF NOT EXISTS unspsc_segment VARCHAR(2),
  ADD COLUMN IF NOT EXISTS service_area TEXT; -- GeoJSON or description

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_organizations_infrastructure_type ON organizations(infrastructure_type);
CREATE INDEX IF NOT EXISTS idx_organizations_organization_type ON organizations(organization_type);
CREATE INDEX IF NOT EXISTS idx_organizations_is_infrastructure ON organizations(is_infrastructure);
CREATE INDEX IF NOT EXISTS idx_organizations_chamber_id ON organizations(chamber_id);
```

---

## PHASE 4: CREATE INFRASTRUCTURE VIEW

```sql
-- Unified view of all infrastructure entities
CREATE OR REPLACE VIEW v_infrastructure AS
SELECT 
  o.id,
  o.name,
  o.schema_type,
  o.infrastructure_type,
  it.display_name as infrastructure_display_name,
  it.naics_code as infrastructure_naics,
  it.naics_description,
  COALESCE(o.naics_code_primary, it.naics_code) as effective_naics,
  o.latitude,
  o.longitude,
  o.address,
  o.telephone,
  o.website,
  o.is_emergency_service,
  o.tenant_id
FROM organizations o
LEFT JOIN ref_infrastructure_types it ON it.code = o.infrastructure_type
WHERE o.is_infrastructure = true;
```

---

## PHASE 5: CREATE CHAMBER MEMBERS VIEW

```sql
-- View of all chamber members with their chambers
CREATE OR REPLACE VIEW v_chamber_members AS
SELECT 
  m.id as member_id,
  m.name as member_name,
  m.schema_type,
  m.organization_type,
  ot.display_name as organization_type_name,
  m.naics_code_primary,
  m.website,
  m.telephone,
  c.id as chamber_id,
  c.name as chamber_name,
  m.tenant_id
FROM organizations m
LEFT JOIN organizations c ON c.id = m.chamber_id
LEFT JOIN ref_organization_types ot ON ot.code = m.organization_type
WHERE m.is_chamber_member = true;
```

---

## PHASE 6: MIGRATE EXISTING INFRASTRUCTURE DATA

Based on your Infrastructure Database categories, map existing data:

```sql
-- Update schema_type based on current categories (adjust table/column names as needed)

-- Airports
UPDATE organizations SET 
  schema_type = 'Airport',
  infrastructure_type = 'airport',
  is_infrastructure = true,
  naics_code_primary = COALESCE(naics_code_primary, '488119')
WHERE infrastructure_type = 'airport' OR name ILIKE '%airport%';

-- Weather Stations
UPDATE organizations SET 
  schema_type = 'CivicStructure',
  infrastructure_type = 'weather_station',
  is_infrastructure = true,
  naics_code_primary = COALESCE(naics_code_primary, '541990')
WHERE infrastructure_type = 'weather_station' OR name ILIKE '%weather station%';

-- Hospitals
UPDATE organizations SET 
  schema_type = 'Hospital',
  infrastructure_type = 'hospital',
  is_infrastructure = true,
  is_emergency_service = true,
  naics_code_primary = COALESCE(naics_code_primary, '622110')
WHERE infrastructure_type = 'hospital' OR name ILIKE '%hospital%';

-- Fire Halls/Stations
UPDATE organizations SET 
  schema_type = 'FireStation',
  infrastructure_type = 'fire_hall',
  is_infrastructure = true,
  is_emergency_service = true,
  naics_code_primary = COALESCE(naics_code_primary, '922160')
WHERE infrastructure_type IN ('fire_hall', 'fire_station') OR name ILIKE '%fire hall%' OR name ILIKE '%fire station%';

-- RCMP
UPDATE organizations SET 
  schema_type = 'PoliceStation',
  infrastructure_type = 'rcmp_detachment',
  is_infrastructure = true,
  is_emergency_service = true,
  naics_code_primary = COALESCE(naics_code_primary, '922120')
WHERE infrastructure_type = 'rcmp_detachment' OR name ILIKE '%rcmp%' OR name ILIKE '%police%';

-- Search and Rescue
UPDATE organizations SET 
  schema_type = 'EmergencyService',
  infrastructure_type = 'sar_station',
  is_infrastructure = true,
  is_emergency_service = true,
  naics_code_primary = COALESCE(naics_code_primary, '922190')
WHERE infrastructure_type = 'sar_station' OR name ILIKE '%search and rescue%' OR name ILIKE '%sar%';

-- Schools
UPDATE organizations SET 
  schema_type = 'School',
  infrastructure_type = 'school',
  is_infrastructure = true,
  naics_code_primary = COALESCE(naics_code_primary, '611110')
WHERE infrastructure_type = 'school' OR name ILIKE '%school%' OR name ILIKE '%elementary%' OR name ILIKE '%secondary%';

-- Pharmacies
UPDATE organizations SET 
  schema_type = 'Pharmacy',
  infrastructure_type = 'pharmacy',
  is_infrastructure = true,
  naics_code_primary = COALESCE(naics_code_primary, '446110')
WHERE infrastructure_type = 'pharmacy' OR name ILIKE '%pharmacy%' OR name ILIKE '%pharmasave%' OR name ILIKE '%shoppers drug%';

-- Post Offices
UPDATE organizations SET 
  schema_type = 'PostOffice',
  infrastructure_type = 'post_office',
  is_infrastructure = true,
  naics_code_primary = COALESCE(naics_code_primary, '491110')
WHERE infrastructure_type = 'post_office' OR name ILIKE '%post office%' OR name ILIKE '%canada post%';

-- Chambers of Commerce
UPDATE organizations SET 
  schema_type = 'Organization',
  organization_type = 'chamber_of_commerce',
  is_infrastructure = false,
  naics_code_primary = COALESCE(naics_code_primary, '813910')
WHERE organization_type = 'chamber_of_commerce' OR name ILIKE '%chamber of commerce%' OR name ILIKE '%board of trade%';

-- Recreation Centers
UPDATE organizations SET 
  schema_type = 'SportsActivityLocation',
  infrastructure_type = 'recreation_center',
  is_infrastructure = true,
  naics_code_primary = COALESCE(naics_code_primary, '713940')
WHERE infrastructure_type = 'recreation_center' OR name ILIKE '%recreation%' OR name ILIKE '%rec center%' OR name ILIKE '%community centre%';

-- Ferry Terminals
UPDATE organizations SET 
  schema_type = 'BusStation',
  infrastructure_type = 'ferry_terminal',
  is_infrastructure = true,
  naics_code_primary = COALESCE(naics_code_primary, '483212')
WHERE infrastructure_type = 'ferry_terminal' OR name ILIKE '%ferry%';

-- Marinas
UPDATE organizations SET 
  schema_type = 'BoatTerminal',
  infrastructure_type = 'marina',
  is_infrastructure = true,
  naics_code_primary = COALESCE(naics_code_primary, '713930')
WHERE infrastructure_type = 'marina' OR name ILIKE '%marina%';
```

---

## PHASE 7: SET CHAMBER MEMBERSHIP FLAGS

```sql
-- Mark all chamber members
UPDATE organizations SET 
  is_chamber_member = true
WHERE id IN (
  SELECT DISTINCT member_org_id 
  FROM chamber_memberships  -- adjust table name if different
);

-- Or if stored differently (e.g., in organizations table itself)
UPDATE organizations SET 
  is_chamber_member = true
WHERE chamber_id IS NOT NULL;
```

---

## PHASE 8: AUTO-ASSIGN ORGANIZATION TYPES FOR CHAMBER MEMBERS

For members without organization_type, try to infer from NAICS:

```sql
-- Map NAICS sectors to organization types
UPDATE organizations o
SET organization_type = CASE 
  -- Accommodation & Food (72)
  WHEN LEFT(naics_code_primary, 2) = '72' AND naics_code_primary LIKE '7211%' THEN 'hotel'
  WHEN LEFT(naics_code_primary, 2) = '72' AND naics_code_primary LIKE '7225%' THEN 'restaurant'
  WHEN LEFT(naics_code_primary, 2) = '72' AND naics_code_primary LIKE '7224%' THEN 'bar'
  
  -- Retail (44-45)
  WHEN LEFT(naics_code_primary, 2) = '44' AND naics_code_primary LIKE '4451%' THEN 'grocery_store'
  WHEN LEFT(naics_code_primary, 2) = '44' AND naics_code_primary LIKE '4471%' THEN 'gas_station'
  WHEN LEFT(naics_code_primary, 2) = '44' AND naics_code_primary LIKE '4461%' THEN 'pharmacy'
  WHEN LEFT(naics_code_primary, 2) IN ('44', '45') THEN 'retail_store'
  
  -- Professional Services (54)
  WHEN naics_code_primary LIKE '5411%' THEN 'law_firm'
  WHEN naics_code_primary LIKE '5412%' THEN 'accounting_firm'
  WHEN naics_code_primary LIKE '5413%' THEN 'software_company'
  
  -- Healthcare (62)
  WHEN naics_code_primary LIKE '6211%' THEN 'medical_clinic'
  WHEN naics_code_primary LIKE '6212%' THEN 'dental_office'
  
  -- Construction (23)
  WHEN LEFT(naics_code_primary, 2) = '23' THEN 'general_contractor'
  
  -- Finance (52)
  WHEN naics_code_primary LIKE '5221%' THEN 'bank'
  WHEN naics_code_primary LIKE '5242%' THEN 'insurance'
  WHEN naics_code_primary LIKE '5312%' THEN 'real_estate'
  
  -- Manufacturing (31-33)
  WHEN naics_code_primary LIKE '3121%' THEN 'brewery'
  WHEN LEFT(naics_code_primary, 2) IN ('31', '32', '33') THEN 'manufacturer'
  
  -- Default
  ELSE 'business'
END
WHERE is_chamber_member = true
AND organization_type IS NULL
AND naics_code_primary IS NOT NULL;
```

---

## PHASE 9: SET schema_type FROM ORGANIZATION TYPE

```sql
-- Update schema_type based on organization_type
UPDATE organizations o
SET schema_type = COALESCE(
  (SELECT ot.schema_type FROM ref_organization_types ot WHERE ot.code = o.organization_type),
  'LocalBusiness'
)
WHERE o.is_chamber_member = true
AND o.schema_type IS NULL
AND o.organization_type IS NOT NULL;

-- Default to LocalBusiness for remaining chamber members
UPDATE organizations 
SET schema_type = 'LocalBusiness'
WHERE is_chamber_member = true
AND schema_type IS NULL;
```

---

## PHASE 10: VERIFICATION

```sql
-- Verify infrastructure types
SELECT 
  infrastructure_type, 
  COUNT(*) as count,
  COUNT(DISTINCT schema_type) as schema_types
FROM organizations
WHERE is_infrastructure = true
GROUP BY infrastructure_type
ORDER BY count DESC;

-- Verify chamber members by organization type
SELECT 
  organization_type,
  ot.display_name,
  COUNT(*) as count
FROM organizations o
LEFT JOIN ref_organization_types ot ON ot.code = o.organization_type
WHERE o.is_chamber_member = true
GROUP BY organization_type, ot.display_name
ORDER BY count DESC
LIMIT 30;

-- Verify schema_type distribution
SELECT 
  schema_type,
  COUNT(*) as count,
  SUM(CASE WHEN is_infrastructure THEN 1 ELSE 0 END) as infrastructure,
  SUM(CASE WHEN is_chamber_member THEN 1 ELSE 0 END) as chamber_members
FROM organizations
GROUP BY schema_type
ORDER BY count DESC;

-- Find organizations without proper classification
SELECT 
  'Missing schema_type' as issue,
  COUNT(*) as count
FROM organizations WHERE schema_type IS NULL
UNION ALL
SELECT 
  'Infrastructure without type',
  COUNT(*)
FROM organizations WHERE is_infrastructure = true AND infrastructure_type IS NULL
UNION ALL
SELECT 
  'Chamber members without org type',
  COUNT(*)
FROM organizations WHERE is_chamber_member = true AND organization_type IS NULL;

-- Summary counts
SELECT 'ref_infrastructure_types' as tbl, COUNT(*) FROM ref_infrastructure_types
UNION ALL SELECT 'ref_organization_types', COUNT(*) FROM ref_organization_types
UNION ALL SELECT 'Total organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'Infrastructure entities', COUNT(*) FROM organizations WHERE is_infrastructure = true
UNION ALL SELECT 'Chamber members', COUNT(*) FROM organizations WHERE is_chamber_member = true
UNION ALL SELECT 'Emergency services', COUNT(*) FROM organizations WHERE is_emergency_service = true;
```

---

## PHASE 11: UPDATE EVIDENCE LEDGER

```sql
INSERT INTO system_evidence (artifact_type, artifact_name, description, evidence_type, tenant_id)
VALUES 
  ('table', 'ref_infrastructure_types', 'Infrastructure type reference with schema.org mappings', 'required', NULL),
  ('table', 'ref_organization_types', 'Organization/business type reference with schema.org mappings', 'required', NULL),
  ('view', 'v_infrastructure', 'Unified infrastructure entities view', 'required', NULL),
  ('view', 'v_chamber_members', 'Chamber of commerce members view', 'required', NULL)
ON CONFLICT DO NOTHING;
```

---

## EVIDENCE REQUIRED

1. **Phase 1** - ref_infrastructure_types created with ~55 types
2. **Phase 2** - ref_organization_types created with ~70 types
3. **Phase 3** - organizations table has new columns
4. **Phase 4** - v_infrastructure view created
5. **Phase 5** - v_chamber_members view created
6. **Phase 6** - Infrastructure entities updated with schema_type
7. **Phase 7** - Chamber members flagged
8. **Phase 8** - Organization types auto-assigned from NAICS
9. **Phase 9** - schema_type set from organization_type
10. **Phase 10** - Verification queries pass
11. **Phase 11** - Evidence Ledger updated

---

## SUMMARY

| Reference Table | Types |
|-----------------|-------|
| ref_infrastructure_types | ~55 (airports, fire halls, hospitals, etc.) |
| ref_organization_types | ~70 (hotels, restaurants, contractors, etc.) |

| Entity Classification | Method |
|----------------------|--------|
| Infrastructure | infrastructure_type → schema_type |
| Chamber members | NAICS → organization_type → schema_type |
| Emergency services | is_emergency_service flag |

| schema.org Types Used | Examples |
|----------------------|----------|
| Airport | Airports |
| Hospital | Hospitals |
| FireStation | Fire halls |
| PoliceStation | RCMP, police |
| EmergencyService | SAR, ambulance |
| School | Schools |
| PostOffice | Post offices |
| Pharmacy | Pharmacies |
| LocalBusiness | Chamber members (default) |
| Restaurant, Hotel, etc. | Specific business types |

This completes the schema.org standardization for ALL your data.

BEGIN.
