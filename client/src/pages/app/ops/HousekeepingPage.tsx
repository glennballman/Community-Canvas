import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, ClipboardCheck, Wrench, Search, Filter, Plus, Clock, User, MapPin, Camera } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { TaskDetailDrawer } from '@/components/ops/TaskDetailDrawer';

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

const priorityColors: Record<number, string> = {
  1: 'bg-red-500/10 text-red-500 border-red-500/30',
  2: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  3: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  4: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  5: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

function TaskCard({ task, onStatusChange, onSelect }: { task: HousekeepingTask; onStatusChange: (id: string, status: TaskStatus) => void; onSelect: (task: HousekeepingTask) => void }) {
  const Icon = taskTypeIcons[task.task_type];
  
  return (
    <Card className="mb-2 cursor-pointer hover-elevate" data-testid={`task-card-${task.id}`} onClick={() => onSelect(task)}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className={`p-1.5 rounded ${priorityColors[task.priority] || priorityColors[5]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{task.unit_label || 'Unknown Unit'}</div>
            {task.container_path && task.container_path.length > 0 && (
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {task.container_path.join(' > ')}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {taskTypeLabels[task.task_type]}
          </Badge>
          {task.scheduled_for && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(task.scheduled_for).toLocaleDateString()}
            </span>
          )}
          {task.assigned_to && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" />
              Assigned
            </span>
          )}
        </div>
        
        {task.notes && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{task.notes}</p>
        )}
        
        {task.status !== 'done' && task.status !== 'canceled' && (
          <div className="flex gap-1 mt-3">
            {task.status === 'open' && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-7"
                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'in_progress'); }}
                data-testid={`button-start-${task.id}`}
              >
                Start
              </Button>
            )}
            {task.status === 'in_progress' && (
              <Button 
                size="sm" 
                variant="default" 
                className="text-xs h-7"
                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'done'); }}
                data-testid={`button-complete-${task.id}`}
              >
                Complete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KanbanColumn({ title, tasks, status, onStatusChange, onSelect }: { 
  title: string; 
  tasks: HousekeepingTask[]; 
  status: TaskStatus; 
  onStatusChange: (id: string, status: TaskStatus) => void;
  onSelect: (task: HousekeepingTask) => void;
}) {
  const columnTasks = tasks.filter(t => t.status === status);
  
  return (
    <div className="flex-1 min-w-[280px] bg-muted/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">{columnTasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {columnTasks.map(task => (
          <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onSelect={onSelect} />
        ))}
        {columnTasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
        )}
      </div>
    </div>
  );
}

export default function HousekeepingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null);
  
  const { data: tasksData, isLoading } = useQuery<{ ok: boolean; tasks: HousekeepingTask[] }>({
    queryKey: ['/api/p2/app/ops/tasks', { type: typeFilter !== 'all' ? typeFilter : undefined }],
  });
  
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const res = await apiRequest('PATCH', `/api/p2/app/ops/tasks/${id}`, { status });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/ops/tasks'] });
      toast({ title: 'Task updated' });
    },
    onError: () => {
      toast({ title: 'Error updating task', variant: 'destructive' });
    },
  });
  
  const handleStatusChange = (id: string, status: TaskStatus) => {
    updateStatusMutation.mutate({ id, status });
  };
  
  const tasks = tasksData?.tasks || [];
  const filteredTasks = tasks.filter(task => {
    if (priorityFilter !== 'all' && task.priority !== parseInt(priorityFilter)) return false;
    if (searchQuery && !task.unit_label?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  
  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Housekeeping</h1>
            <p className="text-sm text-muted-foreground">Manage cleaning and maintenance tasks</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search units..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48"
                data-testid="input-search-tasks"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TaskType | 'all')}>
              <SelectTrigger className="w-32" data-testid="select-task-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="clean">Clean</SelectItem>
                <SelectItem value="setup">Setup</SelectItem>
                <SelectItem value="inspect">Inspect</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32" data-testid="select-priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="1">P1 - Critical</SelectItem>
                <SelectItem value="2">P2 - High</SelectItem>
                <SelectItem value="3">P3 - Medium</SelectItem>
                <SelectItem value="4">P4 - Low</SelectItem>
                <SelectItem value="5">P5 - Minimal</SelectItem>
              </SelectContent>
            </Select>
            
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'kanban' | 'table')}>
              <TabsList>
                <TabsTrigger value="kanban" data-testid="tab-kanban">Kanban</TabsTrigger>
                <TabsTrigger value="table" data-testid="tab-table">Table</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button size="sm" data-testid="button-create-task">
              <Plus className="w-4 h-4 mr-1" />
              New Task
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            <KanbanColumn title="Open" tasks={filteredTasks} status="open" onStatusChange={handleStatusChange} onSelect={setSelectedTask} />
            <KanbanColumn title="In Progress" tasks={filteredTasks} status="in_progress" onStatusChange={handleStatusChange} onSelect={setSelectedTask} />
            <KanbanColumn title="Completed" tasks={filteredTasks} status="done" onStatusChange={handleStatusChange} onSelect={setSelectedTask} />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">Unit</th>
                    <th className="text-left p-3 text-sm font-medium">Type</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">Priority</th>
                    <th className="text-left p-3 text-sm font-medium">Scheduled</th>
                    <th className="text-left p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.id} className="border-b hover:bg-muted/30 cursor-pointer" data-testid={`row-task-${task.id}`} onClick={() => setSelectedTask(task)}>
                      <td className="p-3">
                        <div className="font-medium text-sm">{task.unit_label || 'Unknown'}</div>
                        {task.container_path?.length > 0 && (
                          <div className="text-xs text-muted-foreground">{task.container_path.join(' > ')}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{taskTypeLabels[task.task_type]}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={statusColors[task.status]}>{task.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={priorityColors[task.priority]}>P{task.priority}</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {task.scheduled_for ? new Date(task.scheduled_for).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {task.status === 'open' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'in_progress'); }}>
                              Start
                            </Button>
                          )}
                          {task.status === 'in_progress' && (
                            <Button size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'done'); }}>
                              Complete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No housekeeping tasks found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <TaskDetailDrawer
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
