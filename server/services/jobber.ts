const JOBBER_API_URL = 'https://api.getjobber.com/api/graphql';

interface JobberConfig {
  accessToken: string;
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
