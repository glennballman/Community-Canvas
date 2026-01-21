/**
 * A2.6: Next Actions Engine
 * 
 * Derives structured action proposals from ingestion intelligence (A2.3).
 * Produces durable next actions that contractors can confirm, dismiss, or edit.
 * 
 * Action types:
 * - create_work_request: Propose creating a work request from sticky note
 * - attach_to_zone: Propose linking ingestion to a zone
 * - request_more_photos: AI needs additional context
 * - draft_n3_run: Propose a draft service run
 * - open_quote_draft: Link to A2.5 quote draft flow
 * - add_tool: Propose adding a detected tool
 * - add_fleet: Propose adding a detected fleet asset
 */

import { db } from '../db';
import { 
  ccAiIngestions, 
  ccIngestionNextActions, 
  ccStickyNoteExtractions,
  type AiIngestion,
  type IngestionNextAction
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface ActionProposal {
  actionType: string;
  actionPayload: Record<string, any>;
  confidence: number;
}

interface ProposedWorkRequestItem {
  text: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
}

interface StickyNoteAnalysis {
  todos: ProposedWorkRequestItem[];
  quantities: Array<{ item: string; qty: string; unit?: string }>;
  customerName?: string;
  address?: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Analyze sticky note OCR text and extract structured items
 */
function analyzeStickyNoteText(text: string): StickyNoteAnalysis {
  const lines = text.split('\n').filter(l => l.trim());
  const todos: ProposedWorkRequestItem[] = [];
  const quantities: Array<{ item: string; qty: string; unit?: string }> = [];
  let urgency: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    // Check for urgency indicators
    if (lower.includes('asap') || lower.includes('urgent') || lower.includes('emergency')) {
      urgency = 'urgent';
    } else if (lower.includes('today') || lower.includes('rush')) {
      urgency = 'high';
    }
    
    // Check for quantity patterns: "5 bags", "2x4", "10 sheets", etc.
    const qtyMatch = line.match(/(\d+)\s*(bags?|sheets?|pieces?|x\d+|boxes?|gallons?|ft|feet|meters?|m|lbs?|kg)/i);
    if (qtyMatch) {
      quantities.push({
        item: line.replace(qtyMatch[0], '').trim(),
        qty: qtyMatch[1],
        unit: qtyMatch[2]
      });
    }
    
    // Check for checkbox/bullet patterns indicating todos
    if (line.match(/^[-*•□☐✓✗]\s*/) || line.match(/^\d+\.\s*/)) {
      todos.push({ 
        text: line.replace(/^[-*•□☐✓✗\d.]+\s*/, '').trim(),
        priority: urgency === 'urgent' ? 'high' : 'medium'
      });
    } else if (line.length > 5 && !qtyMatch) {
      // Any substantive line could be a task
      todos.push({ text: line.trim(), priority: 'medium' });
    }
  }
  
  return {
    todos: todos.slice(0, 10), // Limit to 10 items
    quantities,
    urgency
  };
}

/**
 * Detect before/after photo pairs in a set of ingestions
 */
function detectPhotoBundles(ingestions: AiIngestion[]): Array<{ before: string; after: string }> {
  const bundles: Array<{ before: string; after: string }> = [];
  
  const beforePhotos = ingestions.filter(i => 
    i.classification && 
    (i.classification as any).primary === 'before_photo'
  );
  
  const afterPhotos = ingestions.filter(i => 
    i.classification && 
    (i.classification as any).primary === 'after_photo'
  );
  
  // Simple matching: pair by closest timestamp or geo
  for (const before of beforePhotos) {
    const beforeGeo = before.geoInference as any;
    
    for (const after of afterPhotos) {
      const afterGeo = after.geoInference as any;
      
      // Match if same approximate location
      if (beforeGeo?.lat && afterGeo?.lat) {
        const latDiff = Math.abs(beforeGeo.lat - afterGeo.lat);
        const lngDiff = Math.abs(beforeGeo.lng - afterGeo.lng);
        
        if (latDiff < 0.001 && lngDiff < 0.001) {
          bundles.push({ before: before.id, after: after.id });
          break;
        }
      }
    }
  }
  
  return bundles;
}

/**
 * Derive next action proposals from an ingestion
 */
export async function deriveNextActions(
  ingestion: AiIngestion
): Promise<ActionProposal[]> {
  const proposals: ActionProposal[] = [];
  const classification = ingestion.classification as any || {};
  const extractedEntities = ingestion.extractedEntities as any || {};
  const geoInference = ingestion.geoInference as any || {};
  
  const primaryType = classification.primary || ingestion.sourceType;
  const confidence = classification.confidence || 0.5;
  
  // Sticky note / whiteboard → Work Request proposal
  if (primaryType === 'sticky_note' || primaryType === 'whiteboard') {
    const ocrText = extractedEntities.ocrText || extractedEntities.rawText || '';
    
    if (ocrText) {
      const analysis = analyzeStickyNoteText(ocrText);
      
      if (analysis.todos.length > 0) {
        proposals.push({
          actionType: 'create_work_request',
          actionPayload: {
            title: analysis.todos[0]?.text || 'Work Request from Sticky Note',
            lineItems: analysis.todos,
            quantities: analysis.quantities,
            urgency: analysis.urgency,
            sourceIngestionId: ingestion.id
          },
          confidence: 75
        });
      }
    }
    
    // Also propose opening a quote draft (A2.5 integration)
    proposals.push({
      actionType: 'open_quote_draft',
      actionPayload: {
        sourceIngestionId: ingestion.id,
        sourceMode: 'worksite_upload'
      },
      confidence: 60
    });
  }
  
  // Vehicle photo → Add fleet asset
  if (primaryType === 'vehicle_truck' || primaryType === 'vehicle_van' || primaryType === 'vehicle_trailer') {
    proposals.push({
      actionType: 'add_fleet',
      actionPayload: {
        assetType: primaryType.replace('vehicle_', ''),
        licensePlateRegion: extractedEntities.licensePlateRegion?.value,
        color: extractedEntities.vehicleColor?.value,
        make: extractedEntities.vehicleMake?.value,
        sourceIngestionId: ingestion.id
      },
      confidence: Math.round(confidence * 100)
    });
  }
  
  // Tool photo → Add tool
  if (primaryType === 'tool') {
    proposals.push({
      actionType: 'add_tool',
      actionPayload: {
        name: extractedEntities.toolName?.value || 'Detected Tool',
        category: extractedEntities.toolCategory?.value,
        sourceIngestionId: ingestion.id
      },
      confidence: Math.round(confidence * 100)
    });
  }
  
  // Jobsite / before/after photo → Attach to zone + potential N3 run
  if (primaryType === 'jobsite' || primaryType === 'before_photo' || primaryType === 'after_photo') {
    // Propose zone attachment if we have geo
    if (geoInference.lat && geoInference.lng) {
      proposals.push({
        actionType: 'attach_to_zone',
        actionPayload: {
          lat: geoInference.lat,
          lng: geoInference.lng,
          proposedAddress: geoInference.proposedAddress,
          sourceIngestionId: ingestion.id
        },
        confidence: Math.round((geoInference.confidence || 0.5) * 100)
      });
    }
    
    // For after photos, propose N3 run draft (proof of work)
    if (primaryType === 'after_photo') {
      proposals.push({
        actionType: 'draft_n3_run',
        actionPayload: {
          evidenceIngestionId: ingestion.id,
          runType: 'completed_work',
          proposedAddress: geoInference.proposedAddress
        },
        confidence: 50
      });
    }
  }
  
  // Low confidence or unclear → Request more photos
  if (confidence < 0.4 || primaryType === 'unknown') {
    proposals.push({
      actionType: 'request_more_photos',
      actionPayload: {
        reason: 'Could not clearly identify this image. More photos may help.',
        sourceIngestionId: ingestion.id
      },
      confidence: 30
    });
  }
  
  return proposals;
}

/**
 * Recompute next actions for an ingestion
 * Clears existing proposed actions and creates new ones
 * 
 * IMPORTANT: "Dismiss stays dismissed" rule
 * - If an action was dismissed or expired, don't recreate it unless force=true
 * - Uses stable key (actionType + payload.key) for matching
 */
export async function recomputeNextActions(
  ingestionId: string,
  tenantId: string,
  contractorProfileId: string,
  options?: { force?: boolean }
): Promise<IngestionNextAction[]> {
  const force = options?.force ?? false;
  
  // Fetch the ingestion
  const ingestion = await db.query.ccAiIngestions.findFirst({
    where: eq(ccAiIngestions.id, ingestionId)
  });
  
  if (!ingestion) {
    throw new Error('Ingestion not found');
  }
  
  // Get existing dismissed/expired actions to avoid recreating them
  const dismissedActions = await db.query.ccIngestionNextActions.findMany({
    where: and(
      eq(ccIngestionNextActions.ingestionId, ingestionId),
      eq(ccIngestionNextActions.tenantId, tenantId)
    )
  });
  
  // Build a set of dismissed action keys (actionType + payload.key)
  const dismissedKeys = new Set<string>();
  if (!force) {
    for (const action of dismissedActions) {
      if (action.status === 'dismissed' || action.status === 'expired') {
        const payload = action.payload as any || {};
        const key = `${action.actionType}:${payload.key || 'default'}`;
        dismissedKeys.add(key);
      }
    }
  }
  
  // Clear existing proposed actions (keep confirmed/dismissed)
  await db.delete(ccIngestionNextActions)
    .where(and(
      eq(ccIngestionNextActions.ingestionId, ingestionId),
      eq(ccIngestionNextActions.status, 'proposed')
    ));
  
  // Derive new proposals
  const proposals = await deriveNextActions(ingestion);
  
  // Filter out proposals that match dismissed keys
  const filteredProposals = proposals.filter(proposal => {
    const payloadKey = proposal.actionPayload?.key || 'default';
    const key = `${proposal.actionType}:${payloadKey}`;
    
    if (dismissedKeys.has(key)) {
      console.log(`[A2.6] Skipping dismissed action: ${key}`);
      return false;
    }
    return true;
  });
  
  // Insert new actions
  const insertedActions: IngestionNextAction[] = [];
  
  for (const proposal of filteredProposals) {
    // Add stable key to payload
    const payloadWithKey = {
      ...proposal.actionPayload,
      key: proposal.actionPayload?.key || `${proposal.actionType}_${ingestionId}`
    };
    
    const [action] = await db.insert(ccIngestionNextActions).values({
      tenantId,
      contractorProfileId,
      ingestionId,
      actionType: proposal.actionType,
      payload: payloadWithKey,
      confidence: String(proposal.confidence),
      status: 'proposed'
    }).returning();
    
    insertedActions.push(action);
  }
  
  // For sticky notes, also persist extraction
  if (ingestion.sourceType === 'sticky_note' || 
      (ingestion.classification as any)?.primary === 'sticky_note') {
    const ocrText = (ingestion.extractedEntities as any)?.ocrText || '';
    
    if (ocrText) {
      const analysis = analyzeStickyNoteText(ocrText);
      
      await db.insert(ccStickyNoteExtractions).values({
        tenantId,
        contractorProfileId,
        ingestionId,
        extractedText: ocrText,
        extractedItems: {
          todos: analysis.todos,
          quantities: analysis.quantities
        },
        urgency: analysis.urgency,
        proposedWorkRequest: {
          title: analysis.todos[0]?.text,
          lineItems: analysis.todos
        }
      }).onConflictDoNothing();
    }
  }
  
  console.log(`[A2.6] Recomputed ${insertedActions.length} next actions for ingestion ${ingestionId}`);
  
  return insertedActions;
}

/**
 * Resolve a next action (confirm, dismiss, or edit)
 */
export async function resolveNextAction(
  actionId: string,
  resolution: 'confirm' | 'dismiss' | 'edit',
  payload?: Record<string, any>
): Promise<IngestionNextAction> {
  const action = await db.query.ccIngestionNextActions.findFirst({
    where: eq(ccIngestionNextActions.id, actionId)
  });
  
  if (!action) {
    throw new Error('Action not found');
  }
  
  if (action.status !== 'proposed') {
    throw new Error('Action already resolved');
  }
  
  const [updated] = await db.update(ccIngestionNextActions)
    .set({
      status: resolution === 'dismiss' ? 'dismissed' : 'confirmed',
      resolutionPayload: payload || null,
      resolvedAt: new Date()
    })
    .where(eq(ccIngestionNextActions.id, actionId))
    .returning();
  
  console.log(`[A2.6] Resolved action ${actionId} with ${resolution}`);
  
  return updated;
}

/**
 * Get pending next actions for an ingestion
 */
export async function getPendingActions(ingestionId: string): Promise<IngestionNextAction[]> {
  return db.query.ccIngestionNextActions.findMany({
    where: and(
      eq(ccIngestionNextActions.ingestionId, ingestionId),
      eq(ccIngestionNextActions.status, 'proposed')
    )
  });
}

export default {
  deriveNextActions,
  recomputeNextActions,
  resolveNextAction,
  getPendingActions,
  detectPhotoBundles
};
