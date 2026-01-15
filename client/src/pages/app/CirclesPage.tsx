import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { Users, Check, X, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Circle {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role_name?: string;
  role_level?: number;
}

interface UserContext {
  current_circle_id: string | null;
  acting_as_circle: boolean;
  current_circle: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function CirclesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState<string | null>(null);

  const { data: circles, isLoading: circlesLoading } = useQuery<{ circles: Circle[] }>({
    queryKey: ['/api/me/circles'],
  });

  const { data: context } = useQuery<UserContext>({
    queryKey: ['/api/me/context'],
  });

  const switchCircle = useMutation({
    mutationFn: async (circleId: string) => {
      return api('/api/me/switch-circle', {
        method: 'POST',
        body: { circle_id: circleId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/context'] });
      toast({
        title: 'Circle switched',
        description: 'You are now acting as this circle.',
      });
      setLocation('/app/messages');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to switch circle',
        description: error?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setSwitching(null);
    },
  });

  const clearCircle = useMutation({
    mutationFn: async () => {
      return api('/api/me/clear-circle', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/context'] });
      toast({
        title: 'Circle cleared',
        description: 'You are no longer acting as a circle.',
      });
      setLocation('/app/messages');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to clear circle',
        description: error?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const handleSwitch = (circleId: string) => {
    setSwitching(circleId);
    switchCircle.mutate(circleId);
  };

  const circleList = circles?.circles || [];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/app/messages')}
          data-testid="button-back-messages"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-circles-title">My Circles</h1>
          <p className="text-sm text-muted-foreground">
            Switch your active circle context for messaging
          </p>
        </div>
      </div>

      {context?.acting_as_circle && context.current_circle && (
        <Card className="mb-6 border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-600" />
                <CardTitle className="text-lg">Currently Acting As</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearCircle.mutate()}
                disabled={clearCircle.isPending}
                data-testid="button-clear-circle"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                {context.current_circle.name}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {circlesLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading circles...</div>
      ) : circleList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">You are not a member of any circles yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {circleList.map((circle) => {
            const isActive = context?.current_circle_id === circle.id;
            
            return (
              <Card
                key={circle.id}
                className={isActive ? 'border-violet-300 dark:border-violet-700' : ''}
                data-testid={`card-circle-${circle.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{circle.name}</CardTitle>
                      {isActive && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    {circle.role_name && (
                      <Badge variant="secondary" className="text-xs">
                        {circle.role_name}
                      </Badge>
                    )}
                  </div>
                  {circle.description && (
                    <CardDescription className="mt-1">{circle.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-2">
                  <Button
                    variant={isActive ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleSwitch(circle.id)}
                    disabled={switching === circle.id || isActive}
                    data-testid={`button-switch-circle-${circle.id}`}
                  >
                    {isActive ? 'Currently Active' : switching === circle.id ? 'Switching...' : 'Act as this circle'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
