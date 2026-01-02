import { useState } from 'react';
import { ProtectedHostRoute } from '@/contexts/HostAuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Building2, DollarSign, Calendar } from 'lucide-react';

function PayoutsContent() {
  const [payoutMethod, setPayoutMethod] = useState('');

  const payoutHistory = [
    { id: 1, date: '2025-12-15', amount: 450.00, status: 'completed' },
    { id: 2, date: '2025-11-15', amount: 320.50, status: 'completed' },
    { id: 3, date: '2025-10-15', amount: 275.00, status: 'completed' },
  ];

  return (
    <HostLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-payouts-title">Payouts</h1>

        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl font-bold">$0.00</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">$0.00</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                  <p className="text-2xl font-bold">$1,045.50</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Payout Method</CardTitle>
              <CardDescription>How you receive your earnings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Payout Method</Label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger data-testid="select-payout-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Transfer (ACH)</SelectItem>
                    <SelectItem value="etransfer">E-Transfer</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {payoutMethod === 'bank' && (
                <>
                  <div className="space-y-2">
                    <Label>Account Holder Name</Label>
                    <Input placeholder="Full name on account" data-testid="input-account-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Transit Number</Label>
                      <Input placeholder="5 digits" data-testid="input-transit" />
                    </div>
                    <div className="space-y-2">
                      <Label>Institution Number</Label>
                      <Input placeholder="3 digits" data-testid="input-institution" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input placeholder="Account number" data-testid="input-account-number" />
                  </div>
                </>
              )}

              {payoutMethod === 'etransfer' && (
                <div className="space-y-2">
                  <Label>E-Transfer Email</Label>
                  <Input type="email" placeholder="email@example.com" data-testid="input-etransfer-email" />
                </div>
              )}

              {payoutMethod === 'paypal' && (
                <div className="space-y-2">
                  <Label>PayPal Email</Label>
                  <Input type="email" placeholder="paypal@example.com" data-testid="input-paypal-email" />
                </div>
              )}

              <Button disabled={!payoutMethod} data-testid="button-save-payout">
                Save Payout Method
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>Your recent payouts</CardDescription>
            </CardHeader>
            <CardContent>
              {payoutHistory.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No payouts yet</p>
              ) : (
                <div className="space-y-3">
                  {payoutHistory.map(payout => (
                    <div key={payout.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">${payout.amount.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">{payout.date}</p>
                        </div>
                      </div>
                      <Badge className="bg-green-500">{payout.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </HostLayout>
  );
}

export default function HostPayouts() {
  return (
    <ProtectedHostRoute>
      <PayoutsContent />
    </ProtectedHostRoute>
  );
}
