import { BasePipeline, PipelineResult } from "./base-pipeline";
import { DriveBCPipeline } from "./drivebc";
import { BCFerriesPipeline } from "./bcferries";
import { WeatherPipeline } from "./weather";
import { BCHydroPipeline } from "./bchydro";
import { EarthquakesPipeline } from "./earthquakes";
import { pool } from "../db";

export interface PipelineConfig {
  id: string;
  name: string;
  pipeline: BasePipeline;
  intervalMinutes: number;
  enabled: boolean;
  requiresFirecrawl: boolean;
}

// Pipeline registry - pipelines requiring Firecrawl check for API key before enabling
const firecrawlAvailable = !!process.env.FIRECRAWL_API_KEY;

export const pipelines: PipelineConfig[] = [
  {
    id: 'drivebc',
    name: 'DriveBC Road Events',
    pipeline: new DriveBCPipeline(),
    intervalMinutes: 5,
    enabled: true,
    requiresFirecrawl: false
  },
  {
    id: 'bcferries',
    name: 'BC Ferries Conditions',
    pipeline: new BCFerriesPipeline(),
    intervalMinutes: 10,
    enabled: firecrawlAvailable,
    requiresFirecrawl: true
  },
  {
    id: 'weather',
    name: 'Environment Canada Weather',
    pipeline: new WeatherPipeline(),
    intervalMinutes: 30,
    enabled: true,
    requiresFirecrawl: false
  },
  {
    id: 'bchydro',
    name: 'BC Hydro Outages',
    pipeline: new BCHydroPipeline(),
    intervalMinutes: 15,
    enabled: firecrawlAvailable,
    requiresFirecrawl: true
  },
  {
    id: 'earthquakes',
    name: 'Earthquakes Canada',
    pipeline: new EarthquakesPipeline(),
    intervalMinutes: 10,
    enabled: true,
    requiresFirecrawl: false
  }
];

// Active intervals
const activeIntervals: Map<string, NodeJS.Timeout> = new Map();

async function runPipelineWithLogging(config: PipelineConfig): Promise<PipelineResult | null> {
  const startTime = new Date();
  console.log(`[${config.id}] Starting pipeline run at ${startTime.toISOString()}`);
  
  try {
    const result = await config.pipeline.run();
    
    // Log to pipeline_runs table
    await pool.query(`
      INSERT INTO pipeline_runs (data_source_id, started_at, completed_at, status, records_processed, records_created, records_updated)
      VALUES ($1, $2, NOW(), 'completed', $3, $4, $5)
    `, [config.id, startTime, result.recordsProcessed, result.recordsCreated, result.recordsUpdated]);
    
    console.log(`[${config.id}] Completed: ${result.recordsProcessed} processed, ${result.recordsCreated} created, ${result.recordsUpdated} updated`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${config.id}] Failed:`, errorMessage);
    
    await pool.query(`
      INSERT INTO pipeline_runs (data_source_id, started_at, completed_at, status, error_message)
      VALUES ($1, $2, NOW(), 'failed', $3)
    `, [config.id, startTime, errorMessage]);
    
    return null;
  }
}

export async function runPipeline(pipelineId: string): Promise<PipelineResult | null> {
  const config = pipelines.find(p => p.id === pipelineId);
  if (!config) {
    console.error(`Pipeline not found: ${pipelineId}`);
    return null;
  }
  
  if (config.requiresFirecrawl && !firecrawlAvailable) {
    console.error(`Pipeline ${pipelineId} requires Firecrawl API key`);
    return null;
  }
  
  return await runPipelineWithLogging(config);
}

export async function runAllPipelines(): Promise<Map<string, PipelineResult | null>> {
  const results = new Map<string, PipelineResult | null>();
  
  for (const config of pipelines) {
    if (config.enabled) {
      console.log(`Running pipeline: ${config.name}`);
      const result = await runPipelineWithLogging(config);
      results.set(config.id, result);
    }
  }
  
  return results;
}

export function startPipelineScheduler(): void {
  console.log('Starting pipeline scheduler...');
  
  if (!firecrawlAvailable) {
    console.log('Note: FIRECRAWL_API_KEY not set - Firecrawl-dependent pipelines disabled');
  }
  
  for (const config of pipelines) {
    if (!config.enabled) {
      console.log(`Skipping disabled pipeline: ${config.name}`);
      continue;
    }
    
    console.log(`Scheduling ${config.name} every ${config.intervalMinutes} minutes`);
    
    // Run immediately on startup (with delay to avoid overwhelming on boot)
    setTimeout(() => {
      runPipelineWithLogging(config).catch(err => {
        console.error(`Initial run failed for ${config.name}:`, err);
      });
    }, 5000 + pipelines.indexOf(config) * 2000); // Stagger initial runs
    
    // Schedule recurring runs
    const interval = setInterval(() => {
      runPipelineWithLogging(config).catch(err => {
        console.error(`Scheduled run failed for ${config.name}:`, err);
      });
    }, config.intervalMinutes * 60 * 1000);
    
    activeIntervals.set(config.id, interval);
  }
  
  console.log(`Pipeline scheduler started with ${pipelines.filter(p => p.enabled).length} active pipelines`);
}

export function stopPipelineScheduler(): void {
  console.log('Stopping pipeline scheduler...');
  
  for (const [id, interval] of activeIntervals) {
    clearInterval(interval);
    console.log(`Stopped: ${id}`);
  }
  
  activeIntervals.clear();
}

export function getPipelineStatus(): Array<{
  id: string;
  name: string;
  enabled: boolean;
  intervalMinutes: number;
  running: boolean;
  requiresFirecrawl: boolean;
}> {
  return pipelines.map(p => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled,
    intervalMinutes: p.intervalMinutes,
    running: activeIntervals.has(p.id),
    requiresFirecrawl: p.requiresFirecrawl
  }));
}

// Re-export types
export { PipelineResult } from "./base-pipeline";
