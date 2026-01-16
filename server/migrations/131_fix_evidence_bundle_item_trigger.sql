-- Migration 131: Fix evidence bundle item trigger for DELETE operations
-- 
-- The trigger was returning NEW for all operations, but for DELETE operations,
-- NEW is NULL which silently cancels the delete. This also allows deletion
-- when the parent bundle doesn't exist (orphaned rows).

CREATE OR REPLACE FUNCTION cc_prevent_sealed_bundle_item_change()
RETURNS trigger AS $$
DECLARE
  v_status cc_evidence_bundle_status_enum;
BEGIN
  -- Get the bundle status (use OLD.bundle_id for DELETE, NEW.bundle_id otherwise)
  SELECT bundle_status INTO v_status
  FROM cc_evidence_bundles
  WHERE id = COALESCE(NEW.bundle_id, OLD.bundle_id);
  
  -- If bundle doesn't exist (NULL status), allow the operation (orphan cleanup)
  -- If bundle is not open, block the operation
  IF v_status IS NOT NULL AND v_status != 'open' THEN
    RAISE EXCEPTION 'Cannot modify items of sealed bundle';
  END IF;
  
  -- Return appropriate value based on operation type
  -- For DELETE: return OLD to allow the delete
  -- For INSERT/UPDATE: return NEW to allow the change
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
