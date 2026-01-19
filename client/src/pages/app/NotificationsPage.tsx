import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, CheckCheck, ExternalLink, Loader2, Inbox, AlertCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  subject: string | null;
  body: string;
  shortBody: string | null;
  category: string;
  priority: string;
  actionUrl: string | null;
  actionLabel: string | null;
  contextType: string | null;
  contextId: string | null;
  status: string;
  createdAt: string;
  readAt: string | null;
  senderName: string | null;
}

interface NotificationsResponse {
  ok: boolean;
  notifications: Notification[];
  totalUnread: number;
  hasMore: boolean;
  nextCursor: string | null;
}

function getCategoryVariant(category: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (category) {
    case 'alert': return 'destructive';
    case 'reservation': return 'default';
    case 'payment': return 'secondary';
    default: return 'outline';
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread');

  const { data, isLoading, error } = useQuery<NotificationsResponse>({
    queryKey: [`/api/notifications?status=${activeTab}&limit=100`],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.actionUrl && notification.actionUrl.startsWith('/')) {
      navigate(notification.actionUrl);
    }
  };

  const notifications = data?.notifications || [];
  const totalUnread = data?.totalUnread || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-notifications">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6" data-testid="error-notifications">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive" data-testid="text-error-message">Failed to load notifications. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6" data-testid="icon-notifications" />
          <h1 className="text-2xl font-bold" data-testid="text-notifications-title">Notifications</h1>
          {totalUnread > 0 && (
            <Badge variant="secondary" data-testid="badge-unread-count">{totalUnread} unread</Badge>
          )}
        </div>
        {totalUnread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'unread' | 'all')}>
        <TabsList className="mb-4" data-testid="tabs-notifications">
          <TabsTrigger value="unread" data-testid="tab-unread">
            Unread {totalUnread > 0 && `(${totalUnread})`}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3">
          {notifications.length === 0 ? (
            <Card data-testid="card-empty-state">
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" data-testid="icon-empty" />
                <p className="text-muted-foreground" data-testid="text-empty-state">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer hover-elevate ${
                  !notification.readAt ? 'bg-accent/30' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
                data-testid={`card-notification-${notification.id}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {notification.priority === 'urgent' && (
                          <AlertCircle className="h-4 w-4 text-destructive" data-testid="icon-urgent" />
                        )}
                        {notification.priority === 'high' && (
                          <AlertTriangle className="h-4 w-4 text-warning" data-testid="icon-high-priority" />
                        )}
                        {notification.subject && (
                          <span className="font-medium" data-testid="text-notification-subject">
                            {notification.subject}
                          </span>
                        )}
                        <Badge variant={getCategoryVariant(notification.category)} data-testid="badge-category">
                          {notification.category}
                        </Badge>
                        {notification.priority === 'urgent' && (
                          <Badge variant="destructive" data-testid="badge-urgent">Urgent</Badge>
                        )}
                        {notification.priority === 'high' && (
                          <Badge variant="secondary" data-testid="badge-high">High</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2" data-testid="text-notification-body">
                        {notification.shortBody || notification.body}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground" data-testid="text-notification-meta">
                        <span data-testid="text-notification-time">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                        {notification.senderName && (
                          <>
                            <span>-</span>
                            <span data-testid="text-notification-sender">{notification.senderName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {notification.actionUrl && notification.actionUrl.startsWith('/') && (
                        <ExternalLink className="h-4 w-4 text-muted-foreground" data-testid="icon-action" />
                      )}
                      {!notification.readAt && (
                        <div className="w-2 h-2 bg-primary rounded-full" data-testid="indicator-unread" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
