import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Home, Bed, DoorOpen, DollarSign, Save, Loader2, X, Pause, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface HousingOffer {
  id: string;
  portalId: string;
  tenantId: string;
  capacityBeds: number;
  capacityRooms: number;
  nightlyCostMinCents: number | null;
  nightlyCostMaxCents: number | null;
  notes: string | null;
  status: 'active' | 'paused';
  updatedAt: string;
}

interface HousingOfferResponse {
  ok: boolean;
  offer: HousingOffer | null;
}

const formSchema = z.object({
  capacity_beds: z.number().int().min(0, 'Must be 0 or more'),
  capacity_rooms: z.number().int().min(0, 'Must be 0 or more'),
  nightly_cost_min_cents: z.number().int().min(0).nullable(),
  nightly_cost_max_cents: z.number().int().min(0).nullable(),
  notes: z.string().max(2000).nullable(),
  status: z.enum(['active', 'paused'])
});

type FormValues = z.infer<typeof formSchema>;

export default function TenantHousingOfferPage() {
  const { portalId } = useParams<{ portalId: string }>();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      capacity_beds: 0,
      capacity_rooms: 0,
      nightly_cost_min_cents: null,
      nightly_cost_max_cents: null,
      notes: null,
      status: 'active'
    }
  });

  const { data, isLoading, error } = useQuery<HousingOfferResponse>({
    queryKey: ['/api/p2/app/portals', portalId, 'housing-offer'],
    enabled: !!portalId
  });

  useEffect(() => {
    if (data?.offer) {
      form.reset({
        capacity_beds: data.offer.capacityBeds,
        capacity_rooms: data.offer.capacityRooms,
        nightly_cost_min_cents: data.offer.nightlyCostMinCents,
        nightly_cost_max_cents: data.offer.nightlyCostMaxCents,
        notes: data.offer.notes,
        status: data.offer.status
      });
    }
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      return apiRequest('PUT', `/api/p2/app/portals/${portalId}/housing-offer`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/portals', portalId, 'housing-offer'] });
      toast({ title: 'Housing capacity saved' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to save', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Home className="h-8 w-8" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center">
            <X className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold">Failed to load housing capacity</h2>
            <p className="text-muted-foreground">Please try again later</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = form.watch('status') === 'active';

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl" data-testid="tenant-housing-offer-page">
      <div className="flex items-center gap-3 mb-8">
        <Home className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Housing Capacity</h1>
          <p className="text-muted-foreground">
            Declare your available housing for seasonal workers
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Your Housing Offer</span>
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? 'Active' : 'Paused'}
            </Badge>
          </CardTitle>
          <CardDescription>
            This information helps coordinators match candidates who need housing with available accommodations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="capacity_beds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Bed className="h-4 w-4" />
                        Beds Available
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-beds"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacity_rooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4" />
                        Rooms Available
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-rooms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nightly_cost_min_cents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Min Cost/Night ($)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Optional"
                          value={field.value ? (field.value / 100).toFixed(2) : ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            field.onChange(val ? Math.round(val * 100) : null);
                          }}
                          data-testid="input-cost-min"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nightly_cost_max_cents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Max Cost/Night ($)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Optional"
                          value={field.value ? (field.value / 100).toFixed(2) : ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            field.onChange(val ? Math.round(val * 100) : null);
                          }}
                          data-testid="input-cost-max"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional details about your housing (amenities, rules, location, etc.)"
                        {...field}
                        value={field.value || ''}
                        onChange={e => field.onChange(e.target.value || null)}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormDescription>
                      Helpful details for coordinators matching candidates
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        {field.value === 'active' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        Accepting New Matches
                      </FormLabel>
                      <FormDescription>
                        {field.value === 'active' 
                          ? 'Coordinators can match candidates to your housing'
                          : 'Your housing is paused and hidden from matching'}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === 'active'}
                        onCheckedChange={checked => field.onChange(checked ? 'active' : 'paused')}
                        data-testid="switch-status"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Housing Capacity
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
