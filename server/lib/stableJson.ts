/**
 * STEP 11C Phase 2C-11: Stable JSON Serializer
 * Deterministic JSON serialization for cryptographic hashing
 */

function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }

  if (typeof obj === 'object' && obj !== null) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return obj;
}

export function stableStringify(obj: unknown): string {
  const sorted = sortKeys(obj);
  return JSON.stringify(sorted);
}

export function stableStringifyPretty(obj: unknown): string {
  const sorted = sortKeys(obj);
  return JSON.stringify(sorted, null, 2);
}
