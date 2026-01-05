import { useState, useEffect, useRef, FormEvent } from 'react';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Unlock, Send } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  message_type: string;
  sender_display_name: string;
  sender_role: 'me' | 'them' | 'system';
  was_redacted: boolean;
  created_at: string;
}

interface ConversationViewProps {
  conversationId: string;
  myRole: 'owner' | 'contractor';
  intakeMode?: 'bid' | 'run' | 'direct_award';
}

export function ConversationView({ conversationId, myRole }: ConversationViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactUnlocked, setContactUnlocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const data = await api.get<{ messages: Message[]; contact_unlocked: boolean }>(
        `/conversations/${conversationId}/messages`
      );
      setMessages(data.messages || []);
      setContactUnlocked(data.contact_unlocked);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await api.post<{ wasRedacted: boolean }>(
        `/conversations/${conversationId}/messages`,
        { content: newMessage }
      );
      
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }

  async function shareContact() {
    const confirmMsg = myRole === 'owner'
      ? 'Share your contact information with this contractor?'
      : 'Request contact information from the owner?';
    
    if (!confirm(confirmMsg)) return;
    
    try {
      const endpoint = myRole === 'owner' 
        ? `/conversations/${conversationId}/unlock-contact`
        : `/conversations/${conversationId}/contractor-unlock-contact`;
      
      const data = await api.post<{ contact_unlocked: boolean }>(endpoint);
      
      if (data.contact_unlocked) {
        setContactUnlocked(true);
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sharing contact:', error);
    }
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  }

  function groupMessagesByDate(msgs: Message[]) {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    
    msgs.forEach(msg => {
      const msgDate = formatDate(msg.created_at);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });
    
    return groups;
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {!contactUnlocked && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 p-3 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <Lock className="h-4 w-4" />
            <span>Contact details are protected. Owners can share anytime.</span>
          </div>
          <Button
            onClick={shareContact}
            size="sm"
            variant="outline"
            className="shrink-0"
            data-testid="button-share-contact"
          >
            {myRole === 'owner' ? 'Share Contact' : 'Request Contact'}
          </Button>
        </div>
      )}

      {contactUnlocked && (
        <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 p-2 text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
          <Unlock className="h-4 w-4" />
          <span>Contact information is shared</span>
        </div>
      )}

      <div className="bg-muted/50 border-b px-4 py-2 text-xs text-muted-foreground">
        In remote communities, trades are scarce. This platform helps coordinate work respectfully.
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupMessagesByDate(messages).map((group, groupIndex) => (
          <div key={groupIndex}>
            <div className="text-center text-xs text-muted-foreground my-4">
              {group.date}
            </div>
            {group.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex mb-3 ${
                  msg.sender_role === 'me' ? 'justify-end' : 
                  msg.sender_role === 'system' ? 'justify-center' : 'justify-start'
                }`}
                data-testid={`message-${msg.id}`}
              >
                {msg.sender_role === 'system' ? (
                  <div className="bg-muted text-muted-foreground text-xs px-3 py-2 rounded-full">
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className={`max-w-[70%] ${
                      msg.sender_role === 'me'
                        ? 'bg-primary text-primary-foreground rounded-l-lg rounded-tr-lg'
                        : 'bg-muted text-foreground rounded-r-lg rounded-tl-lg'
                    } px-4 py-2`}
                  >
                    {msg.sender_role === 'them' && (
                      <div className="text-xs font-medium mb-1 opacity-75">
                        {msg.sender_display_name}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div className={`text-xs mt-1 ${
                      msg.sender_role === 'me' ? 'opacity-70' : 'text-muted-foreground'
                    } flex items-center gap-2`}>
                      {formatTime(msg.created_at)}
                      {msg.was_redacted && (
                        <span className="text-amber-500 flex items-center gap-1">
                          <Lock className="h-3 w-3" /> protected
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="border-t p-4">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            data-testid="input-message"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {!contactUnlocked && (
          <p className="text-xs text-muted-foreground mt-2">
            Contact info (phone, email) is protected. Owners control sharing.
          </p>
        )}
      </form>
    </div>
  );
}
