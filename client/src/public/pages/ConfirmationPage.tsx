import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "../components/PublicLayout";
import { PublicLoadingState } from "../components/PublicLoadingState";
import { PublicErrorState } from "../components/PublicErrorState";
import { publicCopy } from "../publicCopy";

interface ConfirmationData {
  id: string;
  reference_number: string | null;
  status: string;
  guest_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

export default function ConfirmationPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["reservation-confirmation", token],
    queryFn: async (): Promise<{ ok: boolean; reservation?: ConfirmationData; error?: { message: string } }> => {
      const res = await fetch(`/api/public/reserve/confirmation/${token}`);
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicLoadingState message={publicCopy.loading.default} />
      </PublicLayout>
    );
  }

  if (error || !data?.ok) {
    return (
      <PublicLayout>
        <PublicErrorState
          title={publicCopy.errors.invalidToken}
          message={data?.error?.message || publicCopy.errors.notFound}
          showBack={false}
        />
      </PublicLayout>
    );
  }

  const reservation = data.reservation;

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto" data-testid="confirmation-page">
        <Card>
          <CardHeader>
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <CardTitle data-testid="text-confirmation-title">
                {publicCopy.confirmation.title}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-center text-muted-foreground" data-testid="text-thank-you">
              {publicCopy.confirmation.thankYou}
            </p>

            {reservation?.reference_number && (
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {publicCopy.confirmation.referenceLabel}
                </p>
                <p className="font-mono text-xl font-semibold" data-testid="text-reference-number">
                  {reservation.reference_number}
                </p>
              </div>
            )}

            <div className="space-y-3" data-testid="confirmation-details-placeholder">
              <h3 className="font-medium">{publicCopy.confirmation.detailsLabel}</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                {reservation?.guest_name && (
                  <p>Guest: {reservation.guest_name}</p>
                )}
                {reservation?.starts_at && reservation?.ends_at && (
                  <p>
                    Dates: {new Date(reservation.starts_at).toLocaleDateString()} -{" "}
                    {new Date(reservation.ends_at).toLocaleDateString()}
                  </p>
                )}
                <p className="mt-4">{publicCopy.confirmation.contactInfo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
