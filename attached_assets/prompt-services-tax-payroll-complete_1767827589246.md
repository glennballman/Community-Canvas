# PROMPT — SERVICES, TAX, AND PAYROLL FOUNDATION (CANADA COMPLETE)

**Context:** Phases 1-6 complete (UNSPSC, HS, CSI, GL accounts, transactions, reference tables). Now adding services, complete Canadian tax structures, and payroll deduction tables.

---

## PHASE 8: SERVICES TABLE (schema.org Service)

Assets are "things" - but charters, firefighting, catering are SERVICES:

```sql
-- Services offered by organizations (schema.org: Service)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  organization_id UUID REFERENCES organizations(id),
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Schema.org type
  schema_type VARCHAR(50) NOT NULL DEFAULT 'Service',
  -- Values: Service, TouristTrip, BoatTrip, FoodService, 
  --         EmergencyService, LodgingReservation, ParkingService
  
  -- Classification
  naics_code VARCHAR(6),
  unspsc_code VARCHAR(10),
  
  -- Pricing
  base_price DECIMAL(12,2),
  price_currency VARCHAR(3) DEFAULT 'CAD',
  price_unit VARCHAR(20), -- 'hour', 'day', 'trip', 'person'
  
  -- Service area
  service_area TEXT,
  
  -- Availability
  is_active BOOLEAN DEFAULT true,
  seasonal_start DATE,
  seasonal_end DATE,
  
  -- Tax handling
  tax_category VARCHAR(20) DEFAULT 'standard',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY services_tenant_isolation ON services
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE INDEX idx_services_tenant ON services(tenant_id);
CREATE INDEX idx_services_org ON services(organization_id);
```

---

## PHASE 9: MULTI-BUSINESS STRUCTURE

```sql
-- Add parent organization support
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS parent_organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS naics_code_primary VARCHAR(6),
  ADD COLUMN IF NOT EXISTS naics_code_secondary VARCHAR(6),
  ADD COLUMN IF NOT EXISTS business_segment VARCHAR(50);
```

---

## PHASE 10: COMPLETE CANADIAN TAX JURISDICTIONS

```sql
-- Drop and recreate for clean data
DROP TABLE IF EXISTS organization_tax_registrations CASCADE;
DROP TABLE IF EXISTS tax_rates CASCADE;
DROP TABLE IF EXISTS tax_jurisdictions CASCADE;

-- Tax jurisdictions
CREATE TABLE tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,
  region_code VARCHAR(5),
  name VARCHAR(100) NOT NULL,
  jurisdiction_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_code, region_code)
);

-- Tax rates
CREATE TABLE tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES tax_jurisdictions(id),
  tax_code VARCHAR(20) NOT NULL,
  tax_name VARCHAR(100) NOT NULL,
  rate DECIMAL(8,5) NOT NULL,
  tax_category VARCHAR(20) DEFAULT 'standard',
  applies_to VARCHAR(20) DEFAULT 'all',
  effective_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_rates_jurisdiction ON tax_rates(jurisdiction_id);
CREATE INDEX idx_tax_rates_effective ON tax_rates(effective_date);

-- Insert ALL Canadian jurisdictions
INSERT INTO tax_jurisdictions (country_code, region_code, name, jurisdiction_type) VALUES
  -- Canada Federal
  ('CA', NULL, 'Canada Federal', 'federal'),
  -- Provinces
  ('CA', 'AB', 'Alberta', 'provincial'),
  ('CA', 'BC', 'British Columbia', 'provincial'),
  ('CA', 'MB', 'Manitoba', 'provincial'),
  ('CA', 'NB', 'New Brunswick', 'provincial'),
  ('CA', 'NL', 'Newfoundland and Labrador', 'provincial'),
  ('CA', 'NS', 'Nova Scotia', 'provincial'),
  ('CA', 'ON', 'Ontario', 'provincial'),
  ('CA', 'PE', 'Prince Edward Island', 'provincial'),
  ('CA', 'QC', 'Quebec', 'provincial'),
  ('CA', 'SK', 'Saskatchewan', 'provincial'),
  -- Territories
  ('CA', 'NT', 'Northwest Territories', 'territorial'),
  ('CA', 'NU', 'Nunavut', 'territorial'),
  ('CA', 'YT', 'Yukon', 'territorial'),
  -- USA (key states for cross-border)
  ('US', NULL, 'United States Federal', 'federal'),
  ('US', 'AK', 'Alaska', 'state'),
  ('US', 'WA', 'Washington', 'state'),
  ('US', 'OR', 'Oregon', 'state'),
  ('US', 'CA', 'California', 'state'),
  ('US', 'MT', 'Montana', 'state'),
  ('US', 'ID', 'Idaho', 'state')
ON CONFLICT (country_code, region_code) DO NOTHING;

-- Federal GST (5%) - applies to all of Canada
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'GST', 'Goods and Services Tax', 0.05000, '2008-01-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code IS NULL;

-- BRITISH COLUMBIA: GST + 7% PST = 12%
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'PST', 'Provincial Sales Tax', 0.07000, '2013-04-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'BC';

-- ALBERTA: GST only (no PST) = 5%
-- No PST entry needed

-- SASKATCHEWAN: GST + 6% PST = 11%
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'PST', 'Provincial Sales Tax', 0.06000, '2017-03-23'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'SK';

-- MANITOBA: GST + 7% RST = 12%
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'RST', 'Retail Sales Tax', 0.07000, '2019-07-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'MB';

-- ONTARIO: 13% HST (combined, replaces GST+PST)
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'HST', 'Harmonized Sales Tax', 0.13000, '2010-07-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'ON';

-- QUEBEC: GST + 9.975% QST = 14.975%
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'QST', 'Quebec Sales Tax', 0.09975, '2013-01-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'QC';

-- NEW BRUNSWICK: 15% HST (combined)
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'HST', 'Harmonized Sales Tax', 0.15000, '2016-07-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'NB';

-- NOVA SCOTIA: 15% HST (combined)
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'HST', 'Harmonized Sales Tax', 0.15000, '2010-07-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'NS';

-- PRINCE EDWARD ISLAND: 15% HST (combined)
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'HST', 'Harmonized Sales Tax', 0.15000, '2013-04-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'PE';

-- NEWFOUNDLAND AND LABRADOR: 15% HST (combined)
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'HST', 'Harmonized Sales Tax', 0.15000, '2016-07-01'
FROM tax_jurisdictions WHERE country_code = 'CA' AND region_code = 'NL';

-- YUKON: GST only (no territorial tax) = 5%
-- No additional entry needed

-- NORTHWEST TERRITORIES: GST only (no territorial tax) = 5%
-- No additional entry needed

-- NUNAVUT: GST only (no territorial tax) = 5%
-- No additional entry needed

-- US STATES (key ones for cross-border)
-- Washington: 6.5% state sales tax
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'STATE_SALES', 'State Sales Tax', 0.06500, '2017-01-01'
FROM tax_jurisdictions WHERE country_code = 'US' AND region_code = 'WA';

-- Oregon: No sales tax
-- Alaska: No state sales tax (local varies)
-- Montana: No sales tax
-- Idaho: 6% sales tax
INSERT INTO tax_rates (jurisdiction_id, tax_code, tax_name, rate, effective_date)
SELECT id, 'STATE_SALES', 'State Sales Tax', 0.06000, '2020-01-01'
FROM tax_jurisdictions WHERE country_code = 'US' AND region_code = 'ID';
```

---

## PHASE 11: ORGANIZATION TAX REGISTRATIONS

```sql
CREATE TABLE IF NOT EXISTS organization_tax_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  jurisdiction_id UUID NOT NULL REFERENCES tax_jurisdictions(id),
  tax_code VARCHAR(20) NOT NULL,
  registration_number VARCHAR(50) NOT NULL,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, jurisdiction_id, tax_code)
);

-- Add tax columns to transactions if not exists
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS tax_jurisdiction_id UUID REFERENCES tax_jurisdictions(id);

ALTER TABLE transaction_lines
  ADD COLUMN IF NOT EXISTS tax_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(8,5),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2);
```

---

## PHASE 12: REVENUE DEPARTMENTS (USALI-Inspired)

```sql
CREATE TABLE IF NOT EXISTS ref_revenue_departments (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT
);

INSERT INTO ref_revenue_departments (code, name, category) VALUES
  -- Rooms/Lodging
  ('ROOMS', 'Rooms/Lodging Revenue', 'rooms'),
  ('STR', 'Short-Term Rentals', 'rooms'),
  ('MOORAGE', 'Moorage/Docking', 'rooms'),
  ('PARKING', 'Parking Revenue', 'rooms'),
  -- Food & Beverage
  ('FB_REST', 'Restaurant Revenue', 'fb'),
  ('FB_CATER', 'Catering Revenue', 'fb'),
  ('FB_BAR', 'Bar/Beverage Revenue', 'fb'),
  -- Other Operated
  ('CHARTER', 'Charter/Tour Revenue', 'other_operated'),
  ('WHALE', 'Whale Watching Revenue', 'other_operated'),
  ('FISHING', 'Fishing Charter Revenue', 'other_operated'),
  ('RENTAL_EQ', 'Equipment Rental Revenue', 'other_operated'),
  ('KAYAK', 'Kayak/Bike Rental Revenue', 'other_operated'),
  -- Emergency/Contract
  ('EMERG', 'Emergency Services Revenue', 'other_operated'),
  ('FIRE', 'Firefighting Contract Revenue', 'other_operated'),
  ('GOV_CONT', 'Government Contract Revenue', 'other_operated'),
  -- Miscellaneous
  ('FUEL', 'Fuel Sales Revenue', 'misc'),
  ('RETAIL', 'Retail/Gift Shop Revenue', 'misc'),
  ('OTHER', 'Other Revenue', 'misc')
ON CONFLICT (code) DO NOTHING;

-- Add to services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS revenue_department VARCHAR(10) REFERENCES ref_revenue_departments(code);

ALTER TABLE transaction_lines
  ADD COLUMN IF NOT EXISTS revenue_department VARCHAR(10) REFERENCES ref_revenue_departments(code);
```

---

## PHASE 13: PAYROLL - FEDERAL INCOME TAX BRACKETS (2025)

```sql
-- Income tax brackets table
CREATE TABLE IF NOT EXISTS payroll_income_tax_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES tax_jurisdictions(id),
  tax_year INTEGER NOT NULL,
  bracket_number INTEGER NOT NULL,
  income_from DECIMAL(12,2) NOT NULL,
  income_to DECIMAL(12,2), -- NULL means no upper limit
  tax_rate DECIMAL(8,5) NOT NULL,
  base_tax DECIMAL(12,2) DEFAULT 0, -- cumulative tax from lower brackets
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jurisdiction_id, tax_year, bracket_number)
);

CREATE INDEX idx_payroll_tax_brackets_jurisdiction ON payroll_income_tax_brackets(jurisdiction_id);
CREATE INDEX idx_payroll_tax_brackets_year ON payroll_income_tax_brackets(tax_year);

-- FEDERAL INCOME TAX 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, 1, 0, 55867, 0.15000, 0
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code IS NULL;

INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, 2, 55867.01, 111733, 0.20500, 8380.05
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code IS NULL;

INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, 3, 111733.01, 173205, 0.26000, 19832.58
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code IS NULL;

INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, 4, 173205.01, 246752, 0.29000, 35815.30
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code IS NULL;

INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, 5, 246752.01, NULL, 0.33000, 57143.93
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code IS NULL;
```

---

## PHASE 14: PROVINCIAL INCOME TAX BRACKETS (ALL PROVINCES - 2025)

```sql
-- BRITISH COLUMBIA 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 47937, 0.0506, 0),
  (2, 47937.01, 95875, 0.0770, 2425.61),
  (3, 95875.01, 110076, 0.1050, 6117.56),
  (4, 110076.01, 133664, 0.1229, 7608.67),
  (5, 133664.01, 181232, 0.1470, 10507.95),
  (6, 181232.01, NULL, 0.2050, 17490.44)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'BC';

-- ALBERTA 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 148269, 0.1000, 0),
  (2, 148269.01, 177922, 0.1200, 14826.90),
  (3, 177922.01, 237230, 0.1300, 18385.26),
  (4, 237230.01, 355845, 0.1400, 26095.30),
  (5, 355845.01, NULL, 0.1500, 42701.40)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'AB';

-- SASKATCHEWAN 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 52057, 0.1050, 0),
  (2, 52057.01, 148734, 0.1250, 5465.99),
  (3, 148734.01, NULL, 0.1450, 17550.61)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'SK';

-- MANITOBA 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 47000, 0.1080, 0),
  (2, 47000.01, 100000, 0.1275, 5076.00),
  (3, 100000.01, NULL, 0.1740, 11833.25)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'MB';

-- ONTARIO 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 51446, 0.0505, 0),
  (2, 51446.01, 102894, 0.0915, 2598.02),
  (3, 102894.01, 150000, 0.1116, 7306.50),
  (4, 150000.01, 220000, 0.1216, 12563.92),
  (5, 220000.01, NULL, 0.1316, 21075.92)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'ON';

-- QUEBEC 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 51780, 0.1400, 0),
  (2, 51780.01, 103545, 0.1900, 7249.20),
  (3, 103545.01, 126000, 0.2400, 17084.55),
  (4, 126000.01, NULL, 0.2575, 22473.75)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'QC';

-- NEW BRUNSWICK 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 49958, 0.0940, 0),
  (2, 49958.01, 99916, 0.1400, 4696.05),
  (3, 99916.01, 185064, 0.1600, 11690.17),
  (4, 185064.01, NULL, 0.1950, 25313.85)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'NB';

-- NOVA SCOTIA 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 29590, 0.0879, 0),
  (2, 29590.01, 59180, 0.1495, 2600.96),
  (3, 59180.01, 93000, 0.1667, 7024.67),
  (4, 93000.01, 150000, 0.1750, 12662.33),
  (5, 150000.01, NULL, 0.2100, 22637.33)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'NS';

-- PRINCE EDWARD ISLAND 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 32656, 0.0965, 0),
  (2, 32656.01, 64313, 0.1363, 3151.30),
  (3, 64313.01, 105000, 0.1665, 7464.31),
  (4, 105000.01, 140000, 0.1800, 14242.74),
  (5, 140000.01, NULL, 0.1875, 20542.74)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'PE';

-- NEWFOUNDLAND AND LABRADOR 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 43198, 0.0870, 0),
  (2, 43198.01, 86395, 0.1450, 3758.23),
  (3, 86395.01, 154244, 0.1580, 10021.80),
  (4, 154244.01, 215943, 0.1780, 20741.05),
  (5, 215943.01, 275870, 0.1980, 31723.36),
  (6, 275870.01, 551739, 0.2080, 43587.92),
  (7, 551739.01, 1103478, 0.2130, 100968.67),
  (8, 1103478.01, NULL, 0.2180, 218489.18)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'NL';

-- YUKON 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 55867, 0.0640, 0),
  (2, 55867.01, 111733, 0.0900, 3575.49),
  (3, 111733.01, 173205, 0.1090, 8603.43),
  (4, 173205.01, 500000, 0.1280, 15300.89),
  (5, 500000.01, NULL, 0.1500, 57129.65)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'YT';

-- NORTHWEST TERRITORIES 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 50597, 0.0590, 0),
  (2, 50597.01, 101198, 0.0860, 2985.22),
  (3, 101198.01, 164525, 0.1220, 7336.89),
  (4, 164525.01, NULL, 0.1405, 15062.78)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'NT';

-- NUNAVUT 2025
INSERT INTO payroll_income_tax_brackets (jurisdiction_id, tax_year, bracket_number, income_from, income_to, tax_rate, base_tax)
SELECT j.id, 2025, b.num, b.from_amt, b.to_amt, b.rate, b.base
FROM tax_jurisdictions j,
(VALUES 
  (1, 0, 53268, 0.0400, 0),
  (2, 53268.01, 106537, 0.0700, 2130.72),
  (3, 106537.01, 173205, 0.0900, 5859.55),
  (4, 173205.01, NULL, 0.1150, 11859.67)
) AS b(num, from_amt, to_amt, rate, base)
WHERE j.country_code = 'CA' AND j.region_code = 'NU';
```

---

## PHASE 15: CPP AND EI CONTRIBUTIONS (2025)

```sql
-- Payroll contribution rates (CPP, EI, etc.)
CREATE TABLE IF NOT EXISTS payroll_contribution_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES tax_jurisdictions(id),
  contribution_type VARCHAR(20) NOT NULL, -- CPP, CPP2, EI, QPIP, etc.
  contribution_name VARCHAR(100) NOT NULL,
  tax_year INTEGER NOT NULL,
  
  -- Rate information
  employee_rate DECIMAL(8,5) NOT NULL,
  employer_rate DECIMAL(8,5) NOT NULL,
  self_employed_rate DECIMAL(8,5),
  
  -- Limits
  annual_max_pensionable_earnings DECIMAL(12,2),
  annual_max_insurable_earnings DECIMAL(12,2),
  basic_exemption DECIMAL(12,2),
  max_employee_contribution DECIMAL(12,2),
  max_employer_contribution DECIMAL(12,2),
  
  -- For CPP2 (enhanced)
  earnings_ceiling DECIMAL(12,2), -- upper limit for CPP2
  
  effective_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jurisdiction_id, contribution_type, tax_year)
);

CREATE INDEX idx_payroll_contributions_jurisdiction ON payroll_contribution_rates(jurisdiction_id);
CREATE INDEX idx_payroll_contributions_year ON payroll_contribution_rates(tax_year);

-- CPP 2025 (Canada Pension Plan)
INSERT INTO payroll_contribution_rates (
  jurisdiction_id, contribution_type, contribution_name, tax_year,
  employee_rate, employer_rate, self_employed_rate,
  annual_max_pensionable_earnings, basic_exemption,
  max_employee_contribution, max_employer_contribution, effective_date
)
SELECT j.id, 'CPP', 'Canada Pension Plan', 2025,
  0.0595, 0.0595, 0.1190,
  71300.00, 3500.00,
  4034.10, 4034.10, '2025-01-01'
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code IS NULL;

-- CPP2 2025 (Enhanced CPP - second earnings ceiling)
INSERT INTO payroll_contribution_rates (
  jurisdiction_id, contribution_type, contribution_name, tax_year,
  employee_rate, employer_rate, self_employed_rate,
  annual_max_pensionable_earnings, earnings_ceiling,
  max_employee_contribution, max_employer_contribution, effective_date
)
SELECT j.id, 'CPP2', 'Canada Pension Plan Enhanced', 2025,
  0.0400, 0.0400, 0.0800,
  71300.00, 81200.00,
  396.00, 396.00, '2025-01-01'
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code IS NULL;

-- EI 2025 (Employment Insurance) - All provinces except Quebec
INSERT INTO payroll_contribution_rates (
  jurisdiction_id, contribution_type, contribution_name, tax_year,
  employee_rate, employer_rate, self_employed_rate,
  annual_max_insurable_earnings,
  max_employee_contribution, max_employer_contribution, effective_date
)
SELECT j.id, 'EI', 'Employment Insurance', 2025,
  0.0164, 0.02296, NULL, -- employer is 1.4x employee
  65700.00,
  1077.48, 1508.47, '2025-01-01'
FROM tax_jurisdictions j 
WHERE j.country_code = 'CA' AND (j.region_code IS NULL OR j.region_code != 'QC');

-- QUEBEC EI 2025 (reduced rate because of QPIP)
INSERT INTO payroll_contribution_rates (
  jurisdiction_id, contribution_type, contribution_name, tax_year,
  employee_rate, employer_rate, self_employed_rate,
  annual_max_insurable_earnings,
  max_employee_contribution, max_employer_contribution, effective_date
)
SELECT j.id, 'EI_QC', 'Employment Insurance (Quebec)', 2025,
  0.0130, 0.0182, NULL,
  65700.00,
  854.10, 1195.74, '2025-01-01'
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code = 'QC';

-- QPIP 2025 (Quebec Parental Insurance Plan)
INSERT INTO payroll_contribution_rates (
  jurisdiction_id, contribution_type, contribution_name, tax_year,
  employee_rate, employer_rate, self_employed_rate,
  annual_max_insurable_earnings,
  max_employee_contribution, max_employer_contribution, effective_date
)
SELECT j.id, 'QPIP', 'Quebec Parental Insurance Plan', 2025,
  0.00494, 0.00692, 0.00878,
  94000.00,
  464.36, 650.48, '2025-01-01'
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code = 'QC';

-- QPP 2025 (Quebec Pension Plan - replaces CPP in Quebec)
INSERT INTO payroll_contribution_rates (
  jurisdiction_id, contribution_type, contribution_name, tax_year,
  employee_rate, employer_rate, self_employed_rate,
  annual_max_pensionable_earnings, basic_exemption,
  max_employee_contribution, max_employer_contribution, effective_date
)
SELECT j.id, 'QPP', 'Quebec Pension Plan', 2025,
  0.0640, 0.0640, 0.1280,
  71300.00, 3500.00,
  4339.20, 4339.20, '2025-01-01'
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code = 'QC';
```

---

## PHASE 16: EMPLOYER PAYROLL TAXES

```sql
-- Employer-only payroll taxes (health tax, etc.)
CREATE TABLE IF NOT EXISTS payroll_employer_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES tax_jurisdictions(id),
  tax_code VARCHAR(20) NOT NULL,
  tax_name VARCHAR(100) NOT NULL,
  tax_year INTEGER NOT NULL,
  
  -- Tiered rates (based on total payroll)
  payroll_threshold_from DECIMAL(14,2) NOT NULL,
  payroll_threshold_to DECIMAL(14,2), -- NULL = no limit
  rate DECIMAL(8,5) NOT NULL,
  
  -- Exemptions
  exemption_amount DECIMAL(14,2) DEFAULT 0,
  
  effective_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payroll_employer_taxes_jurisdiction ON payroll_employer_taxes(jurisdiction_id);

-- BRITISH COLUMBIA Employer Health Tax 2025
INSERT INTO payroll_employer_taxes (jurisdiction_id, tax_code, tax_name, tax_year, payroll_threshold_from, payroll_threshold_to, rate, exemption_amount, effective_date)
SELECT j.id, 'BC_EHT', 'BC Employer Health Tax', 2025, t.from_amt, t.to_amt, t.rate, 500000, '2025-01-01'
FROM tax_jurisdictions j,
(VALUES 
  (0, 500000, 0.00000),          -- Exempt under $500K
  (500000.01, 1500000, 0.02925), -- 2.925% between $500K-$1.5M (notch rate)
  (1500000.01, NULL, 0.01950)   -- 1.95% over $1.5M
) AS t(from_amt, to_amt, rate)
WHERE j.country_code = 'CA' AND j.region_code = 'BC';

-- ONTARIO Employer Health Tax 2025
INSERT INTO payroll_employer_taxes (jurisdiction_id, tax_code, tax_name, tax_year, payroll_threshold_from, payroll_threshold_to, rate, exemption_amount, effective_date)
SELECT j.id, 'ON_EHT', 'Ontario Employer Health Tax', 2025, t.from_amt, t.to_amt, t.rate, 1000000, '2025-01-01'
FROM tax_jurisdictions j,
(VALUES 
  (0, 200000, 0.00980),
  (200000.01, 230000, 0.01101),
  (230000.01, 260000, 0.01223),
  (260000.01, 290000, 0.01344),
  (290000.01, 320000, 0.01465),
  (320000.01, 350000, 0.01587),
  (350000.01, 380000, 0.01708),
  (380000.01, 400000, 0.01829),
  (400000.01, NULL, 0.01950)
) AS t(from_amt, to_amt, rate)
WHERE j.country_code = 'CA' AND j.region_code = 'ON';

-- MANITOBA Health and Post-Secondary Education Tax 2025
INSERT INTO payroll_employer_taxes (jurisdiction_id, tax_code, tax_name, tax_year, payroll_threshold_from, payroll_threshold_to, rate, exemption_amount, effective_date)
SELECT j.id, 'MB_HE', 'Manitoba Health & Education Tax', 2025, t.from_amt, t.to_amt, t.rate, 2250000, '2025-01-01'
FROM tax_jurisdictions j,
(VALUES 
  (0, 2250000, 0.00000),         -- Exempt under $2.25M
  (2250000.01, 4500000, 0.0450), -- 4.5% reduced rate
  (4500000.01, NULL, 0.02150)    -- 2.15% over $4.5M
) AS t(from_amt, to_amt, rate)
WHERE j.country_code = 'CA' AND j.region_code = 'MB';

-- QUEBEC Health Services Fund 2025
INSERT INTO payroll_employer_taxes (jurisdiction_id, tax_code, tax_name, tax_year, payroll_threshold_from, payroll_threshold_to, rate, exemption_amount, effective_date)
SELECT j.id, 'QC_HSF', 'Quebec Health Services Fund', 2025, t.from_amt, t.to_amt, t.rate, 0, '2025-01-01'
FROM tax_jurisdictions j,
(VALUES 
  (0, 1000000, 0.01650),         -- Small employer (service)
  (1000000.01, 7000000, 0.01650),
  (7000000.01, NULL, 0.04260)    -- Large employer
) AS t(from_amt, to_amt, rate)
WHERE j.country_code = 'CA' AND j.region_code = 'QC';

-- QUEBEC WSDRF (Workforce Skills Development and Recognition Fund) 2025
INSERT INTO payroll_employer_taxes (jurisdiction_id, tax_code, tax_name, tax_year, payroll_threshold_from, payroll_threshold_to, rate, exemption_amount, effective_date)
SELECT j.id, 'QC_WSDRF', 'Quebec Workforce Skills Fund', 2025, 0, NULL, 0.01000, 2000000, '2025-01-01'
FROM tax_jurisdictions j WHERE j.country_code = 'CA' AND j.region_code = 'QC';

-- NEWFOUNDLAND Health and Post-Secondary Education Tax 2025
INSERT INTO payroll_employer_taxes (jurisdiction_id, tax_code, tax_name, tax_year, payroll_threshold_from, payroll_threshold_to, rate, exemption_amount, effective_date)
SELECT j.id, 'NL_HAPSET', 'NL Health & Education Tax', 2025, t.from_amt, t.to_amt, t.rate, 2000000, '2025-01-01'
FROM tax_jurisdictions j,
(VALUES 
  (0, 2000000, 0.00000),
  (2000000.01, NULL, 0.02000)
) AS t(from_amt, to_amt, rate)
WHERE j.country_code = 'CA' AND j.region_code = 'NL';
```

---

## PHASE 17: TIME TRACKING FOUNDATION

```sql
-- Employees/Workers table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  person_id UUID REFERENCES people(id),
  
  -- Employment info
  employee_number VARCHAR(20),
  employment_type VARCHAR(20) NOT NULL DEFAULT 'employee', -- employee, contractor, casual
  employment_status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, terminated, leave
  
  -- Position
  job_title VARCHAR(100),
  department VARCHAR(100),
  
  -- Dates
  hire_date DATE NOT NULL,
  termination_date DATE,
  
  -- Compensation
  pay_type VARCHAR(20) NOT NULL DEFAULT 'hourly', -- hourly, salary, commission
  pay_rate DECIMAL(10,2),
  pay_currency VARCHAR(3) DEFAULT 'CAD',
  pay_frequency VARCHAR(20) DEFAULT 'biweekly', -- weekly, biweekly, semimonthly, monthly
  
  -- Tax info
  tax_jurisdiction_id UUID REFERENCES tax_jurisdictions(id),
  sin_encrypted VARCHAR(255), -- encrypted SIN
  td1_federal_claim DECIMAL(10,2), -- federal basic personal amount claimed
  td1_provincial_claim DECIMAL(10,2),
  
  -- Direct deposit (encrypted)
  bank_transit_encrypted VARCHAR(255),
  bank_account_encrypted VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY employees_tenant_isolation ON employees
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_person ON employees(person_id);

-- Time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  
  -- What they worked on
  project_id UUID REFERENCES projects(id),
  work_request_id UUID REFERENCES work_requests(id),
  service_id UUID REFERENCES services(id),
  
  -- Time
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  hours_worked DECIMAL(5,2) NOT NULL,
  break_hours DECIMAL(5,2) DEFAULT 0,
  
  -- Classification
  pay_type VARCHAR(20) DEFAULT 'regular', -- regular, overtime, doubletime, statutory
  billable BOOLEAN DEFAULT true,
  
  -- Rates (can override employee default)
  hourly_rate DECIMAL(10,2),
  bill_rate DECIMAL(10,2),
  
  -- Job costing
  csi_division VARCHAR(2),
  csi_section VARCHAR(8),
  revenue_department VARCHAR(10) REFERENCES ref_revenue_departments(code),
  
  -- Approval
  status VARCHAR(20) DEFAULT 'draft', -- draft, submitted, approved, rejected, processed
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Notes
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_entries_tenant_isolation ON time_entries
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_time_entries_tenant ON time_entries(tenant_id);
CREATE INDEX idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX idx_time_entries_date ON time_entries(work_date);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);

-- Pay runs (payroll batches)
CREATE TABLE IF NOT EXISTS pay_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Period
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, processing, approved, paid
  
  -- Totals
  gross_pay_total DECIMAL(14,2),
  deductions_total DECIMAL(14,2),
  net_pay_total DECIMAL(14,2),
  employer_contributions_total DECIMAL(14,2),
  
  -- Processing
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pay_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_runs_tenant_isolation ON pay_runs
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Pay stubs (individual employee pay for a pay run)
CREATE TABLE IF NOT EXISTS pay_stubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_run_id UUID NOT NULL REFERENCES pay_runs(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  
  -- Hours
  regular_hours DECIMAL(6,2),
  overtime_hours DECIMAL(6,2),
  statutory_hours DECIMAL(6,2),
  vacation_hours DECIMAL(6,2),
  sick_hours DECIMAL(6,2),
  
  -- Earnings
  regular_earnings DECIMAL(12,2),
  overtime_earnings DECIMAL(12,2),
  other_earnings DECIMAL(12,2),
  gross_earnings DECIMAL(12,2) NOT NULL,
  
  -- Deductions (employee portion)
  federal_tax DECIMAL(10,2),
  provincial_tax DECIMAL(10,2),
  cpp_contribution DECIMAL(10,2),
  ei_contribution DECIMAL(10,2),
  qpip_contribution DECIMAL(10,2), -- Quebec only
  other_deductions DECIMAL(10,2),
  total_deductions DECIMAL(12,2) NOT NULL,
  
  -- Net
  net_pay DECIMAL(12,2) NOT NULL,
  
  -- Employer contributions (for records)
  employer_cpp DECIMAL(10,2),
  employer_ei DECIMAL(10,2),
  employer_health_tax DECIMAL(10,2),
  employer_qpip DECIMAL(10,2),
  employer_total DECIMAL(12,2),
  
  -- YTD totals
  ytd_gross DECIMAL(14,2),
  ytd_federal_tax DECIMAL(14,2),
  ytd_provincial_tax DECIMAL(14,2),
  ytd_cpp DECIMAL(14,2),
  ytd_ei DECIMAL(14,2),
  ytd_net DECIMAL(14,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pay_stubs_pay_run ON pay_stubs(pay_run_id);
CREATE INDEX idx_pay_stubs_employee ON pay_stubs(employee_id);
```

---

## PHASE 18: STATUTORY HOLIDAYS

```sql
-- Statutory holidays by jurisdiction
CREATE TABLE IF NOT EXISTS statutory_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES tax_jurisdictions(id),
  holiday_name VARCHAR(100) NOT NULL,
  holiday_date DATE NOT NULL,
  is_optional BOOLEAN DEFAULT false, -- some provinces have optional holidays
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jurisdiction_id, holiday_date)
);

CREATE INDEX idx_statutory_holidays_jurisdiction ON statutory_holidays(jurisdiction_id);
CREATE INDEX idx_statutory_holidays_date ON statutory_holidays(holiday_date);

-- 2025 Canadian Federal Statutory Holidays
INSERT INTO statutory_holidays (jurisdiction_id, holiday_name, holiday_date)
SELECT j.id, h.name, h.dt::date
FROM tax_jurisdictions j,
(VALUES 
  ('New Year''s Day', '2025-01-01'),
  ('Good Friday', '2025-04-18'),
  ('Victoria Day', '2025-05-19'),
  ('Canada Day', '2025-07-01'),
  ('Labour Day', '2025-09-01'),
  ('National Day for Truth and Reconciliation', '2025-09-30'),
  ('Thanksgiving', '2025-10-13'),
  ('Remembrance Day', '2025-11-11'),
  ('Christmas Day', '2025-12-25')
) AS h(name, dt)
WHERE j.country_code = 'CA' AND j.region_code IS NULL;

-- BC Additional Holidays 2025
INSERT INTO statutory_holidays (jurisdiction_id, holiday_name, holiday_date)
SELECT j.id, h.name, h.dt::date
FROM tax_jurisdictions j,
(VALUES 
  ('Family Day', '2025-02-17'),
  ('BC Day', '2025-08-04')
) AS h(name, dt)
WHERE j.country_code = 'CA' AND j.region_code = 'BC';

-- Alberta Additional Holidays 2025
INSERT INTO statutory_holidays (jurisdiction_id, holiday_name, holiday_date)
SELECT j.id, h.name, h.dt::date
FROM tax_jurisdictions j,
(VALUES 
  ('Family Day', '2025-02-17'),
  ('Heritage Day', '2025-08-04')
) AS h(name, dt)
WHERE j.country_code = 'CA' AND j.region_code = 'AB';

-- Ontario Additional Holidays 2025
INSERT INTO statutory_holidays (jurisdiction_id, holiday_name, holiday_date)
SELECT j.id, h.name, h.dt::date
FROM tax_jurisdictions j,
(VALUES 
  ('Family Day', '2025-02-17'),
  ('Civic Holiday', '2025-08-04'),
  ('Boxing Day', '2025-12-26')
) AS h(name, dt)
WHERE j.country_code = 'CA' AND j.region_code = 'ON';

-- Quebec Additional Holidays 2025
INSERT INTO statutory_holidays (jurisdiction_id, holiday_name, holiday_date)
SELECT j.id, h.name, h.dt::date
FROM tax_jurisdictions j,
(VALUES 
  ('National Patriots'' Day', '2025-05-19'),
  ('Saint-Jean-Baptiste Day', '2025-06-24')
) AS h(name, dt)
WHERE j.country_code = 'CA' AND j.region_code = 'QC';
```

---

## PHASE 19: VERIFICATION

```sql
-- Verify tax jurisdictions
SELECT country_code, region_code, name, jurisdiction_type 
FROM tax_jurisdictions 
WHERE country_code = 'CA'
ORDER BY region_code NULLS FIRST;

-- Verify sales tax rates
SELECT j.region_code, j.name, t.tax_code, t.tax_name, t.rate
FROM tax_jurisdictions j
LEFT JOIN tax_rates t ON t.jurisdiction_id = j.id
WHERE j.country_code = 'CA'
ORDER BY j.region_code NULLS FIRST, t.tax_code;

-- Verify income tax brackets count by province
SELECT j.region_code, j.name, COUNT(*) as brackets
FROM tax_jurisdictions j
JOIN payroll_income_tax_brackets b ON b.jurisdiction_id = j.id
WHERE j.country_code = 'CA' AND b.tax_year = 2025
GROUP BY j.region_code, j.name
ORDER BY j.region_code NULLS FIRST;

-- Verify contribution rates
SELECT j.region_code, c.contribution_type, c.contribution_name, 
       c.employee_rate, c.employer_rate
FROM tax_jurisdictions j
JOIN payroll_contribution_rates c ON c.jurisdiction_id = j.id
WHERE j.country_code = 'CA' AND c.tax_year = 2025
ORDER BY j.region_code NULLS FIRST, c.contribution_type;

-- Verify employer taxes
SELECT j.region_code, e.tax_code, e.tax_name
FROM tax_jurisdictions j
JOIN payroll_employer_taxes e ON e.jurisdiction_id = j.id
WHERE j.country_code = 'CA' AND e.tax_year = 2025
ORDER BY j.region_code;

-- Verify new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'services', 'tax_jurisdictions', 'tax_rates', 'organization_tax_registrations',
  'ref_revenue_departments', 'payroll_income_tax_brackets', 'payroll_contribution_rates',
  'payroll_employer_taxes', 'employees', 'time_entries', 'pay_runs', 'pay_stubs',
  'statutory_holidays'
)
ORDER BY table_name;

-- Summary counts
SELECT 'tax_jurisdictions' as tbl, COUNT(*) FROM tax_jurisdictions
UNION ALL SELECT 'tax_rates', COUNT(*) FROM tax_rates
UNION ALL SELECT 'payroll_income_tax_brackets', COUNT(*) FROM payroll_income_tax_brackets
UNION ALL SELECT 'payroll_contribution_rates', COUNT(*) FROM payroll_contribution_rates
UNION ALL SELECT 'payroll_employer_taxes', COUNT(*) FROM payroll_employer_taxes
UNION ALL SELECT 'statutory_holidays', COUNT(*) FROM statutory_holidays
UNION ALL SELECT 'ref_revenue_departments', COUNT(*) FROM ref_revenue_departments;
```

---

## PHASE 20: UPDATE EVIDENCE LEDGER

```sql
INSERT INTO system_evidence (artifact_type, artifact_name, description, evidence_type, tenant_id)
VALUES 
  ('table', 'services', 'Services offered (schema.org Service)', 'required', NULL),
  ('table', 'tax_jurisdictions', 'Tax jurisdictions (CA provinces, US states)', 'required', NULL),
  ('table', 'tax_rates', 'Sales tax rates by jurisdiction', 'required', NULL),
  ('table', 'organization_tax_registrations', 'Organization tax numbers', 'required', NULL),
  ('table', 'ref_revenue_departments', 'USALI revenue departments', 'required', NULL),
  ('table', 'payroll_income_tax_brackets', 'Federal/provincial income tax brackets', 'required', NULL),
  ('table', 'payroll_contribution_rates', 'CPP, EI, QPP, QPIP rates', 'required', NULL),
  ('table', 'payroll_employer_taxes', 'Employer health taxes (EHT, etc.)', 'required', NULL),
  ('table', 'employees', 'Employee records', 'required', NULL),
  ('table', 'time_entries', 'Time tracking entries', 'required', NULL),
  ('table', 'pay_runs', 'Payroll run batches', 'required', NULL),
  ('table', 'pay_stubs', 'Individual pay stubs', 'required', NULL),
  ('table', 'statutory_holidays', 'Statutory holidays by jurisdiction', 'required', NULL)
ON CONFLICT DO NOTHING;
```

---

## EVIDENCE REQUIRED

1. **Phase 8** - services table created
2. **Phase 9** - organizations has parent_organization_id, naics columns
3. **Phase 10** - 14 Canadian jurisdictions + key US states
4. **Phase 11** - organization_tax_registrations created
5. **Phase 12** - ref_revenue_departments seeded (18 codes)
6. **Phase 13** - Federal income tax brackets (5 brackets)
7. **Phase 14** - All 13 provinces/territories have income tax brackets
8. **Phase 15** - CPP, CPP2, EI, QPP, QPIP contribution rates
9. **Phase 16** - Employer health taxes (BC, ON, MB, QC, NL)
10. **Phase 17** - employees, time_entries, pay_runs, pay_stubs tables
11. **Phase 18** - statutory_holidays seeded
12. **Phase 19** - All verification queries pass
13. **Phase 20** - Evidence Ledger updated with 13 new entries

---

## SUMMARY

| Layer | What's Added |
|-------|--------------|
| **Services** | schema.org Service for charters, firefighting, catering |
| **Multi-Business** | Parent/child organizations, multiple NAICS |
| **Sales Tax** | All 13 CA provinces/territories, key US states |
| **Income Tax** | Federal + all provincial brackets (2025) |
| **CPP/EI** | Contribution rates, maximums, Quebec specifics |
| **Employer Tax** | BC EHT, ON EHT, MB, QC HSF, NL |
| **Time Tracking** | Employees, time entries, projects |
| **Payroll** | Pay runs, pay stubs, YTD tracking |
| **Holidays** | Statutory holidays by jurisdiction |

**Total new tables:** 13
**Tax brackets seeded:** ~60+ (federal + all provinces)
**Contribution rates:** CPP, CPP2, EI, QPP, QPIP
**Employer taxes:** 5 provinces with payroll taxes

This is payroll-ready for all of Canada.

BEGIN.
