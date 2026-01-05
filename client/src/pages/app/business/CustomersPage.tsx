import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Users } from 'lucide-react';

export default function CustomersPage() {
  const customers = [
    { id: '1', name: 'John Smith', email: 'john@example.com', bookings: 3 },
    { id: '2', name: 'Jane Doe', email: 'jane@example.com', bookings: 5 },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com', bookings: 2 },
  ];

  return (
    <div className="space-y-6" data-testid="customers-page">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">
          Manage your customer relationships
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          className="pl-9"
          data-testid="input-search-customers"
        />
      </div>

      <div className="grid gap-4">
        {customers.map((customer) => (
          <Card key={customer.id} className="hover-elevate" data-testid={`card-customer-${customer.id}`}>
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar>
                <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-lg">{customer.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{customer.bookings}</p>
                <p className="text-sm text-muted-foreground">bookings</p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
