import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

describe('Proposal Context DB Constraint', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('is_valid_proposal_context function exists', async () => {
    const result = await pool.query(`
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
        AND p.proname = 'is_valid_proposal_context'
    `);
    expect(result.rows.length).toBe(1);
  });

  it('chk_proposal_context_shape constraint exists on cc_service_run_schedule_proposals', async () => {
    const result = await pool.query(`
      SELECT con.conname, con.convalidated
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'cc_service_run_schedule_proposals'
        AND con.conname = 'chk_proposal_context_shape'
    `);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].conname).toBe('chk_proposal_context_shape');
    expect(result.rows[0].convalidated).toBe(true);
  });

  it('constraint function rejects invalid keys', async () => {
    const result = await pool.query(`
      SELECT is_valid_proposal_context('{"proposal_context": {"invalid_key": "test"}}'::jsonb) as valid
    `);
    expect(result.rows[0].valid).toBe(false);
  });

  it('constraint function rejects invalid UUIDs', async () => {
    const result = await pool.query(`
      SELECT is_valid_proposal_context('{"proposal_context": {"quote_draft_id": "not-a-uuid"}}'::jsonb) as valid
    `);
    expect(result.rows[0].valid).toBe(false);
  });

  it('constraint function accepts valid proposal_context', async () => {
    const result = await pool.query(`
      SELECT is_valid_proposal_context('{"proposal_context": {"quote_draft_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}}'::jsonb) as valid
    `);
    expect(result.rows[0].valid).toBe(true);
  });

  it('constraint function accepts empty metadata', async () => {
    const result = await pool.query(`
      SELECT is_valid_proposal_context('{}'::jsonb) as valid
    `);
    expect(result.rows[0].valid).toBe(true);
  });

  it('constraint function rejects oversized selected_scope_option', async () => {
    const longScope = 'a'.repeat(40);
    const result = await pool.query(`
      SELECT is_valid_proposal_context($1::jsonb) as valid
    `, [JSON.stringify({ proposal_context: { selected_scope_option: longScope } })]);
    expect(result.rows[0].valid).toBe(false);
  });

  it('constraint function accepts valid selected_scope_option', async () => {
    const result = await pool.query(`
      SELECT is_valid_proposal_context('{"proposal_context": {"selected_scope_option": "hybrid"}}'::jsonb) as valid
    `);
    expect(result.rows[0].valid).toBe(true);
  });
});
