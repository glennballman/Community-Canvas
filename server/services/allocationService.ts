/**
 * V3.3.1 Block 07: Allocation Engine
 * Conflict-free unit allocation for discrete (stalls, slips, rooms) and continuous (dock segments)
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface AllocationRequest {
  tenantId: string;
  facilityId: string;
  unitType: string; // 'stall', 'slip', 'room', 'segment'
  startAt: Date;
  endAt: Date;
  reservationItemId?: string; // If linking to existing reservation item
  
  // For continuous allocation (marina)
  requiredLengthFt?: number;
  requiredBeamFt?: number;
  requiredDraftFt?: number;
  
  // For discrete allocation (parking)
  isOversize?: boolean;
  requiresPullThrough?: boolean;
  requiresAccessible?: boolean;
  
  // Hold type
  holdType: 'soft' | 'hard';
  holdDurationMinutes?: number; // For soft holds, default 1440 (24 hours)
  
  // Preference
  preferredUnitId?: string; // If customer requests specific unit
}

export interface AllocationResult {
  success: boolean;
  allocation?: {
    id: string;
    inventoryUnitId: string;
    displayLabel: string;
    allocatedLengthFt?: number;
    positionStartFt?: number;
    holdType: 'soft' | 'hard';
    holdExpiresAt?: Date;
  };
  reason?: string; // If failed: 'no_availability', 'constraints_not_met', 'conflict'
  alternatives?: string[]; // Suggested alternative units if preferred unavailable
}

interface InventoryUnit {
  id: string;
  displayLabel: string;
  unitType: string;
  sortOrder: number;
  lengthFt: number | null;
  widthFt: number | null;
  depthFt: number | null;
  constraints: Record<string, any>; // JSONB with isOversize, isPullThrough, isAccessible, etc.
  capabilities: Record<string, any>; // JSONB with capabilities
  isActive: boolean;
  capacityTotal: number | null; // For continuous allocation (dock segments)
  capacityBuffer: number | null;
}

interface ExistingAllocation {
  inventoryUnitId: string;
  allocatedLengthFt: number | null;
  positionStartFt: number | null;
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Check if a unit has conflicting allocations in the time window
 */
export async function hasConflict(
  unitId: string,
  startAt: Date,
  endAt: Date,
  excludeAllocationId?: string
): Promise<boolean> {
  const excludeClause = excludeAllocationId 
    ? sql`AND ra.id != ${excludeAllocationId}` 
    : sql``;
  
  const result = await db.execute(sql`
    SELECT 1 
    FROM cc_reservation_allocations ra
    JOIN cc_reservation_items ri ON ra.reservation_item_id = ri.id
    JOIN cc_reservations r ON ri.reservation_id = r.id
    WHERE ra.inventory_unit_id = ${unitId}
    AND ri.status NOT IN ('cancelled', 'no_show', 'checked_out')
    AND (ra.hold_expires_at IS NULL OR ra.hold_expires_at > now())
    AND (
      (${startAt}::timestamptz, ${endAt}::timestamptz) 
      OVERLAPS (r.start_date, r.end_date)
    )
    ${excludeClause}
    LIMIT 1
  `);
  
  return result.rows.length > 0;
}

/**
 * Get units with conflicts in time window
 */
async function getConflictingUnitIds(
  unitIds: string[],
  startAt: Date,
  endAt: Date
): Promise<Set<string>> {
  if (unitIds.length === 0) return new Set();
  
  // Build array literal for SQL
  const unitIdList = unitIds.map(id => `'${id}'`).join(', ');
  
  const result = await db.execute(sql.raw(`
    SELECT DISTINCT ra.inventory_unit_id 
    FROM cc_reservation_allocations ra
    JOIN cc_reservation_items ri ON ra.reservation_item_id = ri.id
    JOIN cc_reservations r ON ri.reservation_id = r.id
    WHERE ra.inventory_unit_id IN (${unitIdList})
    AND ri.status NOT IN ('cancelled', 'no_show', 'checked_out')
    AND (ra.hold_expires_at IS NULL OR ra.hold_expires_at > now())
    AND (
      ('${startAt.toISOString()}'::timestamptz, '${endAt.toISOString()}'::timestamptz) 
      OVERLAPS (r.start_date, r.end_date)
    )
  `));
  
  return new Set(result.rows.map(r => r.inventory_unit_id as string));
}

// ============================================================================
// DISCRETE ALLOCATION (Parking, Lodging, Named Slips)
// ============================================================================

async function allocateDiscrete(req: AllocationRequest): Promise<AllocationResult> {
  // 1. Get all units of requested type in facility
  const unitsResult = await db.execute(sql`
    SELECT 
      id, display_label, unit_type, sort_order,
      length_ft, width_ft, depth_ft,
      COALESCE(constraints, '{}'::jsonb) as constraints,
      COALESCE(capabilities, '{}'::jsonb) as capabilities,
      is_active, capacity_total, capacity_buffer
    FROM cc_inventory_units
    WHERE facility_id = ${req.facilityId}
    AND unit_type = ${req.unitType}
    AND is_active = true
    ORDER BY sort_order, display_label
  `);
  
  if (unitsResult.rows.length === 0) {
    return { success: false, reason: 'no_availability' };
  }
  
  const units: InventoryUnit[] = unitsResult.rows.map(r => ({
    id: r.id as string,
    displayLabel: r.display_label as string,
    unitType: r.unit_type as string,
    sortOrder: r.sort_order as number || 0,
    lengthFt: r.length_ft as number | null,
    widthFt: r.width_ft as number | null,
    depthFt: r.depth_ft as number | null,
    constraints: r.constraints as Record<string, any> || {},
    capabilities: r.capabilities as Record<string, any> || {},
    isActive: r.is_active as boolean,
    capacityTotal: r.capacity_total as number | null,
    capacityBuffer: r.capacity_buffer as number | null,
  }));
  
  // 2. Filter by constraints (stored in JSONB)
  let filtered = units;
  if (req.isOversize) {
    filtered = filtered.filter(u => u.constraints.isOversize === true);
  }
  if (req.requiresPullThrough) {
    filtered = filtered.filter(u => u.constraints.isPullThrough === true);
  }
  if (req.requiresAccessible) {
    filtered = filtered.filter(u => u.constraints.isAccessible === true);
  }
  
  // For marina slips with length requirements
  if (req.requiredLengthFt && filtered[0]?.lengthFt !== null) {
    filtered = filtered.filter(u => u.lengthFt !== null && u.lengthFt >= req.requiredLengthFt!);
  }
  
  if (filtered.length === 0) {
    return { success: false, reason: 'constraints_not_met' };
  }
  
  // 3. Exclude units with overlapping allocations
  const conflictingIds = await getConflictingUnitIds(
    filtered.map(u => u.id),
    req.startAt,
    req.endAt
  );
  
  const available = filtered.filter(u => !conflictingIds.has(u.id));
  
  if (available.length === 0) {
    return { 
      success: false, 
      reason: 'no_availability',
      alternatives: filtered.slice(0, 3).map(u => u.displayLabel) // Suggest some that might be free other dates
    };
  }
  
  // 4. If preferredUnitId specified and available, use it
  let selectedUnit: InventoryUnit;
  if (req.preferredUnitId) {
    const preferred = available.find(u => u.id === req.preferredUnitId);
    if (preferred) {
      selectedUnit = preferred;
    } else {
      // Preferred not available, use first available but note alternatives
      selectedUnit = available[0];
    }
  } else {
    // 5. Otherwise, select first available by sort_order
    selectedUnit = available[0];
  }
  
  // 6. Create allocation record
  const holdExpiresAt = req.holdType === 'soft' 
    ? new Date(Date.now() + (req.holdDurationMinutes || 1440) * 60 * 1000)
    : null;
  
  // reservation_item_id is required - if not provided, this is a test/preview allocation
  // In production, allocations are always tied to reservation items
  if (!req.reservationItemId) {
    // Return success without persisting for availability checks/previews
    return {
      success: true,
      allocation: {
        id: 'preview-' + crypto.randomUUID(),
        inventoryUnitId: selectedUnit.id,
        displayLabel: selectedUnit.displayLabel,
        holdType: req.holdType,
        holdExpiresAt: holdExpiresAt || undefined,
      },
      alternatives: req.preferredUnitId && selectedUnit.id !== req.preferredUnitId
        ? [selectedUnit.displayLabel]
        : undefined,
    };
  }
  
  const allocationResult = await db.execute(sql`
    INSERT INTO cc_reservation_allocations (
      tenant_id, reservation_item_id, inventory_unit_id, display_label, hold_type, hold_expires_at
    ) VALUES (
      ${req.tenantId},
      ${req.reservationItemId},
      ${selectedUnit.id},
      ${selectedUnit.displayLabel},
      ${req.holdType},
      ${holdExpiresAt}
    )
    RETURNING id
  `);
  
  const allocationId = allocationResult.rows[0].id as string;
  
  // 7. Return with display_label from unit
  return {
    success: true,
    allocation: {
      id: allocationId,
      inventoryUnitId: selectedUnit.id,
      displayLabel: selectedUnit.displayLabel,
      holdType: req.holdType,
      holdExpiresAt: holdExpiresAt || undefined,
    },
    alternatives: req.preferredUnitId && selectedUnit.id !== req.preferredUnitId
      ? [selectedUnit.displayLabel]
      : undefined,
  };
}

// ============================================================================
// CONTINUOUS ALLOCATION (Dock Segments)
// ============================================================================

async function allocateContinuous(req: AllocationRequest): Promise<AllocationResult> {
  if (!req.requiredLengthFt) {
    return { success: false, reason: 'constraints_not_met' };
  }
  
  // 1. Get all segments in facility
  const segmentsResult = await db.execute(sql`
    SELECT 
      id, display_label, unit_type, sort_order,
      capacity_total, capacity_buffer
    FROM cc_inventory_units
    WHERE facility_id = ${req.facilityId}
    AND unit_type = ${req.unitType}
    AND is_active = true
    ORDER BY sort_order, display_label
  `);
  
  if (segmentsResult.rows.length === 0) {
    return { success: false, reason: 'no_availability' };
  }
  
  // 2. For each segment, get existing allocations in time window
  const segmentIds = segmentsResult.rows.map(r => r.id as string);
  
  // Build segment ID list for SQL
  const segmentIdList = segmentIds.map(id => `'${id}'`).join(', ');
  
  const allocationsResult = await db.execute(sql.raw(`
    SELECT 
      ra.inventory_unit_id,
      ra.allocated_length_ft,
      ra.position_start_ft
    FROM cc_reservation_allocations ra
    JOIN cc_reservation_items ri ON ra.reservation_item_id = ri.id
    JOIN cc_reservations r ON ri.reservation_id = r.id
    WHERE ra.inventory_unit_id IN (${segmentIdList})
    AND ri.status NOT IN ('cancelled', 'no_show', 'checked_out')
    AND (ra.hold_expires_at IS NULL OR ra.hold_expires_at > now())
    AND (
      ('${req.startAt.toISOString()}'::timestamptz, '${req.endAt.toISOString()}'::timestamptz) 
      OVERLAPS (r.start_date, r.end_date)
    )
    ORDER BY ra.inventory_unit_id, ra.position_start_ft
  `));
  
  // Group allocations by segment
  const allocationsBySegment = new Map<string, ExistingAllocation[]>();
  for (const row of allocationsResult.rows) {
    const segmentId = row.inventory_unit_id as string;
    if (!allocationsBySegment.has(segmentId)) {
      allocationsBySegment.set(segmentId, []);
    }
    allocationsBySegment.get(segmentId)!.push({
      inventoryUnitId: segmentId,
      allocatedLengthFt: row.allocated_length_ft as number | null,
      positionStartFt: row.position_start_ft as number | null,
    });
  }
  
  // 3. Find segment with enough remaining capacity
  for (const segment of segmentsResult.rows) {
    const segmentId = segment.id as string;
    const segmentCapacity = segment.capacity_total as number;
    const buffer = (segment.capacity_buffer as number) || 2; // Default 2ft buffer between boats
    const displayLabel = segment.display_label as string;
    const requiredSpace = req.requiredLengthFt + buffer;
    
    if (!segmentCapacity || segmentCapacity < requiredSpace) continue;
    
    const existingAllocations = allocationsBySegment.get(segmentId) || [];
    
    // Calculate used positions
    const usedPositions = existingAllocations
      .filter(a => a.positionStartFt !== null && a.allocatedLengthFt !== null)
      .map(a => ({
        start: a.positionStartFt!,
        length: a.allocatedLengthFt! + buffer,
      }))
      .sort((a, b) => a.start - b.start);
    
    // Find first-fit position
    const position = findFirstFitPosition(segmentCapacity, usedPositions, requiredSpace);
    
    if (position !== null) {
      // Found a spot! Create allocation
      const holdExpiresAt = req.holdType === 'soft' 
        ? new Date(Date.now() + (req.holdDurationMinutes || 1440) * 60 * 1000)
        : null;
      
      const fullDisplayLabel = `${displayLabel} (${req.requiredLengthFt}ft @ ${position}ft)`;
      
      // reservation_item_id is required - if not provided, return preview without persisting
      if (!req.reservationItemId) {
        return {
          success: true,
          allocation: {
            id: 'preview-' + crypto.randomUUID(),
            inventoryUnitId: segmentId,
            displayLabel: fullDisplayLabel,
            allocatedLengthFt: req.requiredLengthFt,
            positionStartFt: position,
            holdType: req.holdType,
            holdExpiresAt: holdExpiresAt || undefined,
          },
        };
      }
      
      const allocationResult = await db.execute(sql`
        INSERT INTO cc_reservation_allocations (
          tenant_id, reservation_item_id, inventory_unit_id, display_label,
          allocated_length_ft, position_start_ft,
          hold_type, hold_expires_at
        ) VALUES (
          ${req.tenantId},
          ${req.reservationItemId},
          ${segmentId},
          ${fullDisplayLabel},
          ${req.requiredLengthFt},
          ${position},
          ${req.holdType},
          ${holdExpiresAt}
        )
        RETURNING id
      `);
      
      const allocationId = allocationResult.rows[0].id as string;
      
      return {
        success: true,
        allocation: {
          id: allocationId,
          inventoryUnitId: segmentId,
          displayLabel: fullDisplayLabel,
          allocatedLengthFt: req.requiredLengthFt,
          positionStartFt: position,
          holdType: req.holdType,
          holdExpiresAt: holdExpiresAt || undefined,
        },
      };
    }
  }
  
  // No segment had enough space
  return { success: false, reason: 'no_availability' };
}

/**
 * First-fit algorithm to find position in segment
 */
function findFirstFitPosition(
  segmentLength: number, 
  usedPositions: { start: number; length: number }[], 
  requiredSpace: number
): number | null {
  // Check if boat fits at the start (position 0)
  if (usedPositions.length === 0) {
    if (requiredSpace <= segmentLength) {
      return 0;
    }
    return null;
  }
  
  // Check gap before first allocation
  if (usedPositions[0].start >= requiredSpace) {
    return 0;
  }
  
  // Check gaps between allocations
  for (let i = 0; i < usedPositions.length - 1; i++) {
    const gapStart = usedPositions[i].start + usedPositions[i].length;
    const gapEnd = usedPositions[i + 1].start;
    const gapSize = gapEnd - gapStart;
    
    if (gapSize >= requiredSpace) {
      return gapStart;
    }
  }
  
  // Check gap after last allocation
  const lastEnd = usedPositions[usedPositions.length - 1].start + 
                  usedPositions[usedPositions.length - 1].length;
  if (segmentLength - lastEnd >= requiredSpace) {
    return lastEnd;
  }
  
  return null;
}

// ============================================================================
// CORE ALLOCATION FUNCTION
// ============================================================================

/**
 * Allocate a unit (discrete or continuous based on facility type)
 */
export async function allocateUnit(req: AllocationRequest): Promise<AllocationResult> {
  // Determine allocation mode from facility
  const facilityResult = await db.execute(sql`
    SELECT allocation_mode FROM cc_facilities WHERE id = ${req.facilityId}
  `);
  
  if (facilityResult.rows.length === 0) {
    return { success: false, reason: 'no_availability' };
  }
  
  const allocationMode = facilityResult.rows[0].allocation_mode as string;
  
  if (allocationMode === 'continuous') {
    return allocateContinuous(req);
  } else {
    return allocateDiscrete(req);
  }
}

// ============================================================================
// AVAILABILITY CHECK (without allocating)
// ============================================================================

export async function checkAvailability(
  facilityId: string,
  unitType: string,
  startAt: Date,
  endAt: Date,
  constraints?: {
    isOversize?: boolean;
    requiresPullThrough?: boolean;
    requiresAccessible?: boolean;
    requiredLengthFt?: number;
  }
): Promise<{ available: boolean; availableCount: number; totalCount: number }> {
  // Get all units with JSONB constraints
  const unitsResult = await db.execute(sql`
    SELECT id, COALESCE(constraints, '{}'::jsonb) as constraints, length_ft
    FROM cc_inventory_units
    WHERE facility_id = ${facilityId}
    AND unit_type = ${unitType}
    AND is_active = true
  `);
  
  let units = unitsResult.rows;
  
  // Apply constraints (stored in JSONB)
  if (constraints?.isOversize) {
    units = units.filter(u => (u.constraints as any)?.isOversize === true);
  }
  if (constraints?.requiresPullThrough) {
    units = units.filter(u => (u.constraints as any)?.isPullThrough === true);
  }
  if (constraints?.requiresAccessible) {
    units = units.filter(u => (u.constraints as any)?.isAccessible === true);
  }
  if (constraints?.requiredLengthFt) {
    units = units.filter(u => u.length_ft && (u.length_ft as number) >= constraints.requiredLengthFt!);
  }
  
  const totalCount = units.length;
  
  if (totalCount === 0) {
    return { available: false, availableCount: 0, totalCount: 0 };
  }
  
  // Get conflicting units
  const conflictingIds = await getConflictingUnitIds(
    units.map(u => u.id as string),
    startAt,
    endAt
  );
  
  const availableCount = units.filter(u => !conflictingIds.has(u.id as string)).length;
  
  return {
    available: availableCount > 0,
    availableCount,
    totalCount,
  };
}

// ============================================================================
// RELEASE ALLOCATION
// ============================================================================

export async function releaseAllocation(allocationId: string): Promise<void> {
  await db.execute(sql`
    DELETE FROM cc_reservation_allocations WHERE id = ${allocationId}
  `);
}

// ============================================================================
// OVERRIDE ALLOCATION (Dockmaster reassigns)
// ============================================================================

export async function overrideAllocation(
  allocationId: string,
  newUnitId: string,
  reason: string,
  actorId: string
): Promise<AllocationResult> {
  // 1. Get current allocation details
  const currentResult = await db.execute(sql`
    SELECT 
      ra.id, ra.inventory_unit_id, ra.reservation_item_id,
      ra.allocated_length_ft, ra.position_start_ft, ra.hold_type, ra.hold_expires_at,
      u.display_label as old_label,
      ri.id as item_id,
      r.id as reservation_id, r.start_date, r.end_date, r.provider_id
    FROM cc_reservation_allocations ra
    JOIN cc_inventory_units u ON ra.inventory_unit_id = u.id
    JOIN cc_reservation_items ri ON ra.reservation_item_id = ri.id
    JOIN cc_reservations r ON ri.reservation_id = r.id
    WHERE ra.id = ${allocationId}
  `);
  
  if (currentResult.rows.length === 0) {
    return { success: false, reason: 'no_availability' };
  }
  
  const current = currentResult.rows[0];
  const startAt = current.start_date as Date;
  const endAt = current.end_date as Date;
  
  // 2. Verify new unit is available
  const conflict = await hasConflict(newUnitId, startAt, endAt, allocationId);
  if (conflict) {
    return { success: false, reason: 'conflict' };
  }
  
  // 3. Get new unit details
  const newUnitResult = await db.execute(sql`
    SELECT id, display_label FROM cc_inventory_units WHERE id = ${newUnitId}
  `);
  
  if (newUnitResult.rows.length === 0) {
    return { success: false, reason: 'no_availability' };
  }
  
  const newUnit = newUnitResult.rows[0];
  
  // 4. Update allocation to new unit
  await db.execute(sql`
    UPDATE cc_reservation_allocations 
    SET inventory_unit_id = ${newUnitId}
    WHERE id = ${allocationId}
  `);
  
  // 5. Log to activity_ledger with before/after
  await db.execute(sql`
    INSERT INTO cc_activity_ledger (
      tenant_id, action, entity_type, entity_id, actor_identity_id, payload
    ) VALUES (
      ${current.provider_id},
      'allocation.override',
      'reservation_allocation',
      ${allocationId},
      ${actorId},
      ${JSON.stringify({
        reason,
        before: {
          unitId: current.inventory_unit_id,
          label: current.old_label,
        },
        after: {
          unitId: newUnitId,
          label: newUnit.display_label,
        },
      })}
    )
  `);
  
  // 6. Return new assignment
  return {
    success: true,
    allocation: {
      id: allocationId,
      inventoryUnitId: newUnitId,
      displayLabel: newUnit.display_label as string,
      allocatedLengthFt: current.allocated_length_ft as number | undefined,
      positionStartFt: current.position_start_ft as number | undefined,
      holdType: current.hold_type as 'soft' | 'hard',
      holdExpiresAt: current.hold_expires_at as Date | undefined,
    },
  };
}

// ============================================================================
// TEST FUNCTION
// ============================================================================

export async function testAllocationEngine(): Promise<{
  success: boolean;
  tests: { name: string; passed: boolean; details: string }[];
}> {
  const tests: { name: string; passed: boolean; details: string }[] = [];
  
  try {
    // Get a facility for testing
    const facilityResult = await db.execute(sql`
      SELECT f.id, f.name, f.allocation_mode, f.tenant_id
      FROM cc_facilities f
      WHERE f.is_active = true
      LIMIT 1
    `);
    
    if (facilityResult.rows.length === 0) {
      return { success: false, tests: [{ name: 'setup', passed: false, details: 'No facilities found' }] };
    }
    
    const facility = facilityResult.rows[0];
    
    // Get a unit from the facility
    const unitResult = await db.execute(sql`
      SELECT id, unit_type, display_label FROM cc_inventory_units
      WHERE facility_id = ${facility.id} AND is_active = true
      LIMIT 1
    `);
    
    if (unitResult.rows.length === 0) {
      return { success: false, tests: [{ name: 'setup', passed: false, details: 'No units found' }] };
    }
    
    const unit = unitResult.rows[0];
    
    // Test 1: Check availability
    const startDate = new Date('2025-07-15');
    const endDate = new Date('2025-07-16');
    
    const availability = await checkAvailability(
      facility.id as string,
      unit.unit_type as string,
      startDate,
      endDate
    );
    
    tests.push({
      name: 'Check availability',
      passed: availability.totalCount > 0,
      details: `${availability.availableCount}/${availability.totalCount} available`,
    });
    
    // Test 2: Conflict detection on non-existent conflicts
    const noConflict = await hasConflict(unit.id as string, startDate, endDate);
    tests.push({
      name: 'No false conflicts',
      passed: !noConflict, // Should be no conflict for future dates
      details: noConflict ? 'Unexpected conflict found' : 'No conflicts as expected',
    });
    
    return {
      success: tests.every(t => t.passed),
      tests,
    };
  } catch (error) {
    return {
      success: false,
      tests: [{ name: 'error', passed: false, details: String(error) }],
    };
  }
}
