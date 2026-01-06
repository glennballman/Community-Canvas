import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight } from 'lucide-react';

export default function CustomersPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/app/crm/people', { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]" data-testid="customers-redirect-page">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Contacts Have Moved</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Customer management is now part of the unified Contacts section.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecting automatically in 3 seconds...
          </p>
          <Button 
            onClick={() => navigate('/app/crm/people', { replace: true })}
            className="w-full"
            data-testid="button-go-to-contacts"
          >
            Go to Contacts
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
