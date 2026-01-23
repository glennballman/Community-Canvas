/**
 * V3.5 QA Runner: Critical Pages Matrix
 * Single source of truth for pages that must NEVER redirect to login
 */

export interface ApiProbe {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  assert: (resJson: any) => void;
}

export interface RouteProbe {
  method: 'GET';
  path: string;
  mustNotInclude?: string[];
}

export interface CriticalPage {
  id: string;
  label: string;
  route: string;
  apiProbes: ApiProbe[];
  routeProbe?: RouteProbe;
  requiresLatestId?: 'workRequest' | 'serviceRun' | 'monitorRun';
}

export const CRITICAL_PAGES: CriticalPage[] = [
  {
    id: 'intake_work_requests',
    label: 'Intake Work Requests List',
    route: '/app/intake/work-requests',
    apiProbes: [
      {
        name: 'list_work_requests',
        method: 'GET',
        path: '/api/work-requests',
        assert: (json) => {
          const workRequests = Array.isArray(json) ? json : json?.workRequests;
          if (!Array.isArray(workRequests)) throw new Error('Expected {workRequests: []}');
        }
      }
    ],
    routeProbe: {
      method: 'GET',
      path: '/app/intake/work-requests',
      mustNotInclude: ['Welcome Back', 'Sign In', '/login']
    }
  },
  {
    id: 'work_requests_list',
    label: 'Work Requests List',
    route: '/app/work-requests',
    apiProbes: [
      {
        name: 'list_work_requests_main',
        method: 'GET',
        path: '/api/work-requests',
        assert: (json) => {
          const workRequests = Array.isArray(json) ? json : json?.workRequests;
          if (!Array.isArray(workRequests)) throw new Error('Expected {workRequests: []}');
        }
      }
    ],
    routeProbe: {
      method: 'GET',
      path: '/app/work-requests',
      mustNotInclude: ['Welcome Back', 'Sign In', '/login']
    }
  },
  {
    id: 'work_request_detail',
    label: 'Work Request Detail',
    route: '/app/work-requests/:id',
    requiresLatestId: 'workRequest',
    apiProbes: [
      {
        name: 'get_work_request',
        method: 'GET',
        path: '/api/work-requests/:id',
        assert: (json) => {
          const wr = json?.workRequest || json;
          if (!wr || !wr.id) throw new Error('Expected work request with id');
        }
      }
    ]
  },
  {
    id: 'service_runs_new',
    label: 'New Service Run',
    route: '/app/service-runs/new',
    apiProbes: [
      {
        name: 'services_available',
        method: 'GET',
        path: '/api/service-runs/services',
        assert: (json) => {
          const services = Array.isArray(json) ? json : json?.services;
          if (!Array.isArray(services)) throw new Error('Expected services array or {services: []}');
        }
      }
    ],
    routeProbe: {
      method: 'GET',
      path: '/app/service-runs/new',
      mustNotInclude: ['Welcome Back', 'Sign In', '/login']
    }
  },
  {
    id: 'service_run_detail',
    label: 'Service Run Detail',
    route: '/app/service-runs/:slug',
    requiresLatestId: 'serviceRun',
    apiProbes: [
      {
        name: 'get_service_run',
        method: 'GET',
        path: '/api/service-runs/runs/:slug',
        assert: (json) => {
          const run = json?.run || json;
          if (!run || !run.id) throw new Error('Expected service run with id');
        }
      }
    ]
  },
  {
    id: 'n3_monitor',
    label: 'N3 Monitor',
    route: '/app/n3/monitor/:runId',
    requiresLatestId: 'monitorRun',
    apiProbes: [
      {
        name: 'get_monitor_run',
        method: 'GET',
        path: '/api/n3/runs/:runId/monitor',
        assert: (json) => {
          if (!json || typeof json !== 'object') throw new Error('Expected monitor data object');
        }
      }
    ]
  },
  {
    id: 'contractor_preview',
    label: 'Contractor Work Request Preview',
    route: '/preview/contractor/work-request/:workRequestId',
    requiresLatestId: 'workRequest',
    apiProbes: [
      {
        name: 'preview_work_request',
        method: 'GET',
        path: '/api/work-requests/:id',
        assert: (json) => {
          const wr = json?.workRequest || json;
          if (!wr || !wr.id) throw new Error('Expected work request');
        }
      }
    ]
  }
];
