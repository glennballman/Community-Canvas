-- PROMPT-9A: Create missing scope_is_ancestor_of function
-- This function is required by cc_has_capability (migration 0165) and capabilities.ts
-- for proper scope hierarchy traversal in the authorization system.
--
-- Implementation: Recursive CTE with depth limit and cycle detection
--
-- Semantics: scope_is_ancestor_of(ancestor_scope_id, descendant_scope_id) -> boolean
-- Returns TRUE if:
--   - ancestor equals descendant (same scope), OR
--   - ancestor is in the parent chain of descendant
-- Returns FALSE if:
--   - Either input is NULL
--   - Either scope does not exist
--   - Cycle detected in parent chain
--   - Max recursion depth exceeded (50 levels)

CREATE OR REPLACE FUNCTION scope_is_ancestor_of(
    p_ancestor UUID,
    p_descendant UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Fail-closed: NULL inputs return FALSE
  SELECT CASE
    WHEN p_ancestor IS NULL OR p_descendant IS NULL THEN FALSE
    -- Quick check: same scope
    WHEN p_ancestor = p_descendant THEN TRUE
    -- Verify ancestor scope exists
    WHEN NOT EXISTS (SELECT 1 FROM cc_scopes WHERE id = p_ancestor) THEN FALSE
    -- Verify descendant scope exists  
    WHEN NOT EXISTS (SELECT 1 FROM cc_scopes WHERE id = p_descendant) THEN FALSE
    ELSE (
      -- Recursive CTE to walk up the parent chain from descendant
      WITH RECURSIVE ancestry AS (
        -- Base case: start from descendant
        SELECT 
          id,
          parent_scope_id,
          1 AS depth,
          ARRAY[id] AS visited
        FROM cc_scopes
        WHERE id = p_descendant
        
        UNION ALL
        
        -- Recursive case: walk up to parent
        SELECT 
          s.id,
          s.parent_scope_id,
          a.depth + 1,
          a.visited || s.id
        FROM cc_scopes s
        INNER JOIN ancestry a ON s.id = a.parent_scope_id
        WHERE 
          a.depth < 50                    -- Depth limit (fail-closed)
          AND NOT (s.id = ANY(a.visited)) -- Cycle detection (fail-closed)
      )
      SELECT EXISTS (
        SELECT 1 FROM ancestry 
        WHERE parent_scope_id = p_ancestor OR id = p_ancestor
      )
    )
  END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION scope_is_ancestor_of(UUID, UUID) IS 
'PROMPT-9A: Checks if p_ancestor is an ancestor of p_descendant in the scope hierarchy.
Returns TRUE if ancestor equals descendant OR ancestor is in parent chain of descendant.
Fail-closed: returns FALSE on NULL inputs, missing scopes, cycles, or max depth exceeded.';

-- ============================================================================
-- TASK C: In-migration verification assertions
-- Creates temporary scope chain, runs assertions, then cleans up
-- ============================================================================
DO $$
DECLARE
    v_platform_scope_id UUID;
    v_test_tenant_id UUID := 'ffffffff-ffff-0009-aaaa-000000000001';
    v_test_tenant_scope_id UUID;
    v_test_resource_scope_id UUID := 'ffffffff-ffff-0009-aaaa-000000000003';
BEGIN
    -- Get platform scope (must exist)
    SELECT id INTO v_platform_scope_id 
    FROM cc_scopes 
    WHERE scope_type = 'platform';
    
    IF v_platform_scope_id IS NULL THEN
        RAISE EXCEPTION 'Platform scope not found - cannot run verification';
    END IF;
    
    -- Clean up any stale test data first
    DELETE FROM cc_scopes WHERE id = v_test_resource_scope_id;
    DELETE FROM cc_scopes WHERE tenant_id = v_test_tenant_id;
    DELETE FROM cc_tenants WHERE id = v_test_tenant_id;
    
    -- Create test tenant (trigger creates tenant scope automatically)
    INSERT INTO cc_tenants (id, name, slug, tenant_type, status)
    VALUES (v_test_tenant_id, '__test_mig0167__', '__test_mig0167__', 'business', 'active');
    
    -- Get the auto-created tenant scope
    SELECT id INTO v_test_tenant_scope_id
    FROM cc_scopes
    WHERE scope_type = 'tenant' AND tenant_id = v_test_tenant_id;
    
    IF v_test_tenant_scope_id IS NULL THEN
        RAISE EXCEPTION 'ASSERTION FAILED: Tenant scope not auto-created by trigger';
    END IF;
    
    -- Create resource_type scope (child of tenant, grandchild of platform)
    INSERT INTO cc_scopes (id, scope_type, tenant_id, resource_type, parent_scope_id, scope_path)
    VALUES (v_test_resource_scope_id, 'resource_type', v_test_tenant_id, '__test_res__', 
            v_test_tenant_scope_id, 'platform/tenant:__test_mig0167__/resource_type:__test_res__');
    
    -- ========== ASSERTIONS ==========
    
    -- A1: scope_is_ancestor_of(A, A) = true (same scope)
    IF NOT scope_is_ancestor_of(v_platform_scope_id, v_platform_scope_id) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(A, A) should be TRUE';
    END IF;
    
    -- A2: NULL inputs should return FALSE
    IF scope_is_ancestor_of(NULL, v_platform_scope_id) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(NULL, X) should be FALSE';
    END IF;
    IF scope_is_ancestor_of(v_platform_scope_id, NULL) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(X, NULL) should be FALSE';
    END IF;
    
    -- A3: non-existent scope should return FALSE
    IF scope_is_ancestor_of('deadbeef-dead-beef-dead-beefdeadbeef', v_platform_scope_id) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(nonexistent, X) should be FALSE';
    END IF;
    
    -- A4: platform -> tenant = TRUE (parent-child)
    IF NOT scope_is_ancestor_of(v_platform_scope_id, v_test_tenant_scope_id) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(platform, tenant) should be TRUE';
    END IF;
    
    -- A5: platform -> resource_type = TRUE (grandparent-grandchild)
    IF NOT scope_is_ancestor_of(v_platform_scope_id, v_test_resource_scope_id) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(platform, resource_type) should be TRUE';
    END IF;
    
    -- A6: tenant -> resource_type = TRUE (parent-child)
    IF NOT scope_is_ancestor_of(v_test_tenant_scope_id, v_test_resource_scope_id) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(tenant, resource_type) should be TRUE';
    END IF;
    
    -- A7: tenant -> platform = FALSE (child cannot be ancestor of parent)
    IF scope_is_ancestor_of(v_test_tenant_scope_id, v_platform_scope_id) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(tenant, platform) should be FALSE';
    END IF;
    
    -- A8: resource_type -> platform = FALSE (grandchild cannot be ancestor of grandparent)
    IF scope_is_ancestor_of(v_test_resource_scope_id, v_platform_scope_id) THEN
        RAISE EXCEPTION 'ASSERTION FAILED: scope_is_ancestor_of(resource_type, platform) should be FALSE';
    END IF;
    
    -- ========== CLEANUP ==========
    DELETE FROM cc_scopes WHERE id = v_test_resource_scope_id;
    DELETE FROM cc_scopes WHERE tenant_id = v_test_tenant_id;
    DELETE FROM cc_tenants WHERE id = v_test_tenant_id;
    
    RAISE NOTICE 'PROMPT-9A: All 8 scope_is_ancestor_of assertions PASSED';
END;
$$;
