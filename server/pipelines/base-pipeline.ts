import { pool } from "../db";

export interface PipelineResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: string[];
  timestamp: Date;
}

export abstract class BasePipeline {
  protected dataSourceId: string;
  protected name: string;
  protected rateLimit: number;
  protected runId: number | null = null;

  constructor(dataSourceId: string, name: string, rateLimit: number = 60000) {
    this.dataSourceId = dataSourceId;
    this.name = name;
    this.rateLimit = rateLimit;
  }

  abstract fetch(): Promise<any>;
  abstract transform(rawData: any): any[];
  abstract load(transformedData: any[]): Promise<{ created: number; updated: number }>;

  protected async startRun(): Promise<number> {
    const result = await pool.query(
      `INSERT INTO pipeline_runs (data_source_id, status) VALUES ($1, 'running') RETURNING id`,
      [this.dataSourceId]
    );
    return result.rows[0].id;
  }

  protected async completeRun(runId: number, result: PipelineResult): Promise<void> {
    await pool.query(
      `UPDATE pipeline_runs SET 
        completed_at = NOW(),
        status = $2,
        records_processed = $3,
        records_created = $4,
        records_updated = $5,
        error_message = $6
      WHERE id = $1`,
      [
        runId,
        result.success ? 'completed' : 'failed',
        result.recordsProcessed,
        result.recordsCreated,
        result.recordsUpdated,
        result.errors.length > 0 ? result.errors.join('; ') : null
      ]
    );
  }

  protected async saveSnapshot(
    entityId: number,
    status: string,
    rawData: any,
    metrics?: any,
    alerts?: any
  ): Promise<void> {
    await pool.query(
      `INSERT INTO entity_snapshots (entity_id, data_source_id, status, raw_data, metrics, alerts)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entityId, this.dataSourceId, status, rawData, metrics || null, alerts || null]
    );
  }

  async run(): Promise<PipelineResult> {
    const startTime = new Date();
    const errors: string[] = [];
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;

    try {
      this.runId = await this.startRun();
      console.log(`[${this.name}] Pipeline run #${this.runId} started`);

      const rawData = await this.fetch();
      console.log(`[${this.name}] Data fetched`);

      const transformed = this.transform(rawData);
      recordsProcessed = transformed.length;
      console.log(`[${this.name}] ${recordsProcessed} records transformed`);

      const loadResult = await this.load(transformed);
      recordsCreated = loadResult.created;
      recordsUpdated = loadResult.updated;
      console.log(`[${this.name}] Created: ${recordsCreated}, Updated: ${recordsUpdated}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      console.error(`[${this.name}] Error:`, errorMsg);
    }

    const result: PipelineResult = {
      success: errors.length === 0,
      recordsProcessed,
      recordsCreated,
      recordsUpdated,
      errors,
      timestamp: startTime
    };

    if (this.runId) {
      await this.completeRun(this.runId, result);
    }

    return result;
  }
}
