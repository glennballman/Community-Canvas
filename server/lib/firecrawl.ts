import type FirecrawlAppType from '@mendable/firecrawl-js';

let FirecrawlApp: typeof FirecrawlAppType | null = null;

export async function getFirecrawlApp(apiKey: string): Promise<FirecrawlAppType> {
  if (!FirecrawlApp) {
    const module = await import('@mendable/firecrawl-js');
    FirecrawlApp = (module.default || module) as typeof FirecrawlAppType;
  }
  return new FirecrawlApp({ apiKey });
}

export type { FirecrawlAppType };
