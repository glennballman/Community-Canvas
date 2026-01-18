import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { JobStatusBadge } from "./JobStatusBadge";
import { Job } from "@/hooks/useJobsIndex";
import { MoreHorizontal, XCircle, Users } from "lucide-react";
import { format } from "date-fns";

interface JobsTableProps {
  jobs: Job[];
  isLoading: boolean;
  onClose: (jobId: string) => void;
  isClosing: boolean;
}

export function JobsTable({ jobs, isLoading, onClose, isClosing }: JobsTableProps) {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const handleCloseClick = (jobId: string) => {
    setSelectedJobId(jobId);
    setCloseDialogOpen(true);
  };

  const handleConfirmClose = () => {
    if (selectedJobId) {
      onClose(selectedJobId);
    }
    setCloseDialogOpen(false);
    setSelectedJobId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No job postings found</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Try adjusting your filters or create a new job posting.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Portals</TableHead>
              <TableHead className="text-right">Applications</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <span>{job.title}</span>
                    {job.location_text && (
                      <span className="text-xs text-muted-foreground">{job.location_text}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{job.role_category || "-"}</span>
                </TableCell>
                <TableCell>
                  <JobStatusBadge status={job.status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {job.portals && job.portals.length > 0 ? (
                      job.portals.slice(0, 3).map((portal) => (
                        <Badge key={portal.id} variant="outline" className="text-xs">
                          {portal.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                    {job.portals && job.portals.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{job.portals.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {job.total_applications || 0}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(job.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-actions-${job.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {job.status === "open" && (
                        <DropdownMenuItem
                          onClick={() => handleCloseClick(job.id)}
                          className="text-destructive"
                          data-testid={`menu-close-${job.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Close Posting
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Job Posting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this job posting? This will remove it from all portals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-close">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              disabled={isClosing}
              data-testid="button-confirm-close"
            >
              {isClosing ? "Closing..." : "Close Posting"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
