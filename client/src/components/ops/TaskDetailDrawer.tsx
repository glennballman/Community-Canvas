/**
 * TaskDetailDrawer Component
 * M-4: Housekeeping task detail with before/after/issue photo sections
 */

import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sparkles, ClipboardCheck, Search, Wrench, Clock, User, MapPin, Camera, ImagePlus, AlertTriangle, CheckCircle } from 'lucide-react';
import { MediaUpload } from '@/components/media/MediaUpload';
import { MediaGallery } from '@/components/media/MediaGallery';
import { useEntityMedia, useDeleteEntityMedia } from '@/hooks/useEntityMedia';

type TaskType = 'clean' | 'setup' | 'inspect' | 'repair';
type TaskStatus = 'open' | 'in_progress' | 'done' | 'canceled';

interface HousekeepingTask {
  id: string;
  unit_id: string;
  task_type: TaskType;
  status: TaskStatus;
  priority: number;
  notes: string | null;
  assigned_to: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  unit_label: string | null;
  container_path: string[];
}

interface TaskDetailDrawerProps {
  task: HousekeepingTask | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

const taskTypeIcons: Record<TaskType, typeof Sparkles> = {
  clean: Sparkles,
  setup: ClipboardCheck,
  inspect: Search,
  repair: Wrench,
};

const taskTypeLabels: Record<TaskType, string> = {
  clean: 'Clean',
  setup: 'Setup',
  inspect: 'Inspect',
  repair: 'Repair',
};

const statusColors: Record<TaskStatus, string> = {
  open: 'bg-blue-500/10 text-blue-500',
  in_progress: 'bg-yellow-500/10 text-yellow-500',
  done: 'bg-green-500/10 text-green-500',
  canceled: 'bg-muted text-muted-foreground',
};

const priorityLabels: Record<number, string> = {
  1: 'P1 - Critical',
  2: 'P2 - High',
  3: 'P3 - Medium',
  4: 'P4 - Low',
  5: 'P5 - Minimal',
};

export function TaskDetailDrawer({ task, open, onClose, onStatusChange }: TaskDetailDrawerProps) {
  const taskId = task?.id || '';
  
  const { data: allMedia = [], refetch: refetchMedia } = useEntityMedia('surface_task', taskId);
  const deleteMutation = useDeleteEntityMedia('surface_task', taskId);

  const beforePhotos = useMemo(() => allMedia.filter(m => m.role === 'before'), [allMedia]);
  const afterPhotos = useMemo(() => allMedia.filter(m => m.role === 'after'), [allMedia]);
  const issuePhotos = useMemo(() => allMedia.filter(m => m.role === 'issue'), [allMedia]);

  if (!task) return null;

  const Icon = taskTypeIcons[task.task_type];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold truncate">
                {task.unit_label || 'Unknown Unit'}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-1 text-sm">
                <MapPin className="w-3 h-3" />
                {task.container_path?.join(' > ') || 'No location'}
              </SheetDescription>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline">{taskTypeLabels[task.task_type]}</Badge>
            <Badge className={statusColors[task.status]}>{task.status.replace('_', ' ')}</Badge>
            <Badge variant="outline">{priorityLabels[task.priority] || `P${task.priority}`}</Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {task.scheduled_for && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Scheduled: {new Date(task.scheduled_for).toLocaleDateString()}</span>
                </div>
              )}
              {task.assigned_to && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>Assigned</span>
                </div>
              )}
              {task.completed_at && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Completed: {new Date(task.completed_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {task.notes && (
              <div>
                <h4 className="text-sm font-medium mb-1">Notes</h4>
                <p className="text-sm text-muted-foreground">{task.notes}</p>
              </div>
            )}

            {task.status !== 'done' && task.status !== 'canceled' && (
              <div className="flex gap-2">
                {task.status === 'open' && (
                  <Button 
                    variant="outline" 
                    onClick={() => onStatusChange(task.id, 'in_progress')}
                    data-testid="button-start-task"
                  >
                    Start Task
                  </Button>
                )}
                {task.status === 'in_progress' && (
                  <Button 
                    onClick={() => onStatusChange(task.id, 'done')}
                    data-testid="button-complete-task"
                  >
                    Mark Complete
                  </Button>
                )}
              </div>
            )}

            <Separator />

            <div data-testid="before-photos-section">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Before Photos
                {beforePhotos.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{beforePhotos.length}</Badge>
                )}
              </h4>
              
              {beforePhotos.length > 0 && (
                <div className="mb-3">
                  <MediaGallery
                    assets={beforePhotos}
                    layout="grid"
                    onDelete={(id) => deleteMutation.mutateAsync(id)}
                    emptyMessage="No before photos"
                  />
                </div>
              )}
              
              <MediaUpload
                entityType="surface_task"
                entityId={taskId}
                multiple
                maxFiles={10}
                kindTag="before"
                onUploaded={() => refetchMedia()}
                className="w-full"
              />
            </div>

            <Separator />

            <div data-testid="after-photos-section">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                After Photos
                {afterPhotos.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{afterPhotos.length}</Badge>
                )}
              </h4>
              
              {afterPhotos.length > 0 && (
                <div className="mb-3">
                  <MediaGallery
                    assets={afterPhotos}
                    layout="grid"
                    onDelete={(id) => deleteMutation.mutateAsync(id)}
                    emptyMessage="No after photos"
                  />
                </div>
              )}
              
              <MediaUpload
                entityType="surface_task"
                entityId={taskId}
                multiple
                maxFiles={10}
                kindTag="after"
                onUploaded={() => refetchMedia()}
                className="w-full"
              />
            </div>

            <Separator />

            <div data-testid="issue-photos-section">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Issue Photos
                {issuePhotos.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{issuePhotos.length}</Badge>
                )}
              </h4>
              
              {issuePhotos.length > 0 && (
                <div className="mb-3">
                  <MediaGallery
                    assets={issuePhotos}
                    layout="grid"
                    onDelete={(id) => deleteMutation.mutateAsync(id)}
                    emptyMessage="No issue photos"
                  />
                </div>
              )}
              
              <MediaUpload
                entityType="surface_task"
                entityId={taskId}
                multiple
                maxFiles={10}
                kindTag="issue"
                onUploaded={() => refetchMedia()}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Document any issues, damage, or problems found during the task
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
