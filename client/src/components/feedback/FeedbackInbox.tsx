import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Archive, Trash2, Globe, ThumbsUp, Minus, ThumbsDown, MessageSquare } from 'lucide-react';

interface Feedback {
  id: string;
  from_display_name: string;
  feedback_text: string;
  sentiment: 'positive' | 'neutral' | 'issue';
  quality_rating: number;
  communication_rating: number;
  timeliness_rating: number;
  is_handled: boolean;
  created_at: string;
  opportunity_title: string;
}

interface PendingAppreciation {
  id: string;
  snippet: string;
  from_display_name: string;
  is_public: boolean;
}

export function FeedbackInbox() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [appreciations, setAppreciations] = useState<PendingAppreciation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('unhandled');

  useEffect(() => {
    fetchFeedback();
    fetchAppreciations();
  }, [filter]);

  async function fetchFeedback() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'unhandled') params.set('include_handled', 'false');
      if (filter === 'positive') params.set('sentiment', 'positive');
      if (filter === 'issue') params.set('sentiment', 'issue');
      
      const data = await api.get<{ feedback: Feedback[] }>(`/contractors/me/feedback?${params}`);
      setFeedback(data.feedback || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAppreciations() {
    try {
      const data = await api.get<{ appreciations: PendingAppreciation[] }>(
        `/contractors/me/appreciations?pending=true`
      );
      setAppreciations(data.appreciations || []);
    } catch (error) {
      console.log('Appreciations endpoint not available');
    }
  }

  async function handleFeedback(id: string, action: 'mark_handled' | 'archive' | 'delete') {
    const notes = action === 'delete' ? prompt('Reason for deleting (optional):') : undefined;
    
    try {
      await api.post(`/contractors/me/feedback/${id}/handle`, { action, notes });
      fetchFeedback();
    } catch (error) {
      console.error('Error handling feedback:', error);
    }
  }

  async function promoteAppreciation(id: string) {
    if (!confirm('Make this appreciation public? It will appear on your profile.')) return;
    
    try {
      await api.post(`/contractors/me/appreciations/${id}/promote`);
      fetchAppreciations();
      alert('Appreciation is now public!');
    } catch (error) {
      console.error('Error promoting appreciation:', error);
    }
  }

  function getSentimentColor(sentiment: string): string {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'neutral': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'issue': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function ratingToIcon(rating: number | null) {
    if (!rating) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (rating >= 4) return <ThumbsUp className="h-4 w-4 text-green-600" />;
    if (rating >= 3) return <Minus className="h-4 w-4 text-gray-600" />;
    return <ThumbsDown className="h-4 w-4 text-amber-600" />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <h2 className="text-xl font-semibold" data-testid="text-feedback-inbox-title">Feedback Inbox</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="p-2 border rounded text-sm bg-background"
          data-testid="select-feedback-filter"
        >
          <option value="unhandled">Unhandled</option>
          <option value="all">All</option>
          <option value="positive">Positive</option>
          <option value="issue">Issues</option>
        </select>
      </div>

      <Tabs defaultValue="feedback">
        <TabsList>
          <TabsTrigger value="feedback" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" /> Feedback ({feedback.length})
          </TabsTrigger>
          <TabsTrigger value="appreciations" className="flex items-center gap-1">
            <Globe className="h-4 w-4" /> Pending Appreciations ({appreciations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="mt-4 space-y-3">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : feedback.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No feedback yet</div>
          ) : (
            feedback.map((item) => (
              <Card key={item.id} data-testid={`card-feedback-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
                    <div>
                      <span className="font-medium">{item.from_display_name}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Badge className={getSentimentColor(item.sentiment)}>
                      {item.sentiment}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">{item.opportunity_title}</p>
                  
                  <p className="text-sm mb-3">{item.feedback_text}</p>

                  <div className="flex gap-4 mb-3">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">Quality:</span>
                      {ratingToIcon(item.quality_rating)}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">Communication:</span>
                      {ratingToIcon(item.communication_rating)}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">Timeliness:</span>
                      {ratingToIcon(item.timeliness_rating)}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {!item.is_handled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFeedback(item.id, 'mark_handled')}
                        data-testid={`button-handle-${item.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" /> Mark Handled
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleFeedback(item.id, 'archive')}
                    >
                      <Archive className="h-4 w-4 mr-1" /> Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleFeedback(item.id, 'delete')}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="appreciations" className="mt-4 space-y-3">
          {appreciations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No pending appreciations. When customers allow positive snippets to be shared, they'll appear here.
            </div>
          ) : (
            appreciations.map((item) => (
              <Card key={item.id} data-testid={`card-appreciation-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="font-medium">{item.from_display_name}</span>
                    {item.is_public ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Public
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                  
                  <p className="text-sm mb-3 bg-muted/50 p-3 rounded italic">
                    "{item.snippet}"
                  </p>

                  {!item.is_public && (
                    <Button
                      size="sm"
                      onClick={() => promoteAppreciation(item.id)}
                      data-testid={`button-promote-${item.id}`}
                    >
                      <Globe className="h-4 w-4 mr-1" /> Make Public
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
        <strong>Your control:</strong> You can delete any feedback at any time. 
        Public appreciations only appear if you choose to promote them.
      </div>
    </div>
  );
}
