import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

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
  my_role: 'owner' | 'contractor';
  unread_count: number;
  intake_mode?: 'bid' | 'run' | 'direct_award';
  service_run_id?: string;
  run_member_count?: number;
}

interface ConversationListProps {
  onSelect: (conversation: Conversation) => void;
  selectedId?: string;
}

export function ConversationList({ onSelect, selectedId }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  async function fetchConversations() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('state', filter);
      
      const data = await api.get<{ conversations: Conversation[] }>(
        `/conversations?${params}`
      );
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
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
        <h2 className="text-lg font-semibold mb-3" data-testid="text-conversations-title">Conversations</h2>
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
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
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
