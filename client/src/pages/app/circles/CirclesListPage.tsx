import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Plus, Search, Settings, ArrowRight } from 'lucide-react';

interface Circle {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  member_count: number;
  user_role_name?: string;
  user_role_level?: string;
  created_at: string;
}

export default function CirclesListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery<{ circles: Circle[] }>({
    queryKey: ['/api/p2/circles', { search, status: statusFilter }],
  });

  const circles = data?.circles || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="secondary" data-testid="badge-status-active">Active</Badge>;
      case 'inactive':
        return <Badge variant="outline" data-testid="badge-status-inactive">Inactive</Badge>;
      case 'archived':
        return <Badge variant="destructive" data-testid="badge-status-archived">Archived</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status-unknown">{status}</Badge>;
    }
  };

  const getRoleBadge = (level?: string, name?: string) => {
    if (!level) return null;
    
    switch (level) {
      case 'owner':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" data-testid="badge-role-owner">{name || 'Owner'}</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30" data-testid="badge-role-admin">{name || 'Admin'}</Badge>;
      case 'member':
        return <Badge variant="outline" data-testid="badge-role-member">{name || 'Member'}</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-role-default">{name || level}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Coordination Circles</h1>
          <p className="text-muted-foreground">
            Manage federated resource sharing circles
          </p>
        </div>
        <Button
          onClick={() => navigate('/app/circles/new')}
          data-testid="button-create-circle"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Circle
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search circles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-status-all">All Status</SelectItem>
            <SelectItem value="active" data-testid="option-status-active">Active</SelectItem>
            <SelectItem value="inactive" data-testid="option-status-inactive">Inactive</SelectItem>
            <SelectItem value="archived" data-testid="option-status-archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : circles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">No circles found</h3>
            <p className="text-muted-foreground text-center mb-4" data-testid="text-empty-message">
              {search ? 'No circles match your search criteria.' : 'Create your first coordination circle to get started.'}
            </p>
            {!search && (
              <Button onClick={() => navigate('/app/circles/new')} data-testid="button-create-first">
                <Plus className="h-4 w-4 mr-2" />
                Create Circle
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {circles.map((circle) => (
            <Card
              key={circle.id}
              className="hover-elevate cursor-pointer"
              onClick={() => navigate(`/app/circles/${circle.id}`)}
              data-testid={`card-circle-${circle.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg" data-testid={`text-circle-name-${circle.id}`}>
                    {circle.name}
                  </CardTitle>
                  {getStatusBadge(circle.status)}
                </div>
                <CardDescription className="line-clamp-2" data-testid={`text-circle-desc-${circle.id}`}>
                  {circle.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1" data-testid={`text-member-count-${circle.id}`}>
                      <Users className="h-4 w-4" />
                      {circle.member_count} member{circle.member_count !== 1 ? 's' : ''}
                    </div>
                    {getRoleBadge(circle.user_role_level, circle.user_role_name)}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
