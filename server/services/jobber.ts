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

export class JobberService {
  private accessToken: string;

  constructor(config: JobberConfig) {
    this.accessToken = config.accessToken;
  }

  private async graphqlRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(JOBBER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-JOBBER-GRAPHQL-VERSION': '2024-06-12',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Jobber API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors) {
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
      query GetJobs($filter: JobFilterAttributes) {
        jobs(filter: $filter, first: 50) {
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

    const response = await this.graphqlRequest<{ jobs: { nodes: JobberJob[] } }>(query, {
      filter: {
        startDate,
        endDate,
      },
    });
    return response.jobs.nodes;
  }

  async getJobByNumber(jobNumber: string): Promise<JobberJob | null> {
    const query = `
      query SearchJob($filter: JobFilterAttributes) {
        jobs(filter: $filter, first: 1) {
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

    const response = await this.graphqlRequest<{ jobs: { nodes: JobberJob[] } }>(query, {
      filter: {
        search: jobNumber,
      },
    });
    return response.jobs.nodes[0] || null;
  }
}

export type { JobberJob, JobberConfig };
