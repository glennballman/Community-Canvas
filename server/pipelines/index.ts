import { BasePipeline, PipelineResult } from "./base-pipeline";
import { DriveBCPipeline } from "./drivebc";
import { BCFerriesPipeline } from "./bcferries";
import { WeatherPipeline } from "./weather";
import { BCHydroPipeline } from "./bchydro";
import { EarthquakesPipeline } from "./earthquakes";

export interface PipelineConfig {
  id: string;
  name: string;
  pipeline: BasePipeline;
  interval: number; // ms
  enabled: boolean;
}

// Pipeline registry
export const pipelines: PipelineConfig[] = [
  {
    id: 'drivebc',
    name: 'DriveBC Road Events',
    pipeline: new DriveBCPipeline(),
    interval: 5 * 60 * 1000, // 5 minutes
    enabled: true
  },
  {
    id: 'bcferries',
    name: 'BC Ferries Conditions',
    pipeline: new BCFerriesPipeline(),
    interval: 10 * 60 * 1000, // 10 minutes
    enabled: true
  },
  {
    id: 'weather',
    name: 'Environment Canada Weather',
    pipeline: new WeatherPipeline(),
    interval: 10 * 60 * 1000, // 10 minutes
    enabled: true
  },
  {
    id: 'bchydro',
    name: 'BC Hydro Outages',
    pipeline: new BCHydroPipeline(),
    interval: 5 * 60 * 1000,
    enabled: true
  },
  {
    id: 'earthquakes',
    name: 'Earthquakes Canada',
    pipeline: new EarthquakesPipeline(),
    interval: 10 * 60 * 1000,
    enabled: true
  }
];

// Active intervals
const activeIntervals: Map<string, NodeJS.Timeout> = new Map();

export async function runPipeline(pipelineId: string): Promise<PipelineResult | null> {
  const config = pipelines.find(p => p.id === pipelineId);
  if (!config) {
    console.error(`Pipeline not found: ${pipelineId}`);
    return null;
  }
  
  return await config.pipeline.run();
}

export async function runAllPipelines(): Promise<Map<string, PipelineResult>> {
  const results = new Map<string, PipelineResult>();
  
  for (const config of pipelines) {
    if (config.enabled) {
      console.log(`Running pipeline: ${config.name}`);
      const result = await config.pipeline.run();
      results.set(config.id, result);
    }
  }
  
  return results;
}

export function startScheduler(): void {
  console.log('Starting pipeline scheduler...');
  
  for (const config of pipelines) {
    if (config.enabled) {
      console.log(`Scheduling ${config.name} every ${config.interval / 1000}s`);
      
      // Run immediately
      config.pipeline.run().catch(err => {
        console.error(`Initial run failed for ${config.name}:`, err);
      });
      
      // Schedule recurring runs
      const interval = setInterval(() => {
        config.pipeline.run().catch(err => {
          console.error(`Scheduled run failed for ${config.name}:`, err);
        });
      }, config.interval);
      
      activeIntervals.set(config.id, interval);
    }
  }
}

export function stopScheduler(): void {
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
  interval: number;
  running: boolean;
}> {
  return pipelines.map(p => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled,
    interval: p.interval,
    running: activeIntervals.has(p.id)
  }));
}

// Re-export types
export { PipelineResult } from "./base-pipeline";
