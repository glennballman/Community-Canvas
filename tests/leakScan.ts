export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const UUID_GLOBAL_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
export const MASKED_UUID_REGEX = /^[0-9a-f]{8}…$/i;

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function findUUIDsInString(s: string): string[] {
  if (typeof s !== 'string') return [];
  const matches = s.match(UUID_GLOBAL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

interface UUIDLocation {
  path: string;
  value: string;
}

export function deepScanForUUIDs(obj: unknown, currentPath: string = ''): UUIDLocation[] {
  const results: UUIDLocation[] = [];

  if (typeof obj === 'string') {
    const uuids = findUUIDsInString(obj);
    for (const uuid of uuids) {
      results.push({ path: currentPath || '$', value: uuid.toLowerCase() });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      results.push(...deepScanForUUIDs(item, `${currentPath}[${index}]`));
    });
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      results.push(...deepScanForUUIDs(value, nextPath));
    }
  }

  return results;
}

interface AssertNoUUIDsOptions {
  allowMasked?: boolean;
  allowedPaths?: string[];
}

export function assertNoUUIDs(
  objOrString: unknown,
  opts: AssertNoUUIDsOptions = {}
): void {
  const { allowMasked = false, allowedPaths = [] } = opts;

  let textToCheck: string;

  if (typeof objOrString === 'string') {
    textToCheck = objOrString;
  } else {
    textToCheck = JSON.stringify(objOrString);
  }

  if (allowMasked) {
    const maskedPattern = /[0-9a-f]{8}…/gi;
    textToCheck = textToCheck.replace(maskedPattern, '');
  }

  const locations = deepScanForUUIDs(
    typeof objOrString === 'string' ? objOrString : objOrString
  );

  const disallowedLocations = locations.filter(loc => {
    return !allowedPaths.some(allowed => 
      loc.path === allowed || loc.path.startsWith(allowed + '.')
    );
  });

  if (disallowedLocations.length > 0) {
    const details = disallowedLocations
      .map(loc => `  ${loc.path}: ${loc.value}`)
      .join('\n');
    throw new Error(`Found UUIDs at disallowed paths:\n${details}`);
  }
}

export function filterAllowedUUIDPaths(
  locations: UUIDLocation[],
  allowedPaths: string[]
): UUIDLocation[] {
  return locations.filter(loc => {
    return !allowedPaths.some(allowed => 
      loc.path === allowed || 
      loc.path.startsWith(allowed + '.') ||
      loc.path.startsWith(allowed + '[')
    );
  });
}

export const STRUCTURAL_UUID_PATHS = [
  'run_id',
  'id',
  'actor_individual_id',
  'run_tenant_id',
  'latest.id',
  'latest.run_id',
  'latest.actor_individual_id',
  'latest.run_tenant_id',
  'events',
];

export const PROPOSAL_CONTEXT_PATHS = [
  'latest.proposal_context.quote_draft_id',
  'latest.proposal_context.estimate_id',
  'latest.proposal_context.bid_id',
  'latest.proposal_context.trip_id',
];

export function buildAllowedPaths(): string[] {
  return [...STRUCTURAL_UUID_PATHS, ...PROPOSAL_CONTEXT_PATHS];
}
