import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Wrench, Truck, Send } from 'lucide-react';

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: { type: string; label: string };
}

interface Recommendation {
  title: string;
  description: string;
  action_type: string;
  action_label: string;
  priority: 'high' | 'normal';
}

interface AIAssistPanelProps {
  opportunityId: string;
  onClose: () => void;
}

export function AIAssistPanel({ opportunityId, onClose }: AIAssistPanelProps) {
  const [mode, setMode] = useState<'mat' | 'logan'>('mat');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    startSession();
  }, [mode]);

  async function startSession() {
    setStarting(true);
    try {
      const data = await api.post<{ 
        session_id: string; 
        initial_message: string;
        recommendations: Recommendation[];
      }>(`/opportunities/${opportunityId}/ai-assist/start`, { mode });
      
      setMessages([{
        id: 'initial',
        role: 'assistant',
        content: data.initial_message || getDefaultGreeting(mode)
      }]);
      setRecommendations(data.recommendations || []);
    } catch (error) {
      setMessages([{
        id: 'initial',
        role: 'assistant',
        content: getDefaultGreeting(mode)
      }]);
    } finally {
      setStarting(false);
    }
  }

  function getDefaultGreeting(assistMode: string): string {
    if (assistMode === 'mat') {
      return "I can help you refine material requirements. What would you like to clarify?";
    }
    return "I can help with logistics and access planning. What questions do you have?";
  }

  async function sendMessage() {
    if (!userInput.trim() || loading) return;

    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput
    };

    setMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setLoading(true);

    try {
      const data = await api.post<{ 
        response: string; 
        action?: { type: string; label: string };
        recommendations?: Recommendation[];
      }>(`/opportunities/${opportunityId}/ai-assist/message`, {
        mode,
        message: userInput
      });

      const assistantMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "I understand. Let me help you with that.",
        action: data.action
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (data.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (error) {
      const assistantMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'll note that down. You can proceed with your job posting anytime."
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action: { type: string; label: string }) {
    console.log('Action triggered:', action);
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg flex flex-col z-50">
      <div className="p-4 border-b flex justify-between items-center gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            {mode === 'mat' ? <Wrench className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
            {mode === 'mat' ? 'Mat (Materials)' : 'Logan (Logistics)'}
          </h3>
          <p className="text-xs text-muted-foreground">Optional refinement assistant</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-ai-panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setMode('mat')}
          className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1 ${
            mode === 'mat' 
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500' 
              : 'text-muted-foreground hover-elevate'
          }`}
          data-testid="button-mode-mat"
        >
          <Wrench className="h-4 w-4" /> Materials
        </button>
        <button
          onClick={() => setMode('logan')}
          className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1 ${
            mode === 'logan' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-b-2 border-green-500' 
              : 'text-muted-foreground hover-elevate'
          }`}
          data-testid="button-mode-logan"
        >
          <Truck className="h-4 w-4" /> Logistics
        </button>
      </div>

      {recommendations.length > 0 && (
        <div className="p-3 border-b bg-muted/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">Suggestions</div>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec, i) => (
              <div 
                key={i} 
                className={`p-2 rounded border ${
                  rec.priority === 'high' 
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' 
                    : 'border-border bg-background'
                }`}
              >
                <div className="text-sm font-medium">{rec.title}</div>
                <div className="text-xs text-muted-foreground">{rec.description}</div>
                <button
                  onClick={() => handleAction({ type: rec.action_type, label: rec.action_label })}
                  className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {rec.action_label}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {starting ? (
          <div className="text-center text-muted-foreground text-sm">Starting assistant...</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? 'text-right' : ''}
            >
              <div
                className={`inline-block max-w-[85%] p-3 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.content}
                
                {msg.action && (
                  <button
                    onClick={() => handleAction(msg.action!)}
                    className={`block mt-2 text-xs font-medium ${
                      msg.role === 'user' ? 'opacity-80 hover:opacity-100' : 'text-blue-600 dark:text-blue-400 hover:underline'
                    }`}
                  >
                    {msg.action.label}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="text-muted-foreground text-sm">Thinking...</div>
        )}
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={
              mode === 'mat' 
                ? "Ask about materials, dimensions..." 
                : "Ask about access, delivery..."
            }
            disabled={loading}
            data-testid="input-ai-message"
          />
          <Button
            onClick={sendMessage}
            disabled={!userInput.trim() || loading}
            size="icon"
            data-testid="button-send-ai-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This is optional. You can post your job anytime without using this.
        </p>
      </div>
    </div>
  );
}
