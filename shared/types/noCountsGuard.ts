const FORBIDDEN_KEYS = [
  'availableCount', 'remainingCount', 'inventoryCount',
  'stallCount', 'slipCount', 'unitCount',
  'capacityTotal', 'truthCount', 'trueCount',
  'totalUnits', 'totalInventory', 'occupancyPercent',
  'capacityRemaining', 'unitsRemaining', 'realCount'
];

const COUNT_LIKE_PATTERNS = [
  /count/i,
  /^num[A-Z_]/,
  /^n[A-Z_]/,
  /quantity/i,
  /available_units/i,
  /remaining/i,
  /capacity_used/i,
  /capacity_available/i,
  /slots_left/i,
  /units_available/i,
  /spots_available/i,
  /stalls_available/i,
  /slips_available/i,
  /rooms_available/i
];

const ALLOWED_KEYS = new Set([
  'scarcityBand',
  'granularityMinutes',
  'neverExposeCounts',
  'accountId',
  'actorId',
  'activityCount'
]);

export function assertNoCountLikeKeysDeep(obj: any, path = ''): string[] {
  const violations: string[] = [];
  
  if (obj === null || obj === undefined) return violations;
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      violations.push(...assertNoCountLikeKeysDeep(item, `${path}[${index}]`));
    });
    return violations;
  }
  
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      if (!ALLOWED_KEYS.has(key)) {
        const lowerKey = key.toLowerCase();
        if (FORBIDDEN_KEYS.some(f => lowerKey.includes(f.toLowerCase()))) {
          violations.push(fullPath);
        }
        for (const pattern of COUNT_LIKE_PATTERNS) {
          if (pattern.test(key)) {
            violations.push(`Count-like key detected: ${fullPath}`);
            break;
          }
        }
      }
      
      violations.push(...assertNoCountLikeKeysDeep(obj[key], fullPath));
    }
  }
  
  return violations;
}

export function assertNoTruthFields(obj: unknown): string[] {
  const violations: string[] = [];
  const jsonStr = JSON.stringify(obj).toLowerCase();
  
  const forbiddenStrings = [
    'truthavailability',
    'truth_availability', 
    'truth_only',
    'sourcevisibility',
    'source_visibility',
    'operatornotes',
    'operator_notes'
  ];
  
  for (const forbidden of forbiddenStrings) {
    if (jsonStr.includes(forbidden)) {
      violations.push(`Truth field detected: ${forbidden}`);
    }
  }
  
  return violations;
}

export function sanitizeForPublic<T extends object>(obj: T): Omit<T, 'availableCount' | 'totalCount' | 'remainingCount'> {
  const result = { ...obj };
  
  for (const key of Object.keys(result)) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_KEYS.some(f => lowerKey.includes(f.toLowerCase()))) {
      delete (result as any)[key];
    }
  }
  
  return result;
}
