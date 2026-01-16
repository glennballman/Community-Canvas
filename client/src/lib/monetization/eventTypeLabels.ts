/**
 * Event Type Labels for Usage Summary UI
 * 
 * Maps raw event_type values to human-readable labels.
 * Does NOT include any pricing language.
 */

export const eventTypeLabels: Record<string, string> = {
  emergency_run_started: 'Emergency run started',
  emergency_playbook_exported: 'Emergency playbook exported',
  evidence_bundle_sealed: 'Evidence bundle sealed',
  insurance_dossier_assembled: 'Insurance dossier assembled',
  insurance_dossier_exported: 'Insurance dossier exported',
  defense_pack_assembled: 'Defense pack assembled',
  defense_pack_exported: 'Defense pack exported',
  authority_share_issued: 'Authority share issued',
  interest_group_triggered: 'Interest group activated',
  record_capture_created: 'Record capture created',
  offline_sync_batch: 'Offline sync batch',
};

/**
 * Get the human-readable label for an event type
 * Falls back to the raw event type if no label exists
 */
export function getEventTypeLabel(eventType: string): string {
  return eventTypeLabels[eventType] || eventType;
}
