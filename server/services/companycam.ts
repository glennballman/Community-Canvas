const COMPANYCAM_API_URL = 'https://api.companycam.com/v2';

interface CompanyCamConfig {
  accessToken: string;
}

interface CompanyCamPhotoUri {
  type: string;
  uri: string;
  url: string;
}

interface CompanyCamPhoto {
  id: string;
  uris: CompanyCamPhotoUri[];
  captured_at: number;
  creator_name?: string;
  tags?: { name: string }[];
  coordinates?: {
    lat: number;
    lon: number;
  };
}

function getPhotoUrl(uris: CompanyCamPhotoUri[], type: string): string | undefined {
  const match = uris.find(u => u.type === type);
  return match?.uri || match?.url;
}

interface CompanyCamProject {
  id: string;
  name: string;
  address?: {
    street_address_1?: string;
    street_address_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  coordinates?: {
    lat: number;
    lon: number;
  };
  created_at: string;
  updated_at: string;
}

export class CompanyCamService {
  private accessToken: string;

  constructor(config: CompanyCamConfig) {
    this.accessToken = config.accessToken;
  }

  private async request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${COMPANYCAM_API_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CompanyCam API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async getProjects(page: number = 1, perPage: number = 50): Promise<CompanyCamProject[]> {
    return this.request<CompanyCamProject[]>('/projects', { page, per_page: perPage });
  }

  async getProject(projectId: string): Promise<CompanyCamProject> {
    return this.request<CompanyCamProject>(`/projects/${projectId}`);
  }

  async searchProjects(query: string): Promise<CompanyCamProject[]> {
    return this.request<CompanyCamProject[]>('/projects', { query });
  }

  async getProjectPhotos(projectId: string, page: number = 1, perPage: number = 20): Promise<CompanyCamPhoto[]> {
    return this.request<CompanyCamPhoto[]>(`/projects/${projectId}/photos`, { page, per_page: perPage });
  }

  async getPhoto(photoId: string): Promise<CompanyCamPhoto> {
    return this.request<CompanyCamPhoto>(`/photos/${photoId}`);
  }

  async getRecentPhotos(days: number = 7, page: number = 1): Promise<CompanyCamPhoto[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.request<CompanyCamPhoto[]>('/photos', {
      page,
      per_page: 50,
      start_date: startDate.toISOString(),
    });
  }

  async testConnection(): Promise<{ connected: boolean; projectCount?: number }> {
    try {
      const projects = await this.getProjects(1, 1);
      return { connected: true, projectCount: Array.isArray(projects) ? projects.length : 0 };
    } catch (error) {
      throw error;
    }
  }
}

export { getPhotoUrl };
export type { CompanyCamPhoto, CompanyCamProject, CompanyCamConfig, CompanyCamPhotoUri };
