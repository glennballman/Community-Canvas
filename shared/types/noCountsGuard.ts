const FORBIDDEN_KEYS = [
  'availableCount', 'remainingCount', 'inventoryCount',
  'stallCount', 'slipCount', 'unitCount',
  'capacityTotal', 'truthCount', 'trueCount',
  'totalUnits', 'totalInventory', 'occupancyPercent',
  'capacityRemaining', 'unitsRemaining', 'realCount'
];

export function assertNoCountLikeKeysDeep(obj: any, path = ''): string[] {
  const violations: string[] = [];
  
  if (obj === null || obj === undefined) return violations;
  
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_KEYS.some(f => lowerKey.includes(f.toLowerCase()))) {
        violations.push(fullPath);
      }
      
      violations.push(...assertNoCountLikeKeysDeep(obj[key], fullPath));
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
