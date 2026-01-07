# PROMPT — PROCUREMENT & ACCOUNTING STANDARDS INTEGRATION

**Purpose:** Add industry-standard classification columns NOW so accounting integration doesn't require a refactor later.

We just finished schema.org alignment. Now we're future-proofing for:
- Procurement (UNSPSC)
- Imports/Customs (HS Codes)
- Construction Job Costing (CSI MasterFormat)
- Accounting Integration (GL mapping)

---

## PHASE 1: ADD CLASSIFICATION COLUMNS TO ASSETS

The `assets` table needs procurement classification:

```sql
-- UNSPSC: 8-digit product classification (e.g., 31161500 for "Nuts")
ALTER TABLE assets ADD COLUMN IF NOT EXISTS unspsc_code VARCHAR(10);

-- HS Code: 6-10 digit customs code for imports (e.g., 7318.15 for steel fasteners)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS hs_code VARCHAR(12);

-- Manufacturer info (schema.org compatible)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255);

-- Model number
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model_number VARCHAR(100);

-- SKU (supplier's product code)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS supplier_sku VARCHAR(100);

-- Country of origin (for imports)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(3); -- ISO 3166-1 alpha-3

-- Unit of measure (schema.org: unitCode)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS unit_code VARCHAR(10); -- e.g., "EA", "KG", "M"

-- Cost tracking
ALTER TABLE assets ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CAD'; -- ISO 4217
```

**UNSPSC Segments for Community Canvas:**

| Segment | Name | Your Assets |
|---------|------|-------------|
| 22 | Building & Construction Machinery | Excavators, skidsteers, flatbed trailers |
| 25 | Vehicles | Trucks, cube vans, boats, trailers |
| 27 | Tools & General Machinery | Hand tools, power tools |
| 30 | Building Materials | Windows, doors, lumber, fixtures |
| 31 | Manufacturing Components | Fasteners, hardware (lock nuts) |
| 46 | Safety Equipment | PPE, emergency gear, first aid |
| 49 | Sporting/Recreational | Kayaks, bikes, fishing gear |
| 56 | Furniture | Tables, chairs, beds |

---

## PHASE 2: ADD JOB COSTING TO PROJECTS/WORK REQUESTS

Construction projects need CSI MasterFormat codes:

```sql
-- CSI MasterFormat Division (2-digit) and Section (6-digit)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS csi_division VARCHAR(2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS csi_section VARCHAR(8);

ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS csi_division VARCHAR(2);
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS csi_section VARCHAR(8);

-- Job cost tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(12,2);

ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(12,2);
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(12,2);
```

**CSI MasterFormat Divisions for Community Canvas:**

| Division | Name | Your Work |
|----------|------|-----------|
| 01 | General Requirements | Project admin, temporary facilities |
| 03 | Concrete | Foundations, slabs |
| 05 | Metals | Fasteners, structural steel, dock hardware |
| 06 | Wood & Plastics | Framing, decking, cabin construction |
| 07 | Thermal & Moisture | Roofing, insulation, waterproofing |
| 08 | Doors & Windows | Windows, doors, hardware |
| 09 | Finishes | Drywall, paint, flooring |
| 22 | Plumbing | Pipes, fixtures |
| 26 | Electrical | Wiring, panels, generators |
| 31 | Earthwork | Excavation, grading |
| 32 | Exterior Improvements | Landscaping, paving |
| 35 | Waterway & Marine | Docks, piers, marine structures |

---

## PHASE 3: ADD GL ACCOUNT MAPPING (Future-Ready)

Create a mapping table for future accounting integration:

```sql
-- GL Account Categories (simplified chart of accounts structure)
CREATE TABLE IF NOT EXISTS gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Account identification
  account_code VARCHAR(10) NOT NULL, -- e.g., "5070"
  account_name VARCHAR(255) NOT NULL, -- e.g., "Maintenance & Repairs"
  
  -- Classification
  account_type VARCHAR(20) NOT NULL, -- asset, liability, equity, revenue, expense
  parent_code VARCHAR(10), -- for hierarchy
  
  -- Standard mappings
  unspsc_segment VARCHAR(2), -- maps to UNSPSC segment
  csi_division VARCHAR(2), -- maps to CSI division
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, account_code)
);

-- Enable RLS
ALTER TABLE gl_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY gl_accounts_tenant_isolation ON gl_accounts
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Standard GL Structure (ASPE/GAAP compatible):**

| Range | Type | Examples |
|-------|------|----------|
| 1000-1999 | Assets | Cash, Inventory, Equipment |
| 2000-2999 | Liabilities | Accounts Payable, Loans |
| 3000-3999 | Equity | Owner's Equity, Retained Earnings |
| 4000-4999 | Revenue | Service Revenue, Sales |
| 5000-5999 | Cost of Goods Sold | Materials, Direct Labor |
| 6000-6999 | Operating Expenses | Wages, Rent, Utilities |
| 7000-7999 | Other Expenses | Interest, Depreciation |

---

## PHASE 4: ADD TRANSACTION TRACKING (Future-Ready)

```sql
-- Transaction header (for future invoices, bills, journals)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Transaction identification
  transaction_number VARCHAR(50),
  transaction_type VARCHAR(20) NOT NULL, -- invoice, bill, journal, payment
  transaction_date DATE NOT NULL,
  
  -- Parties
  organization_id UUID REFERENCES organizations(id),
  person_id UUID REFERENCES people(id),
  
  -- Project linkage
  project_id UUID REFERENCES projects(id),
  work_request_id UUID REFERENCES work_requests(id),
  
  -- Amounts
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CAD',
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, posted, void
  
  -- Metadata
  reference VARCHAR(255), -- external reference (PO number, etc.)
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction lines (individual items)
CREATE TABLE IF NOT EXISTS transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  
  -- Line item
  line_number INTEGER NOT NULL,
  description TEXT,
  
  -- Asset/Item reference
  asset_id UUID REFERENCES assets(id),
  
  -- Classification
  unspsc_code VARCHAR(10),
  csi_section VARCHAR(8),
  gl_account_code VARCHAR(10),
  
  -- Quantities and amounts
  quantity DECIMAL(12,4),
  unit_code VARCHAR(10),
  unit_price DECIMAL(12,4),
  line_total DECIMAL(12,2) NOT NULL,
  
  -- For imports
  hs_code VARCHAR(12),
  duty_amount DECIMAL(12,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY transactions_tenant_isolation ON transactions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY transaction_lines_tenant_isolation ON transaction_lines
  FOR ALL USING (
    transaction_id IN (
      SELECT id FROM transactions 
      WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );
```

---

## PHASE 5: CREATE REFERENCE TABLES

```sql
-- UNSPSC Segments (top-level reference)
CREATE TABLE IF NOT EXISTS ref_unspsc_segments (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT
);

-- Seed essential segments
INSERT INTO ref_unspsc_segments (code, name) VALUES
  ('10', 'Live Plant and Animal Material'),
  ('15', 'Fuels and Lubricants'),
  ('20', 'Mining and Drilling Machinery'),
  ('21', 'Material Handling Equipment'),
  ('22', 'Building and Construction Machinery'),
  ('23', 'Industrial Manufacturing Machinery'),
  ('24', 'Industrial Process Machinery'),
  ('25', 'Vehicles and Accessories'),
  ('26', 'Power Generation Equipment'),
  ('27', 'Tools and General Machinery'),
  ('30', 'Building Materials and Construction'),
  ('31', 'Manufacturing Components'),
  ('32', 'Electronic Components'),
  ('39', 'Electrical Systems and Lighting'),
  ('40', 'HVAC and Plumbing'),
  ('41', 'Laboratory Equipment'),
  ('42', 'Medical Equipment'),
  ('43', 'IT and Telecommunications'),
  ('44', 'Office Equipment'),
  ('46', 'Safety and Security Equipment'),
  ('47', 'Cleaning Equipment'),
  ('49', 'Sporting and Recreational'),
  ('50', 'Food and Beverage'),
  ('51', 'Drugs and Pharmaceuticals'),
  ('52', 'Domestic Appliances'),
  ('53', 'Apparel and Luggage'),
  ('55', 'Arts and Crafts'),
  ('56', 'Furniture and Furnishings'),
  ('60', 'Musical Instruments'),
  ('70', 'Farming Equipment'),
  ('72', 'Building Maintenance Services'),
  ('73', 'Industrial Services'),
  ('76', 'Industrial Cleaning Services'),
  ('77', 'Environmental Services'),
  ('78', 'Transportation Services'),
  ('80', 'Management Services'),
  ('81', 'Engineering Services'),
  ('82', 'Editorial Services'),
  ('83', 'Utilities'),
  ('84', 'Financial Services'),
  ('85', 'Healthcare Services'),
  ('86', 'Education Services'),
  ('90', 'Travel Services'),
  ('91', 'Personal Services'),
  ('92', 'National Defense'),
  ('93', 'Public Administration'),
  ('94', 'Community Services'),
  ('95', 'Land and Real Estate')
ON CONFLICT (code) DO NOTHING;

-- CSI MasterFormat Divisions (top-level reference)
CREATE TABLE IF NOT EXISTS ref_csi_divisions (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT
);

-- Seed divisions
INSERT INTO ref_csi_divisions (code, name) VALUES
  ('00', 'Procurement and Contracting'),
  ('01', 'General Requirements'),
  ('02', 'Existing Conditions'),
  ('03', 'Concrete'),
  ('04', 'Masonry'),
  ('05', 'Metals'),
  ('06', 'Wood, Plastics, Composites'),
  ('07', 'Thermal and Moisture Protection'),
  ('08', 'Openings (Doors, Windows)'),
  ('09', 'Finishes'),
  ('10', 'Specialties'),
  ('11', 'Equipment'),
  ('12', 'Furnishings'),
  ('13', 'Special Construction'),
  ('14', 'Conveying Equipment'),
  ('21', 'Fire Suppression'),
  ('22', 'Plumbing'),
  ('23', 'HVAC'),
  ('25', 'Integrated Automation'),
  ('26', 'Electrical'),
  ('27', 'Communications'),
  ('28', 'Electronic Safety'),
  ('31', 'Earthwork'),
  ('32', 'Exterior Improvements'),
  ('33', 'Utilities'),
  ('34', 'Transportation'),
  ('35', 'Waterway and Marine'),
  ('40', 'Process Integration'),
  ('41', 'Material Processing'),
  ('42', 'Process Heating'),
  ('43', 'Process Gas'),
  ('44', 'Pollution Control'),
  ('45', 'Industry-Specific Manufacturing'),
  ('46', 'Water and Wastewater'),
  ('48', 'Electrical Power Generation')
ON CONFLICT (code) DO NOTHING;

-- ISO Currency Codes (common ones)
CREATE TABLE IF NOT EXISTS ref_currencies (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(5)
);

INSERT INTO ref_currencies (code, name, symbol) VALUES
  ('CAD', 'Canadian Dollar', '$'),
  ('USD', 'US Dollar', '$'),
  ('CNY', 'Chinese Yuan', '¥'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('MXN', 'Mexican Peso', '$'),
  ('JPY', 'Japanese Yen', '¥')
ON CONFLICT (code) DO NOTHING;

-- Unit of Measure codes (UN/CEFACT)
CREATE TABLE IF NOT EXISTS ref_unit_codes (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

INSERT INTO ref_unit_codes (code, name) VALUES
  ('EA', 'Each'),
  ('PR', 'Pair'),
  ('DZ', 'Dozen'),
  ('PK', 'Pack'),
  ('BX', 'Box'),
  ('CS', 'Case'),
  ('KG', 'Kilogram'),
  ('LB', 'Pound'),
  ('G', 'Gram'),
  ('OZ', 'Ounce'),
  ('L', 'Liter'),
  ('ML', 'Milliliter'),
  ('GAL', 'Gallon'),
  ('M', 'Meter'),
  ('CM', 'Centimeter'),
  ('MM', 'Millimeter'),
  ('FT', 'Foot'),
  ('IN', 'Inch'),
  ('YD', 'Yard'),
  ('M2', 'Square Meter'),
  ('FT2', 'Square Foot'),
  ('M3', 'Cubic Meter'),
  ('FT3', 'Cubic Foot'),
  ('HR', 'Hour'),
  ('DAY', 'Day'),
  ('WK', 'Week'),
  ('MON', 'Month')
ON CONFLICT (code) DO NOTHING;
```

---

## PHASE 6: UPDATE SYSTEM EVIDENCE

```sql
-- Add new tables to Evidence Ledger
INSERT INTO system_evidence (artifact_type, artifact_name, description, evidence_type, tenant_id)
VALUES 
  ('table', 'gl_accounts', 'GL account chart for accounting integration', 'required', NULL),
  ('table', 'transactions', 'Transaction header for invoices/bills/journals', 'required', NULL),
  ('table', 'transaction_lines', 'Transaction line items', 'required', NULL),
  ('table', 'ref_unspsc_segments', 'UNSPSC segment reference data', 'required', NULL),
  ('table', 'ref_csi_divisions', 'CSI MasterFormat division reference data', 'required', NULL),
  ('table', 'ref_currencies', 'ISO 4217 currency codes', 'required', NULL),
  ('table', 'ref_unit_codes', 'UN/CEFACT unit of measure codes', 'required', NULL)
ON CONFLICT DO NOTHING;
```

---

## PHASE 7: VERIFICATION

```sql
-- Verify new columns on assets
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assets' 
AND column_name IN ('unspsc_code', 'hs_code', 'manufacturer', 'model_number', 
                    'supplier_sku', 'country_of_origin', 'unit_code', 'unit_cost', 'currency')
ORDER BY column_name;

-- Verify new columns on projects
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name IN ('csi_division', 'csi_section', 'budget', 'actual_cost')
ORDER BY column_name;

-- Verify new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('gl_accounts', 'transactions', 'transaction_lines', 
                   'ref_unspsc_segments', 'ref_csi_divisions', 'ref_currencies', 'ref_unit_codes')
ORDER BY table_name;

-- Verify reference data
SELECT 'ref_unspsc_segments' as table_name, COUNT(*) as rows FROM ref_unspsc_segments
UNION ALL SELECT 'ref_csi_divisions', COUNT(*) FROM ref_csi_divisions
UNION ALL SELECT 'ref_currencies', COUNT(*) FROM ref_currencies
UNION ALL SELECT 'ref_unit_codes', COUNT(*) FROM ref_unit_codes;
```

---

## EVIDENCE REQUIRED

1. **Phase 1** - Column additions to assets (9 columns)
2. **Phase 2** - Column additions to projects/work_requests (4 columns each)
3. **Phase 3** - gl_accounts table created
4. **Phase 4** - transactions and transaction_lines tables created
5. **Phase 5** - Reference tables created and seeded
6. **Phase 6** - Evidence Ledger updated
7. **Phase 7** - All verification queries pass

---

## SUMMARY

**What This Adds:**

| Layer | Standard | New Columns/Tables |
|-------|----------|-------------------|
| Products | UNSPSC | assets.unspsc_code, assets.hs_code |
| Job Costing | CSI MasterFormat | projects.csi_division, work_requests.csi_section |
| Accounting | GL/CoA | gl_accounts table |
| Transactions | Double-entry ready | transactions, transaction_lines |
| Reference Data | Industry standards | ref_unspsc_segments, ref_csi_divisions, ref_currencies, ref_unit_codes |

**Future Integration Points:**

- QuickBooks/Xero: Export transactions with GL codes
- Customs: HS codes for import declarations
- Construction PM: CSI codes for job costing
- Procurement: UNSPSC for spend analysis
- First Nations reporting: Standard-compliant financials

This is "accounting-ready" without building accounting yet.

BEGIN.
