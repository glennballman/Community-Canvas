import { useQuery } from "@tanstack/react-query";

interface DashboardData {
  tenantName: string;
  roleBadge: string | null;
  reservations: {
    total: number;
    activeToday: number;
  };
  serviceRuns: {
    upcoming: number;
  };
  jobs: {
    openPostings: number;
  };
  messages: {
    unread: number;
  };
  upcomingActivity: Array<{
    id: string;
    title: string;
    subtitle?: string;
    date: string;
    status: string;
    href: string;
  }>;
  attentionItems: Array<{
    id: string;
    type: "arrival" | "departure" | "overdue" | "alert" | "action";
    title: string;
    description?: string;
    href: string;
    priority: "high" | "medium" | "low";
  }>;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [reservationsRes, serviceRunsRes, jobsRes, messagesRes] =
    await Promise.allSettled([
      fetch("/api/p2/dashboard/reservations/summary").then((r) => r.json()),
      fetch("/api/p2/dashboard/service-runs/summary").then((r) => r.json()),
      fetch("/api/p2/dashboard/jobs/summary").then((r) => r.json()),
      fetch("/api/p2/dashboard/messages/unread-count").then((r) => r.json()),
    ]);

  const reservations =
    reservationsRes.status === "fulfilled" && reservationsRes.value.ok
      ? reservationsRes.value
      : { total: 0, activeToday: 0 };

  const serviceRuns =
    serviceRunsRes.status === "fulfilled" && serviceRunsRes.value.ok
      ? serviceRunsRes.value
      : { upcoming: 0 };

  const jobs =
    jobsRes.status === "fulfilled" && jobsRes.value.ok
      ? jobsRes.value
      : { openPostings: 0 };

  const messages =
    messagesRes.status === "fulfilled" && messagesRes.value.ok
      ? messagesRes.value
      : { unread: 0 };

  const activityRes = await fetch("/api/p2/dashboard/upcoming-activity?limit=5")
    .then((r) => r.json())
    .catch(() => ({ ok: false }));

  const upcomingActivity =
    activityRes.ok && activityRes.items
      ? activityRes.items.map((r: any) => ({
          id: r.id,
          title: r.title || "Reservation",
          subtitle: r.subtitle,
          date: r.date || r.check_in_date || r.start_at,
          status: r.status,
          href: r.href || `/app/reservations/${r.id}`,
        }))
      : [];

  const attentionRes = await fetch("/api/p2/dashboard/attention")
    .then((r) => r.json())
    .catch(() => ({ ok: false }));

  const attentionItems =
    attentionRes.ok && attentionRes.items ? attentionRes.items : [];

  return {
    tenantName: "",
    roleBadge: null,
    reservations: {
      total: reservations.total || 0,
      activeToday: reservations.activeToday || 0,
    },
    serviceRuns: {
      upcoming: serviceRuns.upcoming || 0,
    },
    jobs: {
      openPostings: jobs.openPostings || 0,
    },
    messages: {
      unread: messages.unread || 0,
    },
    upcomingActivity,
    attentionItems,
  };
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
