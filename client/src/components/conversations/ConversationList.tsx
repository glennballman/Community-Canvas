import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { apiRequest, queryClient } from '../../lib/queryClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserCircle, AlertCircle, Users, Plus, MessageSquarePlus } from 'lucide-react';
import { Link } from 'wouter';
import { ContextIndicator } from './ContextIndicator';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  opportunity_ref: string;
  owner_name: string;
  contractor_name: string;
  state: string;
  contact_unlocked: boolean;
  last_message_preview: string;
  last_message_at: string;
  my_role: 'owner' | 'contractor' | 'circle_member';
  unread_count: number;
  intake_mode?: 'bid' | 'run' | 'direct_award';
  service_run_id?: string;
  run_member_count?: number;
  is_circle_conversation?: boolean;
  circle_name?: string;
}

interface ConversationListProps {
  onSelect: (conversation: Conversation) => void;
  selectedId?: string;
}

interface UserContext {
  acting_as_circle: boolean;
  current_circle: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export function ConversationList({ onSelect, selectedId }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [authError, setAuthError] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvSubject, setNewConvSubject] = useState('');
  const [newConvMessage, setNewConvMessage] = useState('');
  const { toast } = useToast();
  
  const { data: context } = useQuery<UserContext>({
    queryKey: ['/api/me/context'],
    staleTime: 30000,
  });

  const createCircleConversation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      return apiRequest('/api/conversations/circle', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: 'Conversation created' });
      setNewConvOpen(false);
      setNewConvSubject('');
      setNewConvMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      fetchConversations();
    },
    onError: () => {
      toast({ title: 'Failed to create conversation', variant: 'destructive' });
    },
  });

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  async function fetchConversations() {
    setLoading(true);
    setAuthError(false);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('state', filter);
      
      const data = await api<{ conversations: Conversation[] }>(
        `/api/conversations?${params}`
      );
      setConversations(data.conversations || []);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication')) {
        setAuthError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function getStateColor(state: string): string {
    const colors: Record<string, string> = {
      interest: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      pre_bid: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      awarded_pending: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      contracted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      in_progress: 'bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-200',
      completed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    };
    return colors[state] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }

  function getIntakeModeLabel(mode?: string): { label: string; color: string } | null {
    if (!mode || mode === 'bid') return null;
    if (mode === 'run') return { label: 'Service Run', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' };
    if (mode === 'direct_award') return { label: 'Direct', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' };
    return null;
  }

  function formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="flex flex-col h-full bg-background border-r">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-lg font-semibold" data-testid="text-conversations-title">Conversations</h2>
          <ContextIndicator />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full p-2 border rounded text-sm bg-background"
          data-testid="select-conversation-filter"
        >
          <option value="all">All Conversations</option>
          <option value="interest">Interest</option>
          <option value="negotiation">Negotiation</option>
          <option value="contracted">Contracted</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        
        {context?.acting_as_circle && context.current_circle && (
          <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3 gap-2"
                data-testid="button-new-circle-conversation"
              >
                <MessageSquarePlus className="h-4 w-4" />
                New Circle Conversation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Circle Conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Posting as: <strong>{context.current_circle.name}</strong></span>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Subject</label>
                  <Input
                    value={newConvSubject}
                    onChange={(e) => setNewConvSubject(e.target.value)}
                    placeholder="Conversation subject..."
                    data-testid="input-conversation-subject"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">First Message</label>
                  <Textarea
                    value={newConvMessage}
                    onChange={(e) => setNewConvMessage(e.target.value)}
                    placeholder="Write your message..."
                    className="min-h-[100px]"
                    data-testid="textarea-conversation-message"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setNewConvOpen(false)}
                  data-testid="button-cancel-conversation"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createCircleConversation.mutate({ 
                    subject: newConvSubject, 
                    message: newConvMessage 
                  })}
                  disabled={!newConvSubject.trim() || !newConvMessage.trim() || createCircleConversation.isPending}
                  data-testid="button-submit-conversation"
                >
                  {createCircleConversation.isPending ? 'Creating...' : 'Create Conversation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : authError ? (
          <div className="p-6 text-center space-y-4">
            <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
            <div>
              <h3 className="font-medium mb-1">Tenant Context Required</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Platform admins need to impersonate a tenant to view conversations.
              </p>
              <Link href="/platform">
                <Button size="sm" variant="outline" data-testid="button-go-impersonate">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Open Impersonation Console
                </Button>
              </Link>
            </div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">No conversations yet</div>
        ) : (
          conversations.map((conv) => {
            const intakeMode = getIntakeModeLabel(conv.intake_mode);
            
            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`p-4 border-b cursor-pointer hover-elevate transition ${
                  selectedId === conv.id ? 'bg-accent' : ''
                }`}
                data-testid={`card-conversation-${conv.id}`}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="font-medium text-sm truncate flex-1">
                    {conv.is_circle_conversation && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 mr-1.5">
                        Circle
                      </span>
                    )}
                    {conv.opportunity_title}
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 ml-2">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded ${getStateColor(conv.state)}`}>
                    {conv.state.replace(/_/g, ' ')}
                  </span>
                  
                  {intakeMode && (
                    <span className={`text-xs px-2 py-0.5 rounded ${intakeMode.color}`}>
                      {intakeMode.label}
                    </span>
                  )}
                  
                  {conv.intake_mode === 'run' && conv.run_member_count && (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400">
                      {conv.run_member_count} homes
                    </span>
                  )}
                  
                  <span className="text-xs text-muted-foreground">
                    {conv.my_role === 'owner' ? `To: ${conv.contractor_name}` : `From: ${conv.owner_name}`}
                  </span>
                </div>
                
                <div className="flex justify-between items-end gap-2">
                  <p className="text-xs text-muted-foreground truncate flex-1">
                    {conv.last_message_preview || 'No messages yet'}
                  </p>
                  <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                    {formatTime(conv.last_message_at)}
                  </span>
                </div>
                
                {!conv.contact_unlocked && (
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span>Contact protected</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
