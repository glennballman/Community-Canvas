import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, MessageSquare } from 'lucide-react';
import { MessageActionBlock } from '@/components/messaging/MessageActionBlock';
import { useMarketActions } from '@/policy/useMarketActions';
import type { ActionBlockV1 } from '@/api/messageActions';

interface Message {
  id: string;
  content: string;
  message_type: string;
  sender_display_name: string;
  sender_role: 'me' | 'them' | 'system';
  was_redacted: boolean;
  created_at: string;
  action_block?: ActionBlockV1;
}

interface ConversationData {
  ok: boolean;
  conversationId: string;
  conversationSummary: {
    id: string;
    state: string;
    contact_unlocked: boolean;
    message_count: number;
    unread_owner: number;
    unread_contractor: number;
    last_message_at: string | null;
  };
  messages: Message[];
  myRole: 'operator' | 'applicant';
  isNewConversation: boolean;
}

interface JobConversationPanelProps {
  jobId: string;
  applicationId: string;
}

export function JobConversationPanel({ jobId, applicationId }: JobConversationPanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMarkedRead = useRef(false);

  const marketActions = useMarketActions({
    objectType: 'service_request',
    actorRole: 'operator',
    marketMode: 'TARGETED',
    visibility: 'PRIVATE',
    requestStatus: 'AWAITING_RESPONSE',
    hasTargetProvider: true,
    hasActiveProposal: false,
    entryPoint: 'service',
  });

  const { data, isLoading, error, refetch } = useQuery<ConversationData>({
    queryKey: ['/api/jobs', jobId, 'applications', applicationId, 'conversation'],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}/applications/${applicationId}/conversation`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load conversation');
      return response.json();
    },
    enabled: !!jobId && !!applicationId,
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/jobs/${jobId}/applications/${applicationId}/conversation/mark-read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/dashboard/messages/unread-count'] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', `/api/jobs/${jobId}/applications/${applicationId}/conversation/messages`, {
        content,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.ok && data.message) {
        setLocalMessages(prev => [...prev, data.message]);
        setNewMessage('');
      }
      queryClient.invalidateQueries({ 
        queryKey: ['/api/jobs', jobId, 'applications', applicationId, 'conversation'] 
      });
    },
  });

  useEffect(() => {
    if (data?.messages) {
      setLocalMessages(data.messages);
    }
  }, [data?.messages]);

  useEffect(() => {
    if (data?.conversationId && !hasMarkedRead.current) {
      hasMarkedRead.current = true;
      markReadMutation.mutate();
    }
  }, [data?.conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  const handleActionComplete = useCallback((messageId: string, newActionBlock: ActionBlockV1) => {
    setLocalMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, action_block: newActionBlock } : msg
    ));
    refetch();
  }, [refetch]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendMutation.isPending) return;
    sendMutation.mutate(newMessage.trim());
  };

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="job-conversation-loading">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-muted-foreground py-4" data-testid="job-conversation-error">
        <p>Unable to load messages</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="job-conversation-panel">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4" />
        Messages
        {data?.conversationSummary?.message_count ? (
          <span className="text-muted-foreground">({data.conversationSummary.message_count})</span>
        ) : null}
      </div>

      <ScrollArea className="h-48 border rounded-md p-3 bg-muted/30">
        {localMessages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No messages yet. Start the conversation below.
          </div>
        ) : (
          <div className="space-y-3">
            {localMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_role === 'me' ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${msg.id}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.sender_role === 'me'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.sender_role !== 'me' && (
                    <div className="text-xs font-medium mb-1 opacity-70">
                      {msg.sender_display_name}
                    </div>
                  )}
                  <div>{msg.was_redacted ? '[Contact info hidden]' : msg.content}</div>
                  <div className="text-xs opacity-50 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {msg.action_block && (
                    <MessageActionBlock
                      messageId={msg.id}
                      conversationId={data?.conversationId || ''}
                      actionBlock={msg.action_block}
                      isPublicViewer={false}
                      marketActions={marketActions}
                      onActionComplete={handleActionComplete}
                    />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
          disabled={sendMutation.isPending}
          data-testid="input-message"
        />
        <Button 
          type="submit" 
          size="icon" 
          disabled={!newMessage.trim() || sendMutation.isPending}
          data-testid="button-send-message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
