import { useState, FormEvent } from 'react';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { CheckCircle, ThumbsUp, Minus, ThumbsDown } from 'lucide-react';

interface FeedbackFormProps {
  conversationId: string;
  onSubmitted?: () => void;
}

export function FeedbackForm({ conversationId, onSubmitted }: FeedbackFormProps) {
  const [feedbackText, setFeedbackText] = useState('');
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'issue'>('positive');
  
  const [qualityLevel, setQualityLevel] = useState<'exceeded' | 'met' | 'needs_attention' | null>(null);
  const [communicationLevel, setCommunicationLevel] = useState<'exceeded' | 'met' | 'needs_attention' | null>(null);
  const [timelinessLevel, setTimelinessLevel] = useState<'exceeded' | 'met' | 'needs_attention' | null>(null);
  
  const [allowPublic, setAllowPublic] = useState(false);
  const [publicSnippet, setPublicSnippet] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function levelToRating(level: string | null): number | null {
    if (!level) return null;
    switch (level) {
      case 'exceeded': return 5;
      case 'met': return 3;
      case 'needs_attention': return 2;
      default: return null;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/conversations/${conversationId}/feedback`, {
        feedback_text: feedbackText,
        sentiment,
        quality_rating: levelToRating(qualityLevel),
        communication_rating: levelToRating(communicationLevel),
        timeliness_rating: levelToRating(timelinessLevel),
        allow_public_snippet: allowPublic && sentiment === 'positive',
        public_snippet: publicSnippet || feedbackText.substring(0, 100),
      });
      
      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to submit feedback';
      alert(errMsg);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Thank You!</h3>
          <p className="text-green-700 dark:text-green-300 text-sm">
            Your feedback has been sent directly to the company's private inbox.
            It will NOT be posted publicly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Your Feedback</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your comments go directly to the company's leadership. 
          They are <strong>NOT posted publicly</strong>.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">How was your experience?</label>
            <div className="flex gap-2">
              {(['positive', 'neutral', 'issue'] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={sentiment === s ? 'default' : 'outline'}
                  onClick={() => setSentiment(s)}
                  className={`flex-1 ${
                    sentiment === s
                      ? s === 'positive' ? 'bg-green-600 hover:bg-green-700' :
                        s === 'neutral' ? 'bg-gray-600 hover:bg-gray-700' :
                        'bg-amber-600 hover:bg-amber-700'
                      : ''
                  }`}
                  data-testid={`button-sentiment-${s}`}
                >
                  {s === 'positive' && 'Great'}
                  {s === 'neutral' && 'Okay'}
                  {s === 'issue' && 'Issue'}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <LevelInput 
              label="Quality" 
              value={qualityLevel} 
              onChange={setQualityLevel} 
            />
            <LevelInput 
              label="Communication" 
              value={communicationLevel} 
              onChange={setCommunicationLevel} 
            />
            <LevelInput 
              label="Timeliness" 
              value={timelinessLevel} 
              onChange={setTimelinessLevel} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Your Feedback</label>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Share your experience..."
              required
              className="min-h-[120px]"
              data-testid="textarea-feedback"
            />
          </div>

          {sentiment === 'positive' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="allow-public"
                  checked={allowPublic}
                  onCheckedChange={(checked) => setAllowPublic(checked === true)}
                  data-testid="checkbox-allow-public"
                />
                <div className="flex-1">
                  <label htmlFor="allow-public" className="text-sm font-medium text-blue-800 dark:text-blue-200 cursor-pointer">
                    Allow company to share a short positive snippet publicly
                  </label>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Only the company can choose to share this. Your full feedback stays private.
                  </p>
                </div>
              </div>
              
              {allowPublic && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Public snippet (optional)
                  </label>
                  <Input
                    type="text"
                    value={publicSnippet}
                    onChange={(e) => setPublicSnippet(e.target.value)}
                    placeholder="Great work!"
                    maxLength={280}
                    data-testid="input-public-snippet"
                  />
                </div>
              )}
            </div>
          )}

          <div className="bg-muted/50 rounded p-3 text-xs text-muted-foreground">
            <strong>Privacy:</strong> Your feedback goes directly to the company's private inbox. 
            It is NOT posted publicly. The company can delete feedback at any time - it's their right.
            {sentiment === 'positive' && allowPublic && (
              <> Only if you checked the box above AND the company chooses to share it, 
              will a short positive snippet appear publicly.</>
            )}
          </div>

          <Button
            type="submit"
            disabled={!feedbackText.trim() || submitting}
            className="w-full"
            data-testid="button-submit-feedback"
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LevelInput({ 
  label, 
  value, 
  onChange 
}: { 
  label: string; 
  value: 'exceeded' | 'met' | 'needs_attention' | null; 
  onChange: (v: 'exceeded' | 'met' | 'needs_attention' | null) => void;
}) {
  const options: Array<{ value: 'exceeded' | 'met' | 'needs_attention'; icon: typeof ThumbsUp; color: string }> = [
    { value: 'exceeded', icon: ThumbsUp, color: 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    { value: 'met', icon: Minus, color: 'bg-gray-100 border-gray-500 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    { value: 'needs_attention', icon: ThumbsDown, color: 'bg-amber-100 border-amber-500 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  ];

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1 text-center">{label}</label>
      <div className="flex justify-center gap-1">
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <Button
              key={opt.value}
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChange(value === opt.value ? null : opt.value)}
              className={value === opt.value ? opt.color : ''}
              title={opt.value.replace('_', ' ')}
              data-testid={`button-${label.toLowerCase()}-${opt.value}`}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
