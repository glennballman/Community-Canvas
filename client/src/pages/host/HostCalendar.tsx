import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChevronLeft, ChevronRight, Plus, X, Loader2, Calendar, ArrowLeft, Trash2
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

interface CalendarData {
  startDate: string;
  endDate: string;
  reservations: Array<{
    id: number;
    confirmation_number: string;
    guest_name: string;
    check_in_date: string;
    check_out_date: string;
    status: string;
  }>;
  blocks: Array<{
    id: number;
    block_type: string;
    title: string;
    start_date: string;
    end_date: string;
  }>;
  pricingOverrides: Array<{
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    nightly_rate: number | null;
    rate_multiplier: number | null;
  }>;
}

interface Property {
  id: number;
  name: string;
  city: string;
}

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return { 'Authorization': `Bearer ${token}` };
}

export default function HostCalendar() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddBlock, setShowAddBlock] = useState(false);
  
  const [blockType, setBlockType] = useState('blocked');
  const [blockTitle, setBlockTitle] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');

  const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);

  const { data: propertyData, isLoading: loadingProperty } = useQuery({
    queryKey: ['/api/host-dashboard', 'properties', id],
    queryFn: async () => {
      const res = await fetch(`/api/host-dashboard/properties/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load property');
      return res.json();
    },
    enabled: !!user && !!id
  });

  const { data: calendarData, isLoading: loadingCalendar } = useQuery({
    queryKey: ['/api/host-dashboard', 'calendar', id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/host-dashboard/properties/${id}/calendar?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error('Failed to load calendar');
      return res.json();
    },
    enabled: !!user && !!id
  });

  const addBlockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/host-dashboard/properties/${id}/blocks`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockType,
          title: blockTitle || blockType,
          startDate: blockStart,
          endDate: blockEnd
        })
      });
      if (!res.ok) throw new Error('Failed to add block');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host-dashboard', 'calendar', id] });
      setShowAddBlock(false);
      setBlockTitle('');
      setBlockStart('');
      setBlockEnd('');
    }
  });

  const removeBlockMutation = useMutation({
    mutationFn: async (blockId: number) => {
      const res = await fetch(`/api/host-dashboard/properties/${id}/blocks/${blockId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to remove block');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host-dashboard', 'calendar', id] });
    }
  });

  const property = propertyData?.property;
  const calendar: CalendarData | null = calendarData?.calendar;

  function generateCalendarDays() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: Array<{ date: Date | null; reservations: any[]; blocks: any[]; overrides: any[] }> = [];

    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, reservations: [], blocks: [], overrides: [] });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().split('T')[0];

      const dayReservations = calendar?.reservations.filter(b => 
        dateStr >= b.check_in_date && dateStr < b.check_out_date
      ) || [];

      const dayBlocks = calendar?.blocks.filter(b =>
        dateStr >= b.start_date && dateStr <= b.end_date
      ) || [];

      const dayOverrides = calendar?.pricingOverrides.filter(o =>
        dateStr >= o.start_date && dateStr <= o.end_date
      ) || [];

      days.push({ date, reservations: dayReservations, blocks: dayBlocks, overrides: dayOverrides });
    }

    return days;
  }

  const calendarDays = calendar ? generateCalendarDays() : [];
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isLoading = authLoading || loadingProperty || loadingCalendar;

  if (isLoading) {
    return (
      <HostLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </HostLayout>
    );
  }

  return (
    <HostLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Link href="/host/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-calendar-title">{property?.name || 'Property'}</h1>
            <p className="text-muted-foreground">Calendar Management</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle>{monthName}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-muted-foreground text-sm py-2 font-medium">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => (
                  <div
                    key={idx}
                    className={`min-h-[80px] p-1 rounded-md border ${
                      day.date ? 'bg-card' : 'bg-muted/30'
                    } ${day.blocks.length > 0 ? 'bg-destructive/10 border-destructive/30' : 'border-border'}`}
                    data-testid={day.date ? `calendar-day-${day.date.getDate()}` : undefined}
                  >
                    {day.date && (
                      <>
                        <div className="text-sm text-muted-foreground mb-1">
                          {day.date.getDate()}
                        </div>
                        {day.reservations.map((b, i) => (
                          <Badge
                            key={i}
                            variant={b.status === 'confirmed' ? 'default' : 'secondary'}
                            className={`text-xs w-full justify-start mb-0.5 truncate ${
                              b.status === 'confirmed' ? 'bg-green-600' : 'bg-yellow-600'
                            }`}
                            title={`${b.guest_name} (${b.status})`}
                          >
                            {b.guest_name}
                          </Badge>
                        ))}
                        {day.blocks.map((b, i) => (
                          <Badge
                            key={i}
                            variant="destructive"
                            className="text-xs w-full justify-start truncate"
                            title={b.title}
                          >
                            {b.title || b.block_type}
                          </Badge>
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-600 rounded"></div>
                  <span className="text-muted-foreground">Confirmed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-600 rounded"></div>
                  <span className="text-muted-foreground">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-destructive rounded"></div>
                  <span className="text-muted-foreground">Blocked</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Block Dates</CardTitle>
              </CardHeader>
              <CardContent>
                {showAddBlock ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Block Type</Label>
                      <Select value={blockType} onValueChange={setBlockType}>
                        <SelectTrigger data-testid="select-block-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="owner_use">Owner Use</SelectItem>
                          <SelectItem value="seasonal_closure">Seasonal Closure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Title (optional)</Label>
                      <Input
                        value={blockTitle}
                        onChange={(e) => setBlockTitle(e.target.value)}
                        placeholder="Block reason..."
                        data-testid="input-block-title"
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Start Date</Label>
                      <Input
                        type="date"
                        value={blockStart}
                        onChange={(e) => setBlockStart(e.target.value)}
                        data-testid="input-block-start"
                      />
                    </div>

                    <div>
                      <Label className="text-sm">End Date</Label>
                      <Input
                        type="date"
                        value={blockEnd}
                        onChange={(e) => setBlockEnd(e.target.value)}
                        data-testid="input-block-end"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => addBlockMutation.mutate()}
                        disabled={!blockStart || !blockEnd || addBlockMutation.isPending}
                        className="flex-1"
                        data-testid="button-save-block"
                      >
                        {addBlockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddBlock(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowAddBlock(true)}
                    data-testid="button-add-block"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Block
                  </Button>
                )}
              </CardContent>
            </Card>

            {calendar?.blocks && calendar.blocks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Blocks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {calendar.blocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex items-center justify-between p-2 rounded border text-sm"
                      data-testid={`block-${block.id}`}
                    >
                      <div>
                        <p className="font-medium">{block.title || block.block_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(block.start_date).toLocaleDateString()} - {new Date(block.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBlockMutation.mutate(block.id)}
                        disabled={removeBlockMutation.isPending}
                        data-testid={`remove-block-${block.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {calendar?.pricingOverrides && calendar.pricingOverrides.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pricing Overrides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {calendar.pricingOverrides.map((override) => (
                    <div
                      key={override.id}
                      className="p-2 rounded border text-sm"
                      data-testid={`override-${override.id}`}
                    >
                      <p className="font-medium">{override.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(override.start_date).toLocaleDateString()} - {new Date(override.end_date).toLocaleDateString()}
                      </p>
                      {override.nightly_rate && (
                        <p className="text-green-500">${override.nightly_rate}/night</p>
                      )}
                      {override.rate_multiplier && (
                        <p className="text-blue-500">{override.rate_multiplier}x multiplier</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </HostLayout>
  );
}
