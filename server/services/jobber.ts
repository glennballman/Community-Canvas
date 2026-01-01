const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';

interface JobberConfig {
  accessToken: string;
}

interface JobberOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
}

export function getJobberAuthUrl(config: JobberOAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
  });
  return `${JOBBER_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  config: JobberOAuthConfig
): Promise<TokenResponse> {
  const response = await fetch(JOBBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  config: Omit<JobberOAuthConfig, 'redirectUri'>
): Promise<TokenResponse> {
  const response = await fetch(JOBBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}

interface JobberJob {
  id: string;
  jobNumber: string;
  title: string;
  instructions: string;
  jobberWebUri: string;
  client: {
    id: string;
    name: string;
    companyName?: string;
    phones?: { number: string }[];
  };
  property?: {
    address: {
      street: string;
      city: string;
      province: string;
      postalCode: string;
    };
  };
  visits?: {
    nodes: {
      id: string;
      title: string;
      startAt: string;
      endAt: string;
      completedAt?: string;
      assignedUsers?: {
        nodes: { name: string }[];
      };
    }[];
  };
  quote?: {
    id: string;
    amounts: {
      total: number;
    };
  };
}

// Global rate limiter for Jobber API - prevents concurrent requests
let lastJobberRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests
let requestQueue: Promise<void> = Promise.resolve();

async function acquireJobberRateLimitSlot(): Promise<void> {
  // Queue requests to ensure they run sequentially
  const previousRequest = requestQueue;
  let resolveSlot: () => void;
  requestQueue = new Promise<void>(resolve => { resolveSlot = resolve; });
  
  await previousRequest;
  
  const now = Date.now();
  const timeSinceLastRequest = now - lastJobberRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`[Jobber] Rate limiting: waiting ${waitTime}ms before request`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastJobberRequestTime = Date.now();
  resolveSlot!();
}

export class JobberService {
  private accessToken: string;

  constructor(config: JobberConfig) {
    this.accessToken = config.accessToken;
  }

  private async graphqlRequest<T>(query: string, variables: Record<string, unknown> = {}, retries = 5): Promise<T> {
    // Acquire rate limit slot before making request
    await acquireJobberRateLimitSlot();
    
    const response = await fetch(JOBBER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Jobber API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors) {
      const isThrottled = result.errors.some((e: { extensions?: { code?: string } }) => 
        e.extensions?.code === 'THROTTLED'
      );
      
      if (isThrottled && retries > 0) {
        // Exponential backoff starting at 15 seconds, then 30s, 60s, 120s, 240s
        const waitTime = 15000 * Math.pow(2, 5 - retries);
        console.log(`[Jobber] API throttled, attempt ${6 - retries}/5, waiting ${waitTime / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.graphqlRequest<T>(query, variables, retries - 1);
      }
      
      throw new Error(`Jobber GraphQL error: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  async getJob(jobId: string): Promise<JobberJob | null> {
    const query = `
      query GetJob($id: EncodedId!) {
        job(id: $id) {
          id
          jobNumber
          title
          instructions
          jobberWebUri
          client {
            id
            name
            companyName
            phones {
              number
            }
          }
          property {
            address {
              street
              city
              province
              postalCode
            }
          }
          visits {
            nodes {
              id
              title
              startAt
              endAt
              completedAt
              assignedUsers {
                nodes {
                  name
                }
              }
            }
          }
          quote {
            id
            amounts {
              total
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ job: JobberJob | null }>(query, { id: jobId });
    return response.job;
  }

  async getJobsForDateRange(startDate: string, endDate: string): Promise<JobberJob[]> {
    const query = `
      query GetJobs {
        jobs(first: 50) {
          nodes {
            id
            jobNumber
            title
            jobberWebUri
            client {
              id
              name
              companyName
            }
            visits {
              nodes {
                startAt
                endAt
              }
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ jobs: { nodes: JobberJob[] } }>(query);
    
    // Client-side filter by date if visits exist
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return response.jobs.nodes.filter(job => {
      if (!job.visits?.nodes?.length) return true;
      return job.visits.nodes.some(visit => {
        const visitDate = new Date(visit.startAt);
        return visitDate >= start && visitDate <= end;
      });
    });
  }

  async testConnection(): Promise<{ name: string; email: string } | null> {
    const query = `
      query TestConnection {
        account {
          name
        }
      }
    `;

    try {
      const response = await this.graphqlRequest<{ account: { name: string } }>(query);
      return { name: response.account.name, email: '' };
    } catch (error) {
      throw error;
    }
  }

  async getJobByNumber(jobNumber: string): Promise<JobberJob | null> {
    // Check if this looks like a base64-encoded ID (Jobber uses base64 for IDs)
    const isEncodedId = /^[A-Za-z0-9+/=]+$/.test(jobNumber) && jobNumber.length > 8;
    
    if (isEncodedId) {
      // Try to fetch directly by ID first
      try {
        return await this.getJob(jobNumber);
      } catch (error) {
        console.log('[Jobber] Failed to fetch by encoded ID, trying job number search...');
      }
    }
    
    // Fetch recent jobs and filter client-side by job number
    const query = `
      query GetJobsByNumber {
        jobs(first: 100) {
          nodes {
            id
            jobNumber
            title
            instructions
            jobberWebUri
            client {
              id
              name
              companyName
              phones {
                number
              }
            }
            property {
              address {
                street
                city
                province
                postalCode
              }
            }
            visits {
              nodes {
                id
                title
                startAt
                endAt
                completedAt
              }
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest<{ jobs: { nodes: JobberJob[] } }>(query);
    
    // Filter by job number (convert to string for comparison)
    const matchedJob = response.jobs.nodes.find(job => 
      job.jobNumber?.toString() === jobNumber || 
      job.id === jobNumber
    );
    
    return matchedJob || null;
  }
}

export type { JobberJob, JobberConfig };
