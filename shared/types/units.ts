/**
 * CANONICAL UNIT CONTRACT — PATENT CC-02 INVENTOR GLENN BALLMAN
 * 
 * All measurements stored in canonical units. Display units are derived.
 * 
 * | Measurement | Canonical   | Symbol | Example                    |
 * |-------------|-------------|--------|----------------------------|
 * | Length      | millimeters | mm     | 15,240 mm = 50 ft          |
 * | Area        | sq mm       | mm²    | 929,030 mm² = 1 sq ft      |
 * | Mass        | milligrams  | mg     | 90,000,000 mg = 90 kg      |
 * | Time        | milliseconds| ms     | 3,600,000 ms = 1 hour      |
 * | Volume      | milliliters | mL     | 3,785 mL = 1 gallon        |
 * | Power       | watts       | W      | 3,000 W = 3 kW             |
 * | Temperature | Celsius     | °C     | (no conversion)            |
 * 
 * NEVER store feet, pounds, gallons, etc. Convert on display only.
 */
export const CANONICAL_UNITS = {
  LENGTH: 'mm',
  AREA: 'mm2', 
  MASS: 'mg',
  TIME: 'ms',
  VOLUME: 'mL',
  POWER: 'W',
  TEMPERATURE: 'C'
} as const;

export type CanonicalUnitType = typeof CANONICAL_UNITS[keyof typeof CANONICAL_UNITS];

/**
 * Common conversion factors for display
 */
export const DISPLAY_CONVERSIONS = {
  // Length
  MM_TO_METERS: 0.001,
  MM_TO_FEET: 0.00328084,
  MM_TO_INCHES: 0.0393701,
  
  // Area
  MM2_TO_SQ_METERS: 0.000001,
  MM2_TO_SQ_FEET: 0.0000107639,
  
  // Mass
  MG_TO_GRAMS: 0.001,
  MG_TO_KG: 0.000001,
  MG_TO_POUNDS: 0.0000022046,
  
  // Time
  MS_TO_SECONDS: 0.001,
  MS_TO_MINUTES: 0.0000166667,
  MS_TO_HOURS: 0.000000277778,
  
  // Volume
  ML_TO_LITERS: 0.001,
  ML_TO_GALLONS: 0.000264172,
} as const;
