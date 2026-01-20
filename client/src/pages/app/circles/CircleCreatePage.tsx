import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function CircleCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createCircle = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/p2/circles', { name, description });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/circles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/circles'] });
      toast({
        title: 'Circle created',
        description: `"${name}" has been created successfully.`,
      });
      navigate(`/app/circles/${data.circle.id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create circle',
        description: error?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createCircle.mutate();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/circles')}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Create Circle</h1>
          <p className="text-muted-foreground">
            Start a new coordination circle for federated resource sharing
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Circle Details</CardTitle>
              <CardDescription>
                Configure your new coordination circle
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Circle Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Vancouver Transit Operators"
                required
                data-testid="input-name"
              />
              <p className="text-sm text-muted-foreground">
                Choose a descriptive name for your circle
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose and scope of this circle..."
                rows={4}
                data-testid="input-description"
              />
              <p className="text-sm text-muted-foreground">
                Optional: Explain what this circle is for
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/app/circles')}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || createCircle.isPending}
                data-testid="button-submit"
              >
                {createCircle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Circle
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
