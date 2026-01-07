/**
 * Evidence Verification Service
 * 
 * Verifies that registered system artifacts actually exist and are accessible.
 * Part of the Evidence Rule Enforcement system.
 */

import { serviceQuery } from '../db/tenantDb';

export interface EvidenceResult {
  id: string;
  artifact_name: string;
  artifact_type: string;
  evidence_type: string;
  reference: string;
  status: 'verified' | 'missing' | 'error' | 'stale';
  details?: string;
  checked_at: Date;
  is_required: boolean;
}

export interface EvidenceItem {
  id: string;
  artifact_type: string;
  artifact_name: string;
  evidence_type: string;
  reference: string;
  owner_type: string | null;
  is_required: boolean;
  verification_status: string;
  last_verified_at: Date | null;
  description: string | null;
}

/**
 * Verify all registered evidence items
 */
export async function verifyAllEvidence(): Promise<EvidenceResult[]> {
  const results: EvidenceResult[] = [];
  
  // Get all evidence records
  const evidenceResult = await serviceQuery(
    `SELECT * FROM system_evidence ORDER BY is_required DESC, artifact_type, artifact_name`
  );
  
  const evidence = evidenceResult.rows as EvidenceItem[];
  
  for (const item of evidence) {
    const result = await verifyEvidence(item);
    results.push(result);
    
    // Update verification status in database
    await serviceQuery(
      `UPDATE system_evidence 
       SET verification_status = $1, last_verified_at = now(), verified_by = 'system', updated_at = now()
       WHERE id = $2`,
      [result.status, item.id]
    );
  }
  
  return results;
}

/**
 * Get all evidence items without running verification
 */
export async function getAllEvidence(): Promise<EvidenceItem[]> {
  const result = await serviceQuery(
    `SELECT 
      id,
      artifact_type,
      artifact_name,
      evidence_type,
      reference,
      owner_type,
      is_required,
      verification_status,
      last_verified_at,
      description
    FROM system_evidence
    ORDER BY is_required DESC, artifact_type, artifact_name`
  );
  
  return result.rows as EvidenceItem[];
}

/**
 * Verify a single evidence item
 */
async function verifyEvidence(item: EvidenceItem): Promise<EvidenceResult> {
  const base = {
    id: item.id,
    artifact_name: item.artifact_name,
    artifact_type: item.artifact_type,
    evidence_type: item.evidence_type,
    reference: item.reference,
    is_required: item.is_required,
    checked_at: new Date(),
  };
  
  try {
    switch (item.artifact_type) {
      case 'nav_item':
        return await verifyNavItem(item, base);
      case 'route':
        return await verifyRoute(item, base);
      case 'table':
        return await verifyTable(item, base);
      case 'integration':
        return verifyIntegration(item, base);
      default:
        return { 
          ...base,
          status: 'error', 
          details: `Unknown artifact type: ${item.artifact_type}`
        };
    }
  } catch (error: any) {
    return {
      ...base,
      status: 'error',
      details: error.message
    };
  }
}

/**
 * Verify nav item exists in navigation config by parsing layout files
 */
async function verifyNavItem(
  item: EvidenceItem, 
  base: Omit<EvidenceResult, 'status' | 'details'>
): Promise<EvidenceResult> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Determine which layout file to check based on owner_type
    const layoutFiles: string[] = [];
    if (item.owner_type === 'platform') {
      layoutFiles.push(path.join(process.cwd(), 'client/src/layouts/PlatformAdminLayout.tsx'));
    } else {
      // Check both tenant layout files
      layoutFiles.push(path.join(process.cwd(), 'client/src/layouts/TenantAppLayout.tsx'));
      layoutFiles.push(path.join(process.cwd(), 'client/src/layouts/PlatformAdminLayout.tsx'));
    }
    
    // Extract the expected href from reference (the route path)
    const expectedHref = item.reference;
    const expectedLabel = item.artifact_name;
    
    for (const layoutPath of layoutFiles) {
      if (!fs.existsSync(layoutPath)) continue;
      
      const content = fs.readFileSync(layoutPath, 'utf-8');
      
      // Check if nav item exists with matching label and href
      // Pattern: { icon: X, label: 'Label', href: '/path' }
      const hrefPattern = new RegExp(`href:\\s*['"]${expectedHref.replace(/\//g, '\\/')}['"]`);
      const labelPattern = new RegExp(`label:\\s*['"]${expectedLabel}['"]`);
      
      if (hrefPattern.test(content) && labelPattern.test(content)) {
        return {
          ...base,
          status: 'verified',
          details: `Found in ${path.basename(layoutPath)}`
        };
      }
    }
    
    // Not found in any layout
    return {
      ...base,
      status: 'missing',
      details: `Not found in nav config files`
    };
  } catch (error: any) {
    return {
      ...base,
      status: 'error',
      details: `Nav check failed: ${error.message}`
    };
  }
}

/**
 * Verify route is accessible (returns 200/304)
 */
async function verifyRoute(
  item: EvidenceItem, 
  base: Omit<EvidenceResult, 'status' | 'details'>
): Promise<EvidenceResult> {
  try {
    const port = process.env.PORT || 5000;
    const response = await fetch(`http://localhost:${port}${item.reference}`, {
      method: 'HEAD',
      headers: { 
        'X-Evidence-Check': 'true',
        'Accept': 'text/html'
      }
    });
    
    // 200, 302, 304 are all acceptable
    if (response.ok || response.status === 302 || response.status === 304) {
      return {
        ...base,
        status: 'verified',
        details: `HTTP ${response.status}`
      };
    }
    
    return {
      ...base,
      status: 'missing',
      details: `HTTP ${response.status}`
    };
  } catch (error: any) {
    return {
      ...base,
      status: 'error',
      details: `Fetch failed: ${error.message}`
    };
  }
}

/**
 * Verify database table exists
 */
async function verifyTable(
  item: EvidenceItem, 
  base: Omit<EvidenceResult, 'status' | 'details'>
): Promise<EvidenceResult> {
  try {
    const result = await serviceQuery(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      ) as exists`,
      [item.reference]
    );
    
    const exists = result.rows[0]?.exists;
    
    return {
      ...base,
      status: exists ? 'verified' : 'missing',
      details: exists ? 'Table exists' : 'Table not found'
    };
  } catch (error: any) {
    return {
      ...base,
      status: 'error',
      details: error.message
    };
  }
}

/**
 * Verify integration is configured (env var exists)
 */
function verifyIntegration(
  item: EvidenceItem, 
  base: Omit<EvidenceResult, 'status' | 'details'>
): EvidenceResult {
  const exists = !!process.env[item.reference];
  
  return {
    ...base,
    status: exists ? 'verified' : 'missing',
    details: exists ? 'Configured' : 'Not configured'
  };
}

/**
 * Get summary of evidence verification
 */
export function getEvidenceSummary(results: EvidenceResult[]) {
  const total = results.length;
  const verified = results.filter(r => r.status === 'verified').length;
  const missing = results.filter(r => r.status === 'missing').length;
  const errors = results.filter(r => r.status === 'error').length;
  const stale = results.filter(r => r.status === 'stale').length;
  
  const requiredMissing = results.filter(r => r.is_required && r.status !== 'verified');
  
  return {
    total,
    verified,
    missing,
    errors,
    stale,
    requiredMissing,
    allRequiredPassing: requiredMissing.length === 0
  };
}
